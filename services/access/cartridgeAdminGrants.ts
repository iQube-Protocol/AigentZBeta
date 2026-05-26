/**
 * cartridgeAdminGrants — per-persona "which cartridges am I admin of?"
 *
 * Resolves an active persona's per-cartridge admin grants from the
 * canonical CRM admin-roles model (uber / category_uber /
 * platform_super / franchise_super / tenant_super / category).
 *
 * Used by the metaMe Cartridge to decide whether to render a foreign
 * cartridge's Admin tab inside an Activation sub-surface — the
 * chief-of-staff unlock for founder-operator personas.
 *
 * Privacy posture
 * ---------------
 *   - Server-only resolver. T0 ids (authProfileId, kybeDid) are
 *     accepted as inputs but never serialised back out.
 *   - The returned `cartridgeSlugs` set is T1-safe (slugs only —
 *     same level of exposure as the existing CodexConfig.slug).
 *   - Callers MUST resolve the active persona via getActivePersona()
 *     and pass its authProfileId + linkedAuthProfileIds. Never trust
 *     a client-supplied claim.
 *
 * Alpha tenant↔cartridge mapping
 * ------------------------------
 *   For v1 we treat `crm_tenants.slug` as the cartridge slug. Today
 *   that holds because CRM tenants and cartridges 1:1 by slug. When
 *   the alignment diverges (e.g. multi-tenant cartridges like the 21
 *   Sats worlds), the resolution should grow an explicit mapping
 *   table — tracked in the backlog. This module is the single hook
 *   point to extend when that lands.
 */
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export interface CartridgeAdminGrants {
  /**
   * True when the persona holds an estate-wide role
   * (uber_admin / category_uber_admin / platform_super_admin). When
   * true, treat every cartridge in CODEX_DEFINITIONS as admin-visible.
   */
  isGlobalAdmin: boolean;
  /**
   * Explicit per-cartridge admin grants. Subset of cartridge slugs.
   * Empty when isGlobalAdmin is true (callers should branch on the
   * global flag first to avoid enumerating every cartridge here).
   */
  cartridgeSlugs: string[];
}

const EMPTY_GRANTS: CartridgeAdminGrants = {
  isGlobalAdmin: false,
  cartridgeSlugs: [],
};

interface AdminRoleRow {
  role_type: string;
  tenant_id: string | null;
  franchise_id: string | null;
}

interface TenantSlugRow {
  id?: string | null;
  slug: string | null;
}

export async function getCartridgeAdminGrants(
  authProfileId: string | null | undefined,
  linkedAuthProfileIds: string[] = [],
): Promise<CartridgeAdminGrants> {
  if (!authProfileId) return EMPTY_GRANTS;

  const client = getSupabaseServer();
  if (!client) return EMPTY_GRANTS;

  // 1) Read every active admin role row for any of the persona's
  //    candidate auth_profile_ids. The set includes the canonical id
  //    plus every linked profile id that the merge view has resolved
  //    — same source-of-truth as resolveAdminFlag in getActivePersona.
  const candidateIds = Array.from(new Set([authProfileId, ...linkedAuthProfileIds].filter(Boolean)));
  if (candidateIds.length === 0) return EMPTY_GRANTS;

  const { data: roleRows, error: roleErr } = await client
    .from('crm_admin_roles')
    .select('role_type, tenant_id, franchise_id')
    .in('auth_profile_id', candidateIds)
    .eq('is_active', true);

  if (roleErr || !roleRows || roleRows.length === 0) {
    return EMPTY_GRANTS;
  }

  // 2) Walk role rows. Estate-wide roles short-circuit to global
  //    admin. Tenant-scoped roles collect tenant ids; franchise-scoped
  //    roles collect franchise ids and we resolve their child tenants
  //    in step 3.
  const tenantIds = new Set<string>();
  const franchiseIds = new Set<string>();
  let isGlobalAdmin = false;

  for (const row of roleRows as AdminRoleRow[]) {
    switch (row.role_type) {
      case 'uber_admin':
      case 'category_uber_admin':
      case 'platform_super_admin':
        isGlobalAdmin = true;
        break;
      case 'franchise_super_admin':
        if (row.franchise_id) franchiseIds.add(row.franchise_id);
        // Some franchise admins are also issued a direct tenant scope
        // — capture both so the union covers everything.
        if (row.tenant_id) tenantIds.add(row.tenant_id);
        break;
      case 'tenant_super_admin':
      case 'category_admin':
      default:
        if (row.tenant_id) tenantIds.add(row.tenant_id);
        break;
    }
    if (isGlobalAdmin) break;
  }

  if (isGlobalAdmin) {
    return { isGlobalAdmin: true, cartridgeSlugs: [] };
  }

  // 3) Resolve franchise ids → child tenant ids. Tenants are children
  //    of franchises; a franchise_super_admin admins every tenant in
  //    that franchise. For now we fan out via a single batched query.
  if (franchiseIds.size > 0) {
    const { data: fanout } = await client
      .from('crm_tenants')
      .select('id')
      .in('franchise_id', Array.from(franchiseIds));
    if (Array.isArray(fanout)) {
      for (const row of fanout as Array<{ id?: string }>) {
        if (row.id) tenantIds.add(row.id);
      }
    }
  }

  if (tenantIds.size === 0) {
    return { isGlobalAdmin: false, cartridgeSlugs: [] };
  }

  // 4) Resolve tenant ids → tenant slugs. The alpha mapping treats
  //    tenant.slug as the cartridge slug verbatim — see file-level
  //    comment for the multi-tenant cartridge backlog item.
  const { data: tenantRows } = await client
    .from('crm_tenants')
    .select('slug')
    .in('id', Array.from(tenantIds));

  const cartridgeSlugs = Array.from(
    new Set(
      ((tenantRows ?? []) as TenantSlugRow[])
        .map((t) => (typeof t.slug === 'string' ? t.slug.trim() : ''))
        .filter((s): s is string => !!s),
    ),
  );

  return { isGlobalAdmin: false, cartridgeSlugs };
}
