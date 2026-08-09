/**
 * Post-Freeze Observer Review — a SEPARATE mechanism from IRL-REVIEW-001's
 * dual-model R1/R2 adjudication pipeline (adjudication.ts, checkpoint.ts).
 *
 * ── Why this is not another `ReviewerSlot` ─────────────────────────────────
 *
 * `ReviewerSlot` ('R1'|'R2') belongs to the AUTOMATED dual-model pipeline that
 * classifies corpus rows before a crystal is even constituted. An Observer,
 * here, is a HUMAN principal (Austin, Avi, …) assigned to assess an ALREADY
 * FROZEN crystal and decide whether it should stand. Folding the two together
 * would either (a) force N human observers to squeeze into two automation
 * slots, or (b) widen R1/R2 into an N-slot pipeline neither the freeze
 * ceremony nor the adjudication engine were built to carry. Both are the
 * multiplicity-by-force-fit this capability exists to avoid — see
 * `resolveObserverRound`'s doc comment.
 *
 * ── This package reviews a FROZEN artifact only ────────────────────────────
 *
 * `buildObserverReviewPackage` refuses unless the artifact it is handed is
 * ALREADY at lifecycle `frozen` with both hashes present. A candidate crystal
 * has its own review posture (the INDEPENDENT PRE-FREEZE review —
 * `crystalDomains.ts`'s `CrystalReviewStageStatus`); this module is EXPLICITLY
 * the POST-freeze closure, hash-bound to what was actually frozen.
 *
 * ── Never average, never mutate the frozen artifact ────────────────────────
 *
 * Same discipline as adjudication.ts: decisions are carried verbatim, one per
 * observer, never blended. `changes_requested` NEVER mutates the frozen
 * artifact (IRL-016 §4 — freeze is immutable); it only ever produces a
 * `ChangeProposal`, which — if accepted — points at a NEW, separate candidate
 * artifact id. The frozen row this package hashes against is never touched by
 * anything in this file.
 *
 * Pure. No I/O, no clock read (every timestamp is a caller-supplied
 * parameter), no database import — the persistence half lives in
 * `services/research/observerReviewStore.ts`, for the same reason
 * `independentReviewStore.ts` sits apart from `services/research/review/`: a
 * reviewer must not be able to reach the corpus even by accident.
 *
 * Lives BESIDE `crystalFreezeCeremony.ts` / `crystalDomains.ts` / `crystalReadiness.ts`
 * rather than inside `services/research/review/` (IRL-REVIEW-001's GENERIC,
 * instance-agnostic capability — canaried in tests/independent-review-capability.test.ts
 * to name no crystal, no experiment id, no domain subject). This module is
 * explicitly crystal-specific, exactly like its siblings here — it reuses
 * `review/deterministic.ts`'s `commit()` and `review/types.ts`'s
 * `ReviewRefusal`, the same shared primitives `reviewPackage.ts` and
 * `adjudication.ts` use, without pretending to be part of that generic layer.
 */

import { commit } from './review/deterministic';
import { ReviewRefusal } from './review/types';
import type { FrozenArtifactKind } from '@/types/research';

// ─── The package ─────────────────────────────────────────────────────────────

export type ObserverRoundPolicy = 'any-assigned' | 'all-assigned';

/**
 * PINNED per-experiment round policy — declared, not caller-supplied, the
 * same pattern `crystalDomainForExperiment` (crystalDomains.ts) uses for the
 * crystal domain boundary. Added 2026-08-09 (Post-Freeze Observer Review
 * Closure verification): the assign route previously accepted `roundPolicy`
 * as a free per-call parameter, so a steward could assign EXP-P1's round as
 * `any-assigned` even though the operator's instruction was explicit —
 * "Austin and Avi must each accept before the round is accepted" is an
 * `all-assigned` requirement, not a default a later call could quietly
 * loosen. `null` for any experiment with no declared pin — the caller's own
 * choice governs there.
 */
