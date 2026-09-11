/**
 * Corpus Scout (PRD-ICA-001 §6/§8/§9) — the ONE place a review decision is
 * applied to a candidate source. Both `POST /api/corpus-scout/candidates/
 * [sourceId]/review` (one source) and `POST /api/corpus-scout/candidates/
 * bulk-review` (many, looped) call this — neither re-implements the decision
 * vocabulary, the mark_duplicate/provenanceClass validation, or the
 * approve-then-ingest sequencing (inv.engineering.036/037).
 *
 * ── The defect this closes (2026-08-03) ─────────────────────────────────────
 *
 * The Track 2 steward queue (`CorpusReviewQueue` in Track2ProgrammePanel.tsx)
 * posts `{ decision, notes }` — never `provenanceClass`. `ingestApprovedSource`
 * requires one and refuses without it. The review route returned `{ ok: true,
 * ingestion: { ok: false, error: '...' } }` — a top-level `ok: true` the client
 * checked, while the actual evidence hand-off silently failed underneath it.
 * Every `approve_exp_p1`/`approve_general_finance` decision through that queue
 * moved the source's `reviewWorkflowStatus` to `approved_*` (so Stage 2's own
 * signals read the source as admitted) while producing NO evidence row — the
 * exact "safe read as finished" failure mode Al named for Stage 5, one stage
 * earlier and previously unnoticed because nothing inspected `ingestion.ok`.
 *
 * Fixed here by REFUSING an admit-and-ingest decision without a
 * provenanceClass, before any write — the same discipline
 * `applyProvenanceReclassification` already applies to invariant
 * reclassification. A caller that still doesn't supply one gets a named
 * refusal instead of a silently swallowed ingestion failure.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCandidateSource, updateCandidateReview } from './provenance';
import { ingestApprovedSource, type IngestApprovedSourceResult } from './ingestionBroker';
import { isProvenanceClass, type CandidateSourceRow, type ReviewWorkflowStatus } from './types';

export type ReviewDecision =
  | 'approve_exp_p1'
  | 'approve_general_finance'
  | 'approve_reference_only'
  | 'reject_out_of_domain'
  | 'reject_low_substance'
  | 'reject_provenance'
  | 'reject_access_or_license'
  | 'mark_duplicate';

/** §9's decision vocabulary → the reviewWorkflowStatus it maps to. The single
 *  authority both routes read — never restated. */
export const DECISION_TO_STATUS: Record<ReviewDecision, ReviewWorkflowStatus> = {
  approve_exp_p1: 'approved_exp_p1',
  approve_general_finance: 'approved_general_finance',
  approve_reference_only: 'approved_reference_only',
  reject_out_of_domain: 'rejected_out_of_domain',
  reject_low_substance: 'rejected_low_substance',
  reject_provenance: 'rejected_provenance',
  reject_access_or_license: 'rejected_access_or_license',
  mark_duplicate: 'duplicate',
};

/** The two decisions PRD-ICA-001 §6/§11 hand to the Ingestion Broker. Derived
 *  from the same map `DECISION_TO_STATUS` declares, never a second list. */
export const INGESTING_DECISIONS: ReadonlySet<ReviewDecision> = new Set(['approve_exp_p1', 'approve_general_finance']);

export function isReviewDecision(v: unknown): v is ReviewDecision {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DECISION_TO_STATUS, v);
}

export interface ApplyReviewDecisionInput {
  decision: string;
  notes?: string;
  provenanceClass?: string;
  duplicateOfSourceId?: string;
}

export type ApplyReviewDecisionResult =
  | { ok: true; candidate: CandidateSourceRow; ingestion?: IngestApprovedSourceResult }
  | { ok: false; error: string };

/**
 * Validate and apply ONE review decision. Refuses (never throws) on:
 *   - an unrecognised decision;
 *   - `mark_duplicate` with no `duplicateOfSourceId`;
 *   - a `provenanceClass` that isn't one of the five ratified values;
 *   - an admit-and-ingest decision (`approve_exp_p1`/`approve_general_finance`)
 *     with no `provenanceClass` — the pre-check this module exists to add
 *     (see the module doc). `approve_reference_only` does not ingest, so it
 *     is not gated on this.
 *   - the source not existing.
 *
 * On an admit-and-ingest decision, `ingestApprovedSource` runs as the final
 * step and its outcome is returned as `ingestion` — the caller MUST inspect
 * `ingestion.ok`, never infer success from the outer `ok: true` alone (that
 * reports the DECISION was recorded, not that ingestion succeeded).
 */
export async function applyCandidateReviewDecision(
  admin: SupabaseClient,
  sourceId: string,
  input: ApplyReviewDecisionInput,
  personaId: string,
): Promise<ApplyReviewDecisionResult> {
  if (!isReviewDecision(input.decision)) {
    return { ok: false, error: `decision must be one of: ${Object.keys(DECISION_TO_STATUS).join(', ')}` };
  }
  if (input.decision === 'mark_duplicate' && !input.duplicateOfSourceId?.trim()) {
    return { ok: false, error: 'duplicateOfSourceId is required for mark_duplicate' };
  }
  if (input.provenanceClass !== undefined && !isProvenanceClass(input.provenanceClass)) {
    return { ok: false, error: `provenanceClass must be one of the five ratified values (got '${input.provenanceClass}')` };
  }
  const willIngest = INGESTING_DECISIONS.has(input.decision);
  if (willIngest && !input.provenanceClass) {
    return {
      ok: false,
      error:
        `provenanceClass is required for '${input.decision}' — the Ingestion Broker refuses to ingest without ` +
        'one (PRD-ICA-001 §0.3), and admitting the source without it would silently fail the hand-off this ' +
        'decision claims to make',
    };
  }

  const existing = await getCandidateSource(admin, sourceId);
  if (!existing) return { ok: false, error: `candidate source '${sourceId}' not found` };

  const reviewWorkflowStatus = DECISION_TO_STATUS[input.decision];
  const updateResult = await updateCandidateReview(admin, sourceId, {
    reviewWorkflowStatus,
    humanReviewNotes: input.notes,
    provenanceClass: input.provenanceClass,
    duplicateOfSourceId: input.decision === 'mark_duplicate' ? input.duplicateOfSourceId : undefined,
  });
  if (!updateResult.ok || !updateResult.candidate) return { ok: false, error: updateResult.error ?? 'update failed' };

  if (!willIngest) return { ok: true, candidate: updateResult.candidate };

  const ingestion = await ingestApprovedSource(admin, sourceId, personaId);
  const finalCandidate = ingestion.ok ? await getCandidateSource(admin, sourceId) : updateResult.candidate;
  return { ok: true, candidate: finalCandidate ?? updateResult.candidate, ingestion };
}
