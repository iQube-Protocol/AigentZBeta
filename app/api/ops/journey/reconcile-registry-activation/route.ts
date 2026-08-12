import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { readSettledFact, isSettled } from '@/services/journey/settledFacts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/journey/reconcile-registry-activation
 *
 * The EXPLICIT, operator-invoked legacy-reconciliation path (Constitutional
 * State Model Correction, operator-ratified 2026-08-11, point 4: "It should
 * be callable by the Passport completion path and reconciliation of
 * already-passported legacy agents").
 *
 * ── WHY THIS EXISTS AS A SEPARATE ROUTE ───────────────────────────────────
 *
 * `resolveAgentAdmissionState` (services/journey/agentAdmissionState.ts)
 * already establishes `registryActivated` automatically at the Passport-
 * completion boundary — the ordinary journey `state` route triggers it for
 * any agent whose Passport genuinely completes going forward. But a LEGACY
 * agent (Aigent Nakamoto, admitted before this mechanism existed) may
 * ALREADY satisfy all three predicates from evidence that predates it —
 * and the operator was explicit that this must never happen automatically,
 * silently, the next time anyone reads that agent's journey state. This
 * route is the deliberate, named, operator-invoked act that performs that
 * reconciliation — never a side effect of an ordinary read.
 *
 * ── WHAT THIS DOES ────────────────────────────────────────────────────────
 *
 * Calls the SAME resolver the ordinary `state` route uses
 * (`resolveAgentAdmissionState`), passing `activationProvenance:
 * 'legacy-reconciled'` so the resulting `agent_registry_activated` receipt
 * (if one is newly established) honestly names itself as a reconciliation
 * of pre-existing evidence, not a fresh admission. Idempotent by the same
 * settled-fact mechanism every other call site uses — a second call against
 * an already-activated agent reports `already-active` and writes nothing.
 *
 * No Standing is ever awarded by this route, directly or indirectly.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as every other ops/journey
 * route. Requires `reconcilingPersonaId` — a real, named "who" for the
 * audit trail and the receipt's attribution, never a static resolver string.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { agentSlug?: string; reconcilingPersonaId?: string; callerAuthProfileId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { agentSlug, reconcilingPersonaId, callerAuthProfileId } = body;
  if (!agentSlug || !reconcilingPersonaId) {
    return NextResponse.json({ error: 'agentSlug and reconcilingPersonaId are both required' }, { status: 400 });
  }

  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return NextResponse.json({ error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    const before = await readSettledFact(admin, agent.aigentQubeId, agent.runtimeAgentId, 'registry_activated');
    const alreadyActiveBefore = isSettled(before);

    const admission = await resolveAgentAdmissionState(
      admin,
      agent,
      callerAuthProfileId ?? null,
      reconcilingPersonaId,
      'legacy-reconciled',
    );

    return NextResponse.json(
      {
        ok: admission.auditGaps.length === 0,
        agentSlug: agent.slug,
        runtimeAgentId: agent.runtimeAgentId,
        alreadyActiveBefore,
        registryActivated: admission.registryActivated,
        activatedByThisCall: !alreadyActiveBefore && admission.registryActivated === true,
        predicates: {
          registryPresent: admission.factoryPresent === true,
          sponsorBindingEstablished: admission.sponsorshipRecorded === true,
          agentPassportIssued: admission.delegatePassportIssued === true,
        },
        auditGaps: admission.auditGaps,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Explicit, operator-invoked reconciliation of registryActivated for a LEGACY agent whose sponsorship + Delegate ' +
        'Passport evidence already satisfies the activation predicates from before this mechanism existed. Never automatic ' +
        'on an ordinary journey-state read. Body: { agentSlug, reconcilingPersonaId, callerAuthProfileId? }. Idempotent — ' +
        'a second call against an already-activated agent is a no-op. Awards no Standing. Requires x-cron-token header ' +
        '(CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
