/**
 * MoneyPenny Financial Services Runtime — Phase 3, Stage 3.1 canaries.
 * Rewritten in the 2026-08-23 repair pass (Repairs A-F) to match the
 * "resolve once" context composition, the real ConstitutionalAuthority
 * adapter, the real Advisor/Architect provider dispatch, and the corrected
 * capability ids.
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
 * capability-registry/admission/delegation/verification/Standing/agreement
 * seams are stood in. Gate 1, Gate 2, `deriveActionAuthorisation`,
 * `bindExecution`, `recordObservedConsequence` and `assembleCausalChain` all
 * run for real.
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

const mockReadActiveGrant = vi.fn();
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrantForAgent: (...args: any[]) => mockReadActiveGrant(...args),
}));

const mockListAssignments = vi.fn();
vi.mock('@/services/identity/personaAssignmentStore', () => ({
  listAssignments: (...args: any[]) => mockListAssignments(...args),
}));

const mockResolveFinancialServicesVerification = vi.fn();
vi.mock('@/services/journey/agentFinancialServicesVerification', () => ({
  resolveFinancialServicesVerification: (...args: any[]) => mockResolveFinancialServicesVerification(...args),
}));

const mockResolveAgentStandingPersonaId = vi.fn();
vi.mock('@/services/standing/agentStandingPersona', () => ({
  resolveAgentStandingPersonaId: (...args: any[]) => mockResolveAgentStandingPersonaId(...args),
}));

const mockComputeStandingScore = vi.fn();
vi.mock('@/services/standing/standingScore', () => ({
  computeStandingScore: (...args: any[]) => mockComputeStandingScore(...args),
}));

const mockRequireAuthorizedAgreement = vi.fn();
vi.mock('@/services/constitutional/constitutionalAgreement', () => ({
  requireAuthorizedAgreement: (...args: any[]) => mockRequireAuthorizedAgreement(...args),
}));

const mockDraftFinancialStructure = vi.fn();
vi.mock('@/services/constitutional/moneyPennyArchitect', () => ({
  draftFinancialStructure: (...args: any[]) => mockDraftFinancialStructure(...args),
}));

const mockRunMoneyPennyChat = vi.fn();
vi.mock('@/app/api/moneypenny/chat/route', () => ({
  runMoneyPennyChat: (...args: any[]) => mockRunMoneyPennyChat(...args),
}));

const mockRunConstitutionalServicePattern = vi.fn();
vi.mock('@/services/constitutional/constitutionalServicePipeline', () => ({
  runConstitutionalServicePattern: (...args: any[]) => mockRunConstitutionalServicePattern(...args),
}));

const mockAccrueStanding = vi.fn();
vi.mock('@/services/crm/standingAccrualService', () => ({
  accrueStanding: (...args: any[]) => mockAccrueStanding(...args),
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  findAgentReceiptRefs: vi.fn().mockResolvedValue([]),
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
  MONEYPENNY_RUNTIME_CONSTITUTIONAL,
} from '@/services/financialServices/serviceCatalog';
import { assembleFinancialServiceOrchestration } from '@/services/financialServices/orchestration';
import {
  discoverFinancialServicesForConsumer,
  discoverEligibleFinancialServices,
} from '@/services/financialServices/discovery';
import { evaluateFinancialServiceEligibility } from '@/services/financialServices/eligibility';
import type { FinancialServiceAgentContext } from '@/services/financialServices/agentEligibilityContext';
import type { ConsequenceForecast } from '@/types/consequence';
import type { ConfidentialEvidenceInput } from '@/services/constitutionalCommerce/unifiedConsequenceProjection';
import { MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS, GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE } from '@/types/financialServices';
import type { FinancialServiceRequest } from '@/types/financialServices';

const CONSUMER = 'aigent-nakamoto';
const PROVIDER = 'aigent-moneypenny';
const CONSUMER_ROOT_DID = 'did:agent:root:aigent-nakamoto';
const KNOW1_ROOT_DID = 'did:agent:root:aigent-kn0w1';
const PROVIDER_ROOT_DID = 'did:agent:root:aigent-moneypenny';
// `agent_root_identity.id` (the row id `persona_agent_assignments.agent_root_id`
// keys against) — DISTINCT from the DID above, which `delegation_grants`
// keys against. Eligibility (Repair, second pass) matches on this; the
// Authority Plane matches on the DID.
const CONSUMER_ROOT_ID = 'root-id-aigent-nakamoto';
const KNOW1_ROOT_ID = 'root-id-aigent-kn0w1';
const PROVIDER_ROOT_ID = 'root-id-aigent-moneypenny';
/** MoneyPenny's own canonical Standing CRM persona id — distinct from any consumer's, so a test asserting `crmPersonaId: PROVIDER_CRM_PERSONA_ID` genuinely proves provider-not-requester attribution rather than passing by coincidence. */
const PROVIDER_CRM_PERSONA_ID = 'crm-moneypenny';
const ACTOR_PERSONA_ID = 'persona-nakamoto-oversight';
const ACTOR_AUTH_PROFILE_ID = 'auth-profile-nakamoto-oversight';

function assignmentRow(agentRootId: string, overrides: Partial<{ role: 'aigentMe' | 'delegate'; active: boolean }> = {}) {
  return {
    id: `assign-${agentRootId}`,
    persona_id: ACTOR_PERSONA_ID,
    agent_root_id: agentRootId,
    role: overrides.role ?? 'delegate',
    active: overrides.active ?? true,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
}

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
const MONEYPENNY_RUNTIME_CONSTITUTIONAL_PROVIDER = {
  ...MONEYPENNY_ADVISOR_PROVIDER,
  capabilityId: MONEYPENNY_RUNTIME_CONSTITUTIONAL.capabilityId,
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
    input: { intent: 'rehearsal intent for the provider' },
    ...overrides,
  };
}

/**
 * Default "everything checks out" wiring — an admitted, STRUCTURALLY
 * ASSIGNED, verified, adequately-Standing consumer, ALSO holding a current
 * delegation grant + an authorized mandate (so Runtime tests exercising the
 * full Authority Plane don't need to re-wire it every time). Individual
 * tests override one seam at a time — including tests that deliberately
 * clear the grant to prove eligibility no longer depends on it.
 */
