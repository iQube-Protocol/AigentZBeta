/**
 * RELATIONSHIP COHORT PREPARATION — Track 2 Stage 7's "Add Relationships"
 * bulk-preparation step (2026-09-05), built to the same shape as Stage 5's
 * `services/research/provenanceCohortPreparation.ts` (mirrors its
 * disposition/exception vocabulary and `computeCohortHash`-bound
 * ratification pattern). Never a parallel authority: every write this
 * module's output feeds still runs through `addEdge()` (services/invariants/
 * lifecycle.ts) with every one of its existing refusals (cycle guard,
 * canonical quarantine) intact.
 *
 * ── Why this exists (operator audit, 2026-09-05) ────────────────────────────
 *
 * Stage 7's only batch action was "Accept All High-Confidence (>95%)" — a
 * bare LLM self-reported percentage (`services/invariants/
 * relationshipSuggestion.ts`'s own doc comment: "the model's own estimate —
 * advisory, never a measured probability") gating a batch write, with no
 * calibration anywhere in this codebase and no ratified governance criterion
 * for 95 specifically found in any resolution record, candidate invariant,
 * or CFS/PRD document. Stage 5 already replaced its own equivalent dead
 * control with a data-calibrated, count-based cohort board
 * (`ProvenanceCohortRatificationBoard` / `provenanceCohortPreparation.ts`,
 * 2026-09-03) that NEVER gates disposition on confidence — "full stop,
 * regardless of confidence." This module gives Stage 7 the same treatment:
 * confidence is carried through for the steward's own reading, never as the
 * eligibility test.
 *
 * ── What is isolated as an exception, and why, deterministically ───────────
 *
 *   no-candidates          — fewer than one other crystal member exists to
 *                            relate to.
 *   no-suggestions         — `suggestRelationships` produced zero candidates
 *                            (model error, or genuinely none proposed).
 *   no-writable-suggestion — every proposed suggestion is either a
 *                            `contradicts` edge (never auto-accepted — a
 *                            genuine logical conflict is always a steward's
 *                            call, mirroring the retired batch's own
 *                            `NEVER_AUTO_ACCEPT_TYPE` rule) or would create a
 *                            cycle in an acyclic edge type. Isolated for
 *                            individual review rather than silently skipped.
 */

import { suggestRelationships, type RelationshipSuggestion } from '@/services/invariants/relationshipSuggestion';
import { wouldCreateCycle } from '@/services/invariants';
import type { InvariantEdgeType } from '@/types/invariants';

export type RelationshipRecommendationDisposition = 'ready' | 'exception';

export type RelationshipExceptionCause = 'no-candidates' | 'no-suggestions' | 'no-writable-suggestion';

export const RELATIONSHIP_EXCEPTION_LABEL: Record<RelationshipExceptionCause, string> = {
  'no-candidates': 'No other crystal members exist to relate to',
  'no-suggestions': 'A relationship suggestion could not be produced',
  'no-writable-suggestion': 'Every suggested relationship is a contradicts edge or would create a cycle',
};

/** ONE invariant's proposed relationship disposition. Never asserts a
 *  relation for an exception — the related-invariant/type/rationale fields
 *  are populated ONLY for `disposition: 'ready'`. */
export interface RelationshipCandidateRecommendation {
  invariantId: string;
  label: string;
  disposition: RelationshipRecommendationDisposition;
  relatedInvariantId: string | null;
  relatedLabel: string | null;
  relationType: InvariantEdgeType | null;
  rationale: string | null;
  /** 0-100. The model's own estimate — advisory, never a measured
   *  probability, and NEVER the eligibility gate (see this module's own
   *  header). Informational only, for the steward's own reading. */
  confidence: number | null;
  /** Every ranked suggestion the model returned, for the steward to see
   *  alternatives — informational only; ratification writes ONLY the chosen
   *  (first-writable) one above. */
  allSuggestions: RelationshipSuggestion[];
  exceptionCause: RelationshipExceptionCause | null;
  exceptionDetail: string | null;
}

export interface RelationshipCohortPreparation {
  recommendations: RelationshipCandidateRecommendation[];
}

