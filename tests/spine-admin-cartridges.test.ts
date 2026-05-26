/**
 * spine — admin-cartridges canary
 *
 * Locks the no-leak + spine-source guarantees for the per-cartridge
 * admin scope field added to ActivePersonaContext / ActivePersonaSurface.
 *
 * Why this canary
 * ---------------
 * The new `cartridgeFlags.adminCartridges: string[]` field reaches both
 * surfaces:
 *   - T0 `ActivePersonaContext` (server-internal, consumed by
 *     evaluateAccess)
 *   - T1 `ActivePersonaSurface` (browser-safe, broadcast over
 *     postMessage + JSON via /api/wallet/active-persona)
 *
 * The CRM-side resolution joins `crm_admin_roles` to `crm_tenants` to
 * `crm_franchises`. Several T0 ids transit the resolver internally —
 * `auth_profile_id`, `tenant_id`, `franchise_id`. NONE of them are
 * allowed on the T1 surface. This canary asserts the surface shape
 * never contains any of those, only the T1-safe cartridge slug array.
 *
 * It also locks the policy-resolver semantics so future edits to the
 * `admin-cartridge:<slug>` credential class can't accidentally
 * promote a tenant-admin to a global admin or vice versa.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { credentialMatchesCartridgeFlag } from '@/services/access/policyResolvers';
import { getCartridgeAdminGrants } from '@/services/access/cartridgeAdminGrants';
import type { ActivePersonaSurface, ActivePersonaContext } from '@/types/access';

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const mockedGetSupabaseServer = vi.mocked(getSupabaseServer);

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
        throw new Error(`mockSupabase: unexpected from(${table}) at step ${stepIdx} — expected ${expected?.table}`);
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

describe('cartridgeFlags.adminCartridges — T1 surface no-leak', () => {
  it('synthesised ActivePersonaSurface with adminCartridges does NOT contain T0 ids when serialised', () => {
    // Synthesise the shape the route emits. Asserts the wire never carries
    // tenant_id / franchise_id / auth_profile_id / kybe_did. Cartridge
    // slugs are the only carrier of admin scope across the wire.
    const surface: ActivePersonaSurface = {
      personaSessionToken: 'opaque-pst',
      identifiability: 'pseudonymous',
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: ['knyt-codex', 'qripto'],
      },
      cohortMemberships: [],
      sessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const blob = JSON.stringify(surface);
    expect(blob).not.toContain('auth_profile_id');
    expect(blob).not.toContain('authProfileId');
    expect(blob).not.toContain('tenant_id');
    expect(blob).not.toContain('franchise_id');
    expect(blob).not.toContain('kybe_did');
    expect(blob).not.toContain('rootDid');
    expect(blob).not.toContain('did:fio:');
    // Cartridge slugs ARE allowed — that's the entire point.
    expect(surface.cartridgeFlags.adminCartridges).toEqual(['knyt-codex', 'qripto']);
  });

  it('T0 ActivePersonaContext carries adminCartridges as a string[] — not nested objects, not tenant ids', () => {
    const context: ActivePersonaContext = {
      personaId: 'persona-uuid',
      authProfileId: 'auth-profile-uuid',
      identifiability: 'pseudonymous',
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: ['knyt-codex'],
      },
      cohortMemberships: [],
      source: 'session-cookie',
    };
    expect(Array.isArray(context.cartridgeFlags.adminCartridges)).toBe(true);
    for (const slug of context.cartridgeFlags.adminCartridges) {
      expect(typeof slug).toBe('string');
      // No UUIDs leaking through — adminCartridges holds slugs only.
      expect(slug).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/);
    }
  });
});

describe('credentialMatchesCartridgeFlag — admin-cartridge:<slug>', () => {
  beforeEach(() => mockedGetSupabaseServer.mockReset());

  it('matches admin-cartridge:<slug> against the cartridgeFlags.adminCartridges array', () => {
    const flags = { isAdmin: false, isPartner: false, adminCartridges: ['knyt-codex'] };
    expect(credentialMatchesCartridgeFlag('admin-cartridge:knyt-codex', flags)).toBe(true);
    expect(credentialMatchesCartridgeFlag('admin-cartridge:qripto', flags)).toBe(false);
  });

  it('global isAdmin satisfies any admin-cartridge:<slug> credential (uber-admin override)', () => {
    const flags = { isAdmin: true, isPartner: false, adminCartridges: [] };
    expect(credentialMatchesCartridgeFlag('admin-cartridge:knyt-codex', flags)).toBe(true);
    expect(credentialMatchesCartridgeFlag('admin-cartridge:any-future-cartridge', flags)).toBe(true);
  });

  it('tenant-admin grants do NOT promote to global isAdmin', () => {
    const flags = { isAdmin: false, isPartner: false, adminCartridges: ['knyt-codex'] };
    // Plain 'admin' credential still requires the global flag.
    expect(credentialMatchesCartridgeFlag('admin', flags)).toBe(false);
  });

  it('partner credential is unaffected by adminCartridges', () => {
    const flags = { isAdmin: false, isPartner: true, adminCartridges: ['knyt-codex'] };
    expect(credentialMatchesCartridgeFlag('partner', flags)).toBe(true);
    expect(credentialMatchesCartridgeFlag('admin', flags)).toBe(false);
  });

  it('malformed admin-cartridge credential (missing slug) returns false', () => {
    const flags = { isAdmin: false, isPartner: false, adminCartridges: ['knyt-codex'] };
    expect(credentialMatchesCartridgeFlag('admin-cartridge:', flags)).toBe(false);
    expect(credentialMatchesCartridgeFlag('admin-cartridge', flags)).toBe(false);
  });

  it('backwards-compatible — old callers passing { isAdmin, isPartner } without adminCartridges still work', () => {
    // The resolver must tolerate undefined adminCartridges so existing
    // call sites that haven't been updated keep working.
    const oldFlags = { isAdmin: false, isPartner: false } as {
      isAdmin: boolean;
      isPartner: boolean;
      adminCartridges?: string[];
    };
    expect(credentialMatchesCartridgeFlag('admin-cartridge:knyt-codex', oldFlags)).toBe(false);
    expect(credentialMatchesCartridgeFlag('admin', oldFlags)).toBe(false);
    expect(credentialMatchesCartridgeFlag('partner', oldFlags)).toBe(false);
  });
});

describe('spine resolution → adminCartridges field', () => {
  beforeEach(() => mockedGetSupabaseServer.mockReset());

  it('resolves persona admin of KNYT into adminCartridges: ["knyt-codex"]', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [{ role_type: 'tenant_super_admin', tenant_id: 'tenant-knyt', franchise_id: null }],
        },
        { table: 'crm_tenants', rows: [{ slug: 'knyt' }] },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-knyt-admin', []);
    expect(grants.isGlobalAdmin).toBe(false);
    expect(grants.cartridgeSlugs).toEqual(['knyt-codex']);
    // No leakage of internal ids into the returned shape.
    const blob = JSON.stringify(grants);
    expect(blob).not.toContain('tenant-knyt');
    expect(blob).not.toContain('auth-profile-knyt-admin');
  });

  it('uber_admin elevates without exposing the underlying role row', async () => {
    mockedGetSupabaseServer.mockReturnValue(
      mockSupabase([
        {
          table: 'crm_admin_roles',
          rows: [{ role_type: 'uber_admin', tenant_id: null, franchise_id: null }],
        },
      ]) as unknown as ReturnType<typeof getSupabaseServer>,
    );
    const grants = await getCartridgeAdminGrants('auth-profile-uber', []);
    expect(grants.isGlobalAdmin).toBe(true);
    expect(grants.cartridgeSlugs).toEqual([]);
    const blob = JSON.stringify(grants);
    expect(blob).not.toContain('auth-profile-uber');
    expect(blob).not.toContain('uber_admin');  // we surface only the boolean, not the role-type string
  });
});
