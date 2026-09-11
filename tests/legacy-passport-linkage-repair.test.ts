/**
 * repairLegacyPassportLinkage — principal-first legacy Passport/personhood
 * linkage reconciliation canaries (operator-directed, 2026-08-15; ontology
 * locked same day).
 *
 * Unit-level: mocks resolveRootPrincipalForAuthUser, listOwnedPersonaIds,
 * and createActivityReceipt at the function-call boundary — each is
 * exercised by its own module (resolveRootPrincipalForAuthUser in
 * tests/root-principal-resolution.test.ts; the full principal-first +
 * ownership walk together, with NO mocking, in
 * tests/legacy-passport-linkage-principal-first.test.ts). This file proves
 * the repair's own gating, conflict, idempotency, and receipt logic.
 *
 * The Supabase admin client is a minimal fake reproducing the real
 * chainable+thenable query-builder shape, queued per table, with
 * `.update()` payloads captured for column-write assertions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockResolveRootPrincipalForAuthUser = vi.fn();
const mockListOwnedPersonaIds = vi.fn();
vi.mock('@/services/identity/passportPrincipal', () => ({
  resolveRootPrincipalForAuthUser: (...args: unknown[]) => mockResolveRootPrincipalForAuthUser(...args),
  listOwnedPersonaIds: (...args: unknown[]) => mockListOwnedPersonaIds(...args),
  isPassportUsable: (p: { revoked: boolean; expiresAt: string | null; citizenStatus: string | null; participantStatus: string | null }) => {
    if (p.revoked) return false;
    if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) return false;
    return p.citizenStatus === 'active' || p.participantStatus === 'active';
  },
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));

// ─── Fake Supabase admin — queued per table, real chainable+thenable shape,
//     with .update() payloads captured for column-write assertions ─────────

type FakeResult = { data: unknown; error: unknown };

class FakeChain implements PromiseLike<FakeResult> {
  constructor(
    private readonly result: FakeResult,
    private readonly onUpdate?: (payload: Record<string, unknown>) => void,
  ) {}
  select() { return this; }
  eq() { return this; }
  is() { return this; }
  limit() { return this; }
  update(payload: Record<string, unknown>) {
    this.onUpdate?.(payload);
    return this;
  }
  maybeSingle(): Promise<FakeResult> { return Promise.resolve(this.result); }
  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((v: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class FakeAdmin {
  private queues: Record<string, FakeResult[]> = {};
  public callsByTable: Record<string, number> = {};
  public tablesTouched: string[] = [];
  public updatePayloads: Array<{ table: string } & Record<string, unknown>> = [];
  queue(table: string, result: FakeResult): this {
    (this.queues[table] ??= []).push(result);
    return this;
  }
  from(table: string) {
    this.tablesTouched.push(table);
    this.callsByTable[table] = (this.callsByTable[table] ?? 0) + 1;
    const q = this.queues[table];
    const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
    return new FakeChain(result, (payload) => this.updatePayloads.push({ table, ...payload }));
  }
}

function fakeClient(fake: FakeAdmin): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

const CALLER = {
  authUserId: 'auth-user-caller-1',
  authProfileId: 'auth-profile-caller-1',
  actingPersonaId: 'persona-caller-1',
};
const PASSPORT_ID = 'ppc-mansa-meta-1';
const PASSPORT_RECORD_UUID = 'passport-record-uuid-1';
const PASSPORT_PERSONA_ID = 'persona-mansa-meta-1';
const CALLER_ROOT_IDENTITY_ID = 'root-identity-caller-1';
const CALLER_KYBE_ID = 'kybe-caller-1';

function unlinkedPassportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PASSPORT_RECORD_UUID,
    passport_id: PASSPORT_ID,
    persona_id: PASSPORT_PERSONA_ID,
    root_identity_id: null,
    kybe_identity_id: null,
    passport_class: 'citizen',
    citizen_status: 'active',
    participant_status: null,
    revoked: false,
    expires_at: null,
    ...overrides,
  };
}

async function importRepair() {
  return await import('@/services/passport/legacyPassportLinkageRepair');
}

beforeEach(() => {
  mockResolveRootPrincipalForAuthUser.mockReset();
  mockListOwnedPersonaIds.mockReset();
  mockCreateActivityReceipt.mockReset().mockResolvedValue({ id: 'receipt-legacy-linkage-1' });
});

describe('repairLegacyPassportLinkage — principal resolution gate (never from the target persona)', () => {
  it('fails closed with caller_principal_unresolved when the CALLER\'s own principal cannot be resolved', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: false, reason: 'lineage_incomplete' });
    const admin = new FakeAdmin();
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('caller_principal_unresolved');
      expect(result.detail).toBe('lineage_incomplete');
    }
    // Never even loads the Passport when the caller's own principal fails to resolve.
    expect(admin.tablesTouched.length).toBe(0);
    expect(mockListOwnedPersonaIds).not.toHaveBeenCalled();
  });

  it('resolves the principal from the CALLER\'s auth_user_id — never accepts a caller-supplied root/kybe id', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: CALLER_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: CALLER_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(mockResolveRootPrincipalForAuthUser).toHaveBeenCalledWith(CALLER.authUserId);
    expect(mockResolveRootPrincipalForAuthUser).toHaveBeenCalledTimes(1);
  });
});

describe('repairLegacyPassportLinkage — Passport gates', () => {
  beforeEach(() => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
  });

  it('refuses when the Passport does not exist', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', { data: null, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('passport_not_found');
    expect(mockListOwnedPersonaIds).not.toHaveBeenCalled();
  });

  it('refuses when the Passport is not usable (revoked/expired/inactive)', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ citizen_status: 'expired_non_renewal' }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('passport_not_usable');
  });

  it('refuses when the Passport has no persona_id recorded', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ persona_id: null }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_persona_recorded');
    expect(mockListOwnedPersonaIds).not.toHaveBeenCalled();
  });
});

describe('repairLegacyPassportLinkage — authorization is ownership-only, never identity resolution', () => {
  beforeEach(() => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
  });

  it('refuses with not_authorized when the Passport\'s persona is not in the caller\'s owned set', async () => {
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: ['some-other-persona'] });
    const admin = new FakeAdmin().queue('polity_passport_records', { data: unlinkedPassportRow(), error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_authorized');
    expect(admin.updatePayloads.length).toBe(0);
  });

  it('refuses with not_authorized when listOwnedPersonaIds itself fails', async () => {
    mockListOwnedPersonaIds.mockResolvedValue({ ok: false, reason: 'unavailable' });
    const admin = new FakeAdmin().queue('polity_passport_records', { data: unlinkedPassportRow(), error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_authorized');
  });
});

describe('repairLegacyPassportLinkage — principal conflict (canary: never silently overwrite or ignore)', () => {
  beforeEach(() => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
  });

  it('refuses with principal_conflict when the Passport\'s existing root_identity_id disagrees with the caller\'s resolved principal', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ root_identity_id: 'root-identity-SOMEONE-ELSE' }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('principal_conflict');
      expect(result.detail).toBe('root_identity_id');
    }
    expect(admin.updatePayloads.length).toBe(0);
  });

  it('refuses with principal_conflict when the Passport\'s existing kybe_identity_id disagrees with the caller\'s resolved principal', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ kybe_identity_id: 'kybe-SOMEONE-ELSE' }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('principal_conflict');
      expect(result.detail).toBe('kybe_identity_id');
    }
  });
});

describe('repairLegacyPassportLinkage — successful repair', () => {
  it('fills root_identity_id and kybe_identity_id when both resolve and are authorized, emits one receipt', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: CALLER_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: CALLER_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyLinked).toBe(false);
      expect(result.rootIdentityId).toBe(CALLER_ROOT_IDENTITY_ID);
      expect(result.kybeIdentityId).toBe(CALLER_KYBE_ID);
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.kybeAnchorFilledThisCall).toBe(true);
      expect(result.receiptId).toBe('receipt-legacy-linkage-1');
    }
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
  });
});

describe('repairLegacyPassportLinkage — idempotency (canary)', () => {
  it('a second call on an already-fully-linked (matching) Passport is a no-op: no write, no receipt', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ root_identity_id: CALLER_ROOT_IDENTITY_ID, kybe_identity_id: CALLER_KYBE_ID }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyLinked).toBe(true);
      expect(result.rootAnchorFilledThisCall).toBe(false);
      expect(result.kybeAnchorFilledThisCall).toBe(false);
    }
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(admin.callsByTable['polity_passport_records']).toBe(1); // read only, no update call
  });
});

describe('repairLegacyPassportLinkage — no conflicting non-null overwrite (canary)', () => {
  it('a PARTIALLY linked Passport (root set + matching, kybe null) fills ONLY the null field', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow({ root_identity_id: CALLER_ROOT_IDENTITY_ID }), error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: CALLER_KYBE_ID }, error: null }); // only the kybe update runs
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootIdentityId).toBe(CALLER_ROOT_IDENTITY_ID);
      expect(result.rootAnchorFilledThisCall).toBe(false); // never touched
      expect(result.kybeIdentityId).toBe(CALLER_KYBE_ID);
      expect(result.kybeAnchorFilledThisCall).toBe(true);
    }
    expect(admin.updatePayloads.length).toBe(1);
    expect(admin.updatePayloads[0]).toEqual({ table: 'polity_passport_records', kybe_identity_id: CALLER_KYBE_ID });
  });
});

describe('repairLegacyPassportLinkage — no status transition, no reissuance (canary)', () => {
  it('every .update() call writes ONLY root_identity_id/kybe_identity_id — never status/persona_id/passport_id/issued_at', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: CALLER_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: CALLER_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);

    expect(admin.updatePayloads.length).toBe(2);
    for (const payload of admin.updatePayloads) {
      const keys = Object.keys(payload).filter((k) => k !== 'table');
      expect(keys.length).toBe(1);
      expect(['root_identity_id', 'kybe_identity_id']).toContain(keys[0]);
    }
    expect(admin.tablesTouched.every((t) => t === 'polity_passport_records')).toBe(true);
  });
});

describe('repairLegacyPassportLinkage — T0 non-leakage in the receipt (canary)', () => {
  it('the receipt carries only the public passport_id + booleans — never persona/root/kybe/auth ids', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: CALLER_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: CALLER_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('legacy_passport_linkage_reconciled');
    expect(receiptInput.actionInput).toEqual({
      passport_record_id: PASSPORT_ID,
      root_anchor_filled_this_call: true,
      kybe_anchor_filled_this_call: true,
    });
    const serialized = JSON.stringify(receiptInput);
    expect(serialized).not.toContain(PASSPORT_PERSONA_ID);
    expect(serialized).not.toContain(CALLER_ROOT_IDENTITY_ID);
    expect(serialized).not.toContain(CALLER_KYBE_ID);
    expect(serialized).not.toContain(CALLER.authUserId);
    expect(serialized).not.toContain(CALLER.authProfileId);
    // personaId is the ACTING caller's own id (self-view) — expected, not a leak.
    expect(receiptInput.personaId).toBe(CALLER.actingPersonaId);
  });
});

describe('repairLegacyPassportLinkage — receipt emission gating (canary)', () => {
  it('does NOT emit a receipt when the repair is a no-op (already linked, matching)', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ root_identity_id: CALLER_ROOT_IDENTITY_ID, kybe_identity_id: CALLER_KYBE_ID }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('a receipt-write failure does not fail the repair result (best-effort)', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({
      ok: true,
      rootIdentityId: CALLER_ROOT_IDENTITY_ID,
      kybeId: CALLER_KYBE_ID,
    });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [PASSPORT_PERSONA_ID] });
    mockCreateActivityReceipt.mockRejectedValue(new Error('activity_receipts insert failed'));
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: CALLER_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: CALLER_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, CALLER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.receiptId).toBeNull(); // attempted, failed, reported honestly — write itself unaffected
    }
  });
});
