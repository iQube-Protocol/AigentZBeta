/**
 * GET /api/ops/agents/[agentRuntimeId]/external-presence (DiDQube Phase 4
 * item 7's first real caller, 2026-09-08 follow-up). Route-level: proves the
 * dual-auth gate (mirroring standing-didqube-reconciliation's own shape) and
 * that the route is a thin, read-only pass-through to
 * resolveAgentExternalPresence — the seam's own DiDQube-first ordering is
 * covered separately in tests/agent-didqube-external-presence.test.ts. This
 * test only needs to prove the ROUTE actually reaches the seam (rather than
 * reading Horizen/Registry state directly) and never calls it without a
 * resolved agent_root_identity row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';

const NAKAMOTO_AGENT = {
  slug: 'nakamoto',
  displayName: 'Aigent Nakamoto',
  runtimeAgentId: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  agentCardPath: '/api/agents/nakamoto/agent-card.json',
  fioHandle: 'nakamoto@aigent',
  runtimeHealthPath: '/api/agents/nakamoto/health',
};

const mockResolveAgent = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgentByRuntimeId: (id: string) => mockResolveAgent(id),
}));

const mockAdmission = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: unknown[]) => mockAdmission(...args),
}));

const mockExternalPresence = vi.fn();
vi.mock('@/services/horizen/agentDiDQubeExternalPresence', () => ({
  resolveAgentExternalPresence: (...args: unknown[]) => mockExternalPresence(...args),
}));

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { GET } from '@/app/api/ops/agents/[agentRuntimeId]/external-presence/route';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://dev-beta.aigentz.me/api/ops/agents/aigent-nakamoto/external-presence', { headers });
}

function makeContext(agentRuntimeId = 'aigent-nakamoto') {
  return { params: Promise.resolve({ agentRuntimeId }) };
}

beforeEach(() => {
  mockResolveAgent.mockReset();
  mockAdmission.mockReset();
  mockExternalPresence.mockReset();
  mockGetActivePersona.mockReset();
  mockResolveAgent.mockReturnValue(NAKAMOTO_AGENT);
});

describe('GET /api/ops/agents/[agentRuntimeId]/external-presence', () => {
  it('refuses 403 with neither a cron token nor an authenticated admin persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeRequest() as never, makeContext() as never);
    expect(res.status).toBe(403);
    expect(mockExternalPresence).not.toHaveBeenCalled();
  });

  it("400s for a runtime id that isn't a canonical registrable agent, without ever calling the seam", async () => {
    mockResolveAgent.mockReturnValue(null);
    const res = await GET(
      makeRequest({ 'x-cron-token': 'test-cron-token' }) as never,
      makeContext('not-a-real-agent') as never,
    );
    expect(res.status).toBe(400);
    expect(mockExternalPresence).not.toHaveBeenCalled();
  });

  it('never calls the external-presence seam when the agent has no agent_root_identity row yet (DiDQube-first ordering, enforced at the route boundary too)', async () => {
    mockAdmission.mockResolvedValue({ agentRootId: null, agentRootDid: null, auditGaps: [] });
    const res = await GET(makeRequest({ 'x-cron-token': 'test-cron-token' }) as never, makeContext() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.externalPresence.didqubeResolved).toBe(false);
    expect(mockExternalPresence).not.toHaveBeenCalled();
  });

  it('the headless x-cron-token path calls the seam with the resolved agent_root_identity id, never a raw did_uri string', async () => {
    mockAdmission.mockResolvedValue({ agentRootId: 'root-id-123', agentRootDid: 'did:agent:root:aigent-nakamoto', auditGaps: [] });
    mockExternalPresence.mockResolvedValue({
      didqubeResolved: true,
      didqubeId: 'didqube-1',
      publicCommitment: { commitmentVersion: 'v1', value: 'abc123' },
      horizenRegistration: { registered: true, tokenId: '1', registryAgentId: 'r1', network: 'sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] },
      registryAssetExists: true,
    });
    const res = await GET(makeRequest({ 'x-cron-token': 'test-cron-token' }) as never, makeContext() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.externalPresence.didqubeResolved).toBe(true);
    expect(json.externalPresence.horizenRegistration.registered).toBe(true);
    expect(mockExternalPresence).toHaveBeenCalledTimes(1);
    expect(mockExternalPresence.mock.calls[0][1]).toBe('root-id-123');
  });

  it('an authenticated admin persona session runs the read', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-admin', cartridgeFlags: { isAdmin: true } });
    mockAdmission.mockResolvedValue({ agentRootId: 'root-id-123', agentRootDid: 'did:agent:root:aigent-nakamoto', auditGaps: [] });
    mockExternalPresence.mockResolvedValue({ didqubeResolved: false, reason: 'DiDQube unresolved (anchor_absent)' });
    const res = await GET(makeRequest() as never, makeContext() as never);
    expect(res.status).toBe(200);
    expect(mockExternalPresence).toHaveBeenCalledTimes(1);
  });

  it('surfaces an unresolved/conflicted DiDQube honestly rather than hiding it in a 200', async () => {
    mockAdmission.mockResolvedValue({ agentRootId: 'root-id-123', agentRootDid: 'did:agent:root:aigent-nakamoto', auditGaps: [] });
    mockExternalPresence.mockResolvedValue({ didqubeResolved: false, reason: 'DiDQube conflicted (cross-class mismatch)' });
    const res = await GET(makeRequest({ 'x-cron-token': 'test-cron-token' }) as never, makeContext() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.externalPresence.didqubeResolved).toBe(false);
    expect(json.externalPresence.reason).toContain('conflicted');
  });
});