function wireHappyPath(): void {
  // Differentiated by agent so a test asserting on the PROVIDER's own
  // canonical Standing persona (crediting the agent that did the work,
  // 2026-08-23 "close Standing" directive) can't pass merely by coincidence
  // with the CONSUMER's identical mock return — see PROVIDER_CRM_PERSONA_ID.
  mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
    Promise.resolve(
      agent.runtimeAgentId === PROVIDER
        ? { delegationActive: true, registryActivated: true, agentRootId: PROVIDER_ROOT_ID, agentRootDid: PROVIDER_ROOT_DID, auditGaps: [] }
        : {
            // `delegationActive` is Gate 1's own (unmodified, out-of-scope-
            // for-this-repair) admission check
            // (services/registry/capabilityInvocationGates.ts) — it still
            // reads this exact field, independently of the Financial
            // Services eligibility layer's own `registryActivated`/
            // structural-assignment composition below. Both must be
            // satisfied for a happy path.
            delegationActive: true,
            registryActivated: true,
            agentRootId: CONSUMER_ROOT_ID,
            agentRootDid: CONSUMER_ROOT_DID,
            auditGaps: [],
          },
    ),
  );
  // STRUCTURAL fact for eligibility — persona_agent_assignments, NOT delegation_grants.
  mockListAssignments.mockResolvedValue([assignmentRow(CONSUMER_ROOT_ID)]);
  // AUTHORITY-PLANE fact only — never consulted by eligibility.ts.
  mockReadActiveGrant.mockResolvedValue({ grant_id: 'grant-1', agent_root_did: CONSUMER_ROOT_DID, persona_id: ACTOR_PERSONA_ID });
  mockResolveFinancialServicesVerification.mockResolvedValue({
    pulseComplete: true,
    pnlComplete: true,
    financialServicesEligible: true,
  });
  mockResolveAgentStandingPersonaId.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }, _rootDid: unknown) =>
    Promise.resolve(agent.runtimeAgentId === PROVIDER ? PROVIDER_CRM_PERSONA_ID : 'crm-nakamoto'),
  );
  mockComputeStandingScore.mockResolvedValue({ score: 40, qualified: true });
  mockRequireAuthorizedAgreement.mockResolvedValue({ ok: true, agreementId: 'agr-1', status: 'authorized' });
  mockDraftFinancialStructure.mockResolvedValue({
    ok: true,
    artifactId: 'moneypenny-architect-artifact-1',
    recordId: 'rec-1',
    title: 'Structure',
    body: 'body',
    citedInvariantIds: [],
  });
  mockRunMoneyPennyChat.mockResolvedValue({ response: 'Here is some financial advice.', timestamp: '2026-08-23T00:00:00.000Z' });
}

beforeEach(() => {
  mockResolveCapabilityProviders.mockReset();
  mockResolveAgentAdmissionState.mockReset();
  mockReadActiveGrant.mockReset();
  mockListAssignments.mockReset();
  mockResolveFinancialServicesVerification.mockReset();
  mockResolveAgentStandingPersonaId.mockReset();
  mockComputeStandingScore.mockReset();
  mockRequireAuthorizedAgreement.mockReset();
  mockDraftFinancialStructure.mockReset();
  mockRunMoneyPennyChat.mockReset();
  mockRunConstitutionalServicePattern.mockReset();
  mockAccrueStanding.mockReset();
  mockAccrueStanding.mockResolvedValue(null);
  mockCreateActivityReceipt.mockReset();
  mockCreateActivityReceipt.mockResolvedValue({});
  mockEmitReceipt.mockReset();
  mockEmitReceipt.mockResolvedValue({});
  wireHappyPath();
});

// ── Service discovery ───────────────────────────────────────────────────

