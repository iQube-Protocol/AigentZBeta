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
    eq: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return { from: vi.fn(() => builder) } as any;
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
