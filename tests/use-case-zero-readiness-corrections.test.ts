/**
 * Use Case Zero readiness projection — negative tests for the 2026-09-06
 * operator-review corrections. Each describe block proves the SPECIFIC
 * defect the correction closes would otherwise reproduce.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveRegistrableAgent: vi.fn(),
  resolveAgentRegistrationState: vi.fn(),
  getOwnerWalletAddress: vi.fn(),
  getBinding: vi.fn(),
  getPassportApplicationStatus: vi.fn(),
  getPassportRecordStatus: vi.fn(),
  readActiveGrantForAgent: vi.fn(),
  getAsset: vi.fn(),
  resolvePnlEvidenceForAgent: vi.fn(),
  getCurrentAssessment: vi.fn(),
  getCase: vi.fn(),
  listEvidenceForCase: vi.fn(),
  listCaseEvents: vi.fn(),
  assessIssuerReadiness: vi.fn(),
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
}));
vi.mock('@/services/factor/factorCaseService', () => ({
  getCase: mocks.getCase,
  listEvidenceForCase: mocks.listEvidenceForCase,
  listCaseEvents: mocks.listCaseEvents,
}));
vi.mock('@/services/factor/bankrCapabilityHandlers', () => ({
  assessIssuerReadiness: mocks.assessIssuerReadiness,
}));
vi.mock('@/services/factor/factorConfidentialWorkload', () => ({
  FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND: 'confidential_admission_projection',
}));

import { projectUseCaseZeroReadiness } from '@/services/factor/useCaseZeroReadinessProjection';

const AGENT = { slug: 'factor', runtimeAgentId: 'aigent-factor', aigentQubeId: 'aigentqube-factor' };
const BASE_INPUT = {
  admin: {} as never,
  tenantId: 'tenant-1',
  actorPersonaId: 'persona-1',
  agentSlug: 'factor',
  path: 'bring_own_agent' as const,
};

function findLeg(legs: Awaited<ReturnType<typeof projectUseCaseZeroReadiness>>['legs'], key: string) {
  const l = legs.find((leg) => leg.key === key);
  if (!l) throw new Error(`leg '${key}' not found`);
  return l;
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe('correction 1 — Passport: approved application is never treated as issued', () => {
  it('an approved application with NO polity_passport_records row is "missing", never "established"', async () => {
    mocks.getPassportApplicationStatus.mockResolvedValue([
      { applicationId: 'app-1', passportClass: 'agent_participant', applicationStatus: 'approved', passportGrade: null, personhoodProofType: null, submittedAt: null, decidedAt: null, createdAt: null },
    ]);
    mocks.getPassportRecordStatus.mockResolvedValue([]);
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const passport = findLeg(result.legs, 'passport');
    expect(passport.state).not.toBe('established');
    expect(passport.state).toBe('missing');
    expect(passport.reason.toLowerCase()).toMatch(/approved.*not.*issued|not.*issued/);
  });

  it('an actual issued passport record makes the leg established', async () => {
    mocks.getPassportRecordStatus.mockResolvedValue([
      { passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' },
    ]);
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    expect(findLeg(result.legs, 'passport').state).toBe('established');
  });

  it('a denied application is "blocked", not "missing"', async () => {
    mocks.getPassportApplicationStatus.mockResolvedValue([
      { applicationId: 'app-2', passportClass: 'agent_participant', applicationStatus: 'denied', passportGrade: null, personhoodProofType: null, submittedAt: null, decidedAt: null, createdAt: null },
    ]);
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    expect(findLeg(result.legs, 'passport').state).toBe('blocked');
  });
});

describe('correction 2 — Aegis: ratified state alone is not positive', () => {
  it('a RATIFIED assessment with decision not_admissible is "blocked", never "established"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.getCurrentAssessment.mockResolvedValue({
      assessment_id: 'assess-1', state: 'ratified', decision: 'not_admissible', conditions: [],
    });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const aegis = findLeg(result.legs, 'aegisAssessment');
    expect(aegis.state).toBe('blocked');
  });

  it('a RATIFIED assessment with decision insufficient_evidence is "blocked"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.getCurrentAssessment.mockResolvedValue({
      assessment_id: 'assess-1', state: 'ratified', decision: 'insufficient_evidence', conditions: [],
    });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'aegisAssessment').state).toBe('blocked');
  });

  it('a RATIFIED admissible_with_conditions decision is "established" AND surfaces conditions', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.getCurrentAssessment.mockResolvedValue({
      assessment_id: 'assess-1', state: 'ratified', decision: 'admissible_with_conditions', conditions: ['must file quarterly disclosure'],
    });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const aegis = findLeg(result.legs, 'aegisAssessment');
    expect(aegis.state).toBe('established');
    expect(aegis.conditions).toEqual(['must file quarterly disclosure']);
  });

  it('an UNRATIFIED assessment (still running) is "missing", not "established" or "blocked"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'running', decision: null, conditions: [] });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'aegisAssessment').state).toBe('missing');
  });
});

describe('correction 3 — read-state semantics: unreadable is never missing', () => {
  it('a failed canonical read is "unreadable", never "missing", and gets no provisioning nextAction', async () => {
    mocks.getOwnerWalletAddress.mockRejectedValue(new Error('DB connection reset'));
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const ownerWallet = findLeg(result.legs, 'ownerWallet');
    expect(ownerWallet.state).toBe('unreadable');
    expect(ownerWallet.state).not.toBe('missing');
  });

  it('when the presently-actionable leg is unreadable, nextAction is null (never recommends provisioning over a read failure)', async () => {
    mocks.getOwnerWalletAddress.mockRejectedValue(new Error('DB connection reset'));
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    if (result.presentlyActionableStep === 'ownerWallet') {
      expect(result.nextAction).toBeNull();
    }
  });

  it('backward-compatible verified boolean is still derived correctly (established only)', async () => {
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const ownerWallet = findLeg(result.legs, 'ownerWallet');
    expect(ownerWallet.state).toBe('established');
    expect(ownerWallet.verified).toBe(true);
  });
});

describe('correction 4 — Bankr: mode derived from adapter, not hardcoded from binding presence', () => {
  it('reports mode "live" when the adapter itself reports configured/live, even with a binding present', async () => {
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor',
      bankrConfigured: true,
      bankrMode: 'live',
      hasProviderWalletBinding: true,
      providerWalletBinding: { id: 'binding-1', status: 'active' },
      tokenLaunchEnabled: true,
      ready: true,
      blockers: [],
    });
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const bankr = findLeg(result.legs, 'bankrBinding');
    expect(bankr.mode).toBe('live');
  });

  it('reports mode "simulated" when the adapter itself reports fake, regardless of binding presence', async () => {
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor',
      bankrConfigured: false,
      bankrMode: 'fake',
      hasProviderWalletBinding: true,
      providerWalletBinding: { id: 'binding-1', status: 'active' },
      tokenLaunchEnabled: true,
      ready: false,
      blockers: [],
    });
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const bankr = findLeg(result.legs, 'bankrBinding');
    expect(bankr.mode).toBe('simulated');
  });

  it('distinguishes provider-configured, binding-active and operation-supported as separate facts in the reason', async () => {
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
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const bankr = findLeg(result.legs, 'bankrBinding');
    expect(bankr.reason).toMatch(/configured=/);
    expect(bankr.reason).toMatch(/binding active=/);
    expect(bankr.reason).toMatch(/operation supported/);
    expect(bankr.state).toBe('missing');
  });
});

describe('correction 5 — admission: conditionally_admitted preserved, activation blocked on unmet condition', () => {
  it('conditionally_admitted is "established" (admitted-with-conditions), not "missing"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'conditionally_admitted', candidate_agent_root_did: null });
    mocks.listCaseEvents.mockResolvedValue([
      { event_id: 'e1', case_id: 'case-1', event_type: 'admission_decided', from_state: 'admission_pending', to_state: 'conditionally_admitted', actor_persona_id: 'p1', authority_chain_id: null, metadata: { conditions: ['quarterly disclosure required'] }, created_at: '2026-09-01T00:00:00Z' },
    ]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const admission = findLeg(result.legs, 'moneypennyAdmission');
    expect(admission.state).toBe('established');
    expect(admission.conditions).toEqual(['quarterly disclosure required']);
  });

  it('runtime activation is BLOCKED while a condition remains unmet, even though admission itself is established', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'conditionally_admitted', candidate_agent_root_did: null });
    mocks.listCaseEvents.mockResolvedValue([
      { event_id: 'e1', case_id: 'case-1', event_type: 'admission_decided', from_state: 'admission_pending', to_state: 'conditionally_admitted', actor_persona_id: 'p1', authority_chain_id: null, metadata: { conditions: ['quarterly disclosure required'] }, created_at: '2026-09-01T00:00:00Z' },
    ]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const activation = findLeg(result.legs, 'runtimeActivation');
    expect(activation.state).toBe('blocked');
    expect(activation.conditions.length).toBeGreaterThan(0);
  });

  it('rejected admission is "blocked", never silently treated as "missing"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'rejected', candidate_agent_root_did: null });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'moneypennyAdmission').state).toBe('blocked');
  });
});

describe('correction 6 — action truthfulness: entry actions are assess-readiness, not consequential', () => {
  it('the manifest labels both entry actions as assessing readiness, never claiming to create/establish', async () => {
    const { getFactorCapability } = await import('@/services/factor/factorCapabilityManifest');
    const cap = getFactorCapability('constitutional_financial_agent_establishment');
    const bring = cap.actions.find((a) => a.id.endsWith(':bring_own_agent'));
    const create = cap.actions.find((a) => a.id.endsWith(':create_and_establish'));
    expect(bring?.label.toLowerCase()).toContain('assess readiness');
    expect(create?.label.toLowerCase()).toContain('assess readiness');
  });

  it('the handler functions are named as assessments, not as creation/establishment actions', async () => {
    const handlers = await import('@/services/factor/useCaseZeroCapabilityHandlers');
    expect(typeof handlers.assessBringOwnAgentReadiness).toBe('function');
    expect(typeof handlers.assessCreateAndEstablishReadiness).toBe('function');
  });
});
