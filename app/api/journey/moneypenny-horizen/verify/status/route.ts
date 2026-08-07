/**
 * GET /api/journey/moneypenny-horizen/verify/status?agentSlug=...
 *
 * The Verify stage's status check — mirrors register/status/route.ts's own
 * pattern (bounded reread, never a raw platform 504, never requires
 * repeating an earlier act) for the sibling ceremony that had none.
 *
 * ── Why this exists (Horizen live-test escalation + al's brief, 2026-08-05) ─
 *
 * `verify/authorize` runs prepare -> sign -> submit -> reread as ONE request.
 * A transport failure (gateway 504) anywhere in that chain — including
 * during the FINAL reread, after Horizen's state-changing
 * `enable_pulse_monitoring` call already landed — left the operator with
 * nothing but "did not answer in time." Clicking Authorize again would hit
 * `createPartnerAuthorizationRequest`'s own collision guard
 * (AUTHORIZATION_ALREADY_IN_FLIGHT for a SUBMITTED row) rather than silently
 * double-submitting — safe, but a dead end with no way forward.
 *
 * This route is that way forward: it reads the persisted
 * `partner_authorization_requests` row (services/horizen/
 * partnerAuthorizationStore.ts) for the SAME deterministic authorizationId
 * `verify/authorize` would compute, and:
 *   - no row at all           -> 'not-started' (nothing to resume)
 *   - PREPARED/AWAITING_SIGNATURE/SIGNED -> 'pending' (ceremony started,
 *     never reached Horizen's state-changing call — Authorize is safe to
 *     retry from scratch)
 *   - SUBMITTED                -> re-attempts ONLY the reread
 *     (verifyHorizenTransparencyActivation, idempotent — never re-signs,
 *     never re-submits), bounded by this route's own deadline so a slow
 *     Horizen produces an honest 'pending' answer, never a raw platform 504
 *   - CONFIRMED                -> 'complete'
 *   - REFUSED/QUARANTINED      -> 'denied' (Horizen, or a local integrity
 *     check, explicitly rejected — never set by a transport timeout, see
 *     authorizationClient.ts's own state-transition sites)
 *   - EXPIRED                  -> 'expired' (the request's own window
 *     lapsed locally; distinct from a partner denial — Authorize may be
 *     retried, the store safely resets a non-SUBMITTED expired row)
 *
 * A transport timeout on THIS route's own reread attempt is reported as
 * 'pending' (never 'denied', never "please authorize again") — the same
 * principle just applied to the Crystal review ceremony this session:
 * a partner transport failure is not a partner verdict.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { getPartnerAuthorizationRequest } from '@/services/horizen/partnerAuthorizationStore';
import { verifyHorizenTransparencyActivation } from '@/services/horizen/authorizationClient';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/**
 * Bounded the same way register/status/route.ts bounds its own reread — an
 * answer THIS route produces says something true ("the check did not
 * complete"); an answer the platform gateway produces says nothing at all.
 */
const STATUS_DEADLINE_MS = 25_000;

/**
 * `not-enrolled` (Al's follow-up brief, 2026-08-06) is DISTINCT from
 * `denied`/`pending` — it names an authoritative, conclusive, retryable
 * negative ("Horizen said no, in words") rather than a generic local/partner
 * refusal or an inconclusive reread. See PARTNER_NOT_ENROLLED's doc comment
 * in authorizationClient.ts for the full evidence chain.
 *
 * `owner-source-conflict` (Al's escalation, 2026-08-06) is DISTINCT again —
 * NOT retryable, and never framed as a signature/wallet defect: it names a
 * disagreement between two of HORIZEN'S OWN services about who owns the
 * token. No local action resolves it. See HORIZEN_OWNER_SOURCE_CONFLICT's
 * doc comment in authorizationClient.ts for the full evidence chain.
 */
export type VerifyStatusState =
  | 'not-started'
  | 'pending'
  | 'complete'
  | 'denied'
  | 'expired'
  | 'not-enrolled'
  | 'owner-source-conflict';

