/**
 * GET /api/research/overview — the CCRL object model, live (CFS-019 §4).
 *
 * Registry (experiments + series) with lifecycle DERIVED from the canonical
 * record (experiment_results) — published/replicated are computed facts.
 * Persona-gated (T2-safe content only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { deriveOverview } from '@/services/research/lifecycle';
import { SERIES_REGISTRY, EXPERIMENT_LIFECYCLE } from '@/types/research';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const overview = await deriveOverview();
  return NextResponse.json({
    ok: true,
    lifecycleOrder: EXPERIMENT_LIFECYCLE,
    series: SERIES_REGISTRY,
    experiments: overview,
    computedAt: new Date().toISOString(),
  });
}
