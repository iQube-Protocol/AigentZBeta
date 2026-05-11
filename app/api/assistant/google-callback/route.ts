/**
 * GET /api/assistant/google-callback?code=&state=
 *
 * Aigent Me Phase 6.b — Google OAuth callback.
 *
 * The state token is signed via the same HMAC key the connect route used,
 * so we recover (personaId, source) without trusting the URL.
 *
 * On success: exchange the code for tokens, persist, emit an
 * `approval_granted` activity receipt (source-connect counts as the
 * first-tier consent), then 302-redirect back to the metaMe runtime.
 *
 * On failure: redirect with ?google_oauth_error=...
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

import {
  exchangeCodeForTokens,
  GOOGLE_SOURCES,
  type GoogleSource,
} from '@/services/google/oauth';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

function getStateSigningKey(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_HMAC_KEY ||
    process.env.PERSONA_SESSION_TOKEN_HMAC_KEY ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

function verifyState(state: string):
  | { ok: true; personaId: string; source: GoogleSource }
  | { ok: false; reason: string } {
  const key = getStateSigningKey();
  if (!key) return { ok: false, reason: 'state-signing-not-configured' };
  const parts = state.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'state-malformed' };
  const [bodyB64, sig] = parts;
  let data: string;
  try {
    data = Buffer.from(bodyB64, 'base64url').toString('utf8');
  } catch {
    return { ok: false, reason: 'state-decode-failed' };
  }
  const expected = crypto
    .createHmac('sha256', key)
    .update(data)
    .digest('hex')
    .slice(0, 32);
  // constant-time compare
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'state-signature-mismatch' };
  }
  try {
    const payload = JSON.parse(data) as { personaId?: string; source?: GoogleSource };
    if (!payload.personaId || !payload.source || !GOOGLE_SOURCES.includes(payload.source)) {
      return { ok: false, reason: 'state-payload-invalid' };
    }
    return { ok: true, personaId: payload.personaId, source: payload.source };
  } catch {
    return { ok: false, reason: 'state-json-invalid' };
  }
}

function returnRedirectUri(reason: string, extra: Record<string, string> = {}): string {
  // Default: land back inside the Aigent Me tab of the metaMe cartridge so
  // the user sees the post-consent state (Connect → Connected) in the
  // GoogleConnectionsPanel without an extra navigation step. Operator can
  // override via GOOGLE_OAUTH_RETURN_URL (e.g. a Lovable preview URL).
  const base =
    process.env.GOOGLE_OAUTH_RETURN_URL ||
    process.env.NEXT_PUBLIC_RUNTIME_URL ||
    '/codex/viewer?id=metame-codex&tab=aigent-me';
  const url = new URL(base, 'https://placeholder.invalid');
  for (const [k, v] of Object.entries({ google_oauth: reason, ...extra })) {
    url.searchParams.set(k, v);
  }
  // Preserve relative if base was relative; encodeURI handles both.
  return base.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(returnRedirectUri('cancelled', { reason: errorParam }), request.url),
      302,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(returnRedirectUri('missing-code-or-state'), request.url),
      302,
    );
  }

  const verified = verifyState(state);
  if (!verified.ok) {
    return NextResponse.redirect(
      new URL(returnRedirectUri('state-invalid', { reason: verified.reason }), request.url),
      302,
    );
  }

  const result = await exchangeCodeForTokens({
    code,
    source: verified.source,
    personaId: verified.personaId,
  });
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(
        returnRedirectUri('exchange-failed', { reason: result.reason.slice(0, 100) }),
        request.url,
      ),
      302,
    );
  }

  await createActivityReceipt({
    personaId: verified.personaId,
    activeCartridge: 'metame',
    actionType: 'approval_granted',
    summary: `Connected Google ${verified.source}`,
    agentsInvoked: ['aigent-me'],
    toolsUsed: [`google.${verified.source}`],
    iqubesUsed: ['PersonaQube'],
    contextShared: ['oauth-consent'],
  }).catch(() => undefined);

  return NextResponse.redirect(
    new URL(returnRedirectUri('connected', { source: verified.source }), request.url),
    302,
  );
}