export const PINNED_OBSERVER_ROUND_POLICY: Readonly<Record<string, ObserverRoundPolicy>> = Object.freeze({
  'EXP-P1': 'all-assigned',
});

export function pinnedObserverRoundPolicy(experimentId: string): ObserverRoundPolicy | null {
  return PINNED_OBSERVER_ROUND_POLICY[experimentId] ?? null;
}

export interface ObserverReviewPackage {
  packageId: string;
  experimentId: string;
  /** The FrozenArtifact.id this package reviews — e.g. '<experiment>/crystal-vN'. */
  artifactId: string;
  artifactKind: FrozenArtifactKind;
  /** = FrozenArtifact.contentHash at the moment of freeze. */
  frozenContentHash: string;
  /** = FrozenArtifact.commitmentHash at the moment of freeze. */
  frozenCommitmentHash: string;
  frozenAt: string;
  /** The freeze act's own signatories — carried through so a reader can see
   *  who ratified the object this package now asks observers to assess. */
  signedBy: readonly string[];
  roundPolicy: ObserverRoundPolicy;
  /** T2-safe observer references. Assignment is declarative, never inferred
   *  from who happens to submit a decision (SPEC point 5). */
  assignedObserverRefs: readonly string[];
  /** Supplied by the caller. No clock is read here. */
  createdAt: string;
  packageHash: string;
}

export interface BuildObserverReviewPackageInput {
  packageId: string;
  experimentId: string;
  artifact: {
    id: string;
    kind: FrozenArtifactKind;
    lifecycle: string;
    contentHash: string | null;
    commitmentHash: string | null;
    frozenAt: string | null;
    signedBy: readonly string[];
  };
  roundPolicy: ObserverRoundPolicy;
  assignedObserverRefs: readonly string[];
  createdAt: string;
}

/**
 * Build a hash-bound Observer Review Package FROM a frozen artifact.
 *
 * Refuses (never silently substitutes a candidate hash) when the artifact is
 * not actually frozen, or is frozen but missing a hash — a package built
 * against an incomplete freeze record would let an observer assess something
 * that cannot be verified against anything.
 */
export function buildObserverReviewPackage(
  input: BuildObserverReviewPackageInput,
): ObserverReviewPackage {
  if (input.artifact.lifecycle !== 'frozen') {
    throw new ReviewRefusal(
      'observer-package-artifact-not-frozen',
      `artifact '${input.artifact.id}' is '${input.artifact.lifecycle}', not 'frozen' — an Observer Review ` +
        'Package may only be built from an already-frozen crystal. Preparation and internal diagnostic review ' +
        'happen before freeze, through crystalReadiness.ts / crystalFreezeCeremony.ts, not through this path.',
    );
  }
  if (!input.artifact.contentHash?.trim() || !input.artifact.commitmentHash?.trim()) {
    throw new ReviewRefusal(
      'observer-package-missing-hash',
      `artifact '${input.artifact.id}' is frozen but is missing contentHash or commitmentHash — the freeze ` +
        'record itself is incomplete, and an Observer Review Package cannot be hash-bound to nothing.',
    );
  }
  if (!input.artifact.frozenAt?.trim()) {
    throw new ReviewRefusal('observer-package-missing-frozen-at', `artifact '${input.artifact.id}' has no frozenAt`);
  }
  if (input.assignedObserverRefs.length === 0) {
    throw new ReviewRefusal(
      'observer-package-no-observers',
      'an Observer Review Package requires at least one assigned observer principal — a package nobody is ' +
        'assigned to review cannot produce a round outcome',
    );
  }
  const seen = new Set<string>();
  for (const ref of input.assignedObserverRefs) {
    if (!ref.trim()) throw new ReviewRefusal('observer-package-blank-observer-ref', 'an assigned observer ref may not be blank');
    if (seen.has(ref)) throw new ReviewRefusal('observer-package-duplicate-observer', `observer '${ref}' is assigned more than once`);
    seen.add(ref);
  }
  if (!input.createdAt.trim()) {
    throw new ReviewRefusal('observer-package-missing-created-at', 'createdAt must be supplied by the caller');
  }

  const base = {
    packageId: input.packageId,
    experimentId: input.experimentId,
    artifactId: input.artifact.id,
    artifactKind: input.artifact.kind,
    frozenContentHash: input.artifact.contentHash,
    frozenCommitmentHash: input.artifact.commitmentHash,
    frozenAt: input.artifact.frozenAt,
    signedBy: [...input.artifact.signedBy],
    roundPolicy: input.roundPolicy,
    assignedObserverRefs: [...input.assignedObserverRefs],
  };

  return { ...base, createdAt: input.createdAt, packageHash: commit(base) };
}

