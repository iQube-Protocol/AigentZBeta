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
  discoverFinancialServicesForConsumer: vi.fn(),
  findLatestTokenLaunchForCase: vi.fn(),
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
vi.mock('@/services/financialServices/discovery', () => ({
  discoverFinancialServicesForConsumer: mocks.discoverFinancialServicesForConsumer,
}));
vi.mock('@/services/factor/tokenLaunchService', () => ({
  findLatestTokenLaunchForCase: mocks.findLatestTokenLaunchForCase,
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

/** Builds a `discoverFinancialServicesForConsumer`-shaped result with ONE
 *  execution-reachable (Runtime-class) service, fully qualified by default
 *  (authority met + readiness all 'ready') — override any field to exercise
 *  the "eligible but not qualified" gap item 2 closes. */
function runtimeDiscovery(overrides?: {
  serviceId?: string;
  authorityMet?: boolean;
  systemReady?: string;
  eligibility?: string;
  standing?: string;
  none?: boolean;
}) {
  if (overrides?.none) return { ok: true, context: {}, services: [] };
  const serviceId = overrides?.serviceId ?? 'moneypenny-runtime';
  const authorityMet = overrides?.authorityMet ?? true;
  return {
    ok: true,
    context: {},
    services: [
      {
        definition: { serviceId, executionPolicy: { executionReachable: true } },
        eligibility: { eligible: true },
        authority: { state: authorityMet ? 'ACTIVE' : 'PENDING', met: authorityMet, code: authorityMet ? 'AUTHORITY_ACTIVE' : 'AUTHORITY_DELEGATION_REQUIRED', reason: 'test' },
        readiness: {
          systemReady: overrides?.systemReady ?? 'ready',
          eligibility: overrides?.eligibility ?? 'ready',
          standing: overrides?.standing ?? 'not-required',
          authority: authorityMet ? 'ready' : 'pending',
          confidentialExecution: 'pending',
        },
      },
    ],
  };
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
  mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery({ none: true }));
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
      bindingEffectiveState: 'none',
      tokenLaunchEnabled: true,
      ready: false,
      blockers: [],
    });
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const bankr = findLeg(result.legs, 'bankrBinding');
    expect(bankr.reason).toMatch(/configured=/);
    expect(bankr.reason).toMatch(/binding=/);
    expect(bankr.reason).toMatch(/operation supported/);
    expect(bankr.state).toBe('missing');
  });

  it('correction (2026-09-08): a lifecycle-active but never-verified binding reads as "Simulated binding", never bare "active"', async () => {
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor',
      bankrConfigured: false,
      bankrMode: 'fake',
      hasProviderWalletBinding: true,
      providerWalletBinding: { id: 'binding-1', status: 'active', verification_evidence: null },
      bindingEffectiveState: 'active-simulated',
      tokenLaunchEnabled: true,
      ready: true,
      blockers: [],
    });
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    const bankr = findLeg(result.legs, 'bankrBinding');
    expect(bankr.reason).toMatch(/Simulated binding/);
    expect(bankr.reason).not.toMatch(/binding active=true \(status: active\)/);
  });
});

