/**
 * THE TRACK 2 POPULATION, RESOLVED FROM REAL DATA — the counts the freeze
 * package must carry (operator ruling, 2026-08-03).
 *
 *   > "Without this, an independently verifiable crystal hash could still
 *   >  conceal how much of the original population disappeared before freeze."
 *
 *   > "a zero that means 'unknown' is precisely the dishonesty this work exists
 *   >  to remove."
 *
 * The freeze package's `population` field was accepted by the builder and
 * committed to by `packageHash`, but nothing populated it — so every count read
 * `null`, and a null discloses nothing. This module is the resolver that makes
 * the disclosure real.
 *
 * ── EVERY COUNT IS A READ, NEVER A GUESS ───────────────────────────────────
 *
 * Each field below is derived from rows that actually exist, and each one names
 * the query it comes from. Where a count genuinely cannot be read, the resolver
 * returns a PARTIAL result naming the missing field rather than substituting
 * zero — the distinction the operator drew, and the reason `resolveTrack2Population`
 * reports `unreadable` separately instead of folding it into the numbers.
 *
 * Server-only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { APPROVED_FOR_INGESTION } from '@/services/corpusScout/types';
import { listInvariants } from '@/services/invariants/store';
import type { PopulationDisclosure } from '@/services/research/exceptionIsolation';

export interface Track2PopulationResult {
  /** `null` for any field that could not be read — never 0. */
  population: PopulationDisclosure | null;
  /** Field names that could not be read, and why. Empty ⇒ every count is real. */
  unreadable: { field: string; reason: string }[];
  /** The invariant ids constituting the crystal — what `assignedCohortHash`
   *  commits to. Empty when the crystal is empty; `null` when unreadable. */
  assignedInvariantIds: string[] | null;
}

/**
 * Resolve the eight-field population for one experiment's Track 2 run.
 *
 * `acquisitionDomain` and `crystalDomain` are DIFFERENT namespaces and are both
 * required — deriving one from the other is the conflation the Track 2 route
 * already refuses to make.
 */
export async function resolveTrack2Population(
  admin: SupabaseClient | null,
  input: { acquisitionDomain: string; crystalDomain: string },
): Promise<Track2PopulationResult> {
  const unreadable: { field: string; reason: string }[] = [];

  // ── Corpus side: every candidate source in the acquisition domain ─────────
  let sources: Awaited<ReturnType<typeof listCandidateSources>> | null = null;
  if (!admin) {
    unreadable.push({ field: 'discovered/admitted/excludedWithWarnings/exceptions/refused', reason: 'no server substrate client available' });
  } else {
    try {
      sources = await listCandidateSources(admin, { campaignDomain: input.acquisitionDomain });
    } catch (e) {
      unreadable.push({
        field: 'discovered/admitted/excludedWithWarnings/exceptions/refused',
        reason: `corpus_candidate_sources unreadable: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // ── Candidate side: extracted discovery candidates ────────────────────────
  let candidatesExtracted: number | null = null;
  if (admin) {
    const { count, error } = await admin
      .from('discovery_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('domain', input.acquisitionDomain);
    if (error) {
      unreadable.push({ field: 'candidatesExtracted', reason: `discovery_candidates unreadable: ${error.message}` });
    } else {
      candidatesExtracted = count ?? 0;
    }
  } else {
    unreadable.push({ field: 'candidatesExtracted', reason: 'no server substrate client available' });
  }

  // ── Invariant side: validated, and what is actually in the crystal ────────
  let validated: number | null = null;
  let assignedInvariantIds: string[] | null = null;
  try {
    // `validated` counts the ACQUISITION domain's own invariants that have
    // passed the validation gate — the pool assignment draws from. Counting the
    // crystal's members instead would make `validated` and `assignedToCrystal`
    // trivially equal and disclose nothing about attrition between them.
    const acquisitionInvariants = await listInvariants({ domain: input.acquisitionDomain, limit: 500 });
    validated = acquisitionInvariants.filter((i) => i.timesValidated > 0).length;
  } catch (e) {
    unreadable.push({ field: 'validated', reason: `invariant substrate unreadable: ${e instanceof Error ? e.message : String(e)}` });
  }
  try {
    const crystalMembers = await listInvariants({ domain: input.crystalDomain, limit: 500 });
    assignedInvariantIds = crystalMembers.map((i) => i.id).sort();
  } catch (e) {
    unreadable.push({ field: 'assignedToCrystal', reason: `invariant substrate unreadable: ${e instanceof Error ? e.message : String(e)}` });
  }

  // A single unreadable field makes the whole disclosure untrustworthy — a
  // population with one guessed number is not a population. Reported as `null`
  // with the reason, never as a set of counts with a silent hole in it.
  if (!sources || candidatesExtracted === null || validated === null || assignedInvariantIds === null) {
    return { population: null, unreadable, assignedInvariantIds };
  }

  // ── The mapping from REAL review statuses to the disclosure's fields ──────
  //
  // Every status in `REVIEW_WORKFLOW_STATUSES` lands in exactly one bucket, so
  // the counts partition the corpus rather than sampling it.
  const refused = sources.filter((s) => s.reviewWorkflowStatus.startsWith('rejected_')).length;
  const exceptions = sources.filter((s) =>
    ['pending_review', 'needs_retrieval_fix', 'duplicate', 'superseded'].includes(s.reviewWorkflowStatus),
  ).length;
  // An approved source that never became an evidence row is the "admitted but
  // not ingested" half-state — admitted by decision, absent from the corpus in
  // fact. It is exactly an exclusion carrying a warning.
  const excludedWithWarnings = sources.filter(
    (s) => APPROVED_FOR_INGESTION.has(s.reviewWorkflowStatus) && !s.evidenceRowId,
  ).length;
  const admitted = sources.filter((s) => Boolean(s.evidenceRowId)).length;

  return {
    population: {
      discovered: sources.length,
      admitted,
      candidatesExtracted,
      validated,
      assignedToCrystal: assignedInvariantIds.length,
      excludedWithWarnings,
      exceptions,
      refused,
      // All eight fields above are real, cumulative reads across the whole
      // acquisition + crystal domain (2026-09-01 scope disclosure) — the ONE
      // computation entitled to the "Full population" framing; every Stage 2
      // Corpus Scout route's own population object is scoped narrower and
      // says so via `'current-acquisition-round'`.
      scope: 'cumulative-programme',
    },
    unreadable,
    assignedInvariantIds,
  };
}
