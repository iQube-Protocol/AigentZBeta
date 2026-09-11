/**
 * resolveRootPrincipalForAuthUser — the canonical auth_user_id -> root_identity
 * -> kybe_id walk (operator-directed ontology lock, 2026-08-15).
 *
 * KybeDID/RootDID are person-grade, persona-agnostic credentials; personas
 * are contextual bindings BENEATH that spine. This resolver is the ONE
 * production entry point for "given an authenticated session, what is this
 * human's principal" — it must NEVER touch `personas` at all. This file
 * proves that structurally (every fake table access is tracked) and proves
 * the sibling-root disambiguation (never chooses ambiguously).
 *
 * Exercises the real function against a minimal fake Supabase admin client
 * (queued per table, real chainable+thenable shape) — mocks only
 * `getSupabaseServer`, never the function under test.
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

const AUTH_USER_ID = 'auth-user-real-1';
const RESOLVED_KYBE_ID = 'kybe-1';
const RESOLVED_ROOT_IDENTITY_ID = 'root-identity-1';

beforeEach(() => {
  currentAdmin = new FakeAdmin();
});

describe('resolveRootPrincipalForAuthUser — canonical principal-first walk (canary: never touches personas)', () => {
  it('resolves root_identity_id + kybe_id directly from auth_user_id', async () => {
    currentAdmin.queue('root_identity', {
      data: [{ id: RESOLVED_ROOT_IDENTITY_ID, kybe_id: RESOLVED_KYBE_ID }],
      error: null,
    });
    const { resolveRootPrincipalForAuthUser } = await importModule();
    const result = await resolveRootPrincipalForAuthUser(AUTH_USER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootIdentityId).toBe(RESOLVED_ROOT_IDENTITY_ID);
      expect(result.kybeId).toBe(RESOLVED_KYBE_ID);
    }
    // Structural proof: this resolver never queries `personas` at all.
    expect(currentAdmin.tablesTouched).toEqual(['root_identity']);
  });

  it('refuses with lineage_incomplete when the auth user has no root_identity row at all', async () => {
    currentAdmin.queue('root_identity', { data: [], error: null });
    const { resolveRootPrincipalForAuthUser } = await importModule();
    const result = await resolveRootPrincipalForAuthUser(AUTH_USER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('lineage_incomplete');
  });

  it('refuses with lineage_incomplete when the auth user\'s roots span more than one distinct kybe (never chooses)', async () => {
    currentAdmin.queue('root_identity', {
      data: [
        { id: 'root-a', kybe_id: 'kybe-a' },
        { id: 'root-b', kybe_id: 'kybe-b' },
      ],
      error: null,
    });
    const { resolveRootPrincipalForAuthUser } = await importModule();
    const result = await resolveRootPrincipalForAuthUser(AUTH_USER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('lineage_incomplete');
  });

  it('reports unavailable on a query error rather than a false refusal', async () => {
    currentAdmin.queue('root_identity', { data: null, error: { message: 'db down' } });
    const { resolveRootPrincipalForAuthUser } = await importModule();
    const result = await resolveRootPrincipalForAuthUser(AUTH_USER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
  });
});
