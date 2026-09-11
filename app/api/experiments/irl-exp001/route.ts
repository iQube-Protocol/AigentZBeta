/**
 * POST /api/experiments/irl-exp001 — run EXP-006 Stage A (CRP-002 / metaMe IRL).
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
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import { runIrlExp001StageA } from '@/services/experiments/irlExp001';
import { generateCandidateCIRS } from '@/services/experiments/cirsGenerator';
import { runBaselines } from '@/services/experiments/exp006Baselines';
import { gradeProjectionRun } from '@/services/experiments/gradedProjectionScore';
import { scoreTopologyRun } from '@/services/experiments/topologyProjectionScore';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  // Admin-or-entitled: admins bypass; otherwise the caller needs research access
  // scoped to EXP-006 (per-invitation) with remaining quota.
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const quotaClient = getSupabaseServer();
  if (!quotaClient) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });
  const quota = await checkExperimentQuota(quotaClient, persona.personaId, new Date(), isAdmin, 'EXP-006');
  if (!quota.allowed) {
    return NextResponse.json({ error: 'forbidden', message: quota.reason ?? 'Research access required' }, { status: 403 });
  }

  // Opt-in comparator arms (Aletheon 2026-07-20: "43% compared to what?"). The
  // random/keyword/semantic floor is only computed when requested, since the
  // semantic arm calls an embedding provider.
  let withBaselines = false;
  let withTopology = false;
  try {
    const body = (await request.json().catch(() => ({}))) as { baselines?: boolean; topology?: boolean };
    withBaselines = body?.baselines === true;
    withTopology = body?.topology === true;
  } catch { /* no body — plain run */ }

  try {
    // Generative role: independently propose the reference set, blind to any
    // prior CIRS version (never PI-authored). Evaluative role then predicts +
    // scores against it inside runIrlExp001StageA.
    const cirs = await generateCandidateCIRS();
    const { results, aggregate } = await runIrlExp001StageA(cirs);
    // Graded scorer (Aletheon 2026-07-20): the exact-match aggregate above is the
    // raw Stage-A baseline (never overwritten); `graded` reports the normalized
    // tier alongside it + the GENUINE deltas, so morphological/separator variants
    // (accessibility≈accessible, root_cause≈root-cause) stop being double-counted.
    const graded = gradeProjectionRun(results);
    // EXP-006A (opt-in): topology/abstraction-aware scoring. The subsumption
    // oracle is graph-first (specializes edges as ground truth), embedding proxy
    // fallback. Embedding-heavy, so it rides with the same opt-in as baselines.
    const topology = withTopology ? await scoreTopologyRun(results) : null;
    // Baselines run against the SAME CIRS so the comparison is exact. The
    // sovereign arm's summary is folded in for a side-by-side table.
    const comparison = withBaselines
      ? {
          sovereign: {
            arm: 'sovereign' as const,
            available: true,
            meanPrecision: aggregate.meanPrecision,
            meanRecall: aggregate.meanRecall,
            meanF1: aggregate.meanF1,
          },
          ...(await runBaselines(cirs)),
        }
      : null;
    return NextResponse.json({
      ok: true,
      experiment: 'EXP-006',
      stage: 'A',
      at: new Date().toISOString(),
      cirs,
      aggregate,
      results,
      graded,
      topology,
      comparison,
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
    experiment: 'EXP-006',
    family: 'Intent → Invariant Projection Fidelity',
    stage: 'A',
    note: 'POST (admin) runs Stage A over CIRS-v0.1: predict → score → classify Invariant Deltas.',
  });
}
