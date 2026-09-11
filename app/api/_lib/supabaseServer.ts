import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only client factory. Do NOT import this in client components.
let cachedClient: SupabaseClient | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Exported (2026-08-11, targeted correction pass) so every Supabase client
 * factory in this codebase can share ONE time-boxed fetch, not just this
 * one. `services/wallet/personaRepo.ts`'s `getSupabaseAdminClient()`/
 * `getSupabaseAnonClient()` previously built PLAIN `createClient(url, key)`
 * calls with no `global.fetch` override at all — so a hung Supabase Auth
 * `getUser()` call (or any other slow request through those clients) had
 * nothing to abort it, and the platform's own request ceiling (Lambda/API
 * Gateway, ~30s) surfaced as a 504 instead of a clean, fast app error. This
 * was traced as the actual cause of "Could not load persona context:
 * active-persona failed (504)" on the embedded aigentMe surface — not a
 * sandbox/fake-persona artifact (a nonexistent persona ID is discarded
 * cheaply and cleanly by `getCallerIdentityContext`; only a genuinely slow
 * network call produces a 504). Root-caused via a dedicated investigation,
 * not guessed.
 */
export function getTimedFetch(timeoutMs: number): typeof fetch {
  return async (input, init = {}) => {
    const hasAbortTimeout = typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function';
    const signal = init.signal ?? (hasAbortTimeout ? (AbortSignal as any).timeout(timeoutMs) : undefined);
    return fetch(input, { ...init, signal });
  };
}

/** Same env-driven timeout resolution `getSupabaseServer()` already used
 *  privately — exported so other client factories resolve the SAME
 *  timeout value rather than hand-rolling their own default. */
export function resolveSupabaseFetchTimeoutMs(): number {
  return parsePositiveInt(
    process.env.SUPABASE_FETCH_TIMEOUT_MS,
    process.env.NODE_ENV === 'development' ? 4000 : 8000,
  );
}

export function getSupabaseServer(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
      return null;
    }

    const timeoutMs = resolveSupabaseFetchTimeoutMs();

    const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'SERVICE_ROLE_KEY'
      : process.env.SUPABASE_ANON_KEY
      ? 'SUPABASE_ANON_KEY'
      : 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
    console.log(`[Supabase] Initialising client — key type: ${keyType}, timeout: ${timeoutMs}ms`);

    cachedClient = createClient(supabaseUrl, supabaseKey, {
      global: { fetch: getTimedFetch(timeoutMs) },
    });

    return cachedClient;
  } catch (error) {
    console.warn('Failed to create Supabase client:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.NODE_ENV,
    });
    return null;
  }
}
