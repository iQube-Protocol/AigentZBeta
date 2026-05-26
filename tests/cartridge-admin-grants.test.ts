/**
 * cartridgeAdminGrants — canary suite
 *
 * Locks the no-leak guarantee for per-persona admin-cartridge resolution:
 *
 *   1. A persona with no admin rows gets empty grants (never a
 *      "default to global admin" fail-open).
 *   2. A tenant_super_admin gets only the tenant slugs they hold —
 *      not every cartridge in the registry, and not their siblings'
 *      cartridges.
 *   3. A franchise_super_admin fans out to every child tenant of the
 *      franchise — but no foreign franchises.
 *   4. An uber_admin / platform_super_admin / category_uber_admin
 *      sets isGlobalAdmin = true and leaves cartridgeSlugs empty
 *      (callers branch on the global flag — they don't need the
 *      enumerated set when global is true).
 *   5. authProfileId is required — missing input returns empty
 *      grants, never throws, never leaks.
 *
 * Mocked Supabase client only. The view tests stay light because
 * the real resolver is a thin orchestrator over crm_admin_roles +
 * crm_tenants — the SQL surface is integration-tested elsewhere.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getCartridgeAdminGrants } from '@/services/access/cartridgeAdminGrants';

interface MockRow {
  role_type?: string;
  tenant_id?: string | null;
  franchise_id?: string | null;
  slug?: string | null;
  id?: string | null;
}

interface MockQueryStep {
  table: string;
  rows: MockRow[];
}

function mockSupabase(steps: MockQueryStep[]) {
  let stepIdx = 0;
  return {
    from(table: string) {
      const expected = steps[stepIdx];
      if (!expected || expected.table !== table) {
        throw new Error(
          `mockSupabase: unexpected from(${table}) at step ${stepIdx} — expected ${expected?.table}`,
        );
      }
      stepIdx += 1;
      const rows = expected.rows;
      const chain = {
        select: () => chain,
        in: () => chain,
        eq: () => chain,
        then: (resolve: (v: { data: MockRow[]; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      };
      return chain;
    },
  };
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const mockedGetSupabaseServer = vi.mocked(getSupabaseServer);

describe('getCartridgeAdminGrants', () => {
  beforeEach(() => {
    mockedGetSupabaseServer.mockReset();
  });

  it('returns empty grants when authProfileId is missing — never throws, never leaks', async () => {
    const grants = await getCartridgeAdminGrants('', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: [] });
    expect(mockedGetSupabaseServer).not.toHaveBeenCalled();
  });

  it('returns empty grants when the persona has no admin rows — fail-closed', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([{ table: 'crm_admin_roles', rows: [] }]) as unknown as ReturnType<
        typeof getSupabaseServer
      >,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-non-admin', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: [] });
  });

  it('uber_admin → isGlobalAdmin true, cartridgeSlugs empty (caller branches on global)', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [{ role_type: 'uber_admin', tenant_id: null, franchise_id: null }],
        },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-uber', []);
    expect(grants).toEqual({ isGlobalAdmin: true, cartridgeSlugs: [] });
  });

  it('platform_super_admin + category_uber_admin both elevate to global', async () => {
    for (const roleType of ['platform_super_admin', 'category_uber_admin']) {
      mockedGetSupabaseServer.mockReturnValueOnce(
        mockSupabase([
          {
            table: 'crm_admin_roles',
            rows: [{ role_type: roleType, tenant_id: null, franchise_id: null }],
          },
        ]) as unknown as ReturnType<typeof getSupabaseServer>,
      );
      const grants = await getCartridgeAdminGrants(`auth-profile-${roleType}`, []);
      expect(grants.isGlobalAdmin).toBe(true);
      expect(grants.cartridgeSlugs).toEqual([]);
    }
  });

  it('tenant_super_admin returns only the tenant slug — not siblings, not a global elevation', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [
            { role_type: 'tenant_super_admin', tenant_id: 'tenant-knyt', franchise_id: null },
          ],
        },
        // No franchise fan-out step because no franchise_super_admin rows.
        { table: 'crm_tenants', rows: [{ slug: 'knyt-codex' }] },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-knyt-admin', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: ['knyt-codex'] });
  });

  it('franchise_super_admin fans out to child tenants but never to foreign franchises', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [
            {
              role_type: 'franchise_super_admin',
              tenant_id: null,
              franchise_id: 'franchise-21sats',
            },
          ],
        },
        {
          table: 'crm_tenants',
          rows: [{ id: 'tenant-21sats-a' }, { id: 'tenant-21sats-b' }],
        },
        {
          table: 'crm_tenants',
          rows: [{ slug: '21sats-a' }, { slug: '21sats-b' }],
        },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-franchise-admin', []);
    expect(grants.isGlobalAdmin).toBe(false);
    expect(new Set(grants.cartridgeSlugs)).toEqual(new Set(['21sats-a', '21sats-b']));
  });

  it('returns empty grants when getSupabaseServer is unavailable — fail-closed', async () => {
    mockedGetSupabaseServer.mockReturnValue(null as unknown as ReturnType<typeof getSupabaseServer>);
    const grants = await getCartridgeAdminGrants('auth-profile-any', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: [] });
  });
});
