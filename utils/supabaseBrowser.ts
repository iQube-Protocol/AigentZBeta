'use client';
/**
 * Singleton Supabase browser client.
 * Import getSupabaseBrowserClient() instead of calling createClient() directly
 * in any browser/client component. Multiple createClient() calls in the same
 * browser context trigger "Multiple GoTrueClient instances" warnings and
 * AbortError races caused by concurrent instances sharing the same storage key.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    );
  }
  return _client;
}

/**
 * Read the active Supabase access token for client-side fetches that need to
 * authenticate against `/api/*` routes whose server resolves identity via
 * `getCallerIdentityContext` (Authorization: Bearer …).
 *
 * Returns '' when no session exists. Two-tier resolution:
 *   1. Supabase getSession() — preferred; uses the in-memory client first
 *   2. localStorage fallback — covers the case where the singleton client
 *      hasn't hydrated yet (matches the inline pattern used in
 *      services/access/spineGateClient.ts and DevPersonaTab.tsx)
 */
// getSession() can hang indefinitely: GoTrue serialises token access behind a
// `navigator.locks` lock, and when that lock is held by another tab (or never
// resolves) the awaited getSession() never settles. Symptom: every personaFetch
// caller — including the CDE terminal / GitHub / Linear panes — spins forever
// with no response. Bound it with a hard deadline and fall through to the direct
// localStorage read (which needs no lock and returns the same token).
const GET_SESSION_TIMEOUT_MS = 3000;

export async function getSupabaseAccessToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const session = await Promise.race([
      getSupabaseBrowserClient().auth.getSession().then((r) => r.data?.session ?? null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GET_SESSION_TIMEOUT_MS)),
    ]);
    const token = session?.access_token;
    if (token) return token;
  } catch {
    /* fall through to localStorage scan */
  }
  try {
    const k = Object.keys(window.localStorage).find(
      (x) => x.startsWith('sb-') && x.endsWith('-auth-token'),
    );
    if (!k) return '';
    const raw = window.localStorage.getItem(k);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as
      | { access_token?: string; currentSession?: { access_token?: string } }
      | null;
    return parsed?.access_token ?? parsed?.currentSession?.access_token ?? '';
  } catch {
    return '';
  }
}

/**
 * Convenience: build a `fetch` headers object that carries the active
 * Supabase Bearer token when present. Use for any client→`/api/*` call that
 * needs to surface as the signed-in caller.
 */
export async function authedFetchHeaders(
  base: HeadersInit = {},
): Promise<HeadersInit> {
  const token = await getSupabaseAccessToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}