describe('service discovery — serviceCatalog', () => {
  it('resolves Advisor, Architect, Runtime (Confidential) and Runtime (Constitutional) with every required policy field', () => {
    for (const def of [MONEYPENNY_ADVISOR, MONEYPENNY_ARCHITECT, MONEYPENNY_RUNTIME, MONEYPENNY_RUNTIME_CONSTITUTIONAL]) {
      expect(resolveFinancialServiceDefinition(def.serviceId)).toEqual(def);
      expect(def.eligibilityPolicy).toBeDefined();
      expect(def.authorityRequirement).toBeDefined();
      expect(def.serviceClass).toMatch(/^(INFORMATIONAL|PROPOSAL|CONSEQUENTIAL)$/);
      expect(def.providerMode).toMatch(/^(ADVISOR|ARCHITECT|RUNTIME)$/);
      expect(def.projectionRequirement).toMatch(/^(NOT_REQUIRED|REQUIRED)$/);
      expect(def.confidentialityRequirement).toMatch(/^(NOT_REQUIRED|REQUIRED)$/);
      expect(def.attestationRequirement).toMatch(/^(NOT_REQUIRED|REQUIRED|UNSPECIFIED)$/);
      expect(def.executionPolicy.boundedOnly).toBe(true);
      expect(def.pricingPolicy).toBeDefined();
      expect(def.receiptPolicy).toBeDefined();
    }
    expect(listFinancialServiceDefinitions()).toHaveLength(4);
  });

  it('returns null for an unknown serviceId', () => {
    expect(resolveFinancialServiceDefinition('moneypenny.nonexistent')).toBeNull();
  });

  it('Runtime (Confidential) is the ONLY service using the Gate-2-gated capability id; every other service uses its own real MoneyPenny registry capability name', () => {
    expect(MONEYPENNY_RUNTIME.capabilityId).toBe('CONFIDENTIAL_CONSEQUENCE_PROJECTION');
    expect(MONEYPENNY_ADVISOR.capabilityId).toBe('financial_advisory');
    expect(MONEYPENNY_ARCHITECT.capabilityId).toBe('financial_structure_design');
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.capabilityId).toBe('bounded_financial_execution');
    expect(MONEYPENNY_ADVISOR.capabilityId).not.toBe(MONEYPENNY_RUNTIME.capabilityId);
    expect(MONEYPENNY_ARCHITECT.capabilityId).not.toBe(MONEYPENNY_RUNTIME.capabilityId);
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.capabilityId).not.toBe(MONEYPENNY_RUNTIME.capabilityId);
  });

  it('Runtime (Confidential) requires REQUIRED attestation by construction — the Phase 3 hard dependency', () => {
    expect(MONEYPENNY_RUNTIME.attestationRequirement).toBe('REQUIRED');
  });

  it('Runtime (Constitutional) never requires Vela attestation/confidentiality — Vela is an assurance enhancement for the confidential service only, never a prerequisite for every MoneyPenny Runtime capability (2026-08-23)', () => {
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.providerMode).toBe('RUNTIME');
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.attestationRequirement).toBe('NOT_REQUIRED');
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.confidentialityRequirement).toBe('NOT_REQUIRED');
    // Both Runtime services are genuinely CONSEQUENTIAL (operator correction,
    // 2026-08-23, second pass — an earlier repair pass had wrongly
    // misclassified this service as 'PROPOSAL' purely to dodge Gate 2's
    // authoritative-mode refusal). serviceClass describes WHAT KIND of
    // consequence a service carries, never WHICH MECHANISM governs it — see
    // the "governance path, not service class, drives the Gate-2 request
    // mode" canary below for how the two Runtime services stay distinct
    // without Gate 2 ever being touched.
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceClass).toBe('CONSEQUENTIAL');
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.executionPolicy.executionReachable).toBe(false);
    // The two Runtime variants are genuinely distinct services, never aliases of each other.
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId).not.toBe(MONEYPENNY_RUNTIME.serviceId);
  });

  it('governance path, not service class, drives the Gate-2 request mode and which mechanism reaches Vela (2026-08-23 correction)', () => {
    // Both Runtime services are CONSEQUENTIAL — the shared consequence taxonomy.
    expect(MONEYPENNY_RUNTIME.serviceClass).toBe('CONSEQUENTIAL');
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceClass).toBe('CONSEQUENTIAL');

    // ...but they declare two DIFFERENT governance paths, and only the
    // constitutional-commerce one ever reaches VELA's ActionAuthorisation /
    // bindExecution primitives (`executionPolicy.executionReachable`).
    expect(MONEYPENNY_RUNTIME.governancePath).toBe('CONSTITUTIONAL_COMMERCE');
    expect(MONEYPENNY_RUNTIME.executionPolicy.executionReachable).toBe(true);

    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.governancePath).toBe('CONSTITUTIONAL_SERVICE_PIPELINE');
    expect(MONEYPENNY_RUNTIME_CONSTITUTIONAL.executionPolicy.executionReachable).toBe(false);

    // Advisor/Architect declare no governed execution mechanism at all.
    expect(MONEYPENNY_ADVISOR.governancePath).toBe('NONE');
    expect(MONEYPENNY_ARCHITECT.governancePath).toBe('NONE');

    // The override table is the ONLY thing that may request Gate 2's
    // authoritative mode — and it is scoped to exactly one governance path.
    expect(GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE.CONSTITUTIONAL_COMMERCE).toBe('authoritative');
    expect(GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE.CONSTITUTIONAL_SERVICE_PIPELINE).toBe('shadow');
    expect(GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE.NONE).toBeUndefined();
  });

  it('providerMode and serviceClass are derived from the single explicit mapping, never independently authored', () => {
    expect(MONEYPENNY_ADVISOR.providerMode).toBe('ADVISOR');
    expect(MONEYPENNY_ADVISOR.serviceClass).toBe(MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.ADVISOR);
    expect(MONEYPENNY_ADVISOR.serviceClass).toBe('INFORMATIONAL');

    expect(MONEYPENNY_ARCHITECT.providerMode).toBe('ARCHITECT');
    expect(MONEYPENNY_ARCHITECT.serviceClass).toBe(MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.ARCHITECT);
    expect(MONEYPENNY_ARCHITECT.serviceClass).toBe('PROPOSAL');

    expect(MONEYPENNY_RUNTIME.providerMode).toBe('RUNTIME');
    expect(MONEYPENNY_RUNTIME.serviceClass).toBe(MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS.RUNTIME);
    expect(MONEYPENNY_RUNTIME.serviceClass).toBe('CONSEQUENTIAL');
  });
});

// ── Full lifecycle: Advisor / Architect (DELIVERED only after real dispatch) ──

