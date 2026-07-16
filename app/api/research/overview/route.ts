/**
 * GET /api/research/overview — the IRL object model, live (CFS-019 §4).
 *
 * Registry (experiments + series) with lifecycle DERIVED from the canonical
 * record (experiment_results) — published/replicated are computed facts.
 * Persona-gated (T2-safe content only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildResearchOverview } from '@/services/research/publicReads';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  // Read/projection logic lives in the shared, persona-free module (the public
  // IRL OS route /api/public/irl/research-overview calls the SAME builder).
  return NextResponse.json(await buildResearchOverview(new Date().toISOString()));
}
