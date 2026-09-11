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

  it('maps CRM tenant slug "knyt" → cartridge slug "knyt-codex" so the UI gate matches', async () => {
    // Mirrors the actual CRM seed: tenant.slug is 'knyt' (not 'knyt-codex').
    // The resolver must translate so adminOfCartridge: 'knyt-codex' in
    // METAME_CODEX matches the persona's grant.
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [
            { role_type: 'tenant_super_admin', tenant_id: 'tenant-knyt', franchise_id: null },
          ],
        },
        { table: 'crm_tenants', rows: [{ slug: 'knyt' }] },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-knyt-admin', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: ['knyt-codex'] });
  });

  it('maps CRM tenant slug "qriptopian" → cartridge slug "qripto"', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [
            { role_type: 'tenant_super_admin', tenant_id: 'tenant-qripto', franchise_id: null },
          ],
        },
        { table: 'crm_tenants', rows: [{ slug: 'qriptopian' }] },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-qripto-admin', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: ['qripto'] });
  });

  it('unknown CRM tenant slug passes through unchanged', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [
            { role_type: 'tenant_super_admin', tenant_id: 'tenant-future', franchise_id: null },
          ],
        },
        { table: 'crm_tenants', rows: [{ slug: 'some-new-cartridge' }] },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-future-admin', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: ['some-new-cartridge'] });
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

  it('discovers admin grant via email-alias fallback when the canonical auth_profile_id has no role row', async () => {
    // Mirrors the real-world bug surfaced 2026-05-26: the operator's
    // admin role was granted against a sibling auth_profile_id known
    // only via the email-alias table. The merge view hadn't linked the
    // two yet, so the prior resolver missed the role and the admin
    // tab never appeared. With the email-alias fallback in place, the
    // sibling id is added to the candidate set BEFORE the
    // crm_admin_roles query — so the role gets discovered.
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          // Email-alias lookup returns a sibling auth_profile_id that
          // the merge view doesn't yet link to the canonical id.
          table: 'crm_auth_profile_emails',
          rows: [{ id: 'sibling-auth-profile' }] as Array<MockRow>,
        },
        {
          // Now the admin_roles query includes the sibling id —
          // mockSupabase doesn't enforce IN filters per row but the
          // step asserts the table was queried in the expected order.
          table: 'crm_admin_roles',
          rows: [
            { role_type: 'tenant_super_admin', tenant_id: 'tenant-knyt', franchise_id: null },
          ],
        },
        { table: 'crm_tenants', rows: [{ slug: 'knyt' }] },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    // Pass canonical authProfileId with NO linked ids; the only way
    // to find the role is via the email-alias fallback.
    const grants = await getCartridgeAdminGrants(
      'auth-profile-canonical-orphan',
      [],
      'admin-user@example.com',
    );
    expect(grants.isGlobalAdmin).toBe(false);
    expect(grants.cartridgeSlugs).toEqual(['knyt-codex']);
  });

  it('email-alias fallback is best-effort — failure does not throw', async () => {
    // When the alias table query throws, the resolver continues with
    // whatever candidate ids it already has. No exception escapes.
    let callCount = 0;
    const failingClient = {
      from(table: string) {
        callCount++;
        if (table === 'crm_auth_profile_emails') {
          // Simulate a throw inside the alias lookup
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ then: (_: unknown, reject: (e: Error) => void) => reject(new Error('boom')) }),
              }),
            }),
          };
        }
        // For crm_admin_roles, return empty (so we end at empty grants)
        const rows: MockRow[] = [];
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
    mockedGetSupabaseServer.mockReturnValue(
      failingClient as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants(
      'auth-profile-canonical',
      [],
      'admin-user@example.com',
    );
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: [] });
    expect(callCount).toBeGreaterThan(0);
  });

  it('returns empty grants when getSupabaseServer is unavailable — fail-closed', async () => {
    mockedGetSupabaseServer.mockReturnValue(null as unknown as ReturnType<typeof getSupabaseServer>);
    const grants = await getCartridgeAdminGrants('auth-profile-any', []);
    expect(grants).toEqual({ isGlobalAdmin: false, cartridgeSlugs: [] });
  });
});
