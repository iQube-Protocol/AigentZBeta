/**
 * POST /api/experiments/irl-exp001 — run IRL-EXP-001 Stage A (CRP-002 / metaMe IRL).
 *
 * Predicts the invariant projection for each CIRS-v0.1 intent (via the sovereign,
 * invariant-aware router), scores it against the experimental reference, and
 * classifies the Invariant Deltas. Returns per-intent results + the aggregate.
 * Admin-gated (spine). T2-safe: the response carries only intent phrases,
 * principle labels, fidelity numbers, and delta classifications — never a T0 id.
 *
 * This is the EXPLICIT objective (projection fidelity) AND the HIDDEN objective
 * (the classified deltas that feed the emergent WP0). Not published canonically
 * here — this is the live measurement surface; canonical publication is a
 * follow-on once the operator ratifies a run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { runIrlExp001StageA } from '@/services/experiments/irlExp001';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const { results, aggregate } = await runIrlExp001StageA();
    return NextResponse.json({
      ok: true,
      experiment: 'IRL-EXP-001',
      stage: 'A',
      at: new Date().toISOString(),
      aggregate,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    experiment: 'IRL-EXP-001',
    family: 'Intent → Invariant Projection Fidelity',
    stage: 'A',
    note: 'POST (admin) runs Stage A over CIRS-v0.1: predict → score → classify Invariant Deltas.',
  });
}
