/**
 * `accrueStanding` — Standing receipt attribution (2026-08-23 operator
 * directive, "Horizen Journey — Standing observer + DVN liveness closure",
 * part 1).
 *
 * THE DEFECT: every `standing_accrued` receipt was written with
 * `agentsInvoked: ['aigent-z']` regardless of which agent's Standing was
 * actually credited, so `resolveStandingEvidence(runtimeAgentId)` — which
 * resolves evidence by `agents_invoked` containment — could never find
 * genuine per-agent accrual under its own agent.
 *
 * THE FIX: `AccrueStandingInput.subjectAgentRef` — when supplied, the
 * receipt's `agentsInvoked` carries ONLY that id (never the orchestrator),
 * and `orchestratorAgentRef` (if any) is recorded separately in
 * `actionInput`, never substituted for the subject. Omitting
 * `subjectAgentRef` preserves the historical `['aigent-z']` default
 * unchanged, for every existing non-agent-scoped caller.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

const mockSyncStandingToRQH = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/crm/taskCanisterService', () => ({
  syncStandingToRQH: (...args: any[]) => mockSyncStandingToRQH(...args),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

interface ReputationRow {
  persona_id: string;
  standing_personal: number;
  standing_delegated: number;
  standing_stewardship: number;
  standing_capability: number;
  standing_overall: number;
}

const CRM_PERSONA_ID = 'crm-persona-1';
const IDENTITY_PERSONA_ID = 'identity-persona-1';

let reputationRows: ReputationRow[];
let crmPersonaRows: Array<{ id: string; identity_persona_id: string }>;

function makeFakeCrmClient() {
  return {
    from(table: string) {
      if (table === 'crm_persona_reputation') {
        return {
          select() {
            return {
              eq(_col: string, val: string) {
                return { maybeSingle: async () => ({ data: reputationRows.find((r) => r.persona_id === val) ?? null }) };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(_col: string, val: string) {
                const idx = reputationRows.findIndex((r) => r.persona_id === val);
                if (idx >= 0) reputationRows[idx] = { ...reputationRows[idx], ...(patch as any) };
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
          insert(row: Record<string, unknown>) {
            reputationRows.push(row as ReputationRow);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === 'crm_personas') {
        return {
          select() {
            return {
              eq(_col: string, val: string) {
                return { maybeSingle: async () => ({ data: crmPersonaRows.find((r) => r.id === val) ?? null }) };
              },
            };
          },
        };
      }
      if (table === 'crm_reputation_events') {
        return { update: () => ({ eq: async () => ({ data: null, error: null }) }) };
      }
      throw new Error(`unexpected crm table ${table}`);
    },
  };
}

vi.mock('@/services/crm/crmDataAccess', () => ({
  getCrmClient: () => makeFakeCrmClient(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateActivityReceipt.mockResolvedValue({ id: 'receipt-1' });
  mockGetSupabaseServer.mockReturnValue(null); // sponsor auto-resolution short-circuits when admin is null
  reputationRows = [];
  crmPersonaRows = [{ id: CRM_PERSONA_ID, identity_persona_id: IDENTITY_PERSONA_ID }];
});

/** The receipt-creation call is inside a fire-and-forget IIFE — flush microtasks before asserting. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('accrueStanding — Standing subject attribution', () => {
  it('subjectAgentRef supplied: agentsInvoked carries ONLY that agent, never aigent-z', async () => {
    const { accrueStanding } = await import('@/services/crm/standingAccrualService');
    await accrueStanding({ crmPersonaId: CRM_PERSONA_ID, cvs: 1, subjectAgentRef: 'aigent-nakamoto', sponsorCrmPersonaId: null });
    await flush();

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const call = mockCreateActivityReceipt.mock.calls[0][0];
    expect(call.agentsInvoked).toEqual(['aigent-nakamoto']);
    expect(call.actionInput).toMatchObject({ subjectAgentRef: 'aigent-nakamoto' });
  });

  it('subjectAgentRef omitted: preserves the historical agentsInvoked: ["aigent-z"] default unchanged', async () => {
    const { accrueStanding } = await import('@/services/crm/standingAccrualService');
    await accrueStanding({ crmPersonaId: CRM_PERSONA_ID, cvs: 1, sponsorCrmPersonaId: null });
    await flush();

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const call = mockCreateActivityReceipt.mock.calls[0][0];
    expect(call.agentsInvoked).toEqual(['aigent-z']);
    expect(call.actionInput).toBeNull();
  });

  it('orchestratorAgentRef is recorded ONLY in actionInput — it never appears in agentsInvoked and is never substituted for the subject', async () => {
    const { accrueStanding } = await import('@/services/crm/standingAccrualService');
    await accrueStanding({
      crmPersonaId: CRM_PERSONA_ID,
      cvs: 1,
      subjectAgentRef: 'aigent-kn0w1',
      orchestratorAgentRef: 'aigent-z',
      sponsorCrmPersonaId: null,
    });
    await flush();

    const call = mockCreateActivityReceipt.mock.calls[0][0];
    expect(call.agentsInvoked).toEqual(['aigent-kn0w1']);
    expect(call.agentsInvoked).not.toContain('aigent-z');
    expect(call.actionInput).toMatchObject({ subjectAgentRef: 'aigent-kn0w1', orchestratorAgentRef: 'aigent-z' });
  });

  it('two different agents crediting the same orchestrator produce two receipts, each attributed to its own real subject', async () => {
    crmPersonaRows.push({ id: 'crm-persona-2', identity_persona_id: 'identity-persona-2' });
    reputationRows.push({
      persona_id: 'crm-persona-2',
      standing_personal: 0,
      standing_delegated: 0,
      standing_stewardship: 0,
      standing_capability: 0,
      standing_overall: 0,
    });

    const { accrueStanding } = await import('@/services/crm/standingAccrualService');
    await accrueStanding({ crmPersonaId: CRM_PERSONA_ID, cvs: 1, subjectAgentRef: 'aigent-nakamoto', sponsorCrmPersonaId: null });
    await accrueStanding({ crmPersonaId: 'crm-persona-2', cvs: 1, subjectAgentRef: 'aigent-kn0w1', sponsorCrmPersonaId: null });
    await flush();

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(2);
    const attributed = mockCreateActivityReceipt.mock.calls.map((c) => c[0].agentsInvoked);
    expect(attributed).toContainEqual(['aigent-nakamoto']);
    expect(attributed).toContainEqual(['aigent-kn0w1']);
    // Neither receipt names the other agent — cross-agent isolation at the write site itself.
    expect(attributed.find((a) => a.includes('aigent-nakamoto'))).not.toContain('aigent-kn0w1');
    expect(attributed.find((a) => a.includes('aigent-kn0w1'))).not.toContain('aigent-nakamoto');
  });
});
