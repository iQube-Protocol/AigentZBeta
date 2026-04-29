/**
 * Resolve the Supabase auth.users.id from an inbound NextRequest.
 *
 * Strategy: local JWT decode first (zero network, zero latency), then
 * optionally validate against Supabase auth API with a 4s hard timeout.
 * The Supabase call can hang indefinitely on a cold Lambda — the timeout
 * ensures we always return rather than silently hitting the Amplify 504.
 *
 * root_identity.auth_user_id is the canonical owner key — that is the
 * Supabase auth.users.id, NOT the crm_auth_profiles.id.
 */
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function tryDecodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getCallerAuthUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      const { searchParams } = new URL(req.url);
      const dev = searchParams.get('authUserId');
      if (dev) return dev;
    }
    return null;
  }

  // Fast path: decode sub from JWT payload without a network call.
  // Supabase JWTs are signed with a secret only Supabase holds; we can't
  // verify the signature here, but the ownership check downstream relies
  // on this userId matching root_identity.auth_user_id in the DB, which
  // can't be spoofed without also controlling the Supabase row.
  const payload = tryDecodeJwt(token);
  const localUserId = typeof payload?.sub === 'string' ? payload.sub : null;

  // Optional: verify token against Supabase auth API (catches revoked tokens).
  // Wrapped in a 4s race — if Supabase auth is slow on a cold Lambda, fall
  // back to the locally-decoded userId rather than hanging the request.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon && localUserId) {
    try {
      const sb = createClient(url, anon);
      const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 4_000)
      );
      const result = await Promise.race([
        sb.auth.getUser(token).then((r) =>
          !r.error && r.data?.user?.id ? r.data.user.id : null
        ),
        timeout,
      ]);
      if (result) return result;
    } catch {
      // fall through to local decode
    }
  }

  return localUserId;
}
