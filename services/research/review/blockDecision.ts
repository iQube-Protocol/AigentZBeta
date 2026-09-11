/**
 * Governed block decisions.
 *
 * A block decision is how a large, homogeneous population enters a review
 * without being adjudicated row by row — and the only honest way to do that is
 * to make the exceptions visible. "Approved because they're all in the right
 * namespaces" is not a block decision; it is a namespace filter with a ruling
 * attached to it.
 *
 * So this module refuses to produce a block decision that could only ever admit
 * everything:
 *
 *   - a block with NO exception rules is refused outright (`buildBlockDecision`
 *     throws), because a ruling with no way to fail is an assertion, not a
 *     decision;
 *   - the admitted count is COMPUTED as `assessed - extracted.length` and can
 *     be arithmetically checked by any reader of the artifact;
 *   - the representative sample is drawn per namespace from a committed seed,
 *     so the rows a human is asked to look at cover the shape of the population
 *     rather than its most common corner.
 *
 * The sampling design has one deliberate property worth stating: where a
 * population contains a sub-group whose doctrine was derived from observed
 * defects in the very pipeline under evaluation, that sub-group is where the
 * exceptions live. A sample that draws proportionally from the whole population
 * would return mostly the innocuous majority. Drawing per NAMESPACE guarantees
 * every doctrinal area is represented, including the small ones most likely to
 * be contaminated — the sample can surface them instead of smoothing over them.
 */

import { commit, stratifiedSample } from './deterministic';
import {
  ReviewRefusal,
  type BlockDecision,
  type BlockDecisionRuling,
  type BlockException,
  type BlockExceptionRule,
  type ReviewSubjectRecord,
} from './types';

// ── Reusable exception-rule constructors ────────────────────────────────────
//
// The RULES are generic; the terms, cutoffs and flags they close over come from
// a review template. That split is what keeps the capability reusable: a second
// experiment supplies its own vocabulary and inherits the machinery.

/** Any of `terms` (case-insensitive) appears in the statement or its refs. */
export function mentionsAnyTerm(ruleId: string, reason: string, terms: readonly string[]): BlockExceptionRule {
  const lowered = terms.map((t) => t.toLowerCase());
  return {
    ruleId,
    reason,
    test: (r) => {
      const hay = `${r.statement} ${r.sourceRefs.join(' ')} ${r.derivationRefs.join(' ')}`.toLowerCase();
      return lowered.some((t) => hay.includes(t));
    },
  };
}

/** Created or revised on/after a cutoff — the recent-edit mechanical flag. */
export function createdOrRevisedOnOrAfter(ruleId: string, reason: string, cutoffIso: string): BlockExceptionRule {
  return {
    ruleId,
    reason,
    test: (r) => String(r.createdAt) >= cutoffIso || (r.revisedAt !== null && String(r.revisedAt) >= cutoffIso),
  };
}

/**
 * Chronology or provenance that cannot be resolved from the record itself.
 *
 * This is the rule people are tempted to drop, because it fires on rows that
 * look fine. It fires precisely because they cannot be shown to be fine: a row
 * with no source refs and no derivation refs is a claim about its own
 * independence with nothing behind it.
 *
 * Deliberately does NOT test `sourceProvenance === null` (removed 2026-07-30
 * — the vP1 preview showed this single disjunct extracting all 402 Class C
 * rows, since most predate a provenance-CLASS tagging convention that was
 * never retrofitted onto them; that defeated the governed block ruling
 * entirely, which is the opposite of what a block decision is for). A
 * missing provenance-class LABEL is not the same fact as missing chronology
 * or provenance evidence — a row can have real `sourceRefs`/`derivationRefs`
 * and a real `createdAt` while nobody has yet tagged which provenance class
 * it falls into. The ratified block ruling supplies the population's default
 * chronology/provenance basis; this rule extracts only rows where the record
 * ITSELF cannot establish when or how it arose — no creation date, or
 * neither a source nor a derivation trail — which the block ruling does not
 * and cannot resolve on their behalf.
 */
export function unresolvedChronologyOrProvenance(ruleId: string, reason: string): BlockExceptionRule {
  return {
    ruleId,
    reason,
    test: (r) => !r.createdAt || (r.sourceRefs.length === 0 && r.derivationRefs.length === 0),
  };
}

/** Rows a prior sample review flagged. Named refs, not a heuristic. */
export function flaggedBySampleReview(ruleId: string, reason: string, refs: readonly string[]): BlockExceptionRule {
  const set = new Set(refs);
  return { ruleId, reason, test: (r) => set.has(r.subjectRef) };
}

// ── The block decision itself ───────────────────────────────────────────────

export interface BuildBlockDecisionInput {
  blockId: string;
  ruling: BlockDecisionRuling;
  /** The exact query that defines the population — recorded verbatim. */
  populationQuery: string;
  population: readonly ReviewSubjectRecord[];
  exceptionRules: readonly BlockExceptionRule[];
  /** Whether task construction had begun when the package was built. */
  taskConstructionBegun: boolean;
  taskConstructionEvidence: string;
  sampleSeed: string;
  samplePerNamespace: number;
}

