/**
 * `invokeCapability` (Phase 4, 2026-08-06 — Governed Capability Invocation).
 * OS-9 canaries per the design doc §9: capability mismatch, delegation-depth/
 * loop violations, and the two valid patterns (direct specialist,
 * MoneyPenny-orchestrated) reaching `allow`. Mirrors this repo's existing
 * mocking convention for agentBenchReadModel-adjacent tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveCapabilityProviders = vi.fn();
vi.mock('@/services/registry/capabilityProviderResolution', () => ({
  resolveCapabilityProviders: (...args: any[]) => mockResolveCapabilityProviders(...args),
}));

const mockResolveRegistrableAgentByRuntimeId = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgentByRuntimeId: (...args: any[]) => mockResolveRegistrableAgentByRuntimeId(...args),
}));

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockEmitReceipt = vi.fn();
vi.mock('@/services/registry/receiptEmitter', () => ({
  emitReceipt: (...args: any[]) => mockEmitReceipt(...args),
}));

// A minimal truthy fake client — evaluateIdentityAndAuthorityGate refuses
// DB_UNAVAILABLE on a falsy client, and recordCapabilityInvocation's
// best-effort upsert needs a chainable `.from().upsert().then()` that never
// throws. Neither actually touches a database in this test file.
const fakeSupabase = {
  from: () => ({
    upsert: () => ({
      then: (resolve: (v: unknown) => void) => Promise.resolve(resolve(undefined)),
    }),
  }),
};
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeSupabase,
}));

// invocationGateway.ts also imports these for the (untouched) asset-mode path —
// stub them so the module loads without a real DB/policy gate in this test file.
vi.mock('@/services/registry/persistence', () => ({ getAsset: vi.fn() }));
vi.mock('@/services/policy/skillQubePolicyGate', () => ({ evaluateSkillQubePolicy: vi.fn() }));

import { invokeCapability } from '@/services/registry/invocationGateway';
import type { CapabilityInvocation } from '@/types/capabilityInvocation';

const NAKAMOTO_PROVIDER = {
  capabilityId: 'bitcoin_decentralisation_expertise',
  providerAgentId: 'aigent-nakamoto',
  registryAssetId: 'aigentqube-nakamoto',
  runtimeMembershipRef: 'financial-services',
  benchRow: {
    runtimeMemberships: [{ runtimeId: 'financial-services', status: 'approved', eligibility: { satisfied: [], outstanding: [] } }],
  },
};

const MONEYPENNY_AGENT = { runtimeAgentId: 'aigent-moneypenny', aigentQubeId: 'aigentqube-moneypenny' };
const NAKAMOTO_AGENT = { runtimeAgentId: 'aigent-nakamoto', aigentQubeId: 'aigentqube-nakamoto' };

function baseEnvelope(overrides: Partial<CapabilityInvocation> = {}): CapabilityInvocation {
  return {
    mode: 'capability',
    invocationId: 'inv-test-1',
    principalRef: 'polref-abc123',
    originatingSurface: 'wallet-copilot',
    requestingAgentId: 'aigent-moneypenny',
    orchestratorAgentId: 'aigent-moneypenny',
    capabilityId: 'bitcoin_decentralisation_expertise',
    runtimeMembershipRef: 'financial-services',
    executionMode: 'shadow',
    intent: 'Which L2 should we integrate for treasury settlement?',
    input: {},
    policyBindingRefs: [],
    delegationDepth: 0,
    invocationPath: [],
    maxInvocationDepth: 2,
    ...overrides,
  };
}

beforeEach(() => {
  mockResolveCapabilityProviders.mockReset();
  mockResolveRegistrableAgentByRuntimeId.mockReset();
  mockResolveAgentAdmissionState.mockReset();
  mockEmitReceipt.mockReset();
  mockEmitReceipt.mockResolvedValue({});
  mockResolveRegistrableAgentByRuntimeId.mockImplementation((id: string) =>
    id === 'aigent-moneypenny' ? MONEYPENNY_AGENT : id === 'aigent-nakamoto' ? NAKAMOTO_AGENT : null,
  );
  mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: true });
});

describe('invokeCapability — MoneyPenny-orchestrated pattern reaches allow', () => {
  it('resolves aigentMe → MoneyPenny → Nakamoto to an allow decision naming the resolved provider', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);

    const decision = await invokeCapability(baseEnvelope());

    expect(decision.decision).toBe('allow');
    if (decision.decision === 'allow') {
      expect(decision.envelope.resolvedProviderId).toBe('aigent-nakamoto');
      expect(decision.envelope.resolvedRegistryAssetId).toBe('aigentqube-nakamoto');
    }
  });
});

describe('invokeCapability — direct specialist pattern (no orchestrator) reaches allow', () => {
  it('allows requestingAgentId === resolved provider with orchestratorAgentId absent', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);

    const decision = await invokeCapability(
      baseEnvelope({
        originatingSurface: 'aigentme',
        requestingAgentId: 'aigent-nakamoto',
        orchestratorAgentId: undefined,
        invocationPath: [],
        delegationDepth: 0,
      }),
    );

    expect(decision.decision).toBe('allow');
  });
});

describe('invokeCapability — OS-9 canary: capability mismatch', () => {
  it('refuses CAPABILITY_NOT_PROVIDED when no eligible provider resolves', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([]);

    const decision = await invokeCapability(baseEnvelope());

    expect(decision).toMatchObject({ decision: 'refuse', code: 'CAPABILITY_NOT_PROVIDED' });
  });

  it('refuses PROVIDER_MISMATCH when a targetAgentId hint disagrees with the resolved provider', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);

    const decision = await invokeCapability(baseEnvelope({ targetAgentId: 'aigent-marketa' }));

    expect(decision).toMatchObject({ decision: 'refuse', code: 'PROVIDER_MISMATCH' });
  });

  it('refuses PROVIDER_AMBIGUOUS rather than silently picking one when several providers resolve', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER, { ...NAKAMOTO_PROVIDER, providerAgentId: 'aigent-other' }]);

    const decision = await invokeCapability(baseEnvelope());

    expect(decision).toMatchObject({ decision: 'refuse', code: 'PROVIDER_AMBIGUOUS' });
  });
});

describe('invokeCapability — OS-9 canary: delegation-depth / loop violations', () => {
  beforeEach(() => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);
  });

  it('refuses DEPTH_EXCEEDED when delegationDepth >= maxInvocationDepth', async () => {
    const decision = await invokeCapability(baseEnvelope({ delegationDepth: 2, maxInvocationDepth: 2 }));
    expect(decision).toMatchObject({ decision: 'refuse', code: 'DEPTH_EXCEEDED' });
  });

  it('refuses CIRCULAR_INVOCATION when the resolved provider already appears in invocationPath', async () => {
    const decision = await invokeCapability(baseEnvelope({ invocationPath: ['aigent-nakamoto'] }));
    expect(decision).toMatchObject({ decision: 'refuse', code: 'CIRCULAR_INVOCATION' });
  });

  it('refuses PROVIDER_MAY_NOT_ORCHESTRATE when the resolved provider is also named as the orchestrator', async () => {
    const decision = await invokeCapability(
      baseEnvelope({ requestingAgentId: 'aigent-nakamoto', orchestratorAgentId: 'aigent-nakamoto' }),
    );
    expect(decision).toMatchObject({ decision: 'refuse', code: 'PROVIDER_MAY_NOT_ORCHESTRATE' });
  });

  it('refuses DIRECT_REQUEST_TARGET_MISMATCH when a direct request names a capability it does not itself provide', async () => {
    const decision = await invokeCapability(
      baseEnvelope({ requestingAgentId: 'aigent-moneypenny', orchestratorAgentId: undefined }),
    );
    expect(decision).toMatchObject({ decision: 'refuse', code: 'DIRECT_REQUEST_TARGET_MISMATCH' });
  });
});

describe('invokeCapability — MODE_NOT_PERMITTED structurally refuses authoritative', () => {
  it('never reaches allow for executionMode "authoritative", regardless of other facts holding', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);

    const decision = await invokeCapability(baseEnvelope({ executionMode: 'authoritative' }));

    expect(decision).toMatchObject({ decision: 'refuse', code: 'MODE_NOT_PERMITTED' });
  });
});

describe('invokeCapability — authority gate', () => {
  it('refuses ORCHESTRATOR_NOT_DELEGATED when the orchestrator has no active delegation', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);
    mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
      Promise.resolve({ delegationActive: agent.runtimeAgentId !== 'aigent-moneypenny' }),
    );

    const decision = await invokeCapability(baseEnvelope());

    expect(decision).toMatchObject({ decision: 'refuse', code: 'ORCHESTRATOR_NOT_DELEGATED' });
  });

  it('refuses PROVIDER_NOT_ADMITTED when the resolved provider has no independently active admission', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([NAKAMOTO_PROVIDER]);
    mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
      Promise.resolve({ delegationActive: agent.runtimeAgentId !== 'aigent-nakamoto' }),
    );

    const decision = await invokeCapability(baseEnvelope());

    expect(decision).toMatchObject({ decision: 'refuse', code: 'PROVIDER_NOT_ADMITTED' });
  });
});