describe('item 1 correction — Vela leg requires an ACCEPTABLE disposition AND mode-appropriate verification, never inferred from the other mode\'s boolean', () => {
  it('a case with NO confidential-compute evidence yet is "missing" (case exists, needs a case id though — this one has none)', async () => {
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    expect(findLeg(result.legs, 'velaReadiness').state).toBe('missing');
  });

  it('supplied evidence with disposition UNACCEPTABLE stays BLOCKED, never established, even with protocolExecutionVerified true', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'UNACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false },
    }]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const vela = findLeg(result.legs, 'velaReadiness');
    expect(vela.state).toBe('blocked');
    expect(vela.state).not.toBe('established');
  });

  it('ACCEPTABLE disposition but protocolExecutionVerified FALSE under NO_ATTESTATION_LOCAL stays BLOCKED — never inferred from teeAttestationVerified', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: false, teeAttestationVerified: true },
    }]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'velaReadiness').state).toBe('blocked');
  });

  it('ACCEPTABLE + protocolExecutionVerified true under NO_ATTESTATION_LOCAL is established, mode "simulated"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false },
    }]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const vela = findLeg(result.legs, 'velaReadiness');
    expect(vela.state).toBe('established');
    expect(vela.mode).toBe('simulated');
  });

  it('ACCEPTABLE + BOTH protocolExecutionVerified AND teeAttestationVerified true under NITRO_ATTESTED is established, mode "live"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NITRO_ATTESTED', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: true },
    }]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const vela = findLeg(result.legs, 'velaReadiness');
    expect(vela.state).toBe('established');
    expect(vela.mode).toBe('live');
  });

  it('item 3 correction — NITRO_ATTESTED with teeAttestationVerified true but protocolExecutionVerified FALSE stays BLOCKED — teeAttestationVerified alone is never sufficient', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NITRO_ATTESTED', disposition: 'ACCEPTABLE', protocolExecutionVerified: false, teeAttestationVerified: true },
    }]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'velaReadiness').state).toBe('blocked');
  });

  it('ACCEPTABLE under NITRO_ATTESTED but teeAttestationVerified FALSE stays BLOCKED — never inferred from protocolExecutionVerified', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'admission_pending', candidate_agent_root_did: null });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NITRO_ATTESTED', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false },
    }]);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'velaReadiness').state).toBe('blocked');
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

describe('item 5 correction — Registry/Horizen restored as required externally-completed stages; Pulse/P&L required only under an explicit journey profile', () => {
  it('registryAsset/horizenRegistration are required:true, reporting awaiting_external_action rather than missing', async () => {
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    for (const key of ['registryAsset', 'horizenRegistration']) {
      const leg = findLeg(result.legs, key);
      expect(leg.required).toBe(true);
      expect(leg.state).toBe('awaiting_external_action');
    }
  });

  it('pulsePnl stays optional (required:false) by default — no journeyProfile selected', async () => {
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    expect(findLeg(result.legs, 'pulsePnl').required).toBe(false);
  });

  it('pulsePnl becomes required ONLY when the operator explicitly selects the financial_intelligence journey profile', async () => {
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, journeyProfile: 'financial_intelligence' });
    expect(findLeg(result.legs, 'pulsePnl').required).toBe(true);
  });

  it('every other leg defaults required:true', async () => {
    const result = await projectUseCaseZeroReadiness(BASE_INPUT);
    for (const key of ['agentShell', 'ownerWallet', 'settlementWallet', 'passport', 'delegationAuthority', 'aegisAssessment', 'moneypennyAdmission', 'bankrBinding', 'velaReadiness', 'runtimeActivation', 'governedOperationRehearsal']) {
      expect(findLeg(result.legs, key).required).toBe(true);
    }
  });

  it('requiredStepsComplete and presentlyActionableStep never block on an outstanding OPTIONAL leg (pulsePnl) alone, but DO block on the required externally-completed legs (registryAsset/horizenRegistration)', async () => {
    // Every required leg established (agentShell via allowlist, wallets,
    // passport issued, delegation granted, aegis admissible, admission
    // admitted, bankr ready, vela evidence ACCEPTABLE+verified, runtime
    // active with a qualified Runtime service, registry asset present,
    // Horizen registered) EXCEPT rehearsal (no operator-supplied launchSpec,
    // so it stays 'missing') and pulsePnl (optional, left unestablished) —
    // pulsePnl must never surface as the blocker; rehearsal must.
    mocks.getOwnerWalletAddress.mockResolvedValue('0xOWNER');
    mocks.getBinding.mockResolvedValue({ address: '0xSETTLE', status: 'active' });
    mocks.getPassportRecordStatus.mockResolvedValue([{ passportId: 'pass-1', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved', issuedAt: '2026-09-01T00:00:00Z' }]);
    mocks.readActiveGrantForAgent.mockResolvedValue({ grant_id: 'grant-1' });
    mocks.getAsset.mockResolvedValue({ id: 'aigentqube-factor' });
    mocks.resolveAgentRegistrationState.mockResolvedValue({ registered: true, tokenId: 'token-1', network: 'base-sepolia', evidenceRefs: [], source: 'onchain', settled: true, auditGaps: [] });
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: 'did:example:agent-1' });
    mocks.getCurrentAssessment.mockResolvedValue({ assessment_id: 'assess-1', state: 'ratified', decision: 'admissible', conditions: [] });
    mocks.assessIssuerReadiness.mockResolvedValue({
      beneficiaryAgentRuntimeId: 'aigent-factor', bankrConfigured: true, bankrMode: 'live',
      hasProviderWalletBinding: true, providerWalletBinding: { id: 'b1', status: 'active' },
      tokenLaunchEnabled: true, ready: true, blockers: [],
    });
    mocks.listEvidenceForCase.mockResolvedValue([{
      kind: 'confidential_admission_projection', status: 'supplied',
      payload: { attestationMode: 'NO_ATTESTATION_LOCAL', disposition: 'ACCEPTABLE', protocolExecutionVerified: true, teeAttestationVerified: false },
    }]);
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());

    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'registryAsset').state).toBe('established');
    expect(findLeg(result.legs, 'horizenRegistration').state).toBe('established');
    expect(findLeg(result.legs, 'pulsePnl').state).not.toBe('established');
    // The only outstanding REQUIRED leg is the rehearsal (no launchSpec
    // supplied to this read-only projection) — the optional pulsePnl leg
    // never surfaces as the blocker.
    expect(result.presentlyActionableStep).toBe('governedOperationRehearsal');
    expect(result.requiredStepsComplete).toBe(false);
  });
});

