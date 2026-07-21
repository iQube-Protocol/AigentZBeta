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
  // Stage-0 instrument validation record runs (2026-07-18) — ratified in the
  // IRV/IPV READMEs + STAGE-0_HANDOFF.md. The raw result JSONs were not
  // committed to the repo; what the repo attests (and what we publish) is the
  // RECORDED SUMMARY, carrying the original full-record sha256s inside for
  // provenance. Honest framing per the ratified record: stability is the gate;
  // coverage is a model-sensitive SEB proxy reported with its exact config,
  // never a pass/fail score.
  {
    experiment: 'IRV-001',
    provider: 'openai',
    model: 'persona gpt-4o-mini · judge gpt-4o',
    aggregates: {
      run: 'stage-0-record',
      date: '2026-07-18',
      intents: 10,
      reps: 3,
      band: 'anchored',
      stability: 1.0,
      compression: 0.65,
      coverageMean: 0.21,
      coverageDensest: 0.57,
      novelty: 0.75,
      note: 'Stability is the gate; coverage is a model-sensitive SEB proxy (swung 0.13→0.57 on byte-identical engine output across judge configs) reported with its exact config, never pass/fail. Instrument validated for EXP-P1.',
    },
    results: {
      experiment: 'IRV-001',
      kind: 'instrument-validation-record-summary',
      date: '2026-07-18',
      framing:
        'Synthetic Expert Baseline (SEB) engineering calibration — Track-B discovery calibration, never Track-A structural evidence. Personas are correlated models, not independent experts.',
      config: { band: 'anchored', intents: 10, reps: 3, personaModel: 'gpt-4o-mini', judgeModel: 'gpt-4o' },
      summary: { stability: 1.0, compression: 0.65, coverageMean: 0.21, coverageDensest: 0.57, novelty: 0.75 },
      findings: [
        'Discovery-node pollution found and fixed (unscoped-fallback) — the one pathology.',
        'Test banded to the corpus: anchored (corpus-dense) vs breadth; coverage tracks corpus density.',
        'Judge/persona/consensus un-confounded: --judge-model moves only the overlap scorer; SEB baseline stays on the persona model.',
      ],
      verdict:
        'Instrument validated for EXP-P1 on stability + no-pathology + qualitative on-domain relevance (coverage a reported proxy, not the gate).',
      fullRecordSha256: '258b64fda9aa9686',
      provenance:
        'Recorded summary of the 2026-07-18 record run (irv-001 README ratification record + STAGE-0_HANDOFF.md). Raw results JSON retained off-repo; its sha256 above is the original content commitment.',
    },
    skipIfExists: true,
  },
  {
    experiment: 'IPV-001',
    provider: 'openai',
    model: 'deterministic (IRE/IPE frozen substrate)',
    aggregates: {
      run: 'stage-0-record',
      date: '2026-07-18',
      intents: 10,
      reps: 5,
      band: 'anchored',
      standingReproducibleRate: 1.0,
      coordinateReproducibleRate: 1.0,
      seedSetStability: 1.0,
      note: '100% reproducible — zero nondeterminism. Reproducibility is necessary, not sufficient (projection semantics are EXP-P2 B4). IPE validated for EXP-P1.',
    },
    results: {
      experiment: 'IPV-001',
      kind: 'instrument-validation-record-summary',
      date: '2026-07-18',
      framing:
        'IPE reproducibility validation on the frozen substrate — confirms the by-construction determinism holds live (no caching/ordering/race nondeterminism).',
      config: { band: 'anchored', intents: 10, reps: 5, route: 'POST /api/public/irl/resolve' },
      summary: { standingReproducibleRate: 1.0, coordinateReproducibleRate: 1.0, seedSetStability: 1.0 },
      verdict: 'IPE validated for EXP-P1 — 100% reproducible, zero nondeterminism observed.',
      fullRecordSha256: '8f86238069142fcf',
      provenance:
        'Recorded summary of the 2026-07-18 record run (ipv-001 README ratification record). Raw results JSON retained off-repo; its sha256 above is the original content commitment.',
    },
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
