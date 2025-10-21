declare module '@qriptoagentiq/core-client' {
  import type { SupabaseClient } from '@supabase/supabase-js';
  export interface AgentiqInitOptions {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }
  export interface AgentiqCoreClient {
    supabase: SupabaseClient;
    ensureIamUser(): Promise<{ ok: boolean }>;
  }
  export function initAgentiqClient(opts?: AgentiqInitOptions): AgentiqCoreClient;
}
