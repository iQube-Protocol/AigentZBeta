/**
 * GET /api/public/irl/experiments-results — the PUBLIC, read-only projection of
 * the Foundational Validation Series' published results, for the IRL OS public
 * Dashboard (CFS-033 §8A, 2026-07-17).
 *
 * A NEW public surface — the internal spine-gated `/api/experiments/results`
 * GET is untouched; both call the SAME shared reader
 * (`services/research/publicReads.listPublishedExperimentResults`). No gate is
 * weakened (CLAUDE.md PARAMOUNT). The data is the published constitutional
 * record: hash-committed, DVN-anchored results — T2-safe (no personaId). No
 * writes, no persona, no credentials.
 */

import { NextResponse } from 'next/server';
import { listPublishedExperimentResults } from '@/services/research/publicReads';

export const dynamic = 'force-dynamic';

export async function GET() {
  const outcome = await listPublishedExperimentResults();
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, results: outcome.results, public: true });
}
