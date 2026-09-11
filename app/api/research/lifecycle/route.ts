/**
 * POST /api/research/lifecycle — record an operator-initiated experiment
 * lifecycle transition (CFS-019 §4). Legality enforced (one step forward or
 * re-enter running), evidence required, receipted as
 * `research_lifecycle_transition` (DVN-anchorable) with the experiment's
 * governing invariants as invariants_used. Admin-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordExperimentTransition } from '@/services/research/lifecycle';
import type { ExperimentLifecycleState } from '@/types/research';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { experimentId?: string; from?: string; to?: string; evidence?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body.experimentId || !body.from || !body.to) {
    return NextResponse.json({ ok: false, error: 'experimentId, from, to required' }, { status: 400 });
  }

  const result = await recordExperimentTransition({
    personaId: persona.personaId,
    experimentId: body.experimentId,
    from: body.from as ExperimentLifecycleState,
    to: body.to as ExperimentLifecycleState,
    evidence: typeof body.evidence === 'string' ? body.evidence : '',
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
