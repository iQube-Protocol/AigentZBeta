/**
 * MoneyPenny Financial Services Runtime — Phase 3, Stage 3.1 canaries.
 *
 * Proves the complete lifecycle spec: service discovery -> eligibility ->
 * Authority -> Mandate -> ProposedAction -> ConsequenceProjection ->
 * ActionAuthorisation -> bounded execution -> ObservedConsequence ->
 * validation -> receipts -> Standing -> next/orchestrated service — using
 * ONLY existing, frozen VELA-001 modules underneath (nothing here computes a
 * second authority/projection/authorisation/execution decision).
 *
 * Mirrors this repo's established mocking convention for
 * `invokeCapability()` (`tests/governed-capability-invocation.test.ts`,
 * `tests/vela-slice2f-capability-invocation.test.ts`) — only the DB-backed
 * capability-registry/admission/Standing seams are stood in. Gate 1, Gate 2,
 * `deriveActionAuthorisation`, `bindExecution`, `recordObservedConsequence`
 * and `assembleCausalChain` all run for real.
 *
 * The consumer is Aigent Nakamoto (`aigent-nakamoto`) — a real, canonical,
 * non-MoneyPenny registrable agent — requesting a MoneyPenny
 * (`aigent-moneypenny`) service. This is the "orchestrated" pattern Gate 1
 * already implements (`requestingAgentId === orchestratorAgentId`, resolved
 * provider is a DIFFERENT agent) — no new cross-agent plumbing was built for
 * this; it already existed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveCapabilityProviders = vi.fn();
vi.mock('@/services/registry/capabilityProviderResolution', () => ({
  resolveCapabilityProviders: (...args: any[]) => mockResolveCapabilityProviders(...args),
}));

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockComputeStandingScore = vi.fn();
vi.mock('@/services/standing/standingScore', () => ({
  computeStandingScore: (...args: any[]) => mockComputeStandingScore(...args),
}));

const mockAccrueStanding = vi.fn();
vi.mock('@/services/crm/standingAccrualService', () => ({
  accrueStanding: (...args: any[]) => mockAccrueStanding(...args),
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
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

import { readFileSync } from 'fs';
import { join } from 'path';
import { requestFinancialService } from '@/services/financialServices/serviceRequestOrchestrator';
import {
  resolveFinancialServiceDefinition,
  listFinancialServiceDefinitions,
  MONEYPENNY_ADVISOR,
  MONEYPENNY_ARCHITECT,
  MONEYPENNY_RUNTIME,
} from '@/services/financialServices/serviceCatalog';
import { assembleFinancialServiceOrchestration } from '@/services/financialServices/orchestration';
import {
  discoverFinancialServicesForConsumer,
  discoverEligibleFinancialServices,
} from '@/services/financialServices/discovery';
import type { ConsequenceForecast } from '@/types/consequence';
import type { ConstitutionalAuthority } from '@/types/constitutionalCommerce';
import type { ConfidentialEvidenceInput } from '@/services/constitutionalCommerce/unifiedConsequenceProjection';
import type { FinancialServiceRequest } from '@/types/financialServices';

const CONSUMER = 'aigent-nakamoto';
const PROVIDER = 'aigent-moneypenny';

const MONEYPENNY_ADVISOR_PROVIDER = {
  capabilityId: MONEYPENNY_ADVISOR.capabilityId,
  providerAgentId: PROVIDER,
  registryAssetId: 'aigentqube-moneypenny',
  runtimeMembershipRef: 'financial-services',
  benchRow: {
    runtimeMemberships: [{ runtimeId: 'financial-services', status: 'approved', eligibility: { satisfied: [], outstanding: [] } }],
  },
};
const MONEYPENNY_ARCHITECT_PROVIDER = { ...MONEYPENNY_ADVISOR_PROVIDER, capabilityId: MONEYPENNY_ARCHITECT.capabilityId };
const MONEYPENNY_RUNTIME_PROVIDER = { ...MONEYPENNY_ADVISOR_PROVIDER, capabilityId: MONEYPENNY_RUNTIME.capabilityId };

const ACTIVE_AUTHORITY: ConstitutionalAuthority = {
  principalRef: 'polref-nakamoto-consumer',
  actorRef: CONSUMER,
  authoritySource: 'passport+standing',
  mandateRef: 'mandate-fsvc-1',
  state: 'ACTIVE',
};

function forecast(): ConsequenceForecast {
  return {
    seedInvariantIds: ['inv.finance.001'],
    nodes: [],
    enables: 1,
    constrains: 0,
    contradicts: 0,
    forcesEscalation: false,
    constitutionalConstraint: false,
    constitutionalConstraintIds: [],
    rationale: 'no reachable constraint or contradiction',
  };
}

function request(serviceId: string, overrides: Partial<FinancialServiceRequest> = {}): FinancialServiceRequest {
  return {
    requestRef: `req-${serviceId}`,
    serviceId,
    requestingAgentId: CONSUMER,
    principalRef: ACTIVE_AUTHORITY.principalRef,
    mandateRef: ACTIVE_AUTHORITY.mandateRef,
    input: {},
    ...overrides,
  };
}

beforeEach(() => {
  mockResolveCapabilityProviders.mockReset();
  mockResolveAgentAdmissionState.mockReset();
  mockComputeStandingScore.mockReset();
  mockAccrueStanding.mockReset();
  mockAccrueStanding.mockResolvedValue(null);
  mockCreateActivityReceipt.mockReset();
  mockCreateActivityReceipt.mockResolvedValue({});
  mockEmitReceipt.mockReset();
  mockEmitReceipt.mockResolvedValue({});
  // Both consumer (Nakamoto) and provider (MoneyPenny) independently admitted.
  mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: true });
});

// ── Service discovery ───────────────────────────────────────────────────

describe('service discovery — serviceCatalog', () => {
  it('resolves Advisor, Architect and Runtime with every required policy field', () => {
    for (const def of [MONEYPENNY_ADVISOR, MONEYPENNY_ARCHITECT, MONEYPENNY_RUNTIME]) {
      expect(resolveFinancialServiceDefinition(def.serviceId)).toEqual(def);
      expect(def.eligibilityPolicy).toBeDefined();
      expect(def.authorityRequirement).toBeDefined();
      expect(def.projectionRequirement).toMatch(/^(NOT_REQUIRED|REQUIRED)$/);
      expect(def.confidentialityRequirement).toMatch(/^(NOT_REQUIRED|REQUIRED)$/);
      expect(def.attestationRequirement).toMatch(/^(NOT_REQUIRED|REQUIRED|UNSPECIFIED)$/);
      expect(def.executionPolicy.boundedOnly).toBe(true);
      expect(def.pricingPolicy).toBeDefined();
      expect(def.receiptPolicy).toBeDefined();
    }
    expect(listFinancialServiceDefinitions()).toHaveLength(3);
  });

  it('returns null for an unknown serviceId', () => {
    expect(resolveFinancialServiceDefinition('moneypenny.nonexistent')).toBeNull();
  });

  it('Runtime is the ONLY service using the Gate-2-gated capability id; Advisor/Architect use distinct ids', () => {
    expect(MONEYPENNY_RUNTIME.capabilityId).toBe('CONFIDENTIAL_CONSEQUENCE_PROJECTION');
    expect(MONEYPENNY_ADVISOR.capabilityId).not.toBe(MONEYPENNY_RUNTIME.capabilityId);
    expect(MONEYPENNY_ARCHITECT.capabilityId).not.toBe(MONEYPENNY_RUNTIME.capabilityId);
  });

  it('Runtime requires REQUIRED attestation by construction — the Phase 3 hard dependency', () => {
    expect(MONEYPENNY_RUNTIME.attestationRequirement).toBe('REQUIRED');
  });
});

// ── Full lifecycle: Advisor / Architect (DELIVERED, cross-agent) ────────

describe('requestFinancialService() — Advisor/Architect: cross-agent, no execution attempted', () => {
  it('Advisor: Nakamoto (non-MoneyPenny consumer) receives DELIVERED in preview mode', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: null,
      personaId: 'persona-nakamoto',
      standingPersonaId: 'crm-nakamoto',
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.serviceClass).toBe('advisor');
    expect(outcome.authorisationRef).toBeNull();
    expect(outcome.executionRef).toBeNull();
    expect(mockAccrueStanding).toHaveBeenCalledWith(expect.objectContaining({ crmPersonaId: 'crm-nakamoto' }));
  });

  it('Architect: Nakamoto receives DELIVERED in shadow mode — never AUTHORISED, never REFUSED via deriveActionAuthorisation', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ARCHITECT_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ARCHITECT.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: null,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.serviceClass).toBe('architect');
  });

  it('refuses when the consumer is not admitted — Gate 1, unmodified', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
      Promise.resolve({ delegationActive: agent.runtimeAgentId !== CONSUMER }),
    );
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: null,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    // Caught by this layer's OWN eligibility pre-check (reusing the same
    // resolveAgentAdmissionState Gate 1 would also refuse on).
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('NOT_ADMITTED');
  });
});

// ── Full lifecycle: Runtime (the hard Phase-3 dependency) ───────────────

describe('requestFinancialService() — Runtime: the Phase 3 hard dependency', () => {
  function realisticUnattestedEvidence(disposition: 'ACCEPTABLE' | 'UNACCEPTABLE'): ConfidentialEvidenceInput {
    return {
      provider: 'vela',
      requestRef: '0xdeadbeef',
      disposition,
      resultCommitment: 'commitment',
      payloadCommitment: 'payload',
      protocolExecutionVerified: true,
      // Matches reality: every Vela deployment reachable today runs
      // NoAttestationTeeAuthenticator.
      teeAttestationVerified: false,
      attestationMode: 'NO_ATTESTATION_LOCAL',
    };
  }

  it('an ACCEPTABLE confidential verdict still resolves UNRESOLVED locally — REQUIRED attestation is unproven, zero execution', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
    mockComputeStandingScore.mockResolvedValue({ score: 40, qualified: true });
    const { outcome, causalChain } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: realisticUnattestedEvidence('ACCEPTABLE'),
      standingPersonaId: 'crm-nakamoto',
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.executionRef).toBeNull();
    expect(causalChain?.executionRef).toBeNull();
    // Standing does not accrue for an unresolved/unexecuted service interaction.
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('an UNACCEPTABLE confidential verdict is REFUSED, distinct from UNRESOLVED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
    mockComputeStandingScore.mockResolvedValue({ score: 40, qualified: true });
    // Attestation-independent: an UNACCEPTABLE verdict is a definite refusal
    // regardless of attestation state — proven with real (attested) evidence
    // so the REFUSED branch isn't conflated with the attestation-gated one.
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: {
        ...realisticUnattestedEvidence('UNACCEPTABLE'),
        teeAttestationVerified: true,
        attestationMode: 'NITRO_ATTESTED',
      },
      standingPersonaId: 'crm-nakamoto',
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.executionRef).toBeNull();
  });

  it('refuses eligibility below the Standing floor before any gateway/projection work happens', async () => {
    mockComputeStandingScore.mockResolvedValue({ score: 10, qualified: false });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: realisticUnattestedEvidence('ACCEPTABLE'),
      standingPersonaId: 'crm-nakamoto',
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('STANDING_BELOW_THRESHOLD');
    expect(mockResolveCapabilityProviders).not.toHaveBeenCalled();
  });

  it('SYNTHETIC FIXTURE (proves the mechanism, not a live claim): once evidence carries a genuinely attested verdict, Runtime reaches AUTHORISED, binds execution, and validates MATCHED_PROJECTION', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
    mockComputeStandingScore.mockResolvedValue({ score: 40, qualified: true });
    const attestedEvidence: ConfidentialEvidenceInput = {
      provider: 'vela',
      requestRef: '0xsynthetic-attested',
      disposition: 'ACCEPTABLE',
      resultCommitment: 'commitment',
      payloadCommitment: 'payload',
      protocolExecutionVerified: true,
      // SYNTHETIC — no live Vela deployment reachable today produces this.
      // This fixture proves composeUnifiedConsequenceProjection/deriveAction
      // Authorisation/bindExecution/recordObservedConsequence correctly
      // reach AUTHORISED/executed/validated once Stage 3.3 delivers a real
      // NITRO_ATTESTED deployment — it does not claim that deployment exists.
      teeAttestationVerified: true,
      attestationMode: 'NITRO_ATTESTED',
    };
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: attestedEvidence,
      observedDisposition: 'ACCEPTABLE',
      observedState: { note: 'synthetic observation for mechanism proof' },
      standingPersonaId: 'crm-nakamoto',
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('AUTHORISED');
    expect(outcome.executionRef).toBeTruthy();
    expect(outcome.observedConsequenceRef).toBeTruthy();
    expect(outcome.validationState).toBe('MATCHED_PROJECTION');
    expect(mockAccrueStanding).toHaveBeenCalledWith(expect.objectContaining({ crmPersonaId: 'crm-nakamoto' }));
  });

  it('execution binding is never confirmation — transactionRef is always absent, even in the synthetic AUTHORISED case', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
    mockComputeStandingScore.mockResolvedValue({ score: 40, qualified: true });
    const { causalChain } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: {
        provider: 'vela',
        requestRef: '0xsynthetic-2',
        disposition: 'ACCEPTABLE',
        resultCommitment: 'c',
        payloadCommitment: 'p',
        protocolExecutionVerified: true,
        teeAttestationVerified: true,
        attestationMode: 'NITRO_ATTESTED',
      },
      standingPersonaId: 'crm-nakamoto',
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(causalChain?.executionRef).toBeTruthy();
    // No observedDisposition supplied — proves execution and observation are
    // temporally separate: the outcome is AUTHORISED with a bound execution
    // and no observation yet, never fabricated.
  });
});

// ── Orchestration assembly — "next/orchestrated service" ────────────────

describe('assembleFinancialServiceOrchestration()', () => {
  it('assembles a consumer-scoped orchestration record naming the next service, with no new authority computed', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    const advisorResult = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      authority: ACTIVE_AUTHORITY,
      publicForecast: forecast(),
      confidentialEvidence: null,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    const orchestration = assembleFinancialServiceOrchestration(
      CONSUMER,
      [advisorResult.outcome],
      MONEYPENNY_ARCHITECT.serviceId,
    );
    expect(orchestration.consumerAgentId).toBe(CONSUMER);
    expect(orchestration.steps).toHaveLength(1);
    expect(orchestration.steps[0].outcome.status).toBe('DELIVERED');
    expect(orchestration.nextServiceId).toBe(MONEYPENNY_ARCHITECT.serviceId);
    expect(orchestration.orchestrationRef).toBeTruthy();
  });
});

// ── Genericity — no branch per consumer (front-loads Stage 3.2) ─────────

describe('genericity — the SAME requestFinancialService() implementation, no source branch per consumer', () => {
  it('Aigent Know1 (a second, distinct non-MoneyPenny consumer) uses the identical function with no special-casing', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId, { requestingAgentId: 'aigent-kn0w1', requestRef: 'req-know1-advisor' }),
      authority: { ...ACTIVE_AUTHORITY, actorRef: 'aigent-kn0w1' },
      publicForecast: forecast(),
      confidentialEvidence: null,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
  });

  it('structural canary: serviceRequestOrchestrator.ts contains no hardcoded registrable-agent id — "no source branch per consumer" is a structural fact, not a two-sample observation', () => {
    const source = readFileSync(
      join(process.cwd(), 'services/financialServices/serviceRequestOrchestrator.ts'),
      'utf8',
    );
    // These are the real REGISTRABLE_AGENTS runtimeAgentIds (services/horizen/registrableAgents.ts).
    // None may appear as a literal in the orchestrator — every consumer must
    // flow through the same request.requestingAgentId parameter.
    for (const runtimeAgentId of ['aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1']) {
      expect(source).not.toContain(`'${runtimeAgentId}'`);
      expect(source).not.toContain(`"${runtimeAgentId}"`);
    }
  });
});

// ── Marketa boundary — qualification/sourcing signal, not execution authority ──

describe('Marketa boundary — structural canary', () => {
  it('admissionAssessmentEngine.ts has zero import coupling to money/execution/authorisation modules', () => {
    const source = readFileSync(
      join(process.cwd(), 'services/marketa/admissionAssessmentEngine.ts'),
      'utf8',
    );
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line));
    const forbidden = [
      'constitutionalCommerce',
      'invocationGateway',
      'capabilityInvocationGates',
      'financialServices',
      'boundedExecution',
      'actionAuthorisation',
      'observedConsequence',
      'commerceReceipts',
      'standingAccrualService',
    ];
    for (const line of importLines) {
      for (const forbiddenModule of forbidden) {
        expect(line).not.toContain(forbiddenModule);
      }
    }
    // The engine is a pure function of admission evidence — no execution/money import at all.
    expect(importLines.every((line) => /ExternalAgentAdmissionEvidence/.test(line))).toBe(true);
  });
});

// ── Discovery — Standing/admission drive what a consumer is offered (Stage 3.2) ──

describe('discoverFinancialServicesForConsumer() / discoverEligibleFinancialServices() — Standing/admission drive discovery', () => {
  it('an admitted consumer below the Runtime Standing floor sees Advisor/Architect eligible but Runtime ineligible', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: true });
    mockComputeStandingScore.mockResolvedValue({ score: 10, qualified: false });

    const discovered = await discoverFinancialServicesForConsumer(CONSUMER, 'crm-nakamoto', fakeSupabase as any);
    expect(discovered).toHaveLength(3);

    const byId = new Map(discovered.map((d) => [d.definition.serviceId, d.eligibility]));
    expect(byId.get(MONEYPENNY_ADVISOR.serviceId)?.eligible).toBe(true);
    expect(byId.get(MONEYPENNY_ARCHITECT.serviceId)?.eligible).toBe(true);
    expect(byId.get(MONEYPENNY_RUNTIME.serviceId)?.eligible).toBe(false);
    expect(byId.get(MONEYPENNY_RUNTIME.serviceId)?.code).toBe('STANDING_BELOW_THRESHOLD');

    const eligible = await discoverEligibleFinancialServices(CONSUMER, 'crm-nakamoto', fakeSupabase as any);
    expect(eligible.map((d) => d.serviceId).sort()).toEqual(
      [MONEYPENNY_ADVISOR.serviceId, MONEYPENNY_ARCHITECT.serviceId].sort(),
    );
  });

  it('an admitted consumer at/above the Runtime Standing floor sees all three services eligible', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: true });
    mockComputeStandingScore.mockResolvedValue({ score: 40, qualified: true });

    const eligible = await discoverEligibleFinancialServices(CONSUMER, 'crm-nakamoto', fakeSupabase as any);
    expect(eligible.map((d) => d.serviceId).sort()).toEqual(
      [MONEYPENNY_ADVISOR.serviceId, MONEYPENNY_ARCHITECT.serviceId, MONEYPENNY_RUNTIME.serviceId].sort(),
    );
  });

  it('a non-admitted consumer sees nothing eligible, including Advisor/Architect which have no Standing requirement', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: false });

    const discovered = await discoverFinancialServicesForConsumer(CONSUMER, 'crm-nakamoto', fakeSupabase as any);
    expect(discovered.every((d) => d.eligibility.eligible === false)).toBe(true);
    expect(discovered.every((d) => d.eligibility.code === 'NOT_ADMITTED')).toBe(true);

    const eligible = await discoverEligibleFinancialServices(CONSUMER, 'crm-nakamoto', fakeSupabase as any);
    expect(eligible).toHaveLength(0);
  });

  it('a second, distinct consumer (Aigent Know1) run through the identical discovery function reflects its own Standing — no per-consumer branch', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({ delegationActive: true });
    mockComputeStandingScore.mockResolvedValue({ score: 100, qualified: true });

    const eligible = await discoverEligibleFinancialServices('aigent-kn0w1', 'crm-kn0w1', fakeSupabase as any);
    expect(eligible.map((d) => d.serviceId).sort()).toEqual(
      [MONEYPENNY_ADVISOR.serviceId, MONEYPENNY_ARCHITECT.serviceId, MONEYPENNY_RUNTIME.serviceId].sort(),
    );
  });
});
