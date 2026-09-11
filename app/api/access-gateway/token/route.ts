/**
 * POST /api/access-gateway/token — token endpoint for the HUMAN channel
 * (PRD-PAG-001 §2.1 Phase 1). Authorization-code + PKCE, REUSING the shared
 * substrate's exchangeAuthorizationCode VERBATIM — same single-use code burn,
 * same PKCE S256 constant-time verify, same redirect_uri pinning, same
 * hashed-bearer discipline. The only human-channel difference is the TTL:
 * human web sessions are SHORT-LIVED (hours), not the agent substrate's
 * 30-day companion bearers.
 *
 * Note: the exchange operates on the shared table and is row-shape-agnostic —
 * a code is only ever exchangeable against the exact handshake row (client +
 * redirect + PKCE) that minted it, so kind confusion is not reachable here;
 * kind is enforced at RESOLUTION (resolveHumanBearer refuses agent rows).
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeAuthorizationCode } from '@/services/threshold/gatewaySession';
import { HUMAN_SESSION_TTL_HOURS } from '@/services/accessGateway/humanSession';
import { parseOAuthBody } from '@/services/threshold/oauthBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const ctype = req.headers.get('content-type') ?? '';
  const raw = await req.text().catch(() => '');
  const p = parseOAuthBody(ctype, raw);

  if (p.grant_type !== 'authorization_code') {
    return cors(NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 }));
  }
  if (!p.code || !p.code_verifier || !p.redirect_uri) {
    return cors(NextResponse.json({ error: 'invalid_request' }, { status: 400 }));
  }

  const result = await exchangeAuthorizationCode({
    code: p.code,
    codeVerifier: p.code_verifier,
    redirectUri: p.redirect_uri,
    sessionTtlDays: HUMAN_SESSION_TTL_HOURS / 24, // short-lived human session
  });

  if ('error' in result) {
    const status = result.error === 'server_error' ? 503 : 400;
    return cors(NextResponse.json({ error: result.error }, { status }));
  }

  const expiresIn = Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
  return cors(
    NextResponse.json({
      access_token: result.bearer,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: result.scope.join(' '), // = the granted claims
    }),
  );
}
