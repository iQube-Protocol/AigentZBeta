/**
 * POST /api/companion/observer/refresh-session
 *
 * PRD-MMC-IMPL-001 §7 Increment 6 follow-up — token refresh/expiry for the
 * Companion browser extension's "Connect to metaMe" flow. This was
 * explicitly flagged as NOT SOLVED in `extension/companion-observer/background.js`'s
 * own header comment; this route is the fix.
 *
 * Body: `{ refreshToken: string }`.
 * Response: `{ accessToken, refreshToken, expiresAt }` (`expiresAt` is a
 * Unix-seconds timestamp, matching Supabase's own `session.expires_at`
 * shape) or `{ error }`.
 *
 * Deliberately does NOT gate on `getActivePersona(request)` the way
 * `grants/route.ts` does — the whole point of this call is to obtain a new
 * access_token when the caller's current one may already be expired, so
 * there is no valid session to resolve a persona from yet. The
 * `refreshToken` itself is the credential; Supabase's GoTrue validates it
 * (rejects with an error if it's invalid, already used, or revoked).
 *
 * Keeps the Supabase project URL/anon key entirely server-side. The
 * extension never receives or embeds them — it only ever holds an
 * access_token + refresh_token pair, mirroring exactly what it already
 * extracts from the metaMe web app's own `localStorage` session blob.
 *
 * Uses a fresh, request-scoped Supabase client (NOT `getSupabaseServer()`'s
 * cached singleton) — `auth.refreshSession` mutates the client's internal
 * session state, and the singleton is shared across concurrent requests.
 * A dedicated client avoids cross-request session contamination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthRetryableFetchError } from '@supabase/auth-js';

export const dynamic = 'force-dynamic';

function noStore(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * TERMINAL vs TRANSIENT — this route's status IS the extension's decision.
 *
 * `extension/companion-observer/background.js` treats 400/401 from here as
 * proof that the refresh token will never work again and DELETES the cached
 * session (`TERMINAL_REFRESH_STATUSES` / `clearAuthSession`, 2026-07-27). Its
 * own comment states the contract it relies on: "Anything else (500, 502, a
 * timeout) is treated as transient and the cached session is KEPT, because
 * throwing away a good credential because the server hiccuped would log the
 * citizen out for a reason that has nothing to do with their session."
 *
 * THAT CONTRACT WAS NOT HONOURED. This route returned a flat 401 for EVERY
 * failure of `refreshSession` — including a GoTrue rate limit, a 5xx, and a
 * network error, all of which arrive as a populated `error` exactly like a
 * genuinely rejected token does. So a single upstream blip logged the citizen
 * out of the extension: the Observer stopped writing and every "Pull Across"
 * capture died at `ensureFreshToken()` with `no-auth-session`, silently, until
 * the operator noticed and re-paired by hand.
 *
 * The extension is right and this route was wrong — terminality is a fact
 * about the upstream response, and only this side can see it. So classify
 * here, once:
 *   - retryable fetch error (auth-js's own predicate)  → transient
 *   - upstream 429 (rate limited — "try again later")   → transient
 *   - other upstream 4xx (GoTrue rejected the token)    → terminal
 *   - upstream 5xx, or no status at all                 → transient
 *   - no error but no session                           → transient
 *
 * Transient answers 502 — outside the extension's terminal set, so the cached
 * credential survives a hiccup. A genuinely dead token still answers 401 and is
 * still cleared, so the "looping forever on a dead credential" defect that
 * introduced `clearAuthSession` stays fixed.
 */
function refreshFailureStatus(error: { status?: number } | null): 401 | 502 {
  if (!error) return 502; // no error, no session — unexplained, so not terminal
  if (isAuthRetryableFetchError(error)) return 502;
  const upstream = typeof error.status === 'number' ? error.status : null;
  if (upstream === null) return 502; // AuthError.status is optional (network-layer failure)
  // 429 is a 4xx but it says "try again later", not "this token is dead" —
  // clearing a good credential because GoTrue rate-limited us is precisely the
  // failure this classifier exists to prevent.
  if (upstream === 429) return 502;
  return upstream >= 400 && upstream < 500 ? 401 : 502;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: 'invalid-json-body' }, 400);
  }

  const { refreshToken } = (body ?? {}) as { refreshToken?: unknown };
  if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
    return noStore({ error: 'refresh-token-required' }, 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return noStore({ error: 'supabase-configuration-missing' }, 500);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) {
    return noStore(
      { error: 'refresh-failed', detail: error?.message ?? 'no-session-returned' },
      refreshFailureStatus(error),
    );
  }

  const { access_token: accessToken, refresh_token: nextRefreshToken, expires_at: expiresAt } = data.session;
  return noStore({ accessToken, refreshToken: nextRefreshToken, expiresAt: expiresAt ?? null }, 200);
}
