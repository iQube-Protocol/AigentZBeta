/**
 * Private evidence — the two-tier rule.
 *
 *   > "Do not automatically classify every private-source row `unknown`. That
 *   > would collapse the eligible population needlessly and privilege publicly
 *   > shareable evidence over valid confidential evidence."
 *
 * A trusted local reviewer inspects private material inside the runtime and
 * emits a signed, minimally sufficient summary. The external reviewer sees the
 * summary, never the material.
 *
 * Two things are easy to get wrong here and both are load-bearing.
 *
 *   1. A SUMMARY IS EVIDENCE, NOT AUTHORITY. Nothing in this module returns a
 *      relation label. A perfectly clean summary constrains no reviewer: it
 *      supplies facts, and the reviewer remains free to answer `unknown` or a
 *      contaminated label anyway. There is deliberately no function here that
 *      maps a summary to an admissible classification, because the moment one
 *      exists someone will call it and the local reviewer will have quietly
 *      become the decider.
 *
 *   2. INSUFFICIENT MEANS UNKNOWN, NOT ABSENT. A summary that is incomplete,
 *      unverifiable or self-contradictory forces `unknown` — which fails closed
 *      — rather than dropping the row silently.
 *
 * Private-source rows also get MANDATORY second review rather than sampling
 * (see coverage.ts), because they reach the external reviewer through an
 * intermediary rather than through the evidence itself.
 */

import { findBlindingViolations } from './blinding';
import { ReviewRefusal } from './types';

export interface PrivateEvidenceSummary {
  invariantId: string;
  sourceCommitment: string;
  sourceClass: string;

  sourcePredatesTaskConstruction: boolean;
  sourcePredatesPilotOutcomes: boolean;

  derivedFromTargetSystem: boolean;
  derivedFromTaskOrExpectedAnswer: boolean;
  revisedAfterObservedOutcome: boolean;

  derivationMethod: string;
  factualBasis: string;

  localReviewerRef: string;
  reviewedAt: string;
  signatureOrReceiptRef: string;
}

export type PrivateEvidenceVerdict = 'sufficient' | 'insufficient';

export interface PrivateEvidenceAssessment {
  invariantId: string;
  verdict: PrivateEvidenceVerdict;
  /**
   * When `insufficient`, the relation the reviewer is REQUIRED to fall back to.
   * When `sufficient`, `null` — because a sufficient summary determines
   * nothing. It merely stops determining the answer for the reviewer.
   */
  forcedRelation: 'unknown' | null;
  findings: string[];
}

const REQUIRED_TEXT_FIELDS: readonly (keyof PrivateEvidenceSummary)[] = [
  'invariantId',
  'sourceCommitment',
  'sourceClass',
  'derivationMethod',
  'factualBasis',
  'localReviewerRef',
  'reviewedAt',
  'signatureOrReceiptRef',
];

const REQUIRED_BOOLEAN_FIELDS: readonly (keyof PrivateEvidenceSummary)[] = [
  'sourcePredatesTaskConstruction',
  'sourcePredatesPilotOutcomes',
  'derivedFromTargetSystem',
  'derivedFromTaskOrExpectedAnswer',
  'revisedAfterObservedOutcome',
];

/**
 * Assess one summary. Never returns an admissible label — see the header.
 *
 * Unavailability is handled by the caller passing `null`, which is the fourth
 * fail-closed case named in the ruling alongside insufficient, unverifiable and
 * contradictory.
 */
