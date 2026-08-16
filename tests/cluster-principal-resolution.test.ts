/**
 * resolveClusterPrincipalForPersona — persona-cluster principal resolution
 * canaries (operator-directed, 2026-08-15).
 *
 * The specific regression this file exists to guard: a persona cluster
 * (personas sharing one `auth_profile_id`) must resolve its established
 * root/kybe via an EXISTING cluster-mate's `root_did` matching
 * `root_identity.did_uri` — the SAME walk
 * `bureauIdentityService.ts::lookupExistingBinding` already performs for a
 * single persona — and must NEVER assume
 * `root_identity.auth_user_id == personas.auth_profile_id`. Live evidence in
 * this deployment disproves that equality (they are different identity
 * layers), so every fixture below deliberately gives the cluster's
 * `auth_profile_id` and the resolved `auth_user_id` different, unrelated
 * values, and asserts the function still resolves correctly despite that.
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
  queue(table: string, result: FakeResult): this {
    (this.queues[table] ??= []).push(result);
    return this;
  }
  from(table: string) {
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

const TARGET_PERSONA_ID = 'persona-newer-1';
// Deliberately unrelated to the resolved auth_user_id below — proves the
// resolution never treats these as the same identifier.
const AUTH_PROFILE_ID = 'auth-profile-cluster-X';
const RESOLVED_AUTH_USER_ID = 'auth-user-real-1';
const RESOLVED_KYBE_ID = 'kybe-shared-1';
const RESOLVED_ROOT_IDENTITY_ID = 'root-identity-canonical-1';

beforeEach(() => {
  currentAdmin = new FakeAdmin();
});

describe('resolveClusterPrincipalForPersona — cluster-mate resolution (canary: never auth_user_id == auth_profile_id)', () => {
  it('resolves via an EXISTING cluster-mate\'s root_did when the target persona itself has none', async () => {
    currentAdmin
      .queue('personas', { data: { auth_profile_id: AUTH_PROFILE_ID }, error: null })
      .queue('personas', {
        data: [
          { root_did: null }, // the target persona itself — never bound directly
          { root_did: 'did:polity:root:mansa-meta-1' }, // an established cluster-mate
        ],
        error: null,
      })
      .queue('root_identity', { data: { kybe_id: RESOLVED_KYBE_ID }, error: null }) // did_uri walk
      .queue('root_identity', { data: [{ auth_user_id: RESOLVED_AUTH_USER_ID }], error: null }) // sibling-root walk
      .queue('root_identity', { data: { id: RESOLVED_ROOT_IDENTITY_ID }, error: null }); // canonical root

    const { resolveClusterPrincipalForPersona } = await importModule();
    const result = await resolveClusterPrincipalForPersona(TARGET_PERSONA_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rootIdentityId).toBe(RESOLVED_ROOT_IDENTITY_ID);
      expect(result.kybeId).toBe(RESOLVED_KYBE_ID);
    }
    // The defining regression check: the resolved auth user is NOT the
    // cluster key, and the function never asserted they were equal.
    expect(RESOLVED_AUTH_USER_ID).not.toBe(AUTH_PROFILE_ID);
  });

  it('refuses with cluster_principal_unresolved when no persona in the cluster has ever been found', async () => {
    currentAdmin.queue('personas', { data: null, error: null }); // target persona itself not found
    const { resolveClusterPrincipalForPersona } = await importModule();
    const result = await resolveClusterPrincipalForPersona(TARGET_PERSONA_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cluster_principal_unresolved');
  });

  it('refuses with cluster_principal_unresolved when the cluster holds no root_did at all', async () => {
    currentAdmin
      .queue('personas', { data: { auth_profile_id: AUTH_PROFILE_ID }, error: null })
      .queue('personas', { data: [{ root_did: null }, { root_did: null }], error: null });
    const { resolveClusterPrincipalForPersona } = await importModule();
    const result = await resolveClusterPrincipalForPersona(TARGET_PERSONA_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cluster_principal_unresolved');
  });

  it('refuses with cluster_principal_ambiguous when the cluster spans more than one distinct kybe', async () => {
    currentAdmin
      .queue('personas', { data: { auth_profile_id: AUTH_PROFILE_ID }, error: null })
      .queue('personas', {
        data: [{ root_did: 'did:polity:root:a' }, { root_did: 'did:polity:root:b' }],
        error: null,
      })
      .queue('root_identity', { data: { kybe_id: 'kybe-a' }, error: null })
      .queue('root_identity', { data: { kybe_id: 'kybe-b' }, error: null }); // a DIFFERENT personhood
    const { resolveClusterPrincipalForPersona } = await importModule();
    const result = await resolveClusterPrincipalForPersona(TARGET_PERSONA_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cluster_principal_ambiguous');
  });

  it('refuses with cluster_principal_ambiguous when the resolved kybe itself has sibling roots under more than one auth user (reuses resolveAuthUserForKybe, never a laxer rule)', async () => {
    currentAdmin
      .queue('personas', { data: { auth_profile_id: AUTH_PROFILE_ID }, error: null })
      .queue('personas', { data: [{ root_did: 'did:polity:root:mansa-meta-1' }], error: null })
      .queue('root_identity', { data: { kybe_id: RESOLVED_KYBE_ID }, error: null })
      .queue('root_identity', {
        data: [{ auth_user_id: 'auth-user-1' }, { auth_user_id: 'auth-user-2' }], // ambiguous siblings
        error: null,
      });
    const { resolveClusterPrincipalForPersona } = await importModule();
    const result = await resolveClusterPrincipalForPersona(TARGET_PERSONA_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cluster_principal_ambiguous');
  });
});
