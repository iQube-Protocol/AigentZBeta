/**
 * The ONE shared resolver for "what counts as this crystal's membership" —
 * extracted 2026-08-31 per operator ruling (Track 2 Stage 7 relationship
 * defect: "successor cohort" and "successor Crystal" are not the same
 * thing).
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 *
 * The frozen-generation/successor-scoping predicate (`isSuccessorScopedCandidate`)
 * lived ONLY as a private closure inside `researchProgrammeOrchestrator.ts`'s
 * `loadTrack2ProgrammeState`. Every OTHER route that needed "the current
 * cohort" — `suggest-relationships`, `validate-all`, the relationship-
 * adjudication route — independently called `reconcilePromotedCohort` over
 * EVERY promoted candidate for the acquisition domain, with no frozen-
 * generation filtering at all. That let the Relationship Queue offer, and a
 * steward accept, a relationship to an arbitrary historic promoted
 * invariant, while Stage 7's own completion bookkeeping (correctly
 * successor-scoped) could never see it as in-scope — two different
 * definitions of "the current cohort" in the same feature.
 *
 * ── THE OPERATOR RULING THIS ENCODES (2026-08-31) ───────────────────────────
 *
 * "Successor cohort" (the newly promoted construction candidates for THIS
 * acquisition pass — what gets ADJUDICATED) is narrower than "successor
 * Crystal" (what a new member may legitimately RELATE to): Crystal v2 is
 * built from an INHERITED predecessor substrate plus the current successor
 * construction cohort. A scientifically valid relationship from a new
 * member to an INHERITED member is a valid Crystal-v2 relationship and must
 * count toward Stage 7 — but a relationship to some arbitrary OTHER
 * promoted invariant in the acquisition domain, outside both the inherited
 * substrate and the successor cohort, must not.
 *
 *   target Crystal membership universe
 *     = inherited predecessor members (the frozen predecessor GENERATION's
 *       own explicitly-tagged membership — see the 2026-09-05 fix below)
 *     + current successor construction cohort
 *
 *   Stage 7 resolved per successor member ⟺
 *     (≥1 admitted edge to ANY member of that universe)
 *     OR (a still-valid governed no-defensible-edge adjudication)
 *
 * Every surface that needs EITHER half of this — the successor construction
 * cohort alone (validation, adjudication membership), or the full target-
 * Crystal universe (relationship suggestion candidate pools, Stage 7
 * reconciliation's edge-counting) — MUST resolve it through this module.
 * Never re-derive frozen-generation membership independently.
 *
 * ── GENERATION-BLIND MEMBERSHIP RECOVERY, FIXED 2026-09-05 ──────────────────
 *
 * `resolveFrozenPredecessorContext` USED to recover "the frozen predecessor
 * generation's membership" via `buildFrozenCrystalManifest`'s domain-scoped
 * `listInvariants({domain: crystalDomain})` — a read with NO status filter
 * (deliberate, for an unrelated reason — recovering members later merged as
 * duplicates) and NO time/generation boundary at all. The moment new
 * successor material was Stage-8-assigned into the SAME domain
 * (`financial-risk-value-systems`, 2026-09-05T10:06:41Z, receipt
 * b28284b6-7b26-4362-b89b-c866fa690967), this read silently absorbed all 53
 * new members as if they were part of the original 15-member frozen vP1
 * snapshot, and `isSuccessorScopedCandidate` then misclassified every one of
 * them as already-frozen predecessor history — collapsing Track 2's own
 * live successor-cohort view from 58 down to 5. Full mechanical account:
 * `codexes/packs/agentiq/resolution-records/records/RES-2026-09-05-TRACK2-MEMBERSHIP-RECOVERY-GENERATION-BLIND-001.json`.
 *
 * The fix: `invariant_contexts` now carries an explicit
 * `crystal_generation_id` (the assigning crystal-version artifact's own id,
 * e.g. 'EXP-P1/crystal-vP1' — never a freeform 'v1'/'v2' string; see
 * services/research/artifacts.ts's `crystal-version` artifact model).
 * `resolveFrozenPredecessorContext` below reads membership DIRECTLY via
 * `listInvariants({domain, crystalGenerationId: frozenPredecessor.id})` —
 * bounded to the frozen predecessor's OWN generation, never "whatever the
 * domain currently contains." `buildFrozenCrystalManifest`'s own domain-wide
 * read is UNCHANGED (it answers a different, legitimate question — whether
 * the live corpus byte-reproduces the frozen hash — and is deliberately not
 * touched by this repair; see that module's own header).
 */

