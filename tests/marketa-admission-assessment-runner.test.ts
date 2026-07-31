/**
 * services/marketa/admissionAssessmentRunner.ts — GJR-MKT-001 Phase 4. The
 * evidence-assemble -> rule-engine -> persist -> receipt orchestrator,
 * exercised with every real dependency mocked (no live evidence assembly,
 * no live DB, no live receipts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAssembleEvidence = vi.fn();
vi.mock('@/services/marketa/externalAgentAdmissionEvidence', () => ({
  assembleExternalAgentAdmissionEvidence: (...args: any[]) => mockAssembleEvidence(...args),
}));

const mockGetCurrent = vi.fn();
const mockCreateAssessment = vi.fn();
vi.mock('@/services/marketa/admissionAssessmentStore', () => ({
  getCurrentMarketaAdmissionAssessment: (...args: any[]) => mockGetCurrent(...args),
  createMarketaAdmissionAssessment: (...args: any[]) => mockCreateAssessment(...args),
}));

const createActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

import { runMarketaAdmissionAssessment } from '@/services/marketa/admissionAssessmentRunner';

const CLEAN_EVIDENCE = {
  ok: true,
  evidenceSnapshotHash: 'a'.repeat(64),
  evidence: {
    aigentQube: { exists: true, id: 'aigentqube-moneypenny' },
    agentCard: { resolves: true, schemaValid: true, provenanceValid: true },
    externalRegistry: { resolves: true, network: 'base-sepolia', tokenId: '1234', ownerWallet: '0xOwner' },
    control: { proven: true, fresh: true, signerWallet: '0xOwner' },
    transparency: { pulseSupported: true, pulseEnabled: true, pnlDisclosureAuthorized: true, evidenceRefs: [] },
    authorityFitness: { sponsorEligible: null, delegationBoundable: true, delegationRevocable: true, onwardDelegationProhibited: true, expirySupported: true },
    risk: { contradictions: [], unresolvedClaims: [], quarantineSignals: [] },
  },
};

beforeEach(() => {
  mockAssembleEvidence.mockReset();
  mockGetCurrent.mockReset();
  mockCreateAssessment.mockReset();
  createActivityReceipt.mockClear();
  mockGetCurrent.mockResolvedValue(null);
  mockCreateAssessment.mockImplementation(async (input: any) => ({ assessmentId: input.assessmentId, ...input.assessment }));
});

describe('runMarketaAdmissionAssessment', () => {
  it('propagates AIGENTQUBE_NOT_FOUND from the evidence assembler without touching the engine or store', async () => {
    mockAssembleEvidence.mockResolvedValue({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND', detail: 'no row' });
    const result = await runMarketaAdmissionAssessment({ aigentQubeId: 'x', actorPersonaId: 'p1', agentCardUrl: 'https://x/card.json', mode: 'FINAL' });
    expect(result).toMatchObject({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND' });
    expect(mockCreateAssessment).not.toHaveBeenCalled();
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('FINAL + clean evidence writes assessed + recommended receipts, and a new current assessment', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    const result = await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL' });
    expect(result.ok).toBe(true);

    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed', 'marketa_eligibility_recommended']);

    expect(mockCreateAssessment).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateAssessment.mock.calls[0][0];
    expect(createArgs.subjectAigentQubeId).toBe('aigentqube-moneypenny');
    expect(createArgs.supersedesAssessmentId).toBeNull();
    expect(createArgs.assessment.decision).toBe('RECOMMENDED');
  });

  it('writes only the assessed receipt for a NOT_RECOMMENDED decision — no recommended/refused/quarantined', async () => {
    mockAssembleEvidence.mockResolvedValue({
      ...CLEAN_EVIDENCE,
      evidence: { ...CLEAN_EVIDENCE.evidence, agentCard: { resolves: false, schemaValid: false, provenanceValid: false } },
    });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed']);
  });

  it('writes assessed + refused receipts for a REFUSED decision (no fresh control proof)', async () => {
    mockAssembleEvidence.mockResolvedValue({
      ...CLEAN_EVIDENCE,
      evidence: { ...CLEAN_EVIDENCE.evidence, control: { proven: false, fresh: false } },
    });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed', 'marketa_eligibility_refused']);
  });

  it('writes assessed + quarantined receipts when a quarantine signal is present', async () => {
    mockAssembleEvidence.mockResolvedValue({
      ...CLEAN_EVIDENCE,
      evidence: { ...CLEAN_EVIDENCE.evidence, risk: { contradictions: [], unresolvedClaims: [], quarantineSignals: ['control-proof-signer-does-not-match-registry-owner'] } },
    });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed', 'marketa_eligibility_quarantined']);
  });

  it('DRAFT mode never writes a recommended receipt, even framed against otherwise-clean evidence', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'DRAFT' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).not.toContain('marketa_eligibility_recommended');
  });

  it('threads the prior current assessment through as supersedesAssessmentId on reassessment', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    mockGetCurrent.mockResolvedValue({ assessmentId: 'prior-assessment-id' });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL' });
    expect(mockCreateAssessment.mock.calls[0][0].supersedesAssessmentId).toBe('prior-assessment-id');
  });
});
