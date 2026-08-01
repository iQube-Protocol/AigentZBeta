/**
 * Parsing reviewer output, and resolving two passes into a queue.
 *
 * ── Never average ───────────────────────────────────────────────────────────
 *
 *   > "Never average labels, confidence scores or textual rationales. A
 *   > contested row is a fact about the evidence, and averaging destroys it."
 *
 * There is no averaging function in this module, and there is nowhere to put an
 * average either: `ReviewResolution` has no confidence field and no synthesised
 * label field. Both reviewers' decisions are carried across verbatim, and the
 * status is one of the SPEC's six — never a blend. If two reviewers disagree,
 * the row becomes `contested` and is excluded pending governed resolution.
 *
 * ── Unsigned decisions are refused ──────────────────────────────────────────
 *
 * A decision without an attributable reviewer, a raw-output reference and an
 * output commitment is not a review finding; it is a JSON object someone
 * produced. Admitting one would make the audit trail unfalsifiable — anybody
 * could later add a row and nothing in the artifact would contradict them.
 */

import { commit } from './deterministic';
import { stripJsonFences } from '@/services/agents/_lib/llmDraftHelper';
import {
  ReviewRefusal,
  type ReviewDecision,
  type ReviewResolution,
  type ReviewResolutionStatus,
  type ReviewerSlot,
} from './types';

const VALID_LABELS = new Set([
  'independent',
  'domain-adjacent',
  'target-derived',
  'task-derived',
  'outcome-informed',
  'unknown',
]);

/** Labels that permit local adoption when both reviewers agree. */
const ELIGIBLE_LABELS = new Set(['independent', 'domain-adjacent']);

export interface ParseDecisionsInput {
  reviewId: string;
  reviewerSlot: ReviewerSlot;
  reviewerRef: string;
  raw: string;
  rawOutputRef: string;
  reviewedAt: string;
  /** Refs the reviewer was actually asked about. Anything else is discarded loudly. */
  expectedSubjectRefs: readonly string[];
}

export interface ParsedAdjudication {
  decisions: ReviewDecision[];
  outputHash: string;
  /** Refs the reviewer was asked about but did not answer. These fail closed. */
  unanswered: string[];
  /** Refs the reviewer answered that it was never asked about. */
  unsolicited: string[];
}

/**
 * Parse a reviewer's raw output into decisions.
 *
 * Missing rows are NOT silently filled with a default. They are reported as
 * `unanswered` and the caller records them as `unknown` — which fails closed —
 * because "the reviewer did not answer" and "the reviewer said it was fine" are
 * opposite facts.
 */
export function parseAdjudication(input: ParseDecisionsInput): ParsedAdjudication {
  const outputHash = commit({ raw: input.raw });
  let payload: unknown;
  try {
    payload = JSON.parse(stripJsonFences(input.raw));
  } catch (err) {
    throw new ReviewRefusal(
      'unparseable-adjudication',
      `${input.reviewerSlot} output could not be parsed as JSON (${err instanceof Error ? err.message : String(err)}). ` +
        `Raw output is retained at ${input.rawOutputRef}; rerun with the same frozen package rather than editing the output.`,
    );
  }

  const rows = Array.isArray((payload as { decisions?: unknown })?.decisions)
    ? ((payload as { decisions: unknown[] }).decisions)
    : null;
  if (!rows) {
    throw new ReviewRefusal('malformed-adjudication', `${input.reviewerSlot} output has no 'decisions' array`);
  }

  const expected = new Set(input.expectedSubjectRefs);
  const seen = new Set<string>();
  const decisions: ReviewDecision[] = [];
  const unsolicited: string[] = [];

  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const subjectRef = typeof r.subjectRef === 'string' ? r.subjectRef : '';
    const decision = typeof r.decision === 'string' ? r.decision.trim() : '';
    if (!subjectRef) continue;
    if (!expected.has(subjectRef)) {
      unsolicited.push(subjectRef);
      continue;
    }
    if (!VALID_LABELS.has(decision)) {
      throw new ReviewRefusal(
        'invalid-decision-label',
        `${input.reviewerSlot} returned label ${JSON.stringify(decision)} for ${subjectRef}, which is not in the rubric`,
      );
    }
    const reason = typeof r.reason === 'string' ? r.reason.trim() : '';
    if (!reason) {
      throw new ReviewRefusal('unreasoned-decision', `${input.reviewerSlot} gave no reason for ${subjectRef}`);
    }
    if (decision === 'domain-adjacent' && reason.length < 12) {
      throw new ReviewRefusal(
        'unreasoned-domain-adjacent',
        `${input.reviewerSlot} labelled ${subjectRef} 'domain-adjacent' without a substantive reason`,
      );
    }
    seen.add(subjectRef);
    decisions.push({
      reviewId: input.reviewId,
      reviewerSlot: input.reviewerSlot,
      subjectRef,
      decision,
      reason,
      evidenceRefs: Array.isArray(r.evidenceRefs) ? r.evidenceRefs.filter((x): x is string => typeof x === 'string') : [],
      limitations: Array.isArray(r.limitations) ? r.limitations.filter((x): x is string => typeof x === 'string') : [],
      reviewedAt: input.reviewedAt,
      rawOutputRef: input.rawOutputRef,
      outputHash,
      reviewerRef: input.reviewerRef,
      ...(typeof r.confidence === 'number' ? { confidence: r.confidence } : {}),
    });
  }

  return {
    decisions,
    outputHash,
    unanswered: input.expectedSubjectRefs.filter((ref) => !seen.has(ref)),
    unsolicited,
  };
}