describe('requestFinancialService() — Advisor/Architect: real provider dispatch before DELIVERED (Repair D)', () => {
  it('Advisor: Nakamoto receives DELIVERED only after runMoneyPennyChat() actually returns a response', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      personaId: 'persona-nakamoto',
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(mockRunMoneyPennyChat).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.serviceClass).toBe('INFORMATIONAL');
    expect(outcome.providerMode).toBe('ADVISOR');
    expect(outcome.authorisationRef).toBeNull();
    expect(outcome.executionRef).toBeNull();
    expect(outcome.providerResultRef).toBeTruthy();
    // 2026-08-23 "close Standing" directive: the PROVIDER (MoneyPenny) that
    // did the work is credited, never the CONSUMER (Nakamoto) that merely
    // requested it. The consumer is preserved only as `requestingAgentRef`
    // context evidence.
    expect(mockAccrueStanding).toHaveBeenCalledWith(
      expect.objectContaining({ crmPersonaId: PROVIDER_CRM_PERSONA_ID, subjectAgentRef: PROVIDER, requestingAgentRef: CONSUMER }),
    );
  });

  it('provider-vs-requester attribution (P0-A, 2026-08-23): MoneyPenny is credited once per DELIVERED request regardless of which distinct consumer requested it — Nakamoto and Know1 never receive provider Standing merely for consuming the service', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);

    await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId, { requestingAgentId: CONSUMER, requestRef: 'req-nakamoto-advisor' }),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
      Promise.resolve(
        agent.runtimeAgentId === PROVIDER
          ? { delegationActive: true, registryActivated: true, agentRootId: PROVIDER_ROOT_ID, agentRootDid: PROVIDER_ROOT_DID, auditGaps: [] }
          : { delegationActive: true, registryActivated: true, agentRootId: KNOW1_ROOT_ID, agentRootDid: KNOW1_ROOT_DID, auditGaps: [] },
      ),
    );
    mockListAssignments.mockResolvedValue([assignmentRow(KNOW1_ROOT_ID)]);
    mockReadActiveGrant.mockResolvedValue({ grant_id: 'grant-know1', agent_root_did: KNOW1_ROOT_DID, persona_id: ACTOR_PERSONA_ID });

    await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId, { requestingAgentId: 'aigent-kn0w1', requestRef: 'req-know1-advisor' }),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    expect(mockAccrueStanding).toHaveBeenCalledTimes(2);
    for (const call of mockAccrueStanding.mock.calls) {
      // Every call credits MoneyPenny's OWN persona/subject — never the
      // requester's, regardless of which agent requested it.
      expect(call[0]).toEqual(
        expect.objectContaining({ crmPersonaId: PROVIDER_CRM_PERSONA_ID, subjectAgentRef: PROVIDER }),
      );
      expect(call[0].subjectAgentRef).not.toBe(CONSUMER);
      expect(call[0].subjectAgentRef).not.toBe('aigent-kn0w1');
    }
    expect(mockAccrueStanding.mock.calls[0][0].requestingAgentRef).toBe(CONSUMER);
    expect(mockAccrueStanding.mock.calls[1][0].requestingAgentRef).toBe('aigent-kn0w1');
  });

  it('Architect: Nakamoto receives DELIVERED only after draftFinancialStructure() actually persists an artifact — never AUTHORISED, never REFUSED via deriveActionAuthorisation', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ARCHITECT_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ARCHITECT.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(mockDraftFinancialStructure).toHaveBeenCalledWith({ intent: 'rehearsal intent for the provider' });
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.serviceClass).toBe('PROPOSAL');
    expect(outcome.providerMode).toBe('ARCHITECT');
    expect(outcome.providerResultRef).toBe('moneypenny-architect-artifact-1');
  });

  it('a gate allow followed by a technical provider failure resolves UNRESOLVED, never a silent DELIVERED — the exact bug this repair removes', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ARCHITECT_PROVIDER]);
    mockDraftFinancialStructure.mockResolvedValue({ ok: false, error: 'inference failed' });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ARCHITECT.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.reason).toContain('inference failed');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });
});

// ── 2026-08-23: Constitutional Runtime — restores the EXISTING PRD-MPY-001 ──
// non-TEE pipeline, gated by ITS OWN constitutionalAgreement.ts 409 check —
// never VELA's own authorisation/execution primitives, never Gate 2's
// authoritative-mode exception.

describe('requestFinancialService() — Runtime (Constitutional): dispatches to the EXISTING runConstitutionalServicePattern pipeline', () => {
  function pipelineResult(overrides: Partial<{
    ok: boolean;
    executed: boolean;
    blockedAtStep: number | null;
    gate: { ok: boolean; status?: number; reason?: string; agreementId?: string };
    agreementId: string | null;
    trace: Array<{ step: number; name: string; status: string; detail: string }>;
  }> = {}) {
    return {
      ok: true,
      mode: 'authoritative',
      domain: 'intelligence',
      executed: true,
      blockedAtStep: null,
      gate: { ok: true, agreementId: 'agr-runtime-1', status: 'authorized' },
      agreementId: 'agr-runtime-1',
      execution: null,
      verification: null,
      settlement: null,
      trace: [{ step: 3, name: 'Constitutional Agreement', status: 'ok', detail: 'authorized agr=agr-runtime-1' }],
      ...overrides,
    };
  }

  it('a successful pipeline run resolves DELIVERED, carrying the real execution result as providerOutput — never VELA authorisation/execution', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_CONSTITUTIONAL_PROVIDER]);
    mockRunConstitutionalServicePattern.mockResolvedValue(pipelineResult());

    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    expect(mockRunConstitutionalServicePattern).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'rehearsal intent for the provider',
        requestingPersonaId: ACTOR_PERSONA_ID,
        domain: 'intelligence',
        mode: 'authoritative',
      }),
    );
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.authorisationRef).toBeNull(); // never VELA's own ActionAuthorisation
    expect(outcome.executionRef).toBeNull(); // never VELA's own bindExecution
    expect(outcome.providerResultRef).toBe('agr-runtime-1');
    expect(outcome.providerOutput).toEqual(
      expect.objectContaining({ kind: 'RUNTIME_EXECUTION', domain: 'intelligence', executed: true, agreementId: 'agr-runtime-1' }),
    );
  });

  it('a REAL 409 agreement-gate refusal resolves REFUSED, never collapsed into the generic UNRESOLVED technical-failure bucket', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_CONSTITUTIONAL_PROVIDER]);
    mockRunConstitutionalServicePattern.mockResolvedValue(
      pipelineResult({
        ok: false,
        executed: false,
        blockedAtStep: 3,
        gate: { ok: false, status: 409, reason: 'no authorized agreement for this capability+agent' },
        agreementId: null,
        trace: [{ step: 3, name: 'Constitutional Agreement', status: 'refused', detail: '409: no authorized agreement for this capability+agent' }],
      }),
    );

    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    expect(outcome.status).toBe('REFUSED');
    expect(outcome.reason).toContain('409');
    expect(outcome.reason).toContain('no authorized agreement');
    expect(outcome.providerResultRef).toBeNull();
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('a forbidden-action refusal AFTER a successfully authorized agreement (gate.ok=true, blockedAtStep=5) still resolves REFUSED using the trace detail — gate.reason does not exist on that variant', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_CONSTITUTIONAL_PROVIDER]);
    mockRunConstitutionalServicePattern.mockResolvedValue(
      pipelineResult({
        ok: false,
        executed: false,
        blockedAtStep: 5,
        gate: { ok: true, agreementId: 'agr-runtime-2', status: 'authorized' },
        agreementId: 'agr-runtime-2',
        trace: [{ step: 5, name: 'Policy Validation', status: 'refused', detail: "action 'knowledge_retrieval' is in the agreement's forbidden envelope" }],
      }),
    );

    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    expect(outcome.status).toBe('REFUSED');
    expect(outcome.reason).toContain('forbidden envelope');
  });

  it('an unexpected pipeline exception resolves UNRESOLVED (technical failure), never REFUSED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_CONSTITUTIONAL_PROVIDER]);
    mockRunConstitutionalServicePattern.mockRejectedValue(new Error('unexpected pipeline crash'));

    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.reason).toContain('unexpected pipeline crash');
  });

  it('never dispatches without an authenticated principal — the eligibility gate already refuses it as INELIGIBLE before dispatch is ever attempted', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_CONSTITUTIONAL_PROVIDER]);

    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: null,
      callerAuthProfileId: null,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });

    expect(outcome.status).toBe('INELIGIBLE');
    expect(mockRunConstitutionalServicePattern).not.toHaveBeenCalled();
  });
});