export function verifyObserverPackageHash(pkg: ObserverReviewPackage): boolean {
  const { packageHash, createdAt, ...body } = pkg;
  return commit(body) === packageHash;
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export type ObserverDecisionKind = 'accepted' | 'changes_requested' | 'unable_to_assess';

export const OBSERVER_DECISION_KINDS: readonly ObserverDecisionKind[] = [
  'accepted',
  'changes_requested',
  'unable_to_assess',
];

export interface ObserverDecision {
  packageHash: string;
  /** T2-safe, the HUMAN observer this decision is attributed to. Exactly one
   *  live decision per observerRef per package — a resubmission REPLACES the
   *  observer's own prior decision (self-service, idempotent), it never adds
   *  a second vote (SPEC points 4, 7). */
  observerRef: string;
  decision: ObserverDecisionKind;
  rationale: string;
  evidenceRefs: readonly string[];
  /**
   * The delegated agent that assisted in producing this decision, if any
   * (SPEC point 7). Attributable evidence, never a second signatory: the
   * decision is still recorded under `observerRef` alone, and
   * `resolveObserverRound` counts observers, never agents.
   */
  submittedByAgentRef?: string | null;
  decidedAt: string;
}

export interface ValidateObserverDecisionInput {
  pkg: ObserverReviewPackage;
  observerRef: string;
  decision: ObserverDecisionKind;
  rationale: string;
  evidenceRefs?: readonly string[];
  submittedByAgentRef?: string | null;
  decidedAt: string;
  proposedChange?: string;
}

/**
 * Validate and construct one Observer Decision against a specific package.
 *
 * Refuses an observer who is not on the package's own assignment list — this
 * is the enforcement point for "self-service, PERSONA-SCOPED" (SPEC point 4):
 * a decision is scoped to a principal the package itself names, never to
 * whoever happens to call the endpoint.
 */
export function validateObserverDecision(input: ValidateObserverDecisionInput): ObserverDecision {
  if (!input.observerRef.trim()) {
    throw new ReviewRefusal('observer-decision-unattributed', 'an Observer Decision must record who decided');
  }
  if (!input.pkg.assignedObserverRefs.includes(input.observerRef)) {
    throw new ReviewRefusal(
      'observer-decision-not-assigned',
      `'${input.observerRef}' is not an assigned observer on package ${input.pkg.packageHash.slice(0, 12)}… — ` +
        'only a principal the package itself names may submit a decision against it',
    );
  }
  if (!OBSERVER_DECISION_KINDS.includes(input.decision)) {
    throw new ReviewRefusal('observer-decision-invalid-kind', `'${input.decision}' is not a recognised observer decision`);
  }
  const rationale = input.rationale?.trim() ?? '';
  if (!rationale) {
    throw new ReviewRefusal('observer-decision-unreasoned', `observer '${input.observerRef}' gave no rationale`);
  }
  if (input.decision === 'changes_requested' && !input.proposedChange?.trim()) {
    throw new ReviewRefusal(
      'observer-decision-changes-requested-without-proposal',
      `observer '${input.observerRef}' requested changes without stating what should change — a bare ` +
        '"changes_requested" with no proposed change cannot be turned into a Change Proposal',
    );
  }
  if (!input.decidedAt.trim()) {
    throw new ReviewRefusal('observer-decision-missing-decided-at', 'decidedAt must be supplied by the caller');
  }

  return {
    packageHash: input.pkg.packageHash,
    observerRef: input.observerRef,
    decision: input.decision,
    rationale,
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    submittedByAgentRef: input.submittedByAgentRef ?? null,
    decidedAt: input.decidedAt,
  };
}

// ─── Review-round resolution ──────────────────────────────────────────────────

export type ObserverAcceptanceStatus = 'pending' | 'accepted' | 'changes_requested' | 'mixed';

export interface ObserverRoundResolution {
  packageHash: string;
  policy: ObserverRoundPolicy;
  assignedCount: number;
  decidedCount: number;
  outstandingObserverRefs: readonly string[];
  acceptance: ObserverAcceptanceStatus;
  detail: string;
}

export interface ResolveObserverRoundInput {
  pkg: ObserverReviewPackage;
  /** At most one decision per assigned observer — the caller (the store's
   *  upsert-by-observerRef semantics) guarantees this; this function refuses
   *  loudly if it is ever handed a duplicate, rather than silently picking
   *  one, because that would hide a real bug in the write path. */
  decisions: readonly ObserverDecision[];
}

/**
 * Fold N independent observer decisions into ONE round outcome, honouring the
 * EXPLICIT round policy the package itself carries (SPEC point 6).
 *
 *   `all-assigned` — every assigned observer must decide `accepted` for the
 *     round to be `accepted`. This is what a "every named observer must
 *     accept before the round is accepted" instance policy expresses.
 *   `any-assigned` — one `accepted` decision is enough, once nobody
 *     outstanding is blocking with `changes_requested`.
 *
 * A single `changes_requested` ALWAYS blocks acceptance, regardless of policy
 * — the point of a change request is that the crystal is not yet acceptable
 * to that observer, and no OTHER observer's acceptance can override that
 * (never average, never outvote — the same discipline adjudication.ts applies
 * to R1/R2, restated here for N observers).
 */
export function resolveObserverRound(input: ResolveObserverRoundInput): ObserverRoundResolution {
  const { pkg, decisions } = input;

  const byObserver = new Map<string, ObserverDecision>();
  for (const d of decisions) {
    if (d.packageHash !== pkg.packageHash) {
      throw new ReviewRefusal(
        'observer-decision-wrong-package',
        `decision from '${d.observerRef}' targets package ${d.packageHash.slice(0, 12)}…, not this round's ` +
          `${pkg.packageHash.slice(0, 12)}…`,
      );
    }
    if (byObserver.has(d.observerRef)) {
      throw new ReviewRefusal(
        'observer-decision-duplicate-in-round',
        `'${d.observerRef}' has more than one decision in this round — the store's upsert-by-observerRef ` +
          'contract was not honoured upstream',
      );
    }
    byObserver.set(d.observerRef, d);
  }

  const assigned = pkg.assignedObserverRefs;
  const outstanding = assigned.filter((ref) => !byObserver.has(ref));
  const decided = [...byObserver.values()];

  const anyChangesRequested = decided.some((d) => d.decision === 'changes_requested');
  if (anyChangesRequested) {
    return {
      packageHash: pkg.packageHash,
      policy: pkg.roundPolicy,
      assignedCount: assigned.length,
      decidedCount: decided.length,
      outstandingObserverRefs: outstanding,
      acceptance: 'changes_requested',
      detail:
        `${decided.filter((d) => d.decision === 'changes_requested').length} of ${assigned.length} assigned ` +
        'observer(s) requested changes — the round is blocked regardless of any other observer\'s acceptance; ' +
        'the frozen crystal itself is untouched, and any accepted change proposal opens a fresh round against a ' +
        'superseding candidate',
    };
  }

  if (outstanding.length > 0) {
    if (pkg.roundPolicy === 'any-assigned' && decided.some((d) => d.decision === 'accepted')) {
      return {
        packageHash: pkg.packageHash,
        policy: pkg.roundPolicy,
        assignedCount: assigned.length,
        decidedCount: decided.length,
        outstandingObserverRefs: outstanding,
        acceptance: 'accepted',
        detail: `policy 'any-assigned' — at least one assigned observer accepted; ${outstanding.length} still outstanding`,
      };
    }
    return {
      packageHash: pkg.packageHash,
      policy: pkg.roundPolicy,
      assignedCount: assigned.length,
      decidedCount: decided.length,
      outstandingObserverRefs: outstanding,
      acceptance: 'pending',
      detail:
        pkg.roundPolicy === 'all-assigned'
          ? `policy 'all-assigned' — waiting on ${outstanding.join(', ')} before the round can be accepted`
          : `policy 'any-assigned' — no acceptance yet; waiting on ${outstanding.join(', ')}`,
    };
  }

  // Fully decided, nobody requested changes.
  const allAccepted = decided.every((d) => d.decision === 'accepted');
  if (allAccepted) {
    return {
      packageHash: pkg.packageHash,
      policy: pkg.roundPolicy,
      assignedCount: assigned.length,
      decidedCount: decided.length,
      outstandingObserverRefs: [],
      acceptance: 'accepted',
      detail: `all ${assigned.length} assigned observer(s) accepted`,
    };
  }
  if (pkg.roundPolicy === 'any-assigned' && decided.some((d) => d.decision === 'accepted')) {
    return {
      packageHash: pkg.packageHash,
      policy: pkg.roundPolicy,
      assignedCount: assigned.length,
      decidedCount: decided.length,
      outstandingObserverRefs: [],
      acceptance: 'accepted',
      detail: `policy 'any-assigned' — at least one acceptance among ${assigned.length} fully-decided observer(s)`,
    };
  }
  return {
    packageHash: pkg.packageHash,
    policy: pkg.roundPolicy,
    assignedCount: assigned.length,
    decidedCount: decided.length,
    outstandingObserverRefs: [],
    acceptance: 'mixed',
    detail:
      `all ${assigned.length} assigned observer(s) decided, but not every decision was 'accepted' (some ` +
      `'unable_to_assess') — policy '${pkg.roundPolicy}' is not satisfied`,
  };
}

// ─── Change proposals ─────────────────────────────────────────────────────────

export type ChangeProposalStatus = 'open' | 'accepted' | 'declined';

export interface ChangeProposal {
  proposalId: string;
  packageHash: string;
  raisedByObserverRef: string;
  proposedChange: string;
  rationale: string;
  status: ChangeProposalStatus;
  createdAt: string;
  /** Set only once accepted — the new candidate artifact id this proposal
   *  produced. Never the frozen artifact's own id (IRL-016 §4). */
  supersedingArtifactId: string | null;
  resolvedAt: string | null;
  resolvedByRef: string | null;
  resolutionReason: string | null;
}

/**
 * Build a Change Proposal from a `changes_requested` decision. Pure — never
 * mutates the frozen artifact, never creates the superseding candidate
 * itself (that is a persistence-layer act performed by the steward/operator
 * who ACCEPTS the proposal, via `services/research/artifacts.ts::upsertArtifact`
 * at `draft`, outside this file).
 */
export function createChangeProposal(input: {
  proposalId: string;
  decision: ObserverDecision;
  proposedChange: string;
  createdAt: string;
}): ChangeProposal {
  if (input.decision.decision !== 'changes_requested') {
    throw new ReviewRefusal(
      'change-proposal-wrong-decision-kind',
      `a Change Proposal may only be built from a 'changes_requested' decision, not '${input.decision.decision}'`,
    );
  }
  if (!input.proposedChange.trim()) {
    throw new ReviewRefusal('change-proposal-no-proposed-change', 'a Change Proposal requires a stated proposed change');
  }
  return {
    proposalId: input.proposalId,
    packageHash: input.decision.packageHash,
    raisedByObserverRef: input.decision.observerRef,
    proposedChange: input.proposedChange.trim(),
    rationale: input.decision.rationale,
    status: 'open',
    createdAt: input.createdAt,
    supersedingArtifactId: null,
    resolvedAt: null,
    resolvedByRef: null,
    resolutionReason: null,
  };
}

/**
 * Resolve an open Change Proposal. `accept` requires the caller to already
 * have provisioned the superseding candidate artifact (id supplied) — this
 * function never provisions one itself, matching `resolveContestedRecord`'s
 * pure "takes the current row, returns the next one" shape.
 */
export function resolveChangeProposal(
  current: ChangeProposal,
  remedy:
    | { outcome: 'accept'; supersedingArtifactId: string; resolvedByRef: string; resolvedAt: string; reason: string }
    | { outcome: 'decline'; resolvedByRef: string; resolvedAt: string; reason: string },
): ChangeProposal {
  if (current.status !== 'open') {
    throw new ReviewRefusal(
      'change-proposal-not-open',
      `proposal '${current.proposalId}' is '${current.status}', not 'open' — only an open proposal may be resolved`,
    );
  }
  if (!remedy.reason.trim()) {
    throw new ReviewRefusal('change-proposal-unreasoned-resolution', 'a Change Proposal resolution requires a stated reason');
  }
  if (!remedy.resolvedByRef.trim()) {
    throw new ReviewRefusal('change-proposal-unattributed-resolution', 'a Change Proposal resolution requires an attributable ref');
  }
  if (remedy.outcome === 'accept') {
    if (!remedy.supersedingArtifactId.trim()) {
      throw new ReviewRefusal(
        'change-proposal-accept-without-superseding-artifact',
        'accepting a Change Proposal requires the already-provisioned superseding candidate artifact id',
      );
    }
    if (remedy.supersedingArtifactId === current.packageHash) {
      throw new ReviewRefusal('change-proposal-superseding-artifact-is-not-an-artifact-id', 'supersedingArtifactId must be an artifact id, not the package hash');
    }
    return {
      ...current,
      status: 'accepted',
      supersedingArtifactId: remedy.supersedingArtifactId,
      resolvedAt: remedy.resolvedAt,
      resolvedByRef: remedy.resolvedByRef,
      resolutionReason: remedy.reason,
    };
  }
  return {
    ...current,
    status: 'declined',
    supersedingArtifactId: null,
    resolvedAt: remedy.resolvedAt,
    resolvedByRef: remedy.resolvedByRef,
    resolutionReason: remedy.reason,
  };
}

// ─── Observer independence — blind peer decisions before the caller decides ──
//
// Added 2026-08-09 (Validation Programme JSON Agent Package completeness
// pass, point 8): "do not reveal another assigned observer's substantive
// decision before the current caller has submitted their own decision."
//
// The SAME concern R1/R2 isolation already enforces for the automated
// pipeline (review/isolation.ts — "R2 never sees R1") applies here for N
// human observer principals: Austin's rationale must not be visible to Avi
// (or anyone else's decision to anyone else) before that reader has decided
// themselves, or the round has closed. This is the ONE authoritative
// derivation — both `/api/research/observer-review/[experimentId]` and the
// Validation Programme Agent Package call it, so the two surfaces can never
// disagree about what a given caller may see.
//
// A STEWARD's oversight view is NOT blinded by this function — pass
// `mayViewAll: true` for a steward/PI/admin caller, who already holds wider
// authority over the round (assigning it, resolving change proposals) and is
// not themselves a voting peer.

/**
 * REVIEWER-SAFE — no field here names another principal or a specific
 * outstanding ref (fixed 2026-08-09, second review pass). The prior shape
 * carried `assignedCount`/`outstandingCount` alongside the SEPARATE
 * `resolution.outstandingObserverRefs` a caller could read in the same
 * response — a 2-principal round made "the other one hasn't decided" and
 * "the other one is Avi" the same fact, in effect naming Avi by
 * elimination. This shape reports only aggregate booleans/counts about
 * OTHERS, never their refs, and never a per-ref detail string. A reviewer
 * may know there are N other assigned principals and whether any of them
 * are still outstanding; they may not read who, specifically.
 *
 * The full ref-bearing projection (`assignedObserverRefs`, the unredacted
 * `ObserverRoundResolution`) is reserved for a steward/admin caller — see
 * `projectResolutionForCaller` below and each route's own `isSteward` gate.
 */
export interface CallerObserverStatus {
  /** Is the CALLER one of the assigned observer principals? */
  callerAssigned: boolean;
  /** The caller's OWN decision kind, or 'not-decided'. Never another
   *  observer's — this field is intentionally caller-scoped only. */
  callerDecisionStatus: ObserverDecisionKind | 'not-decided';
  /** Every assigned principal has decided. */
  roundComplete: boolean;
  /** How many OTHER principals this round assigned — never their refs. */
  otherAssignedCount: number;
  /** True iff at least one OTHER assigned principal has not yet decided. */
  otherDecisionsOutstanding: boolean;
}

export function deriveCallerObserverStatus(input: {
  pkg: ObserverReviewPackage | null;
  decisions: readonly ObserverDecision[];
  callerRef: string;
}): CallerObserverStatus {
  const assignedCount = input.pkg?.assignedObserverRefs.length ?? 0;
  const callerAssigned = input.pkg?.assignedObserverRefs.includes(input.callerRef) ?? false;
  const callerDecision = input.decisions.find((d) => d.observerRef === input.callerRef);
  const otherAssignedCount = Math.max(0, assignedCount - (callerAssigned ? 1 : 0));
  const otherDecidedCount = input.decisions.filter((d) => d.observerRef !== input.callerRef).length;
  return {
    callerAssigned,
    callerDecisionStatus: callerDecision?.decision ?? 'not-decided',
    roundComplete: assignedCount > 0 && input.decisions.length >= assignedCount,
    otherAssignedCount,
    otherDecisionsOutstanding: otherDecidedCount < otherAssignedCount,
  };
}

/**
 * The SAME redaction rule `blindOtherObserverDecisions` applies to decision
 * CONTENT, applied to the round's AGGREGATE resolution — `resolution.detail`
 * is free text that names refs ("waiting on Avi-ref…"), and
 * `outstandingObserverRefs`/per-slot counts are ref-bearing or ref-adjacent.
 * A non-privileged caller gets only `{policy, acceptance}` — the outcome
 * category, never who specifically is outstanding or how many decided.
 * `mayViewAll` is the SAME boolean each route already computes (steward/
 * admin, or the caller has decided, or the round is closed).
 */
export type RedactedObserverRoundResolution = Pick<ObserverRoundResolution, 'policy' | 'acceptance'>;

export function projectResolutionForCaller(
  resolution: ObserverRoundResolution,
  mayViewAll: boolean,
): ObserverRoundResolution | RedactedObserverRoundResolution {
  if (mayViewAll) return resolution;
  return { policy: resolution.policy, acceptance: resolution.acceptance };
}

/**
 * Filters a round's decision list down to what THIS caller may see.
 * `mayViewAll` is computed by the caller (steward/admin, or the caller has
 * already decided, or the round is no longer open) — this function only
 * applies the filter, so the "who may see everything" policy lives at each
 * route's own authority boundary rather than being guessed here.
 */
export function blindOtherObserverDecisions(input: {
  decisions: readonly ObserverDecision[];
  callerRef: string;
  mayViewAll: boolean;
}): ObserverDecision[] {
  if (input.mayViewAll) return [...input.decisions];
  return input.decisions.filter((d) => d.observerRef === input.callerRef);
}
