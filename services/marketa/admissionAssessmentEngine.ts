/**
 * Marketa's deterministic admission-eligibility rule engine (GJR-MKT-001
 * Phase 4). Consumes the Phase 3 evidence snapshot and produces an
 * inspectable, versioned decision — never a black-box score ("Initial
 * deterministic policy" §5).
 *
 * Canonical rule: Marketa may REASON before control is proven; she may not
 * issue a FINAL recommendation before it ("Control Before Recommendation").
 * DRAFT mode never evaluates MKT-ADM-005/006 (both control-dependent) — they
 * are reported `missing`, never `failed`, so a draft assessment can never be
 * penalized for a gap that draft mode isn't supposed to require yet.
 */

import type { ExternalAgentAdmissionEvidence } from './externalAgentAdmissionEvidence';

export type MarketaAdmissionMode = 'DRAFT' | 'FINAL';

export type MarketaAdmissionDecision =
  | 'DRAFT_ELIGIBLE'
  | 'DRAFT_BLOCKED'
  | 'RECOMMENDED'
  | 'NOT_RECOMMENDED'
  | 'REFUSED'
  | 'QUARANTINED';

export type RuleOutcome = 'satisfied' | 'missing' | 'failed';

export interface RuleResult {
  ruleId: string;
  label: string;
  outcome: RuleOutcome;
}

export const MKT_ADM_RULES: ReadonlyArray<{ id: string; label: string; controlDependent: boolean }> = [
  { id: 'MKT-ADM-001', label: 'persisted AigentQube required', controlDependent: false },
  { id: 'MKT-ADM-002', label: 'Agent Card must resolve', controlDependent: false },
  { id: 'MKT-ADM-003', label: 'registry identity must be network-qualified', controlDependent: false },
  { id: 'MKT-ADM-004', label: 'registered controller must be explicit', controlDependent: false },
  { id: 'MKT-ADM-005', label: 'fresh control proof required for FINAL', controlDependent: true },
  { id: 'MKT-ADM-006', label: 'signer must match registered controller', controlDependent: true },
  { id: 'MKT-ADM-007', label: 'Pulse integration must be active', controlDependent: false },
  { id: 'MKT-ADM-008', label: 'disclosure consent must be explicit', controlDependent: false },
  { id: 'MKT-ADM-009', label: 'delegation must be bounded', controlDependent: false },
  { id: 'MKT-ADM-010', label: 'delegation must be revocable', controlDependent: false },
  { id: 'MKT-ADM-011', label: 'onward delegation prohibited', controlDependent: false },
  { id: 'MKT-ADM-012', label: 'critical contradictions refuse', controlDependent: false },
];

/** Failing one of these (in FINAL mode) is a CORRECTABLE constitutional refusal (§10), never a quarantine. */
const REFUSAL_RULE_IDS = new Set(['MKT-ADM-003', 'MKT-ADM-004', 'MKT-ADM-005', 'MKT-ADM-006']);

function evaluateRule(ruleId: string, evidence: ExternalAgentAdmissionEvidence, mode: MarketaAdmissionMode): RuleOutcome {
  switch (ruleId) {
    case 'MKT-ADM-001':
      return evidence.aigentQube.exists ? 'satisfied' : 'missing';
    case 'MKT-ADM-002':
      return evidence.agentCard.resolves ? 'satisfied' : 'missing';
    case 'MKT-ADM-003':
      return evidence.externalRegistry.resolves && !!evidence.externalRegistry.network && !!evidence.externalRegistry.tokenId
        ? 'satisfied'
        : 'missing';
    case 'MKT-ADM-004':
      return evidence.externalRegistry.ownerWallet ? 'satisfied' : 'missing';
    case 'MKT-ADM-005': {
      if (mode === 'DRAFT') return 'missing'; // control-dependent — never evaluated pre-control
      if (!evidence.control.proven) return 'missing';
      return evidence.control.fresh ? 'satisfied' : 'failed'; // proven-but-stale is a real fault, not an absence
    }
    case 'MKT-ADM-006': {
      if (mode === 'DRAFT') return 'missing';
      if (!evidence.control.signerWallet || !evidence.externalRegistry.ownerWallet) return 'missing';
      return evidence.control.signerWallet.toLowerCase() === evidence.externalRegistry.ownerWallet.toLowerCase()
        ? 'satisfied'
        : 'failed';
    }
    case 'MKT-ADM-007':
      return evidence.transparency.pulseEnabled ? 'satisfied' : 'missing';
    case 'MKT-ADM-008':
      return evidence.transparency.pnlDisclosureAuthorized ? 'satisfied' : 'missing';
    case 'MKT-ADM-009':
      return evidence.authorityFitness.delegationBoundable ? 'satisfied' : 'missing';
    case 'MKT-ADM-010':
      return evidence.authorityFitness.delegationRevocable ? 'satisfied' : 'missing';
    case 'MKT-ADM-011':
      // A hard invariant, not a data-availability gap — false here is a fault.
      return evidence.authorityFitness.onwardDelegationProhibited ? 'satisfied' : 'failed';
    case 'MKT-ADM-012':
      return evidence.risk.contradictions.length === 0 ? 'satisfied' : 'failed';
    default:
      return 'missing';
  }
}

