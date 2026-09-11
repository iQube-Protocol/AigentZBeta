/**
 * POST /api/ops/journey/correct-standing-attribution (2026-08-23 operator
 * directive) — the idempotent, non-destructive fix for already-misattributed
 * `standing_accrued` receipts (historically tagged `agentsInvoked: ['aigent-z']`
 * regardless of which agent's Standing was actually credited).
 *
 * Generic fixture ("Aigent Q") per this session's convention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';

const AGENT_Q_RUNTIME_ID = 'aigent-agent-q';
const IDENTITY_PERSONA_ID = 'identity-persona-q';

const mockResolveRegistrableAgentByRuntimeId = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgentByRuntimeId: (...args: any[]) => mockResolveRegistrableAgentByRuntimeId(...args),
}));

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockResolveCanonicalAgentPersonaId = vi.fn();
vi.mock('@/services/standing/agentStandingPersona', () => ({
  resolveCanonicalAgentPersonaId: (...args: any[]) => mockResolveCanonicalAgentPersonaId(...args),
}));

let standingAccruedRows: Array<{ id: string; agents_invoked: string[]; action_input: unknown; created_at: string }>;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: async () => ({ data: standingAccruedRows, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `correction-${input.actionInput.originalReceiptId}`, ...input }));
let existingCorrections: Array<{ actionInput: Record<string, unknown> | null }>;
const mockFindAgentReceiptRefs = vi.fn(async () => existingCorrections);
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  findAgentReceiptRefs: (...args: any[]) => mockFindAgentReceiptRefs(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveRegistrableAgentByRuntimeId.mockReturnValue({ runtimeAgentId: AGENT_Q_RUNTIME_ID, slug: 'agent-q', displayName: 'Aigent Q' });
  mockResolveAgentAdmissionState.mockResolvedValue({ agentRootDid: 'did:agent:root:agent-q' });
  mockResolveCanonicalAgentPersonaId.mockResolvedValue(IDENTITY_PERSONA_ID);
  standingAccruedRows = [];
  existingCorrections = [];
});

function request(body: unknown, token = 'test-cron-token') {
  return new Request('http://local/api/ops/journey/correct-standing-attribution', {
    method: 'POST',
    headers: { 'x-cron-token': token },
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/ops/journey/correct-standing-attribution', () => {
  it('refuses without a valid CRON_TRIGGER_TOKEN', async () => {
    const { POST } = await import('@/app/api/ops/journey/correct-standing-attribution/route');
    const res = await POST(request({ agentRuntimeId: AGENT_Q_RUNTIME_ID, correctingPersonaId: 'op-1' }, 'wrong-token'));
    expect(res.status).toBe(401);
  });

  it('finds a genuinely misattributed receipt and writes exactly one additive correction, never mutating the original', async () => {
    standingAccruedRows = [
      { id: 'misattributed-1', agents_invoked: ['aigent-z'], action_input: null, created_at: '2026-08-01T00:00:00.000Z' },
    ];

    const { POST } = await import('@/app/api/ops/journey/correct-standing-attribution/route');
    const res = await POST(request({ agentRuntimeId: AGENT_Q_RUNTIME_ID, correctingPersonaId: 'op-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.misattributedFound).toBe(1);
    expect(json.corrected).toHaveLength(1);
    expect(json.corrected[0].originalReceiptId).toBe('misattributed-1');
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const call = mockCreateActivityReceipt.mock.calls[0][0];
    expect(call.actionType).toBe('standing_corrected');
    expect(call.agentsInvoked).toEqual([AGENT_Q_RUNTIME_ID]);
    expect(call.actionInput).toMatchObject({ correctionKind: 'standing_attribution', originalReceiptId: 'misattributed-1' });
  });

  it('a receipt already correctly attributed is never touched (not misattributed at all)', async () => {
    standingAccruedRows = [
      { id: 'already-correct-1', agents_invoked: [AGENT_Q_RUNTIME_ID], action_input: null, created_at: '2026-08-01T00:00:00.000Z' },
    ];

    const { POST } = await import('@/app/api/ops/journey/correct-standing-attribution/route');
    const res = await POST(request({ agentRuntimeId: AGENT_Q_RUNTIME_ID, correctingPersonaId: 'op-1' }));
    const json = await res.json();

    expect(json.misattributedFound).toBe(0);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('idempotent: re-running against an already-corrected receipt writes nothing new', async () => {
    standingAccruedRows = [
      { id: 'misattributed-2', agents_invoked: ['aigent-z'], action_input: null, created_at: '2026-08-01T00:00:00.000Z' },
    ];
    existingCorrections = [
      { actionInput: { correctionKind: 'standing_attribution', originalReceiptId: 'misattributed-2' } },
    ];

    const { POST } = await import('@/app/api/ops/journey/correct-standing-attribution/route');
    const res = await POST(request({ agentRuntimeId: AGENT_Q_RUNTIME_ID, correctingPersonaId: 'op-1' }));
    const json = await res.json();

    expect(json.misattributedFound).toBe(1);
    expect(json.corrected).toHaveLength(0);
    expect(json.skippedAlreadyCorrected).toEqual(['misattributed-2']);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('requires agentRuntimeId and correctingPersonaId', async () => {
    const { POST } = await import('@/app/api/ops/journey/correct-standing-attribution/route');
    const res = await POST(request({}));
    expect(res.status).toBe(400);
  });
});
