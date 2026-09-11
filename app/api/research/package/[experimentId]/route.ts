/**
 * GET /api/research/package/[experimentId] — PRD-EPI-001 §4 Research Package
 * exporter, admin-gated, read-only. Serves BOTH the "publish this" and the
 * reviewer-verification use case (§4) via the SAME buildResearchPackage
 * function — no second exporter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildResearchPackage } from '@/services/research/researchPackage';

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
  const result = await buildResearchPackage(experimentId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json(
    { ok: true, package: result.package },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
