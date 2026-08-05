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

export type VerifyStatusState = 'not-started' | 'pending' | 'complete' | 'denied' | 'expired';

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
    return NextResponse.json({ ok: true, state: 'complete' as VerifyStatusState, authorizationId, receiptRef: record.receiptRef });
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

  if (record.state === 'EXPIRED') {
    return NextResponse.json({ ok: true, state: 'expired' as VerifyStatusState, authorizationId, note: 'the request window lapsed locally, before reaching Horizen — Authorize may be retried' });
  }

  if (record.state === 'REFUSED' || record.state === 'QUARANTINED') {
    return NextResponse.json(
      { ok: true, state: 'denied' as VerifyStatusState, authorizationId, refusalCode: record.refusalCode, refusalDetail: record.refusalDetail },
      { status: 200 },
    );
  }

  // record.state === 'SUBMITTED' — Horizen's own state-changing call landed;
  // only the AUTHORITATIVE REREAD remains. Idempotent and safe to repeat as
  // many times as needed — it never re-signs and never re-submits.
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
  if (!addresses?.evmAddress) {
    return NextResponse.json({
      ok: true,
      state: 'pending' as VerifyStatusState,
      authorizationId,
      note: `${agent.displayName}'s controller wallet could not be re-resolved for the reread — the submitted authorization is unaffected; try again`,
    });
  }

  const timedOut = Symbol('verify-status-deadline');
  const result = await Promise.race([
    verifyHorizenTransparencyActivation(
      authorizationId,
      { actorPersonaId: persona.personaId, registry: { network, tokenId: binding.token_id, registryAlias: binding.registry_alias ?? undefined }, controllerWallet: addresses.evmAddress },
    ),
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
    return NextResponse.json({ ok: true, state: 'complete' as VerifyStatusState, authorizationId });
  }
  // A real answer came back and it was not a confirmation — REFUSED was just
  // persisted by verifyHorizenTransparencyActivation itself.
  return NextResponse.json({ ok: true, state: 'denied' as VerifyStatusState, authorizationId, refusalCode: result.refusalCode, error: result.detail });
}
