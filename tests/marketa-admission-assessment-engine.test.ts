/**
 * services/marketa/admissionAssessmentEngine.ts — GJR-MKT-001 Phase 4. Pure
 * rule engine: evidence in, versioned decision out. Covers all twelve rules,
 * the DRAFT/FINAL split, and the required refusal canaries this phase
 * implements: final assessment before proof of control, draft never
 * producing RECOMMENDED, quarantine outranking everything.
 */

import { describe, it, expect } from 'vitest';
import { assessExternalAgentAdmission, evaluateRules, MKT_ADM_RULES } from '@/services/marketa/admissionAssessmentEngine';
import type { ExternalAgentAdmissionEvidence } from '@/services/marketa/externalAgentAdmissionEvidence';

function fullEvidence(overrides: Partial<ExternalAgentAdmissionEvidence> = {}): ExternalAgentAdmissionEvidence {
  return {
    aigentQube: { exists: true, id: 'aigentqube-moneypenny', canonicalStateHash: 'hash' },
    agentCard: { resolves: true, url: 'https://x/card.json', hash: 'cardhash', schemaValid: true, provenanceValid: true },
    externalRegistry: { resolves: true, protocol: 'erc-8004', network: 'base-sepolia', contract: '0xReg', tokenId: '1234', ownerWallet: '0xOwner' },
    control: { proven: true, proofRef: 'receipt-control', signerWallet: '0xOwner', fresh: true },
    transparency: { pulseSupported: true, pulseEnabled: true, pnlDisclosureAuthorized: true, evidenceRefs: ['auth-1'] },
    authorityFitness: { sponsorEligible: null, delegationBoundable: true, delegationRevocable: true, onwardDelegationProhibited: true, expirySupported: true },
    risk: { contradictions: [], unresolvedClaims: [], quarantineSignals: [] },
    ...overrides,
  };
}

describe('evaluateRules', () => {
  it('all twelve rules satisfied for complete, coherent FINAL evidence', () => {
    const evaluation = evaluateRules(fullEvidence(), 'FINAL');
    expect(evaluation.satisfiedRules).toHaveLength(12);
    expect(evaluation.missingRules).toEqual([]);
    expect(evaluation.failedRules).toEqual([]);
  });

  it('MKT-ADM-005/006 are always `missing` in DRAFT mode, never evaluated even when control evidence is present', () => {
    const evaluation = evaluateRules(fullEvidence(), 'DRAFT');
    expect(evaluation.missingRules).toContain('MKT-ADM-005');
    expect(evaluation.missingRules).toContain('MKT-ADM-006');
  });

  it('MKT-ADM-005 fails (not merely missing) when control is proven but stale', () => {
    const evaluation = evaluateRules(fullEvidence({ control: { proven: true, fresh: false, signerWallet: '0xOwner', proofRef: 'r' } }), 'FINAL');
    expect(evaluation.failedRules).toContain('MKT-ADM-005');
  });

  it('MKT-ADM-006 fails when the signer does not match the registered owner', () => {
    const evaluation = evaluateRules(fullEvidence({ control: { proven: true, fresh: true, signerWallet: '0xSomeoneElse', proofRef: 'r' } }), 'FINAL');
    expect(evaluation.failedRules).toContain('MKT-ADM-006');
  });

  it('MKT-ADM-011 fails (a hard invariant) rather than merely missing if onward delegation were ever not prohibited', () => {
    const evaluation = evaluateRules(fullEvidence({ authorityFitness: { sponsorEligible: null, delegationBoundable: true, delegationRevocable: true, onwardDelegationProhibited: false, expirySupported: true } }), 'FINAL');
    expect(evaluation.failedRules).toContain('MKT-ADM-011');
  });

  it('MKT-ADM-012 fails when any contradiction is present', () => {
    const evaluation = evaluateRules(fullEvidence({ risk: { contradictions: ['agent-card-url-self-mismatch'], unresolvedClaims: [], quarantineSignals: [] } }), 'FINAL');
    expect(evaluation.failedRules).toContain('MKT-ADM-012');
  });

  it('exposes exactly the twelve canonical rule ids', () => {
    expect(MKT_ADM_RULES.map((r) => r.id)).toEqual([
      'MKT-ADM-001', 'MKT-ADM-002', 'MKT-ADM-003', 'MKT-ADM-004', 'MKT-ADM-005', 'MKT-ADM-006',
      'MKT-ADM-007', 'MKT-ADM-008', 'MKT-ADM-009', 'MKT-ADM-010', 'MKT-ADM-011', 'MKT-ADM-012',
    ]);
  });
});

