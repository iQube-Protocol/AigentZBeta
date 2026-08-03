/**
 * POST /api/journey/moneypenny-horizen/claim/prove-control
 *
 * GJR Claim stage's one consequential action ("prove wallet control
 * precedes Marketa's final eligibility recommendation — never the
 * reverse"). Builds a fresh, purpose-bound control-proof challenge
 * (services/passport/controlProofChallenge.ts), signs it through the same
 * narrow signer Phase 1 built (services/signing/partnerAuthorizationSigner.ts
 * — 'wallet-control-proof' is its second purpose, not a generalization of
 * it), records the proof, and immediately runs Marketa's FINAL admission
 * assessment (services/marketa/admissionAssessmentRunner.ts) against it —
 * "Control Before Recommendation" made structural: this route cannot reach
 * the assessment call without a signature that recovered to the registered
 * controller wallet.
 *
 * Refuses honestly on its CONSTITUTIONAL prerequisites only: no persisted
 * AigentQube, no registration binding, no controller wallet, or a control
 * proof that does not recover to it. It deliberately does NOT require Pulse
 * or P&L authorization — those sit outside Marketa's REFUSAL_RULE_IDS and are
 * reported as `nonBlockingExceptions` (operator ruling 2026-08-03: an
 * optional partner enrichment must never immobilise personhood).
 *
 * Spine-gated: getActivePersona resolves the operator, recorded as every
 * receipt's principal.
 *
 * Agent-selectable (2026-07-31, services/horizen/registrableAgents.ts) —
 * GET takes ?agentSlug=, POST takes body.agentSlug; both default to
 * MoneyPenny for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { buildControlProofChallenge } from '@/services/passport/controlProofChallenge';
import { signPartnerAuthorization } from '@/services/signing/partnerAuthorizationSigner';
import { createActivityReceipt, listActivityReceiptsForPersona, type ActivityReceiptRecord } from '@/services/receipts/activityReceiptService';
import { runMarketaAdmissionAssessment } from '@/services/marketa/admissionAssessmentRunner';
import { CONTROL_PROOF_FRESHNESS_WINDOW_MS } from '@/services/marketa/externalAgentAdmissionEvidence';
import { getCurrentMarketaAdmissionAssessment } from '@/services/marketa/admissionAssessmentStore';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveHorizenRegistrationBinding } from '@/services/horizen/agentRegistrationBinding';

export const dynamic = 'force-dynamic';

/** The current (non-superseded) assessment, if any — lets the Claim surface survive a page reload without re-running the flow. */
/*
 * EVERY EXIT IS A NAMED ANSWER (operator, 2026-08-03, on the third report of
 * `Unexpected end of JSON input`).
 *
 * An unanticipated throw here — a Supabase client error, a partner socket
 * dropped, an import that fails at runtime — left the platform to answer, and
 * what it sends is not guaranteed to be JSON and can be nothing at all. A
 * thrown error is still information; discarding it and returning silence is
 * the defect. Enforced across every journey route by
 * tests/journey-response-honesty.test.ts.
 */
