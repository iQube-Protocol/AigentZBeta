/**
 * GET /api/research/readiness/[experimentId] — PRD-EPI-001 §10 Readiness
 * Dashboard backing data, admin-gated, read-only. Returns the seven sections
 * with red/amber/green status + the protocol-ratified projection. The IRL OS
 * Laboratory dashboard renders this; a reviewer can also hit it directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildReadinessDashboard } from '@/services/research/readinessDashboard';

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
  const dashboard = await buildReadinessDashboard(experimentId);
  return NextResponse.json(
    { ok: true, dashboard },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
