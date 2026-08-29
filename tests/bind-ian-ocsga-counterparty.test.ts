/**
 * Regression coverage for scripts/bind-ian-ocsga-counterparty.ts's operator
 * identity resolution (2026-08-29 amendment).
 *
 * Live inspection found a real auth profile with `uber_admin` authority
 * that owns MULTIPLE personas with `default_persona_id` NULL — so an email
 * alone cannot determine which persona is acting as operator. These tests
 * prove the resolver never guesses: it requires an EXPLICIT persona id and
 * verifies that persona genuinely belongs to the resolved auth profile,
 * rather than picking "the first" persona or inferring one from email.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../services/access/cartridgeAdminGrants', () => ({
  getCartridgeAdminGrants: vi.fn(),
}));

import { getCartridgeAdminGrants } from '../services/access/cartridgeAdminGrants';

const mockedGetCartridgeAdminGrants = vi.mocked(getCartridgeAdminGrants);

// The script transitively imports services/identity/getActivePersona.ts,
// which eagerly constructs a Supabase client at MODULE-LOAD time
// (services/wallet/multiEmailIdentity.ts) — a pre-existing issue,
// unrelated to this change, that throws in a sandbox with no Supabase env
// configured. A static top-level `import` is hoisted before any code in
// this file can set env vars, so the module under test is loaded via a
// dynamic import inside beforeAll, after dummy (never-dialed) values are
// set — this test never constructs a real network client.
let resolveVerifiedOperatorContext: typeof import('../scripts/bind-ian-ocsga-counterparty').resolveVerifiedOperatorContext;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'dummy-service-role-key-for-tests';
  ({ resolveVerifiedOperatorContext } = await import('../scripts/bind-ian-ocsga-counterparty'));
});

// ─── Minimal fake Supabase client for crm_auth_profiles / personas ────────

type Row = Record<string, unknown>;

function fakeAdmin(tables: { crm_auth_profiles: Row[]; personas: Row[] }): SupabaseClient {
  return {
    from(table: string) {
      const rows = (tables as Record<string, Row[]>)[table] ?? [];
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return builder;
        },
        async maybeSingle() {
          const match = rows.find((r) => filters.every(([col, val]) => r[col] === val));
          return { data: match ?? null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const AUTH_PROFILE_A = 'auth-profile-a';
const AUTH_PROFILE_B = 'auth-profile-b';
const PERSONA_A1 = 'persona-a1'; // owned by auth profile A
const PERSONA_A2 = 'persona-a2'; // ALSO owned by auth profile A — the multi-persona case
const PERSONA_B1 = 'persona-b1'; // owned by a DIFFERENT auth profile

const BASE_TABLES = {
  crm_auth_profiles: [
    { id: AUTH_PROFILE_A, email: 'admin@example.com' },
    { id: AUTH_PROFILE_B, email: 'someone-else@example.com' },
  ],
  personas: [
    { id: PERSONA_A1, auth_profile_id: AUTH_PROFILE_A },
    { id: PERSONA_A2, auth_profile_id: AUTH_PROFILE_A },
    { id: PERSONA_B1, auth_profile_id: AUTH_PROFILE_B },
  ],
};

beforeEach(() => {
  mockedGetCartridgeAdminGrants.mockReset();
});

describe('resolveVerifiedOperatorContext — never guesses an operator persona', () => {
  it('refuses when the auth profile cannot be resolved from the email', async () => {
    const admin = fakeAdmin(BASE_TABLES);
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'nobody@example.com',
      operatorPersonaId: PERSONA_A1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('auth-profile-not-found');
    expect(mockedGetCartridgeAdminGrants).not.toHaveBeenCalled();
  });

  it('refuses when the supplied persona id does not exist', async () => {
    const admin = fakeAdmin(BASE_TABLES);
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'admin@example.com',
      operatorPersonaId: 'persona-does-not-exist',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('persona-not-found');
    expect(mockedGetCartridgeAdminGrants).not.toHaveBeenCalled();
  });

  it('an auth profile with multiple personas: a persona belonging to a DIFFERENT auth profile is rejected, never substituted', async () => {
    mockedGetCartridgeAdminGrants.mockResolvedValue({ isGlobalAdmin: true, cartridgeSlugs: [] });
    const admin = fakeAdmin(BASE_TABLES);

    // admin@example.com owns PERSONA_A1/PERSONA_A2, NOT PERSONA_B1.
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'admin@example.com',
      operatorPersonaId: PERSONA_B1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('persona-belongs-to-different-auth-profile');
    // The admin-grant resolver must never even be consulted once identity
    // fails to bind — authority is meaningless without a verified actor.
    expect(mockedGetCartridgeAdminGrants).not.toHaveBeenCalled();
  });

  it('refuses when the resolved persona and auth profile are both real but the auth profile lacks irl-cartridge/global admin authority', async () => {
    mockedGetCartridgeAdminGrants.mockResolvedValue({ isGlobalAdmin: false, cartridgeSlugs: ['knyt-codex'] });
    const admin = fakeAdmin(BASE_TABLES);
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'admin@example.com',
      operatorPersonaId: PERSONA_A1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-authorized');
  });

  it('an auth profile with multiple personas: explicitly naming PERSONA_A1 resolves to A1, never A2', async () => {
    mockedGetCartridgeAdminGrants.mockResolvedValue({ isGlobalAdmin: false, cartridgeSlugs: ['irl-cartridge'] });
    const admin = fakeAdmin(BASE_TABLES);
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'admin@example.com',
      operatorPersonaId: PERSONA_A1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operatorPersonaId).toBe(PERSONA_A1);
      expect(result.operatorPersonaId).not.toBe(PERSONA_A2);
      expect(result.operatorAuthProfileId).toBe(AUTH_PROFILE_A);
      expect(result.operatorContext.personaId).toBe(PERSONA_A1);
    }
  });

  it('an auth profile with multiple personas: explicitly naming PERSONA_A2 resolves to A2, never A1 — proves no "first persona" default', async () => {
    mockedGetCartridgeAdminGrants.mockResolvedValue({ isGlobalAdmin: false, cartridgeSlugs: ['irl-cartridge'] });
    const admin = fakeAdmin(BASE_TABLES);
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'admin@example.com',
      operatorPersonaId: PERSONA_A2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operatorPersonaId).toBe(PERSONA_A2);
      expect(result.operatorPersonaId).not.toBe(PERSONA_A1);
    }
  });

  it('global admin authority (isGlobalAdmin) is sufficient even with an empty cartridgeSlugs array', async () => {
    mockedGetCartridgeAdminGrants.mockResolvedValue({ isGlobalAdmin: true, cartridgeSlugs: [] });
    const admin = fakeAdmin(BASE_TABLES);
    const result = await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'admin@example.com',
      operatorPersonaId: PERSONA_A1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.operatorContext.cartridgeFlags.isAdmin).toBe(true);
  });

  it('calls the EXISTING getCartridgeAdminGrants resolver with the resolved auth profile id — no parallel admin-check logic', async () => {
    mockedGetCartridgeAdminGrants.mockResolvedValue({ isGlobalAdmin: false, cartridgeSlugs: ['irl-cartridge'] });
    const admin = fakeAdmin(BASE_TABLES);
    await resolveVerifiedOperatorContext(admin, {
      operatorEmail: 'ADMIN@example.com', // exercised case-insensitively
      operatorPersonaId: PERSONA_A1,
    });
    expect(mockedGetCartridgeAdminGrants).toHaveBeenCalledWith(AUTH_PROFILE_A, [], 'admin@example.com');
  });

  it('the operator-persona-id CLI flag is required — the function signature has no optional/omittable persona id', () => {
    // Structural guard: resolveVerifiedOperatorContext's input type has no
    // optional operatorPersonaId, and the CLI usage message requires both
    // flags — an auth profile with multiple personas structurally cannot
    // execute without explicitly naming one.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../scripts/bind-ian-ocsga-counterparty.ts'),
      'utf8',
    );
    expect(source).toContain('operatorPersonaId: string;');
    expect(source).not.toContain('operatorPersonaId?:');
    expect(source).toContain('--operator-persona-id=<uuid>');
    expect(source).toMatch(/if \(!operatorEmail \|\| !operatorPersonaId\)/);
  });
});
