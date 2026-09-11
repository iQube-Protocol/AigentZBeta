/**
 * /api/invariants/measurement — the CFS-008 §2 measurement readout
 * (Chrysalis Foundation, Phase 5).
 *
 * GET — read-only rollup of the compression metrics: per-namespace reuse
 * counts (adoption axis), consequence accuracy (validation axis — reported
 * separately, Law XII), top reused invariants, and the receipt-spine
 * grounded-execution count (null until the invariants_used instrumentation
 * migration is applied — unmeasured is reported honestly, never as zero).
 *
 * Spine-gated (personaFetch required). T1-safe aggregates only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { computeMeasurementRollup } from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    const rollup = await computeMeasurementRollup();
    return NextResponse.json({ ok: true, rollup });
  } catch (error) {
    console.error('[api/invariants/measurement] rollup failed', error);
    return NextResponse.json({ error: 'rollup_failed' }, { status: 500 });
  }
}
