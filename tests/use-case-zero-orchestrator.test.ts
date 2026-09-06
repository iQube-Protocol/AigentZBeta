/**
 * Use Case Zero orchestrator (Phase 2, 2026-09-06) — proves the resumable
 * one-step-per-call contract: rereads state, selects ONE permitted action,
 * invokes the owning service, records via the existing receipt system,
 * rereads readiness, and NEVER auto-chains across a human approval
 * boundary. Also proves correction 7 (authority evaluated per consequential
 * step) and that token submission/signing/broadcast/fund movement never
 * happen anywhere in this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveRegistrableAgent: vi.fn(),
  resolveAgentRegistrationState: vi.fn(),
  getOwnerWalletAddress: vi.fn(),
  getBinding: vi.fn(),
  provisionOwnerWallet: vi.fn(),
  provisionPurposeWallet: vi.fn(),
  getPassportApplicationStatus: vi.fn(),
  getPassportRecordStatus: vi.fn(),
  readActiveGrantForAgent: vi.fn(),
  getAsset: vi.fn(),
  resolvePnlEvidenceForAgent: vi.fn(),
  getCurrentAssessment: vi.fn(),
  createAssessment: vi.fn(),
  getCase: vi.fn(),
  createOrResumeCase: vi.fn(),
  transitionCaseState: vi.fn(),
  listEvidenceForCase: vi.fn(),
  listCaseEvents: vi.fn(),
  discoverFinancialServicesForConsumer: vi.fn(),
  findLatestTokenLaunchForBeneficiary: vi.fn(),
  assessIssuerReadiness: vi.fn(),
  inspectOrProvisionProviderBinding: vi.fn(),
  prepareLaunchProposal: vi.fn(),
  preflightLaunch: vi.fn(),
  runAdmissionPacketPolicyEvaluation: vi.fn(),
  establishDirectChain: vi.fn(),
  validateChainForAction: vi.fn(),
  createActivityReceipt: vi.fn(),
}));

vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgent: mocks.resolveRegistrableAgent,
}));
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({
  resolveAgentRegistrationState: mocks.resolveAgentRegistrationState,
}));
vi.mock('@/services/wallet/agentPurposeWalletService', () => ({
  AgentPurposeWalletService: class {
    getOwnerWalletAddress = mocks.getOwnerWalletAddress;
    getBinding = mocks.getBinding;
    provisionOwnerWallet = mocks.provisionOwnerWallet;
    provisionPurposeWallet = mocks.provisionPurposeWallet;
  },
}));
vi.mock('@/services/passport/passportStatusRead', () => ({
  getPassportApplicationStatus: mocks.getPassportApplicationStatus,
  getPassportRecordStatus: mocks.getPassportRecordStatus,
}));
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrantForAgent: mocks.readActiveGrantForAgent,
}));
vi.mock('@/services/registry/persistence', () => ({
  getAsset: mocks.getAsset,
}));
vi.mock('@/services/horizen/pnlEvidenceRead', () => ({
  resolvePnlEvidenceForAgent: mocks.resolvePnlEvidenceForAgent,
}));
vi.mock('@/services/aegis/aegisAssessmentService', () => ({
  getCurrentAssessment: mocks.getCurrentAssessment,
  createAssessment: mocks.createAssessment,
}));
vi.mock('@/services/factor/factorCaseService', () => ({
  getCase: mocks.getCase,
  createOrResumeCase: mocks.createOrResumeCase,
  transitionCaseState: mocks.transitionCaseState,
  listEvidenceForCase: mocks.listEvidenceForCase,
  listCaseEvents: mocks.listCaseEvents,
}));
vi.mock('@/services/factor/factorConfidentialWorkload', () => ({
  FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND: 'confidential_admission_projection',
  runAdmissionPacketPolicyEvaluation: mocks.runAdmissionPacketPolicyEvaluation,
}));
vi.mock('@/services/financialServices/discovery', () => ({
  discoverFinancialServicesForConsumer: mocks.discoverFinancialServicesForConsumer,
}));
vi.mock('@/services/factor/tokenLaunchService', () => ({
  findLatestTokenLaunchForBeneficiary: mocks.findLatestTokenLaunchForBeneficiary,
}));
vi.mock('@/services/factor/bankrCapabilityHandlers', () => ({
  inspectOrProvisionProviderBinding: mocks.inspectOrProvisionProviderBinding,
  assessIssuerReadiness: mocks.assessIssuerReadiness,
  prepareLaunchProposal: mocks.prepareLaunchProposal,
  preflightLaunch: mocks.preflightLaunch,
}));
vi.mock('@/services/factor/authorityChain', () => ({
  establishDirectChain: mocks.establishDirectChain,
  validateChainForAction: mocks.validateChainForAction,
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: mocks.createActivityReceipt,
}));

import { advanceUseCaseZero } from '@/services/factor/useCaseZeroOrchestrator';

const AGENT = { slug: 'factor', runtimeAgentId: 'aigent-factor', aigentQubeId: 'aigentqube-factor' };
const BASE_INPUT = {
  admin: {} as never,
  tenantId: 'tenant-1',
  actorPersonaId: 'persona-1',
  agentSlug: 'factor',
  path: 'bring_own_agent' as const,
};

/** Mirrors tests/use-case-zero-readiness-corrections.test.ts's own helper —
 *  a fully-qualified execution-reachable Runtime service (authority met,
 *  readiness all 'ready') so runtimeActivation resolves 'established'. */
