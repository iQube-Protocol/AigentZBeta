import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only client factory. Do NOT import this in client components.
let cachedClient: SupabaseClient | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTimedFetch(timeoutMs: number): typeof fetch {
  return async (input, init = {}) => {
    const hasAbortTimeout = typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function';
    const signal = init.signal ?? (hasAbortTimeout ? (AbortSignal as any).timeout(timeoutMs) : undefined);
    return fetch(input, { ...init, signal });
  };
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

    const timeoutMs = parsePositiveInt(
      process.env.SUPABASE_FETCH_TIMEOUT_MS,
      process.env.NODE_ENV === 'development' ? 4000 : 8000,
    );

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
