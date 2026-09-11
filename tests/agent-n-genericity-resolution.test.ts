/**
 * Agent-N genericity proof, part 2 — the slug/runtimeAgentId RESOLUTION
 * boundary (Horizen Pilot Closure item 10, 2026-08-09). See
 * tests/agent-n-genericity.test.ts for part 1 (function-parameter-based
 * genericity) — split into its own file because this half needs a mocked
 * canonical registry, which would conflict with part 1's mocks of the same
 * shared modules within one vitest module graph.
 *
 * Proves that adding "Aigent Q" to the canonical registry (mocked here,
 * standing in for a real REGISTRABLE_AGENTS entry + registry_assets seed
 * migration) is sufficient for the preflight and the registration
 * reconciler to resolve, report on, and act on her correctly — WITHOUT
 * either function's own source containing an "agent-q" branch. Every
 * assertion fails if production logic silently defaults to Nakamoto or
 * MoneyPenny instead of genuinely resolving the agent it was given.
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
    expect(text, `${label} unexpectedly mentions "${forbidden}" — a real agent name leaked into Agent Q's own result`).not.toContain(forbidden);
  }
}

vi.mock('@/services/horizen/registrableAgents', async () => {
  const actual = await vi.importActual<typeof import('@/services/horizen/registrableAgents')>('@/services/horizen/registrableAgents');
  const REGISTRABLE_AGENTS = { ...actual.REGISTRABLE_AGENTS, [AGENT_Q.slug]: AGENT_Q };
  return {
    ...actual,
    REGISTRABLE_AGENTS,
    resolveRegistrableAgent: (slug: string | null | undefined) => (slug ? REGISTRABLE_AGENTS[slug] ?? null : null),
    resolveRegistrableAgentByRuntimeId: (runtimeAgentId: string | null | undefined) =>
      Object.values(REGISTRABLE_AGENTS).find((a) => a.runtimeAgentId === runtimeAgentId) ?? null,
    listRegistrableAgents: () => Object.values(REGISTRABLE_AGENTS),
  };
});

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { asset_id: AGENT_Q.aigentQubeId }, error: null }) }) }),
    }),
  }),
}));
vi.mock('@/services/registry/runtimeDescriptor', () => ({ getAssetRuntimeDescriptor: async () => null }));
vi.mock('@/services/identity/getActivePersona', () => ({ getActivePersona: async () => null }));
vi.mock('@/services/journey/agentAdmissionState', () => ({ resolveAgentAdmissionState: async () => null }));
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({ resolveAgentRegistrationState: async () => null }));

// One mock for this shared path, covering the union of what BOTH the
// preflight (findAgentReceiptRefs) and the reconciler
// (findReceiptsByActionType, findAgentRegistrationReceipts) need — a second,
// conflicting vi.mock of the same path is what part 1 lives in its own file
// to avoid.
const mockFindReceiptsByActionType = vi.fn();
const mockFindAgentRegistrationReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findAgentReceiptRefs: async () => [],
  findReceiptsByActionType: (...args: any[]) => mockFindReceiptsByActionType(...args),
  findAgentRegistrationReceipts: (...args: any[]) => mockFindAgentRegistrationReceipts(...args),
}));

const mockCheckStatus = vi.fn();
vi.mock('@/services/horizen/registrationClient', () => ({
  checkAgentRegistrationStatus: (...args: any[]) => mockCheckStatus(...args),
  resolveAgentOwnerWalletAddress: async () => '0xOwnerQ',
}));
vi.mock('@/services/horizen/registrationConfirmationDeps', () => ({
  buildRegistrationStatusDeps: () => ({ tag: 'shared-deps' }),
}));

beforeEach(() => {
  mockFindReceiptsByActionType.mockReset();
  mockFindAgentRegistrationReceipts.mockReset().mockResolvedValue([]);
  mockCheckStatus.mockReset();
  // Deterministic and fast — the preflight's live reachability probes must
  // never depend on this sandbox's actual (restricted) network access.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in tests')));
});

describe('agent resolution boundary — Agent Q added via configuration only', () => {
  it('resolveRegistrableAgent finds Agent Q, and the real default agent is unaffected', async () => {
    const { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } = await import('@/services/horizen/registrableAgents');
    expect(resolveRegistrableAgent('agent-q')?.displayName).toBe('Aigent Q');
    // Adding a third entry never touches the real default — proving
    // addition is additive, not a silent takeover.
    expect(DEFAULT_REGISTRABLE_AGENT_SLUG).toBe('moneypenny');
  });

  it('the Agent-N preflight resolves and reports on Agent Q, never silently falling back to the default agent', async () => {
    const { runAgentPreflight } = await import('@/services/horizen/agentPreflight');
    const report = await runAgentPreflight('agent-q', null, 'https://dev-beta.aigentz.me');

    expect(report.agentSlug).toBe('agent-q');
    expect(report.agentDisplayName).toBe('Aigent Q');
    assertNamesOnlyAgentQ(report, 'Agent Q preflight report');
    // If this had silently defaulted to moneypenny, this line would report
    // "aigent-moneypenny" instead — assert the real, resolved value.
    expect(report.identity.find((l) => l.id === 'runtime-agent-id')?.reason).toContain('aigent-agent-q');
  });

  it('the registration reconciler resolves a pending Agent Q submission by runtimeAgentId, never dropping or misrouting it', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([
      {
        id: 'receipt-submitted-q',
        personaId: 'persona-op-q',
        agentsInvoked: [AGENT_Q.runtimeAgentId],
        actionInput: { txHash: '0xQ1', network: 'base-sepolia', horizenAgentId: null },
        createdAt: '2026-08-09T00:00:00.000Z',
      },
    ]);
    mockCheckStatus.mockResolvedValue({ ok: true, value: { confirmed: true, confirmationSource: 'on-chain-receipt', tokenId: '999' } });

    const { reconcilePendingAgentRegistrations } = await import('@/services/horizen/registrationReconciliation');
    const result = await reconcilePendingAgentRegistrations();

    expect(mockCheckStatus).toHaveBeenCalledTimes(1);
    const [input] = mockCheckStatus.mock.calls[0];
    // Resolved to "agent-q" via resolveRegistrableAgentByRuntimeId — never
    // skipped as unknown, and never misattributed to moneypenny/nakamoto.
    expect(input.agentSlug).toBe('agent-q');
    expect(result.confirmed).toBe(1);
    expect(result.skipped).toBe(0);
    assertNamesOnlyAgentQ(result.items, 'reconciler items for Agent Q');
  });
});
