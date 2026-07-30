/**
 * Coverage — asymmetric by design (rulings §4).
 *
 *   Reviewer 1 — the complete frozen package.
 *   Reviewer 2 — every exclusion; every `domain-adjacent`; every `unknown`;
 *                EVERY private-source row; every mechanically-flagged row; and
 *                a stratified sample of ordinary `independent` decisions.
 *
 * Private-source rows are MANDATORY rather than sampled. They reach the
 * external reviewer through an intermediary summary instead of through the
 * evidence itself, so the second pass is the only place the intermediation gets
 * tested. Folding them into the sample would mean most of them are reviewed
 * once, by a reviewer who never saw the source.
 *
 * Note the shape of the dependency, which `isolation.ts` states as policy:
 * WHICH rows R2 sees is derived from R1's pass; WHAT R1 said about them is not
 * carried across.
 */

import { proportionalStratifiedSample } from './deterministic';
import { ReviewRefusal, type ReviewDecision, type ReviewSubjectRecord } from './types';

export type CoverageRule =
  | 'proposed-exclusion'
  | 'domain-adjacent'
  | 'unknown'
  | 'private-source'
  | 'mechanically-flagged'
  | 'stratified-sample';

export const MANDATORY_COVERAGE_RULES: readonly CoverageRule[] = [
  'proposed-exclusion',
  'domain-adjacent',
  'unknown',
  'private-source',
  'mechanically-flagged',
];

/** Labels that are neither eligible nor `unknown` — i.e. a proposed exclusion. */
const CONTAMINATED_LABELS = new Set(['target-derived', 'task-derived', 'outcome-informed']);
/** The one ordinary label that may be sampled rather than fully re-reviewed. */
const ORDINARY_LABEL = 'independent';

export interface Reviewer2CoverageInput {
  subjects: readonly ReviewSubjectRecord[];
  r1Decisions: readonly ReviewDecision[];
  /** Rows excluded from the package itself, which R2 must still see. */
  packageExclusions: readonly string[];
  /** Rows a mechanical check flagged (recent edit, target vocabulary, …). */
  mechanicallyFlagged: readonly string[];
  sampleRate: number;
  sampleSeed: string;
  /**
   * Operator-directed full coverage for this run (2026-07-30 ruling, vP1):
   * every subject goes to R2, regardless of rule/sample outcome. Reported
   * honestly as its own category (`fullCoveragePolicy` in the returned
   * breakdown) — NEVER folded into `mechanically-flagged`, since that would
   * claim a per-row rule fired when the real reason is an operator policy
   * for this specific run. Absent or false: behaves exactly as before.
   */
  fullCoveragePolicy?: boolean;
}

export interface Reviewer2Coverage {
  subjectRefs: string[];
  byRule: Record<CoverageRule, string[]>;
  sampleRate: number;
  sampleSeed: string;
  /** Ordinary `independent` rows NOT sampled — recorded, so coverage is auditable. */
  notReviewedTwice: string[];
  /**
   * Rows added ONLY because `fullCoveragePolicy` was set — i.e. rows that
   * were neither mandatory by rule nor drawn by the stratified sample.
   * Empty whenever `fullCoveragePolicy` is unset. Kept separate from
   * `byRule` so "mandatory" never silently comes to mean "included".
   */
  addedByFullCoveragePolicy: string[];
}