/** A decision is signed when it is attributable AND its output is committed. */
export function decisionIsSigned(d: ReviewDecision): boolean {
  return Boolean(
    d.reviewerRef?.trim() &&
      d.rawOutputRef?.trim() &&
      d.outputHash?.trim() &&
      d.reviewedAt?.trim() &&
      (d.reviewerSlot === 'R1' || d.reviewerSlot === 'R2'),
  );
}

export function assertDecisionsSigned(decisions: readonly ReviewDecision[]): void {
  const unsigned = decisions.filter((d) => !decisionIsSigned(d));
  if (unsigned.length > 0) {
    throw new ReviewRefusal(
      'unsigned-decision',
      `${unsigned.length} decision(s) lack attribution or an output commitment ` +
        `(first: ${unsigned[0].subjectRef}). An unsigned decision cannot be audited and is refused.`,
    );
  }
}

export interface ResolveInput {
  reviewId: string;
  subjectRefs: readonly string[];
  r1: readonly ReviewDecision[];
  r2: readonly ReviewDecision[];
  /** The refs R2 was assigned. Rows outside it were single-reviewed by design. */
  r2Coverage: readonly string[];
  resolvedAt: string;
}

/**
 * Fold two passes into one resolution per subject.
 *
 *   both agree, eligible label   → agreed
 *   both agree, `unknown`        → unknown          (fails closed)
 *   both agree, contaminated     → rejected         (agreed exclusion)
 *   they differ                  → contested        (excluded pending resolution)
 *   R1 only, by coverage design  → agreed / unknown / rejected, reason recorded
 *   R1 only, but R2 was assigned → contested        (a missing second pass is
 *                                                    not a passing second pass)
 */
export function resolveDecisions(input: ResolveInput): ReviewResolution[] {
  assertDecisionsSigned([...input.r1, ...input.r2]);

  const r1By = new Map(input.r1.map((d) => [d.subjectRef, d]));
  const r2By = new Map(input.r2.map((d) => [d.subjectRef, d]));
  const covered = new Set(input.r2Coverage);

  const out: ReviewResolution[] = [];
  for (const subjectRef of input.subjectRefs) {
    const a = r1By.get(subjectRef);
    const b = r2By.get(subjectRef);

    if (!a) {
      out.push({
        reviewId: input.reviewId,
        subjectRef,
        status: 'unknown',
        resolutionReason: 'no first-pass decision returned for this row — fails closed',
        resolvedAt: input.resolvedAt,
      });
      continue;
    }

    if (covered.has(subjectRef) && !b) {
      out.push({
        reviewId: input.reviewId,
        subjectRef,
        status: 'contested',
        reviewer1Decision: a.decision,
        resolutionReason:
          'assigned to second review but no second-pass decision was returned; a missing second ' +
          'pass is not a passing second pass',
        resolvedAt: input.resolvedAt,
      });
      continue;
    }

    if (b && b.decision !== a.decision) {
      out.push({
        reviewId: input.reviewId,
        subjectRef,
        status: 'contested',
        // Both verbatim. Nothing is combined, merged, weighted or averaged.
        reviewer1Decision: a.decision,
        reviewer2Decision: b.decision,
        resolutionReason: 'reviewers disagreed — excluded pending governed resolution',
        resolvedAt: input.resolvedAt,
      });
      continue;
    }

    const label = a.decision;
    const status: ReviewResolutionStatus = ELIGIBLE_LABELS.has(label)
      ? 'agreed'
      : label === 'unknown'
        ? 'unknown'
        : 'rejected';

    out.push({
      reviewId: input.reviewId,
      subjectRef,
      status,
      reviewer1Decision: a.decision,
      ...(b ? { reviewer2Decision: b.decision } : {}),
      resolutionReason: b
        ? 'both reviewers returned the same label'
        : 'single-reviewer coverage under the declared coverage rule',
      resolvedAt: input.resolvedAt,
    });
  }
  return out;
}

export interface ResolutionTally {
  agreed: number;
  contested: number;
  rejected: number;
  unknown: number;
  accepted: number;
  deferred: number;
  /** Eligible for local adoption: agreed only. Contested and unknown fail closed. */
  eligibleForLocalAdoption: number;
}

