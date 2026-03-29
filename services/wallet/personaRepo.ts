import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';

export type PersonaVisibility = 'owner' | 'tenant_discoverable' | 'none';

export type PersonaPublicView = {
  id: string;
  tenantId: string;
  displayName: string;
  avatarUri: string | null;
  fioHandle: string | null;
  reputationScore: number;
  reputationBucket: number;
  badges: string[];
  defaultIdentityState: string | null;
  worldIdStatus: string | null;
  appOrigin: string | null;
  discoverableWithinTenant: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersonaOwnerView = PersonaPublicView & {
  authProfileId: string | null;
};

type PersonaRow = {
  id: string;
  tenant_id: string;
  auth_profile_id: string | null;
  display_name: string;
  avatar_uri: string | null;
  fio_handle: string;
  reputation_score: number;
  reputation_bucket: number;
  badges: string[] | null;
  default_identity_state?: string | null;
  world_id_status?: string | null;
  app_origin?: string | null;
  discoverable_within_tenant?: boolean | null;
  created_at: string;
  updated_at: string;
};

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function getSupabaseAdminClient(): SupabaseClient {
  const url = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing Supabase server configuration');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSupabaseAnonClient(): SupabaseClient {
  const url = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getEnv('SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('Missing Supabase anon configuration');
  return createClient(url, key, { auth: { persistSession: false } });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDeterministicUuid(value: string): string {
  if (isUuid(value)) return value.toLowerCase();
  const hex = createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  const a = hex.slice(0, 8);
  const b = hex.slice(8, 12);
  const c = `4${hex.slice(13, 16)}`;
  const dNibble = (parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8;
  const d = `${dNibble.toString(16)}${hex.slice(17, 20)}`;
  const e = hex.slice(20, 32);
  return `${a}-${b}-${c}-${d}-${e}`;
}

async function ensureAuthProfileExistsById(authProfileId: string): Promise<string | null> {
  const canonicalId = toDeterministicUuid(authProfileId);
  const admin = getSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from('crm_auth_profiles')
    .select('id')
    .eq('id', canonicalId)
    .maybeSingle();

  if (existingError) return null;
  if (existing?.id) return String(existing.id);

  const syntheticEmail = `${canonicalId}@guest.agentiq.local`;
  const now = new Date().toISOString();
  const { data: created, error: createError } = await admin
    .from('crm_auth_profiles')
    .upsert(
      {
        id: canonicalId,
        email: syntheticEmail,
        email_verified: false,
        is_active: true,
        oauth_providers: {},
        updated_at: now,
      },
      { onConflict: 'id' }
    )
    .select('id')
    .maybeSingle();

  if (createError) return null;
  return created?.id ? String(created.id) : canonicalId;
}

export type CallerIdentityContext = {
  authProfileId: string;
  email: string | null;
};

async function getOrCreateCanonicalAuthProfileId(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const admin = getSupabaseAdminClient();

  const { data: aliasRows, error: aliasError } = await admin
    .from('crm_auth_profile_emails')
    .select('auth_profile_id')
    .eq('email_normalized', normalizedEmail)
    .limit(1);

  if (!aliasError && aliasRows && aliasRows.length > 0 && aliasRows[0]?.auth_profile_id) {
    return String(aliasRows[0].auth_profile_id);
  }

  const { data: existing, error: existingError } = await admin
    .from('crm_auth_profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingError) return null;
  if (existing?.id) {
    const now = new Date().toISOString();
    await admin.from('crm_auth_profile_emails').upsert(
      {
        auth_profile_id: existing.id,
        email: normalizedEmail,
        email_normalized: normalizedEmail,
        is_primary: true,
        is_verified: true,
        updated_at: now,
      },
      { onConflict: 'email_normalized' }
    );
    return String(existing.id);
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await admin
    .from('crm_auth_profiles')
    .upsert(
      {
        email: normalizedEmail,
        email_verified: true,
        is_active: true,
        oauth_providers: {},
        updated_at: now,
      },
      { onConflict: 'email' }
    )
    .select('id')
    .maybeSingle();

  if (createError) return null;
  if (created?.id) {
    await admin.from('crm_auth_profile_emails').upsert(
      {
        auth_profile_id: created.id,
        email: normalizedEmail,
        email_normalized: normalizedEmail,
        is_primary: true,
        is_verified: true,
      },
      { onConflict: 'email_normalized' }
    );
  }
  return created?.id ? String(created.id) : null;
}

function tryDecodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → Buffer
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCallerIdentityContext(request: NextRequest): Promise<CallerIdentityContext | null> {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  if (token) {
    let userId: string | null = null;
    let tokenEmail: string | null = null;

    // Try Supabase client first; fall back to direct JWT decode if env vars are missing
    try {
      const supabase = getSupabaseAnonClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user?.id) {
        userId = data.user.id;
        tokenEmail = (data.user.email || '').trim().toLowerCase() || null;
      }
    } catch {
      // Supabase client unavailable (e.g. missing env vars in Lambda runtime)
    }

    // JWT decode fallback
    if (!userId) {
      const payload = tryDecodeJwtPayload(token);
      if (payload?.sub) {
        userId = payload.sub;
        tokenEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
      }
    }

    if (!userId) return null;

    if (tokenEmail) {
      const canonicalAuthProfileId = await getOrCreateCanonicalAuthProfileId(tokenEmail);
      if (canonicalAuthProfileId) {
        return {
          authProfileId: canonicalAuthProfileId,
          email: tokenEmail,
        };
      }
    }

    return {
      authProfileId: userId,
      email: tokenEmail,
    };
  }

  const headerId = request.headers.get('x-auth-profile-id');
  if (headerId) {
    const canonicalHeaderId = await ensureAuthProfileExistsById(headerId.trim());
    if (!canonicalHeaderId) return null;
    return {
      authProfileId: canonicalHeaderId,
      email: null,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    const { searchParams } = new URL(request.url);
    const devId = searchParams.get('authProfileId');
    if (devId) {
      const canonicalDevId = await ensureAuthProfileExistsById(devId.trim());
      if (!canonicalDevId) return null;
      return {
        authProfileId: canonicalDevId,
        email: null,
      };
    }
  }

  return null;
}

export async function getCallerAuthProfileId(request: NextRequest): Promise<string | null> {
  const context = await getCallerIdentityContext(request);
  return context?.authProfileId || null;
}

function toPublicView(row: PersonaRow, visibility: PersonaVisibility): PersonaPublicView {
  const fioHandle =
    visibility === 'owner' || visibility === 'tenant_discoverable' ? row.fio_handle : null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    displayName: row.display_name,
    avatarUri: row.avatar_uri,
    fioHandle,
    reputationScore: row.reputation_score ?? 0,
    reputationBucket: row.reputation_bucket ?? 0,
    badges: row.badges ?? [],
    defaultIdentityState: row.default_identity_state ?? null,
    worldIdStatus: row.world_id_status ?? null,
    appOrigin: row.app_origin ?? null,
    discoverableWithinTenant: !!row.discoverable_within_tenant,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOwnerView(row: PersonaRow): PersonaOwnerView {
  return {
    ...toPublicView(row, 'owner'),
    authProfileId: row.auth_profile_id,
  };
}

export class PersonaRepo {
  private admin = getSupabaseAdminClient();

  async getById(id: string): Promise<PersonaRow | null> {
    const { data, error } = await this.admin
      .from('personas')
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,discoverable_within_tenant,created_at,updated_at'
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as PersonaRow | null) ?? null;
  }

  async getOwnerPersona(id: string, callerAuthProfileId: string): Promise<PersonaOwnerView | null> {
    const row = await this.getById(id);
    if (!row) return null;
    if (!row.auth_profile_id || row.auth_profile_id !== callerAuthProfileId) return null;
    return toOwnerView(row);
  }

  async setDiscoverableWithinTenant(id: string, callerAuthProfileId: string, discoverable: boolean) {
    const row = await this.getById(id);
    if (!row) return { ok: false as const, error: 'Persona not found' };
    if (!row.auth_profile_id || row.auth_profile_id !== callerAuthProfileId) {
      return { ok: false as const, error: 'Forbidden' };
    }

    const { data, error } = await this.admin
      .from('personas')
      .update({ discoverable_within_tenant: discoverable })
      .eq('id', id)
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,discoverable_within_tenant,created_at,updated_at'
      )
      .single();

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, persona: toOwnerView(data as PersonaRow) };
  }

  async listDiscoverableInTenant(tenantId: string, q?: string, limit = 25): Promise<PersonaPublicView[]> {
    let query = this.admin
      .from('personas')
      .select(
        'id,tenant_id,display_name,avatar_uri,fio_handle,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,discoverable_within_tenant,created_at,updated_at'
      )
      .eq('tenant_id', tenantId)
      .eq('discoverable_within_tenant', true)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (q && q.trim().length > 0) {
      const term = q.trim();
      query = query.or(`display_name.ilike.%${term}%,fio_handle.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data as PersonaRow[]) || []).map((r) => toPublicView(r, 'tenant_discoverable'));
  }

  async resolveHandleInTenant(tenantId: string, fioHandle: string): Promise<{ id: string } | null> {
    const norm = fioHandle.trim().toLowerCase();
    const { data, error } = await this.admin
      .from('personas')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('discoverable_within_tenant', true)
      .ilike('fio_handle', norm)
      .maybeSingle();
    if (error) throw error;
    return data?.id ? { id: data.id as string } : null;
  }
}
