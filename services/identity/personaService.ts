import { initAgentiqClient, AgentiqCoreClient } from '@/services/core/agentiqClient';
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
      .from('personas')
      .insert({
        type: 'PersonaQube',
        fio_handle: input.fioHandle ?? null,
        fio_domain: (input.fioHandle || '').includes('@') ? (input.fioHandle || '').split('@')[1] : 'qripto',
        root_did: input.fioHandle ? `did:fio:${input.fioHandle}` : `did:fio:unknown`,
        display_name: (input.fioHandle || '').includes('@') ? (input.fioHandle || '').split('@')[0] : 'Persona',
        avatar_uri: null,
        evm_key: null,
        chain_addresses: {},
        reputation_score: 0,
        reputation_bucket: 0,
        badges: [],
        status: 'active',
        tenant_id: 'default',
        auth_profile_id: null,
        discoverable_within_tenant: false,
        root_id: input.rootId ?? null,
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
    
    return {
      id: (data as any).id,
      root_id: (data as any).root_id ?? null,
      fio_handle: (data as any).fio_handle ?? null,
      default_identity_state: (data as any).default_identity_state,
      app_origin: (data as any).app_origin ?? null,
      world_id_status: (data as any).world_id_status,
      created_at: (data as any).created_at,
    } as Persona;
  }

  async listPersonas(limit = 50) {
    const { data, error } = await this.supabase
      .from('personas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as Persona[];
  }
}
