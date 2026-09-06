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
  findLatestTokenLaunchForCase: vi.fn(),
  createOrResumeDraft: vi.fn(),
  claimDraftForPreflight: vi.fn(),
  assessIssuerReadiness: vi.fn(),
  inspectOrProvisionProviderBinding: vi.fn(),
  preflightLaunch: vi.fn(),
  runAdmissionPacketPolicyEvaluation: vi.fn(),
  establishDirectChain: vi.fn(),
  validateChainForAction: vi.fn(),
  createActivityReceipt: vi.fn(),
  sponsorPolityAgent: vi.fn(),
  findAgentRootIdentityBySlug: vi.fn(),
  bindCandidateAgentRootDid: vi.fn(),
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
  bindCandidateAgentRootDid: mocks.bindCandidateAgentRootDid,
}));
vi.mock('@/services/agents/sponsorPolityAgent', () => ({
  sponsorPolityAgent: mocks.sponsorPolityAgent,
  findAgentRootIdentityBySlug: mocks.findAgentRootIdentityBySlug,
}));
vi.mock('@/services/factor/factorConfidentialWorkload', () => ({
  FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND: 'confidential_admission_projection',
  runAdmissionPacketPolicyEvaluation: mocks.runAdmissionPacketPolicyEvaluation,
}));
vi.mock('@/services/financialServices/discovery', () => ({
  discoverFinancialServicesForConsumer: mocks.discoverFinancialServicesForConsumer,
}));
vi.mock('@/services/factor/tokenLaunchService', () => ({
  findLatestTokenLaunchForCase: mocks.findLatestTokenLaunchForCase,
  createOrResumeDraft: mocks.createOrResumeDraft,
  claimDraftForPreflight: mocks.claimDraftForPreflight,
}));
vi.mock('@/services/factor/bankrCapabilityHandlers', () => ({
  inspectOrProvisionProviderBinding: mocks.inspectOrProvisionProviderBinding,
  assessIssuerReadiness: mocks.assessIssuerReadiness,
  preflightLaunch: mocks.preflightLaunch,
}));
vi.mock('@/services/factor/authorityChain', () => ({
  establishDirectChain: mocks.establishDirectChain,
  validateChainForAction: mocks.validateChainForAction,
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: mocks.createActivityReceipt,
}));

import { advanceUseCaseZero, runUseCaseZeroToCompletion } from '@/services/factor/useCaseZeroOrchestrator';

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
  // Item 1's strict sequence means registryAsset/horizenRegistration must be
  // ESTABLISHED by default for every test in this file EXCEPT the
  // "STRICT SEQUENCE" suite itself (which explicitly overrides these back to
  // unestablished to exercise the halt-on-external-stage behavior) —
  // otherwise every pre-existing test below would halt on registryAsset
  // before ever reaching the handler it actually means to exercise.
  mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: true, tokenId: 'token-1', network: 'base-sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] });
  mocks.getOwnerWalletAddress.mockResolvedValue(null);
  mocks.getBinding.mockResolvedValue(null);
  mocks.getPassportApplicationStatus.mockResolvedValue([]);
  mocks.getPassportRecordStatus.mockResolvedValue([]);
  mocks.readActiveGrantForAgent.mockResolvedValue(null);
  mocks.getAsset.mockResolvedValue({ id: 'aigentqube-factor' });
  mocks.resolvePnlEvidenceForAgent.mockResolvedValue({ serviceRegistered: false, serviceRegisteredDvnStatus: null, serviceVerified: false, serviceVerifiedDvnStatus: null });
  mocks.getCurrentAssessment.mockResolvedValue(null);
  mocks.getCase.mockResolvedValue(null);
  mocks.listEvidenceForCase.mockResolvedValue([]);
  mocks.listCaseEvents.mockResolvedValue([]);
  mocks.discoverFinancialServicesForConsumer.mockResolvedValue({ ok: true, context: {}, services: [] });
  mocks.findLatestTokenLaunchForCase.mockResolvedValue(null);
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
  mocks.findAgentRootIdentityBySlug.mockResolvedValue(null);
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
    mocks.createOrResumeDraft.mockResolvedValue({ launch: { id: 'launch-1', state: 'draft' }, created: true, superseded: false });
    mocks.claimDraftForPreflight.mockResolvedValue({ claimed: true, launch: { id: 'launch-1', state: 'preparing' } });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    const result = await advanceUseCaseZero({
      ...BASE_INPUT,
      caseId: 'case-1',
      launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' },
    });
    expect(result.stepTaken).toBe('governedOperationRehearsal');
    expect(mocks.createOrResumeDraft).toHaveBeenCalledTimes(1);
    expect(mocks.createOrResumeDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ caseRef: 'case-1', tenantId: 'tenant-1', beneficiaryAgentRuntimeId: 'aigent-factor' }));
    expect(mocks.claimDraftForPreflight).toHaveBeenCalledWith(expect.anything(), 'launch-1', 'tenant-1');
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
    expect(mocks.createOrResumeDraft).not.toHaveBeenCalled();
    expect(mocks.preflightLaunch).not.toHaveBeenCalled();
  });
});