import { listInvariants } from '@/services/invariants/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listCandidatesAcrossSubDomains, type CandidateRow } from '@/services/invariants/discoveryEngine';
import { latestFrozenCrystalArtifact } from '@/services/research/artifacts';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import type { FrozenArtifact } from '@/types/research';

export interface LabeledMember {
  id: string;
  statement: string;
}

/**
 * The frozen predecessor generation, if one exists — resolved through the
 * SAME lineage-safe lookup (`latestFrozenCrystalArtifact`)
 * `researchProgrammeOrchestrator.ts` always used, now the ONE place that
 * logic lives. `frozenGenerationMemberIds`/`frozenGenerationMembers` are
 * `null` when there is no frozen predecessor OR its membership could not be
 * read — callers must treat `null` as "inherited membership is UNKNOWN,"
 * never as "empty" (which would silently exclude legitimately-inherited
 * candidates) and never as "everything" (which would silently admit
 * anything).
 *
 * GENERATION-BOUNDED, not domain-wholesale (2026-09-05 fix — see this
 * module's header). Membership is read directly via
 * `listInvariants({domain, crystalGenerationId: frozenPredecessor.id})`,
 * never via a re-derivation of "whatever the domain currently contains."
 */
export interface FrozenPredecessorContext {
  frozenPredecessor: FrozenArtifact | null;
  frozenGenerationMemberIds: Set<string> | null;
  frozenGenerationMembers: LabeledMember[] | null;
}

export async function resolveFrozenPredecessorContext(experimentId: string): Promise<FrozenPredecessorContext> {
  const frozenPredecessor = await latestFrozenCrystalArtifact(experimentId).catch(() => null);
  if (!frozenPredecessor) {
    return { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null };
  }
  // The domain this generation was assigned in — needed to scope the
  // membership read at all. No declared domain means there is nothing to
  // read membership FROM, so this fails to null exactly like an unreadable
  // manifest used to (never "empty", never "everything").
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return { frozenPredecessor, frozenGenerationMemberIds: null, frozenGenerationMembers: null };
  }
  let members: Awaited<ReturnType<typeof listInvariants>>;
  try {
    members = await listInvariants({
      domain: declaration.domain,
      crystalGenerationId: frozenPredecessor.id,
      limit: 500,
    });
  } catch {
    return { frozenPredecessor, frozenGenerationMemberIds: null, frozenGenerationMembers: null };
  }
  return {
    frozenPredecessor,
    frozenGenerationMemberIds: new Set(members.map((r) => r.id)),
    frozenGenerationMembers: members.map((r) => ({ id: r.id, statement: r.statement })),
  };
}

/**
 * THE SUCCESSOR-SCOPE PREDICATE (moved verbatim from
 * researchProgrammeOrchestrator.ts, 2026-08-30 "Stage 3→4 handoff gap" fix —
 * behaviour unchanged, only its location and the fact that every route now
 * shares it). A promoted candidate whose resolved invariant is ALREADY a
 * member of the frozen predecessor's manifest is vP1's own historical
 * promotion, not v2 construction work. A candidate with no resolved
 * invariant is scoped by creation time relative to the freeze — never
 * excluded when the boundary itself is unreadable (`!frozenPredecessor.frozenAt`).
 */
