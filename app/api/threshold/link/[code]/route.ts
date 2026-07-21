/**
 * GET /api/threshold/link/:code — the signed metame-threshold-link/v1 manifest
 * (PRD-THR-001 §7). The machine twin of the human "Cross the Threshold" page:
 * the Companion fetches this to learn where the gateway is and what crossing is
 * being offered. Capability-URL trust model (the code is unguessable + privately
 * delivered); the manifest carries no persona/T0 identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';
import { resolveInvitation } from '@/services/threshold/resolveInvitation';
import { buildThresholdLink } from '@/services/threshold/thresholdLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!code) return cors(NextResponse.json({ ok: false, error: 'code is required' }, { status: 400 }));

  const info = await resolveInvitation(code);
  if (!info) return cors(NextResponse.json({ ok: false, error: 'Threshold Link not found' }, { status: 404 }));

  const origin = publicOrigin(req);
  const manifest = buildThresholdLink({
    invitationId: info.invitationId,
    initiatingService: info.initiatingService,
    institution: info.institution,
    requestedRole: info.requestedRole,
    requestedCapabilities: info.requestedCapabilities,
    gatewayUrl: `${origin}/api/threshold/mcp`,
    expiresAt: info.expiresAt ?? null,
  });

  return cors(NextResponse.json(manifest));
}