describe('requestFinancialService() — Advisor: admission gate (unmodified)', () => {
  it('refuses when the consumer is not admitted — registry activation, unmodified', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
      Promise.resolve({
        registryActivated: agent.runtimeAgentId !== CONSUMER,
        agentRootDid: agent.runtimeAgentId !== CONSUMER ? 'did:agent:root:other' : CONSUMER_ROOT_DID,
        auditGaps: [],
      }),
    );
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('NOT_ADMITTED');
    expect(mockRunMoneyPennyChat).not.toHaveBeenCalled();
  });
});

// ── 2026-08-23 repair pass: inference-provider-unavailable classification +
//    real provider output preserved (Parts A/B/C) ──────────────────────────

describe('requestFinancialService() — inference-provider-unavailable is classified distinctly, never REFUSED', () => {
  it('Architect: an INFERENCE_PROVIDER_UNAVAILABLE draftFinancialStructure() failure resolves UNRESOLVED with errorCode set, never REFUSED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ARCHITECT_PROVIDER]);
    mockDraftFinancialStructure.mockResolvedValue({
      ok: false,
      error: "inference provider unavailable: anthropic: insufficient credits | openai: insufficient quota | venice: timed out",
      errorCode: 'INFERENCE_PROVIDER_UNAVAILABLE',
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ARCHITECT.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.status).not.toBe('REFUSED');
    expect(outcome.errorCode).toBe('INFERENCE_PROVIDER_UNAVAILABLE');
    expect(outcome.reason).toContain('inference provider unavailable');
    expect(outcome.providerOutput ?? null).toBeNull();
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('Advisor: an "all providers failed" throw from runMoneyPennyChat() classifies as INFERENCE_PROVIDER_UNAVAILABLE, not a generic failure', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockRunMoneyPennyChat.mockRejectedValue(
      new Error("[ModelRouter] stage=reasoning: all providers failed — anthropic: insufficient credits | openai: insufficient quota"),
    );
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.errorCode).toBe('INFERENCE_PROVIDER_UNAVAILABLE');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('Advisor: a non-provider-unavailable Advisor error (e.g. a thrown Error unrelated to inference) still resolves UNRESOLVED but WITHOUT the errorCode', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockRunMoneyPennyChat.mockRejectedValue(new Error('unexpected database error'));
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.errorCode ?? null).toBeNull();
  });
});

describe('requestFinancialService() — real provider output is preserved, never discarded (Part B)', () => {
  it('Advisor: a successful dispatch carries the FULL real prose in providerOutput.text, alongside (never instead of) the hashed providerResultRef', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockRunMoneyPennyChat.mockResolvedValue({
      response: 'This is the real, complete MoneyPenny advisory answer the operator must actually see.',
      timestamp: '2026-08-23T00:00:00.000Z',
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.providerOutput).toEqual({
      kind: 'ADVISOR_RESPONSE',
      text: 'This is the real, complete MoneyPenny advisory answer the operator must actually see.',
    });
    // The evidence reference is still a bounded commitment, never the raw prose itself.
    const advisorOutput = outcome.providerOutput as { kind: 'ADVISOR_RESPONSE'; text: string };
    expect(outcome.providerResultRef).not.toBe(advisorOutput.text);
    expect(outcome.providerResultRef).toHaveLength(16);
  });

  it('Architect: a successful dispatch carries title + a bounded preview + the persisted artifactId in providerOutput', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ARCHITECT_PROVIDER]);
    mockDraftFinancialStructure.mockResolvedValue({
      ok: true,
      artifactId: 'moneypenny-architect-artifact-2',
      recordId: 'rec-2',
      title: 'A Constitutional Fee-Split Structure',
      body: 'The full designed proposal body.',
      citedInvariantIds: [],
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ARCHITECT.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
    expect(outcome.providerOutput).toEqual({
      kind: 'ARCHITECT_PROPOSAL',
      title: 'A Constitutional Fee-Split Structure',
      preview: 'The full designed proposal body.',
      truncated: false,
      artifactId: 'moneypenny-architect-artifact-2',
    });
    expect(outcome.providerResultRef).toBe('moneypenny-architect-artifact-2');
  });

  it('Architect: a proposal body over the preview bound is truncated in providerOutput.preview, never in the persisted artifact', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ARCHITECT_PROVIDER]);
    const longBody = 'x'.repeat(900);
    mockDraftFinancialStructure.mockResolvedValue({
      ok: true,
      artifactId: 'moneypenny-architect-artifact-3',
      recordId: 'rec-3',
      title: 'Long Proposal',
      body: longBody,
      citedInvariantIds: [],
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ARCHITECT.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.providerOutput?.kind).toBe('ARCHITECT_PROPOSAL');
    const proposal = outcome.providerOutput as { kind: 'ARCHITECT_PROPOSAL'; preview: string; truncated: boolean };
    expect(proposal.truncated).toBe(true);
    expect(proposal.preview.length).toBeLessThan(longBody.length);
  });
});

// ── Repair B: the composed eligibility reason codes, each kept distinct ──

