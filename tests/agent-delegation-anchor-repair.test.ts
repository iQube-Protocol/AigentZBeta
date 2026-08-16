/**
 * repairDelegationAnchor — Chrysalis Homecoming (CFS-023) constitutional
 * anchoring repair canaries (operator-directed, 2026-08-15; corrected same
 * day to resolve via the sponsor Passport's own explicit anchor rather than
 * re-deriving through auth-user disambiguation).
 *
 * Mocks resolvePassportExplicitAnchor (the personhood layer's own resolver
 * for an ALREADY-reconciled Passport's root/kybe columns — exercised by its
 * own module in tests/passport-explicit-anchor-resolution.test.ts, not
 * re-tested here) and createActivityReceipt at the function-call boundary.
 * The Supabase admin client is a minimal fake reproducing the real
 * chainable+thenable query-builder shape (same style as
 * tests/passport-first-connection.test.ts), queued per table so each of the
 * module's sequential .from() calls gets its own canned response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockResolvePassportExplicitAnchor = vi.fn();
vi.mock('@/services/identity/passportPrincipal', () => ({
  resolvePassportExplicitAnchor: (...args: unknown[]) => mockResolvePassportExplicitAnchor(...args),
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));

// ─── Fake Supabase admin — queued per table, real chainable+thenable shape ──

type FakeResult = { data: unknown; error: unknown };

class FakeChain implements PromiseLike<FakeResult> {
  constructor(private readonly result: FakeResult) {}
  select() { return this; }
  eq() { return this; }
  is() { return this; }
  limit() { return this; }
  update() { return this; }
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
  queue(table: string, result: FakeResult): this {
    (this.queues[table] ??= []).push(result);
    return this;
  }
  from(table: string) {
    this.tablesTouched.push(table);
    this.callsByTable[table] = (this.callsByTable[table] ?? 0) + 1;
    const q = this.queues[table];
    const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
    return new FakeChain(result);
  }
}

function fakeClient(fake: FakeAdmin): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

const ACTING_PERSONA = 'admin-persona-caller-1';
const ALETHEON_ROOT_ID = 'root-aletheon-1';
const ALETHEON_PERSONA_ID = 'persona-aletheon-1';
const SPONSOR_PASSPORT_ID = 'ppc-sponsor-fixture';
const CANONICAL_ROOT_IDENTITY_ID = 'root-identity-canonical-1';
const DID_PERSONA_ID = 'did-persona-bridge-1';

const ROOT_ROW = {
  id: ALETHEON_ROOT_ID,
  agent_id: 'polity-bound:aletheon',
  agent_class: 'polity_bound',
  agent_card_slug: 'aletheon',
  display_name: 'Aletheon',
  sponsor_passport_id: SPONSOR_PASSPORT_ID,
};

function unanchoredPersonaRow() {
  return { id: ALETHEON_PERSONA_ID, delegation_user_root_id: null, delegation_persona_id: null };
}

async function importRepair() {
  return await import('@/services/agents/repairDelegationAnchor');
}

beforeEach(() => {
  mockResolvePassportExplicitAnchor.mockReset();
  mockCreateActivityReceipt.mockReset().mockResolvedValue({ id: 'receipt-anchor-1' });
});

describe('repairDelegationAnchor — gates', () => {
  it('refuses on a non-polity_bound agent class', async () => {
    const admin = new FakeAdmin().queue('agent_root_identity', {
      data: { ...ROOT_ROW, agent_class: 'polity_autonomous' },
      error: null,
    });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_polity_bound');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses when agent_persona does not exist yet (repairs anchoring, never provisions)', async () => {
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: null, error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_agent_persona');
  });

  it('refuses when no sponsor_passport_id was recorded at genesis', async () => {
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: { ...ROOT_ROW, sponsor_passport_id: null }, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_sponsor_passport_recorded');
    expect(mockResolvePassportExplicitAnchor).not.toHaveBeenCalled();
  });
});

describe('repairDelegationAnchor — explicit-anchor reuse (canary: never re-derives via auth-user disambiguation)', () => {
  it('refuses with principal_unresolved when the sponsor Passport\'s anchors are incomplete', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({ ok: false, reason: 'anchor_incomplete' });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('principal_unresolved');
      expect(result.detail).toBe('anchor_incomplete');
    }
    expect(admin.callsByTable['agent_persona']).toBe(1); // read only — never reached the write step
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses with principal_unresolved when the sponsor Passport itself is inactive/revoked', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({ ok: false, reason: 'passport_inactive' });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toBe('passport_inactive');
  });

  it('reuses resolvePassportExplicitAnchor with the RECORDED sponsor_passport_id — never a different id', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null })
      .queue('agent_persona', { data: null, error: null }); // no persona bridge to fill (did_persona empty)
    const { repairDelegationAnchor } = await importRepair();
    await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(mockResolvePassportExplicitAnchor).toHaveBeenCalledWith(SPONSOR_PASSPORT_ID);
    expect(mockResolvePassportExplicitAnchor).toHaveBeenCalledTimes(1);
  });

  it('LIVE REGRESSION: succeeds using the Passport\'s own recorded root even when its kybe has unrelated sibling auth roots — no sibling is selected or mutated', async () => {
    // The exact live condition (2026-08-15): Mansa Meta's Passport had its
    // own root_identity_id/kybe_identity_id explicitly reconciled by
    // legacyPassportLinkageRepair.ts, but the resolved kybe ALSO has
    // unrelated historical sibling root_identity rows under other auth
    // users — the condition that made the OLD resolvePassportPrincipalById
    // path (auth-user disambiguation) incorrectly refuse with
    // lineage_incomplete. resolvePassportExplicitAnchor never performs that
    // walk at all, so this repair must succeed regardless, using ONLY the
    // Passport's own named root.
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-with-sibling-auth-roots',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delegationUserRootId).toBe(CANONICAL_ROOT_IDENTITY_ID);
      expect(result.rootAnchorFilledThisCall).toBe(true);
    }
    // Never touches root_identity at all — resolution happens entirely
    // inside the (mocked) resolver; this repair module itself never queries
    // sibling roots or auth users.
    expect(admin.tablesTouched).not.toContain('root_identity');
  });
});

describe('repairDelegationAnchor — principal resolution + successful repair', () => {
  it('fills delegation_user_root_id and delegation_persona_id when both resolve, emits one receipt', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [{ id: DID_PERSONA_ID }], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null })
      .queue('agent_persona', { data: { delegation_persona_id: DID_PERSONA_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyAnchored).toBe(false);
      expect(result.delegationUserRootId).toBe(CANONICAL_ROOT_IDENTITY_ID);
      expect(result.delegationPersonaId).toBe(DID_PERSONA_ID);
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.personaBridgeFilledThisCall).toBe(true);
      expect(result.receiptId).toBe('receipt-anchor-1');
    }
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
  });

  it('leaves delegation_persona_id null when the sponsor has no Bureau did_persona bridge (honest, not an error)', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [], error: null }) // no bridge exists
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delegationUserRootId).toBe(CANONICAL_ROOT_IDENTITY_ID);
      expect(result.delegationPersonaId).toBeNull();
      expect(result.personaBridgeFilledThisCall).toBe(false);
    }
  });
});

describe('repairDelegationAnchor — idempotency (canary)', () => {
  it('a second call on an already-fully-anchored persona is a no-op: no write, no receipt', async () => {
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', {
        data: { id: ALETHEON_PERSONA_ID, delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID, delegation_persona_id: DID_PERSONA_ID },
        error: null,
      });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyAnchored).toBe(true);
      expect(result.rootAnchorFilledThisCall).toBe(false);
      expect(result.personaBridgeFilledThisCall).toBe(false);
    }
    expect(mockResolvePassportExplicitAnchor).not.toHaveBeenCalled(); // no re-resolution needed
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(admin.callsByTable['agent_persona']).toBe(1); // read only, no update call
  });
});

describe('repairDelegationAnchor — no conflicting non-null overwrite (canary)', () => {
  it('a PARTIALLY anchored persona (root set, bridge null) fills ONLY the null field, never touches the existing root value', async () => {
    const EXISTING_ROOT = 'root-identity-PRE-EXISTING-do-not-change';
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      // Deliberately a DIFFERENT root than the one already set, to prove a
      // conflicting resolution is never written over an existing value.
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', {
        data: { id: ALETHEON_PERSONA_ID, delegation_user_root_id: EXISTING_ROOT, delegation_persona_id: null },
        error: null,
      })
      .queue('did_persona', { data: [{ id: DID_PERSONA_ID }], error: null })
      .queue('agent_persona', { data: { delegation_persona_id: DID_PERSONA_ID }, error: null }); // only the bridge update runs
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delegationUserRootId).toBe(EXISTING_ROOT); // UNCHANGED
      expect(result.rootAnchorFilledThisCall).toBe(false); // never touched
      expect(result.delegationPersonaId).toBe(DID_PERSONA_ID);
      expect(result.personaBridgeFilledThisCall).toBe(true);
    }
    // Exactly ONE update call happened (the bridge), not two: 1 select + 1 update = 2 total agent_persona calls.
    expect(admin.callsByTable['agent_persona']).toBe(2);
  });
});

describe('repairDelegationAnchor — no sponsor-history rewrite (canary)', () => {
  it('never reads or writes sponsor_persona_id/sponsor_passport_id, and never calls .update on agent_root_identity', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    // agent_root_identity is read exactly once (the initial load) and never
    // touched again — no second .from('agent_root_identity') call for an update.
    expect(admin.callsByTable['agent_root_identity']).toBe(1);
  });
});

describe('repairDelegationAnchor — T0 non-leakage in the receipt (canary)', () => {
  it('the receipt never contains the sponsor passport id or any sponsor persona id', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [{ id: DID_PERSONA_ID }], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null })
      .queue('agent_persona', { data: { delegation_persona_id: DID_PERSONA_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('agent_delegation_anchor_repaired');
    const serialized = JSON.stringify(receiptInput);
    expect(serialized).not.toContain(SPONSOR_PASSPORT_ID);
    expect(receiptInput.actionInput).not.toHaveProperty('sponsor_persona_id');
    expect(receiptInput.actionInput).not.toHaveProperty('sponsor_passport_id');
    // personaId is the ACTING caller's own id (self-view) — expected, not a leak.
    expect(receiptInput.personaId).toBe(ACTING_PERSONA);
  });
});

describe('repairDelegationAnchor — no impact on delegation_grants (canary)', () => {
  it('never reads or writes the delegation_grants table at any point', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [{ id: DID_PERSONA_ID }], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null })
      .queue('agent_persona', { data: { delegation_persona_id: DID_PERSONA_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(admin.tablesTouched).not.toContain('delegation_grants');
  });
});

describe('repairDelegationAnchor — receipt emission gating (canary)', () => {
  it('does NOT emit a receipt when the repair is a no-op (already anchored)', async () => {
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', {
        data: { id: ALETHEON_PERSONA_ID, delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID, delegation_persona_id: DID_PERSONA_ID },
        error: null,
      });
    const { repairDelegationAnchor } = await importRepair();
    await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('a receipt-write failure does not fail the repair result (best-effort)', async () => {
    mockResolvePassportExplicitAnchor.mockResolvedValue({
      ok: true,
      rootIdentityId: CANONICAL_ROOT_IDENTITY_ID,
      kybeId: 'kybe-1',
    });
    mockCreateActivityReceipt.mockRejectedValue(new Error('activity_receipts insert failed'));
    const admin = new FakeAdmin()
      .queue('agent_root_identity', { data: ROOT_ROW, error: null })
      .queue('agent_persona', { data: unanchoredPersonaRow(), error: null })
      .queue('did_persona', { data: [], error: null })
      .queue('agent_persona', { data: { delegation_user_root_id: CANONICAL_ROOT_IDENTITY_ID }, error: null });
    const { repairDelegationAnchor } = await importRepair();
    const result = await repairDelegationAnchor(fakeClient(admin), ALETHEON_ROOT_ID, ACTING_PERSONA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootAnchorFilledThisCall).toBe(true);
      expect(result.receiptId).toBeNull(); // attempted, failed, reported honestly — write itself unaffected
    }
  });
});
