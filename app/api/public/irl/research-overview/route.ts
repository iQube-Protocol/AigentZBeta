/**
 * GET /api/public/irl/research-overview — the PUBLIC, read-only IRL object-model
 * overview (registry + derived lifecycle + artifact-production observation) for
 * the IRL OS public Dashboard (CFS-033 §8A, 2026-07-17).
 *
 * A NEW public surface — the internal spine-gated `/api/research/overview` GET
 * is untouched; both call the SAME shared builder
 * (`services/research/publicReads.buildResearchOverview`). No gate is weakened.
 * The projection is T2-safe (no personaId). No writes, no persona, no creds.
 */

import { NextResponse } from 'next/server';
import { buildResearchOverview } from '@/services/research/publicReads';

export const dynamic = 'force-dynamic';

export async function GET() {
  const body = await buildResearchOverview(new Date().toISOString());
  return NextResponse.json({ ...body, public: true });
}