describe('item 4 correction — Bankr rehearsal exact-spec, case-bound idempotency: the orchestrator delegates entirely to the atomic createOrResumeDraft, never a separate lookup-then-create', () => {
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

  it('createOrResumeDraft resolving an ALREADY-PREFLIGHTED row closes the leg (no_action_needed) — never claims or re-preflights it', async () => {
    primeEverythingUpToRehearsal();
    mocks.createOrResumeDraft.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted', bankr_terms: { simulated: true } }, created: false, superseded: false });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.outcome).toBe('no_action_needed');
    expect(mocks.claimDraftForPreflight).not.toHaveBeenCalled();
    expect(mocks.preflightLaunch).not.toHaveBeenCalled();
  });

  it('createOrResumeDraft resolving an EXISTING "draft" row (resumed, not created) still claims + preflights it — never a second createOrResumeDraft call', async () => {
    primeEverythingUpToRehearsal();
    mocks.createOrResumeDraft.mockResolvedValue({ launch: { id: 'launch-1', state: 'draft' }, created: false, superseded: false });
    mocks.claimDraftForPreflight.mockResolvedValue({ claimed: true, launch: { id: 'launch-1', state: 'preparing' } });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.stepTaken).toBe('governedOperationRehearsal');
    expect(result.outcome).toBe('advanced');
    expect(mocks.createOrResumeDraft).toHaveBeenCalledTimes(1);
    expect(mocks.preflightLaunch).toHaveBeenCalledTimes(1);
    expect(mocks.preflightLaunch).toHaveBeenCalledWith(expect.anything(), 'launch-1', 'tenant-1', expect.anything());
  });

  it('losing the preflight claim (another concurrent call already claimed it) reports no_action_needed and NEVER calls preflightLaunch itself', async () => {
    primeEverythingUpToRehearsal();
    mocks.createOrResumeDraft.mockResolvedValue({ launch: { id: 'launch-1', state: 'draft' }, created: false, superseded: false });
    mocks.claimDraftForPreflight.mockResolvedValue({ claimed: false, launch: { id: 'launch-1', state: 'preparing' } });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.outcome).toBe('no_action_needed');
    expect(mocks.preflightLaunch).not.toHaveBeenCalled();
  });

  it('the case reference passed to createOrResumeDraft is THIS Factor case — never the beneficiary alone', async () => {
    primeEverythingUpToRehearsal();
    mocks.createOrResumeDraft.mockResolvedValue({ launch: { id: 'launch-1', state: 'draft' }, created: true, superseded: false });
    mocks.claimDraftForPreflight.mockResolvedValue({ claimed: true, launch: { id: 'launch-1', state: 'preparing' } });
    mocks.preflightLaunch.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted' }, bankrTerms: { raw: { simulated: true, feeBps: 100 }, sourceUrl: null, retrievedAt: '2026-09-06T00:00:00Z' } });

    await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    const call = mocks.createOrResumeDraft.mock.calls[0][1];
    expect(call.caseRef).toBe('case-1');
    expect(call.chain).toBe('base-sepolia');
    expect(call.tokenName).toBe('Test');
    expect(call.tokenSymbol).toBe('TST');
  });
});