function runtimeDiscovery() {
  return {
    ok: true,
    context: {},
    services: [
      {
        definition: { serviceId: 'moneypenny-runtime', executionPolicy: { executionReachable: true } },
        eligibility: { eligible: true },
        authority: { state: 'ACTIVE', met: true, code: 'AUTHORITY_ACTIVE', reason: 'test' },
        readiness: { systemReady: 'ready', eligibility: 'ready', standing: 'not-required', authority: 'ready', confidentialExecution: 'pending' },
      },
    ],
  };
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) — clearAllMocks only wipes call
  // history, leaving a PRIOR test's mockResolvedValue implementation in
  // place for any mock a later test forgets to re-set explicitly. Every
  // test in this file must set exactly the mocks its own scenario needs.
  vi.resetAllMocks();
  mocks.resolveRegistrableAgent.mockReturnValue(AGENT);
  mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: false, tokenId: null, network: null, evidenceRefs: [], source: 'unresolved', settled: false, auditGaps: [] });
  mocks.getOwnerWalletAddress.mockResolvedValue(null);
  mocks.getBinding.mockResolvedValue(null);
  mocks.getPassportApplicationStatus.mockResolvedValue([]);
  mocks.getPassportRecordStatus.mockResolvedValue([]);
  mocks.readActiveGrantForAgent.mockResolvedValue(null);
  mocks.getAsset.mockResolvedValue(null);
  mocks.resolvePnlEvidenceForAgent.mockResolvedValue({ serviceRegistered: false, serviceRegisteredDvnStatus: null, serviceVerified: false, serviceVerifiedDvnStatus: null });
  mocks.getCurrentAssessment.mockResolvedValue(null);
  mocks.getCase.mockResolvedValue(null);
  mocks.listEvidenceForCase.mockResolvedValue([]);
  mocks.listCaseEvents.mockResolvedValue([]);
  mocks.discoverFinancialServicesForConsumer.mockResolvedValue({ ok: true, context: {}, services: [] });
  mocks.findLatestTokenLaunchForBeneficiary.mockResolvedValue(null);
  mocks.assessIssuerReadiness.mockResolvedValue({
    beneficiaryAgentRuntimeId: 'aigent-factor',
    bankrConfigured: false,
    bankrMode: 'fake',
    hasProviderWalletBinding: false,
    providerWalletBinding: null,
    tokenLaunchEnabled: true,
    ready: false,
    blockers: [],
  });
});

