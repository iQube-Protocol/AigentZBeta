/**
 * Local implementation of @qriptoagentiq/core-client
 * 
 * This replaces the broken npm package which was published without dist files.
 * Provides a thin wrapper around Supabase client for the iQube ecosystem.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AgentiqInitOptions {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface AgentiqCoreClient {
  supabase: SupabaseClient;
  ensureIamUser(): Promise<{ ok: boolean }>;
}

/**
 * Initialize the AgentiQ client with Supabase connection
 */
export function initAgentiqClient(opts?: AgentiqInitOptions): AgentiqCoreClient {
  const supabaseUrl = opts?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = opts?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Provide supabaseUrl and supabaseAnonKey.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    supabase,
    async ensureIamUser(): Promise<{ ok: boolean }> {
      // Placeholder for IAM user verification
      // In production, this would verify the user exists in the IAM system
      return { ok: true };
    },
  };
}

// Re-export types for compatibility
export type { SupabaseClient };
