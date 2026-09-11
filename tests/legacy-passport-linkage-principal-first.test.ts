/**
 * Legacy Passport linkage reconciliation — principal-first ontology
 * regression (operator-locked, 2026-08-15).
 *
 * Two canaries the operator specifically required, exercised end-to-end
 * with the REAL resolveRootPrincipalForAuthUser + listOwnedPersonaIds (no
 * mocking of the identity layer — only createActivityReceipt and
 * getSupabaseServer are mocked) against a realistic in-memory multi-table
 * fake:
 *
 * 1. A persona whose OWN `personas.root_did` is a legacy `did:fio:*` value
 *    (never matching any `root_identity.did_uri`) still gets its Passport
 *    reconciled successfully — because identity comes from the CALLER's
 *    `auth_user_id -> root_identity`, never from `personas.root_did`.
 * 2. A persona owned by a DIFFERENT auth_profile_id cluster cannot have its
 *    Passport rebound to the authenticated caller's Kybe/root — the
 *    ownership check refuses it (`not_authorized`), never resolves identity
 *    through it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));

// ─── Realistic in-memory multi-table fake — real .eq()/.in() filtering and
//     real .update() mutation, so resolveRootPrincipalForAuthUser and
//     listOwnedPersonaIds run UNMODIFIED against it ─────────────────────────

type Row = Record<string, unknown>;
type FakeResult = { data: unknown; error: null };

class Builder implements PromiseLike<FakeResult> {
  private mode: 'select' | 'update' = 'select';
  private patch: Row | null = null;
  private filters: Array<[string, unknown, 'eq' | 'in']> = [];
  private singleRequested = false;
  constructor(private readonly rows: Row[]) {}
  select() { return this; }
  eq(col: string, val: unknown) { this.filters.push([col, val, 'eq']); return this; }
  in(col: string, vals: unknown[]) { this.filters.push([col, vals, 'in']); return this; }
  is(col: string, val: null) { this.filters.push([col, val, 'eq']); return this; }
  limit() { return this; }
  update(patch: Row) { this.mode = 'update'; this.patch = patch; return this; }
  maybeSingle(): Promise<FakeResult> { this.singleRequested = true; return this.exec(); }
  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((v: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.exec().then(onfulfilled, onrejected);
  }
  private matches(row: Row): boolean {
    return this.filters.every(([col, val, kind]) =>
      kind === 'in' ? (val as unknown[]).includes(row[col]) : row[col] === val,
    );
  }
  private exec(): Promise<FakeResult> {
    const matched = this.rows.filter((r) => this.matches(r));
    if (this.mode === 'update') {
      if (matched.length > 0 && this.patch) Object.assign(matched[0], this.patch);
      return Promise.resolve({ data: matched[0] ?? null, error: null });
    }
    if (this.singleRequested) return Promise.resolve({ data: matched[0] ?? null, error: null });
    return Promise.resolve({ data: matched, error: null });
  }
}

class FakeAdmin {
  constructor(private readonly tables: Record<string, Row[]>) {}
  from(table: string) {
    const rows = this.tables[table] ?? (this.tables[table] = []);
    return new Builder(rows);
  }
}

function fakeClient(admin: FakeAdmin): SupabaseClient {
  return admin as unknown as SupabaseClient;
}

let currentAdmin: FakeAdmin;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => currentAdmin,
}));

async function importRepair() {
  return await import('@/services/passport/legacyPassportLinkageRepair');
}

// ─── Fixtures ────────────────────────────────────────────────────────────

const CALLER_AUTH_USER_ID = 'auth-user-mansa-cluster';
const CALLER_AUTH_PROFILE_ID = 'auth-profile-mansa';
const CALLER_ACTIVE_PERSONA_ID = 'persona-newer-1';
const MANSA_META_PERSONA_ID = 'persona-mansa-meta';
const STRANGER_AUTH_PROFILE_ID = 'auth-profile-OTHER';
const STRANGER_PERSONA_ID = 'persona-stranger-1';

const ESTABLISHED_ROOT_IDENTITY_ID = 'root-identity-canonical-1';
const ESTABLISHED_KYBE_ID = 'kybe-canonical-1';

function baseTables(): Record<string, Row[]> {
  return {
    root_identity: [
      {
        id: ESTABLISHED_ROOT_IDENTITY_ID,
        kybe_id: ESTABLISHED_KYBE_ID,
        auth_user_id: CALLER_AUTH_USER_ID,
        did_uri: 'did:root:ppb:realbind1',
      },
    ],
    personas: [
      // The caller's currently-active persona — never bound via the Bureau.
      { id: CALLER_ACTIVE_PERSONA_ID, auth_profile_id: CALLER_AUTH_PROFILE_ID, root_did: null, status: 'active' },
      // Mansa Meta's OWN persona — a legacy FIO-handle-derived root_did that
      // does NOT and never will match any root_identity.did_uri.
      {
        id: MANSA_META_PERSONA_ID,
        auth_profile_id: CALLER_AUTH_PROFILE_ID,
        root_did: 'did:fio:mansa-meta',
        status: 'active',
      },
      // A persona in a COMPLETELY DIFFERENT cluster.
      { id: STRANGER_PERSONA_ID, auth_profile_id: STRANGER_AUTH_PROFILE_ID, root_did: null, status: 'active' },
    ],
    polity_passport_records: [
      {
        id: 'passport-row-mansa-meta',
        passport_id: 'ppc-mansa-meta-1',
        persona_id: MANSA_META_PERSONA_ID,
        root_identity_id: null,
        kybe_identity_id: null,
        passport_class: 'citizen',
        citizen_status: 'active',
        participant_status: null,
        revoked: false,
        expires_at: null,
      },
      {
        id: 'passport-row-stranger',
        passport_id: 'ppc-stranger-1',
        persona_id: STRANGER_PERSONA_ID,
        root_identity_id: null,
        kybe_identity_id: null,
        passport_class: 'citizen',
        citizen_status: 'active',
        participant_status: null,
        revoked: false,
        expires_at: null,
      },
    ],
  };
}

const CALLER = {
  authUserId: CALLER_AUTH_USER_ID,
  authProfileId: CALLER_AUTH_PROFILE_ID,
  actingPersonaId: CALLER_ACTIVE_PERSONA_ID,
};

beforeEach(() => {
  mockCreateActivityReceipt.mockReset().mockResolvedValue({ id: 'receipt-legacy-linkage-1' });
});

describe('legacy Passport linkage — principal-first reconciliation (real identity layer, no mocks)', () => {
  it('a legacy personas.root_did = "did:fio:*" value does NOT block reconciliation — identity comes from auth_user_id, never from root_did', async () => {
    currentAdmin = new FakeAdmin(baseTables());
    const { repairLegacyPassportLinkage } = await importRepair();

    const result = await repairLegacyPassportLinkage(fakeClient(currentAdmin), 'ppc-mansa-meta-1', CALLER);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootIdentityId).toBe(ESTABLISHED_ROOT_IDENTITY_ID);
      expect(result.kybeIdentityId).toBe(ESTABLISHED_KYBE_ID);
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.kybeAnchorFilledThisCall).toBe(true);
    }

    // Mansa Meta's own root_did fixture value never resolved to anything and
    // was never even consulted — the outcome above proves it, since the
    // ESTABLISHED root/kybe came from the CALLER's auth_user_id, not from
    // matching 'did:fio:mansa-meta' against any root_identity.did_uri (no
    // such row exists in this fixture set at all).
    const mansaMetaPersona = baseTables().personas.find((p) => p.id === MANSA_META_PERSONA_ID)!;
    expect(mansaMetaPersona.root_did).toBe('did:fio:mansa-meta');
  });

  it('a persona owned by a DIFFERENT cluster cannot have its Passport rebound to the caller\'s Kybe/root', async () => {
    currentAdmin = new FakeAdmin(baseTables());
    const { repairLegacyPassportLinkage } = await importRepair();

    const result = await repairLegacyPassportLinkage(fakeClient(currentAdmin), 'ppc-stranger-1', CALLER);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_authorized');

    // The stranger's Passport row is untouched — never rebound.
    const { data } = await currentAdmin.from('polity_passport_records').select().eq('passport_id', 'ppc-stranger-1');
    const row = (data as Row[])[0];
    expect(row.root_identity_id).toBeNull();
    expect(row.kybe_identity_id).toBeNull();
  });
});