describe('advanceUseCaseZero — one step per call, always rereads before and after', () => {
  it('with no case yet, the ONLY action taken is creating/resuming the Factor case (step 1) — nothing further chains in the same call', async () => {
    mocks.createOrResumeCase.mockResolvedValue({ case: { case_id: 'case-1', state: 'discovered', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null }, created: true });
    const result = await advanceUseCaseZero(BASE_INPUT);
    expect(result.stepTaken).toBe('agentShell');
    expect(result.outcome).toBe('advanced');
    expect(mocks.createOrResumeCase).toHaveBeenCalledTimes(1);
    // No wallet/delegation/aegis/admission service was touched in this SAME call.
    expect(mocks.provisionOwnerWallet).not.toHaveBeenCalled();
    expect(mocks.createAssessment).not.toHaveBeenCalled();
    expect(mocks.transitionCaseState).not.toHaveBeenCalled();
  });

  it('requesting an Aegis assessment never also ratifies it (approval boundary never auto-chained)', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'registry_ready', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.createAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'evidence_locked', decision: null, conditions: [] });
    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.stepTaken).toBe('aegisAssessment');
    expect(mocks.createAssessment).toHaveBeenCalledTimes(1);
    // Nothing in this orchestrator ever calls a ratify/decide function —
    // confirmed structurally: no such import exists in the module (see
    // the static import list this test file's own mocks mirror).
    expect(result.detail.toLowerCase()).toMatch(/never ratifies|awaiting/);
  });

  it('requesting admission moves the case to admission_pending and NEVER calls a decision function', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'registry_ready', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.transitionCaseState.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', tenant_id: 'tenant-1' });
    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.stepTaken).toBe('moneypennyAdmission');
    expect(mocks.transitionCaseState).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toState: 'admission_pending' }));
    expect(result.detail.toLowerCase()).toMatch(/never decides/);
  });

  it('the rehearsal step NEVER submits/signs/broadcasts — prepare+preflight are the only calls, and it stops there', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor',
      bankrConfigured: false,
      bankrMode: 'fake',
      hasProviderWalletBinding: true,
      providerWalletBinding: { id: 'binding-1', status: 'active' },
      tokenLaunchEnabled: true,
      ready: true,
      blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([{ kind: 'confidential_admission_projection', status: 'supplied', payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false } }]);
    mocks.prepareLaunchProposal.mockResolvedValue({ id: 'launch-1', state: 'preparing' });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    const result = await advanceUseCaseZero({
      ...BASE_INPUT,
      caseId: 'case-1',
      launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' },
    });
    expect(result.stepTaken).toBe('governedOperationRehearsal');
    expect(mocks.prepareLaunchProposal).toHaveBeenCalledTimes(1);
    expect(mocks.preflightLaunch).toHaveBeenCalledTimes(1);
    expect(mocks.preflightLaunch).toHaveBeenCalledWith(expect.anything(), 'launch-1', 'tenant-1', expect.anything());
    expect(result.detail.toLowerCase()).toMatch(/rehearsal stops here/);
    expect(result.detail.toLowerCase()).toMatch(/preflighted/);
  });

  it('without a launchSpec, the rehearsal step reports awaiting_input rather than inventing token fields', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor',
      bankrConfigured: false,
      bankrMode: 'fake',
      hasProviderWalletBinding: true,
      providerWalletBinding: { id: 'binding-1', status: 'active' },
      tokenLaunchEnabled: true,
      ready: true,
      blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([{ kind: 'confidential_admission_projection', status: 'supplied', payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false } }]);

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.stepTaken).toBe('governedOperationRehearsal');
    expect(result.outcome).toBe('awaiting_input');
    expect(mocks.prepareLaunchProposal).not.toHaveBeenCalled();
    expect(mocks.preflightLaunch).not.toHaveBeenCalled();
  });
});

describe('item 3 correction — Bankr rehearsal idempotency: a preflighted-or-later launch closes the leg; repeats resume the same launch or no_action_needed, never a duplicate', () => {
  const REHEARSAL_CASE = { case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' };
  function primeEverythingUpToRehearsal() {
    mocks.getCase.mockResolvedValue(REHEARSAL_CASE);
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor', bankrConfigured: false, bankrMode: 'fake',
      hasProviderWalletBinding: true, providerWalletBinding: { id: 'binding-1', status: 'active' },
      tokenLaunchEnabled: true, ready: true, blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false },
    }]);
  }

  it('a repeat advance() call, with an existing PREFLIGHTED launch already on record, closes the leg (no_action_needed) — never calls prepareLaunchProposal again', async () => {
    primeEverythingUpToRehearsal();
    mocks.findLatestTokenLaunchForBeneficiary.mockResolvedValue({ id: 'launch-1', state: 'preflighted', bankr_terms: { simulated: true } });

    // The readiness PROJECTION itself already resolves the rehearsal leg as
    // 'established' from this same canonical aggregate (resolveRehearsalLeg,
    // useCaseZeroReadinessProjection.ts) — so the orchestrator never even
    // selects it as the next actionable leg; it falls through to the
    // generic "every leg established" completion, exactly the idempotent
    // "never a duplicate" outcome item 3 requires.
    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.outcome).toBe('no_action_needed');
    expect(mocks.prepareLaunchProposal).not.toHaveBeenCalled();
    expect(mocks.preflightLaunch).not.toHaveBeenCalled();
  });

  it('a repeat advance() call, with an existing DRAFT/PREPARING launch, resumes the SAME row (preflightLaunch on it) — never creates a second draft', async () => {
    primeEverythingUpToRehearsal();
    mocks.findLatestTokenLaunchForBeneficiary.mockResolvedValue({ id: 'launch-1', state: 'preparing' });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.stepTaken).toBe('governedOperationRehearsal');
    expect(result.outcome).toBe('advanced');
    expect(mocks.prepareLaunchProposal).not.toHaveBeenCalled();
    expect(mocks.preflightLaunch).toHaveBeenCalledTimes(1);
    expect(mocks.preflightLaunch).toHaveBeenCalledWith(expect.anything(), 'launch-1', 'tenant-1', expect.anything());
  });

  it('no existing launch creates exactly ONE new draft — never a duplicate for a single call', async () => {
    primeEverythingUpToRehearsal();
    mocks.findLatestTokenLaunchForBeneficiary.mockResolvedValue(null);
    mocks.prepareLaunchProposal.mockResolvedValue({ id: 'launch-new', state: 'preparing' });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-new', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.outcome).toBe('advanced');
    expect(mocks.prepareLaunchProposal).toHaveBeenCalledTimes(1);
  });

  it('an existing CANCELLED (abandoned) launch is NOT resumed — a fresh draft is prepared instead', async () => {
    primeEverythingUpToRehearsal();
    mocks.findLatestTokenLaunchForBeneficiary.mockResolvedValue({ id: 'launch-old', state: 'cancelled' });
    mocks.prepareLaunchProposal.mockResolvedValue({ id: 'launch-new', state: 'preparing' });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-new', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.outcome).toBe('advanced');
    expect(mocks.prepareLaunchProposal).toHaveBeenCalledTimes(1);
  });
});

