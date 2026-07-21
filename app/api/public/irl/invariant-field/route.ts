/**
 * /api/public/irl/invariant-field — the PUBLIC, read-only Invariant Field
 * Explorer surface for IRL OS (CFS-033 §8A anonymous-read follow-on, built
 * 2026-07-17).
 *
 * WHY A NEW ROUTE, NOT A WEAKENED GATE (CLAUDE.md PARAMOUNT): the internal
 * `/api/research/invariant-field` stays spine-gated and untouched. Both routes
 * now call ONE shared module (`services/research/invariantFieldQuery`) —
 * Extend-Don't-Duplicate — so they can never drift. This is a NEW public
 * surface over data that is the published constitutional canon (the same
 * invariant statements + enables/constrains/contradicts field already readable
 * in IRL OS's markdown corpus); no access gate is removed or weakened.
 *
 * SAFETY:
 * - READ-ONLY. Both GET (neighbourhood/overview) and POST (counterfactual
 *   what-if projection) compute in memory and write NOTHING — no insert,
 *   update, delete, or upsert anywhere in the shared module.
 * - No persona resolution, no credentials. The shared module never emits a
 *   personaId (T2-safe by construction).
 * - No LLM / provider calls — the forecaster + counterfactual are pure graph
 *   traversal + arithmetic, so there is no credit-spend abuse vector.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  queryInvariantField,
  projectInvariantFieldCounterfactual,
} from '@/services/research/invariantFieldQuery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await queryInvariantField({
    id: params.get('id'),
    seedId: params.get('seedId'),
    namespace: params.get('namespace'),
  });
  return NextResponse.json({ ...result.body, public: true }, { status: result.status });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const result = await projectInvariantFieldCounterfactual(body);
  return NextResponse.json({ ...result.body, public: true }, { status: result.status });
}
