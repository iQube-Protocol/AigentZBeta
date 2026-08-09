/**
 * GET /api/marketa/activation/agent-bench — the Agent Bench list route
 * (2026-08-05 canonical Agent Bench plan, §5). Pins: candidates are grouped
 * by `lifecycleState` exactly as `buildAgentBenchRow` reports it (this
 * route performs no lifecycle logic of its own), the invitation
 * cross-reference is keyed on `provider:network:onChainAgentId`, and a
 * candidates-load failure surfaces as a 500 rather than an empty board.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

const mockDbToCandidate = vi.fn();
vi.mock('@/services/marketa/activation/normalizers', () => ({
  dbToCandidate: (row: Record<string, unknown>) => mockDbToCandidate(row),
}));

const mockBuildAgentBenchRow = vi.fn();
vi.mock('@/services/marketa/activation/agentBenchReadModel', () => ({
  buildAgentBenchRow: (...args: any[]) => mockBuildAgentBenchRow(...args),
}));

// Empty by default — these tests exercise Marketa-row grouping in
// isolation. The registrable-agent union (e.g. Aigent Nakamoto, who has no
// Marketa candidate row) has its own dedicated test below.
const mockListRegistrableAgents = vi.fn(() => [] as any[]);
vi.mock('@/services/horizen/registrableAgents', () => ({
  listRegistrableAgents: () => mockListRegistrableAgents(),
}));

import { GET } from '@/app/api/marketa/activation/agent-bench/route';

function fakeSupabase(opts: {
  candidateRows?: Record<string, unknown>[] | null;
  candidatesError?: { message: string } | null;
  invitationRows?: Record<string, unknown>[];
}) {
  return {
    schema: () => ({
      from: () => ({
        select: () => ({
          order: () => ({
            limit: async () => ({
              data: opts.candidateRows ?? null,
              error: opts.candidatesError ?? null,
            }),
          }),
        }),
      }),
    }),
    from: () => ({
      select: () => ({
        not: async () => ({ data: opts.invitationRows ?? [], error: null }),
      }),
    }),
  };
}

function makeRow(id: string, provider: string | null, network: string | null, onChainAgentId: string | null) {
  return { id, registryProvider: provider, registryNetwork: network, onChainAgentId };
}

beforeEach(() => {
  mockGetSupabaseServer.mockReset();
  mockDbToCandidate.mockReset();
  mockBuildAgentBenchRow.mockReset();
  mockListRegistrableAgents.mockReset();
  mockListRegistrableAgents.mockReturnValue([]);
});

describe('GET agent-bench', () => {
  it('returns 503 when the DB is unavailable', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const res = await GET({} as any);
    expect(res.status).toBe(503);
  });

  it('returns 500 when the candidates load fails', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase({ candidatesError: { message: 'db down' } }));
    const res = await GET({} as any);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('candidates-load-failed');
  });

  it('groups rows by lifecycleState exactly as buildAgentBenchRow reports it', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        candidateRows: [{ id: 'cand-1' }, { id: 'cand-2' }],
        invitationRows: [],
      }),
    );
    mockDbToCandidate.mockImplementation((row: Record<string, unknown>) => makeRow(row.id as string, null, null, null));
    mockBuildAgentBenchRow.mockImplementation((_admin: unknown, subject: { kind: string; candidate: { id: string } }) =>
      Promise.resolve({
        candidateId: subject.candidate.id,
        lifecycleState: subject.candidate.id === 'cand-1' ? 'candidate' : 'service-ready',
      }),
    );

    const res = await GET({} as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rows.candidate).toHaveLength(1);
    expect(body.rows.candidate[0].candidateId).toBe('cand-1');
    expect(body.rows['service-ready']).toHaveLength(1);
    expect(body.rows['service-ready'][0].candidateId).toBe('cand-2');
    expect(body.counts).toEqual({ candidate: 1, invited: 0, inAdmission: 0, serviceReady: 1, engaged: 0 });
  });

  it('marks a candidate invited only when its provider:network:onChainAgentId ref matches an access_invitations row', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        candidateRows: [{ id: 'cand-1' }],
        invitationRows: [{ external_agent_ref: 'horizen:base-sepolia:8798' }],
      }),
    );
    mockDbToCandidate.mockReturnValue(makeRow('cand-1', 'horizen', 'base-sepolia', '8798'));
    mockBuildAgentBenchRow.mockResolvedValue({ candidateId: 'cand-1', lifecycleState: 'candidate' });

    await GET({} as any);

    expect(mockBuildAgentBenchRow).toHaveBeenCalledWith(expect.anything(), expect.anything(), { hasInvitation: true });
  });

  it('never treats a candidate with no registry link as invited', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        candidateRows: [{ id: 'cand-1' }],
        invitationRows: [{ external_agent_ref: 'horizen:base-sepolia:8798' }],
      }),
    );
    mockDbToCandidate.mockReturnValue(makeRow('cand-1', null, null, null));
    mockBuildAgentBenchRow.mockResolvedValue({ candidateId: 'cand-1', lifecycleState: 'candidate' });

    await GET({} as any);

    expect(mockBuildAgentBenchRow).toHaveBeenCalledWith(expect.anything(), expect.anything(), { hasInvitation: false });
  });

  describe('registrable-agent union (e.g. Aigent Nakamoto — no Marketa candidate row)', () => {
    it('includes a registrable agent with no linked Marketa candidate, as a registrable-agent subject', async () => {
      mockGetSupabaseServer.mockReturnValue(fakeSupabase({ candidateRows: [], invitationRows: [] }));
      mockListRegistrableAgents.mockReturnValue([
        { slug: 'nakamoto', displayName: 'Aigent Nakamoto', runtimeAgentId: 'aigent-nakamoto', aigentQubeId: 'aigentqube-nakamoto', agentCardPath: '/x', fioHandle: 'nakamoto@aigent' },
      ]);
      mockBuildAgentBenchRow.mockResolvedValue({ candidateId: 'aigent-nakamoto', lifecycleState: 'in-admission' });

      const res = await GET({} as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockBuildAgentBenchRow).toHaveBeenCalledWith(
        expect.anything(),
        { kind: 'registrable-agent', agent: expect.objectContaining({ runtimeAgentId: 'aigent-nakamoto' }) },
        { hasInvitation: false },
      );
      expect(body.rows['in-admission']).toHaveLength(1);
      expect(body.rows['in-admission'][0].candidateId).toBe('aigent-nakamoto');
    });

    it('never duplicates a registrable agent already linked to a Marketa candidate', async () => {
      mockGetSupabaseServer.mockReturnValue(fakeSupabase({ candidateRows: [{ id: 'cand-1' }], invitationRows: [] }));
      mockDbToCandidate.mockReturnValue({ ...makeRow('cand-1', null, null, null), runtimeAgentId: 'aigent-nakamoto' });
      mockListRegistrableAgents.mockReturnValue([
        { slug: 'nakamoto', displayName: 'Aigent Nakamoto', runtimeAgentId: 'aigent-nakamoto', aigentQubeId: 'aigentqube-nakamoto', agentCardPath: '/x', fioHandle: 'nakamoto@aigent' },
      ]);
      mockBuildAgentBenchRow.mockResolvedValue({ candidateId: 'cand-1', lifecycleState: 'candidate' });

      await GET({} as any);

      // Exactly one call — the Marketa candidate's own row — never a second
      // registrable-agent row for the same runtimeAgentId.
      expect(mockBuildAgentBenchRow).toHaveBeenCalledTimes(1);
      expect(mockBuildAgentBenchRow).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ kind: 'marketa' }),
        expect.anything(),
      );
    });
  });
});