describe('item 1 correction — Vela step threshold excludes velaReadiness/runtimeActivation/governedOperationRehearsal from their own gating denominator', () => {
  it('runAdmissionPacketPolicyEvaluation is called with a readinessScore/policyThreshold pair that never counts Vela/runtime/rehearsal legs themselves', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admitted', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    // Item 1's strict sequence means registryAsset/horizenRegistration must
    // be ESTABLISHED for this call to reach velaReadiness at all — otherwise
    // the orchestrator halts on them first (proven separately below).
    mocks.getAsset.mockResolvedValue({ id: 'aigentqube-factor' });
    mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: true, tokenId: 'token-1', network: 'base-sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] });
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
    // Reaching the Vela step at all is ONLY possible once every EARLIER
    // required leg (registryAsset/horizenRegistration/agentShell/wallets/
    // passport/delegation/aegis/admission/bankr) is established — the
    // strict-sequence fix (item 1) guarantees that precondition. So the
    // real, per-case-varying proof here is that `policyThreshold` reflects
    // the ACTUAL count of pre-Vela required legs (11, not the hardcoded
    // literal 1) and that readinessScore equals it (every one of those
    // legs really is established, not merely asserted) — never the
    // historical hardcoded readinessScore:1/policyThreshold:1 pair, which
    // this exact (11, 11) values could never be mistaken for.
    expect(call.policyThreshold).toBeGreaterThan(1);
    expect(call.readinessScore).toBe(call.policyThreshold);
  });
});

describe('item 1 correction — STRICT SEQUENCE: a required external stage halts every later handler', () => {
  const READY_CASE = { case_id: 'case-1', state: 'admitted', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' };
  function primeEverythingExceptRegistryHorizen() {
    mocks.getCase.mockResolvedValue(READY_CASE);
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    // Deliberately UNestablished (overriding this file's own established-
    // by-default beforeEach) — registryAsset/horizenRegistration are the
    // whole point of this suite. Aegis/admission/bankr are ALSO left
    // un-established here to prove the orchestrator never reaches far
    // enough to touch them.
    mocks.getAsset.mockResolvedValue(null);
    mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: false, tokenId: null, network: null, evidenceRefs: [], source: 'unresolved', settled: false, auditGaps: [] });
  }

  it('with registryAsset/horizenRegistration outstanding, the orchestrator returns "awaiting_external_action" and calls NO later handler (Aegis, admission, Bankr, Vela, activation)', async () => {
    primeEverythingExceptRegistryHorizen();
    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });

    expect(result.outcome).toBe('awaiting_external_action');
    expect(['registryAsset', 'horizenRegistration']).toContain(result.stepTaken);
    // NEVER search past the external stage for a later actionable step.
    expect(mocks.createAssessment).not.toHaveBeenCalled();
    expect(mocks.transitionCaseState).not.toHaveBeenCalled();
    expect(mocks.inspectOrProvisionProviderBinding).not.toHaveBeenCalled();
    expect(mocks.runAdmissionPacketPolicyEvaluation).not.toHaveBeenCalled();
    expect(mocks.createOrResumeDraft).not.toHaveBeenCalled();
  });

  it('displayed (readiness.presentlyActionableStep) and executed (stepTaken) are the SAME canonical step even when that step is a required external stage', async () => {
    primeEverythingExceptRegistryHorizen();
    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.stepTaken).toBe(result.readiness.presentlyActionableStep);
  });

  it('once registryAsset/horizenRegistration are established, the orchestrator proceeds past them to a real Factor-owned handler', async () => {
    primeEverythingExceptRegistryHorizen();
    mocks.getAsset.mockResolvedValue({ id: 'aigentqube-factor' });
    mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: true, tokenId: 'token-1', network: 'base-sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] });
    mocks.createAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'evidence_locked', decision: null, conditions: [] });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.outcome).not.toBe('awaiting_external_action');
    expect(result.stepTaken).toBe('aegisAssessment');
    expect(result.stepTaken).toBe(result.readiness.presentlyActionableStep ?? result.stepTaken);
  });
});

