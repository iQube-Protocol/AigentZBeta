/**
 * workspaceMaterials — the FUNCTIONAL BOUNDARIES of SPEC-IRL-WORKSPACE-001 §9,
 * as a mechanism rather than as a paragraph.
 *
 *     Workspace = mutable operations
 *     Locker    = authoritative record
 *     QubeTalk  = deliberation
 *     Commons   = reusable proof
 *
 * TWO OF THE SPEC'S REQUIRED CANARIES POINT AT THIS FILE:
 *
 *   "Working Materials cannot masquerade as Locker artefacts"
 *   "QubeTalk cannot directly change governed state"
 *
 * BOTH ARE THE SAME DEFECT SHAPE, and it is the one the operator has paid for
 * repeatedly: a rule that exists only as prose is a rule nothing enforces. The
 * problem the spec names — "Locker gets misused as a project area, and
 * decisions stay trapped in chat" — is not solved by a heading that says
 * "authoritative artefacts only". It is solved by a function that REFUSES, and
 * a canary that drives the function rather than grepping for the heading.
 *
 * WHY REFUSAL REASONS AND NOT A BOOLEAN. `lockerAdmissionRefusals` returns the
 * list of reasons, exactly as `evaluateTradingStandingSignal` does: a caller who
 * is told only "no" learns nothing, and a reviewer reading a refused admission
 * needs to see WHICH property was missing. An empty list is admission.
 *
 * NOTHING HERE STORES ANYTHING. The Locker is the holder-owned encrypted store
 * it already was, and QubeTalk is the peer-channel system it already was. This
 * module decides ADMISSIBILITY and AUTHORITY; it is a gate in front of existing
 * capabilities, never a second store (the CS-001 duplicate-capability defect).
 */

// ─── Material classes ────────────────────────────────────────────────────────

/**
 * The two states a workspace artefact can be in. There is no third: an artefact
 * is either still being worked on or it is the record. A "nearly final" class
 * would be exactly the ambiguity that lets a draft drift into the Locker.
 */
export const MATERIAL_CLASSES = ['working', 'authoritative'] as const;
export type MaterialClass = (typeof MATERIAL_CLASSES)[number];

export interface WorkspaceMaterial {
  id: string;
  workspaceId: string;
  label: string;
  materialClass: MaterialClass;
  /**
   * Has this artefact been through a governed freeze? A `working` material can
   * never be frozen (a frozen draft is a contradiction), and an `authoritative`
   * one that is NOT frozen is a claim awaiting its act — both are refused.
   */
  frozen: boolean;
  /**
   * The one-way content commitment of the frozen bytes. Absent means nothing
   * has been committed to, so there is nothing tamper-evidence could protect —
   * an "authoritative" artefact with no commitment is an assertion about
   * itself.
   */
  contentCommitment?: string;
}

// ─── Locker admission ────────────────────────────────────────────────────────

/**
 * Why this material may NOT enter the Locker. Empty = admissible.
 *
 * THE ORDER IS NOT COSMETIC. `materialClass` is checked FIRST and independently,
 * so a caller who sets `frozen: true` and supplies a commitment on a `working`
 * material still gets refused for what it IS rather than for what it is
 * missing. That is the masquerade the spec's canary names: the failure mode is
 * not a draft that forgot a field, it is a draft dressed as a record.
 */
export function lockerAdmissionRefusals(material: WorkspaceMaterial): string[] {
  const refusals: string[] = [];
  if (material.materialClass !== 'authoritative') {
    refusals.push(`working-material-is-not-an-authoritative-artefact:${material.materialClass}`);
  }
  if (!material.frozen) {
    refusals.push('not-frozen');
  }
  if (!material.contentCommitment) {
    refusals.push('no-content-commitment');
  }
  return refusals;
}

/**
 * May this material enter the Locker? Derived from the refusal list so there is
 * ONE decision — a separate boolean implementation is how the two would come to
 * disagree, and the disagreeing pair would be undetectable from either side.
 */
export function isLockerAdmissible(material: WorkspaceMaterial): boolean {
  return lockerAdmissionRefusals(material).length === 0;
}

/**
 * Split a mixed list the way the two views render it. A `working` material can
 * NEVER appear in the Locker partition — the partition is computed from
 * `materialClass` and re-checked through `isLockerAdmissible`, so an
 * authoritative-but-unfrozen artefact falls to Working Materials rather than
 * rendering as a record. Failing toward the mutable side is the safe direction:
 * a record shown as a draft is a presentation error, a draft shown as a record
 * is a constitutional one.
 */
