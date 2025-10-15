import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
    // Check multiple environment variable patterns for Supabase configuration
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                process.env.SUPABASE_URL ||
                'https://bsjhfvctmduxhohtllly.supabase.co'; // Fallback to Aigent Z
    
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                process.env.SUPABASE_ANON_KEY ||
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M'; // Fallback to Aigent Z anon key
    
    if (!url || !key) throw new Error('Supabase env not configured');
    this.supabase = createClient(url, key);
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
