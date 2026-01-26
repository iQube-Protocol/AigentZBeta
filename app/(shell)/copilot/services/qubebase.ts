/**
 * QubeBase Service for CopilotKit Actions
 * 
 * Connects to Supabase (QubeBase) for live data operations.
 * Used by copilot actions to replace mock data with real queries.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client for server-side operations
 */
export function getQubeBaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[QubeBase] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return null;
  }

  supabaseClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

// ============================================================================
// TENANT OPERATIONS
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  franchise_id?: string;
  chains?: string[];
  active: boolean;
  created_at: string;
}

/**
 * List all tenants
 */
export async function listTenants(activeOnly = false): Promise<{ success: boolean; tenants: Tenant[]; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, tenants: [], error: 'QubeBase not configured' };
  }

  try {
    let query = client.from('tenants').select('*').order('created_at', { ascending: false });
    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, tenants: data || [] };
  } catch (error: any) {
    console.error('[QubeBase] listTenants error:', error);
    return { success: false, tenants: [], error: error.message };
  }
}

/**
 * Get tenant by ID or slug
 */
export async function getTenant(idOrSlug: string): Promise<{ success: boolean; tenant?: Tenant; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    // Try by ID first, then by slug
    let { data, error } = await client.from('tenants').select('*').eq('id', idOrSlug).single();
    
    if (error || !data) {
      const slugResult = await client.from('tenants').select('*').eq('slug', idOrSlug).single();
      data = slugResult.data;
      error = slugResult.error;
    }

    if (error) throw error;
    return { success: true, tenant: data };
  } catch (error: any) {
    console.error('[QubeBase] getTenant error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new tenant
 */
export async function createTenant(input: {
  name: string;
  slug: string;
  franchiseId?: string;
  chains?: string[];
}): Promise<{ success: boolean; tenant?: Tenant; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const { data, error } = await client
      .from('tenants')
      .insert({
        name: input.name,
        slug: input.slug,
        franchise_id: input.franchiseId,
        chains: input.chains || ['polygon'],
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, tenant: data };
  } catch (error: any) {
    console.error('[QubeBase] createTenant error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// IQUBE OPERATIONS
// ============================================================================

export interface IQube {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  iqube_type: string;
  instance_type: string;
  business_model?: string;
  sensitivity_score?: number;
  accuracy_score?: number;
  verifiability_score?: number;
  risk_score?: number;
  created_at: string;
}

/**
 * List iQubes for a tenant
 */
export async function listIQubes(tenantId?: string, type?: string): Promise<{ success: boolean; iqubes: IQube[]; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, iqubes: [], error: 'QubeBase not configured' };
  }

  try {
    let query = client.from('iqube_templates').select('*').order('created_at', { ascending: false });
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (type) {
      query = query.eq('iqube_type', type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, iqubes: data || [] };
  } catch (error: any) {
    console.error('[QubeBase] listIQubes error:', error);
    return { success: false, iqubes: [], error: error.message };
  }
}

/**
 * Create a new iQube
 */
export async function createIQube(input: {
  tenantId?: string;
  type: string;
  name: string;
  description?: string;
  instanceType?: string;
  businessModel?: string;
}): Promise<{ success: boolean; iqube?: IQube; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const { data, error } = await client
      .from('iqube_templates')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        description: input.description || '',
        iqube_type: input.type,
        instance_type: input.instanceType || 'instance',
        business_model: input.businessModel || 'Subscribe',
        sensitivity_score: 5,
        accuracy_score: 5,
        verifiability_score: 5,
        risk_score: 5,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, iqube: data };
  } catch (error: any) {
    console.error('[QubeBase] createIQube error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PERSONA OPERATIONS
// ============================================================================

export interface Persona {
  id: string;
  root_id?: string;
  fio_handle?: string;
  default_identity_state: string;
  app_origin?: string;
  world_id_status: string;
  created_at: string;
}

/**
 * List personas
 */
export async function listPersonas(tenantId?: string, limit = 50): Promise<{ success: boolean; personas: Persona[]; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, personas: [], error: 'QubeBase not configured' };
  }

  try {
    let query = client.from('personas').select('*').order('created_at', { ascending: false }).limit(limit);
    
    // Note: tenant filtering would require a join or tenant_id column on persona table
    // For now, return all personas

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, personas: data || [] };
  } catch (error: any) {
    console.error('[QubeBase] listPersonas error:', error);
    return { success: false, personas: [], error: error.message };
  }
}

/**
 * Create a new persona
 */
export async function createPersona(input: {
  rootId?: string;
  fioHandle?: string;
  defaultState?: string;
  appOrigin?: string;
  worldIdStatus?: string;
}): Promise<{ success: boolean; persona?: Persona; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const { data, error } = await client
      .from('personas')
      .insert({
        root_id: input.rootId || null,
        fio_handle: input.fioHandle || null,
        default_identity_state: input.defaultState || 'semi_anonymous',
        app_origin: input.appOrigin || 'aigent-z',
        world_id_status: input.worldIdStatus || 'unverified',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, persona: data };
  } catch (error: any) {
    console.error('[QubeBase] createPersona error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// KYBE IDENTITY OPERATIONS
// ============================================================================

export interface KybeIdentity {
  id: string;
  kybe_did: string;
  encrypted_soul_key?: string;
  state: string;
  issued_at: string;
  updated_at: string;
}

/**
 * Get KybeDID for a tenant/persona
 */
export async function getKybeIdentity(kybeDidOrId: string): Promise<{ success: boolean; kybe?: KybeIdentity; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    let { data, error } = await client.from('kybe_identity').select('*').eq('id', kybeDidOrId).single();
    
    if (error || !data) {
      const didResult = await client.from('kybe_identity').select('*').eq('kybe_did', kybeDidOrId).single();
      data = didResult.data;
      error = didResult.error;
    }

    if (error) throw error;
    return { success: true, kybe: data };
  } catch (error: any) {
    console.error('[QubeBase] getKybeIdentity error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new KybeDID
 */
export async function createKybeIdentity(input: {
  kybeDid?: string;
}): Promise<{ success: boolean; kybe?: KybeIdentity; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const kybeDid = input.kybeDid || `kybe:did:aigent:${Date.now()}`;
    
    const { data, error } = await client
      .from('kybe_identity')
      .insert({
        kybe_did: kybeDid,
        state: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, kybe: data };
  } catch (error: any) {
    console.error('[QubeBase] createKybeIdentity error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// ROOT IDENTITY OPERATIONS
// ============================================================================

export interface RootIdentity {
  id: string;
  kybe_id?: string;
  kybe_hash?: string;
  did_uri: string;
  kyc_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new Root DID
 */
export async function createRootIdentity(input: {
  kybeId?: string;
  label?: string;
}): Promise<{ success: boolean; rootDid?: RootIdentity; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const didUri = `root:did:aigent:${Date.now()}`;
    
    const { data, error } = await client
      .from('root_identity')
      .insert({
        kybe_id: input.kybeId || null,
        did_uri: didUri,
        kyc_status: 'unverified',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, rootDid: data };
  } catch (error: any) {
    console.error('[QubeBase] createRootIdentity error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EVENT LOGGING (EventQube)
// ============================================================================

export interface EventLog {
  id: string;
  tenant_id: string;
  event_type: string;
  action: string;
  persona_id?: string;
  details?: Record<string, any>;
  severity: string;
  created_at: string;
}

/**
 * Log an event to EventQube
 */
export async function logEvent(input: {
  tenantId: string;
  eventType: string;
  action: string;
  personaId?: string;
  details?: Record<string, any>;
  severity?: string;
}): Promise<{ success: boolean; event?: EventLog; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    // Fallback to console logging if QubeBase not available
    console.log('[EventQube]', input);
    return { 
      success: true, 
      event: {
        id: `event_${Date.now()}`,
        tenant_id: input.tenantId,
        event_type: input.eventType,
        action: input.action,
        persona_id: input.personaId,
        details: input.details,
        severity: input.severity || 'info',
        created_at: new Date().toISOString(),
      }
    };
  }

  try {
    const { data, error } = await client
      .from('event_logs')
      .insert({
        tenant_id: input.tenantId,
        event_type: input.eventType,
        action: input.action,
        persona_id: input.personaId,
        details: input.details,
        severity: input.severity || 'info',
      })
      .select()
      .single();

    if (error) {
      // Table might not exist yet, fallback to console
      console.log('[EventQube] Fallback:', input);
      return { 
        success: true, 
        event: {
          id: `event_${Date.now()}`,
          tenant_id: input.tenantId,
          event_type: input.eventType,
          action: input.action,
          persona_id: input.personaId,
          details: input.details,
          severity: input.severity || 'info',
          created_at: new Date().toISOString(),
        }
      };
    }

    return { success: true, event: data };
  } catch (error: any) {
    console.error('[QubeBase] logEvent error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get audit trail
 */
export async function getAuditTrail(input: {
  tenantId: string;
  eventType?: string;
  personaId?: string;
  limit?: number;
}): Promise<{ success: boolean; events: EventLog[]; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, events: [], error: 'QubeBase not configured' };
  }

  try {
    let query = client
      .from('event_logs')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .order('created_at', { ascending: false })
      .limit(input.limit || 50);

    if (input.eventType) {
      query = query.eq('event_type', input.eventType);
    }
    if (input.personaId) {
      query = query.eq('persona_id', input.personaId);
    }

    const { data, error } = await query;
    
    if (error) {
      // Table might not exist, return empty
      return { success: true, events: [] };
    }

    return { success: true, events: data || [] };
  } catch (error: any) {
    console.error('[QubeBase] getAuditTrail error:', error);
    return { success: false, events: [], error: error.message };
  }
}

// ============================================================================
// FRANCHISE OPERATIONS (L1)
// ============================================================================

export interface Franchise {
  id: string;
  name: string;
  slug: string;
  description?: string;
  kb_endpoint?: string;
  ui_url?: string;
  chains?: string[];
  active: boolean;
  created_at: string;
}

/**
 * List all franchises
 */
export async function listFranchises(activeOnly = false): Promise<{ success: boolean; franchises: Franchise[]; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, franchises: [], error: 'QubeBase not configured' };
  }

  try {
    let query = client.from('franchises').select('*').order('name');
    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, franchises: data || [] };
  } catch (error: any) {
    console.error('[QubeBase] listFranchises error:', error);
    return { success: false, franchises: [], error: error.message };
  }
}

/**
 * Get franchise by ID or slug
 */
export async function getFranchise(idOrSlug: string): Promise<{ success: boolean; franchise?: Franchise; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    let { data, error } = await client.from('franchises').select('*').eq('id', idOrSlug).single();
    
    if (error || !data) {
      const slugResult = await client.from('franchises').select('*').eq('slug', idOrSlug).single();
      data = slugResult.data;
      error = slugResult.error;
    }

    if (error) throw error;
    return { success: true, franchise: data };
  } catch (error: any) {
    console.error('[QubeBase] getFranchise error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new franchise
 */
export async function createFranchise(input: {
  name: string;
  slug: string;
  description?: string;
  kbEndpoint?: string;
  uiUrl?: string;
  chains?: string[];
}): Promise<{ success: boolean; franchise?: Franchise; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const { data, error } = await client
      .from('franchises')
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description,
        kb_endpoint: input.kbEndpoint,
        ui_url: input.uiUrl,
        chains: input.chains || ['polygon'],
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, franchise: data };
  } catch (error: any) {
    console.error('[QubeBase] createFranchise error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List tenants for a franchise
 */
export async function listTenantsForFranchise(franchiseId: string): Promise<{ success: boolean; tenants: Tenant[]; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, tenants: [], error: 'QubeBase not configured' };
  }

  try {
    const { data, error } = await client
      .from('tenants')
      .select('*')
      .eq('franchise_id', franchiseId)
      .order('name');

    if (error) throw error;
    return { success: true, tenants: data || [] };
  } catch (error: any) {
    console.error('[QubeBase] listTenantsForFranchise error:', error);
    return { success: false, tenants: [], error: error.message };
  }
}

// ============================================================================
// IQUBE SHARING (Cross-tenant consent)
// ============================================================================

export interface IQubeShare {
  id: string;
  iqube_id: string;
  owner_persona_id: string;
  shared_with_tenant_id?: string;
  shared_with_persona_id?: string;
  access_level: 'metaqube' | 'blakqube_read' | 'blakqube_write';
  consent_given_at: string;
  revoked_at?: string;
}

/**
 * Share an iQube with a tenant or persona
 */
export async function shareIQube(input: {
  iQubeId: string;
  ownerPersonaId: string;
  sharedWithTenantId?: string;
  sharedWithPersonaId?: string;
  accessLevel: 'metaqube' | 'blakqube_read' | 'blakqube_write';
}): Promise<{ success: boolean; share?: IQubeShare; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const { data, error } = await client
      .from('iqube_shares')
      .insert({
        iqube_id: input.iQubeId,
        owner_persona_id: input.ownerPersonaId,
        shared_with_tenant_id: input.sharedWithTenantId,
        shared_with_persona_id: input.sharedWithPersonaId,
        access_level: input.accessLevel,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, share: data };
  } catch (error: any) {
    console.error('[QubeBase] shareIQube error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke an iQube share
 */
export async function revokeIQubeShare(shareId: string): Promise<{ success: boolean; error?: string }> {
  const client = getQubeBaseClient();
  if (!client) {
    return { success: false, error: 'QubeBase not configured' };
  }

  try {
    const { error } = await client
      .from('iqube_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('[QubeBase] revokeIQubeShare error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// UTILITY: Check if QubeBase is configured
// ============================================================================

export function isQubeBaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key);
}
