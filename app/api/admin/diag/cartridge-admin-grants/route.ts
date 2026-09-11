/**
 * GET /api/admin/diag/cartridge-admin-grants
 *
 * Read-only diagnostic for the per-cartridge admin grants resolver.
 * Built 2026-05-26 because the operator reports the admin tab still
 * doesn't render for personas they expect to be cartridge admins,
 * even after the spine extension. This route dumps every layer of
 * the resolution chain so we can see exactly where the chain fails:
 *
 *   1. caller auth_profile_id + linked profile ids (multi-email merge)
 *   2. raw rows from crm_admin_roles for those auth_profile_ids
 *   3. raw rows from crm_tenants for the role rows' tenant_id refs
 *   4. raw rows from crm_franchises for franchise_super_admin fan-out
 *   5. the resolver's final output (cartridgeSlugs + isGlobalAdmin)
 *   6. the spine-resolved cartridgeFlags from getActivePersona
 *
 * If (2) is empty → CRM has no admin rows tied to this auth_profile_id
 *   and the operator needs to grant a role via the admin tooling.
 * If (2) has rows but (3) returns empty / wrong slug → the alias map
 *   in cartridgeAdminGrants needs an entry for that tenant slug.
 * If (3) returns the expected tenant but (5) doesn't translate
 *   correctly → bug in the alias map.
 *
 * Admin-only gate — same crm_admin_roles check as other diag routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';
import { getCartridgeAdminGrants } from '@/services/access/cartridgeAdminGrants';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAdminCaller(authProfileId: string, email: string | null): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;
  try {
    const { data } = await admin
      .from('crm_admin_roles')
      .select('id')
      .eq('auth_profile_id', authProfileId)
      .eq('is_active', true)
      .limit(1);
    if (Array.isArray(data) && data.length > 0) return true;
    if (email) {
      const { data: aliasRows } = await admin
        .from('crm_auth_profile_emails')
        .select('auth_profile_id')
        .eq('email_normalized', email.trim().toLowerCase())
        .eq('status', 'active');
      const aliasIds = ((aliasRows || []) as Array<{ auth_profile_id?: string }>)
        .map((r) => r.auth_profile_id)
        .filter((id): id is string => !!id);
      if (aliasIds.length > 0) {
        const { data: roles } = await admin
          .from('crm_admin_roles')
          .select('id')
          .in('auth_profile_id', aliasIds)
          .eq('is_active', true)
          .limit(1);
        if (Array.isArray(roles) && roles.length > 0) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const caller = await getCallerIdentityContext(req);
  if (!caller) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Admin gate — diagnostic exposes raw CRM rows. Admin-only.
  if (!(await isAdminCaller(caller.authProfileId, caller.email))) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  // Step 1 — linked profile ids
  let linkedAuthProfileIds: string[] = [];
  try {
    linkedAuthProfileIds = await getMergedLinkedAuthProfileIds(caller.authProfileId);
  } catch {
    linkedAuthProfileIds = [];
  }
  const allProfileIds = Array.from(
    new Set([caller.authProfileId, ...linkedAuthProfileIds].filter(Boolean)),
  );

  // Step 2 — raw admin role rows for these profiles
  const { data: roleRows, error: roleErr } = await admin
    .from('crm_admin_roles')
    .select('id, auth_profile_id, role_type, tenant_id, franchise_id, is_active, expires_at, created_at')
    .in('auth_profile_id', allProfileIds);

  // Step 3 — also check via crm_auth_profile_emails alias path (some
  // admin grants were attached to a sibling profile id that the merge
  // view doesn't yet link). Same fallback resolveAdminFlag uses.
  let emailAliasRows: Array<{ auth_profile_id: string }> = [];
  if (caller.email) {
    const { data } = await admin
      .from('crm_auth_profile_emails')
      .select('auth_profile_id')
      .eq('email_normalized', caller.email.trim().toLowerCase())
      .eq('status', 'active');
    emailAliasRows = ((data ?? []) as Array<{ auth_profile_id?: string }>)
      .map((r) => ({ auth_profile_id: r.auth_profile_id ?? '' }))
      .filter((r) => r.auth_profile_id);
  }
  const emailAliasProfileIds = emailAliasRows
    .map((r) => r.auth_profile_id)
    .filter((id) => !allProfileIds.includes(id));
  const { data: aliasRoleRows } = emailAliasProfileIds.length > 0
    ? await admin
        .from('crm_admin_roles')
        .select('id, auth_profile_id, role_type, tenant_id, franchise_id, is_active')
        .in('auth_profile_id', emailAliasProfileIds)
    : { data: [] as Array<Record<string, unknown>> };

  // Step 4 — tenant rows referenced by any active role
  const allActiveRoles = [
    ...(roleRows ?? []).filter((r) => r.is_active),
    ...(aliasRoleRows ?? []).filter((r: { is_active?: boolean }) => r.is_active),
  ];
  const tenantIds = Array.from(
    new Set(
      allActiveRoles
        .map((r) => r.tenant_id)
        .filter((id): id is string => !!id),
    ),
  );
  const franchiseIds = Array.from(
    new Set(
      allActiveRoles
        .map((r) => r.franchise_id)
        .filter((id): id is string => !!id),
    ),
  );

  const { data: tenantRows } = tenantIds.length > 0
    ? await admin.from('crm_tenants').select('id, slug, franchise_id, name').in('id', tenantIds)
    : { data: [] as Array<Record<string, unknown>> };

  const { data: franchiseRows } = franchiseIds.length > 0
    ? await admin.from('crm_franchises').select('id, slug, name').in('id', franchiseIds)
    : { data: [] as Array<Record<string, unknown>> };

  // Step 5 — franchise fan-out preview (tenants whose franchise_id
  // matches any franchise_super_admin role)
  const franchiseSuperIds = allActiveRoles
    .filter((r) => r.role_type === 'franchise_super_admin')
    .map((r) => r.franchise_id)
    .filter((id): id is string => !!id);
  const { data: fanoutTenantRows } = franchiseSuperIds.length > 0
    ? await admin
        .from('crm_tenants')
        .select('id, slug, franchise_id, name')
        .in('franchise_id', franchiseSuperIds)
    : { data: [] as Array<Record<string, unknown>> };

  // Step 6 — what the resolver returns (with the same email-alias
  // fallback the spine pass uses)
  const grants = await getCartridgeAdminGrants(
    caller.authProfileId,
    linkedAuthProfileIds,
    caller.email ?? null,
  );

  // Step 7 — what getActivePersona actually exposes downstream
  const activePersona = await getActivePersona(req);

  return NextResponse.json(
    {
      ok: true,
      caller: {
        authProfileId: caller.authProfileId,
        email: caller.email,
      },
      step1_linkage: {
        linkedAuthProfileIds,
        allProfileIds,
        emailAliasProfileIds,
      },
      step2_role_rows_direct: {
        rows: roleRows ?? [],
        error: roleErr?.message ?? null,
        count: (roleRows ?? []).length,
      },
      step3_role_rows_via_email_alias: {
        emailAliasRows,
        aliasRoleRows: aliasRoleRows ?? [],
      },
      step4_tenants_referenced: {
        tenantIds,
        tenantRows: tenantRows ?? [],
        franchiseIds,
        franchiseRows: franchiseRows ?? [],
      },
      step5_franchise_fanout: {
        franchiseSuperIds,
        fanoutTenantRows: fanoutTenantRows ?? [],
      },
      step6_resolver_output: {
        isGlobalAdmin: grants.isGlobalAdmin,
        cartridgeSlugs: grants.cartridgeSlugs,
        rawCount: grants.cartridgeSlugs.length,
      },
      step7_spine_cartridge_flags: {
        cartridgeFlags: activePersona?.cartridgeFlags ?? null,
      },
      hint: (() => {
        if (allActiveRoles.length === 0) {
          return 'NO active admin role rows found for any of your linked auth_profile_ids. Either (a) CRM hasn\'t granted you a role on any cartridge, or (b) your auth_profile_id isn\'t linked to the profile that holds the role. Check step2 + step3.';
        }
        if (grants.isGlobalAdmin) {
          return 'You are a GLOBAL admin (uber / platform / category_uber). Every cartridge admin tab should be visible to you.';
        }
        if (grants.cartridgeSlugs.length === 0) {
          return 'Active admin role rows exist (step2/step3) but resolved to ZERO cartridge slugs. Likely cause: tenant_id in the role row didn\'t resolve to a slug in crm_tenants, or the tenant slug isn\'t in the TENANT_SLUG_TO_CARTRIDGE_SLUG alias map. Compare step4.tenantRows[].slug to the alias map in services/access/cartridgeAdminGrants.ts.';
        }
        return `Resolver returned ${grants.cartridgeSlugs.length} cartridge slug(s): ${grants.cartridgeSlugs.join(', ')}. If admin tabs still don't render for these, the bug is downstream — check that the codex config\'s adminOfCartridge value matches one of these slugs exactly.`;
      })(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
