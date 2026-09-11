/**
 * GET /api/memory/trajectories — owner self-view over the CFS-045-A2
 * reasoning-trajectory memory: recent trajectories + the recurrence summary
 * (which activation sequences recur, and how often they produce something).
 * The observational seed of the reasoning-dynamics research surface —
 * EXP-013 studies this properly.
 *
 * Spine-authenticated; trajectories are the caller's own. No persona
 * identifier of any tier is serialised (seed ids + memory-row ids + digests
 * only). Client calls MUST use personaFetch (spine Bearer rule).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listTrajectories, trajectoryRecurrence } from '@/services/memory/memoryCompilation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const [items, recurrence] = await Promise.all([
      listTrajectories(persona.personaId, 50),
      trajectoryRecurrence(persona.personaId, 5),
    ]);
    return NextResponse.json(
      {
        ok: true,
        items: items.map((t) => ({
          id: t.id,
          cartridgeId: t.cartridgeId,
          intentDigest: t.intentDigest,
          activatedSeedIds: t.activatedSeedIds,
          memoryIdsCited: t.memoryIdsCited,
          discardedSeedIds: t.discardedSeedIds,
          outcome: t.outcome,
          producedInvariantId: t.producedInvariantId,
          sessionMarker: t.sessionMarker,
          createdAt: t.createdAt,
        })),
        recurrence,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Pre-migration (table absent) → clean empty state.
    return NextResponse.json({ ok: true, items: [], recurrence: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