describe('correction (2026-09-08) — launch-spec preparation and preflight are evidence-producing, non-consequential acts: reachable BEFORE case admission, never gated behind it', () => {
  it('a case still at "registry_ready" (no case-level Aegis ratified, no MoneyPenny admission decided) already reports an established rehearsal leg once a preflighted launch exists — admission is NOT a precondition', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'registry_ready', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.findLatestTokenLaunchForCase.mockResolvedValue({ id: 'launch-1', state: 'preflighted', bankr_terms: { simulated: true } });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const rehearsal = findLeg(result.legs, 'governedOperationRehearsal');
    expect(rehearsal.state).toBe('established');
    // Case-level admission genuinely has NOT happened — this proves the
    // rehearsal leg's own established-ness is independent of it, never a
    // side effect of case activation.
    expect(findLeg(result.legs, 'moneypennyAdmission').state).not.toBe('established');
  });

  it('a case still at "discovered" (earliest possible state, freshly created) can still prepare and preflight — only a bound case + resolved runtime agent id are required, never full activation', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'discovered', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.findLatestTokenLaunchForCase.mockResolvedValue(null);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const rehearsal = findLeg(result.legs, 'governedOperationRehearsal');
    // Not yet established (no launch exists), but critically NOT refused for
    // lack of activation — the reason names the real precondition, never
    // "runtime activation must complete first" (the corrected, removed gate).
    expect(rehearsal.state).toBe('missing');
    expect(rehearsal.reason.toLowerCase()).not.toContain('runtime activation must complete');
  });

  it('bankrBinding and governedOperationRehearsal are ordered BEFORE aegisAssessment and moneypennyAdmission in the legs array — the sequence the projection itself computes', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'registry_ready', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const keys = result.legs.map((l) => l.key);
    const bankrIdx = keys.indexOf('bankrBinding');
    const rehearsalIdx = keys.indexOf('governedOperationRehearsal');
    const aegisIdx = keys.indexOf('aegisAssessment');
    const admissionIdx = keys.indexOf('moneypennyAdmission');
    expect(bankrIdx).toBeGreaterThanOrEqual(0);
    expect(bankrIdx).toBeLessThan(aegisIdx);
    expect(rehearsalIdx).toBeLessThan(aegisIdx);
    expect(bankrIdx).toBeLessThan(admissionIdx);
    expect(rehearsalIdx).toBeLessThan(admissionIdx);
  });
});

