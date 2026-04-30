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