export function assessPrivateEvidence(
  summary: PrivateEvidenceSummary | null,
  invariantId: string,
): PrivateEvidenceAssessment {
  const findings: string[] = [];

  if (summary === null) {
    return {
      invariantId,
      verdict: 'insufficient',
      forcedRelation: 'unknown',
      findings: ['no evidence summary available for a private-source row'],
    };
  }

  for (const f of REQUIRED_TEXT_FIELDS) {
    const v = summary[f];
    if (typeof v !== 'string' || v.trim().length === 0) findings.push(`missing or blank required field '${String(f)}'`);
  }
  for (const f of REQUIRED_BOOLEAN_FIELDS) {
    if (typeof summary[f] !== 'boolean') findings.push(`required determination '${String(f)}' is not stated`);
  }

  // Unverifiable: a summary with no attributable signer or receipt is an
  // assertion by nobody. `localReviewerRef` alone is a name; the signature or
  // receipt ref is what makes the name checkable.
  if (typeof summary.signatureOrReceiptRef === 'string' && !summary.signatureOrReceiptRef.trim()) {
    findings.push('unverifiable: no signature or receipt reference');
  }

  // Contradictory: a source cannot be derived from tasks that did not exist
  // when it was written. Exactly one contradiction rule, and it is a hard
  // logical impossibility rather than a suspicion — a broad "looks odd" rule
  // here would push honest summaries to `unknown` and collapse the population
  // the two-tier rule exists to preserve.
  if (summary.sourcePredatesTaskConstruction === true && summary.derivedFromTaskOrExpectedAnswer === true) {
    findings.push(
      'contradictory: the summary states the source predates task construction AND that it was ' +
        'derived from the task set or its expected answers',
    );
  }

  return findings.length > 0
    ? { invariantId, verdict: 'insufficient', forcedRelation: 'unknown', findings }
    : { invariantId, verdict: 'sufficient', forcedRelation: null, findings: [] };
}

/**
 * A summary is minimally sufficient AND minimally disclosing. It must not carry
 * raw private documents, persona or passport identifiers, proprietary task
 * answers, a desired eligibility, a desired population size, or a prior
 * internal classification.
 *
 * The blinding scanner already knows those shapes, so this reuses it rather
 * than maintaining a second forbidden-field list that would drift.
 */
export function assertSummaryDisclosureSafe(summary: PrivateEvidenceSummary): void {
  const violations = findBlindingViolations(summary);
  if (violations.length > 0) {
    throw new ReviewRefusal(
      'private-summary-overdisclosure',
      `evidence summary for ${summary.invariantId} discloses blinded material: ` +
        violations.map((v) => `${v.path} (${v.kind})`).join('; '),
    );
  }
  // A raw UUID in a summary is the persona/passport-identifier failure mode the
  // rule names explicitly. Commitments are 16-hex; UUIDs are not.
  const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v === 'string' && uuid.test(v)) {
      throw new ReviewRefusal(
        'private-summary-identifier-leak',
        `evidence summary field '${k}' contains a raw UUID. Summaries carry commitments, never ` +
          'persona or passport identifiers.',
      );
    }
  }
}

/**
 * Rendered for the package. Booleans are spelled out because a reviewer reading
 * `false` in a JSON blob has to guess which direction is the clean one.
 */
export function renderEvidenceSummary(summary: PrivateEvidenceSummary): string {
  return [
    `summary for ${summary.invariantId}`,
    `  source commitment: ${summary.sourceCommitment} (class: ${summary.sourceClass})`,
    `  source predates task construction: ${summary.sourcePredatesTaskConstruction ? 'yes' : 'no'}`,
    `  source predates pilot outcomes: ${summary.sourcePredatesPilotOutcomes ? 'yes' : 'no'}`,
    `  derived from the target system: ${summary.derivedFromTargetSystem ? 'yes' : 'no'}`,
    `  derived from tasks or expected answers: ${summary.derivedFromTaskOrExpectedAnswer ? 'yes' : 'no'}`,
    `  revised after observed outcomes: ${summary.revisedAfterObservedOutcome ? 'yes' : 'no'}`,
    `  derivation method: ${summary.derivationMethod}`,
    `  factual basis: ${summary.factualBasis}`,
    `  local reviewer: ${summary.localReviewerRef} at ${summary.reviewedAt}, signed ${summary.signatureOrReceiptRef}`,
    '  This summary is evidence, not authority. You may answer `unknown` or a contaminated label ' +
      'regardless of what it asserts.',
  ].join('\n');
}
