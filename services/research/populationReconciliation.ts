/**
 * Population Reconciliation — turning "N record(s) unaccounted for" into
 * named, individually-treatable records (operator direction via Aletheon,
 * 2026-08-04).
 *
 *   > "The current recommendation says 'resolve the promoted candidates that
 *   >  carry no invariant id, or record them as explicit exclusions with a
 *   >  reason.' That is a navigation instruction disguised as a remedy."
 *
 * ── What this replaces ───────────────────────────────────────────────────────
 *
 * The route's old `resolvePromotedCohort` (app/api/research/track2/
 * [experimentId]/route.ts, until 2026-08-04) counted a promoted candidate as
 * "excluded" the moment its `promoted_invariant_id` was missing or
 * unresolvable — an AUTOMATIC classification with no operator act behind it,
 * and one that silently dropped a THIRD case entirely: two candidates can
 * legitimately resolve to the SAME invariant (`promoteCandidate`'s own
 * `resolvedAs: 'already-exists'` rediscovery path, services/invariants/
 * discoveryEngine.ts), and the second one vanished from every count — neither
 * in `invariantIds` (deduplicated) nor in `excluded` (its id WAS found, just
 * via a different candidate). That is very likely the live symptom itself:
 * "17 declared, 15 received, 0 excluded, 2 unaccounted."
 *
 * ── The model now ────────────────────────────────────────────────────────────
 *
 * `excluded` counts ONLY operator-confirmed exclusions
 * (`CandidateRow.crystalExclusion` — a steward acted, through the
 * Population Reconciliation Board). Every OTHER promoted candidate that is
 * not a distinct, resolved crystal member is named individually in
 * `unaccountedRecords`, classified by its actual defect, and — where a
 * deterministic repair exists — told what that repair is, never left as a
 * navigation instruction.
 */

import { getInvariantsByIds } from '@/services/invariants/store';
import { discoveryNamespace } from '@/services/invariants/discoveryDomains';
import { findDuplicates } from '@/services/invariants/comparison';
import type { CandidateRow } from '@/services/invariants/discoveryEngine';

/** WHY a promoted candidate is not (yet) a distinct crystal member. */
export type UnaccountedDefect =
  | 'missing-invariant-id'
  | 'unresolvable-invariant-id'
  | 'duplicate-invariant-id';

export type RecommendedTreatment = 'repair' | 'exclude';

/**
 * ONE unaccounted promoted candidate, named and classified — never an
 * aggregate count (al, 2026-08-04: "Do not show only aggregate counts.").
 */
export interface UnaccountedPromotionRecord {
  candidateId: string;
  /** Truncated statement — enough to recognise the record, never the full text pretending to be a title. */
  label: string;
  domain: string;
  subDomain: string | null;
  evidenceCount: number;
  /** The invariant id this candidate's promotion recorded, if any (may be unresolvable or a duplicate). */
  promotedInvariantId: string | null;
  defect: UnaccountedDefect;
  /** Set only for `duplicate-invariant-id` — the candidate that already claims this same invariant. */
  duplicateOfCandidateId: string | null;
  /**
   * The invariant a deterministic repair would attach, if one was actually
   * found (exact-statement match via `findDuplicates`) — never asserted,
   * only what was found. `null` means no deterministic repair exists for
   * THIS record; the board must mark it "steward judgment required".
   */
  deterministicRepairInvariantId: string | null;
  recommendedTreatment: RecommendedTreatment;
  /** The exact reason and, when repairable, the exact recommended act — never a place to go look. */
  recommendedReason: string;
}

export interface ReconciledPromotedCohort {
  /** The invariants Stage 4 actually promoted, deduplicated — resolved through promoted_invariant_id. */
  invariantIds: string[];
  unclassified: number;
  unvalidated: number;
  graph: { relationshipCount: number; orphanCount: number } | null;
  /** OPERATOR-CONFIRMED exclusions only — see this module's own header. */
  excluded: { recordId: string; reason: string }[];
  /** Every promoted candidate that is neither a distinct resolved member nor an operator-confirmed exclusion. */
  unaccountedRecords: UnaccountedPromotionRecord[];
}

function labelFor(statement: string): string {
  return statement.length > 140 ? `${statement.slice(0, 140)}…` : statement;
}

function baseRecord(c: CandidateRow): Omit<UnaccountedPromotionRecord, 'defect' | 'duplicateOfCandidateId' | 'deterministicRepairInvariantId' | 'recommendedTreatment' | 'recommendedReason'> {
  return {
    candidateId: c.id,
    label: labelFor(c.statement),
    domain: c.domain,
    subDomain: c.subDomain,
    evidenceCount: c.evidenceIds.length,
    promotedInvariantId: c.promotedInvariantId,
  };
}

