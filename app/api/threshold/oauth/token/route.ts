/**
 * POST /api/threshold/oauth/token — OAuth 2.1 token endpoint (authorization-code
 * + PKCE) for the metaMe Threshold Constitutional Handshake (PRD-THR-001 §6).
 *
 * The Threshold Companion exchanges the one-time authorization code (returned to
 * its redirect_uri after the HUMAN crossed) plus its PKCE code_verifier for a
 * scoped bearer. The bearer is bound to the authorized Constitutional Agreement
 * and carries only the scope the human authorized. No T0 identifiers.
 *
 * Security: the code is useless without the matching PKCE verifier; the code is
 * single-use (burned on exchange, guarded against replay); the redirect_uri must
 * match the one bound at /authorize. Inert until the migration is applied.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeAuthorizationCode } from '@/services/threshold/gatewaySession';

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

/** Accepts application/x-www-form-urlencoded (OAuth default) or JSON. Parses the
 *  urlencoded body from the raw text with URLSearchParams rather than
 *  request.formData() — the latter is unreliable for urlencoded bodies in this
 *  runtime and can silently return nothing, which would 400 every token call. */
async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const ctype = req.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? '')]));
  }
  const raw = await req.text().catch(() => '');
  const sp = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export async function POST(req: NextRequest) {
  const p = await readParams(req);

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
      scope: result.scope.join(' '),
    }),
  );
}