export function selectReviewer2Coverage(input: Reviewer2CoverageInput): Reviewer2Coverage {
  if (input.sampleRate < 0 || input.sampleRate > 1) {
    throw new ReviewRefusal('invalid-sample-rate', `sampleRate must be in [0,1]; received ${input.sampleRate}`);
  }
  if (!input.sampleSeed.trim()) {
    throw new ReviewRefusal(
      'missing-sample-seed',
      'a stratified sample without a committed seed cannot be re-derived, so nobody can check it ' +
        'was drawn before the results were seen',
    );
  }

  const byRef = new Map(input.subjects.map((s) => [s.subjectRef, s]));
  const decisionByRef = new Map<string, ReviewDecision>();
  for (const d of input.r1Decisions) decisionByRef.set(d.subjectRef, d);

  const byRule: Record<CoverageRule, string[]> = {
    'proposed-exclusion': [],
    'domain-adjacent': [],
    unknown: [],
    'private-source': [],
    'mechanically-flagged': [],
    'stratified-sample': [],
  };

  // Guarded by byRef.has(ref), same as mechanicallyFlagged below. Bug fixed
  // 2026-07-30: this was previously unguarded, silently folding rows that
  // were excluded from the PACKAGE ITSELF (out-of-boundary namespaces, never
  // among these 464 subjects) into the dispatchable coverage set — inflating
  // "rows to second review" from 464 to 478 in a live run. Package-exclusion
  // rows are informational context for the operator (surfaced separately by
  // the caller from the plan's own out-of-boundary count), never a subject
  // this coverage set can actually dispatch.
  for (const ref of input.packageExclusions) if (byRef.has(ref)) byRule['proposed-exclusion'].push(ref);
  for (const ref of input.mechanicallyFlagged) if (byRef.has(ref)) byRule['mechanically-flagged'].push(ref);

  // Mandatory, never sampled: the intermediated-evidence rows.
  for (const s of input.subjects) if (s.privateEvidenceRef) byRule['private-source'].push(s.subjectRef);

  for (const d of input.r1Decisions) {
    if (d.decision === 'domain-adjacent') byRule['domain-adjacent'].push(d.subjectRef);
    else if (d.decision === 'unknown') byRule.unknown.push(d.subjectRef);
    else if (CONTAMINATED_LABELS.has(d.decision)) byRule['proposed-exclusion'].push(d.subjectRef);
  }

  const mandatory = new Set(MANDATORY_COVERAGE_RULES.flatMap((r) => byRule[r]));

  // The sample pool: ordinary `independent` rows not already mandated.
  const pool = input.subjects
    .filter((s) => !mandatory.has(s.subjectRef))
    .filter((s) => decisionByRef.get(s.subjectRef)?.decision === ORDINARY_LABEL)
    .map((s) => ({ key: s.subjectRef, stratum: s.namespace }));

  byRule['stratified-sample'] = proportionalStratifiedSample(input.sampleSeed, pool, input.sampleRate);

  const selected = new Set<string>([...mandatory, ...byRule['stratified-sample']]);

  // Operator-directed full coverage (vP1 ruling, 2026-07-30): every subject
  // not already selected by a rule or the sample is added, and recorded
  // under its own honest category -- never merged into `mandatory` or
  // `mechanically-flagged`, which would misstate a per-run policy as a
  // per-row rule.
  const addedByFullCoveragePolicy: string[] = [];
  if (input.fullCoveragePolicy) {
    for (const s of input.subjects) {
      if (!selected.has(s.subjectRef)) {
        selected.add(s.subjectRef);
        addedByFullCoveragePolicy.push(s.subjectRef);
      }
    }
  }

  const notReviewedTwice = pool.map((p) => p.key).filter((k) => !selected.has(k));

  return {
    subjectRefs: [...selected].sort(),
    byRule,
    sampleRate: input.sampleRate,
    sampleSeed: input.sampleSeed,
    notReviewedTwice: notReviewedTwice.sort(),
    addedByFullCoveragePolicy: addedByFullCoveragePolicy.sort(),
  };
}

/**
 * Coverage is complete when every mandatory category is fully present. Exported
 * so the runner can assert it before dispatch rather than discovering a gap
 * after the fact, when the only remedy is another paid run.
 */
export function assertCoverageComplete(coverage: Reviewer2Coverage, input: Reviewer2CoverageInput): void {
  const selected = new Set(coverage.subjectRefs);
  const privateRows = input.subjects.filter((s) => s.privateEvidenceRef).map((s) => s.subjectRef);
  const missingPrivate = privateRows.filter((r) => !selected.has(r));
  if (missingPrivate.length > 0) {
    throw new ReviewRefusal(
      'incomplete-second-review-coverage',
      `${missingPrivate.length} private-source row(s) are absent from second review. Private-source ` +
        'rows are mandatory, not sampled (rulings §4).',
    );
  }
  for (const d of input.r1Decisions) {
    const mustReview = d.decision === 'domain-adjacent' || d.decision === 'unknown' || CONTAMINATED_LABELS.has(d.decision);
    if (mustReview && !selected.has(d.subjectRef)) {
      throw new ReviewRefusal(
        'incomplete-second-review-coverage',
        `row ${d.subjectRef} was first-pass '${d.decision}' and is absent from second review`,
      );
    }
  }
}