/**
 * Reconciles Stage 4's promoted cohort into distinct crystal members,
 * operator-confirmed exclusions, and NAMED unaccounted records — replacing
 * the old count-only classification. Read-only: this NEVER writes; the
 * deterministic-repair check (`findDuplicates`) only looks for an exact
 * match, it does not attach one — attaching is `repairPromotedCandidate
 * InvariantLink`'s job, invoked only on an explicit operator act.
 */
export async function reconcilePromotedCohort(promoted: CandidateRow[]): Promise<ReconciledPromotedCohort> {
  const excluded: { recordId: string; reason: string }[] = [];
  const unaccountedRecords: UnaccountedPromotionRecord[] = [];

  // 1. Operator-confirmed exclusions never re-enter the unaccounted set.
  const stillLive = promoted.filter((c) => {
    if (c.crystalExclusion) {
      excluded.push({ recordId: c.id, reason: c.crystalExclusion.reason });
      return false;
    }
    return true;
  });

  const withId = stillLive.filter((c): c is CandidateRow & { promotedInvariantId: string } => Boolean(c.promotedInvariantId));
  const withoutId = stillLive.filter((c) => !c.promotedInvariantId);

  // 2. Missing invariant_id — check for a deterministic repair (an EXACT
  //    existing-statement match), never guessed, never attached here.
  for (const c of withoutId) {
    const namespace = discoveryNamespace(c.domain);
    const duplicates = await findDuplicates(c.statement, { namespace });
    const exact = duplicates.find((d) => d.exact);
    unaccountedRecords.push({
      ...baseRecord(c),
      defect: 'missing-invariant-id',
      duplicateOfCandidateId: null,
      deterministicRepairInvariantId: exact ? exact.invariant.id : null,
      recommendedTreatment: exact ? 'repair' : 'exclude',
      recommendedReason: exact
        ? `Missing invariant_id. Recommended: attach the candidate's canonical invariant record (${exact.invariant.id}, exact statement match) and include.`
        : `Missing invariant_id, and no existing invariant states this candidate exactly — steward judgment required.`,
    });
  }

  // 3. Resolve every distinct id that IS set, in one batched read.
  const idsToResolve = [...new Set(withId.map((c) => c.promotedInvariantId))];
  const records = idsToResolve.length > 0 ? await getInvariantsByIds(idsToResolve) : [];
  const resolvedSet = new Set(records.map((r) => r.id));

  // 4. The first candidate to claim a resolved id is the distinct crystal
  //    member; any LATER candidate claiming the SAME id is a duplicate
  //    resolution (promoteCandidate's own 'already-exists' rediscovery path
  //    can legitimately produce this) — named, never silently absorbed.
  const claimedBy = new Map<string, string>();
  for (const c of withId) {
    const id = c.promotedInvariantId;
    if (!resolvedSet.has(id)) {
      unaccountedRecords.push({
        ...baseRecord(c),
        defect: 'unresolvable-invariant-id',
        duplicateOfCandidateId: null,
        deterministicRepairInvariantId: null,
        recommendedTreatment: 'exclude',
        recommendedReason: `promoted_invariant_id (${id}) does not resolve to an invariant row — the reference is orphaned. Steward judgment required; no deterministic repair exists.`,
      });
      continue;
    }
    const claimant = claimedBy.get(id);
    if (claimant === undefined) {
      claimedBy.set(id, c.id);
      continue;
    }
    unaccountedRecords.push({
      ...baseRecord(c),
      defect: 'duplicate-invariant-id',
      duplicateOfCandidateId: claimant,
      deterministicRepairInvariantId: null,
      recommendedTreatment: 'exclude',
      recommendedReason: `Resolved to the same invariant (${id}) as candidate ${claimant} — not a distinct crystal member. Recommended: explicitly exclude; the invariant remains counted once, via the candidate that already claims it.`,
    });
  }

  let graph: ReconciledPromotedCohort['graph'] = null;
  if (records.length > 0) {
    try {
      const { listEdgesForInvariants } = await import('@/services/invariants/store');
      const memberIds = new Set(records.map((r) => r.id));
      const edges = await listEdgesForInvariants([...memberIds], 'both');
      const intra = edges.filter((e) => memberIds.has(e.fromInvariantId) && memberIds.has(e.toInvariantId));
      const degree = new Set<string>();
      for (const e of intra) {
        degree.add(e.fromInvariantId);
        degree.add(e.toInvariantId);
      }
      graph = { relationshipCount: intra.length, orphanCount: records.length - degree.size };
    } catch {
      graph = null; // unread ⇒ `unknown`, never "no relationships"
    }
  } else if (idsToResolve.length === 0 && withoutId.length === 0) {
    graph = { relationshipCount: 0, orphanCount: 0 };
  }

  const { readEvidenceProvenance } = await import('@/services/research/experimentalPopulations');
  return {
    invariantIds: records.map((r) => r.id).sort(),
    unclassified: records.filter((r) => readEvidenceProvenance(r.provenance) === null).length,
    unvalidated: records.filter((r) => r.timesValidated === 0).length,
    graph,
    excluded,
    unaccountedRecords,
  };
}
