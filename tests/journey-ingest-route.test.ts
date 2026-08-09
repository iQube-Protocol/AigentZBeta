/**
 * POST /api/journey/moneypenny-horizen/ingest — the Ingest act the Horizen
 * journey never had (Horizen Pilot Closure, part 2, operator decision A,
 * 2026-08-09). Confirmed by direct audit: the only production writer of a
 * `capability_registered` receipt (services/constitutional/capabilityRegistry.ts)
 * writes it for `agentsInvoked: ['aigent-z']` — an unrelated concept (shipped
 * software capabilities), never for a Horizen registrable agent. This route
 * is the missing agent-scoped writer.
 *
 * Generic fixture ("Aigent Q") throughout, per this session's own convention
 * (tests/agent-n-genericity*.test.ts) — every assertion fails if the route
 * silently defaults to Nakamoto or MoneyPenny instead of the agent it was
 * given.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

const AGENT_Q: RegistrableAgentConfig = {
  slug: 'agent-q',
  displayName: 'Aigent Q',
  runtimeAgentId: 'aigent-agent-q',
  aigentQubeId: 'aigentqube-agent-q',
  agentCardPath: '/api/agents/agent-q/agent-card.json',
  fioHandle: 'agent-q@aigent',
  runtimeHealthPath: '/api/agents/agent-q/health',
};

const FORBIDDEN_NAMES = ['MoneyPenny', 'Nakamoto'];
function assertNamesOnlyAgentQ(value: unknown, label: string) {
  const text = JSON.stringify(value);
  for (const forbidden of FORBIDDEN_NAMES) {
    expect(text, `${label} unexpectedly mentions "${forbidden}"`).not.toContain(forbidden);
  }
}

vi.mock('@/services/horizen/registrableAgents', async () => {
  const actual = await vi.importActual<typeof import('@/services/horizen/registrableAgents')>('@/services/horizen/registrableAgents');
  const REGISTRABLE_AGENTS = { ...actual.REGISTRABLE_AGENTS, [AGENT_Q.slug]: AGENT_Q };
  return {
    ...actual,
    REGISTRABLE_AGENTS,
    resolveRegistrableAgent: (slug: string | null | undefined) => (slug ? REGISTRABLE_AGENTS[slug] ?? null : null),
  };
});

let aigentQubePresent = true;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: aigentQubePresent ? { asset_id: AGENT_Q.aigentQubeId } : null, error: null }) }),
      }),
    }),
  }),
}));

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockResolveAgentRegistrationState = vi.fn();
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({
  resolveAgentRegistrationState: (...args: any[]) => mockResolveAgentRegistrationState(...args),
}));

let existingIngestReceipts: Array<{ id: string }> = [];
let aigentMeActive = true;
let focusDispositionRecorded = true;
const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: 'receipt-ingest-q-1', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findAgentReceiptRefs: async (_runtimeAgentId: string, actionTypes: string[]) => {
    if (actionTypes[0] === 'capability_registered') return existingIngestReceipts;
    if (actionTypes[0] === 'aigentme_activated') return aigentMeActive ? [{ id: 'r-aigentme' }] : [];
    if (actionTypes[0] === 'experienceqube_focus_disposition_recorded') return focusDispositionRecorded ? [{ id: 'r-focus' }] : [];
    return [];
  },
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

function makeRequest(body: Record<string, unknown> = { agentSlug: 'agent-q' }, qs = '') {
  return new (require('next/server').NextRequest)(`https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/ingest${qs}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  } as any);
}

beforeEach(() => {
  aigentQubePresent = true;
  existingIngestReceipts = [];
  aigentMeActive = true;
  focusDispositionRecorded = true;
  mockGetActivePersona.mockReset().mockResolvedValue({ personaId: 'persona-op-q' });
  mockResolveAgentRegistrationState.mockReset().mockResolvedValue({ registered: true, tokenId: '999', network: 'base-sepolia' });
  mockCreateActivityReceipt.mockClear();
});

describe('POST /api/journey/moneypenny-horizen/ingest — success path, generic by construction', () => {
  it('writes exactly one agent-scoped capability_registered receipt, naming only Agent Q, and writes NO standing_accrued', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json).toMatchObject({ ok: true, status: 'ingested', agentSlug: 'agent-q' });
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('capability_registered');
    expect(receiptInput.agentsInvoked).toEqual(['aigent-agent-q']);
    expect(receiptInput.personaId).toBe('persona-op-q');
    assertNamesOnlyAgentQ(receiptInput, 'ingest receipt');

    // The seed-award is EXCLUSIVELY the state route's job — this route must
    // never write a standing_accrued receipt itself.
    expect(mockCreateActivityReceipt.mock.calls.every((c) => c[0].actionType !== 'standing_accrued')).toBe(true);
  });

  it('is idempotent: a second call reports already_ingested and writes nothing new', async () => {
    existingIngestReceipts = [{ id: 'existing-receipt-q' }];
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json).toMatchObject({ ok: true, status: 'already_ingested', receiptId: 'existing-receipt-q' });
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });
});

describe('POST /api/journey/moneypenny-horizen/ingest — preconditions refuse, first-failing-one reported', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses AIGENTQUBE_UNRESOLVED when the AigentQube is not present in the registry', async () => {
    aigentQubePresent = false;
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('AIGENTQUBE_UNRESOLVED');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses AGENT_NOT_REGISTERED when Horizen registration has not resolved', async () => {
    mockResolveAgentRegistrationState.mockResolvedValue({ registered: false, tokenId: null, network: null });
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('AGENT_NOT_REGISTERED');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses OPERATE_NOT_COMPLETE when aigentMe has not been activated', async () => {
    aigentMeActive = false;
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('OPERATE_NOT_COMPLETE');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses OPERATE_NOT_COMPLETE when the focus disposition receipt is missing (both halves required)', async () => {
    focusDispositionRecorded = false;
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('OPERATE_NOT_COMPLETE');
  });

  it('rejects an unknown agent slug without touching any real agent', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const res = await POST(makeRequest({ agentSlug: 'not-a-real-agent' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.refusalCode).toBe('UNKNOWN_AGENT');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });
});

describe('GET /api/journey/moneypenny-horizen/ingest — read-only eligibility status', () => {
  it('reports eligible=true when every precondition holds and nothing is ingested yet', async () => {
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const req = new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/ingest?agentSlug=agent-q');
    const json = await (await GET(req)).json();
    expect(json).toMatchObject({ ok: true, agentSlug: 'agent-q', eligible: true, alreadyIngested: false });
    assertNamesOnlyAgentQ(json, 'ingest status');
  });

  it('reports eligible=false and alreadyIngested=true once a receipt exists', async () => {
    existingIngestReceipts = [{ id: 'existing-receipt-q' }];
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/ingest/route');
    const req = new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/ingest?agentSlug=agent-q');
    const json = await (await GET(req)).json();
    expect(json).toMatchObject({ eligible: false, alreadyIngested: true, existingIngestReceiptId: 'existing-receipt-q' });
  });
});
