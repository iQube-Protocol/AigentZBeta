/**
 * POST /api/assistant/connect-google
 *
 * Aigent Me Phase 6.b — initiate per-source Google Workspace consent.
 *
 * Body: { source: 'gmail' | 'calendar' | 'drive' | 'docs' | 'slides' }
 *
 * Returns: { consentUrl } — the client redirects the user to this URL.
 * Google then redirects back to GOOGLE_OAUTH_REDIRECT_URI (the
 * `google-callback` route) carrying ?code=… and ?state=….
 *
 * Privacy: personaId from spine; never read from body. The state token
 * encodes (personaId, source, nonce) signed via the existing
 * persona-session-token HMAC key so it can't be forged client-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  buildConsentUrl,
  GOOGLE_SOURCES,
  type GoogleSource,
} from '@/services/google/oauth';

export const dynamic = 'force-dynamic';

interface PostBody {
  source?: GoogleSource;
}

function getStateSigningKey(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_HMAC_KEY ||
    process.env.PERSONA_SESSION_TOKEN_HMAC_KEY ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

export function signOAuthState(payload: {
  personaId: string;
  source: GoogleSource;
  nonce: string;
}): string {
  const key = getStateSigningKey();
  const data = JSON.stringify(payload);
  const sig = crypto
    .createHmac('sha256', key)
    .update(data)
    .digest('hex')
    .slice(0, 32);
  const body = Buffer.from(data, 'utf8').toString('base64url');
  return `${body}.${sig}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  let raw: unknown;
  try { raw = await request.json(); } catch { raw = {}; }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.source || !GOOGLE_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { error: 'invalid-source', detail: `source must be one of: ${GOOGLE_SOURCES.join(', ')}` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!getStateSigningKey()) {
    return NextResponse.json(
      {
        error: 'state-signing-not-configured',
        detail:
          'Set GOOGLE_OAUTH_STATE_HMAC_KEY (or NEXTAUTH_SECRET) in the Amplify env. ' +
          'Operator action — see Phase 6.b backlog doc.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const state = signOAuthState({
    personaId: context.personaId,
    source: body.source,
    nonce: crypto.randomBytes(8).toString('hex'),
  });

  const result = buildConsentUrl({
    source: body.source,
    personaId: context.personaId,
    state,
  });

  if ('url' in result) {
    return NextResponse.json(
      { consentUrl: result.url, source: body.source },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // OAuth not configured.
  return NextResponse.json(
    { error: 'oauth-not-configured', detail: result.reason, missing: result.missing },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
