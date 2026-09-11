/**
 * POST /api/access-gateway/revoke — revoke a human gateway session by its
 * bearer (PRD-PAG-001 §2.1 Phase 1; /logout aliases this route). Revocation is
 * the substrate's status flip — the hashed-bearer row goes 'revoked' and never
 * resolves again. RFC 7009 posture: always 200 with { ok } so a caller cannot
 * probe token validity through this endpoint; `revoked` reports whether an
 * active human session was actually found (fine for the first-party client).
 *
 * Accepts the token in the POST body (`token`, form or JSON — OAuth revocation
 * shape) or the Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeHumanBearer } from '@/services/accessGateway/humanSession';
import { parseOAuthBody } from '@/services/threshold/oauthBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const headerBearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const ctype = req.headers.get('content-type') ?? '';
  const raw = await req.text().catch(() => '');
  const p = parseOAuthBody(ctype, raw);
  const token = p.token || headerBearer;

  const revoked = await revokeHumanBearer(token);
  return cors(NextResponse.json({ ok: true, revoked }));
}
