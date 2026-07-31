/**
 * GET /api/access-gateway/session — resolve a presented human bearer to its
 * SessionQube (PRD-PAG-001 §4, Phase 1). The payload is the T1/T2-only
 * projection built by projectSessionQube: pairwise `sub`, claim-gated
 * personaPublicRef / displayLabel / cartridgeFlags / passportStatus, granted
 * claims, consentRef, expiry. NEVER personaId / authProfileId / rootDid /
 * kybeAttestation / any fioHandle (five-forbidden-fields law, §5).
 *
 * cartridgeFlags on the session are OPTIMISTIC UI ONLY — every server-side
 * gate still re-resolves through the spine (evaluateAccess / getActivePersona);
 * this endpoint introduces no parallel authorization resolver (§6.2).
 *
 * Fail-closed: unknown/expired/revoked/agent-kind bearers → 401.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveHumanBearer } from '@/services/accessGateway/humanSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer) {
    return cors(NextResponse.json({ error: 'invalid_token', error_description: 'Authorization: Bearer required' }, { status: 401 }));
  }
  const session = await resolveHumanBearer(bearer);
  if (!session) {
    return cors(NextResponse.json({ error: 'invalid_token' }, { status: 401 }));
  }
  return cors(NextResponse.json({ ok: true, session }));
}
