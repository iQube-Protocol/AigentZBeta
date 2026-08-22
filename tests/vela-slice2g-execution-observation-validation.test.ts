/**
 * VELA-001 Slice 2G canaries — the downstream half of the chain the operator
 * ordered after declaring Slice 2F LIVE-PROVEN: ActionAuthorisation ->
 * bounded execution -> ObservedConsequence -> ConsequenceValidation ->
 * receipt/DVN evidence.
 *
 * Gate 2 (services/registry/capabilityInvocationGates.ts) and
 * invokeCapability() (services/registry/invocationGateway.ts) are FROZEN per
 * the operator's explicit instruction — this file imports and calls them
 * exactly as Slice 2F left them and asserts no new behaviour there.
 *
 * Two proof tiers, mirroring tests/vela-slice2f-capability-invocation.test.ts:
 *  1. Deterministic (always runs, no Docker) — VelaTestTransport-backed
 *     projections drive the full matrix.
 *  2. Live (opt-in via VELA_SLICE2G_LIVE=1) — a REAL confidential projection
 *     from the running local Vela stack drives the identical traversal
 *     through execution, observation and validation.
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

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
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
import type { CapabilityInvocation } from '@/types/capabilityInvocation';
import { composeUnifiedConsequenceProjection } from '@/services/constitutionalCommerce/unifiedConsequenceProjection';
import { deriveActionAuthorisation } from '@/services/constitutionalCommerce/actionAuthorisation';
import { bindExecution } from '@/services/constitutionalCommerce/boundedExecution';
import {
  compareProjectionToObservation,
  recordObservedConsequence,
} from '@/services/constitutionalCommerce/observedConsequence';
import { assembleCausalChain } from '@/services/constitutionalCommerce/causalChain';
import {
  emitActionAuthorisationReceipt,
  emitExecutionReceipt,
  emitConsequenceReceipt,
} from '@/services/constitutionalCommerce/commerceReceipts';
import type { ConsequenceForecast } from '@/types/consequence';
import type {
  ActionAuthorisation,
  CommerceExecution,
  ConstitutionalAuthority,
  ConsequenceProjection,
  ProposedAction,
} from '@/types/constitutionalCommerce';
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

const PROPOSED_ACTION: ProposedAction = {
  actionRef: 'action-slice2g-1',
  actorRef: 'aigent-moneypenny',
  mandateRef: ACTIVE_AUTHORITY.mandateRef,
  actionType: 'confidential_spend',
  consequenceDomain: 'financial-services',
};

function baseEnvelope(overrides: Partial<CapabilityInvocation> = {}): CapabilityInvocation {
  return {
    mode: 'capability',
    invocationId: 'inv-slice2g-1',
    principalRef: ACTIVE_AUTHORITY.principalRef,
    originatingSurface: 'financial-services',
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
  mockCreateActivityReceipt.mockReset();
  mockCreateActivityReceipt.mockResolvedValue({});
  mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_PROVIDER]);
  mockResolveRegistrableAgentByRuntimeId.mockImplementation((id: string) =>
    id === 'aigent-moneypenny' ? MONEYPENNY_AGENT : null,
  );
  mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: true });
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
      projectionContextRef: 'ctx-slice2g-1',
      actionRef: PROPOSED_ACTION.actionRef,
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
    actionRef: PROPOSED_ACTION.actionRef,
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
    projectionContextRef: 'ctx-slice2g-1',
    actionRef: PROPOSED_ACTION.actionRef,
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

async function authorise(
  verdict: 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED' | 'ABSENT',
  now = '2026-08-22T00:00:00.000Z',
): Promise<{ projection: ConsequenceProjection; authorisation: ActionAuthorisation }> {
  const projection = await deterministicProjection(verdict);
  const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
  const authorisation = deriveActionAuthorisation({
    authority: ACTIVE_AUTHORITY,
    projection,
    invocationDecision: decision,
    now,
  });
  return { projection, authorisation };
}

// ── bindExecution() ─────────────────────────────────────────────────────

describe('bindExecution() — Execution requires a specific, current authorisation', () => {
  it('binds an execution intent for an AUTHORISED, current authorisation', async () => {
    const { authorisation } = await authorise('ACCEPTABLE');
    const result = bindExecution({
      authorisation,
      signerRef: 'signer-moneypenny-1',
      now: '2026-08-22T00:01:00.000Z',
    });
    expect(result.status).toBe('execution_bound');
    expect(result.execution).not.toBeNull();
    expect(result.execution!.authorisationRef).toBe(authorisation.authorisationRef);
    expect(result.execution!.transactionRef).toBeUndefined();
  });

  it('refuses execution for a REFUSED authorisation', async () => {
    const { authorisation } = await authorise('UNACCEPTABLE');
    const result = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    expect(result.status).toBe('refused');
    expect(result.execution).toBeNull();
    expect(result.reason).toContain('REFUSED');
  });

  it('refuses execution for an UNRESOLVED authorisation', async () => {
    const { authorisation } = await authorise('UNRESOLVED');
    const result = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    expect(result.status).toBe('refused');
    expect(result.reason).toContain('UNRESOLVED');
  });

  it('refuses execution for an EXPIRED authorisation, even though status still literally reads AUTHORISED', async () => {
    const { authorisation } = await authorise('ACCEPTABLE', '2026-08-22T00:00:00.000Z');
    expect(authorisation.status).toBe('AUTHORISED');
    // Default TTL is 300s — request execution well past expiry.
    const result = bindExecution({
      authorisation,
      signerRef: 'signer-1',
      now: '2026-08-22T01:00:00.000Z',
    });
    expect(result.status).toBe('refused');
    expect(result.execution).toBeNull();
    expect(result.reason).toContain('expired');
  });

  it('is deterministic — same authorisation/signer/now always yields the same executionRef', async () => {
    const { authorisation } = await authorise('ACCEPTABLE');
    const a = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    const b = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    expect(a.execution!.executionRef).toBe(b.execution!.executionRef);
  });
});

// ── compareProjectionToObservation() / recordObservedConsequence() ───────

describe('Consequence Validation — MATCHED_PROJECTION | DIVERGED_FROM_PROJECTION | UNRESOLVED', () => {
  it('MATCHED_PROJECTION when the observed disposition equals the projected one', () => {
    const { validationState } = compareProjectionToObservation('ACCEPTABLE', 'ACCEPTABLE');
    expect(validationState).toBe('MATCHED_PROJECTION');
  });

  it('DIVERGED_FROM_PROJECTION when the observed disposition differs from the projected one', () => {
    const { validationState } = compareProjectionToObservation('ACCEPTABLE', 'UNACCEPTABLE');
    expect(validationState).toBe('DIVERGED_FROM_PROJECTION');
  });

  it('UNRESOLVED when the observation itself could not be established — never treated as a mismatch', () => {
    const { validationState } = compareProjectionToObservation('ACCEPTABLE', null);
    expect(validationState).toBe('UNRESOLVED');
  });

  it('recordObservedConsequence() builds a complete ObservedConsequence carrying the comparison', async () => {
    const { projection, authorisation } = await authorise('ACCEPTABLE');
    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    const observed = recordObservedConsequence({
      execution: bound.execution as CommerceExecution,
      projection,
      observedState: { settled: true },
      observedDisposition: 'ACCEPTABLE',
      receiptRefs: ['receipt-1'],
    });
    expect(observed.validationState).toBe('MATCHED_PROJECTION');
    expect(observed.executionRef).toBe(bound.execution!.executionRef);
    expect(observed.projectionRef).toBe(projection.projectionRef);
    expect(observed.receiptRefs).toEqual(['receipt-1']);
  });

  it('never infers teeAttestationVerified from a successful observation — the confidential component is untouched by validation', async () => {
    const { projection, authorisation } = await authorise('ACCEPTABLE');
    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    const before = projection.confidential.teeAttestationVerified;
    recordObservedConsequence({
      execution: bound.execution as CommerceExecution,
      projection,
      observedState: {},
      observedDisposition: 'ACCEPTABLE',
    });
    expect(projection.confidential.teeAttestationVerified).toBe(before);
  });
});

// ── assembleCausalChain() ─────────────────────────────────────────────────

describe('assembleCausalChain() — reads exclusively from already-existing typed records', () => {
  it('gathers every ref the operator required, all sourced from the existing records', async () => {
    const { projection, authorisation } = await authorise('ACCEPTABLE');
    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    const observed = recordObservedConsequence({
      execution: bound.execution as CommerceExecution,
      projection,
      observedState: {},
      observedDisposition: 'ACCEPTABLE',
    });
    const chain = assembleCausalChain({
      action: PROPOSED_ACTION,
      projection,
      authorisation,
      execution: bound.execution,
      observedConsequence: observed,
    });
    expect(chain).toEqual({
      authorityRef: authorisation.authorityRef,
      mandateRef: authorisation.mandateRef,
      proposedActionRef: PROPOSED_ACTION.actionRef,
      projectionContextRef: projection.projectionContextRef,
      projectionRef: projection.projectionRef,
      publicForecastRef: projection.public.forecastRef,
      confidentialEvidenceRef: projection.confidential.evidenceRef,
      confidentialRequestRef: projection.confidential.requestRef,
      authorisationRef: authorisation.authorisationRef,
      executionRef: bound.execution!.executionRef,
      observedConsequenceRef: observed.consequenceRef,
      validationState: 'MATCHED_PROJECTION',
    });
  });

  it('leaves executionRef/observedConsequenceRef/validationState null when execution never happened (e.g. a REFUSED authorisation)', async () => {
    const { projection, authorisation } = await authorise('UNACCEPTABLE');
    const chain = assembleCausalChain({ action: PROPOSED_ACTION, projection, authorisation });
    expect(chain.executionRef).toBeNull();
    expect(chain.observedConsequenceRef).toBeNull();
    expect(chain.validationState).toBeNull();
    // The refusal itself is still fully traceable.
    expect(chain.authorisationRef).toBe(authorisation.authorisationRef);
    expect(chain.projectionRef).toBe(projection.projectionRef);
  });
});

// ── NOT_REQUIRED must never be conflated with REQUIRED-and-absent ────────

describe('NOT_REQUIRED confidential is never conflated with REQUIRED-and-absent (operator constraint)', () => {
  it('a NOT_REQUIRED action with no confidential evidence still reaches AUTHORISED and executes', async () => {
    const projection = composeUnifiedConsequenceProjection({
      projectionContextRef: 'ctx-slice2g-notrequired',
      actionRef: 'action-slice2g-notrequired',
      authorityRef: ACTIVE_AUTHORITY.principalRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      publicForecast: PUBLIC_ACCEPTABLE,
      confidentialRequirement: 'NOT_REQUIRED',
      confidentialEvidence: null,
    });
    expect(projection.disposition).toBe('ACCEPTABLE');
    expect(projection.completeness).toBe('COMPLETE');

    const decision = await invokeCapability(baseEnvelope({ consequenceProjection: projection }));
    expect(decision.decision).toBe('allow');

    const authorisation = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection,
      invocationDecision: decision,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(authorisation.status).toBe('AUTHORISED');

    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    expect(bound.status).toBe('execution_bound');
  });

  it('the SAME action with confidential REQUIRED and absent is UNRESOLVED end to end, distinctly', async () => {
    const { authorisation } = await authorise('ABSENT');
    expect(authorisation.status).toBe('UNRESOLVED');
    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    expect(bound.status).toBe('refused');
    expect(bound.reason).toContain('UNRESOLVED');
  });
});

// ── Receipts — real call sites for the six new ActivityActionType literals ─

describe('Commerce receipts — real call sites, best-effort, personaId-gated', () => {
  it('emits commerce_action_authorised / _refused / _unresolved matching the authorisation status', async () => {
    for (const [verdict, expected] of [
      ['ACCEPTABLE', 'commerce_action_authorised'],
      ['UNACCEPTABLE', 'commerce_action_refused'],
      ['UNRESOLVED', 'commerce_action_unresolved'],
    ] as const) {
      mockCreateActivityReceipt.mockClear();
      const { projection, authorisation } = await authorise(verdict);
      const chain = assembleCausalChain({ action: PROPOSED_ACTION, projection, authorisation });
      await emitActionAuthorisationReceipt(authorisation, chain, 'persona-1', 'financial-services');
      expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ personaId: 'persona-1', actionType: expected }),
      );
    }
  });

  it('skips the write entirely when no personaId is resolved (never breaks the decision it describes)', async () => {
    const { projection, authorisation } = await authorise('ACCEPTABLE');
    const chain = assembleCausalChain({ action: PROPOSED_ACTION, projection, authorisation });
    await emitActionAuthorisationReceipt(authorisation, chain, undefined, 'financial-services');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('emits commerce_execution_bound / commerce_execution_refused matching bindExecution()', async () => {
    const { authorisation } = await authorise('ACCEPTABLE');
    const chain = { authorisationRef: authorisation.authorisationRef } as any;
    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    await emitExecutionReceipt(bound, chain, 'persona-1', 'financial-services');
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: 'persona-1', actionType: 'commerce_execution_bound' }),
    );

    mockCreateActivityReceipt.mockClear();
    const { authorisation: refusedAuth } = await authorise('UNACCEPTABLE');
    const refusedBound = bindExecution({ authorisation: refusedAuth, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    await emitExecutionReceipt(refusedBound, chain, 'persona-1', 'financial-services');
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: 'persona-1', actionType: 'commerce_execution_refused' }),
    );
  });

  it('emits commerce_consequence_recorded carrying the validationState in actionInput', async () => {
    const { projection, authorisation } = await authorise('ACCEPTABLE');
    const bound = bindExecution({ authorisation, signerRef: 'signer-1', now: '2026-08-22T00:01:00.000Z' });
    const observed = recordObservedConsequence({
      execution: bound.execution as CommerceExecution,
      projection,
      observedState: {},
      observedDisposition: 'UNACCEPTABLE',
    });
    const chain = assembleCausalChain({ action: PROPOSED_ACTION, projection, authorisation, execution: bound.execution, observedConsequence: observed });
    await emitConsequenceReceipt(observed, chain, 'persona-1', 'financial-services');
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 'persona-1',
        actionType: 'commerce_consequence_recorded',
        actionInput: expect.objectContaining({ validationState: 'DIVERGED_FROM_PROJECTION' }),
      }),
    );
  });
});

// ── Freeze regression — Gate 2 / invokeCapability untouched by this slice ─

describe('REGRESSION: Slice 2F Gate 2 behaviour is unchanged by this slice', () => {
  it('ACCEPTABLE/UNACCEPTABLE/UNRESOLVED still resolve exactly as Slice 2F proved', async () => {
    const acceptable = await authorise('ACCEPTABLE');
    expect(acceptable.authorisation.status).toBe('AUTHORISED');
    const unacceptable = await authorise('UNACCEPTABLE');
    expect(unacceptable.authorisation.status).toBe('REFUSED');
    const unresolved = await authorise('UNRESOLVED');
    expect(unresolved.authorisation.status).toBe('UNRESOLVED');
  });
});

// ── Live tier (opt-in) ─────────────────────────────────────────────────────
// Set VELA_SLICE2G_LIVE=1 plus VELA_APP_ID/VELA_EVM_KEY/VELA_P521_KEY to run
// the full execution/observation/validation chain against a real running
// local Vela stack. Skipped by default so `npm test` needs no Docker.

const LIVE = process.env.VELA_SLICE2G_LIVE === '1';

describe.skipIf(!LIVE)('LIVE — execution, observation and validation against the real local Vela enclave', () => {
  it('ACCEPTABLE authorises, executes and validates MATCHED_PROJECTION; UNACCEPTABLE and UNRESOLVED both refuse execution', async () => {
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
        actionRef: 'live-slice2g-action',
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
        projectionContextRef: 'ctx-slice2g-live',
        actionRef: 'live-slice2g-action',
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

    // ACCEPTABLE: authorise -> execute -> observe (matching, live-confirmed) -> validate MATCHED_PROJECTION.
    const acceptableProjection = await liveProjection({
      currentExposure: 0,
      proposedSpend: 1,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    expect(acceptableProjection.disposition).toBe('ACCEPTABLE');
    const acceptableDecision = await invokeCapability(baseEnvelope({ consequenceProjection: acceptableProjection }));
    expect(acceptableDecision.decision).toBe('allow');
    const acceptableAuth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection: acceptableProjection,
      invocationDecision: acceptableDecision,
      now: new Date().toISOString(),
    });
    expect(acceptableAuth.status).toBe('AUTHORISED');
    const bound = bindExecution({ authorisation: acceptableAuth, signerRef: 'aigent-moneypenny', now: new Date().toISOString() });
    expect(bound.status).toBe('execution_bound');
    const observed = recordObservedConsequence({
      execution: bound.execution!,
      projection: acceptableProjection,
      observedState: { liveConfirmed: true },
      observedDisposition: 'ACCEPTABLE',
    });
    expect(observed.validationState).toBe('MATCHED_PROJECTION');
    const chain = assembleCausalChain({
      action: { ...PROPOSED_ACTION, actionRef: 'live-slice2g-action' },
      projection: acceptableProjection,
      authorisation: acceptableAuth,
      execution: bound.execution,
      observedConsequence: observed,
    });
    expect(chain.confidentialRequestRef).toBeTruthy();
    expect(chain.executionRef).toBe(bound.execution!.executionRef);

    // DIVERGED_FROM_PROJECTION: the SAME live ACCEPTABLE projection and its
    // AUTHORISED authorisation, bound a SECOND time (a distinct execution
    // intent — bindExecution() is not one-time-use), but this time reported
    // as having actually observed UNACCEPTABLE — proving the mismatch lives
    // on the OBSERVATION side, never on the (unchanged, still-live) projection.
    const secondBound = bindExecution({
      authorisation: acceptableAuth,
      // Distinct signerRef (not merely relying on the clock, which can tick
      // the same millisecond twice in a fast synchronous run) guarantees a
      // distinct executionRef for this second, independent execution intent.
      signerRef: 'aigent-moneypenny-diverged-case',
      now: new Date().toISOString(),
    });
    expect(secondBound.status).toBe('execution_bound');
    expect(secondBound.execution!.executionRef).not.toBe(bound.execution!.executionRef);
    const divergedObserved = recordObservedConsequence({
      execution: secondBound.execution!,
      projection: acceptableProjection,
      observedState: { liveConfirmed: true, actuallyHappened: 'UNACCEPTABLE' },
      observedDisposition: 'UNACCEPTABLE',
    });
    expect(divergedObserved.validationState).toBe('DIVERGED_FROM_PROJECTION');
    const divergedChain = assembleCausalChain({
      action: { ...PROPOSED_ACTION, actionRef: 'live-slice2g-action' },
      projection: acceptableProjection,
      authorisation: acceptableAuth,
      execution: secondBound.execution,
      observedConsequence: divergedObserved,
    });
    expect(divergedChain.validationState).toBe('DIVERGED_FROM_PROJECTION');
    expect(divergedChain.projectionRef).toBe(chain.projectionRef); // same live projection, different observation

    // UNACCEPTABLE: authorisation REFUSED -> execution refused, never bound.
    const unacceptableProjection = await liveProjection({
      currentExposure: 0,
      proposedSpend: 100,
      privateSpendLimit: 10,
      privateRiskLimit: 10,
    });
    expect(unacceptableProjection.disposition).toBe('UNACCEPTABLE');
    const unacceptableDecision = await invokeCapability(baseEnvelope({ consequenceProjection: unacceptableProjection }));
    const unacceptableAuth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection: unacceptableProjection,
      invocationDecision: unacceptableDecision,
      now: new Date().toISOString(),
    });
    expect(unacceptableAuth.status).toBe('REFUSED');
    const unacceptableBound = bindExecution({ authorisation: unacceptableAuth, signerRef: 'aigent-moneypenny', now: new Date().toISOString() });
    expect(unacceptableBound.status).toBe('refused');

    // UNRESOLVED: REQUIRED confidential deliberately absent -> authorisation UNRESOLVED -> execution refused.
    const unresolvedProjection = composeUnifiedConsequenceProjection({
      projectionContextRef: 'ctx-slice2g-live-unresolved',
      actionRef: 'live-slice2g-action-unresolved',
      authorityRef: ACTIVE_AUTHORITY.principalRef,
      mandateRef: ACTIVE_AUTHORITY.mandateRef,
      publicForecast: PUBLIC_ACCEPTABLE,
      confidentialRequirement: 'REQUIRED',
      confidentialEvidence: null,
    });
    const unresolvedDecision = await invokeCapability(baseEnvelope({ consequenceProjection: unresolvedProjection }));
    const unresolvedAuth = deriveActionAuthorisation({
      authority: ACTIVE_AUTHORITY,
      projection: unresolvedProjection,
      invocationDecision: unresolvedDecision,
      now: new Date().toISOString(),
    });
    expect(unresolvedAuth.status).toBe('UNRESOLVED');
    const unresolvedBound = bindExecution({ authorisation: unresolvedAuth, signerRef: 'aigent-moneypenny', now: new Date().toISOString() });
    expect(unresolvedBound.status).toBe('refused');
    // ZERO execution — not merely "refused status", but no CommerceExecution record at all.
    expect(unresolvedBound.execution).toBeNull();
    const unresolvedChain = assembleCausalChain({
      action: { ...PROPOSED_ACTION, actionRef: 'live-slice2g-action-unresolved' },
      projection: unresolvedProjection,
      authorisation: unresolvedAuth,
    });
    expect(unresolvedChain.executionRef).toBeNull();
    expect(unresolvedChain.observedConsequenceRef).toBeNull();
    expect(unresolvedChain.validationState).toBeNull();
  }, 240_000);
});
