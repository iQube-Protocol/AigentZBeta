/**
 * IRL-REVIEW-001 — core object contract for the independent-review capability.
 *
 * Source of truth: `codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md`
 * §4 (core objects), §8 (reviewer independence), §10 (disagreement), §11 (receipt).
 *
 * ── This layer is deliberately GENERIC ──────────────────────────────────────
 *
 * Nothing in `services/research/review/*` (outside `templates/`) may name a
 * particular experiment, product, corpus or target. The first review instance
 * is a *template* that supplies the target statement, the namespace boundary,
 * the block ruling and the scrutiny vocabulary; it is not the capability's
 * hardcoded subject. `tests/independent-review-capability.test.ts` greps this
 * directory for instance-specific identifiers and fails the build if one
 * appears — the same discipline that stops a shared primitive from silently
 * becoming a single caller's private helper.
 *
 * ── Why the SPEC shapes are reproduced verbatim ─────────────────────────────
 *
 * The SPEC's field names ARE the contract: a receipt, a manifest and a
 * reviewer prompt are all read by parties who only have the SPEC. Fields are
 * added by extension (attribution, coverage, isolation evidence) and never
 * renamed or dropped, so a SPEC-only reader still finds everything §4 promises.
 */

// ── Roles and authority ─────────────────────────────────────────────────────

export type ReviewerSlot = 'R1' | 'R2';
export type ReviewerType = 'external-model' | 'internal-model' | 'human';
export type ReviewMode = 'single' | 'dual';

export type ReviewAssetType =
  | 'invariant-set'
  | 'protocol'
  | 'procedure'
  | 'preregistration'
  | 'result'
  | 'artifact'
  | 'governance-record'
  | 'replication-package'
  | 'other';

/**
 * The authority split (operator ruling, 2026-07-29). The point of naming four
 * roles is that the routine reviewer and the final governed authority are not
 * the same party — an arrangement that collapses the moment one person quietly
 * occupies every slot.
 *
 * `Independent Review Steward` is a standing role, not a person: it adjudicates
 * contested cases, private-source summaries, material exclusions and the
 * required sample. It has no power to edit source assets, grant Standing or
 * freeze anything.
 */
export type ReviewRole =
  | 'reviewer'
  | 'independent-review-steward'
  | 'operator';

export interface ReviewRoleAuthority {
  role: ReviewRole;
  /** Produces first-pass or second-pass adjudications over package subjects. */
  mayAdjudicate: boolean;
  /** Resolves the contested queue (and only the contested queue). */
  mayResolveContested: boolean;
  /** Resolves unresolved constitutional or scope disputes. */
  mayResolveScopeDispute: boolean;
  /** Approves the final governed freeze. Never the same act as a review. */
  mayApproveFreeze: boolean;
  /**
   * Literal `false` on every role, so "a reviewer may not write to the corpus"
   * is a type error rather than a paragraph. SPEC §14.10 / §16.
   */
  mayEditSourceAssets: false;
  /** Literal `false` for the same reason. SPEC §1: review does not ratify. */
  mayGrantStanding: false;
  mayCanonize: false;
  mayChangeLifecycle: false;
}

export const REVIEW_ROLE_AUTHORITY: Record<ReviewRole, ReviewRoleAuthority> = {
  reviewer: {
    role: 'reviewer',
    mayAdjudicate: true,
    mayResolveContested: false,
    mayResolveScopeDispute: false,
    mayApproveFreeze: false,
    mayEditSourceAssets: false,
    mayGrantStanding: false,
    mayCanonize: false,
    mayChangeLifecycle: false,
  },
  'independent-review-steward': {
    role: 'independent-review-steward',
    mayAdjudicate: true,
    mayResolveContested: true,
    mayResolveScopeDispute: false,
    mayApproveFreeze: false,
    mayEditSourceAssets: false,
    mayGrantStanding: false,
    mayCanonize: false,
    mayChangeLifecycle: false,
  },
  operator: {
    role: 'operator',
    mayAdjudicate: false,
    mayResolveContested: true,
    mayResolveScopeDispute: true,
    mayApproveFreeze: true,
    mayEditSourceAssets: false,
    mayGrantStanding: false,
    mayCanonize: false,
    mayChangeLifecycle: false,
  },
};

/**
 * Who holds the steward role for one review.
 *
 * `interim` exists because the first run of a new capability legitimately has
 * nobody trained in the role yet — but an interim arrangement that is never
 * written down becomes the permanent arrangement. So an interim steward must
 * state why, and the flag rides in the manifest where the next run can see it.
 */
export interface StewardAssignment {
  stewardRef: string;
  interim: boolean;
  /** Required when `interim` — an unexplained interim is refused. */
  interimReason?: string;
}

// ── Request, package, subjects ──────────────────────────────────────────────

export interface ReviewRequest {
  reviewId: string;
  experimentId?: string;
  assetType: ReviewAssetType;
  reviewMode: ReviewMode;
  reviewQuestion: string;
  /** The target statement. REQUIRED by this implementation — see reviewPackage.ts. */
  targetDefinition?: string;
  rubricId: string;
  packageRef: string;
  packageHash: string;
  requestedAt: string;
  requestedByRef: string;
}

