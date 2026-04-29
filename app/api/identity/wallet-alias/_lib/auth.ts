/**
 * Resolve the Supabase auth.users.id from an inbound NextRequest.
 *
 * root_identity.auth_user_id is the canonical owner key — that is the
 * Supabase auth.users.id, NOT the crm_auth_profiles.id. The cross-pack
 * helper getCallerIdentityContext maps to crm_auth_profiles which is the
 * wrong identifier for this RLS path.
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    try {
      const sb = createClient(url, anon);
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data?.user?.id) return data.user.id;
    } catch {
      // fall through to JWT decode
    }
  }
  const payload = tryDecodeJwt(token);
  return typeof payload?.sub === 'string' ? (payload.sub as string) : null;
}