export function buildBlockDecision(input: BuildBlockDecisionInput): BlockDecision {
  if (input.exceptionRules.length === 0) {
    throw new ReviewRefusal(
      'block-decision-without-exceptions',
      `block '${input.blockId}' declares no exception rules. A block ruling that cannot extract ` +
        'anything admits its whole population unconditionally, which is an assertion rather than ' +
        'a decision. Declare the conditions under which a row leaves the block.',
    );
  }
  if (!input.ruling.text.trim()) {
    throw new ReviewRefusal('block-ruling-missing-text', `block '${input.blockId}' has no ruling text recorded verbatim`);
  }
  if (input.population.length === 0) {
    throw new ReviewRefusal('block-decision-empty-population', `block '${input.blockId}' has an empty population`);
  }

  const extracted: BlockException[] = [];
  for (const record of input.population) {
    const hits = input.exceptionRules.filter((rule) => rule.test(record));
    if (hits.length > 0) {
      extracted.push({
        subjectRef: record.subjectRef,
        ruleIds: hits.map((h) => h.ruleId),
        reasons: hits.map((h) => h.reason),
      });
    }
  }

  const namespaceCounts: Record<string, number> = {};
  const createdAtCounts: Record<string, number> = {};
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const r of input.population) {
    namespaceCounts[r.namespace] = (namespaceCounts[r.namespace] ?? 0) + 1;
    const day = String(r.createdAt).slice(0, 10);
    createdAtCounts[day] = (createdAtCounts[day] ?? 0) + 1;
    if (r.createdAt) {
      if (earliest === null || r.createdAt < earliest) earliest = r.createdAt;
      if (latest === null || r.createdAt > latest) latest = r.createdAt;
    }
  }

  const representativeSample = stratifiedSample(
    input.sampleSeed,
    input.population.map((r) => ({ key: r.subjectRef, stratum: r.namespace })),
    input.samplePerNamespace,
  );

  const assessed = input.population.length;
  // COMPUTED, never defaulted. A zero-exception outcome must be the arithmetic
  // result of running every rule over every row — the canary asserts this by
  // making a rule fire and checking the count moves.
  const admitted = assessed - extracted.length;

  return {
    blockId: input.blockId,
    ruling: input.ruling,
    populationQuery: input.populationQuery,
    assessed,
    admitted,
    extracted,
    namespaceCounts,
    createdAtCounts,
    earliestCreatedAt: earliest,
    latestCreatedAt: latest,
    taskConstructionBegun: input.taskConstructionBegun,
    taskConstructionEvidence: input.taskConstructionEvidence,
    representativeSample,
    sampleSeed: input.sampleSeed,
    samplePerNamespace: input.samplePerNamespace,
    appliedRuleIds: input.exceptionRules.map((r) => r.ruleId),
  };
}

/** The reportable line, in the operator's requested shape. */
export function formatBlockDecision(b: BlockDecision): string {
  return [
    `Block population:     ${b.assessed}`,
    `Block ruling:         ${b.ruling.rulingId} v${b.ruling.rulingVersion}`,
    `Authority:            ${b.ruling.authority}`,
    `Extracted exceptions: ${b.extracted.length}`,
    `Final admitted count: ${b.admitted}  (= ${b.assessed} minus ${b.extracted.length} extracted)`,
    `Result:               ${b.assessed} assessed under the block rule → ${b.admitted} admitted through the ` +
      `class decision → ${b.extracted.length} flagged for individual review`,
  ].join('\n');
}

/**
 * Extraction counts per rule, plus how many rows were extracted by more than
 * one rule at once (an overlap) — added 2026-07-30 so a block decision's
 * result is legible rule-by-rule rather than one aggregate "extracted" count
 * that could hide a single over-broad rule doing all the work.
 */
export function blockExtractionByRule(b: BlockDecision): { byRule: Record<string, string[]>; multiRuleCount: number } {
  const byRule: Record<string, string[]> = {};
  for (const ruleId of b.appliedRuleIds) byRule[ruleId] = [];
  let multiRuleCount = 0;
  for (const e of b.extracted) {
    for (const ruleId of e.ruleIds) byRule[ruleId]?.push(e.subjectRef);
    if (e.ruleIds.length > 1) multiRuleCount += 1;
  }
  return { byRule, multiRuleCount };
}

/** Arithmetic self-check, exported so a reader can verify an artifact. */
export function blockDecisionIsArithmeticallySound(b: BlockDecision): boolean {
  return b.admitted === b.assessed - b.extracted.length && b.admitted >= 0;
}

export function blockDecisionCommitment(b: BlockDecision): string {
  return commit({
    blockId: b.blockId,
    ruling: b.ruling,
    populationQuery: b.populationQuery,
    assessed: b.assessed,
    admitted: b.admitted,
    extracted: b.extracted,
    appliedRuleIds: b.appliedRuleIds,
    sampleSeed: b.sampleSeed,
    representativeSample: b.representativeSample,
  });
}