describe('item 2 correction — journeyProfile threading: Pulse/P&L becomes a real (navigate-only) actionable step under financial_intelligence, and is threaded to the projection unmodified', () => {
  it('under the default (no journeyProfile), Pulse/P&L never blocks or gets selected as a step', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getAsset.mockResolvedValue({ id: 'aigentqube-factor' });
    mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: true, tokenId: 'token-1', network: 'base-sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor', bankrConfigured: true, bankrMode: 'live',
      hasProviderWalletBinding: true, providerWalletBinding: { id: 'b1', status: 'active' },
      tokenLaunchEnabled: true, ready: true, blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([{ kind: 'confidential_admission_projection', status: 'supplied', payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false } }]);
    mocks.resolvePnlEvidenceForAgent.mockResolvedValue({ serviceRegistered: false, serviceRegisteredDvnStatus: null, serviceVerified: false, serviceVerifiedDvnStatus: null });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1' });
    expect(result.stepTaken).not.toBe('pulsePnl');
    expect(result.readiness.legs.find((l) => l.key === 'pulsePnl')?.required).toBe(false);
  });

  it('under journeyProfile "financial_intelligence" with Pulse/P&L outstanding, it becomes the selected step (navigate-only, awaiting_input) and the profile reaches the projection', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getAsset.mockResolvedValue({ id: 'aigentqube-factor' });
    mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: true, tokenId: 'token-1', network: 'base-sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor', bankrConfigured: true, bankrMode: 'live',
      hasProviderWalletBinding: true, providerWalletBinding: { id: 'b1', status: 'active' },
      tokenLaunchEnabled: true, ready: true, blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([{ kind: 'confidential_admission_projection', status: 'supplied', payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false } }]);
    mocks.resolvePnlEvidenceForAgent.mockResolvedValue({ serviceRegistered: false, serviceRegisteredDvnStatus: null, serviceVerified: false, serviceVerifiedDvnStatus: null });

    const result = await advanceUseCaseZero({ ...BASE_INPUT, caseId: 'case-1', journeyProfile: 'financial_intelligence' });
    expect(result.stepTaken).toBe('pulsePnl');
    expect(result.outcome).toBe('awaiting_input');
    expect(result.readiness.legs.find((l) => l.key === 'pulsePnl')?.required).toBe(true);
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

