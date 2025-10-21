import { initAgentiqClient, AgentiqCoreClient } from '@qriptoagentiq/core-client';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Persona {
  id: string;
  root_id: string | null;
  fio_handle: string | null;
  default_identity_state: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';
  app_origin: string | null;
  world_id_status: 'unverified' | 'verified_human' | 'agent_declared';
  created_at: string;
}

export class PersonaService {
  private supabase: SupabaseClient;

  constructor() {
    // Use QubeBase SDK for proper connection management
    const client = initAgentiqClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    
    this.supabase = client.supabase;
  }

  async createPersona(input: { rootId?: string; fioHandle?: string; defaultState?: Persona['default_identity_state']; appOrigin?: string; worldIdStatus?: Persona['world_id_status'] }) {
    const { data, error } = await this.supabase
      .from('persona')
      .insert({
        root_id: input.rootId ?? null,
        fio_handle: input.fioHandle ?? null,
        default_identity_state: input.defaultState ?? 'semi_anonymous',
        app_origin: input.appOrigin ?? 'aigent-z',
        world_id_status: input.worldIdStatus ?? 'unverified'
      })
      .select()
      .single();
    if (error) throw error;
    return data as Persona;
  }

  async listPersonas(limit = 50) {
    const { data, error } = await this.supabase
      .from('persona')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as Persona[];
  }
}
