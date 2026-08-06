/**
 * services/horizen/partnerAuthorizationStore.ts — the local persistence step
 * of the Horizen authorization ceremony (GJR-VFY-001 Phase 1).
 *
 * ── THE DEFECT THIS CLOSES (al, 2026-08-04) ─────────────────────────────────
 *
 * Nakamoto's Agent Runtime Endpoint was confirmed live (both /agent-card.json
 * and /health resolved correctly), yet the Pulse authorize ceremony still
 * failed — deeper in the pipeline than the runtime-endpoint check, inside
 * `createPartnerAuthorizationRequest`'s INSERT:
 *
 *   createPartnerAuthorizationRequest failed: Could not find the 'agent_id'
 *   column of 'partner_authorization_requests' in the schema cache
 *
 * Two gaps produced this:
 *   1. `checkAuthorizationStoreAvailable` — the pre-flight probe designed
 *      SPECIFICALLY so a missing-schema problem is caught BEFORE Horizen is
 *      contacted at all — only ever selected `authorization_id`, so it could
 *      never detect that `agent_id`/`wallet_address`/`issued_at`
 *      (20260930001400's columns) were absent. It reported `available: true`
 *      right up until the write that actually needed those columns.
 *   2. `createPartnerAuthorizationRequest` THREW on any non-replay insert
 *      error, which escaped into the route's generic "Nothing here says
 *      whether Horizen recorded the authorization" catch-all — even though
 *      this failure happens strictly before Horizen's state-changing
 *      enable_pulse_monitoring call, so there was never any real uncertainty.
 *
 * Both are fixed here: the probe now selects every column the INSERT writes,
 * and a generic insert failure returns a definite LOCAL_PERSISTENCE_FAILED
 * refusal instead of throwing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkAuthorizationStoreAvailable, createPartnerAuthorizationRequest } from '@/services/horizen/partnerAuthorizationStore';

/** A minimal chainable fake mirroring supabase-js's query-builder shape (thenable at any link in the chain). */
function fakeSupabaseClient(result: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return { from: vi.fn(() => builder) } as any;
}

/**
 * Each independent statement in the retry/resume branch
 * (insert -> getPartnerAuthorizationRequest's select -> the reset update)
 * calls `.from(TABLE)` fresh, so a single shared result can't represent all
 * three. This fake hands back the queued results in call order — one
 * `.from()` invocation, one result off the queue.
 */
function fakeSupabaseClientSequence(results: Array<{ data?: unknown; error?: { code?: string; message?: string; details?: string } | null }>) {
  const queue = [...results];
  return {
    from: vi.fn(() => {
      const result = queue.shift() ?? { data: null, error: null };
      const builder: any = {
        select: () => builder,
        insert: () => builder,
        update: () => builder,
        eq: () => builder,
        limit: () => builder,
        single: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    }),
  } as any;
}

function existingRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = '2026-08-04T00:00:00.000Z';
  return {
    authorization_id: 'horizen-pulse-auth-aigentqube-nakamoto-8798-base-sepolia',
    purpose: 'horizen-financial-transparency',
    subject_aigent_iqube_id: 'aigentqube-nakamoto',
    key_ref: 'aigent-nakamoto',
    partner: 'horizen',
    network: 'base-sepolia',
    payload_hash: null,
    nonce: 'stale-nonce-from-earlier-attempt',
    expires_at: now,
    agent_id: '8798',
    wallet_address: '0xabc',
    issued_at: now,
    state: 'PREPARED',
    signer_address: null,
    signature_ref: null,
    submission_ref: null,
    partner_status: null,
    receipt_ref: null,
    refusal_code: null,
    refusal_detail: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getSupabaseServer).mockReset();
});