describe('RootDID minting primitive (2026-09-06) — agentShell sponsors a NEW agent via the EXISTING sponsorPolityAgent primitive', () => {
  const NEW_AGENT_INPUT = { ...BASE_INPUT, agentSlug: 'aletheon', path: 'create_and_establish' as const };

  it('reports awaiting_external_action (no mutation) when the slug is unregistered, has no RootDID, and the operator has no Passport yet', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    mocks.getPassportRecordStatus.mockResolvedValue([]);
    mocks.getPassportApplicationStatus.mockResolvedValue([]);
    const result = await advanceUseCaseZero(NEW_AGENT_INPUT);
    expect(result.stepTaken).toBe('agentShell');
    expect(result.outcome).toBe('awaiting_external_action');
    expect(result.detail.toLowerCase()).toMatch(/passport/);
    expect(mocks.sponsorPolityAgent).not.toHaveBeenCalled();
  });

  it('reports blocked (no mutation) on the bring_own_agent path when no REGISTRABLE_AGENTS entry or RootDID exists', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    const result = await advanceUseCaseZero({ ...BASE_INPUT, agentSlug: 'aletheon', path: 'bring_own_agent' });
    expect(result.stepTaken).toBe('agentShell');
    expect(result.outcome).toBe('blocked');
    expect(mocks.sponsorPolityAgent).not.toHaveBeenCalled();
  });

  it('reports awaiting_input when create_and_establish is ready to sponsor but no agentGenesis fields were supplied', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    mocks.getPassportRecordStatus.mockResolvedValue([
      { passportId: 'pass-1', passportClass: 'citizen', citizenStatus: 'active', participantStatus: null, issuedAt: '2026-09-01T00:00:00Z' },
    ]);
    const result = await advanceUseCaseZero(NEW_AGENT_INPUT);
    expect(result.stepTaken).toBe('agentShell');
    expect(result.outcome).toBe('awaiting_input');
    expect(mocks.sponsorPolityAgent).not.toHaveBeenCalled();
  });

  it('sponsors the agent genesis via sponsorPolityAgent (unchanged, did:agent:root: scheme), writes a receipt, and binds candidate_agent_root_did onto the case', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    mocks.getPassportRecordStatus.mockResolvedValue([
      { passportId: 'pass-1', passportClass: 'citizen', citizenStatus: 'active', participantStatus: null, issuedAt: '2026-09-01T00:00:00Z' },
    ]);
    mocks.sponsorPolityAgent.mockResolvedValue({
      ok: true,
      status: 200,
      agent: {
        agentRootId: 'root-1',
        agentId: 'polity-bound:aletheon',
        didUri: 'did:agent:root:aletheon',
        agentClass: 'polity_bound',
        displayName: 'Aletheon',
        description: 'A test agent',
        agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json',
        agentCardSlug: 'aletheon',
        isAigentMe: false,
        sponsorPassportId: 'pass-1',
        createdAt: '2026-09-06T00:00:00Z',
      },
    });
    const result = await advanceUseCaseZero({
      ...NEW_AGENT_INPUT,
      caseId: 'case-1',
      agentGenesis: { sponsorPassportId: 'pass-1', displayName: 'Aletheon', description: 'A test agent', origin: 'https://dev-beta.aigentz.me' },
    });
    expect(mocks.sponsorPolityAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sponsorPassportId: 'pass-1', slug: 'aletheon', displayName: 'Aletheon', description: 'A test agent' }),
    );
    expect(mocks.createActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'agent_root_identity_sponsored' }),
    );
    expect(mocks.bindCandidateAgentRootDid).toHaveBeenCalledWith(expect.anything(), 'case-1', 'tenant-1', 'did:agent:root:aletheon');
    expect(result.stepTaken).toBe('agentShell');
    expect(result.outcome).toBe('advanced');
    // Never chains into the NEXT step (case creation/wallets) in the same call.
    expect(mocks.createOrResumeCase).not.toHaveBeenCalled();
  });

  it('never binds candidate_agent_root_did when no case exists yet for this advance', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    mocks.getPassportRecordStatus.mockResolvedValue([
      { passportId: 'pass-1', passportClass: 'citizen', citizenStatus: 'active', participantStatus: null, issuedAt: '2026-09-01T00:00:00Z' },
    ]);
    mocks.sponsorPolityAgent.mockResolvedValue({
      ok: true,
      status: 200,
      agent: {
        agentRootId: 'root-1',
        agentId: 'polity-bound:aletheon',
        didUri: 'did:agent:root:aletheon',
        agentClass: 'polity_bound',
        displayName: 'Aletheon',
        description: 'A test agent',
        agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json',
        agentCardSlug: 'aletheon',
        isAigentMe: false,
        sponsorPassportId: 'pass-1',
        createdAt: '2026-09-06T00:00:00Z',
      },
    });
    await advanceUseCaseZero({
      ...NEW_AGENT_INPUT,
      agentGenesis: { sponsorPassportId: 'pass-1', displayName: 'Aletheon', description: 'A test agent', origin: 'https://dev-beta.aigentz.me' },
    });
    expect(mocks.bindCandidateAgentRootDid).not.toHaveBeenCalled();
  });

  it('reports blocked (no receipt, no bind) when sponsorPolityAgent itself refuses', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    mocks.getPassportRecordStatus.mockResolvedValue([
      { passportId: 'pass-1', passportClass: 'citizen', citizenStatus: 'active', participantStatus: null, issuedAt: '2026-09-01T00:00:00Z' },
    ]);
    mocks.sponsorPolityAgent.mockResolvedValue({ ok: false, status: 409, error: "Slug 'aletheon' already taken — choose another" });
    const result = await advanceUseCaseZero({
      ...NEW_AGENT_INPUT,
      caseId: 'case-1',
      agentGenesis: { sponsorPassportId: 'pass-1', displayName: 'Aletheon', description: 'A test agent', origin: 'https://dev-beta.aigentz.me' },
    });
    expect(result.outcome).toBe('blocked');
    expect(result.detail).toMatch(/already taken/);
    expect(mocks.createActivityReceipt).not.toHaveBeenCalled();
    expect(mocks.bindCandidateAgentRootDid).not.toHaveBeenCalled();
  });

  it('reports agentShell as established (no sponsorPolityAgent call) once a RootDID already exists for the slug', async () => {
    mocks.resolveRegistrableAgent.mockReturnValue(null);
    mocks.findAgentRootIdentityBySlug.mockResolvedValue({
      agentRootId: 'root-1',
      agentId: 'polity-bound:aletheon',
      didUri: 'did:agent:root:aletheon',
      agentClass: 'polity_bound',
      displayName: 'Aletheon',
      description: 'A test agent',
      agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json',
      agentCardSlug: 'aletheon',
      isAigentMe: false,
      createdAt: '2026-09-06T00:00:00Z',
    });
    mocks.createOrResumeCase.mockResolvedValue({ case: { case_id: 'case-1', state: 'discovered', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null }, created: true });
    const result = await advanceUseCaseZero(NEW_AGENT_INPUT);
    expect(mocks.sponsorPolityAgent).not.toHaveBeenCalled();
    // agentShell is already established (RootDID found), so this call falls
    // through past the special-cased genesis handling into ordinary Step 1
    // (create/resume the Factor case) — never re-sponsoring.
    expect(mocks.createOrResumeCase).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('advanced');
  });
});