/**
 * One row under review, as the reviewer sees it.
 *
 * Everything here is evidence about provenance and chronology. Nothing here is
 * a verdict: current eligibility labels, prior decisions, Standing, desired
 * counts, arm allocation and expected results are stripped by `blinding.ts`
 * before a package is sealed.
 */
export interface ReviewSubjectRecord {
  subjectRef: string;
  statement: string;
  namespace: string;
  /** Source provenance CLASS (how the evidence was obtained), not a verdict. */
  sourceProvenance: string | null;
  /** Where the claim came from. */
  sourceRefs: string[];
  /** How it was derived from those sources. */
  derivationRefs: string[];
  createdAt: string;
  revisedAt: string | null;
  lifecycleStatus: string;
  /**
   * Set when the underlying source is private and reaches the reviewer only
   * through a signed evidence summary. Drives mandatory second review.
   */
  privateEvidenceRef?: string;
}

export interface ReviewPackage {
  packageId: string;
  reviewId: string;
  assetRef: string;
  assetCommitment: string;
  sourceRefs: string[];
  evidenceSummaries?: string[];
  chronology?: string[];
  /** REQUIRED here even though SPEC §4 marks it optional. */
  targetDefinition: string;
  /** What the target explicitly is NOT — the confusions the reviewer must not make. */
  nonTargets: string[];
  rubricRef: string;
  rubricVersion: string;
  exclusionsFromPackage: string[];
  subjects: ReviewSubjectRecord[];
  /** Governed block decisions covering populations not enumerated row by row. */
  blockDecisions: BlockDecision[];
  createdAt: string;
  packageHash: string;
}

// ── Block decision (a governed ruling over a whole population) ───────────────

export interface BlockDecisionRuling {
  rulingId: string;
  rulingVersion: string;
  /** The ratified text, recorded verbatim. Paraphrase is not ratification. */
  text: string;
  authority: string;
  ratifiedAt: string;
}

export interface BlockExceptionRule {
  ruleId: string;
  reason: string;
  /** Pure predicate over one record. No IO, no clock, no randomness. */
  test: (record: ReviewSubjectRecord) => boolean;
}

export interface BlockException {
  subjectRef: string;
  ruleIds: string[];
  reasons: string[];
}

export interface BlockDecision {
  blockId: string;
  ruling: BlockDecisionRuling;
  /** The exact query that defines the population. Not a description of it. */
  populationQuery: string;
  assessed: number;
  admitted: number;
  extracted: BlockException[];
  namespaceCounts: Record<string, number>;
  createdAtCounts: Record<string, number>;
  earliestCreatedAt: string | null;
  latestCreatedAt: string | null;
  /** Recorded, because "tasks did not exist yet" is load-bearing evidence. */
  taskConstructionBegun: boolean;
  taskConstructionEvidence: string;
  /** Deterministic representative sample, per namespace. */
  representativeSample: string[];
  sampleSeed: string;
  samplePerNamespace: number;
  appliedRuleIds: string[];
}

// ── Reviewer assignment ─────────────────────────────────────────────────────

export interface ReviewerAssignment {
  reviewerSlot: ReviewerSlot;
  reviewerType: ReviewerType;
  provider?: string;
  requestedModelId?: string;
  resolvedModelId?: string;
  modelFamily?: string;
  /** Which catalogue field the family was read from — lineage is auditable. */
  modelFamilyEvidence?: string;
  /** Operator-declared lineage, recorded alongside the derived family. */
  declaredLineage?: string;
  /** Present for `reviewerType: 'human'`. */
  humanReviewerRef?: string;
  humanReviewerRole?: ReviewRole;
  promptVersion: string;
  rubricVersion: string;
  determinismSettings?: Record<string, unknown>;
}

// ── Decisions and resolutions ───────────────────────────────────────────────

export interface ReviewDecision {
  reviewId: string;
  reviewerSlot: ReviewerSlot;
  subjectRef: string;
  decision: string;
  reason: string;
  evidenceRefs: string[];
  limitations: string[];
  reviewedAt: string;
  rawOutputRef: string;
  outputHash: string;
  /** Attribution. SPEC §16 requires review packages be attributable. */
  reviewerRef: string;
  /**
   * Optional model-reported confidence. Carried for the record and NEVER
   * combined: `ReviewResolution` has no confidence field precisely so there is
   * nowhere for an average to live.
   */
  confidence?: number;
}

export type ReviewResolutionStatus =
  | 'agreed'
  | 'contested'
  | 'accepted'
  | 'rejected'
  | 'deferred'
  | 'unknown';

export interface ReviewResolution {
  reviewId: string;
  subjectRef: string;
  status: ReviewResolutionStatus;
  reviewer1Decision?: string;
  reviewer2Decision?: string;
  operatorDecision?: string;
  resolutionReason?: string;
  resolvedAt?: string;
  resolutionReceiptRef?: string;
}

// ── Errors ──────────────────────────────────────────────────────────────────

/** Base for every refusal this capability makes. All of them fail closed. */
export class ReviewRefusal extends Error {
  readonly refusalCode: string;
  constructor(refusalCode: string, message: string) {
    super(message);
    this.name = 'ReviewRefusal';
    this.refusalCode = refusalCode;
  }
}