export async function GET(request: NextRequest) {
  try {
    return await statusImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the authorization is pending, confirmed or denied — the last known state is unchanged.',
      },
      { status: 500 },
    );
  }
}

async function statusImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return NextResponse.json(
      { ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${agentSlug}" is not a registrable agent` },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  // The SAME resolution verify/authorize uses to compute authorizationId —
  // read-only, no signing, no submission.
  const { resolveHorizenRegistrationBinding } = await import('@/services/horizen/agentRegistrationBinding');
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    return NextResponse.json({ ok: true, state: 'not-started' as VerifyStatusState, note: 'no Horizen tokenId yet — Register has not completed' });
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;
  const authorizationId = `horizen-pulse-auth-${agent.aigentQubeId}-${binding.token_id}-${network}`;

  const record = await getPartnerAuthorizationRequest(authorizationId, admin);
  if (!record) {
    return NextResponse.json({ ok: true, state: 'not-started' as VerifyStatusState, authorizationId });
  }

  if (record.state === 'CONFIRMED') {
    /*
     * AUTHORIZATION CONFIRMED IS NOT THE SAME FACT AS ENRICHMENT COMPLETE
     * (Aigent Nakamoto, 2026-08-07). This branch used to answer 'complete'
     * from the partner_authorization_requests row alone, without ever
     * looking at whether the confirmed authorization actually got projected
     * onto the binding's `transparency` field. When `enrichAgentCardAfter-
     * HorizenAuthorization` throws or is skipped between CONFIRMED being
     * written and the Agent Card enrichment step running (e.g. the
     * authorize route's own top-level catch swallowing a throw that landed
     * AFTER the partner call already confirmed), every subsequent status
     * check hit this exact short-circuit and reported 'complete' forever,
     * with no path that ever retried or even surfaced the gap.
     *
     * `binding` (resolved above, same resolver verify/authorize uses) already
     * tells us whether the projection landed — no extra query needed. If it
     * has not, this reruns the SAME idempotent enrichment write against the
     * SAME already-matching binding (confirmed present by direct query,
     * 2026-08-07: registry=horizen, network=base-sepolia, token_id=8798) —
     * never a fabricated one. Mirrors the identical enrichment-outcome shape
     * the reconciliation branch below already uses (inv.engineering.036/037).
     */
    if (binding.transparency?.pulse_enabled) {
      return NextResponse.json({ ok: true, state: 'complete' as VerifyStatusState, authorizationId, receiptRef: record.receiptRef });
    }

    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
    if (!addresses?.evmAddress) {
      return NextResponse.json({
        ok: true,
        state: 'complete' as VerifyStatusState,
        authorizationId,
        receiptRef: record.receiptRef,
        enrichmentRefusalCode: 'NO_CONTROLLER_WALLET',
        enrichmentError: `${agent.displayName}'s controller wallet could not be resolved to retry enrichment`,
      });
    }

    const { enrichAgentCardAfterHorizenAuthorization } = await import('@/services/horizen/agentCardEnrichment');
    const enrichment = await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: persona.personaId,
      aigentQubeId: agent.aigentQubeId,
      runtimeAgentId: agent.runtimeAgentId,
      displayName: agent.displayName,
      authorizationId,
      controllerWallet: addresses.evmAddress,
      tokenId: binding.token_id,
      network,
      signatureRef: null,
      submissionRef: null,
    });
    return NextResponse.json({
      ok: true,
      state: 'complete' as VerifyStatusState,
      authorizationId,
      receiptRef: record.receiptRef,
      ...(enrichment.ok
        ? { receiptRefs: enrichment.receiptRefs }
        : { enrichmentRefusalCode: enrichment.refusalCode, enrichmentError: enrichment.detail }),
    });
  }

  if (record.state === 'PREPARED' || record.state === 'AWAITING_SIGNATURE' || record.state === 'SIGNED') {
    return NextResponse.json({
      ok: true,
      state: 'pending' as VerifyStatusState,
      authorizationId,
      partnerState: record.state,
      note: 'the ceremony started but never reached Horizen’s state-changing call — Authorize is safe to retry from scratch',
    });
  }

  /*
   * ── EVERY REMAINING STATE GETS A REAL PARTNER REREAD (Al's change 3,
   * 2026-08-06: "The button must not merely reload the current local
   * authorization row… Do not silently do nothing.") ──────────────────────
   *
   * SUBMITTED, REFUSED, QUARANTINED and EXPIRED all reach Horizen below.
   * REFUSED especially: a LOCAL decision (a missing submission reference, an
   * inconclusive earlier reread) may have refused a submission the partner
   * actually accepted, so partner STATE must be allowed to override a local
   * verdict. That is the whole reason the operator pressed this button.
   *
   * The reread is idempotent — it never re-signs and never re-submits.
   */
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
  if (!addresses?.evmAddress) {
    return NextResponse.json({
      ok: true,
      state: 'pending' as VerifyStatusState,
      authorizationId,
      partnerState: record.state,
      note: `${agent.displayName}'s controller wallet could not be re-resolved for the reread — the submitted authorization is unaffected; try again`,
    });
  }

  const { RECONCILABLE_STATES } = await import('@/services/horizen/authorizationClient');
  const timedOut = Symbol('verify-status-deadline');
  const result = await Promise.race([
    verifyHorizenTransparencyActivation(authorizationId, {
      actorPersonaId: persona.personaId,
      registry: { network, tokenId: binding.token_id, registryAlias: binding.registry_alias ?? undefined },
      controllerWallet: addresses.evmAddress,
      allowStates: RECONCILABLE_STATES,
    }),
    new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), STATUS_DEADLINE_MS)),
  ]);

  if (result === timedOut) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'STATUS_UNAVAILABLE',
        state: 'pending' as VerifyStatusState,
        authorizationId,
        error:
          `Horizen did not answer the status check within ${Math.round(STATUS_DEADLINE_MS / 1000)}s. This says ` +
          'nothing about the authorization — it is submitted and unaffected, and nothing needs re-authorizing. ' +
          'The check is safe to repeat.',
      },
      { status: 504 },
    );
  }

  if (result.ok) {
    /*
     * CONFIRMATION MUST ALSO LAND ON THE AGENT CARD (Al's change 3, items 4-5).
     * `verifyHorizenTransparencyActivation` writes CONFIRMED and the activity
     * receipt; the Agent Card transparency block is enriched by the authorize
     * route, so a confirmation discovered HERE — the whole point of a refresh
     * that reconciles — has to run the same enrichment or the Verify surface
     * would stay grey while the authorization is confirmed. Idempotent by the
     * same deterministic authorizationId, so repeated refreshes are safe.
     */
    const { enrichAgentCardAfterHorizenAuthorization } = await import('@/services/horizen/agentCardEnrichment');
    const enrichment = await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: persona.personaId,
      aigentQubeId: agent.aigentQubeId,
      runtimeAgentId: agent.runtimeAgentId,
      displayName: agent.displayName,
      authorizationId,
      controllerWallet: addresses.evmAddress,
      tokenId: binding.token_id,
      network,
      signatureRef: null,
      submissionRef: null,
    });
    const confirmedRecord = await getPartnerAuthorizationRequest(authorizationId, admin);
    return NextResponse.json({
      ok: true,
      state: 'complete' as VerifyStatusState,
      authorizationId,
      reconciledFrom: record.state,
      receiptRef: confirmedRecord?.receiptRef ?? null,
      /*
       * THE STRUCTURED PROJECTION, CARRIED VERBATIM ("Close Pulse now"
       * directive, 2026-08-08) — `pulseCommitmentRecorded`,
       * `verifiablePnlRegistered`, `endpointWarning`, pulled directly from
       * THIS reread's own `get_onboarding_status` JSON by
       * `verifyHorizenTransparencyActivation` (never re-derived from prose
       * here). `PulseTransparencyToggle` renders these directly rather than
       * inferring them from the Agent Card's own, narrower `pulse.enabled`.
       */
      structuredStatus: result.structuredStatus ?? null,
      ...(enrichment.ok
        ? { receiptRefs: enrichment.receiptRefs }
        : { enrichmentRefusalCode: enrichment.refusalCode, enrichmentError: enrichment.detail }),
    });
  }

  /*
   * A real answer came back and it was not a confirmation. `PARTNER_STATE_
   * UNRESOLVED` is explicitly NOT a denial (see its own doc comment) — it maps
   * to 'pending' so the surface keeps polling and never asks the operator to
   * re-authorize. Only a genuine partner/local REFUSAL reads as 'denied', and
   * for a row that was already REFUSED we report its ORIGINAL refusal rather
   * than the inconclusive reread's wording.
   */
  /*
   * A CONCLUSIVE NEGATIVE, checked BEFORE the inconclusive-pending case below
   * (Al's follow-up brief, 2026-08-06). Horizen answered in words — "not
   * enrolled", "Next step: Enroll" — so this is never rendered as "Verification
   * pending — Horizen has not yet responded"; that copy is reserved for
   * genuine silence/ambiguity. Retryable immediately: the surface offers
   * "Create fresh authorization" from this state without an extra click.
   */
  /*
   * A PARTNER-SIDE DATA CONFLICT, checked BEFORE every other branch (Al's
   * escalation, 2026-08-06). Horizen's OWN two services (REST vs
   * onboarding-status) disagree about who owns this token — never our
   * signature, our wallet, or our retry to fix. NOT retryable: the surface
   * must not offer "Create fresh authorization" from this state, and must
   * show both addresses rather than describe this as a signature failure.
   */
  if (result.refusalCode === 'HORIZEN_OWNER_SOURCE_CONFLICT') {
    return NextResponse.json({
      ok: true,
      state: 'owner-source-conflict' as VerifyStatusState,
      authorizationId,
      refusalCode: result.refusalCode,
      refusalDetail: result.detail,
      retryable: false,
      note: 'Horizen’s own services disagree about who owns this token — this cannot be resolved by re-authorizing.',
    });
  }

  if (result.refusalCode === 'PARTNER_NOT_ENROLLED') {
    return NextResponse.json({
      ok: true,
      state: 'not-enrolled' as VerifyStatusState,
      authorizationId,
      refusalCode: result.refusalCode,
      refusalDetail: result.detail,
      retryable: result.retryable ?? true,
      note: 'Horizen’s current authoritative state reports this agent is not enrolled in Pulse monitoring. The previous submission did not establish enrollment.',
    });
  }

  if (result.refusalCode === 'PARTNER_STATE_UNRESOLVED') {
    return NextResponse.json({
      ok: true,
      state: 'pending' as VerifyStatusState,
      authorizationId,
      partnerState: record.state,
      refusalCode: result.refusalCode,
      note: result.detail,
    });
  }

  if (record.state === 'REFUSED' || record.state === 'QUARANTINED') {
    return NextResponse.json({
      ok: true,
      state: 'denied' as VerifyStatusState,
      authorizationId,
      refusalCode: record.refusalCode,
      refusalDetail: record.refusalDetail,
      note: `Re-checked against Horizen; the partner did not report Pulse as enabled. Reread outcome: ${result.detail}`,
    });
  }
  if (record.state === 'EXPIRED') {
    return NextResponse.json({
      ok: true,
      state: 'expired' as VerifyStatusState,
      authorizationId,
      note: `the request window lapsed locally, before reaching Horizen — Authorize may be retried. Reread outcome: ${result.detail}`,
    });
  }
  return NextResponse.json({ ok: true, state: 'denied' as VerifyStatusState, authorizationId, refusalCode: result.refusalCode, error: result.detail });
}
