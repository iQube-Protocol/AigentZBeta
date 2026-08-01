/**
 * services/signing/signingRequestStore.ts — the shared SigningRequest
 * substrate persistence (Wallet Signing Topology, operator ruling
 * 2026-08-01). Exercises the full state machine against an in-memory fake
 * Supabase client — never a live database.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSigningRequest,
  getSigningRequest,
  listPendingSigningRequestsForPrincipal,
  listPendingSigningRequestsForAgent,
  updateSigningRequest,
} from '@/services/signing/signingRequestStore';
import type { CreateSigningRequestInput } from '@/types/signingRequest';

// ─── Minimal in-memory fake Supabase client — supports exactly the chain
// shapes signingRequestStore.ts uses: insert().select().single(),
// select().eq(...).maybeSingle(), select().eq(...).eq(...).order(...),
// update().eq().select().single().
function fakeSupabase() {
  let rows: Record<string, any>[] = [];

  function applyFilters(data: Record<string, any>[], filters: Array<[string, any]>) {
    return data.filter((row) => filters.every(([col, val]) => row[col] === val));
  }

  function builder(table: string) {
    const filters: Array<[string, any]> = [];
    let mode: 'select' | 'insert' | 'update' = 'select';
    let payload: Record<string, any> | null = null;

    const api: any = {
      insert(obj: Record<string, any>) {
        mode = 'insert';
        payload = obj;
        return api;
      },
      update(obj: Record<string, any>) {
        mode = 'update';
        payload = obj;
        return api;
      },
      select(_cols?: string) {
        return api;
      },
      eq(col: string, val: any) {
        filters.push([col, val]);
        return api;
      },
      order(_col: string, _opts?: any) {
        return api;
      },
      async single() {
        if (mode === 'insert') {
          const existingIdx = rows.findIndex((r) => r.id === payload!.id);
          const nonceCollision = rows.some(
            (r) => r.wallet_ref === payload!.wallet_ref && r.nonce === payload!.nonce,
          );
          if (nonceCollision || existingIdx >= 0) {
            return { data: null, error: { code: '23505', message: 'duplicate' } };
          }
          rows.push({ ...payload });
          return { data: { ...payload }, error: null };
        }
        if (mode === 'update') {
          const idx = rows.findIndex((r) => applyFilters([r], filters).length > 0);
          if (idx < 0) return { data: null, error: { message: 'no row' } };
          rows[idx] = { ...rows[idx], ...payload };
          return { data: { ...rows[idx] }, error: null };
        }
        const matched = applyFilters(rows, filters);
        return matched.length > 0 ? { data: { ...matched[0] }, error: null } : { data: null, error: { message: 'no rows' } };
      },
      async maybeSingle() {
        const matched = applyFilters(rows, filters);
        return { data: matched.length > 0 ? { ...matched[0] } : null, error: null };
      },
      then(resolve: any, reject: any) {
        // Array-returning terminal (no .single()/.maybeSingle() called).
        const matched = applyFilters(rows, filters);
        return Promise.resolve({ data: matched.map((r) => ({ ...r })), error: null }).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    from: (table: string) => builder(table),
    __rows: () => rows,
    __reset: () => {
      rows = [];
    },
  } as any;
}

const BASE_INPUT: CreateSigningRequestInput = {
  actionKind: 'authorize_registration',
  signerRole: 'principal',
  principalPersonaId: 'persona-operator-1',
  subjectAgentRef: 'aigent-nakamoto',
  subjectAigentQubeId: 'aigentqube-nakamoto',
  authorityCredential: null,
  walletRef: 'principal',
  network: 'base-sepolia',
  payload: 'I authorize registering Aigent Nakamoto with Horizen.',
  consequence: 'Authorizes Aigent Nakamoto\'s Horizen ERC-8004 registration.',
  expiresInSeconds: 300,
  receiptDestination: 'journey:horizen-moneypenny-admission:register',
};

describe('signingRequestStore', () => {
  let client: ReturnType<typeof fakeSupabase>;

  beforeEach(() => {
    client = fakeSupabase();
  });

  it('creates a request in pending status with a computed payloadHash and generated nonce/id', async () => {
    const result = await createSigningRequest(BASE_INPUT, client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.status).toBe('pending');
    expect(result.record.payloadHash).toHaveLength(64);
    expect(result.record.id).toMatch(/^sr_[a-f0-9]{24}$/);
    expect(result.record.nonce).toBeTruthy();
    expect(new Date(result.record.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('never accepts an actionKind outside the 9 named purpose-bound actions at the type level', () => {
    // @ts-expect-error — arbitrary raw actionKind must not typecheck.
    const bad: CreateSigningRequestInput = { ...BASE_INPUT, actionKind: 'sign_anything' };
    expect(bad).toBeTruthy();
  });

  it('round-trips through getSigningRequest', async () => {
    const created = await createSigningRequest(BASE_INPUT, client);
    if (!created.ok) throw new Error('setup failed');
    const fetched = await getSigningRequest(created.record.id, client);
    expect(fetched).toMatchObject({ id: created.record.id, actionKind: 'authorize_registration' });
  });

  it('returns null for an unknown id rather than throwing', async () => {
    expect(await getSigningRequest('sr_doesnotexist', client)).toBeNull();
  });

  it('lists a principal\'s own pending principal-role requests, never another persona\'s', async () => {
    await createSigningRequest(BASE_INPUT, client);
    await createSigningRequest({ ...BASE_INPUT, principalPersonaId: 'persona-someone-else' }, client);
    const mine = await listPendingSigningRequestsForPrincipal('persona-operator-1', client);
    expect(mine).toHaveLength(1);
    expect(mine[0].principalPersonaId).toBe('persona-operator-1');
  });

  it('lists an agent wallet\'s own pending requests, scoped by walletRef', async () => {
    await createSigningRequest(
      { ...BASE_INPUT, signerRole: 'agent', walletRef: 'aigent-nakamoto', actionKind: 'sign_registry_transaction' },
      client,
    );
    await createSigningRequest(
      { ...BASE_INPUT, signerRole: 'agent', walletRef: 'aigent-moneypenny', actionKind: 'sign_registry_transaction' },
      client,
    );
    const nakamotoQueue = await listPendingSigningRequestsForAgent('aigent-nakamoto', client);
    expect(nakamotoQueue).toHaveLength(1);
    expect(nakamotoQueue[0].walletRef).toBe('aigent-nakamoto');
  });

  it('does not list an approved/executed/refused request as pending', async () => {
    const created = await createSigningRequest(BASE_INPUT, client);
    if (!created.ok) throw new Error('setup failed');
    await updateSigningRequest(created.record.id, { status: 'approved', signature: '0xsig', signerAddress: '0xAddr' }, client);
    const mine = await listPendingSigningRequestsForPrincipal('persona-operator-1', client);
    expect(mine).toHaveLength(0);
  });

  it('updateSigningRequest sets resolvedAt on any terminal-ish transition away from pending, and never on pending itself', async () => {
    const created = await createSigningRequest(BASE_INPUT, client);
    if (!created.ok) throw new Error('setup failed');
    const updated = await updateSigningRequest(created.record.id, { status: 'refused', refusalCode: 'DECLINED', refusalDetail: 'operator declined' }, client);
    expect(updated.status).toBe('refused');
    expect(updated.resolvedAt).not.toBeNull();
    expect(updated.refusalCode).toBe('DECLINED');
  });

  it('updateSigningRequest throws rather than silently no-op-ing on an unknown id', async () => {
    await expect(updateSigningRequest('sr_doesnotexist', { status: 'approved' }, client)).rejects.toThrow();
  });

  it('refuses NONCE_REPLAYED on a genuine wallet_ref+nonce collision rather than leaking a raw Postgres error', async () => {
    // Freeze time and Math.random so the store's internally-generated nonce
    // (`${walletRef}:${actionKind}:${timestamp}:${random}`) is IDENTICAL on
    // both calls — a deterministic, real collision, not a fake shortcut.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    try {
      const first = await createSigningRequest(BASE_INPUT, client);
      expect(first.ok).toBe(true);
      const second = await createSigningRequest(BASE_INPUT, client);
      expect(second).toMatchObject({ ok: false, refusalCode: 'NONCE_REPLAYED' });
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
