/**
 * /api/constitutional/guided-onboarding — serve the CFS-043a guided passport &
 * delegation onboarding plan for an agent to run with its human principal.
 *
 * This route RETURNS A PLAN (steps, deep links, drafted bounded authority,
 * graded proof requirement). It does NOT execute form/accept/authorize — those
 * remain the caller's own calls to /api/constitutional/agreement, so the
 * Principal–Delegate Separation safeguard is preserved end-to-end (the human
 * still performs authorize themselves). The plan is pure composition; no new
 * trust surface.
 *
 * POST body: {
 *   agreementId, displayLabel, capabilityRef, agentRef, agentAcceptorId,
 *   allowedActions: string[], ttlHours, maxActions,
 *   risk: 'read-write' | 'money-moving', valueCeiling?, governingInvariants?,
 *   personaSessionToken?  // to attach identity to the passport deep links
 * }
 *
 * Charter: CFS-043 · Script: CFS-043a.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildOnboardingPlan, type RiskProfile } from '@/services/constitutional/guidedOnboarding';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '');
  const num = (k: string, def: number) => (typeof body[k] === 'number' ? (body[k] as number) : def);
  const risk: RiskProfile = body.risk === 'money-moving' ? 'money-moving' : 'read-write';

  const agreementId = str('agreementId');
  const capabilityRef = str('capabilityRef');
  const agentRef = str('agentRef');
  const agentAcceptorId = str('agentAcceptorId') || agentRef;
  const allowedActions = Array.isArray(body.allowedActions)
    ? (body.allowedActions as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  if (!agreementId || !capabilityRef || !agentRef || allowedActions.length === 0) {
    return NextResponse.json(
      { error: 'agreementId, capabilityRef, agentRef, and a non-empty allowedActions[] are required' },
      { status: 400 },
    );
  }

  const plan = buildOnboardingPlan({
    agreementId,
    displayLabel: str('displayLabel') || capabilityRef,
    capabilityRef,
    agentRef,
    agentAcceptorId,
    allowedActions,
    ttlHours: num('ttlHours', 8),
    maxActions: num('maxActions', 1),
    risk,
    valueCeiling: typeof body.valueCeiling === 'number' ? (body.valueCeiling as number) : null,
    governingInvariants: Array.isArray(body.governingInvariants)
      ? (body.governingInvariants as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    link: { personaSessionToken: str('personaSessionToken') || undefined, from: 'guided-onboarding' },
  });

  return NextResponse.json({ ok: true, plan });
}
