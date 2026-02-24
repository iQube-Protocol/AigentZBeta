import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function getActiveUserIQube(authProfileId: string): Promise<UserIQubeRow | null> {
  const { data, error } = await supabase
    .from('user_iqubes')
    .select('auth_profile_id,allowed_tenant_ids,persona_grants,status')
    .eq('auth_profile_id', authProfileId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return (data as UserIQubeRow | null) ?? null;
}

export function isTenantAllowed(iqube: UserIQubeRow | null, tenantId: string | null | undefined): boolean {
  if (!tenantId) return true;
  const allowedTenantIds = (iqube?.allowed_tenant_ids || []).filter(Boolean);
  if (allowedTenantIds.length === 0) return true;
  return allowedTenantIds.includes(tenantId);
}

export function hasActivePersonaGrant(
  iqube: UserIQubeRow | null,
  personaId: string,
  tenantId: string | null | undefined
): boolean {
  const grants = (iqube?.persona_grants || []).filter((grant) => grant?.active !== false);
  if (grants.length === 0) return false;

  const matchedGrant = grants.find((grant) => grant.personaId === personaId);
  if (!matchedGrant) return false;

  if (tenantId && matchedGrant.tenantId && matchedGrant.tenantId !== tenantId) {
    return false;
  }

  return isTenantAllowed(iqube, tenantId);
}
