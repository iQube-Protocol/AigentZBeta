import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds, getPersonaPrefs } from '@/services/wallet/multiEmailIdentity';

// Anon client for validating user JWTs (service role client cannot use getUser with token)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type PersonaRow = {
  id: string;
  tenant_id: string;
  auth_profile_id: string | null;
  display_name: string;
  avatar_uri: string | null;
  fio_handle: string;
  fio_domain: string | null;
  discoverable_within_tenant: boolean | null;
  reputation_score: number | null;
  reputation_bucket: number | null;
  badges: string[] | null;
  default_identity_state: string | null;
  world_id_status: string | null;
  app_origin: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type UserIQubeGrant = {
  personaId?: string;
  tenantId?: string;
  role?: 'owner' | 'operator' | 'viewer';
  active?: boolean;
};

type UserIQubeRow = {
  auth_profile_id: string;
  allowed_tenant_ids: string[] | null;
  persona_grants: UserIQubeGrant[] | null;
  status: string;
};

const personaSelect =
  'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at,evm_address,evm_key';

function dedupeById(rows: PersonaRow[]): PersonaRow[] {
  const byId = new Map<string, PersonaRow>();
  for (const row of rows) byId.set(row.id, row);
  return Array.from(byId.values()).sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

function toOwnerSafePersona(record: any) {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    authProfileId: record.auth_profile_id ?? null,
    displayName: record.display_name,
    avatarUri: record.avatar_uri ?? null,
    fioHandle: record.fio_handle,
    fioDomain: record.fio_domain ?? null,
    discoverableWithinTenant: !!record.discoverable_within_tenant,
    reputationScore: record.reputation_score ?? 0,
    reputationBucket: record.reputation_bucket ?? 0,
    badges: record.badges || [],
    defaultIdentityState: record.default_identity_state ?? null,
    worldIdStatus: record.world_id_status ?? null,
    appOrigin: record.app_origin ?? null,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    // Canonical EVM address for FIO handle → chain resolution
    evmAddress: record.evm_address || record.evm_key?.address || record.evm_key?.evmAddress || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const { data: iqubeData } = await supabase
      .from('user_iqubes')
      .select('auth_profile_id,allowed_tenant_ids,persona_grants,status')
      .eq('auth_profile_id', callerAuthProfileId)
      .eq('status', 'active')
      .maybeSingle();

    const iqube = (iqubeData as UserIQubeRow | null) ?? null;
    const allowedTenantIds = new Set((iqube?.allowed_tenant_ids || []).filter(Boolean));
    const activeGrants = (iqube?.persona_grants || []).filter((grant) => grant?.active !== false);
    const grantedPersonaIds = Array.from(
      new Set(activeGrants.map((grant) => grant.personaId).filter((id): id is string => !!id))
    );

    if (tenantId && allowedTenantIds.size > 0 && !allowedTenantIds.has(tenantId)) {
      return NextResponse.json([]);
    }

    let linkedAuthProfileIds: string[] = [];
    try {
      linkedAuthProfileIds = await getMergedLinkedAuthProfileIds(callerAuthProfileId);
    } catch {
      // crm_auth_profile_links table unavailable — continue with just the caller's ID
    }

    // Also include the raw Supabase auth.users.id — personas created before
    // canonicalization may still carry this UUID as their auth_profile_id.
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let supabaseUserId: string | null = null;
    if (bearerToken) {
      const { data: userData } = await supabaseAnon.auth.getUser(bearerToken);
      if (userData?.user?.id) supabaseUserId = userData.user.id;
    }

    const visibleAuthProfileIds = Array.from(
      new Set([callerAuthProfileId, ...linkedAuthProfileIds, ...(supabaseUserId ? [supabaseUserId] : [])])
    );

    let ownerQuery = supabase.from('personas').select(personaSelect);
    if (visibleAuthProfileIds.length === 1) {
      ownerQuery = ownerQuery.eq('auth_profile_id', visibleAuthProfileIds[0]);
    } else {
      ownerQuery = ownerQuery.in('auth_profile_id', visibleAuthProfileIds);
    }
    if (tenantId) ownerQuery = ownerQuery.eq('tenant_id', tenantId);

    const { data: ownerRows, error: ownerError } = await ownerQuery;
    if (ownerError) {
      return NextResponse.json({ error: 'Failed to fetch owner personas' }, { status: 500 });
    }

    let grantRows: PersonaRow[] = [];
    if (grantedPersonaIds.length > 0) {
      let grantQuery = supabase
        .from('personas')
        .select(personaSelect)
        .in('id', grantedPersonaIds);

      if (tenantId) {
        grantQuery = grantQuery.eq('tenant_id', tenantId);
      } else if (allowedTenantIds.size > 0) {
        grantQuery = grantQuery.in('tenant_id', Array.from(allowedTenantIds));
      }

      const { data, error } = await grantQuery;
      if (error) {
        return NextResponse.json({ error: 'Failed to fetch granted personas' }, { status: 500 });
      }
      grantRows = (data || []) as PersonaRow[];
    }

    let prefRows: { persona_id: string; access_mode: string }[] = [];
    try {
      prefRows = await getPersonaPrefs(callerAuthProfileId);
    } catch {
      // crm_persona_access_preferences table unavailable — allow all personas
    }
    const deniedPersonaIds = new Set(
      prefRows.filter((row: any) => row?.access_mode === 'deny').map((row: any) => String(row.persona_id))
    );
    const allowedPersonaIds = new Set(
      prefRows.filter((row: any) => row?.access_mode === 'allow').map((row: any) => String(row.persona_id))
    );

    const merged = dedupeById([...((ownerRows || []) as PersonaRow[]), ...grantRows]).filter((row) => {
      if (deniedPersonaIds.has(row.id)) return false;
      if (allowedPersonaIds.size === 0) return true;
      return allowedPersonaIds.has(row.id) || row.auth_profile_id === callerAuthProfileId;
    });
    return NextResponse.json(merged.map(toOwnerSafePersona));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