export function isSuccessorScopedCandidate(
  c: { status: string; promotedInvariantId: string | null; createdAt: string },
  ctx: Pick<FrozenPredecessorContext, 'frozenPredecessor' | 'frozenGenerationMemberIds'>,
): boolean {
  if (!ctx.frozenPredecessor) return true; // nothing to distinguish against
  if (c.promotedInvariantId) {
    return !(ctx.frozenGenerationMemberIds && ctx.frozenGenerationMemberIds.has(c.promotedInvariantId));
  }
  if (!ctx.frozenPredecessor.frozenAt) return true; // can't compare — never exclude on an unreadable boundary
  return c.createdAt >= ctx.frozenPredecessor.frozenAt;
}

export interface SuccessorConstructionCohortResolution {
  context: FrozenPredecessorContext;
  /** Every candidate for the domain, narrowed to THIS successor generation — null when the domain read failed. */
  successorScopedCandidates: CandidateRow[] | null;
  /** The `status === 'promoted'` subset of the above — what `reconcilePromotedCohort` consumes. */
  promotedForConstruction: CandidateRow[] | null;
}

/**
 * THE shared way to resolve "the current successor construction cohort" —
 * used by every route that needs it (Stage 7 reconciliation, relationship
 * suggestion, validate-all, relationship adjudication). Replaces each
 * route's own unscoped `listCandidates(...).filter(status === 'promoted')`,
 * which silently admitted every historic promoted candidate in the domain,
 * including the frozen predecessor's own.
 *
 * Reads via `listCandidatesAcrossSubDomains` (2026-09-03, "EXP-P1 Crystal v2
 * sub-domain invisibility" repair) — never `listCandidates(admin, domain)`,
 * whose no-subDomain call narrows to `sub_domain IS NULL` and would silently
 * exclude every candidate an institution-driven discovery run tagged with a
 * pillar/topic sub-domain. See that function's own doc comment.
 */
export async function resolveSuccessorConstructionCohort(
  admin: SupabaseClient,
  experimentId: string,
  acquisitionDomain: string,
): Promise<SuccessorConstructionCohortResolution> {
  const [context, candidates] = await Promise.all([
    resolveFrozenPredecessorContext(experimentId),
    listCandidatesAcrossSubDomains(admin, acquisitionDomain).catch(() => null),
  ]);
  if (!candidates) {
    return { context, successorScopedCandidates: null, promotedForConstruction: null };
  }
  const successorScopedCandidates = candidates.filter((c) => isSuccessorScopedCandidate(c, context));
  return {
    context,
    successorScopedCandidates,
    promotedForConstruction: successorScopedCandidates.filter((c) => c.status === 'promoted'),
  };
}

export interface TargetCrystalMembershipUniverse {
  /** Inherited predecessor members ∪ the current successor cohort — the full set an edge's OTHER endpoint may legitimately resolve to. */
  memberIds: Set<string>;
  /** The inherited half alone (subset of `memberIds`) — empty when no frozen predecessor exists or its manifest is unreadable (fails closed: never credits an edge as "inherited" on an unverifiable claim). */
  inheritedMemberIds: Set<string>;
  /** Labeled inherited members, for building a relationship-suggestion candidate pool that may legitimately include them. */
  inheritedMembers: LabeledMember[];
}

/**
 * `successorMemberIds` is the resolved, distinct successor cohort's own
 * invariant ids (`ReconciledPromotedCohort.invariantIds` /
 * `cohort.members.map(m => m.id)`) — this function only adds the inherited
 * half and unions the two; it never re-derives successor membership itself.
 */
export function resolveTargetCrystalMembershipUniverse(
  context: FrozenPredecessorContext,
  successorMemberIds: readonly string[],
): TargetCrystalMembershipUniverse {
  const inheritedMemberIds = context.frozenGenerationMemberIds ?? new Set<string>();
  return {
    memberIds: new Set([...inheritedMemberIds, ...successorMemberIds]),
    inheritedMemberIds,
    inheritedMembers: context.frozenGenerationMembers ?? [],
  };
}