describe('eligibility — composed reason codes (Repair B), each an audit gap or a real negative, never conflated', () => {
  it('registryActivated: undefined resolves ADMISSION_UNRESOLVED, not NOT_ADMITTED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockResolveAgentAdmissionState.mockResolvedValue({
      registryActivated: undefined,
      agentRootDid: null,
      auditGaps: ['registry activation check failed: timeout'],
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('ADMISSION_UNRESOLVED');
    expect(outcome.reason).not.toContain('NOT_ADMITTED');
  });

  it('registryActivated: false (a real negative) resolves NOT_ADMITTED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockResolveAgentAdmissionState.mockResolvedValue({ registryActivated: false, agentRootDid: null, auditGaps: [] });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('NOT_ADMITTED');
  });

  it('admitted but not structurally assigned to this principal resolves NOT_ASSIGNED_TO_PRINCIPAL, never NOT_ADMITTED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    // persona_agent_assignments holds a row, but for a DIFFERENT agent —
    // this principal has never had Nakamoto assigned/bound to it.
    mockListAssignments.mockResolvedValue([assignmentRow('root-id-someone-else')]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('NOT_ASSIGNED_TO_PRINCIPAL');
    expect(outcome.reason).not.toContain('NOT_ADMITTED');
  });

  it('no authenticated principal at all resolves NOT_ASSIGNED_TO_PRINCIPAL, never a silently-granted eligibility', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: null,
      callerAuthProfileId: null,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('NOT_ASSIGNED_TO_PRINCIPAL');
    expect(mockListAssignments).not.toHaveBeenCalled();
  });

  it('an ASSIGNMENT read failure resolves ASSIGNMENT_UNRESOLVED, never collapsed into NOT_ASSIGNED_TO_PRINCIPAL', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    // agentRootId is null (root-identity read failed) — an audit gap, not a
    // real negative — so the assignment fact cannot be checked at all.
    mockResolveAgentAdmissionState.mockResolvedValue({
      registryActivated: true,
      agentRootId: null,
      agentRootDid: null,
      auditGaps: ['sponsorship read failed: timeout'],
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('ASSIGNMENT_UNRESOLVED');
  });

  it('CORE CORRECTION: a structurally assigned consumer with NO current delegation grant is still ELIGIBLE — the grant store cannot serve as the multi-agent eligibility roster', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    // No active grant at all for this persona (e.g. it is currently spent on
    // a DIFFERENT agent, since a persona may hold only one active grant).
    mockReadActiveGrant.mockResolvedValue(null);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
  });

  it('CORE CORRECTION (third pass): Financial Services verification is a PROVIDER/specialist question, never a consumer eligibility blocker for the current catalog — an Advisor request with incomplete verification is still DELIVERED', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockResolveFinancialServicesVerification.mockResolvedValue({
      pulseComplete: true,
      pnlComplete: false,
      financialServicesEligible: false,
    });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
  });

  it('an UNRESOLVED verification read never blocks a NOT_REQUIRED-policy service either', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockResolveFinancialServicesVerification.mockResolvedValue(undefined);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
  });
});

// ── consumerVerificationRequirement — opt-in policy, default NOT_REQUIRED ──

describe('consumerVerificationRequirement — an explicit, opt-in policy (third correction pass)', () => {
  function baseContext(overrides: Partial<FinancialServiceAgentContext> = {}): FinancialServiceAgentContext {
    return {
      agent: { runtimeAgentId: CONSUMER, aigentQubeId: 'aigentqube-nakamoto', agentCardPath: '/api/agents/nakamoto/agent-card.json', displayName: 'Aigent Nakamoto' } as any,
      admission: { registryActivated: true, agentRootId: CONSUMER_ROOT_ID, agentRootDid: CONSUMER_ROOT_DID, auditGaps: [] } as any,
      structurallyAssigned: true,
      activeGrant: null,
      hasCurrentDelegationToAgent: false,
      verification: undefined,
      standingPersonaId: null,
      standing: null,
      callerPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      ...overrides,
    };
  }

  it('every current catalog entry declares consumerVerificationRequirement: NOT_REQUIRED', () => {
    for (const definition of [MONEYPENNY_ADVISOR, MONEYPENNY_ARCHITECT, MONEYPENNY_RUNTIME]) {
      expect(definition.eligibilityPolicy.consumerVerificationRequirement).toBe('NOT_REQUIRED');
    }
  });

  it('a NOT_REQUIRED service is ELIGIBLE regardless of verification state (undefined, incomplete, or complete)', () => {
    for (const verification of [undefined, { pulseComplete: false, pnlComplete: false, financialServicesEligible: false }, { pulseComplete: true, pnlComplete: true, financialServicesEligible: true }]) {
      const result = evaluateFinancialServiceEligibility(MONEYPENNY_ADVISOR, baseContext({ verification: verification as any }));
      expect(result.eligible).toBe(true);
    }
  });

  it('a service that explicitly opts into consumerVerificationRequirement: REQUIRED still gates correctly — proves the mechanism was not simply deleted', () => {
    const requiredDefinition = {
      ...MONEYPENNY_ADVISOR,
      eligibilityPolicy: { ...MONEYPENNY_ADVISOR.eligibilityPolicy, consumerVerificationRequirement: 'REQUIRED' as const },
    };

    const unresolved = evaluateFinancialServiceEligibility(requiredDefinition, baseContext({ verification: undefined }));
    expect(unresolved).toMatchObject({ eligible: undefined, code: 'FINANCIAL_SERVICES_VERIFICATION_UNRESOLVED' });

    const notVerified = evaluateFinancialServiceEligibility(
      requiredDefinition,
      baseContext({ verification: { pulseComplete: true, pnlComplete: false, financialServicesEligible: false } }),
    );
    expect(notVerified).toMatchObject({ eligible: false, code: 'FINANCIAL_SERVICES_NOT_VERIFIED' });

    const verified = evaluateFinancialServiceEligibility(
      requiredDefinition,
      baseContext({ verification: { pulseComplete: true, pnlComplete: true, financialServicesEligible: true } }),
    );
    expect(verified.eligible).toBe(true);
  });
});

// ── publicForecast is optional — required ONLY for executionReachable ───

describe('requestFinancialService() — publicForecast is optional (2026-08-23 orchestration-boundary repair)', () => {
  it('never requires a publicForecast for Advisor/Architect (executionReachable: false) — omitting it still DELIVERS', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      // publicForecast omitted entirely — this must never throw.
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    } as any);
    expect(outcome.status).toBe('DELIVERED');
  });

  it('resolves UNRESOLVED — never throws — when an executionReachable (Runtime) request omits publicForecast', async () => {
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      publicForecast: null,
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('UNRESOLVED');
    expect(outcome.reason).toContain('public consequence forecast is required');
  });
});

