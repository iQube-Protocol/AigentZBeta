/**
 * POST /api/journey/moneypenny-horizen/verify/reconcile?agentSlug=...
 *
 * Reconciliation for an ALREADY-CONFIRMED Pulse authorization — the operator
 * directive, 2026-08-08: "Replace external-state-as-runtime-authority with
 * receipted constitutional state... Reconciliation does not rewrite
 * constitutional history. It produces new evidence."
 *
 * Everywhere else in this journey, a live `get_onboarding_status` reread
 * feeds a VERIFY-THEN-TRANSITION step (verifyHorizenTransparencyActivation),
 * gated to states that have not yet reached CONFIRMED. This route is
 * different on purpose: it runs the SAME kind of live reread against a row
 * that has ALREADY transitioned, compares it to the evidence receipted at
 * that transition, and:
 *   - agreement    -> records the check; nothing else changes.
 *   - disagreement -> writes a NEW `horizen_reconciliation_discrepancy_
 *     recorded` receipt naming exactly which fields disagreed. The
 *     constitutional state (`partner_authorization_requests.state`) is
 *     NEVER written by this route — a genuine revocation/expiry is a
 *     separate, deliberate constitutional act, not something a read
 *     response gets to decide unilaterally.
 *
 * Deliberately NOT wired into any automatic cadence (a click, a poll, a
 * cron) — see services/horizen/authorizationClient.ts's
 * reconcilePulseConstitutionalState for why: adding a live partner round
 * trip to an existing fast path is a latency/cost decision this route
 * leaves to whoever calls it, rather than deciding silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { reconcilePulseConstitutionalState } from '@/services/horizen/authorizationClient';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  try {
    return await reconcileImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here writes constitutional state — a thrown reconciliation attempt changes nothing.',
      },
      { status: 500 },
    );
  }
}

async function reconcileImpl(request: NextRequest) {
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

  // The SAME resolution verify/status and verify/authorize use to compute
  // authorizationId — read-only, no signing, no submission.
  const { resolveHorizenRegistrationBinding } = await import('@/services/horizen/agentRegistrationBinding');
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    return NextResponse.json(
      { ok: false, refusalCode: 'NOT_STARTED', error: 'no Horizen tokenId yet — Register has not completed, so there is nothing to reconcile' },
      { status: 409 },
    );
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;
  const authorizationId = `horizen-pulse-auth-${agent.aigentQubeId}-${binding.token_id}-${network}`;

  const result = await reconcilePulseConstitutionalState(authorizationId, {
    actorPersonaId: persona.personaId,
    registry: { network, tokenId: binding.token_id },
    runtimeAgentId: agent.runtimeAgentId,
  });

  if (!result.ok) {
    const status = result.refusalCode === 'STATE_MISMATCH' ? 409 : result.refusalCode === 'NO_RECEIPTED_EVIDENCE' ? 409 : 502;
    return NextResponse.json({ ok: false, authorizationId, refusalCode: result.refusalCode, error: result.detail }, { status });
  }

  return NextResponse.json({
    ok: true,
    authorizationId,
    agreement: result.agreement,
    disagreements: result.disagreements,
    discrepancyReceiptRef: result.discrepancyReceiptRef,
    receiptedEvidence: result.receiptedEvidence,
    freshStatus: result.freshStatus,
  });
}