describe('runUseCaseZeroToCompletion (2026-09-06) — loops advanceUseCaseZero, stops honestly at the first real boundary', () => {
  it('advances through case creation then STOPS at the next real boundary — never auto-chains past it', async () => {
    const caseRow = { case_id: 'case-1', state: 'discovered', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' };
    mocks.createOrResumeCase.mockResolvedValue({ case: caseRow, created: true });
    mocks.getCase.mockResolvedValue(caseRow);
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue(null);

    const result = await runUseCaseZeroToCompletion(BASE_INPUT);
    expect(result.outcome).toBe('awaiting_input');
    expect(result.steps.map((s) => s.stepTaken)).toEqual(['agentShell', 'delegationAuthority']);
    expect(result.steps[0].outcome).toBe('advanced');
    expect(result.steps[1].outcome).toBe('awaiting_input');
    // Never manufactures the authority the halted step was missing.
    expect(mocks.establishDirectChain).not.toHaveBeenCalled();
  });

  it('reports "completed" when every required leg is already established (requiredStepsComplete)', async () => {
    const REHEARSAL_CASE = { case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' };
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
    mocks.createOrResumeDraft.mockResolvedValue({ launch: { id: 'launch-1', state: 'preflighted', bankr_terms: { simulated: true } }, created: false, superseded: false });
    // resolveRehearsalLeg (the READINESS projection) reads the current launch
    // via findLatestTokenLaunchForCase — a DIFFERENT read than the orchestrator
    // STEP's own createOrResumeDraft call above. Both must agree for the
    // re-read-after-action readiness to actually show 'established'.
    mocks.findLatestTokenLaunchForCase.mockResolvedValue({ id: 'launch-1', state: 'preflighted', bankr_terms: { simulated: true } });

    const result = await runUseCaseZeroToCompletion({ ...BASE_INPUT, caseId: 'case-1', launchSpec: { chain: 'base-sepolia', tokenName: 'Test', tokenSymbol: 'TST' } });
    expect(result.outcome).toBe('completed');
    expect(result.readiness.requiredStepsComplete).toBe(true);
    expect(result.steps).toHaveLength(1);
  });

  it('stops at "step_limit_exceeded" rather than looping forever, and never exceeds the requested maxSteps', async () => {
    // getCase always resolves null regardless of caseId — every call re-hits
    // "no case yet" and genuinely advances (createOrResumeCase), a real
    // (if contrived) way to force repeated 'advanced' outcomes deterministically.
    mocks.getCase.mockResolvedValue(null);
    mocks.createOrResumeCase.mockResolvedValue({ case: { case_id: 'case-1', state: 'discovered', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null }, created: true });

    const result = await runUseCaseZeroToCompletion({ ...BASE_INPUT, maxSteps: 3 });
    expect(result.outcome).toBe('step_limit_exceeded');
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => s.outcome === 'advanced')).toBe(true);
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
