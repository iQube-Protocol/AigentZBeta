/**
 * POST /api/experiments/irl-exp001 — run IRL-EXP-001 Stage A (CRP-002 / metaMe IRL).
 *
 * INDEPENDENCE PROTOCOL (Aletheon 2026-07-09): the reference set (CIRS) is
 * GENERATED at run time by the generative role (generateCandidateCIRS), blind to
 * any prior version and never authored by the PIs. The prediction under test is
 * produced by the evaluative role (predictInvariantsForIntent). The two route
 * through DIFFERENT reasoning stages (`draft` vs `classification`) → different
 * providers → the deltas are real cross-model disagreements, not self-agreement.
 *
 * Predicts the invariant projection for each intent (via the sovereign,
 * invariant-aware router), scores it against the independent reference, and
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
import { generateCandidateCIRS } from '@/services/experiments/cirsGenerator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    // Generative role: independently propose the reference set, blind to any
    // prior CIRS version (never PI-authored). Evaluative role then predicts +
    // scores against it inside runIrlExp001StageA.
    const cirs = await generateCandidateCIRS();
    const { results, aggregate } = await runIrlExp001StageA(cirs);
    return NextResponse.json({
      ok: true,
      experiment: 'IRL-EXP-001',
      stage: 'A',
      at: new Date().toISOString(),
      cirs,
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
