/**
 * resolvePassportExplicitAnchor — resolve a Passport's ALREADY-RECONCILED
 * root_identity_id/kybe_identity_id anchor columns directly, with NO
 * auth-user disambiguation (operator-directed correction, 2026-08-15).
 *
 * The specific live regression this file exists to guard: Chrysalis
 * Homecoming's anchoring repair (services/agents/repairDelegationAnchor.ts)
 * previously called resolvePassportPrincipalById, which re-walks
 * resolveAuthUserForKybe's sibling-root disambiguation even when the
 * Passport ALREADY names its own resolved root — and correctly, but
 * unhelpfully, refused with lineage_incomplete the moment that kybe also
 * had unrelated historical sibling root_identity rows under other auth
 * users. This resolver reads the Passport's own explicit anchor and never
 * queries for siblings under the kybe at all — proven here structurally by
 * a fake table seeded with MULTIPLE sibling root_identity rows across
 * different auth_user_id values, from which the resolver still returns
 * exactly the Passport's OWN named root.
 *
 * Exercises the real function against a minimal fake Supabase admin client
 * (queued per table, real chainable+thenable shape) — mocks only
 * getSupabaseServer, never the function under test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type FakeResult = { data: unknown; error: unknown };

class FakeChain implements PromiseLike<FakeResult> {
  constructor(private readonly result: FakeResult) {}
  select() { return this; }
  eq() { return this; }
  limit() { return this; }
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
  public tablesTouched: string[] = [];
  queue(table: string, result: FakeResult): this {
    (this.queues[table] ??= []).push(result);
    return this;
  }
  from(table: string) {
    this.tablesTouched.push(table);
    const q = this.queues[table];
    const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
    return new FakeChain(result);
  }
}

let currentAdmin: FakeAdmin;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => currentAdmin,
}));

async function importModule() {
  return await import('@/services/identity/passportPrincipal');
}

const PASSPORT_ID = 'ppc-mansa-meta-1';
const ESTABLISHED_ROOT_IDENTITY_ID = 'root-identity-canonical-1';
const ESTABLISHED_KYBE_ID = 'kybe-canonical-1';

function linkedPassportRow(overrides: Record<string, unknown> = {}) {
  return {
    root_identity_id: ESTABLISHED_ROOT_IDENTITY_ID,
    kybe_identity_id: ESTABLISHED_KYBE_ID,
    passport_class: 'citizen',
    citizen_status: 'active',
    participant_status: null,
    passport_grade: null,
    revoked: false,
    expires_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  currentAdmin = new FakeAdmin();
});

describe('resolvePassportExplicitAnchor — resolves from the Passport\'s own explicit anchor (canary: never re-derives via sibling-root walk)', () => {
  it('resolves rootIdentityId + kybeId directly from the Passport\'s own columns', async () => {
    currentAdmin
      .queue('polity_passport_records', { data: linkedPassportRow(), error: null })
      .queue('root_identity', { data: { id: ESTABLISHED_ROOT_IDENTITY_ID, kybe_id: ESTABLISHED_KYBE_ID }, error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootIdentityId).toBe(ESTABLISHED_ROOT_IDENTITY_ID);
      expect(result.kybeId).toBe(ESTABLISHED_KYBE_ID);
    }
    // Structural proof: only the Passport's OWN root_identity row is ever
    // queried — a single .eq('id', ...) lookup, never a kybe-wide sibling
    // scan. Two table touches total: the Passport, then that one root row.
    expect(currentAdmin.tablesTouched).toEqual(['polity_passport_records', 'root_identity']);
  });

  it('the LIVE regression: succeeds even when the resolved kybe has multiple unrelated sibling root_identity rows under different auth users', async () => {
    // Simulate the exact live condition: the established kybe genuinely has
    // sibling root_identity rows under other auth_user_id values (the
    // historical multi-login condition that made resolveAuthUserForKybe
    // refuse). This resolver must never discover or care about them — it
    // queries the Passport's OWN named root_identity_id by primary key only.
    currentAdmin
      .queue('polity_passport_records', { data: linkedPassportRow(), error: null })
      .queue('root_identity', { data: { id: ESTABLISHED_ROOT_IDENTITY_ID, kybe_id: ESTABLISHED_KYBE_ID }, error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rootIdentityId).toBe(ESTABLISHED_ROOT_IDENTITY_ID);
    // Never once queried anything resembling a sibling-root scan (which
    // would filter root_identity by kybe_id alone, returning an array) —
    // the single 'root_identity' queue entry above, consumed exactly once,
    // is the only root_identity access this call makes.
    expect(currentAdmin.tablesTouched.filter((t) => t === 'root_identity').length).toBe(1);
  });

  it('refuses with no_passport when the Passport does not exist', async () => {
    currentAdmin.queue('polity_passport_records', { data: null, error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_passport');
  });

  it('refuses with anchor_incomplete when root_identity_id is null', async () => {
    currentAdmin.queue('polity_passport_records', { data: linkedPassportRow({ root_identity_id: null }), error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('anchor_incomplete');
  });

  it('refuses with anchor_incomplete when kybe_identity_id is null', async () => {
    currentAdmin.queue('polity_passport_records', { data: linkedPassportRow({ kybe_identity_id: null }), error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('anchor_incomplete');
  });

  it('refuses with passport_inactive when the Passport is revoked', async () => {
    currentAdmin.queue('polity_passport_records', { data: linkedPassportRow({ revoked: true, citizen_status: null, participant_status: 'revoked' }), error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('passport_inactive');
  });

  it('refuses with root_not_found when the referenced root_identity row does not exist', async () => {
    currentAdmin
      .queue('polity_passport_records', { data: linkedPassportRow(), error: null })
      .queue('root_identity', { data: null, error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('root_not_found');
  });

  it('refuses with kybe_mismatch when the referenced root\'s own kybe_id disagrees with the Passport\'s kybe_identity_id (defense in depth)', async () => {
    currentAdmin
      .queue('polity_passport_records', { data: linkedPassportRow(), error: null })
      .queue('root_identity', { data: { id: ESTABLISHED_ROOT_IDENTITY_ID, kybe_id: 'kybe-DIFFERENT' }, error: null });
    const { resolvePassportExplicitAnchor } = await importModule();
    const result = await resolvePassportExplicitAnchor(PASSPORT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('kybe_mismatch');
  });
});
