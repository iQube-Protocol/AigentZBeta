/**
 * POST /api/ops/agents/provision-platform-agent — the machine-to-machine
 * counterpart to /api/homecoming/agent/stand-up for platform agents with no
 * live human admin session (Factor/Aegis, capacity remediation 2026-09-05).
 *
 * Pins: fail-closed CRON_TRIGGER_TOKEN auth, the agent-slug allowlist
 * (never client-supplied identity fields), isPlatformAuthority is passed to
 * sponsorPolityAgent (never conjured from the request body), and the
 * response never leaks a sponsor persona/passport id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSponsorPolityAgent = vi.fn();
vi.mock('@/services/agents/sponsorPolityAgent', () => ({
  sponsorPolityAgent: (...args: unknown[]) => mockSponsorPolityAgent(...args),
}));

const mockProvisionAgentPersona = vi.fn();
vi.mock('@/services/agents/provisionAgentPersona', () => ({
  provisionAgentPersona: (...args: unknown[]) => mockProvisionAgentPersona(...args),
}));

const mockResolveCanonicalAgentPersonaId = vi.fn();
vi.mock('@/services/standing/agentStandingPersona', () => ({
  resolveCanonicalAgentPersonaId: (...args: unknown[]) => mockResolveCanonicalAgentPersonaId(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/ops/agents/provision-platform-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ops/agents/provision-platform-agent', () => {
  const REAL_TOKEN = 'test-cron-token';

  beforeEach(() => {
    mockSponsorPolityAgent.mockReset();
    mockProvisionAgentPersona.mockReset();
    mockResolveCanonicalAgentPersonaId.mockReset();
    delete process.env.CRON_TRIGGER_TOKEN;
  });

  it('refuses (503) when CRON_TRIGGER_TOKEN is not configured — fails closed', async () => {
    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    const res = await POST(makeRequest({ agentSlug: 'factor' }, { 'x-cron-token': 'anything' }));
    expect(res.status).toBe(503);
    expect(mockSponsorPolityAgent).not.toHaveBeenCalled();
  });

  it('refuses (401) an unauthenticated caller — anonymous access is denied', async () => {
    process.env.CRON_TRIGGER_TOKEN = REAL_TOKEN;
    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    const res = await POST(makeRequest({ agentSlug: 'factor' }, { 'x-cron-token': 'wrong-token' }));
    expect(res.status).toBe(401);
    expect(mockSponsorPolityAgent).not.toHaveBeenCalled();
  });

  it('refuses (400) an agentSlug outside the allowlist — never mints an arbitrary root identity', async () => {
    process.env.CRON_TRIGGER_TOKEN = REAL_TOKEN;
    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    const res = await POST(makeRequest({ agentSlug: 'some-random-agent' }, { 'x-cron-token': REAL_TOKEN }));
    expect(res.status).toBe(400);
    expect(mockSponsorPolityAgent).not.toHaveBeenCalled();
  });

  it("calls sponsorPolityAgent with isPlatformAuthority: true and the agent's ALLOWLISTED identity — never from the request body", async () => {
    process.env.CRON_TRIGGER_TOKEN = REAL_TOKEN;
    mockSponsorPolityAgent.mockResolvedValue({
      ok: true,
      status: 200,
      agent: {
        agentRootId: 'root-1',
        agentId: 'aigent-factor',
        didUri: 'did:agent:root:aigent-factor',
        agentClass: 'polity_bound',
        displayName: 'Factor',
        description: 'x',
        agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/factor/agent-card.json',
        agentCardSlug: 'factor',
        isAigentMe: false,
        sponsorPassportId: 'ppc-should-never-be-echoed',
        createdAt: '2026-09-05T00:00:00Z',
      },
      capacityOverride: null,
      alreadyExisted: false,
    });
    mockProvisionAgentPersona.mockResolvedValue({ ok: true, status: 200, agentPersona: { agentPersonaId: 'ap-1' } });
    mockResolveCanonicalAgentPersonaId.mockResolvedValue('standing-persona-1');

    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    // A malicious/naive caller trying to smuggle its own identity or auth claims via the body.
    const res = await POST(
      makeRequest(
        { agentSlug: 'factor', isPlatformAuthority: false, agentId: 'aigent-someone-else', displayName: 'Not Factor' },
        { 'x-cron-token': REAL_TOKEN },
      ),
    );
    expect(res.status).toBe(200);

    expect(mockSponsorPolityAgent).toHaveBeenCalledTimes(1);
    const call = mockSponsorPolityAgent.mock.calls[0][0];
    expect(call.isPlatformAuthority).toBe(true); // never the body's false
    expect(call.existingIdentity.agentId).toBe('aigent-factor'); // never the body's 'aigent-someone-else'
    expect(call.displayName).toBe('Factor'); // never the body's 'Not Factor'

    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/ppc-should-never-be-echoed/); // sponsor passport id never leaks
  });

  it('resolves the aegis allowlist entry too, with its own identity fields — no Horizen fields required', async () => {
    process.env.CRON_TRIGGER_TOKEN = REAL_TOKEN;
    mockSponsorPolityAgent.mockResolvedValue({
      ok: true,
      status: 200,
      agent: {
        agentRootId: 'root-2',
        agentId: 'aigent-aegis',
        didUri: 'did:agent:root:aigent-aegis',
        agentClass: 'polity_bound',
        displayName: 'Aegis',
        description: 'x',
        agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/aegis/agent-card.json',
        agentCardSlug: 'aegis',
        isAigentMe: false,
        sponsorPassportId: 'ppc-x',
        createdAt: '2026-09-05T00:00:00Z',
      },
      capacityOverride: null,
      alreadyExisted: false,
    });
    mockProvisionAgentPersona.mockResolvedValue({ ok: true, status: 200, agentPersona: { agentPersonaId: 'ap-2' } });
    mockResolveCanonicalAgentPersonaId.mockResolvedValue('standing-persona-2');

    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    const res = await POST(makeRequest({ agentSlug: 'aegis' }, { 'x-cron-token': REAL_TOKEN }));
    expect(res.status).toBe(200);
    const call = mockSponsorPolityAgent.mock.calls[0][0];
    expect(call.existingIdentity.agentId).toBe('aigent-aegis');
    expect(call.displayName).toBe('Aegis');
  });

  it('reports rootFreshlyCreated: false on an idempotent re-run (alreadyExisted: true)', async () => {
    process.env.CRON_TRIGGER_TOKEN = REAL_TOKEN;
    mockSponsorPolityAgent.mockResolvedValue({
      ok: true,
      status: 200,
      agent: {
        agentRootId: 'root-1',
        agentId: 'aigent-factor',
        didUri: 'did:agent:root:aigent-factor',
        agentClass: 'polity_bound',
        displayName: 'Factor',
        description: 'x',
        agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/factor/agent-card.json',
        agentCardSlug: 'factor',
        isAigentMe: false,
        sponsorPassportId: 'ppc-x',
        createdAt: '2026-09-05T00:00:00Z',
      },
      capacityOverride: null,
      alreadyExisted: true,
    });
    mockProvisionAgentPersona.mockResolvedValue({ ok: true, status: 200, alreadyExists: true, agentPersona: { agentPersonaId: 'ap-1' } });
    mockResolveCanonicalAgentPersonaId.mockResolvedValue('standing-persona-1');

    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    const res = await POST(makeRequest({ agentSlug: 'factor' }, { 'x-cron-token': REAL_TOKEN }));
    const json = await res.json();
    expect(json.agent.rootFreshlyCreated).toBe(false);
    expect(json.agentPersona.alreadyExists).toBe(true);
  });

  it('passes through a genuine refusal from sponsorPolityAgent (e.g. capacity) without masking it', async () => {
    process.env.CRON_TRIGGER_TOKEN = REAL_TOKEN;
    mockSponsorPolityAgent.mockResolvedValue({ ok: false, status: 409, code: 'sponsorship_capacity_exhausted', error: 'x' });
    const { POST } = await import('@/app/api/ops/agents/provision-platform-agent/route');
    const res = await POST(makeRequest({ agentSlug: 'factor' }, { 'x-cron-token': REAL_TOKEN }));
    expect(res.status).toBe(409);
    expect(mockProvisionAgentPersona).not.toHaveBeenCalled();
  });
});