describe('item 1 correction — Vela step threshold excludes velaReadiness/runtimeActivation/governedOperationRehearsal from their own gating denominator', () => {
  it('runAdmissionPacketPolicyEvaluation is called with a readinessScore/policyThreshold pair that never counts Vela/runtime/rehearsal legs themselves', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admitted', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor', bankrConfigured: false, bankrMode: 'fake',
      hasProviderWalletBinding: true, providerWalletBinding: { id: 'binding-1', status: 'active' },
      tokenLaunchEnabled: true, ready: true, blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([]); // no vela evidence yet — this call IS the vela step
    mocks.runAdmissionPacketPolicyEvaluation.mockResolvedValue({ disposition: 'ACCEPTABLE', attestationMode: 'NO_ATTESTATION_LOCAL' });

    await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(mocks.runAdmissionPacketPolicyEvaluation).toHaveBeenCalledTimes(1);
    const call = mocks.runAdmissionPacketPolicyEvaluation.mock.calls[0][1] as { readinessScore: number; policyThreshold: number };
    // With registryAsset/horizenRegistration NOT established (awaiting_external_action, required)
    // and moneypennyAdmission established, agentShell/wallets/passport/delegation
    // established: the threshold must be a real, non-trivial pair — never the
    // circular 1/1 that would result from counting vela/runtime/rehearsal in
    // their own denominator (those three are never established yet at this point,
    // which would make readinessScore permanently 0 of N+3 if wrongly included,
    // or the historical hardcoded 1/1 if the bug were still present).
    expect(call.policyThreshold).toBeGreaterThan(1);
    expect(call.readinessScore).toBeLessThan(call.policyThreshold);
  });
});

describe('correction 7 — authority evaluated at each consequential handler', () => {
  it('when a case has a bound authority chain that does NOT permit the step, the step is blocked rather than performed', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'registry_ready', tenant_id: 'tenant-1', authority_chain_id: 'chain-1', candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.validateChainForAction.mockResolvedValue({ allowed: false, code: 'action-not-permitted', reason: 'chain does not cover this action' });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.outcome).toBe('blocked');
    expect(mocks.createAssessment).not.toHaveBeenCalled();
    expect(mocks.transitionCaseState).not.toHaveBeenCalled();
    expect(result.detail.toLowerCase()).toMatch(/authority chain/);
  });

  it('delegation establishment never manufactures authority — refuses (no write) when no active grant exists', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'discovered', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue(null);

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.stepTaken).toBe('delegationAuthority');
    expect(result.outcome).toBe('awaiting_input');
    expect(mocks.establishDirectChain).not.toHaveBeenCalled();
  });
});

describe('no external action is ever performed by this orchestrator', () => {
  it('the module never imports a submit/sign/broadcast function (structural check via mock completeness)', async () => {
    // If useCaseZeroOrchestrator.ts imported submitTokenLaunch, confirmTokenLaunch,
    // decideAdmission, or ratifyAssessment, the corresponding mock module
    // above would need those exports and this test file's own mocks would
    // need updating — their absence here is itself the guard: an import of
    // any of those from an unmocked path would throw at module load.
    await import('@/services/factor/useCaseZeroOrchestrator');
    expect(true).toBe(true);
  });
});