export function tallyResolutions(resolutions: readonly ReviewResolution[]): ResolutionTally {
  const t: ResolutionTally = {
    agreed: 0,
    contested: 0,
    rejected: 0,
    unknown: 0,
    accepted: 0,
    deferred: 0,
    eligibleForLocalAdoption: 0,
  };
  for (const r of resolutions) t[r.status] += 1;
  t.eligibleForLocalAdoption = t.agreed;
  return t;
}

export function contestedQueue(resolutions: readonly ReviewResolution[]): ReviewResolution[] {
  return resolutions.filter((r) => r.status === 'contested');
}

// ── Record-level governed remedy (operator ruling, 2026-08-02) ───────────────

/**
 * The steward's remedy for ONE contested row.
 *
 * ── Why this is not free-form ──────────────────────────────────────────────
 *
 * A contested row is a fact about the evidence: two reviewers looked at the
 * same subject and returned different labels. The remedy resolves the DISPUTE;
 * it does not create a new finding. So the steward may only ratify a label a
 * reviewer actually returned — never a third one of their own.
 *
 * Allowing an invented label would be strictly worse than averaging, which
 * this module already refuses: an average is at least derived from the
 * evidence, whereas a label no reviewer gave has no evidentiary basis at all,
 * and would be indistinguishable in the artifact from one that did.
 *
 * `defer` is the honest option when neither label can be ratified. It is not a
 * silent no-op — it records who deferred and why, so a deferred row is
 * visibly unresolved rather than quietly forgotten.
 */
export interface ContestedRemedy {
  /** `adopt` ratifies one of the reviewers' labels; `defer` ratifies neither. */
  remedy: 'adopt' | 'defer';
  /** Required for `adopt`, forbidden for `defer`. Must be a label a reviewer returned. */
  operatorDecision?: string;
  /** Free text. Required — an unreasoned remedy is a stray click in the artifact. */
  reason: string;
  /** Attribution commitment (`personaPublicRef`), never a raw persona id. */
  resolvedByRef: string;
  resolvedAt: string;
}

/**
 * Apply a remedy to a contested resolution, returning the NEW resolution.
 *
 * Pure: takes the current row, returns the next one. It never mutates, never
 * reads the store, and never writes a receipt — the caller owns persistence,
 * so this rule can be exercised directly by a test with no database.
 *
 * The adopted label's eligibility is read from the SAME `ELIGIBLE_LABELS` set
 * `resolveDecisions` uses for agreed rows. A ratified 'independent' therefore
 * lands on exactly the status an agreed 'independent' would, and the two can
 * never drift apart into "eligible when both reviewers said it, ineligible
 * when the steward ratified it".
 */
export function resolveContestedRecord(
  current: ReviewResolution,
  remedy: ContestedRemedy,
): ReviewResolution {
  if (current.status !== 'contested') {
    throw new ReviewRefusal(
      'record-not-contested',
      `${current.subjectRef} is '${current.status}', not 'contested'. Only a row in dispute has a dispute to remedy; ` +
        `re-deciding a settled row would overwrite a reviewer's finding with the steward's.`,
    );
  }
  const reason = (remedy.reason ?? '').trim();
  if (!reason) {
    throw new ReviewRefusal(
      'unreasoned-record-resolution',
      `a governed remedy for ${current.subjectRef} requires a stated reason`,
    );
  }
  if (!remedy.resolvedByRef) {
    throw new ReviewRefusal(
      'unattributed-record-resolution',
      `a governed remedy for ${current.subjectRef} requires an attributable steward reference`,
    );
  }

  if (remedy.remedy === 'defer') {
    return {
      ...current,
      status: 'deferred',
      // The dispute is preserved verbatim. Deferring records that no label was
      // ratified — it must not erase which labels were in contention.
      operatorDecision: undefined,
      resolutionReason: `deferred by ${remedy.resolvedByRef}: ${reason}`,
      resolvedAt: remedy.resolvedAt,
    };
  }

  const label = (remedy.operatorDecision ?? '').trim();
  const returned = [current.reviewer1Decision, current.reviewer2Decision].filter(
    (d): d is string => typeof d === 'string' && d.length > 0,
  );
  if (!label || !returned.includes(label)) {
    throw new ReviewRefusal(
      'unsupported-operator-label',
      `${JSON.stringify(label)} was not returned by any reviewer for ${current.subjectRef} ` +
        `(they returned ${returned.map((d) => JSON.stringify(d)).join(' and ') || 'nothing'}). ` +
        `A remedy ratifies one of the labels in dispute; it does not introduce a new finding.`,
    );
  }

  return {
    ...current,
    status: ELIGIBLE_LABELS.has(label) ? 'accepted' : 'rejected',
    operatorDecision: label,
    resolutionReason: `ratified by ${remedy.resolvedByRef}: ${reason}`,
    resolvedAt: remedy.resolvedAt,
  };
}
