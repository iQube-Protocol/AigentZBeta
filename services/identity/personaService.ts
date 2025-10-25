import { initAgentiqClient, AgentiqCoreClient } from '@qriptoagentiq/core-client';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Persona {
  id: string;
  root_id: string | null;
  fio_handle: string | null;
  default_identity_state: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';
  app_origin: string | null;
  world_id_status: 'unverified' | 'verified_human' | 'agent_declared' | 'not_verified';
  created_at: string;
}

export class PersonaService {
  private supabase: SupabaseClient;

  constructor() {
    // Use QubeBase SDK for proper connection management
    // CRITICAL: Use SERVICE_ROLE_KEY to bypass RLS policies for persona creation
    // Try multiple possible environment variable names
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('[PersonaService] Key check:', {
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasPublicServiceKey: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
      usingServiceKey: !!serviceKey
    });
    
    if (!serviceKey) {
      console.warn('[PersonaService] No SERVICE_ROLE_KEY found, using ANON key (RLS will apply)');
    }
    
    const client = initAgentiqClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: serviceKey || anonKey
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
        world_id_status: input.worldIdStatus === 'not_verified' ? 'unverified' : (input.worldIdStatus ?? 'unverified')
      })
      .select()
      .single();
    
    if (error) {
      // Provide user-friendly error messages
      if (error.message?.includes('persona_world_id_status_check')) {
        throw new Error('Please select whether this persona represents a Verified Human or AI Agent');
      }
      if (error.message?.includes('row-level security policy')) {
        throw new Error('Database permission error. Please contact support. (Missing SUPABASE_SERVICE_ROLE_KEY in environment)');
      }
      if (error.message?.includes('duplicate key')) {
        throw new Error('A persona with this FIO handle already exists');
      }
      // Generic error
      throw new Error(error.message || 'Failed to create persona');
    }
    
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
