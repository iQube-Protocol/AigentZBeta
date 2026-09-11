/**
 * DiDQube Phase 3, item 1 (2026-09-07), hardened on closure review.
 * `applyReviewDecision`'s agent-participant approve branch calls
 * `issue_agent_participant_passport_atomic` with ONLY the application id,
 * the minted passport id, and policy inputs (issued status, evidence/
 * receipt type, actor) — every subject/binding field (passport_class,
 * persona/kybe/root refs, and the agent_root_identity resolved from the
 * application's OWN agent_card_url) is now re-derived BY THE RPC ITSELF
 * from the claimed `polity_passport_applications` row, never accepted as a
 * caller-supplied parameter. This file proves the TypeScript call shape and
 * error-surfacing; the RPC's own SQL-level guarantees (grants, concurrency,
 * confused-deputy resolution) are proven against the live Postgres schema
 * in `tests/agent-passport-atomic-issuance-postgres.test.ts` (skipped
 * without live DB credentials) and were verified live against the
 * 'Aigent Z' Supabase project during the closure review — see
 * `codexes/packs/agentiq/updates/2026-09-07_didqube-canonical-resolver-execution-plan.md`.
 *
 * Citizen issuance is untouched by this change (a citizen has no
 * agent_root_identity to bind) — covered separately by
 * `tests/admin-action-centre-citizen-auto-issuance.test.ts` and
 * `tests/passport-bureau.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcCalls: Array<{ fn: string; args: any }> = [];
let rpcResult: { data: any; error: any } = {
  data: [{ passport_record_id: 'record-atomic-1', bound: true, already_bound: false }],
  error: null,
};

const APP_ROW = {
  id: 'app-1',
  application_status: 'pending_approval',
  passport_class: 'agent_participant',
  passport_grade: 'agent_participant',
  persona_id: 'persona-sponsor-1',
  did_persona_id: null,
  kybe_identity_id: null,
  root_identity_id: null,
  persona_public_ref: null,
  kybe_did_public_ref: null,
  root_did_public_ref: null,
  vault_content_id: null,
  vault_content_hash: null,
  agent_card_url: 'https://agents.example.invalid/card/nakamoto',
  world_id_verified_at: null,
};

function fakeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'polity_passport_applications') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: APP_ROW, error: null }) }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'agent_root_identity') {
        // Only reached by resolveAgentRefsForCard's best-effort receipt
        // attribution lookup now — the binding resolution itself moved
        // inside the RPC.
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { agent_id: 'aigent-nakamoto' }, error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table in this test: ${table}`);
    },
    rpc: async (fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      return rpcResult;
    },
  } as any;
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdmin(),
}));

const createActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${Math.random().toString(36).slice(2)}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

vi.mock('@/services/crm/crmDataAccess', () => ({
  getCrmClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  }),
}));

vi.mock('@/services/crm/standingAccrualService', () => ({
  accrueCapabilityStanding: vi.fn(async () => {}),
  computeIdentityDepth: () => 0.5,
}));

import { applyReviewDecision } from '@/services/passport/issuanceService';

beforeEach(() => {
  rpcCalls.length = 0;
  rpcResult = { data: [{ passport_record_id: 'record-atomic-1', bound: true, already_bound: false }], error: null };
  createActivityReceipt.mockClear();
});

describe('applyReviewDecision — agent Passport atomic issuance (DiDQube Phase 3, hardened)', () => {
  it('calls the atomic RPC with ONLY the application id, minted passport id, and policy inputs — no identity/binding data', async () => {
    const result = await applyReviewDecision({
      applicationId: 'app-1',
      decision: 'approve',
      stewardPersonaId: 'steward-1',
      participantIssueStatus: 'approved',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.passportRecordId).toBe('record-atomic-1');
    expect(result.passportId).toBeTruthy();

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('issue_agent_participant_passport_atomic');
    const args = rpcCalls[0].args;
    expect(args).toMatchObject({
      p_application_id: 'app-1',
      p_issued_status: 'approved',
      p_actor_type: 'steward',
      p_steward_persona_id: 'steward-1',
    });
    expect(typeof args.p_passport_id).toBe('string');
    // The hardened signature carries NO identity/binding parameters at all —
    // confused-deputy safety comes from their absence, not a client-side check.
    expect(Object.keys(args).sort()).toEqual(
      ['p_application_id', 'p_passport_id', 'p_issued_status', 'p_actor_type', 'p_steward_persona_id', 'p_notes', 'p_evidence_type', 'p_receipt_action'].sort(),
    );
  });

  it('surfaces the RPC error (e.g. missing/ambiguous agent_root_identity resolution) rather than silently swallowing it', async () => {
    rpcResult = { data: null, error: { message: 'no agent_root_identity resolves for agent_card_url https://agents.example.invalid/card/nakamoto (missing)' } };

    const result = await applyReviewDecision({
      applicationId: 'app-1',
      decision: 'approve',
      stewardPersonaId: 'steward-1',
      participantIssueStatus: 'approved',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('missing');
  });

  it('surfaces a concurrency-claim failure (application already decided or claimed by a concurrent call)', async () => {
    rpcResult = { data: null, error: { message: 'application app-1 is not an open agent_participant application -- already decided, a concurrent issuance won the race, or this is not an agent_participant application' } };

    const result = await applyReviewDecision({
      applicationId: 'app-1',
      decision: 'approve',
      stewardPersonaId: 'steward-1',
      participantIssueStatus: 'approved',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('already decided');
  });

  it('surfaces a generic atomic RPC error rather than silently swallowing a partial failure', async () => {
    rpcResult = { data: null, error: { message: 'simulated transaction failure' } };

    const result = await applyReviewDecision({
      applicationId: 'app-1',
      decision: 'approve',
      stewardPersonaId: 'steward-1',
      participantIssueStatus: 'approved',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('simulated transaction failure');
  });
});