describe('checkAuthorizationStoreAvailable', () => {
  it('available when the probe select succeeds', async () => {
    const client = fakeSupabaseClient({ error: null });
    const result = await checkAuthorizationStoreAvailable(client);
    expect(result).toEqual({ available: true });
  });

  it('reports table-absent (unchanged) when the table itself does not exist', async () => {
    const client = fakeSupabaseClient({ error: { code: 'PGRST205', message: "Could not find the table 'public.partner_authorization_requests' in the schema cache" } });
    const result = await checkAuthorizationStoreAvailable(client);
    expect(result).toMatchObject({ available: false, kind: 'table-absent' });
  });

  it('reports columns-absent (the exact live failure, al 2026-08-04) — distinct from table-absent, with the message-facts migration as the remedy', async () => {
    const client = fakeSupabaseClient({
      error: { code: 'PGRST204', message: "Could not find the 'agent_id' column of 'partner_authorization_requests' in the schema cache" },
    });
    const result = await checkAuthorizationStoreAvailable(client);
    expect(result).toMatchObject({ available: false, kind: 'columns-absent' });
    if (!result.available) {
      expect(result.remedy).toContain('20260930001400_partner_authorization_request_message_facts.sql');
      expect(result.remedy).toContain("NOTIFY pgrst, 'reload schema'");
    }
  });

  it('detects a missing column by message text alone when no code is present (defensive — mirrors the table-absent branch\'s same fallback)', async () => {
    const client = fakeSupabaseClient({ error: { message: "Could not find the 'wallet_address' column of 'partner_authorization_requests' in the schema cache" } });
    const result = await checkAuthorizationStoreAvailable(client);
    expect(result).toMatchObject({ available: false, kind: 'columns-absent' });
  });

  it('reports permission-denied distinctly from a schema problem', async () => {
    const client = fakeSupabaseClient({ error: { code: '42501', message: 'permission denied for table partner_authorization_requests' } });
    const result = await checkAuthorizationStoreAvailable(client);
    expect(result).toMatchObject({ available: false, kind: 'permission-denied' });
  });
});

