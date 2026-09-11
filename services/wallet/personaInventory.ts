import type { SupabaseClient } from '@supabase/supabase-js';
import { AIGENT_ME_APP_ORIGIN } from '@/services/agents/provisionAigentMePersona';
import { getMergedLinkedAuthProfileIds, getPersonaPrefs } from '@/services/wallet/multiEmailIdentity';

export type PersonaInventoryRow = {
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
  evm_address?: string | null;
  evm_key?: { address?: string; evmAddress?: string } | null;
};

type UserIQubeGrant = { personaId?: string; tenantId?: string; role?: 'owner' | 'operator' | 'viewer'; active?: boolean };

const PERSONA_SELECT =
  'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at,evm_address,evm_key';

export function dedupePersonaInventory(rows: PersonaInventoryRow[]): PersonaInventoryRow[] {
  const byId = new Map<string, PersonaInventoryRow>();
  for (const row of rows) byId.set(row.id, row);
  const byRecency = Array.from(byId.values()).sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  return [
    ...byRecency.filter((row) => row.app_origin !== AIGENT_ME_APP_ORIGIN),
    ...byRecency.filter((row) => row.app_origin === AIGENT_ME_APP_ORIGIN),
  ];
}

/** Canonical owner-visible persona inventory shared by the wallet and Threshold.
 * Raw ids remain server-internal; callers must project an appropriate exposure tier. */
export async function listVisiblePersonaInventory(
  admin: SupabaseClient,
  input: {
    callerAuthProfileId: string;
    legacyAuthUserId?: string | null;
    tenantId?: string | null;
    includeArchived?: boolean;
  },
): Promise<PersonaInventoryRow[]> {
  const { data: iqubeData } = await admin
    .from('user_iqubes')
    .select('allowed_tenant_ids,persona_grants')
    .eq('auth_profile_id', input.callerAuthProfileId)
    .eq('status', 'active')
    .maybeSingle();

  const allowedTenantIds = new Set(((iqubeData?.allowed_tenant_ids as string[] | null) ?? []).filter(Boolean));
  const grants = (((iqubeData?.persona_grants as UserIQubeGrant[] | null) ?? [])).filter((grant) => grant?.active !== false);
  const grantedPersonaIds = Array.from(new Set(grants.map((grant) => grant.personaId).filter((id): id is string => Boolean(id))));
  if (input.tenantId && allowedTenantIds.size > 0 && !allowedTenantIds.has(input.tenantId)) return [];

  const linked = await getMergedLinkedAuthProfileIds(input.callerAuthProfileId).catch(() => []);
  const visibleProfiles = Array.from(new Set([
    input.callerAuthProfileId,
    ...linked,
    ...(input.legacyAuthUserId ? [input.legacyAuthUserId] : []),
  ]));
  const statusFilter = input.includeArchived ? ['active', 'inactive'] : ['active'];

  let ownerQuery = admin.from('personas').select(PERSONA_SELECT).in('status', statusFilter);
  ownerQuery = visibleProfiles.length === 1
    ? ownerQuery.eq('auth_profile_id', visibleProfiles[0])
    : ownerQuery.in('auth_profile_id', visibleProfiles);
  if (input.tenantId) ownerQuery = ownerQuery.eq('tenant_id', input.tenantId);
  const { data: ownerRows, error: ownerError } = await ownerQuery;
  if (ownerError) throw new Error('Failed to fetch owner personas');

  let grantRows: PersonaInventoryRow[] = [];
  if (grantedPersonaIds.length > 0) {
    // Preserve /api/wallet/personas' existing grant semantics: status filtering
    // applies to directly owned rows; a granted row's lifecycle is governed by
    // the active grant itself and owner access preferences.
    let query = admin.from('personas').select(PERSONA_SELECT).in('id', grantedPersonaIds);
    if (input.tenantId) query = query.eq('tenant_id', input.tenantId);
    else if (allowedTenantIds.size > 0) query = query.in('tenant_id', Array.from(allowedTenantIds));
    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch granted personas');
    grantRows = (data ?? []) as PersonaInventoryRow[];
  }

  const prefs = await getPersonaPrefs(input.callerAuthProfileId).catch(() => []);
  const denied = new Set(prefs.filter((row) => row.access_mode === 'deny').map((row) => String(row.persona_id)));
  const allowed = new Set(prefs.filter((row) => row.access_mode === 'allow').map((row) => String(row.persona_id)));
  return dedupePersonaInventory([...(ownerRows ?? []) as PersonaInventoryRow[], ...grantRows]).filter((row) => {
    if (denied.has(row.id)) return false;
    return allowed.size === 0 || allowed.has(row.id) || row.auth_profile_id === input.callerAuthProfileId;
  });
}