export function partitionMaterials(materials: WorkspaceMaterial[]): {
  working: WorkspaceMaterial[];
  locker: WorkspaceMaterial[];
} {
  const working: WorkspaceMaterial[] = [];
  const locker: WorkspaceMaterial[] = [];
  for (const m of materials) {
    if (isLockerAdmissible(m)) locker.push(m);
    else working.push(m);
  }
  return { working, locker };
}

// ─── Surface authority (SPEC §9) ─────────────────────────────────────────────

/**
 * What a SURFACE may cause, independent of who is looking at it.
 *
 * This is the second gate in the pair: `researchWorkspaceRoles` says what a
 * ROLE may do, and this says what a VIEW may cause. Both must permit an act.
 * The distinction matters for QubeTalk specifically — a Research Steward has
 * real authority, and the spec still forbids that authority being exercised
 * *through the chat surface*:
 *
 *   "No consequential research decision may remain only in QubeTalk."
 *
 * That is a claim about the CHANNEL, not about the person, so it cannot be
 * expressed in the role table and has to live here.
 */
export interface WorkspaceSurfaceAuthority {
  surface: string;
  /**
   * May an act on this surface change governed state — lifecycle stage,
   * freeze, canonisation, publication, review verdict?
   *
   * `false` on `qubetalk` is the spec's required canary. Deliberation is not a
   * decision; a decision reached in chat must be enacted on the surface that
   * owns it, where it produces a receipt.
   */
  mayMutateGovernedState: boolean;
  /** May an act on this surface admit an artefact to the Locker? */
  mayAdmitToLocker: boolean;
}

/**
 * Keyed by the view ids in `researchWorkspaceViews.ts`. A canary asserts the
 * two key sets match exactly, so a new view cannot arrive without a declared
 * authority — an undeclared surface would fall through to `undefined` and every
 * `?.mayMutateGovernedState` check on it would read falsy for the wrong reason.
 */
export const WORKSPACE_SURFACE_AUTHORITY: Record<string, WorkspaceSurfaceAuthority> = {
  overview: { surface: 'overview', mayMutateGovernedState: false, mayAdmitToLocker: false },
  // The Pipeline RENDERS the stage; advancing one is an act performed by the
  // capability that owns the transition (and receipted there), not by the view
  // that draws it.
  pipeline: { surface: 'pipeline', mayMutateGovernedState: false, mayAdmitToLocker: false },
  // Review submits review decisions — governed state, and the one surface whose
  // whole purpose is to produce them. IRL-REVIEW-001 still refuses the reviewer
  // any write to the SOURCE assets; that is its own invariant, not this gate's.
  review: { surface: 'review', mayMutateGovernedState: true, mayAdmitToLocker: false },
  'working-materials': {
    surface: 'working-materials',
    // Mutable by definition — but mutating a DRAFT is not mutating governed
    // state, which is exactly the distinction the two stores exist to keep.
    mayMutateGovernedState: false,
    // AND it cannot promote its own contents. Admission runs through
    // `lockerAdmissionRefusals`, from the Locker surface, on an artefact that
    // has already been frozen elsewhere. A Working Materials view that could
    // admit to the Locker would BE the masquerade.
    mayAdmitToLocker: false,
  },
  locker: { surface: 'locker', mayMutateGovernedState: false, mayAdmitToLocker: true },
  // THE SPEC'S REQUIRED CANARY. Deliberation only.
  qubetalk: { surface: 'qubetalk', mayMutateGovernedState: false, mayAdmitToLocker: false },
  evidence: { surface: 'evidence', mayMutateGovernedState: false, mayAdmitToLocker: false },
  participants: {
    surface: 'participants',
    // Access administration is governed state — invitations and grants are
    // receipted acts (`passport_privilege_changed`).
    mayMutateGovernedState: true,
    mayAdmitToLocker: false,
  },
  administration: {
    surface: 'administration',
    mayMutateGovernedState: true,
    mayAdmitToLocker: false,
  },
};

/**
 * The authority of a named surface. Returns a FAIL-CLOSED record for an unknown
 * surface rather than `undefined`, so a caller that forgets to null-check gets
 * "may do nothing" instead of a crash or a truthy object.
 */
export function workspaceSurfaceAuthority(surface: string): WorkspaceSurfaceAuthority {
  return (
    WORKSPACE_SURFACE_AUTHORITY[surface] ?? {
      surface,
      mayMutateGovernedState: false,
      mayAdmitToLocker: false,
    }
  );
}
