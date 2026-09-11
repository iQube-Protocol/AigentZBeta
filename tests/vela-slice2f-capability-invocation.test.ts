/**
 * VELA-001 Slice 2F canaries — MoneyPenny's `CONFIDENTIAL_CONSEQUENCE_PROJECTION`
 * capability through the EXISTING `invokeCapability()` gateway, per the
 * operator ruling 2026-08-22: "Do not create a parallel MoneyPenny invocation
 * path. Gate 2 consumes the unified ConsequenceProjection."
 *
 * Mirrors this repo's own existing mocking convention for this exact function
 * (`tests/governed-capability-invocation.test.ts`) — only the DB-backed
 * capability-registry/admission-state seams are stood in, exactly as that
 * file already does for every other capability. Nothing about Vela, the
 * composition seam, Gate 2's consequence-projection logic, or authorisation
 * derivation is mocked anywhere in this file.
 *
 * Two proof tiers:
 *  1. Deterministic (always runs, no Docker) — a `VelaTestTransport`-backed
 *     projection drives the full matrix fast, for CI.
 *  2. Live (opt-in via `VELA_SLICE2F_LIVE=1`) — a REAL confidential projection
 *     from the running local Vela stack drives the same full traversal:
 *     authority -> CFS-006a public projection -> LIVE Vela confidential
 *     projection -> unified projection -> Gate 2 (real invokeCapability()) ->
 *     authorisation/refusal (real deriveActionAuthorisation()), for
 *     ACCEPTABLE, UNACCEPTABLE and UNRESOLVED.
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

vi.mock('@/services/registry/persistence', () => ({ getAsset: vi.fn() }));
vi.mock('@/services/policy/skillQubePolicyGate', () => ({ evaluateSkillQubePolicy: vi.fn() }));

import { invokeCapability } from '@/services/registry/invocationGateway';
import { evaluateCapabilityAndRuntimeGate } from '@/services/registry/capabilityInvocationGates';
import type { CapabilityInvocation } from '@/types/capabilityInvocation';
import { composeUnifiedConsequenceProjection } from '@/services/constitutionalCommerce/unifiedConsequenceProjection';
import { deriveActionAuthorisation } from '@/services/constitutionalCommerce/actionAuthorisation';
import type { ConsequenceForecast } from '@/types/consequence';
import type { ConstitutionalAuthority, ConsequenceProjection } from '@/types/constitutionalCommerce';
import { VelaConfidentialProjectionProvider } from '@/services/vela/velaProjectionProvider';
import { VelaTestTransport } from '@/services/vela/velaTestTransport';
import { VELA_LOCAL_DEPLOYMENT } from '@/services/vela/velaConfig';

const CAPABILITY_ID = 'CONFIDENTIAL_CONSEQUENCE_PROJECTION';

const MONEYPENNY_PROVIDER = {
  capabilityId: CAPABILITY_ID,
  providerAgentId: 'aigent-moneypenny',
  registryAssetId: 'aigentqube-moneypenny',
  runtimeMembershipRef: 'financial-services',
  benchRow: {
    runtimeMemberships: [{ runtimeId: 'financial-services', status: 'approved', eligibility: { satisfied: [], outstanding: [] } }],
  },
};
const MONEYPENNY_AGENT = { runtimeAgentId: 'aigent-moneypenny', aigentQubeId: 'aigentqube-moneypenny' };

const ACTIVE_AUTHORITY: ConstitutionalAuthority = {
  principalRef: 'polref-abc123',
  actorRef: 'aigent-moneypenny',
  authoritySource: 'passport+standing',
  mandateRef: 'mandate-fs-1',
  state: 'ACTIVE',
};

function baseEnvelope(overrides: Partial<CapabilityInvocation> = {}): CapabilityInvocation {
  return {
    mode: 'capability',
    invocationId: 'inv-slice2f-1',
    principalRef: ACTIVE_AUTHORITY.principalRef,
    originatingSurface: 'financial-services',
    // Direct specialist pattern (same shape as the existing Nakamoto
    // direct-specialist canary): MoneyPenny requests its own capability,
    // no orchestrator.
    requestingAgentId: 'aigent-moneypenny',
    orchestratorAgentId: undefined,
    capabilityId: CAPABILITY_ID,
    runtimeMembershipRef: 'financial-services',
    executionMode: 'authoritative',
    intent: 'Execute a confidentially-projected payment under mandate-fs-1',
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
  mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_PROVIDER]);
  mockResolveRegistrableAgentByRuntimeId.mockImplementation((id: string) =>
    id === 'aigent-moneypenny' ? MONEYPENNY_AGENT : null,
  );
  mockResolveAgentAdmissionState.mockResolvedValue({ registryActivated: true });
});

// ── Fixtures: deterministic projections (VelaTestTransport, no Docker) ────

function forecast(over: Partial<ConsequenceForecast> = {}): ConsequenceForecast {
  return {
    seedInvariantIds: ['inv.finance.001'],
    nodes: [],
    enables: 2,
    constrains: 0,
    contradicts: 0,
    forcesEscalation: false,
    constitutionalConstraint: false,
    constitutionalConstraintIds: [],
    rationale: 'test forecast',
    ...over,
  };
}
const PUBLIC_ACCEPTABLE = forecast();

async function deterministicProjection(
  verdict: 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED' | 'ABSENT',
): Promise<ConsequenceProjection> {
  if (verdict === 'ABSENT') {
    return composeUnifiedConsequenceProjection({
      projectionContextRef: 'ctx-slice2f-1',
      actionRef: 'action-slice2f-1',
      authorityRef: ACTIVE_AUTHORITY.principalRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      publicForecast: PUBLIC_ACCEPTABLE,
      confidentialRequirement: 'REQUIRED',
      confidentialEvidence: null,
    });
  }
  const transport = new VelaTestTransport({
    deployment: VELA_LOCAL_DEPLOYMENT,
    registeredTeeSigner: '0x2a0fba02cee7fb70899648037c7E8203881e2D55',
    verdictFor: () => JSON.stringify({ verdict }),
  });
  const provider = new VelaConfidentialProjectionProvider(transport, 'test-app');
  const prepared = await provider.prepareProjection({
    actionRef: 'action-slice2f-1',
    mandateRef: ACTIVE_AUTHORITY.mandateRef,
    identities: {
      authorityPrincipal: ACTIVE_AUTHORITY.principalRef,
      mandateSigner: ACTIVE_AUTHORITY.principalRef,
      confidentialRequester: 'aigent-moneypenny',
      confidentialPrivacyIdentity: 'aigent-moneypenny',
      executionSigner: 'aigent-moneypenny',
    },
    confidentialInputs: { proposedSpend: 1 },
  });
  const submission = await provider.submitProjection(prepared);
  const evidence = await provider.getProjectionEvidence(submission.requestRef);
  const verification = await provider.verifyProjectionEvidence(evidence);

  return composeUnifiedConsequenceProjection({
    projectionContextRef: 'ctx-slice2f-1',
    actionRef: 'action-slice2f-1',
    authorityRef: ACTIVE_AUTHORITY.principalRef,
    mandateRef: ACTIVE_AUTHORITY.mandateRef,
    publicForecast: PUBLIC_ACCEPTABLE,
    confidentialRequirement: 'REQUIRED',
    confidentialEvidence: {
      provider: 'vela',
      requestRef: evidence.requestRef,
      disposition: evidence.disposition,
      resultCommitment: evidence.resultCommitment,
      payloadCommitment: evidence.payloadCommitment,
      protocolExecutionVerified: verification.protocolExecutionVerified,
      teeAttestationVerified: verification.teeAttestationVerified,
      attestationMode: verification.attestationMode,
    },
    policy: { attestationRequirement: 'NOT_REQUIRED' },
  });
}

// ── Gate 2, in isolation ───────────────────────────────────────────────────

describe('Gate 2 — evaluateCapabilityAndRuntimeGate consumes the unified projection', () => {
  it('ACCEPTABLE lets an authoritative CONFIDENTIAL_CONSEQUENCE_PROJECTION invocation pass', async () => {
    const projection = await deterministicProjection('ACCEPTABLE');
    const result = evaluateCapabilityAndRuntimeGate(
      baseEnvelope({ consequenceProjection: projection }),
      MONEYPENNY_PROVIDER as any,
    );
    expect(result).toEqual({ ok: true });
  });

  it('UNACCEPTABLE refuses with CONSEQUENCE_PROJECTION_UNACCEPTABLE', async () => {
    const projection = await deterministicProjection('UNACCEPTABLE');
    const result = evaluateCapabilityAndRuntimeGate(
      baseEnvelope({ consequenceProjection: projection }),
      MONEYPENNY_PROVIDER as any,
    );
    expect(result).toMatchObject({ ok: false, code: 'CONSEQUENCE_PROJECTION_UNACCEPTABLE' });
  });

  it('UNRESOLVED refuses with CONSEQUENCE_PROJECTION_UNRESOLVED', async () => {
    const projection = await deterministicProjection('UNRESOLVED');
    const result = evaluateCapabilityAndRuntimeGate(
      baseEnvelope({ consequenceProjection: projection }),
      MONEYPENNY_PROVIDER as any,
    );
    expect(result).toMatchObject({ ok: false, code: 'CONSEQUENCE_PROJECTION_UNRESOLVED' });
  });

  it('an absent projection on the gated capability refuses CONSEQUENCE_PROJECTION_UNRESOLVED', () => {
    const result = evaluateCapabilityAndRuntimeGate(
      baseEnvelope({ consequenceProjection: undefined }),
      MONEYPENNY_PROVIDER as any,
    );
    expect(result).toMatchObject({ ok: false, code: 'CONSEQUENCE_PROJECTION_UNRESOLVED' });
  });

  it('REGRESSION: every other capability still hits MODE_NOT_PERMITTED unconditionally in authoritative mode', async () => {
    const projection = await deterministicProjection('ACCEPTABLE'); // even an ACCEPTABLE projection
    const otherProvider = { ...MONEYPENNY_PROVIDER, capabilityId: 'bitcoin_decentralisation_expertise' };
    const result = evaluateCapabilityAndRuntimeGate(
      baseEnvelope({
        capabilityId: 'bitcoin_decentralisation_expertise',
        consequenceProjection: projection,
      }),
      otherProvider as any,
    );
    expect(result).toMatchObject({ ok: false, code: 'MODE_NOT_PERMITTED' });
  });

  it('preview/shadow modes for CONFIDENTIAL_CONSEQUENCE_PROJECTION are unaffected by the exception (no projection needed)', () => {
    const result = evaluateCapabilityAndRuntimeGate(
      baseEnvelope({ executionMode: 'shadow', consequenceProjection: undefined }),
      MONEYPENNY_PROVIDER as any,
    );
    expect(result).toEqual({ ok: true });
  });
});

// ── Full invokeCapability() traversal — real gateway, mocked DB seams ─────

describe('invokeCapability() — full traversal for CONFIDENTIAL_CONSEQUENCE_PROJECTION', () => {
  it('ACCEPTABLE projection reaches allow', async () => {
    const projection = await deterministicProjection('ACCEPTABLE');
    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    expect(decision.decision).toBe('allow');
  });

  it('UNACCEPTABLE projection refuses with CONSEQUENCE_PROJECTION_UNACCEPTABLE', async () => {
    const projection = await deterministicProjection('UNACCEPTABLE');
    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    expect(decision).toMatchObject({ decision: 'refuse', code: 'CONSEQUENCE_PROJECTION_UNACCEPTABLE' });
  });

  it('UNRESOLVED projection refuses with CONSEQUENCE_PROJECTION_UNRESOLVED', async () => {
    const projection = await deterministicProjection('UNRESOLVED');
    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    expect(decision).toMatchObject({ decision: 'refuse', code: 'CONSEQUENCE_PROJECTION_UNRESOLVED' });
  });

  it('an ACCEPTABLE projection still respects Gate 1 — no authority admission, no allow', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({ registryActivated: false });
    const projection = await deterministicProjection('ACCEPTABLE');
    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    // Gate 2's exception never bypasses Gate 1 — "preserve all authority,
    // mandate and execution gates around it."
    expect(decision.decision).toBe('refuse');
    expect(decision).not.toMatchObject({ code: 'CONSEQUENCE_PROJECTION_UNACCEPTABLE' });
  });

  it('an ACCEPTABLE projection does NOT independently mean AUTHORIZED — allow carries no authorisation vocabulary', async () => {
    const projection = await deterministicProjection('ACCEPTABLE');
    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    const serialised = JSON.stringify(decision);
    for (const forbidden of ['AUTHORISED', 'AUTHORIZED', 'authorisationRef']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

// ── deriveActionAuthorisation() — the terminal step ───────────────────────

describe('deriveActionAuthorisation()', () => {
  async function decisionFor(verdict: 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED' | 'ABSENT') {
    const projection = await deterministicProjection(verdict);
    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    return { projection, decision };
  }

  it('ACCEPTABLE projection + active authority + allow ⇒ AUTHORISED', async () => {
    const { projection, decision } = await decisionFor('ACCEPTABLE');
    const auth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('AUTHORISED');
    expect(auth.expiresAt).toBeDefined();
    expect(auth.projectionRef).toBe(projection.projectionRef);
  });

  it('UNACCEPTABLE projection ⇒ REFUSED', async () => {
    const { projection, decision } = await decisionFor('UNACCEPTABLE');
    const auth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('REFUSED');
  });

  it('UNRESOLVED projection ⇒ UNRESOLVED, not REFUSED', async () => {
    const { projection, decision } = await decisionFor('UNRESOLVED');
    const auth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('UNRESOLVED');
  });

  it('absent projection ⇒ UNRESOLVED (gate refusal code is CONSEQUENCE_PROJECTION_UNRESOLVED)', async () => {
    const { projection, decision } = await decisionFor('ABSENT');
    const auth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('UNRESOLVED');
  });

  it('inactive authority ⇒ REFUSED regardless of an ACCEPTABLE projection', async () => {
    const { projection, decision } = await decisionFor('ACCEPTABLE');
    const auth = deriveActionAuthorisation({
      authority: { ...ACTIVE_AUTHORITY, state: 'PENDING' },
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('REFUSED');
  });

  it('a gate refusal for an UNRELATED reason (e.g. depth exceeded) is REFUSED, not UNRESOLVED', async () => {
    const projection = await deterministicProjection('ACCEPTABLE');
    const decision = await invokeCapability(
      baseEnvelope({ consequenceProjection: projection, delegationDepth: 2, maxInvocationDepth: 2 }),
    );
    expect(decision).toMatchObject({ decision: 'refuse', code: 'DEPTH_EXCEEDED' });
    const auth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('REFUSED');
  });

  it('independently re-checks the projection — an UNACCEPTABLE projection is REFUSED even if a decision object incorrectly said allow', () => {
    // Defends against a future bug where invokeCapability's allow path is
    // reached without Gate 2 actually having run — authorisation must never
    // trust the gate blindly.
    const badProjection: ConsequenceProjection = {
      projectionRef: 'proj-x',
      projectionContextRef: 'ctx-x',
      actionRef: 'action-x',
      authorityRef: ACTIVE_AUTHORITY.principalRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      projectedConsequences: [],
      invariantFindings: [],
      public: { source: 'consequence_operating_model', disposition: 'ACCEPTABLE', forecastRef: 'f', forecast: PUBLIC_ACCEPTABLE, reason: 'r' },
      confidential: { requirement: 'REQUIRED', disposition: 'UNACCEPTABLE', provider: 'vela', requestRef: 'req', evidenceRef: 'e', payloadCommitment: 'p', protocolExecutionVerified: true, teeAttestationVerified: false, attestationMode: 'NO_ATTESTATION_LOCAL', reason: 'r' },
      disposition: 'UNACCEPTABLE',
      completeness: 'COMPLETE',
      unresolvedComponents: [],
      compositionRationale: 'r',
    };
    const auth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection: badProjection,
      invocationDecision: { decision: 'allow', envelope: {} as any },
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(auth.status).toBe('REFUSED');
  });

  it('the module never imports Vela types', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(
      join(process.cwd(), 'services/constitutionalCommerce/actionAuthorisation.ts'),
      'utf8',
    );
    const imports = src.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
    for (const block of imports) {
      expect(block).not.toMatch(/services\/vela/);
    }
  });
});

// ── Live tier (opt-in) ─────────────────────────────────────────────────────
// Set VELA_SLICE2F_LIVE=1 plus VELA_APP_ID/VELA_EVM_KEY/VELA_P521_KEY to run
// the SAME traversal above against a real running local Vela stack instead
// of VelaTestTransport. Skipped by default so `npm test` needs no Docker.

const LIVE = process.env.VELA_SLICE2F_LIVE === '1';

describe.skipIf(!LIVE)('LIVE — full traversal against the real local Vela enclave', () => {
  it('ACCEPTABLE, UNACCEPTABLE and UNRESOLVED all traverse authority -> public -> LIVE confidential -> unified -> Gate 2 -> authorisation', async () => {
    const { VelaClientAdapter } = await import('@/services/vela/velaClientAdapter');
    const appId = process.env.VELA_APP_ID!;
    const evmKey = process.env.VELA_EVM_KEY!;
    const p521Key = process.env.VELA_P521_KEY!;

    const transport = new VelaClientAdapter({
      deployment: VELA_LOCAL_DEPLOYMENT,
      requesterPrivateKeyHex: evmKey,
      requesterP521PrivateKeyHex: p521Key,
      maxFeeValueWei: 1_000_000n,
    });
    const provider = new VelaConfidentialProjectionProvider(transport, appId);

    async function liveProjection(inputs: Record<string, number>) {
      const prepared = await provider.prepareProjection({
        actionRef: 'live-slice2f-action',
        mandateRef: ACTIVE_AUTHORITY.mandateRef,
        identities: {
          authorityPrincipal: ACTIVE_AUTHORITY.principalRef,
          mandateSigner: ACTIVE_AUTHORITY.principalRef,
          confidentialRequester: 'aigent-moneypenny',
          confidentialPrivacyIdentity: 'aigent-moneypenny',
          executionSigner: 'aigent-moneypenny',
        },
        confidentialInputs: inputs,
      });
      const submission = await provider.submitProjection(prepared);
      let status = await provider.getProjectionStatus(submission.requestRef);
      for (let i = 0; i < 60 && status.state === 'OBSERVING'; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        status = await provider.getProjectionStatus(submission.requestRef);
      }
      const evidence = await provider.getProjectionEvidence(submission.requestRef);
      const verification = await provider.verifyProjectionEvidence(evidence);
      return composeUnifiedConsequenceProjection({
        projectionContextRef: 'ctx-slice2f-live',
        actionRef: 'live-slice2f-action',
        authorityRef: ACTIVE_AUTHORITY.principalRef,
        mandateRef: ACTIVE_AUTHORITY.mandateRef,
        publicForecast: PUBLIC_ACCEPTABLE,
        confidentialRequirement: 'REQUIRED',
        confidentialEvidence: {
          provider: 'vela',
          requestRef: evidence.requestRef,
          disposition: evidence.disposition,
          resultCommitment: evidence.resultCommitment,
          payloadCommitment: evidence.payloadCommitment,
          protocolExecutionVerified: verification.protocolExecutionVerified,
          teeAttestationVerified: verification.teeAttestationVerified,
          attestationMode: verification.attestationMode,
        },
        policy: { attestationRequirement: 'NOT_REQUIRED' },
      });
    }

    const cases: Array<{ inputs: Record<string, number>; expect: 'ACCEPTABLE' | 'UNACCEPTABLE' }> = [
      {
        inputs: { currentExposure: 0, proposedSpend: 1, privateSpendLimit: 10, privateRiskLimit: 10 },
        expect: 'ACCEPTABLE',
      },
      {
        inputs: { currentExposure: 0, proposedSpend: 100, privateSpendLimit: 10, privateRiskLimit: 10 },
        expect: 'UNACCEPTABLE',
      },
    ];

    for (const c of cases) {
      const projection = await liveProjection(c.inputs);
      expect(projection.disposition).toBe(c.expect);

      const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
      if (c.expect === 'ACCEPTABLE') {
        expect(decision.decision).toBe('allow');
      } else {
        expect(decision).toMatchObject({ decision: 'refuse', code: 'CONSEQUENCE_PROJECTION_UNACCEPTABLE' });
      }

      const auth = deriveActionAuthorisation({
        authority: ACTIVE_AUTHORITY,
        projection,
        invocationDecision: decision,
        now: new Date().toISOString(),
      });
      expect(auth.status).toBe(c.expect === 'ACCEPTABLE' ? 'AUTHORISED' : 'REFUSED');
    }

    // UNRESOLVED: REQUIRED confidential deliberately absent.
    const unresolvedProjection = composeUnifiedConsequenceProjection({
      projectionContextRef: 'ctx-slice2f-live',
      actionRef: 'live-slice2f-action-unresolved',
      authorityRef: ACTIVE_AUTHORITY.principalRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      publicForecast: PUBLIC_ACCEPTABLE,
      confidentialRequirement: 'REQUIRED',
      confidentialEvidence: null,
    });
    const unresolvedDecision = await invokeCapability(
      baseEnvelope({ consequenceProjection: unresolvedProjection }),
    );
    expect(unresolvedDecision).toMatchObject({ decision: 'refuse', code: 'CONSEQUENCE_PROJECTION_UNRESOLVED' });
    const unresolvedAuth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection: unresolvedProjection,
      invocationDecision: unresolvedDecision,
      now: new Date().toISOString(),
    });
    expect(unresolvedAuth.status).toBe('UNRESOLVED');
  }, 180_000);
});
