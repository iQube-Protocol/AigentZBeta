/**
 * repairLegacyPassportLinkage — legacy Passport/personhood linkage
 * reconciliation canaries (operator-directed, 2026-08-15).
 *
 * Mocks resolveClusterPrincipalForPersona (the personhood layer's own
 * persona-cluster resolution — exercised by its own module in
 * tests/cluster-principal-resolution.test.ts, not re-tested here) and
 * createActivityReceipt at the function-call boundary. The Supabase admin
 * client is a minimal fake reproducing the real chainable+thenable
 * query-builder shape (same style as
 * tests/agent-delegation-anchor-repair.test.ts), queued per table, with
 * `.update()` payloads captured so tests can assert exactly which columns
 * were ever written.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockResolveClusterPrincipalForPersona = vi.fn();
vi.mock('@/services/identity/passportPrincipal', () => ({
  resolveClusterPrincipalForPersona: (...args: unknown[]) => mockResolveClusterPrincipalForPersona(...args),
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

const ACTING_PERSONA = 'admin-persona-caller-1';
const PASSPORT_ID = 'ppc-mansa-meta-1';
const PASSPORT_RECORD_UUID = 'passport-record-uuid-1';
const PERSONA_ID = 'persona-mansa-meta-1';
const RESOLVED_ROOT_IDENTITY_ID = 'root-identity-canonical-1';
const RESOLVED_KYBE_ID = 'kybe-canonical-1';

function unlinkedPassportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PASSPORT_RECORD_UUID,
    passport_id: PASSPORT_ID,
    persona_id: PERSONA_ID,
    root_identity_id: null,
    kybe_identity_id: null,
    ...overrides,
  };
}

async function importRepair() {
  return await import('@/services/passport/legacyPassportLinkageRepair');
}

beforeEach(() => {
  mockResolveClusterPrincipalForPersona.mockReset();
  mockCreateActivityReceipt.mockReset().mockResolvedValue({ id: 'receipt-legacy-linkage-1' });
});

describe('repairLegacyPassportLinkage — gates', () => {
  it('refuses when the Passport does not exist', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', { data: null, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('passport_not_found');
    expect(mockResolveClusterPrincipalForPersona).not.toHaveBeenCalled();
  });

  it('refuses when the Passport has no persona_id recorded', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ persona_id: null }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_persona_recorded');
    expect(mockResolveClusterPrincipalForPersona).not.toHaveBeenCalled();
  });
});

describe('repairLegacyPassportLinkage — cluster resolution reuse (canary: never a new equality)', () => {
  it('reuses resolveClusterPrincipalForPersona with the Passport\'s OWN recorded persona_id', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({
      ok: true,
      rootIdentityId: RESOLVED_ROOT_IDENTITY_ID,
      kybeId: RESOLVED_KYBE_ID,
    });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: RESOLVED_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: RESOLVED_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(mockResolveClusterPrincipalForPersona).toHaveBeenCalledWith(PERSONA_ID);
    expect(mockResolveClusterPrincipalForPersona).toHaveBeenCalledTimes(1);
  });

  it('refuses with cluster_principal_unresolved when no cluster-mate resolves to any root/kybe', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({ ok: false, reason: 'cluster_principal_unresolved' });
    const admin = new FakeAdmin().queue('polity_passport_records', { data: unlinkedPassportRow(), error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cluster_principal_unresolved');
    expect(admin.updatePayloads.length).toBe(0);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses with cluster_principal_ambiguous when the cluster spans more than one personhood (never chooses)', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({ ok: false, reason: 'cluster_principal_ambiguous' });
    const admin = new FakeAdmin().queue('polity_passport_records', { data: unlinkedPassportRow(), error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cluster_principal_ambiguous');
    expect(admin.updatePayloads.length).toBe(0);
  });
});

describe('repairLegacyPassportLinkage — successful repair', () => {
  it('fills root_identity_id and kybe_identity_id when both resolve, emits one receipt', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({
      ok: true,
      rootIdentityId: RESOLVED_ROOT_IDENTITY_ID,
      kybeId: RESOLVED_KYBE_ID,
    });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: RESOLVED_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: RESOLVED_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyLinked).toBe(false);
      expect(result.rootIdentityId).toBe(RESOLVED_ROOT_IDENTITY_ID);
      expect(result.kybeIdentityId).toBe(RESOLVED_KYBE_ID);
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.kybeAnchorFilledThisCall).toBe(true);
      expect(result.receiptId).toBe('receipt-legacy-linkage-1');
    }
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
  });
});

describe('repairLegacyPassportLinkage — idempotency (canary)', () => {
  it('a second call on an already-fully-linked Passport is a no-op: no write, no receipt', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ root_identity_id: 'r-existing', kybe_identity_id: 'k-existing' }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyLinked).toBe(true);
      expect(result.rootAnchorFilledThisCall).toBe(false);
      expect(result.kybeAnchorFilledThisCall).toBe(false);
    }
    expect(mockResolveClusterPrincipalForPersona).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(admin.callsByTable['polity_passport_records']).toBe(1); // read only, no update call
  });
});

describe('repairLegacyPassportLinkage — no conflicting non-null overwrite (canary)', () => {
  it('a PARTIALLY linked Passport (root set, kybe null) fills ONLY the null field, never touches the existing root value', async () => {
    const EXISTING_ROOT = 'root-identity-PRE-EXISTING-do-not-change';
    mockResolveClusterPrincipalForPersona.mockResolvedValue({
      ok: true,
      // Deliberately a DIFFERENT root than the one already set, to prove a
      // conflicting resolution is never written over an existing value.
      rootIdentityId: RESOLVED_ROOT_IDENTITY_ID,
      kybeId: RESOLVED_KYBE_ID,
    });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow({ root_identity_id: EXISTING_ROOT }), error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: RESOLVED_KYBE_ID }, error: null }); // only the kybe update runs
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootIdentityId).toBe(EXISTING_ROOT); // UNCHANGED
      expect(result.rootAnchorFilledThisCall).toBe(false); // never touched
      expect(result.kybeIdentityId).toBe(RESOLVED_KYBE_ID);
      expect(result.kybeAnchorFilledThisCall).toBe(true);
    }
    // Exactly ONE update call happened (the kybe column), not two.
    expect(admin.updatePayloads.length).toBe(1);
    expect(admin.updatePayloads[0]).toEqual({ table: 'polity_passport_records', kybe_identity_id: RESOLVED_KYBE_ID });
  });
});

describe('repairLegacyPassportLinkage — no status transition, no reissuance (canary)', () => {
  it('every .update() call writes ONLY root_identity_id/kybe_identity_id — never status/persona_id/passport_id/issued_at', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({
      ok: true,
      rootIdentityId: RESOLVED_ROOT_IDENTITY_ID,
      kybeId: RESOLVED_KYBE_ID,
    });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: RESOLVED_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: RESOLVED_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);

    expect(admin.updatePayloads.length).toBe(2);
    for (const payload of admin.updatePayloads) {
      const keys = Object.keys(payload).filter((k) => k !== 'table');
      expect(keys.length).toBe(1);
      expect(['root_identity_id', 'kybe_identity_id']).toContain(keys[0]);
    }
    // No other table (e.g. polity_passport_applications, a reissuance path) was ever touched.
    expect(admin.tablesTouched.every((t) => t === 'polity_passport_records')).toBe(true);
  });
});

describe('repairLegacyPassportLinkage — T0 non-leakage in the receipt (canary)', () => {
  it('the receipt carries only the public passport_id + booleans — never persona/root/kybe ids', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({
      ok: true,
      rootIdentityId: RESOLVED_ROOT_IDENTITY_ID,
      kybeId: RESOLVED_KYBE_ID,
    });
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: RESOLVED_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: RESOLVED_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('legacy_passport_linkage_reconciled');
    expect(receiptInput.actionInput).toEqual({
      passport_record_id: PASSPORT_ID,
      root_anchor_filled_this_call: true,
      kybe_anchor_filled_this_call: true,
    });
    const serialized = JSON.stringify(receiptInput);
    expect(serialized).not.toContain(PERSONA_ID);
    expect(serialized).not.toContain(RESOLVED_ROOT_IDENTITY_ID);
    expect(serialized).not.toContain(RESOLVED_KYBE_ID);
    // personaId is the ACTING caller's own id (self-view) — expected, not a leak.
    expect(receiptInput.personaId).toBe(ACTING_PERSONA);
  });
});

describe('repairLegacyPassportLinkage — receipt emission gating (canary)', () => {
  it('does NOT emit a receipt when the repair is a no-op (already linked)', async () => {
    const admin = new FakeAdmin().queue('polity_passport_records', {
      data: unlinkedPassportRow({ root_identity_id: 'r-existing', kybe_identity_id: 'k-existing' }),
      error: null,
    });
    const { repairLegacyPassportLinkage } = await importRepair();
    await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('a receipt-write failure does not fail the repair result (best-effort)', async () => {
    mockResolveClusterPrincipalForPersona.mockResolvedValue({
      ok: true,
      rootIdentityId: RESOLVED_ROOT_IDENTITY_ID,
      kybeId: RESOLVED_KYBE_ID,
    });
    mockCreateActivityReceipt.mockRejectedValue(new Error('activity_receipts insert failed'));
    const admin = new FakeAdmin()
      .queue('polity_passport_records', { data: unlinkedPassportRow(), error: null })
      .queue('polity_passport_records', { data: { root_identity_id: RESOLVED_ROOT_IDENTITY_ID }, error: null })
      .queue('polity_passport_records', { data: { kybe_identity_id: RESOLVED_KYBE_ID }, error: null });
    const { repairLegacyPassportLinkage } = await importRepair();
    const result = await repairLegacyPassportLinkage(fakeClient(admin), PASSPORT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.receiptId).toBeNull(); // attempted, failed, reported honestly — write itself unaffected
    }
  });
});