describe('assessExternalAgentAdmission — DRAFT mode', () => {
  it('DRAFT_ELIGIBLE when every draft-evaluable rule is satisfied, even with no control proof at all', () => {
    const evidence = fullEvidence({ control: { proven: false, fresh: false } });
    const assessment = assessExternalAgentAdmission(evidence, 'DRAFT');
    expect(assessment.decision).toBe('DRAFT_ELIGIBLE');
  });

  it('never produces RECOMMENDED in DRAFT mode, even with fully clean evidence', () => {
    const assessment = assessExternalAgentAdmission(fullEvidence(), 'DRAFT');
    expect(assessment.decision).not.toBe('RECOMMENDED');
  });

  it('DRAFT_BLOCKED when a non-control-dependent rule is unmet', () => {
    const evidence = fullEvidence({ agentCard: { resolves: false, schemaValid: false, provenanceValid: false } });
    const assessment = assessExternalAgentAdmission(evidence, 'DRAFT');
    expect(assessment.decision).toBe('DRAFT_BLOCKED');
  });
});

describe('assessExternalAgentAdmission — FINAL mode', () => {
  it('RECOMMENDED when all twelve rules are satisfied under fresh control proof', () => {
    const assessment = assessExternalAgentAdmission(fullEvidence(), 'FINAL');
    expect(assessment.decision).toBe('RECOMMENDED');
    expect(assessment.satisfiedRules).toHaveLength(12);
  });

  it('REFUSED — required refusal canary: final assessment attempted before any proof of control', () => {
    const evidence = fullEvidence({ control: { proven: false, fresh: false } });
    const assessment = assessExternalAgentAdmission(evidence, 'FINAL');
    expect(assessment.decision).toBe('REFUSED');
    expect(assessment.missingRules).toContain('MKT-ADM-005');
  });

  it('REFUSED — required refusal canary: owner/signer mismatch (contradictory controller identities go to quarantine instead, tested below)', () => {
    const evidence = fullEvidence({ control: { proven: true, fresh: true, signerWallet: '0xWrongSigner', proofRef: 'r' } });
    const assessment = assessExternalAgentAdmission(evidence, 'FINAL');
    expect(assessment.decision).toBe('REFUSED');
  });

  it('REFUSED when the external registry identity is unresolved', () => {
    const evidence = fullEvidence({ externalRegistry: { resolves: false } });
    const assessment = assessExternalAgentAdmission(evidence, 'FINAL');
    expect(assessment.decision).toBe('REFUSED');
  });

  it('QUARANTINED outranks every other signal, even otherwise-perfect evidence', () => {
    const evidence = fullEvidence({ risk: { contradictions: [], unresolvedClaims: [], quarantineSignals: ['control-proof-signer-does-not-match-registry-owner'] } });
    const assessment = assessExternalAgentAdmission(evidence, 'FINAL');
    expect(assessment.decision).toBe('QUARANTINED');
  });

  it('NOT_RECOMMENDED for a non-refusal, non-quarantine gap (e.g. Agent Card unresolved, everything else clean)', () => {
    const evidence = fullEvidence({ agentCard: { resolves: false, schemaValid: false, provenanceValid: false } });
    const assessment = assessExternalAgentAdmission(evidence, 'FINAL');
    expect(assessment.decision).toBe('NOT_RECOMMENDED');
  });

  it('carries the evidenceRefs and contradictionRefs through from evidence, never inventing its own', () => {
    const evidence = fullEvidence({ transparency: { pulseSupported: true, pulseEnabled: true, pnlDisclosureAuthorized: true, evidenceRefs: ['ref-a', 'ref-b'] }, risk: { contradictions: ['x'], unresolvedClaims: [], quarantineSignals: [] } });
    const assessment = assessExternalAgentAdmission(evidence, 'FINAL');
    expect(assessment.evidenceRefs).toEqual(['ref-a', 'ref-b']);
    expect(assessment.contradictionRefs).toEqual(['x']);
  });

  it('records the policy version on every assessment, for later drift/reproducibility checks', () => {
    const assessment = assessExternalAgentAdmission(fullEvidence(), 'FINAL');
    expect(assessment.policyVersion).toMatch(/^mkt-adm-policy-/);
  });
});