describe('createPartnerAuthorizationRequest', () => {
  const baseInput = {
    authorizationId: 'auth-1',
    purpose: 'horizen-financial-transparency',
    subjectAigentQubeId: 'aigentqube-nakamoto',
    keyRef: 'aigent-nakamoto',
    partner: 'horizen',
    network: 'base-sepolia',
    nonce: 'nonce-1',
    expiresAt: '2026-08-04T00:00:00.000Z',
    agentId: '8798',
    walletAddress: '0xabc',
    issuedAt: '2026-08-04T00:00:00.000Z',
  };

  it('a replayed nonce still returns NONCE_MISSING_OR_REPLAYED (unchanged)', async () => {
    const client = fakeSupabaseClient({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    const result = await createPartnerAuthorizationRequest(baseInput, client);
    expect(result).toMatchObject({ ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED' });
  });

  it('a generic insert failure (schema drift) returns LOCAL_PERSISTENCE_FAILED — NEVER throws (al, 2026-08-04)', async () => {
    const client = fakeSupabaseClient({
      error: { code: 'PGRST204', message: "Could not find the 'agent_id' column of 'partner_authorization_requests' in the schema cache" },
    });
    const result = await createPartnerAuthorizationRequest(baseInput, client);
    expect(result).toEqual({
      ok: false,
      refusalCode: 'LOCAL_PERSISTENCE_FAILED',
      detail: expect.stringContaining('Authorization was not submitted to Horizen because MetaMe could not create its local authorization record'),
    });
  });

  describe('retry for the same deterministic authorizationId (al, 2026-08-04)', () => {
    // authorizationId is `horizen-pulse-auth-<aigentQubeId>-<tokenId>-<network>`
    // — the SAME string on every click of Authorize for a given agent. A
    // PRIMARY KEY collision on it is the expected shape of a retry, not a
    // coincidental nonce reuse — the live symptom was:
    //   nonce "2d701cb15bf275f0c3f7b8bb5ee26004" already used for partner "horizen"
    // reported for a nonce that was generated FRESH that same attempt.
    const pkCollisionError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "partner_authorization_requests_pkey"',
      details: `Key (authorization_id)=(${baseInput.authorizationId}) already exists.`,
    };

    it('a PK collision is NEVER reported as a nonce replay, even though Postgres raises the same 23505 code for both constraints', async () => {
      const client = fakeSupabaseClientSequence([
        { data: null, error: pkCollisionError },
        { data: existingRow({ state: 'REFUSED' }), error: null },
        { data: existingRow({ nonce: baseInput.nonce, state: 'PREPARED' }), error: null },
      ]);
      const result = await createPartnerAuthorizationRequest(baseInput, client);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.record.nonce).toBe(baseInput.nonce);
    });

    it.each(['PREPARED', 'AWAITING_SIGNATURE', 'SIGNED', 'REFUSED', 'EXPIRED', 'QUARANTINED'])(
      'a stalled row in %s state is RESET with this attempt\'s fresh facts and returned as ok:true — Horizen was never confirmed to have this authorization',
      async (state) => {
        const client = fakeSupabaseClientSequence([
          { data: null, error: pkCollisionError },
          { data: existingRow({ state }), error: null },
          { data: existingRow({ nonce: baseInput.nonce, agent_id: baseInput.agentId, state: 'PREPARED' }), error: null },
        ]);
        const result = await createPartnerAuthorizationRequest(baseInput, client);
        expect(result).toMatchObject({ ok: true, record: { state: 'PREPARED', nonce: baseInput.nonce } });
      },
    );

    it.each(['SUBMITTED', 'CONFIRMED'])(
      'a row already %s and RECENT is NEVER reset — refuses with AUTHORIZATION_ALREADY_IN_FLIGHT naming the real state, so a resume can never silently abandon a real submission',
      async (state) => {
        const client = fakeSupabaseClientSequence([
          { data: null, error: pkCollisionError },
          { data: existingRow({ state }), error: null },
        ]);
        // Fixed `nowFn` pinned to the fixture's own issuedAt (age 0) — the
        // staleness comparison is otherwise real-wall-clock and would make
        // this test's outcome depend on how much real time has passed since
        // baseInput.issuedAt was written, which is exactly what broke this
        // test on 2026-08-06 (two days after the fixture's fixed date).
        const result = await createPartnerAuthorizationRequest(baseInput, client, { nowFn: () => new Date(baseInput.issuedAt) });
        expect(result).toMatchObject({ ok: false, refusalCode: 'AUTHORIZATION_ALREADY_IN_FLIGHT', existingState: state });
        // No third `.from()` call — the reset UPDATE must never fire for these states.
        expect(client.from).toHaveBeenCalledTimes(2);
      },
    );

    it('a row already SUBMITTED but STALE (past the Pulse validity window) IS reset — Al\'s audit brief, 2026-08-06: a stale SUBMITTED row cannot still be in flight', async () => {
      const client = fakeSupabaseClientSequence([
        { data: null, error: pkCollisionError },
        { data: existingRow({ state: 'SUBMITTED' }), error: null },
        { data: existingRow({ nonce: baseInput.nonce, agent_id: baseInput.agentId, state: 'PREPARED' }), error: null },
      ]);
      // 10 minutes after the fixture's issuedAt — past the 5-minute default validity window.
      const staleNow = () => new Date(new Date(baseInput.issuedAt).getTime() + 10 * 60 * 1000);
      const result = await createPartnerAuthorizationRequest(baseInput, client, { nowFn: staleNow });
      expect(result).toMatchObject({ ok: true, record: { state: 'PREPARED', nonce: baseInput.nonce } });
      if (result.ok) expect(result.wasReset).toBe(true);
    });

    it('a genuine nonce-constraint collision (not the PK) still returns NONCE_MISSING_OR_REPLAYED, single-step — regression guard', async () => {
      const client = fakeSupabaseClient({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uq_partner_authorization_requests_partner_nonce"',
          details: `Key (partner, nonce)=(horizen, ${baseInput.nonce}) already exists.`,
        },
      });
      const result = await createPartnerAuthorizationRequest(baseInput, client);
      expect(result).toMatchObject({ ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED' });
      // Single .from() call — no existing-row lookup for a genuine nonce collision.
      expect(client.from).toHaveBeenCalledTimes(1);
    });
  });

  it('success returns the mapped record', async () => {
    const now = '2026-08-04T00:00:00.000Z';
    const client = fakeSupabaseClient({
      data: {
        authorization_id: 'auth-1',
        purpose: baseInput.purpose,
        subject_aigent_iqube_id: baseInput.subjectAigentQubeId,
        key_ref: baseInput.keyRef,
        partner: baseInput.partner,
        network: baseInput.network,
        payload_hash: null,
        nonce: baseInput.nonce,
        expires_at: baseInput.expiresAt,
        agent_id: baseInput.agentId,
        wallet_address: baseInput.walletAddress,
        issued_at: baseInput.issuedAt,
        state: 'PREPARED',
        signer_address: null,
        signature_ref: null,
        submission_ref: null,
        partner_status: null,
        receipt_ref: null,
        refusal_code: null,
        refusal_detail: null,
        created_at: now,
        updated_at: now,
      },
      error: null,
    });
    const result = await createPartnerAuthorizationRequest(baseInput, client);
    expect(result).toMatchObject({ ok: true, record: { authorizationId: 'auth-1', agentId: '8798', walletAddress: '0xabc' } });
  });
});
