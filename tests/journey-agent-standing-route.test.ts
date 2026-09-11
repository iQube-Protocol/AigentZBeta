/**
 * GET /api/journey/agents/[agentRuntimeId]/standing (2026-08-23 operator
 * directive, "Horizen Journey — Standing observer + DVN liveness closure",
 * part 2) — ALWAYS resolves the NAMED agent's own canonical Standing, never
 * the authenticated caller's own. Generic fixture ("Aigent Q").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const AGENT_Q = 'aigent-agent-q';
const AGENT_R = 'aigent-agent-r';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: any[]) => mockGetActivePersona(...args),
}));

const mockResolveRegistrableAgentByRuntimeId = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgentByRuntimeId: (...args: any[]) => mockResolveRegistrableAgentByRuntimeId(...args),
}));

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockResolveAgentStandingPersonaId = vi.fn();
vi.mock('@/services/standing/agentStandingPersona', () => ({
  resolveAgentStandingPersonaId: (...args: any[]) => mockResolveAgentStandingPersonaId(...args),
}));

const mockListActivityReceiptsForAgent = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForAgent: (...args: any[]) => mockListActivityReceiptsForAgent(...args),
}));

let reputationRows: Record<string, Record<string, number>>;
vi.mock('@/services/crm/crmDataAccess', () => ({
  getCrmClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({ data: reputationRows[val] ?? null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActivePersona.mockResolvedValue({ personaId: 'operator-1' });
  mockResolveAgentAdmissionState.mockResolvedValue({ agentRootDid: 'did:agent:root:x' });
  mockListActivityReceiptsForAgent.mockResolvedValue([]);
  reputationRows = {};
});

function request() {
  return new Request('http://local/api/journey/agents/x/standing') as any;
}

describe('GET /api/journey/agents/[agentRuntimeId]/standing', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    mockResolveRegistrableAgentByRuntimeId.mockReturnValue({ runtimeAgentId: AGENT_Q, displayName: 'Aigent Q' });

    const { GET } = await import('@/app/api/journey/agents/[agentRuntimeId]/standing/route');
    const res = await GET(request(), { params: Promise.resolve({ agentRuntimeId: AGENT_Q }) });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown agent id', async () => {
    mockResolveRegistrableAgentByRuntimeId.mockReturnValue(null);

    const { GET } = await import('@/app/api/journey/agents/[agentRuntimeId]/standing/route');
    const res = await GET(request(), { params: Promise.resolve({ agentRuntimeId: 'not-a-real-agent' }) });
    expect(res.status).toBe(400);
  });

  it("Aigent Q's Standing is discoverable under its own agentRuntimeId, distinct from Aigent R's", async () => {
    mockResolveRegistrableAgentByRuntimeId.mockImplementation((id: string) => ({ runtimeAgentId: id, displayName: id }));
    mockResolveAgentStandingPersonaId.mockImplementation(async (_admin: unknown, agent: { runtimeAgentId: string }) =>
      agent.runtimeAgentId === AGENT_Q ? 'crm-q' : 'crm-r',
    );
    reputationRows = {
      'crm-q': { standing_personal: 5, standing_delegated: 0, standing_stewardship: 0, standing_capability: 0, standing_overall: 30, standing_bucket: 1, rep_overall: 1, lifetime_cvs: 5, total_tasks_completed: 1 },
      'crm-r': { standing_personal: 0, standing_delegated: 0, standing_stewardship: 0, standing_capability: 0, standing_overall: 0, standing_bucket: 0, rep_overall: 0, lifetime_cvs: 0, total_tasks_completed: 0 },
    };
    mockListActivityReceiptsForAgent.mockImplementation(async (id: string) => (id === AGENT_Q ? [{ id: 'r-q-1' }] : []));

    const { GET } = await import('@/app/api/journey/agents/[agentRuntimeId]/standing/route');
    const resQ = await GET(request(), { params: Promise.resolve({ agentRuntimeId: AGENT_Q }) });
    const jsonQ = await resQ.json();
    const resR = await GET(request(), { params: Promise.resolve({ agentRuntimeId: AGENT_R }) });
    const jsonR = await resR.json();

    expect(jsonQ.standing.overall).toBe(30);
    expect(jsonQ.receipts).toHaveLength(1);
    expect(jsonR.standing.overall).toBe(0);
    expect(jsonR.receipts).toHaveLength(0);
  });

  it('an agent with no resolvable Standing persona returns null standing, never a fabricated value', async () => {
    mockResolveRegistrableAgentByRuntimeId.mockReturnValue({ runtimeAgentId: AGENT_Q, displayName: 'Aigent Q' });
    mockResolveAgentStandingPersonaId.mockResolvedValue(null);

    const { GET } = await import('@/app/api/journey/agents/[agentRuntimeId]/standing/route');
    const res = await GET(request(), { params: Promise.resolve({ agentRuntimeId: AGENT_Q }) });
    const json = await res.json();
    expect(json.standing).toBeNull();
    expect(json.reputation).toBeNull();
  });
});
