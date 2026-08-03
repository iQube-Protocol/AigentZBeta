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
const mockCheckStoreAvailable = vi.fn();
vi.mock('@/services/marketa/admissionAssessmentStore', () => ({
  getCurrentMarketaAdmissionAssessment: (...args: any[]) => mockGetCurrent(...args),
  createMarketaAdmissionAssessment: (...args: any[]) => mockCreateAssessment(...args),
  // The store is probed for availability BEFORE any work runs (operator,
  // 2026-08-03: a local prerequisite is checked locally). Available by
  // default so every existing test below keeps exercising the real path.
  checkMarketaAssessmentStoreAvailable: (...args: any[]) => mockCheckStoreAvailable(...args),
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
  mockCheckStoreAvailable.mockResolvedValue({ available: true });
});

describe('a missing assessment store refuses cleanly — it does not throw through Claim (2026-08-03)', () => {
  /*
   * ── THE LIVE DEFECT ───────────────────────────────────────────────────
   *
   * Nakamoto's Claim: `agent_control_proven` was written FIVE times across
   * five clicks, and Marketa NEVER wrote a single receipt — not even
   * `marketa_eligibility_assessed`, which fires unconditionally on every
   * completed assessment. The actual error, once the route's own try/catch
   * (added earlier the same day) finally surfaced it instead of an empty
   * response body:
   *
   *   Error: getCurrentMarketaAdmissionAssessment failed: Could not find the
   *   table 'public.marketa_agent_admission_assessments' in the schema cache
   *
   * `marketa_agent_admission_assessments` is a real migration
   * (20260930000600) that was simply never applied to this deployment — the
   * identical shape as `partner_authorization_requests` on the Verify path
   * hours earlier. `getCurrentMarketaAdmissionAssessment` threw AFTER evidence
   * assembly succeeded and BEFORE any Marketa receipt could be written, so
   * every retry repeated the control-proof write and hit the same silent
   * wall — no visible cause, which is why five identical clicks happened.
   */
  it('refuses MARKETA_STORE_UNAVAILABLE instead of throwing when the store is unreachable', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    mockCheckStoreAvailable.mockResolvedValue({
      available: false,
      kind: 'table-absent',
      detail: "Could not find the table 'public.marketa_agent_admission_assessments' in the schema cache",
      remedy: "Apply supabase/migrations/20260930000600_marketa_agent_admission_assessments.sql, then NOTIFY pgrst, 'reload schema';",
    });

    const result = await runMarketaAdmissionAssessment({
      aigentQubeId: 'aigentqube-nakamoto',
      actorPersonaId: 'persona-operator-1',
      agentCardUrl: 'https://x/nakamoto-card.json',
      mode: 'FINAL',
      runtimeAgentId: 'aigent-nakamoto',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('MARKETA_ASSESSMENT_STORE_UNAVAILABLE');
    expect(result.detail).toContain('schema cache');
    // The operator's exact acceptance shape (2026-08-03) — each line present.
    expect(result.detail).toContain('MARKETA_ASSESSMENT_STORE_UNAVAILABLE');
    expect(result.detail).toContain('Migration required: 20260930000600_marketa_agent_admission_assessments.sql');
    expect(result.detail).toContain('Claim control proof preserved');
    expect(result.detail).toContain('Safe next act: apply the migration and resume assessment');
  });

  it('checks the store BEFORE evidence is assembled — a doomed run never does the work first', async () => {
    mockCheckStoreAvailable.mockResolvedValue({ available: false, kind: 'table-absent', detail: 'x', remedy: 'y' });
    await runMarketaAdmissionAssessment({
      aigentQubeId: 'aigentqube-nakamoto',
      actorPersonaId: 'persona-operator-1',
      agentCardUrl: 'https://x/nakamoto-card.json',
      mode: 'FINAL',
      runtimeAgentId: 'aigent-nakamoto',
    });
    expect(mockAssembleEvidence, 'evidence assembly ran despite a store that cannot record its result').not.toHaveBeenCalled();
  });

  it('never calls the missing table at all when unavailable — the old defect called it anyway and threw', async () => {
    mockCheckStoreAvailable.mockResolvedValue({ available: false, kind: 'table-absent', detail: 'x', remedy: 'y' });
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    await runMarketaAdmissionAssessment({
      aigentQubeId: 'aigentqube-nakamoto',
      actorPersonaId: 'persona-operator-1',
      agentCardUrl: 'https://x/nakamoto-card.json',
      mode: 'FINAL',
      runtimeAgentId: 'aigent-nakamoto',
    });
    expect(mockGetCurrent, 'getCurrentMarketaAdmissionAssessment must not be called on an unavailable store').not.toHaveBeenCalled();
  });
});

describe('runMarketaAdmissionAssessment', () => {
  it('propagates AIGENTQUBE_NOT_FOUND from the evidence assembler without touching the engine or store', async () => {
    mockAssembleEvidence.mockResolvedValue({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND', detail: 'no row' });
    const result = await runMarketaAdmissionAssessment({ aigentQubeId: 'x', actorPersonaId: 'p1', agentCardUrl: 'https://x/card.json', mode: 'FINAL', runtimeAgentId: 'agent-x' });
    expect(result).toMatchObject({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND' });
    expect(mockCreateAssessment).not.toHaveBeenCalled();
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('FINAL + clean evidence writes assessed + recommended receipts, and a new current assessment', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    const result = await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL', runtimeAgentId: 'aigent-moneypenny' });
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
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL', runtimeAgentId: 'aigent-moneypenny' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed']);
  });

  it('writes assessed + refused receipts for a REFUSED decision (no fresh control proof)', async () => {
    mockAssembleEvidence.mockResolvedValue({
      ...CLEAN_EVIDENCE,
      evidence: { ...CLEAN_EVIDENCE.evidence, control: { proven: false, fresh: false } },
    });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL', runtimeAgentId: 'aigent-moneypenny' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed', 'marketa_eligibility_refused']);
  });

  it('writes assessed + quarantined receipts when a quarantine signal is present', async () => {
    mockAssembleEvidence.mockResolvedValue({
      ...CLEAN_EVIDENCE,
      evidence: { ...CLEAN_EVIDENCE.evidence, risk: { contradictions: [], unresolvedClaims: [], quarantineSignals: ['control-proof-signer-does-not-match-registry-owner'] } },
    });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL', runtimeAgentId: 'aigent-moneypenny' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['marketa_eligibility_assessed', 'marketa_eligibility_quarantined']);
  });

  it('DRAFT mode never writes a recommended receipt, even framed against otherwise-clean evidence', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'DRAFT', runtimeAgentId: 'aigent-moneypenny' });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).not.toContain('marketa_eligibility_recommended');
  });

  it('threads the prior current assessment through as supersedesAssessmentId on reassessment', async () => {
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE);
    mockGetCurrent.mockResolvedValue({ assessmentId: 'prior-assessment-id' });
    await runMarketaAdmissionAssessment({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: 'https://x/card.json', mode: 'FINAL', runtimeAgentId: 'aigent-moneypenny' });
    expect(mockCreateAssessment.mock.calls[0][0].supersedesAssessmentId).toBe('prior-assessment-id');
  });
});

