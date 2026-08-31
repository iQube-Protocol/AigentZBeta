/**
 * Track 2 Stage 7 ("add-relationships") — the durable "reviewed, no
 * defensible edge" fact (operator report, 2026-08-31, "a crystal member may
 * legitimately have zero relationships").
 *
 * ── THE INVARIANT THIS MODULE SERVES ────────────────────────────────────────
 *
 * Stage 7 must distinguish three states for a cohort member:
 *   1. unreviewed orphan       — no edge, no adjudication.
 *   2. reviewed orphan         — no edge, but a STILL-VALID adjudication
 *                                 records that review completed with nothing
 *                                 warranting admission.
 *   3. related member          — at least one admitted intra-crystal edge.
 * Both (2) and (3) satisfy Stage 7; only (1) remains pending. This module
 * supplies the read (`getValidNoDefensibleEdgeInvariantIds`) that
 * `services/research/populationReconciliation.ts::reconcilePromotedCohort`
 * folds into its existing edge-degree computation, and the write
 * (`recordNoDefensibleEdgeAdjudication`) the steward's explicit "confirm no
 * relationship" act calls — never store `stage_complete = true`; store the
 * fact, and let Stage 7 re-derive from it every time, exactly like every
 * other Track 2 signal.
 *
 * ── WHY A FINGERPRINT, NOT A FLAG ────────────────────────────────────────────
 *
 * `suggestRelationships` draws its candidate pool from the crystal's OTHER
 * current members. When the cohort changes, the space of possible
 * relationships for an already-adjudicated member has genuinely changed —
 * new evidence a prior verdict never considered. `computeCohortFingerprint`
 * is a deterministic hash of the cohort's member ids; an adjudication is
 * still valid only while the CURRENT cohort hashes to the same value it did
 * at adjudication time. A mismatch reopens the member to review automatically
 * — no explicit "reopen" action, no superseded/expiry bookkeeping, no model
 * call: a plain string comparison. History is never rewritten; a fresh
 * confirmation after a cohort change is simply a new row.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'crystal_relationship_adjudications';

export type RelationshipAdjudicationDisposition = 'no-defensible-edge';

/** Deterministic — same cohort membership always hashes the same, regardless of read order. */
export function computeCohortFingerprint(memberIds: readonly string[]): string {
  return createHash('sha256')
    .update('track2:cohort:' + [...memberIds].sort().join(','))
    .digest('hex')
    .slice(0, 16);
}

/**
 * The set of invariant ids, among `cohortMemberIds`, whose MOST RECENT
 * 'no-defensible-edge' adjudication was reached under the SAME cohort
 * composition as today — i.e. still valid. Rows for a member whose latest
 * adjudication predates a cohort change are simply excluded (stale — the
 * member reverts to unreviewed-orphan), never mutated or deleted.
 * Fails closed to an empty set on any read error — an unreadable adjudication
 * log must never silently satisfy Stage 7.
 */
export async function getValidNoDefensibleEdgeInvariantIds(
  admin: SupabaseClient,
  input: { experimentId: string; cohortMemberIds: readonly string[] },
): Promise<Set<string>> {
  if (input.cohortMemberIds.length === 0) return new Set();
  const currentFingerprint = computeCohortFingerprint(input.cohortMemberIds);

  const { data, error } = await admin
    .from(TABLE)
    .select('invariant_id, cohort_fingerprint, adjudicated_at')
    .eq('experiment_id', input.experimentId)
    .eq('disposition', 'no-defensible-edge')
    .in('invariant_id', [...input.cohortMemberIds])
    .order('adjudicated_at', { ascending: false });
  if (error || !data) return new Set();

  const seen = new Set<string>();
  const valid = new Set<string>();
  for (const row of data as { invariant_id: string; cohort_fingerprint: string }[]) {
    // Rows arrive newest-first, so the first time we see a given invariant_id
    // IS its latest adjudication — every subsequent row for the same id is
    // older history, kept for the record but not consulted here.
    if (seen.has(row.invariant_id)) continue;
    seen.add(row.invariant_id);
    if (row.cohort_fingerprint === currentFingerprint) valid.add(row.invariant_id);
  }
  return valid;
}

/**
 * THE STEWARD ACT — records that this member's relationship candidates were
 * reviewed and none warranted admission, under the cohort as it exists right
 * now. `cohortMemberIds` MUST be the caller's own server-resolved cohort
 * (never client-supplied) so the fingerprint cannot be spoofed to force a
 * false "still valid" read later.
 */
export async function recordNoDefensibleEdgeAdjudication(
  admin: SupabaseClient,
  input: {
    experimentId: string;
    crystalDomain: string;
    invariantId: string;
    cohortMemberIds: readonly string[];
    adjudicatedByPersonaId: string;
    reviewedCandidateIds?: readonly string[];
  },
): Promise<
  | { ok: true; adjudication: { id: string; cohortFingerprint: string; adjudicatedAt: string } }
  | { ok: false; error: string }
> {
  const cohortFingerprint = computeCohortFingerprint(input.cohortMemberIds);
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      experiment_id: input.experimentId,
      crystal_domain: input.crystalDomain,
      invariant_id: input.invariantId,
      disposition: 'no-defensible-edge',
      cohort_fingerprint: cohortFingerprint,
      reviewed_candidate_ids: [...(input.reviewedCandidateIds ?? [])],
      adjudicated_by_persona_id: input.adjudicatedByPersonaId,
    })
    .select('id, cohort_fingerprint, adjudicated_at')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'adjudication could not be written' };
  return {
    ok: true,
    adjudication: {
      id: data.id as string,
      cohortFingerprint: data.cohort_fingerprint as string,
      adjudicatedAt: data.adjudicated_at as string,
    },
  };
}
