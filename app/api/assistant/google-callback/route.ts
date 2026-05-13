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
import { isMetameOriginAllowed } from '@/utils/metameOriginAllowlist';

export const dynamic = 'force-dynamic';

function getStateSigningKey(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_HMAC_KEY ||
    process.env.PERSONA_SESSION_TOKEN_HMAC_KEY ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

/**
 * Re-validate a returnUrl extracted from a signed state token against the
 * metame embed allowlist. Defense in depth — even though the state is
 * HMAC-signed and a valid signature implies we wrote the value at consent
 * initiation, we never trust the payload contents to dictate a redirect
 * without re-checking the origin allowlist at use time. The allowlist may
 * have tightened since the token was issued.
 */
function verifyReturnUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  if (!/^https?:\/\//.test(value)) return undefined;
  try {
    const parsed = new URL(value);
    const origin = `${parsed.protocol}//${parsed.host}`;
    if (isMetameOriginAllowed(origin)) return value;
  } catch {
    // fall through
  }
  return undefined;
}

function verifyState(state: string):
  | { ok: true; personaId: string; source: GoogleSource; returnUrl?: string }
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
    const payload = JSON.parse(data) as { personaId?: string; source?: GoogleSource; returnUrl?: string };
    if (!payload.personaId || !payload.source || !GOOGLE_SOURCES.includes(payload.source)) {
      return { ok: false, reason: 'state-payload-invalid' };
    }
    const verifiedReturnUrl = verifyReturnUrl(payload.returnUrl);
    return {
      ok: true,
      personaId: payload.personaId,
      source: payload.source,
      ...(verifiedReturnUrl ? { returnUrl: verifiedReturnUrl } : {}),
    };
  } catch {
    return { ok: false, reason: 'state-json-invalid' };
  }
}

/**
 * Resolve the public origin of the current request, honouring Amplify's
 * x-forwarded-* headers so the Lambda doesn't return localhost or the
 * internal proxy host. Falls through to request.nextUrl.origin (which is
 * usually correct for Next.js App Router routes).
 */
function resolveRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host') || '';
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && !/^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)(:|$)/.test(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const hostHeader = request.headers.get('host') || '';
  if (hostHeader && !/^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)(:|$)/.test(hostHeader)) {
    return `https://${hostHeader}`;
  }
  try {
    return request.nextUrl.origin;
  } catch {
    return '';
  }
}

/**
 * Treat localhost / 127.0.0.1 / 0.0.0.0 / .local URLs as ignorable when
 * running in production. Otherwise a stale dev-time env var (e.g.
 * GOOGLE_OAUTH_RETURN_URL=http://localhost:3000/...) leaks into the
 * production redirect and the user lands on an unreachable URL.
 */
function isLocalhostUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(value);
}

function returnRedirectUri(
  request: NextRequest,
  reason: string,
  extra: Record<string, string> = {},
  stateReturnUrl?: string,
): string {
  // Default: land back inside the Aigent Me tab of the metaMe cartridge so
  // the user sees the post-consent state (Connect → Connected) in the
  // GoogleConnectionsPanel without an extra navigation step. Operator can
  // override via GOOGLE_OAUTH_RETURN_URL (e.g. a Lovable preview URL).
  //
  // Localhost values in env vars are ignored — they're almost always a
  // dev-time misconfiguration that leaked into production. The forwarded
  // request origin is the safer fallback.
  const envReturn = process.env.GOOGLE_OAUTH_RETURN_URL;
  const envRuntime = process.env.NEXT_PUBLIC_RUNTIME_URL;
  const usableEnv =
    (envReturn && !isLocalhostUrl(envReturn) ? envReturn : null) ??
    (envRuntime && !isLocalhostUrl(envRuntime) ? envRuntime : null);

  const requestOrigin = resolveRequestOrigin(request);

  // Compute base URL absolutely. Three sources, in order:
  //   1. usable env (already absolute)
  //   2. relative default path resolved against the request origin
  //   3. last-resort relative path (lets the caller's `new URL(base, request.url)` resolve it)
  let baseAbsolute: string;
  if (stateReturnUrl) {
    // Highest priority: the caller-supplied return URL captured (and
    // allowlist-validated) at consent-initiation time. Lets users who
    // started OAuth from metame.live / metame.dev / runtime.metame.com
    // land back on the same thin client they started from.
    baseAbsolute = stateReturnUrl;
  } else if (usableEnv) {
    baseAbsolute = usableEnv;
  } else if (requestOrigin) {
    baseAbsolute = `${requestOrigin}/codex/viewer?id=metame-codex&tab=aigent-me`;
  } else {
    baseAbsolute = '/codex/viewer?id=metame-codex&tab=aigent-me';
  }

  // Append the OAuth diagnostic params.
  const url = new URL(baseAbsolute, requestOrigin || 'https://placeholder.invalid');
  for (const [k, v] of Object.entries({ google_oauth: reason, ...extra })) {
    url.searchParams.set(k, v);
  }
  // If we couldn't resolve an origin at all, return a relative path so the
  // route's `new URL(..., request.url)` resolves it against the request.
  if (!requestOrigin && !usableEnv) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(returnRedirectUri(request, 'cancelled', { reason: errorParam }), request.url),
      302,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(returnRedirectUri(request, 'missing-code-or-state'), request.url),
      302,
    );
  }

  const verified = verifyState(state);
  if (!verified.ok) {
    return NextResponse.redirect(
      new URL(returnRedirectUri(request, 'state-invalid', { reason: verified.reason }), request.url),
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
        returnRedirectUri(
          request,
          'exchange-failed',
          { reason: result.reason.slice(0, 100) },
          verified.returnUrl,
        ),
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
    new URL(
      returnRedirectUri(
        request,
        'connected',
        { source: verified.source },
        verified.returnUrl,
      ),
      request.url,
    ),
    302,
  );
}
