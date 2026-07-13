/**
 * POST /api/experiments/results/backfill — publish the repo-bundled historical
 * run records into the canonical Results system (admin-gated).
 *
 * The Results tab was built AFTER the first runs completed, so run-1 of
 * EXP-001/EXP-003 (2026-07-04) and EXP-002's run-2 record (2026-07-05) exist
 * only as files in the repo. This route publishes them through the identical
 * pipeline live runs use (exact-string serialization → sha256 commitment →
 * DVN-anchorable receipt), idempotently: a record whose content hash is
 * already published is skipped, so the route is safe to call repeatedly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { publishExperimentResult, type PublishResultInput } from '@/services/experiments/publishResult';
import exp001Run1 from '@/codexes/packs/irl/foundation/experiments/exp-001-living-knowledgeqube/evaluation-results-2026-07-04.json';
import exp003Run1 from '@/codexes/packs/irl/foundation/experiments/exp-003-rediscovery-savings/results-2026-07-04.json';
import exp002Run2 from '@/codexes/packs/irl/foundation/experiments/exp-002-invariant-video/run2-results-2026-07-05.json';

export const dynamic = 'force-dynamic';

const HISTORICAL: PublishResultInput[] = [
  {
    experiment: 'EXP-001',
    provider: 'venice',
    model: 'llama-3.3-70b',
    aggregates: {
      run: 1,
      date: '2026-07-04',
      consistency: 1.83,
      explainability: 1.95,
      hallucinations: 0,
      coherence: 2.0,
      restraint: '15/15',
      note: 'aggregates = human-adjudicated scores; raw JSON = machine-judge output (2 flags dissolved/rescored on adjudication)',
    },
    results: exp001Run1,
    skipIfExists: true,
  },
  {
    experiment: 'EXP-003',
    provider: 'venice',
    model: 'llama-3.3-70b',
    aggregates: {
      run: 1,
      date: '2026-07-04',
      tokenSavingsPct: 26.7,
      groundedPct: 100,
      note: 'Law XII failure-mode rediscovered cold, eliminated initialized',
    },
    results: exp003Run1,
    skipIfExists: true,
  },
  {
    experiment: 'EXP-002',
    provider: 'openai',
    model: 'sora-2',
    aggregates: {
      run: 2,
      date: '2026-07-05',
      segments: 4,
      totalSeconds: 48,
      continuity: 'confirmed (operator first-viewing + frame review)',
      controlArm: 'reversed order — graded degradation, dissociation confirmed',
    },
    results: exp002Run2,
    skipIfExists: true,
  },
];

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });

  const outcomes = [];
  for (const record of HISTORICAL) {
    const outcome = await publishExperimentResult(client, persona.personaId, record);
    outcomes.push({
      experiment: record.experiment,
      published: outcome.ok && !outcome.skipped,
      skipped: outcome.skipped ?? false,
      contentHash: outcome.contentHash ?? null,
      error: outcome.error ?? null,
    });
    if (!outcome.ok) {
      // Table-missing etc. affects every record — surface immediately.
      return NextResponse.json({ ok: false, outcomes, error: outcome.error }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, outcomes });
}
