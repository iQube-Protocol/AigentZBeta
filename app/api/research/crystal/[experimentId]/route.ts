/**
 * GET /api/research/crystal/[experimentId] — Crystal Readiness Report +
 * Crystal Statistics Report + Freeze Recommendation for one crystal domain
 * (CFS-054 / PRD-EPI-001 §3.1 Workstreams 2–4). Admin-gated, read-only.
 *
 * Mirrors app/api/research/readiness/[experimentId]/route.ts's auth pattern
 * exactly. This route NEVER writes anything and NEVER freezes anything — it
 * is three read-only reports composed into one payload so the front end can
 * render all three sections from a single fetch (the "run the checks"
 * refresh action the review-tab surface exposes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { runCrystalFreezeRecommendation } from '@/services/research/crystalFreezeRecommendation';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  const crystalDomain = req.nextUrl.searchParams.get('domain') ?? undefined;

  const recommendation = await runCrystalFreezeRecommendation({ experimentId, crystalDomain });

  return NextResponse.json(
    {
      ok: true,
      experimentId,
      crystalDomain: recommendation.crystalDomain,
      readiness: recommendation.readiness,
      statistics: recommendation.statistics,
      recommendation,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