const label = (statement: string): string => (statement.length > 140 ? `${statement.slice(0, 140)}…` : statement);

/** The `ready` subset's invariant ids — what a ratification act writes.
 *  Named the same way `eligibleProvenanceCohortIds` is at Stage 5, so both
 *  cohort flows read identically at a glance. */
export function eligibleRelationshipCohortIds(recs: readonly RelationshipCandidateRecommendation[]): string[] {
  return recs.filter((r) => r.disposition === 'ready').map((r) => r.invariantId);
}

/**
 * Prepare relationship recommendations for a set of orphan invariants.
 * Read-only — writes no edge. For each orphan, calls the EXISTING
 * `suggestRelationships` once (never re-implemented; never a second model-
 * calling path), run concurrently across orphans (mirroring
 * `prepareProvenanceCohort`'s own `Promise.all` fix for the same class of
 * `maxDuration` timeout risk — one orphan's inference latency must not be
 * paid in series with every other orphan's). Its suggestions arrive
 * pre-sorted by confidence (`relationshipSuggestion.ts`'s own contract); this
 * function picks the FIRST that would actually be writable — never a
 * `contradicts` edge, never one that would create a cycle — and isolates the
 * record as an exception when none qualifies. Confidence is carried through
 * for display; it never decides eligibility.
 */
export async function prepareRelationshipCohort(
  orphans: readonly { id: string; statement: string }[],
  members: readonly { id: string; statement: string }[],
): Promise<RelationshipCohortPreparation> {
  const labelById = new Map(members.map((m) => [m.id, label(m.statement)]));

  const recommendations = await Promise.all(
    orphans.map(async (orphan): Promise<RelationshipCandidateRecommendation> => {
      const base = { invariantId: orphan.id, label: label(orphan.statement) };
      const pool = members.filter((m) => m.id !== orphan.id);
      if (pool.length === 0) {
        return {
          ...base,
          disposition: 'exception',
          relatedInvariantId: null, relatedLabel: null, relationType: null, rationale: null, confidence: null,
          allSuggestions: [],
          exceptionCause: 'no-candidates',
          exceptionDetail: 'No other crystal members exist to relate to.',
        };
      }

      const result = await suggestRelationships(
        { id: orphan.id, statement: orphan.statement },
        pool.map((m) => ({ id: m.id, statement: m.statement })),
      );
      if (!result.ok) {
        return {
          ...base,
          disposition: 'exception',
          relatedInvariantId: null, relatedLabel: null, relationType: null, rationale: null, confidence: null,
          allSuggestions: [],
          exceptionCause: 'no-suggestions',
          exceptionDetail: result.error,
        };
      }
      if (result.suggestions.length === 0) {
        return {
          ...base,
          disposition: 'exception',
          relatedInvariantId: null, relatedLabel: null, relationType: null, rationale: null, confidence: null,
          allSuggestions: [],
          exceptionCause: 'no-suggestions',
          exceptionDetail: 'No relationship candidates were proposed for this invariant.',
        };
      }

      for (const s of result.suggestions) {
        // Never auto-accepted — a genuine logical conflict is always a
        // steward's call (mirrors the retired batch's own rule).
        if (s.relationType === 'contradicts') continue;
        const cycle = await wouldCreateCycle(orphan.id, s.relatedInvariantId, s.relationType).catch(() => true);
        if (cycle) continue;
        return {
          ...base,
          disposition: 'ready',
          relatedInvariantId: s.relatedInvariantId,
          relatedLabel: labelById.get(s.relatedInvariantId) ?? s.relatedLabel,
          relationType: s.relationType,
          rationale: s.rationale,
          confidence: s.confidence,
          allSuggestions: result.suggestions,
          exceptionCause: null,
          exceptionDetail: null,
        };
      }
      return {
        ...base,
        disposition: 'exception',
        relatedInvariantId: null, relatedLabel: null, relationType: null, rationale: null, confidence: null,
        allSuggestions: result.suggestions,
        exceptionCause: 'no-writable-suggestion',
        exceptionDetail: 'Every suggested relationship is a contradicts edge or would create a cycle — requires individual steward review.',
      };
    }),
  );

  return { recommendations };
}