export async function GET(request: NextRequest) {
  try {
    return await getImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function getImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  const current = await getCurrentMarketaAdmissionAssessment(agent.aigentQubeId);
  return NextResponse.json({
    ok: true,
    assessment: current
      ? {
          assessmentId: current.assessmentId,
          decision: current.decision,
          mode: current.mode,
          rationale: current.rationale,
          satisfiedRules: current.satisfiedRules,
          missingRules: current.missingRules,
          failedRules: current.failedRules,
        }
      : null,
  });
}

interface ProveControlBody {
  /** Which registrable agent (services/horizen/registrableAgents.ts) — defaults to MoneyPenny for backward compatibility. */
  agentSlug?: string;
}

export async function POST(request: NextRequest) {
  try {
    return await postImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: ProveControlBody = {};
  try {
    body = (await request.json()) as ProveControlBody;
  } catch {
    // No body is fine — agentSlug falls back to the default below.
  }
  const agent = resolveRegistrableAgent(body.agentSlug ?? DEFAULT_REGISTRABLE_AGENT_SLUG);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${body.agentSlug}" is not a registrable agent` }, { status: 400 });
  }
  const AIGENTQUBE_ID = agent.aigentQubeId;
  const AGENT_KEY_REF = agent.runtimeAgentId;

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const { data: aigentQube } = await admin
    .from('registry_assets')
    .select('asset_id')
    .eq('asset_id', AIGENTQUBE_ID)
    .maybeSingle();
  if (!aigentQube) {
    return NextResponse.json({ ok: false, refusalCode: 'NO_PERSISTED_AIGENTQUBE', error: `no registry_assets row for "${AIGENTQUBE_ID}"` }, { status: 409 });
  }

  // The ONE resilient reader (services/horizen/agentRegistrationBinding.ts),
  // shared with both served Agent Card routes — falls back to the
  // confirmation receipt when the registry_assets projection hasn't caught
  // up with an already-confirmed registration (Aigent Nakamoto, 2026-08-03).
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    return NextResponse.json(
      { ok: false, refusalCode: 'MISSING_TOKEN_ID', error: `${agent.displayName} has no Horizen tokenId yet — the Register stage must complete first` },
      { status: 409 },
    );
  }
  /*
   * ── CLAIM NO LONGER WAITS ON A PARTNER ENRICHMENT (operator, 2026-08-03) ──
   *
   *   > "Verify should be the last Horizen dependent stage and then everything
   *   >  else is our own systems."
   *
   * This route used to REFUSE `VERIFY_NOT_COMPLETE` unless Pulse monitoring
   * AND P&L disclosure were both authorized. That gate was STRICTER THAN THE
   * CONSTITUTION IT ENFORCES: Marketa's ratified rule engine puts Pulse
   * (MKT-ADM-007) and P&L (MKT-ADM-008) OUTSIDE `REFUSAL_RULE_IDS`
   * (`{MKT-ADM-003, 004, 005, 006}`) — their absence is `missing`, an evidence
   * gap yielding NOT_RECOMMENDED, never `failed` and never REFUSED. The
   * Verify surface says so in its own words too: authorizing Pulse "does not
   * create or enlarge her constitutional authority."
   *
   * So a panel had invented a prerequisite the constitution does not have,
   * and an OPTIONAL partner enrichment was immobilising personhood. When the
   * local authorization store went missing, that self-imposed gate turned a
   * deploy step into a total block on Claim, Passport and delegation.
   *
   * What still gates Claim is unchanged and constitutional: a persisted
   * AigentQube, a registration binding, a controller wallet, and a fresh
   * proof of control that recovers to it. Marketa then reports Pulse/P&L
   * honestly as missing — which is a real, visible, non-blocking exception,
   * not a silent pass.
   */
  const transparencyExceptions: string[] = [];
  if (!binding.transparency?.pulse_enabled) transparencyExceptions.push('pulse-monitoring-not-authorized');
  if (!binding.transparency?.pnl_disclosure_authorized) transparencyExceptions.push('pnl-disclosure-not-authorized');

  const network = binding.network ?? 'base-sepolia';

  /*
   * RESUME FROM SETTLED STATE — NEVER RE-SIGN (operator, 2026-08-03):
   *
   *   > "Resume Claim from the existing agent_control_proven receipt. Do not
   *   >  request another signature... the five duplicate control-proof
   *   >  receipts should be treated as corroborating duplicates and never
   *   >  cause another signing prompt."
   *
   * Every prior call here signed a FRESH challenge unconditionally — the
   * actual mechanism that produced those five duplicates, and the reason a
   * retry after the (now-fixed) missing-migration refusal would have asked
   * for another signature. Checked BEFORE resolving the controller wallet:
   * a resumed Claim needs neither the wallet address nor a signer, only the
   * existing receipt. Checked agent-scoped (not persona-only) so a receipt
   * for a different agent under the same persona can never satisfy this —
   * same fix as externalAgentAdmissionEvidence.ts's control-proof lookup,
   * applied here first.
   */
  const existingControlReceipts = await listActivityReceiptsForPersona(persona.personaId, {
    actionTypes: ['agent_control_proven'],
    agentsInvoked: [AGENT_KEY_REF],
    limit: 5,
  });
  const existingFreshControlReceipt = existingControlReceipts.find((r) => {
    const actionInput = r.actionInput as { aigentQubeId?: string } | null;
    if (actionInput?.aigentQubeId !== AIGENTQUBE_ID) return false;
    return Date.now() - Date.parse(r.createdAt) <= CONTROL_PROOF_FRESHNESS_WINDOW_MS;
  });

  let controlReceipt: ActivityReceiptRecord | null;
  if (existingFreshControlReceipt) {
    controlReceipt = existingFreshControlReceipt;
  } else {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const addresses = await new AgentKeyService().getAgentAddresses(AGENT_KEY_REF);
    if (!addresses?.evmAddress) {
      return NextResponse.json({ ok: false, refusalCode: 'NO_CONTROLLER_WALLET', error: `no evm_address on record for agent "${AGENT_KEY_REF}"` }, { status: 409 });
    }

    const challenge = buildControlProofChallenge({ aigentQubeId: AIGENTQUBE_ID, controllerWallet: addresses.evmAddress });

    const signed = await signPartnerAuthorization({
      keyRef: AGENT_KEY_REF,
      payload: challenge.message,
      purpose: 'wallet-control-proof',
      expectedSigner: addresses.evmAddress,
      network,
      expiresAt: challenge.expiresAt,
    });
    if (!signed.ok) {
      return NextResponse.json({ ok: false, refusalCode: signed.refusalCode, error: signed.detail }, { status: 422 });
    }

    controlReceipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'agentiq',
      actionType: 'agent_control_proven',
      summary: `Wallet control proven for ${agent.displayName} (token ${binding.token_id}, ${network}) without revealing the private key`,
      agentsInvoked: [AGENT_KEY_REF],
      actionInput: {
        aigentQubeId: AIGENTQUBE_ID,
        signerWallet: signed.result.signerAddress,
        network,
        tokenId: binding.token_id,
        nonce: challenge.nonce,
        messageHash: signed.result.payloadHash,
      },
    });
  }

  const origin = resolveRequestOrigin(request);
  const assessmentResult = await runMarketaAdmissionAssessment({
    aigentQubeId: AIGENTQUBE_ID,
    actorPersonaId: persona.personaId,
    agentCardUrl: `${origin}${agent.agentCardPath}`,
    mode: 'FINAL',
    runtimeAgentId: AGENT_KEY_REF,
  });

  if (!assessmentResult.ok) {
    return NextResponse.json({
      ok: true,
      controlProofReceiptId: controlReceipt?.id ?? null,
      // Reported, never silently passed — a non-blocking exception the
      // operator can see and act on, distinct from a blocker.
      nonBlockingExceptions: transparencyExceptions,
      assessmentRefusalCode: assessmentResult.refusalCode,
      assessmentError: assessmentResult.detail,
    });
  }

  return NextResponse.json({
    ok: true,
    controlProofReceiptId: controlReceipt?.id ?? null,
    nonBlockingExceptions: transparencyExceptions,
    assessment: {
      assessmentId: assessmentResult.record.assessmentId,
      decision: assessmentResult.record.decision,
      rationale: assessmentResult.record.rationale,
      satisfiedRules: assessmentResult.record.satisfiedRules,
      missingRules: assessmentResult.record.missingRules,
      failedRules: assessmentResult.record.failedRules,
    },
  });
}
