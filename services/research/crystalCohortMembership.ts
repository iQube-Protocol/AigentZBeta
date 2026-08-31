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
 *     = inherited predecessor members (frozen manifest's domain recovery)
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
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listCandidates, type CandidateRow } from '@/services/invariants/discoveryEngine';
import { latestFrozenCrystalArtifact } from '@/services/research/artifacts';
import { buildFrozenCrystalManifest } from '@/services/research/crystalFrozenManifest';
import type { FrozenArtifact } from '@/types/research';

export interface LabeledMember {
  id: string;
  statement: string;
}

/**
 * The frozen predecessor generation, if one exists — resolved through the
 * SAME lineage-safe lookup (`latestFrozenCrystalArtifact`) and domain-
 * recovery manifest (`buildFrozenCrystalManifest`) `researchProgrammeOrchestrator.ts`
 * always used, now the ONE place that logic lives. `frozenGenerationMemberIds`/
 * `frozenGenerationMembers` are `null` when there is no frozen predecessor
 * OR its manifest could not be read — callers must treat `null` as
 * "inherited membership is UNKNOWN," never as "empty" (which would silently
 * exclude legitimately-inherited candidates) and never as "everything"
 * (which would silently admit anything).
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
  const manifest = await buildFrozenCrystalManifest({
    experimentId,
    artifact: frozenPredecessor,
    observedAt: new Date().toISOString(),
  }).catch(() => null);
  if (!manifest) {
    return { frozenPredecessor, frozenGenerationMemberIds: null, frozenGenerationMembers: null };
  }
  return {
    frozenPredecessor,
    frozenGenerationMemberIds: new Set(manifest.recoveredInvariants.map((r) => r.id)),
    frozenGenerationMembers: manifest.recoveredInvariants.map((r) => ({ id: r.id, statement: r.statement })),
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
 */
export async function resolveSuccessorConstructionCohort(
  admin: SupabaseClient,
  experimentId: string,
  acquisitionDomain: string,
): Promise<SuccessorConstructionCohortResolution> {
  const [context, candidates] = await Promise.all([
    resolveFrozenPredecessorContext(experimentId),
    listCandidates(admin, acquisitionDomain).catch(() => null),
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