describe('resuming after the store recovers reads existing control proof — no re-signing (2026-08-03)', () => {
  /*
   * The operator's requirement, verbatim: "Resume Claim from the existing
   * agent_control_proven receipt. Do not request another signature." and
   * "the five duplicate control-proof receipts should be treated as
   * corroborating duplicates and never cause another signing prompt."
   *
   * Evidence assembly (services/marketa/externalAgentAdmissionEvidence.ts)
   * already reads `control.proven`/`control.fresh` from EXISTING
   * `agent_control_proven` receipts via `listActivityReceiptsForPersona` — it
   * does not create one. So once the store is available, re-running THIS
   * function (the same call Claim's route already makes) completes using
   * whatever control proof already exists; nothing here asks for a new one.
   * This is a property of the composition, not new code — the canary pins it
   * so it cannot regress silently.
   */
  it('never calls a signing function — control proof is read from evidence, not produced by this function', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'services/marketa/admissionAssessmentRunner.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/signPartnerAuthorization|buildControlProofChallenge/);
  });

  it('completes from a single existing control-proof receipt once the store is available', async () => {
    mockCheckStoreAvailable.mockResolvedValue({ available: true });
    mockAssembleEvidence.mockResolvedValue(CLEAN_EVIDENCE); // pre-existing control.proven/fresh — not re-derived here
    const result = await runMarketaAdmissionAssessment({
      aigentQubeId: 'aigentqube-nakamoto',
      actorPersonaId: 'persona-operator-1',
      agentCardUrl: 'https://x/nakamoto-card.json',
      mode: 'FINAL',
      runtimeAgentId: 'aigent-nakamoto',
    });
    expect(result.ok).toBe(true);
    // No re-signing occurred in this call — the evidence was simply consumed.
    expect(mockAssembleEvidence).toHaveBeenCalledTimes(1);
  });
});