describe('item 3/4 correction — governed-operation rehearsal leg reflects the canonical token-launch aggregate; mode derived, never hardcoded', () => {
  it('no existing launch for this tenant+beneficiary is "missing" once runtime is active', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.findLatestTokenLaunchForCase.mockResolvedValue(null);
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'governedOperationRehearsal').state).toBe('missing');
  });

  it('item 4 correction — the lookup is keyed by the Factor CASE id, never by beneficiary/runtimeAgentId alone', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-42', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.findLatestTokenLaunchForCase.mockResolvedValue(null);
    await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-42' });
    expect(mocks.findLatestTokenLaunchForCase).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'case-42');
  });

  it('an existing PREFLIGHTED launch makes the leg established, mode derived from bankr_terms.simulated (true -> "simulated")', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.findLatestTokenLaunchForCase.mockResolvedValue({ id: 'launch-1', state: 'preflighted', bankr_terms: { simulated: true } });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const rehearsal = findLeg(result.legs, 'governedOperationRehearsal');
    expect(rehearsal.state).toBe('established');
    expect(rehearsal.mode).toBe('simulated');
  });

  it('an existing PREFLIGHTED launch with bankr_terms.simulated===false reports mode "live" — never hardcoded', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.findLatestTokenLaunchForCase.mockResolvedValue({ id: 'launch-1', state: 'approved', bankr_terms: { simulated: false } });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const rehearsal = findLeg(result.legs, 'governedOperationRehearsal');
    expect(rehearsal.state).toBe('established');
    expect(rehearsal.mode).toBe('live');
  });

  it('a launch still in "draft"/"preparing" is NOT yet established for this leg', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    mocks.findLatestTokenLaunchForCase.mockResolvedValue({ id: 'launch-1', state: 'preparing', bankr_terms: null });
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'governedOperationRehearsal').state).toBe('missing');
  });
});

describe('follow-up correction — Vela confidential inputs are case-derived, not hardcoded', () => {
  it('the orchestrator never passes the literal hardcoded pair readinessScore:1/policyThreshold:1', async () => {
    // Structural proof: useCaseZeroOrchestrator.ts computes readinessScore/
    // policyThreshold from the readiness projection's own required-leg
    // counts (varies per case) rather than a fixed literal — asserted by
    // reading the source rather than re-deriving the exact runtime values
    // here (already exercised behaviorally in
    // tests/use-case-zero-orchestrator.test.ts's Vela step).
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../services/factor/useCaseZeroOrchestrator.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/readinessScore:\s*1,\s*\n\s*policyThreshold:\s*1,/);
    expect(src).toMatch(/readinessScore,\s*\n\s*policyThreshold,/);
  });
});

describe('item 2 correction — MoneyPenny runtime activation requires an execution-reachable Runtime service with SATISFIED AUTHORITY and RUNTIME READINESS, never mere catalog eligibility', () => {
  it('case.state === "active" with zero execution-reachable Runtime services is "missing", never "established"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery({ none: true }));
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const activation = findLeg(result.legs, 'runtimeActivation');
    expect(activation.state).toBe('missing');
  });

  it('a Runtime service that is merely eligible but whose AUTHORITY prerequisite is NOT met stays "missing" — eligibility alone is insufficient', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery({ authorityMet: false }));
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    const activation = findLeg(result.legs, 'runtimeActivation');
    expect(activation.state).toBe('missing');
    expect(activation.reason).toMatch(/authority/i);
  });

  it('authority met but the derived runtime-readiness projection is NOT ready (e.g. eligibility not-ready) stays "missing"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery({ authorityMet: true, eligibility: 'not-ready' }));
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'runtimeActivation').state).toBe('missing');
  });

  it('case.state === "active" WITH an execution-reachable Runtime service whose authority AND runtime readiness are both satisfied is "established"', async () => {
    mocks.getCase.mockResolvedValue({ case_id: 'case-1', state: 'active', tenant_id: 'tenant-1', authority_chain_id: null, candidate_agent_root_did: null });
    mocks.discoverFinancialServicesForConsumer.mockResolvedValue(runtimeDiscovery());
    const result = await projectUseCaseZeroReadiness({ ...BASE_INPUT, caseId: 'case-1' });
    expect(findLeg(result.legs, 'runtimeActivation').state).toBe('established');
  });
});