// ── Repair C: real ConstitutionalAuthority, never a fabricated one ──────

describe('requestFinancialService() — real ConstitutionalAuthority (Repair C)', () => {
  it('resolves standingPersonaId server-side via resolveAgentStandingPersonaId — never from client input', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(mockResolveAgentStandingPersonaId).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runtimeAgentId: CONSUMER }),
      expect.anything(),
    );
  });

  it('resolves the mandate via requireAuthorizedAgreement — never a synthesized mandate-fsvc-oversight-* string', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(mockRequireAuthorizedAgreement).toHaveBeenCalledWith({
      capabilityRef: MONEYPENNY_ADVISOR.capabilityId,
      selectedAgentRef: CONSUMER,
      requestingPersonaId: ACTOR_PERSONA_ID,
    });
  });

  it('an unauthorized agreement still lets Advisor/Architect DELIVER (BOUNDED authority is sufficient — they never call deriveActionAuthorisation)', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_ADVISOR_PROVIDER]);
    mockRequireAuthorizedAgreement.mockResolvedValue({ ok: false, status: 409, reason: 'no agreement', remediation: 'form one' });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('DELIVERED');
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
    const { outcome, causalChain } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: realisticUnattestedEvidence('ACCEPTABLE'),
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
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
    // Attestation-independent: an UNACCEPTABLE verdict is a definite refusal
    // regardless of attestation state — proven with real (attested) evidence
    // so the REFUSED branch isn't conflated with the attestation-gated one.
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: {
        ...realisticUnattestedEvidence('UNACCEPTABLE'),
        teeAttestationVerified: true,
        attestationMode: 'NITRO_ATTESTED',
      },
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
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
      publicForecast: forecast(),
      confidentialEvidence: realisticUnattestedEvidence('ACCEPTABLE'),
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('STANDING_BELOW_THRESHOLD');
    expect(mockResolveCapabilityProviders).not.toHaveBeenCalled();
  });

  it('resolves STANDING_PERSONA_UNRESOLVED when the agent has no CRM Standing persona — never a guessed/client-supplied one', async () => {
    mockResolveAgentStandingPersonaId.mockResolvedValue(null);
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: realisticUnattestedEvidence('ACCEPTABLE'),
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('INELIGIBLE');
    expect(outcome.reason).toContain('STANDING_PERSONA_UNRESOLVED');
  });

  it('SYNTHETIC FIXTURE (proves the mechanism, not a live claim): once evidence carries a genuinely attested verdict and a real authorized agreement exists, Runtime reaches AUTHORISED, binds execution, and validates MATCHED_PROJECTION', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
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
      publicForecast: forecast(),
      confidentialEvidence: attestedEvidence,
      observedDisposition: 'ACCEPTABLE',
      observedState: { note: 'synthetic observation for mechanism proof' },
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('AUTHORISED');
    expect(outcome.serviceClass).toBe('CONSEQUENTIAL');
    expect(outcome.providerMode).toBe('RUNTIME');
    expect(outcome.executionRef).toBeTruthy();
    expect(outcome.observedConsequenceRef).toBeTruthy();
    expect(outcome.validationState).toBe('MATCHED_PROJECTION');
    // 2026-08-23 "close Standing" directive: the PROVIDER (MoneyPenny) that
    // did the work is credited, never the CONSUMER (Nakamoto) that merely
    // requested it. The consumer is preserved only as `requestingAgentRef`
    // context evidence.
    expect(mockAccrueStanding).toHaveBeenCalledWith(
      expect.objectContaining({ crmPersonaId: PROVIDER_CRM_PERSONA_ID, subjectAgentRef: PROVIDER, requestingAgentRef: CONSUMER }),
    );
  });

  it('an attested verdict WITHOUT an authorized agreement stays BOUNDED, not ACTIVE — deriveActionAuthorisation REFUSES for lack of authority', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
    mockRequireAuthorizedAgreement.mockResolvedValue({ ok: false, status: 409, reason: 'no agreement', remediation: 'form one' });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
      publicForecast: forecast(),
      confidentialEvidence: {
        provider: 'vela',
        requestRef: '0xsynthetic-noagreement',
        disposition: 'ACCEPTABLE',
        resultCommitment: 'c',
        payloadCommitment: 'p',
        protocolExecutionVerified: true,
        teeAttestationVerified: true,
        attestationMode: 'NITRO_ATTESTED',
      },
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
      now: '2026-08-22T00:00:00.000Z',
      admin: fakeSupabase as any,
    });
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.executionRef).toBeNull();
  });

  it('execution binding is never confirmation — transactionRef is always absent, even in the synthetic AUTHORISED case', async () => {
    mockResolveCapabilityProviders.mockResolvedValue([MONEYPENNY_RUNTIME_PROVIDER]);
    const { causalChain } = await requestFinancialService({
      request: request(MONEYPENNY_RUNTIME.serviceId),
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
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
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
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
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
    mockResolveAgentAdmissionState.mockResolvedValue({
      delegationActive: true,
      registryActivated: true,
      agentRootId: KNOW1_ROOT_ID,
      agentRootDid: KNOW1_ROOT_DID,
      auditGaps: [],
    });
    mockListAssignments.mockResolvedValue([assignmentRow(KNOW1_ROOT_ID)]);
    mockReadActiveGrant.mockResolvedValue({ grant_id: 'grant-know1', agent_root_did: KNOW1_ROOT_DID, persona_id: ACTOR_PERSONA_ID });
    const { outcome } = await requestFinancialService({
      request: request(MONEYPENNY_ADVISOR.serviceId, { requestingAgentId: 'aigent-kn0w1', requestRef: 'req-know1-advisor' }),
      publicForecast: forecast(),
      confidentialEvidence: null,
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
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

// ── Discovery — Standing/admission drive what a consumer is offered, resolved ONCE (Stage 3.2 + Repair F) ──

describe('discoverFinancialServicesForConsumer() / discoverEligibleFinancialServices() — Standing/admission drive discovery, resolved once', () => {
  it('an admitted consumer below the Runtime Standing floor sees Advisor/Architect eligible but Runtime ineligible', async () => {
    mockComputeStandingScore.mockResolvedValue({ score: 10, qualified: false });

    const discovered = await discoverFinancialServicesForConsumer(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) throw new Error('unreachable');
    expect(discovered.services).toHaveLength(4);
    // Resolved ONCE per request (Repair F) — not once per catalog item.
    expect(mockResolveAgentAdmissionState).toHaveBeenCalledTimes(1);

    const byId = new Map(discovered.services.map((d) => [d.definition.serviceId, d]));
    expect(byId.get(MONEYPENNY_ADVISOR.serviceId)?.eligibility.eligible).toBe(true);
    expect(byId.get(MONEYPENNY_ARCHITECT.serviceId)?.eligibility.eligible).toBe(true);
    expect(byId.get(MONEYPENNY_RUNTIME.serviceId)?.eligibility.eligible).toBe(false);
    expect(byId.get(MONEYPENNY_RUNTIME.serviceId)?.eligibility.code).toBe('STANDING_BELOW_THRESHOLD');
    expect(byId.get(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId)?.eligibility.eligible).toBe(false);
    expect(byId.get(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId)?.eligibility.code).toBe('STANDING_BELOW_THRESHOLD');
    // Advisor/Architect never compute an authority prerequisite — they never
    // reach real authorisation. Runtime (Constitutional) is also
    // executionReachable:false (its real authorization is the EXISTING
    // constitutionalAgreement.ts gate, resolved only at dispatch time), so it
    // never computes one either.
    expect(byId.get(MONEYPENNY_ADVISOR.serviceId)?.authority).toBeNull();
    expect(byId.get(MONEYPENNY_ARCHITECT.serviceId)?.authority).toBeNull();
    expect(byId.get(MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId)?.authority).toBeNull();

    const eligible = await discoverEligibleFinancialServices(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(eligible.map((d) => d.serviceId).sort()).toEqual(
      [MONEYPENNY_ADVISOR.serviceId, MONEYPENNY_ARCHITECT.serviceId].sort(),
    );
  });

  it('an admitted consumer at/above the Runtime Standing floor sees all four services eligible', async () => {
    const eligible = await discoverEligibleFinancialServices(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(eligible.map((d) => d.serviceId).sort()).toEqual(
      [
        MONEYPENNY_ADVISOR.serviceId,
        MONEYPENNY_ARCHITECT.serviceId,
        MONEYPENNY_RUNTIME.serviceId,
        MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId,
      ].sort(),
    );
  });

  it('CORE CORRECTION: Runtime is still ELIGIBLE with no current delegation grant — authority is a separate, non-blocking prerequisite reading PENDING', async () => {
    mockReadActiveGrant.mockResolvedValue(null);

    const discovered = await discoverFinancialServicesForConsumer(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) throw new Error('unreachable');

    const runtime = discovered.services.find((d) => d.definition.serviceId === MONEYPENNY_RUNTIME.serviceId);
    expect(runtime?.eligibility.eligible).toBe(true);
    expect(runtime?.authority).toEqual(
      expect.objectContaining({ state: 'PENDING', met: false, code: 'AUTHORITY_DELEGATION_REQUIRED' }),
    );
  });

  it('once a current delegation AND an authorized mandate both exist, Runtime\'s authority prerequisite reads ACTIVE', async () => {
    const discovered = await discoverFinancialServicesForConsumer(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) throw new Error('unreachable');

    const runtime = discovered.services.find((d) => d.definition.serviceId === MONEYPENNY_RUNTIME.serviceId);
    expect(runtime?.authority).toEqual(expect.objectContaining({ state: 'ACTIVE', met: true, code: 'AUTHORITY_ACTIVE' }));
  });

  it('a non-admitted consumer sees nothing eligible, including Advisor/Architect which have no Standing requirement', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({ registryActivated: false, agentRootDid: null, auditGaps: [] });

    const discovered = await discoverFinancialServicesForConsumer(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) throw new Error('unreachable');
    expect(discovered.services.every((d) => d.eligibility.eligible === false)).toBe(true);
    expect(discovered.services.every((d) => d.eligibility.code === 'NOT_ADMITTED')).toBe(true);
    // The admission diagnostic surfaces from the SAME resolved context.
    expect(discovered.context.admission?.registryActivated).toBe(false);

    const eligible = await discoverEligibleFinancialServices(CONSUMER, fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(eligible).toHaveLength(0);
  });

  it('a second, distinct consumer (Aigent Know1) run through the identical discovery function reflects its own Standing — no per-consumer branch', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({
      delegationActive: true,
      registryActivated: true,
      agentRootId: KNOW1_ROOT_ID,
      agentRootDid: KNOW1_ROOT_DID,
      auditGaps: [],
    });
    mockListAssignments.mockResolvedValue([assignmentRow(KNOW1_ROOT_ID)]);
    mockReadActiveGrant.mockResolvedValue({ grant_id: 'grant-know1', agent_root_did: KNOW1_ROOT_DID, persona_id: ACTOR_PERSONA_ID });
    mockComputeStandingScore.mockResolvedValue({ score: 100, qualified: true });

    const eligible = await discoverEligibleFinancialServices('aigent-kn0w1', fakeSupabase as any, {
      actorPersonaId: ACTOR_PERSONA_ID,
      callerAuthProfileId: ACTOR_AUTH_PROFILE_ID,
    });
    expect(eligible.map((d) => d.serviceId).sort()).toEqual(
      [
        MONEYPENNY_ADVISOR.serviceId,
        MONEYPENNY_ARCHITECT.serviceId,
        MONEYPENNY_RUNTIME.serviceId,
        MONEYPENNY_RUNTIME_CONSTITUTIONAL.serviceId,
      ].sort(),
    );
  });

  it('returns an error result for an unknown agent id — never a thrown exception', async () => {
    const discovered = await discoverFinancialServicesForConsumer('aigent-does-not-exist', fakeSupabase as any);
    expect(discovered.ok).toBe(false);
  });
});