export interface RuleEvaluation {
  results: RuleResult[];
  satisfiedRules: string[];
  missingRules: string[];
  failedRules: string[];
}

export function evaluateRules(evidence: ExternalAgentAdmissionEvidence, mode: MarketaAdmissionMode): RuleEvaluation {
  const results: RuleResult[] = MKT_ADM_RULES.map((r) => ({
    ruleId: r.id,
    label: r.label,
    outcome: evaluateRule(r.id, evidence, mode),
  }));
  return {
    results,
    satisfiedRules: results.filter((r) => r.outcome === 'satisfied').map((r) => r.ruleId),
    missingRules: results.filter((r) => r.outcome === 'missing').map((r) => r.ruleId),
    failedRules: results.filter((r) => r.outcome === 'failed').map((r) => r.ruleId),
  };
}

function decide(evidence: ExternalAgentAdmissionEvidence, mode: MarketaAdmissionMode, evaluation: RuleEvaluation): MarketaAdmissionDecision {
  if (evidence.risk.quarantineSignals.length > 0) return 'QUARANTINED';

  const notSatisfied = new Set([...evaluation.missingRules, ...evaluation.failedRules]);

  if (mode === 'DRAFT') {
    // Control-dependent rules are never required for DRAFT_ELIGIBLE.
    const draftRequired = MKT_ADM_RULES.filter((r) => !r.controlDependent).map((r) => r.id);
    return draftRequired.every((id) => !notSatisfied.has(id)) ? 'DRAFT_ELIGIBLE' : 'DRAFT_BLOCKED';
  }

  // FINAL — any correctable-refusal rule missing/failed refuses outright,
  // never silently downgrades to NOT_RECOMMENDED (§10, and the
  // "Control Before Recommendation" invariant: MKT-ADM-005 sits in this set).
  const anyRefusalRuleUnmet = [...REFUSAL_RULE_IDS].some((id) => notSatisfied.has(id));
  if (anyRefusalRuleUnmet) return 'REFUSED';

  const allSatisfied = MKT_ADM_RULES.every((r) => evaluation.satisfiedRules.includes(r.id));
  return allSatisfied ? 'RECOMMENDED' : 'NOT_RECOMMENDED';
}

function buildRationale(mode: MarketaAdmissionMode, decision: MarketaAdmissionDecision, evaluation: RuleEvaluation): string {
  if (decision === 'QUARANTINED') return 'Higher-risk evidence signal present — quarantined pending operator review, never auto-cleared.';
  if (decision === 'REFUSED') return `Correctable constitutional condition unmet: ${evaluation.failedRules.concat(evaluation.missingRules).filter((id) => REFUSAL_RULE_IDS.has(id)).join(', ')}.`;
  if (decision === 'RECOMMENDED') return 'All twelve rules satisfied under a fresh proof of control. Recommended for Polity-bound Delegate admission.';
  if (decision === 'NOT_RECOMMENDED') return `Not recommended — unmet: ${evaluation.missingRules.concat(evaluation.failedRules).join(', ')}.`;
  if (decision === 'DRAFT_ELIGIBLE') return 'All draft-evaluable rules satisfied. Final recommendation still requires fresh proof of control.';
  return `Draft blocked — unmet: ${evaluation.missingRules.concat(evaluation.failedRules).join(', ')}.`;
}

export interface MarketaAdmissionAssessment {
  version: string;
  mode: MarketaAdmissionMode;
  decision: MarketaAdmissionDecision;
  satisfiedRules: string[];
  missingRules: string[];
  failedRules: string[];
  contradictionRefs: string[];
  evidenceRefs: string[];
  rationale: string;
  policyVersion: string;
}

export const MARKETA_POLICY_VERSION = 'mkt-adm-policy-1.0.0';

/**
 * The versioned rule engine itself. Pure — evidence in, assessment out. No
 * I/O, no persistence, no receipt-writing (those live in
 * admissionAssessmentStore.ts and the API route that calls this).
 */
export function assessExternalAgentAdmission(
  evidence: ExternalAgentAdmissionEvidence,
  mode: MarketaAdmissionMode,
): MarketaAdmissionAssessment {
  const evaluation = evaluateRules(evidence, mode);
  const decision = decide(evidence, mode, evaluation);
  return {
    version: '1.0',
    mode,
    decision,
    satisfiedRules: evaluation.satisfiedRules,
    missingRules: evaluation.missingRules,
    failedRules: evaluation.failedRules,
    contradictionRefs: evidence.risk.contradictions,
    evidenceRefs: evidence.transparency.evidenceRefs,
    rationale: buildRationale(mode, decision, evaluation),
    policyVersion: MARKETA_POLICY_VERSION,
  };
}
