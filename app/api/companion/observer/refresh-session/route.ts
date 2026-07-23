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

export const dynamic = 'force-dynamic';

function noStore(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
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
    return noStore({ error: 'refresh-failed', detail: error?.message ?? 'no-session-returned' }, 401);
  }

  const { access_token: accessToken, refresh_token: nextRefreshToken, expires_at: expiresAt } = data.session;
  return noStore({ accessToken, refreshToken: nextRefreshToken, expiresAt: expiresAt ?? null }, 200);
}
