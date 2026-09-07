/**
 * DiDQube Phase 3, items 1-2 (2026-09-07): Agent Passport atomic
 * binding/issuance. `applyReviewDecision`'s agent-participant approve branch
 * now (a) resolves `agent_card_url` to EXACTLY ONE `agent_root_identity` at
 * issuance time — refusing on missing/ambiguous resolution, fail closed, no
 * exceptions (brief §7) — and (b) issues the passport + binds the RootDID as
 * ONE Postgres transaction via `issue_agent_participant_passport_atomic`
 * (`supabase/migrations/20260930280000_agent_participant_passport_issuance_atomic.sql`),
 * replacing what used to be a sequence of separate client calls plus a
 * SEPARATE, best-effort, non-transactional bind in
 * `services/homecoming/issueDelegatePassport.ts` — the exact gap Phase 0's
 * live inventory found (3 of 10 resolvable, approved applications missing
 * their `bound_passport_id` back-reference).
 *
 * Citizen issuance is untouched by this change (a citizen has no
 * agent_root_identity to bind) — covered separately by
 * `tests/admin-action-centre-citizen-auto-issuance.test.ts` and
 * `tests/passport-bureau.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcCalls: Array<{ fn: string; args: any }> = [];
let agentRootIdentityRows: Array<{ id: string }> = [];
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
        return {
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: agentRootIdentityRows, error: null }),
              // resolveAgentRefsForCard's best-effort receipt-attribution lookup.
              maybeSingle: async () => ({ data: agentRootIdentityRows[0] ? { agent_id: 'aigent-nakamoto' } : null, error: null }),
            }),
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
  agentRootIdentityRows = [{ id: 'agent-root-1' }];
  rpcResult = { data: [{ passport_record_id: 'record-atomic-1', bound: true, already_bound: false }], error: null };
  createActivityReceipt.mockClear();
});

describe('applyReviewDecision — agent Passport atomic issuance (DiDQube Phase 3)', () => {
  it('resolves agent_card_url to exactly one agent_root_identity and issues via the atomic RPC', async () => {
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
    expect(rpcCalls[0].args).toMatchObject({
      p_application_id: 'app-1',
      p_agent_root_identity_id: 'agent-root-1',
      p_actor_type: 'steward',
      p_steward_persona_id: 'steward-1',
    });
  });

  it('REFUSES issuance when agent_card_url resolves to NO agent_root_identity — fails closed, no exceptions', async () => {
    agentRootIdentityRows = [];

    const result = await applyReviewDecision({
      applicationId: 'app-1',
      decision: 'approve',
      stewardPersonaId: 'steward-1',
      participantIssueStatus: 'approved',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('missing');
    expect(rpcCalls).toHaveLength(0);
  });

  it('REFUSES issuance when agent_card_url resolves to MORE THAN ONE agent_root_identity — ambiguous, fails closed', async () => {
    agentRootIdentityRows = [{ id: 'agent-root-1' }, { id: 'agent-root-2' }];

    const result = await applyReviewDecision({
      applicationId: 'app-1',
      decision: 'approve',
      stewardPersonaId: 'steward-1',
      participantIssueStatus: 'approved',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('ambiguous');
    expect(rpcCalls).toHaveLength(0);
  });

  it('surfaces the atomic RPC error rather than silently swallowing a partial failure', async () => {
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
