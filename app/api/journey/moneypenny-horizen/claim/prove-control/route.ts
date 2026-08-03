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
 * Refuses honestly when Verify hasn't completed yet (no persisted
 * AigentQube, no tokenId, or Pulse/PnL transparency not yet confirmed) —
 * Claim's own prerequisite on Verify, checked from the same real registry
 * binding Verify itself writes to, not a second source of truth.
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
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { runMarketaAdmissionAssessment } from '@/services/marketa/admissionAssessmentRunner';
import { getCurrentMarketaAdmissionAssessment } from '@/services/marketa/admissionAssessmentStore';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveHorizenRegistrationBinding } from '@/services/horizen/agentRegistrationBinding';

export const dynamic = 'force-dynamic';

/** The current (non-superseded) assessment, if any — lets the Claim surface survive a page reload without re-running the flow. */
export async function GET(request: NextRequest) {
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
  if (!binding.transparency?.pulse_enabled || !binding.transparency?.pnl_disclosure_authorized) {
    return NextResponse.json(
      { ok: false, refusalCode: 'VERIFY_NOT_COMPLETE', error: 'Pulse monitoring and P&L disclosure must be authorized (Verify stage) before wallet control can be claimed' },
      { status: 409 },
    );
  }
  const network = binding.network ?? 'base-sepolia';

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

  const controlReceipt = await createActivityReceipt({
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

  const origin = resolveRequestOrigin(request);
  const assessmentResult = await runMarketaAdmissionAssessment({
    aigentQubeId: AIGENTQUBE_ID,
    actorPersonaId: persona.personaId,
    agentCardUrl: `${origin}${agent.agentCardPath}`,
    mode: 'FINAL',
  });

  if (!assessmentResult.ok) {
    return NextResponse.json({
      ok: true,
      controlProofReceiptId: controlReceipt?.id ?? null,
      assessmentRefusalCode: assessmentResult.refusalCode,
      assessmentError: assessmentResult.detail,
    });
  }

  return NextResponse.json({
    ok: true,
    controlProofReceiptId: controlReceipt?.id ?? null,
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
