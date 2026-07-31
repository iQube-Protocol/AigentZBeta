/**
 * independentReviewPublish — governed publication of a completed,
 * CLI-executed independent review into the store the Review Result panel
 * reads (`research_objects`, via independentReviewStore.ts).
 *
 * Deliberately separate from `scripts/run-independence-review.ts --execute`:
 * execution and publication are distinct governed acts (operator ruling
 * 2026-07-31). This fixes the 2026-07-31 incident where the CLI runner's
 * real completed result (119 agreed / 19 contested / 5 rejected / 1
 * unknown) was never written to Supabase — the runner is documented as
 * read-only to the database ("the ONLY part of the review path that
 * touches a database, and it touches it read-only") and writes its
 * artifacts only to local files. The web UI's own writer only ever
 * produces a 'planned' row. Nothing reconciled the two.
 *
 * ── Pure logic, no I/O ───────────────────────────────────────────────────
 *
 * This module takes already-parsed artifact JSON in and returns a
 * validated ReviewRecord out (or a typed refusal) — no filesystem, no
 * Supabase client. That split makes every refusal path directly testable
 * with synthetic fixtures (tests/independent-review-publish.test.ts)
 * without needing the real completed artifacts, and mirrors this
 * codebase's existing discipline (services/research/review/* takes data in
 * and returns artifacts out; the CLI script is the thin I/O shell).
 *
 * ── What "publish" is NOT ────────────────────────────────────────────────
 *
 * This module never sets `action`/`actionReason`/`actionByRef` — those
 * fields exist ONLY for a human's later governed resolution (accept/
 * revise/defer/reject) via the Review Result panel. Publishing a completed
 * review makes its real result visible; it does not resolve it, ratify it,
 * grant Standing, change any asset's lifecycle, or freeze anything. The
 * receipt's own `ratifiesAsset`/`grantsStanding`/`changesLifecycle`/
 * `freezesAsset` fields are independently checked to literally be `false`
 * before publication proceeds — a mutated or forged receipt claiming
 * otherwise is refused, not trusted.
 */

import { verifyPackageHash } from '@/services/research/review/reviewPackage';
import { commit } from '@/services/research/review/deterministic';
import type {
  ReviewPackage,
  ReviewDecision,
  ReviewResolution,
  ReviewRequest,
  ReviewerAssignment,
  StewardAssignment,
} from '@/services/research/review/types';
import type { ResolutionTally } from '@/services/research/review/adjudication';
import { EXP_P1_REVIEW_QUESTION } from '@/services/research/review/templates/expP1Admissibility';
import { INDEPENDENCE_RUBRIC_ID } from '@/services/research/review/rubric';
import type { ReviewRecord, ReviewQueueState } from '@/services/research/independentReviewStore';

export interface ReviewReceiptArtifact {
  actionType: string;
  summary: string;
  payload: {
    reviewId: string;
    assetRef: string;
    assetCommitment: string;
    packageHash: string;
    rubricRef: string;
    rubricVersion: string;
    reviewMode: ReviewRequest['reviewMode'];
    reviewers: Array<{
      reviewerSlot: string;
      reviewerType: string;
      provider: string | null;
      requestedModelId: string | null;
      resolvedModelId: string | null;
      modelFamily: string | null;
      humanReviewerRef: string | null;
    }>;
    stewardRef: string;
    stewardInterim: boolean;
    agreedCount: number;
    contestedCount: number;
    rejectedCount: number;
    unknownCount: number;
    reviewStartedAt: string;
    reviewCompletedAt: string;
    ratifiesAsset: boolean;
    grantsStanding: boolean;
    changesLifecycle: boolean;
    freezesAsset: boolean;
  };
  payloadCommitment: string;
}

export interface CompletedReviewArtifacts {
  package: ReviewPackage;
  decisions: { r1: ReviewDecision[]; r2: ReviewDecision[]; coverage?: unknown };
  resolutions: { resolutions: ReviewResolution[]; contested?: unknown[]; tally: ResolutionTally };
  receipt: ReviewReceiptArtifact;
}

export type PublishRefusalCode =
  | 'review-id-mismatch'
  | 'package-hash-invalid'
  | 'receipt-commitment-invalid'
  | 'package-receipt-hash-mismatch'
  | 'receipt-claims-authority'
  | 'tally-mismatch'
  | 'empty-decisions'
  | 'empty-resolutions';

export interface PublishRefusal {
  ok: false;
  refusalCode: PublishRefusalCode;
  message: string;
}

export interface PublishSuccess {
  ok: true;
  record: Omit<ReviewRecord, 'createdAt' | 'updatedAt'>;
}

/** Derives the experiment version prefix from a reviewId like
 * "review.vP1.4e379af743c8" -> "vP1". Used only to reconstruct the
 * deterministic `packageRef` path convention run-independence-review.ts
 * itself uses — never to invent a value not already implied by the id. */
function deriveVersion(reviewId: string): string {
  const parts = reviewId.split('.');
  return parts.length >= 2 ? parts[1] : 'unknown';
}

/**
 * Validate a completed review's artifact set and build the ReviewRecord to
 * publish. Refuses (never partially writes) on any hash mismatch, any
 * internal inconsistency, or any sign the receipt claims authority it
 * structurally cannot have.
 */
export function validateAndBuildPublishedReview(
  artifacts: CompletedReviewArtifacts,
  expectedReviewId: string,
  importedFrom: { artifactDir: string; importedAt: string },
): PublishRefusal | PublishSuccess {
  const { package: pkg, decisions, resolutions, receipt } = artifacts;

  if (pkg.reviewId !== expectedReviewId || receipt.payload.reviewId !== expectedReviewId) {
    return {
      ok: false,
      refusalCode: 'review-id-mismatch',
      message: `artifact reviewId does not match the expected id ${expectedReviewId} (package=${pkg.reviewId}, receipt=${receipt.payload.reviewId})`,
    };
  }

  if (!verifyPackageHash(pkg)) {
    return {
      ok: false,
      refusalCode: 'package-hash-invalid',
      message: `package ${pkg.packageId} does not reproduce its own packageHash — the artifact is corrupt or was hand-edited`,
    };
  }

  const { payloadCommitment, ...receiptWithoutCommitment } = receipt;
  if (commit(receiptWithoutCommitment.payload) !== payloadCommitment) {
    return {
      ok: false,
      refusalCode: 'receipt-commitment-invalid',
      message: 'receipt payloadCommitment does not match a recomputed commit of the receipt payload — the receipt artifact is corrupt or was hand-edited',
    };
  }

  if (receipt.payload.packageHash !== pkg.packageHash) {
    return {
      ok: false,
      refusalCode: 'package-receipt-hash-mismatch',
      message: `receipt references packageHash ${receipt.payload.packageHash} but the supplied package hashes to ${pkg.packageHash} — these artifacts are not from the same run`,
    };
  }

  if (
    receipt.payload.ratifiesAsset !== false ||
    receipt.payload.grantsStanding !== false ||
    receipt.payload.changesLifecycle !== false ||
    receipt.payload.freezesAsset !== false
  ) {
    return {
      ok: false,
      refusalCode: 'receipt-claims-authority',
      message: 'receipt claims ratification/Standing/lifecycle/freeze authority it structurally cannot have — refusing to publish a receipt that does not honestly disclaim authority',
    };
  }

  if (decisions.r1.length === 0 || decisions.r2.length === 0) {
    return {
      ok: false,
      refusalCode: 'empty-decisions',
      message: 'both R1 and R2 decision sets must be non-empty for a completed dual-review publication',
    };
  }

  if (resolutions.resolutions.length === 0) {
    return { ok: false, refusalCode: 'empty-resolutions', message: 'resolutions artifact contains no resolved subjects' };
  }

  const computedTally = {
    agreed: resolutions.resolutions.filter((r) => r.status === 'agreed').length,
    contested: resolutions.resolutions.filter((r) => r.status === 'contested').length,
    rejected: resolutions.resolutions.filter((r) => r.status === 'rejected').length,
    unknown: resolutions.resolutions.filter((r) => r.status === 'unknown').length,
  };
  const tallyMatchesResolutions =
    computedTally.agreed === resolutions.tally.agreed &&
    computedTally.contested === resolutions.tally.contested &&
    computedTally.rejected === resolutions.tally.rejected &&
    computedTally.unknown === resolutions.tally.unknown;
  const tallyMatchesReceipt =
    resolutions.tally.agreed === receipt.payload.agreedCount &&
    resolutions.tally.contested === receipt.payload.contestedCount &&
    resolutions.tally.rejected === receipt.payload.rejectedCount &&
    resolutions.tally.unknown === receipt.payload.unknownCount;
  if (!tallyMatchesResolutions || !tallyMatchesReceipt) {
    return {
      ok: false,
      refusalCode: 'tally-mismatch',
      message:
        `tally is inconsistent across artifacts — resolutions array: ${JSON.stringify(computedTally)}, ` +
        `resolutions.tally: ${JSON.stringify(resolutions.tally)}, receipt counts: ` +
        `${JSON.stringify({ agreed: receipt.payload.agreedCount, contested: receipt.payload.contestedCount, rejected: receipt.payload.rejectedCount, unknown: receipt.payload.unknownCount })}`,
    };
  }

  const version = deriveVersion(expectedReviewId);
  const assignments: ReviewerAssignment[] = receipt.payload.reviewers.map((r) => ({
    reviewerSlot: r.reviewerSlot as ReviewerAssignment['reviewerSlot'],
    reviewerType: r.reviewerType as ReviewerAssignment['reviewerType'],
    provider: r.provider ?? undefined,
    requestedModelId: r.requestedModelId ?? undefined,
    resolvedModelId: r.resolvedModelId ?? undefined,
    modelFamily: r.modelFamily ?? undefined,
  }));
  const steward: StewardAssignment = { stewardRef: receipt.payload.stewardRef, interim: receipt.payload.stewardInterim };

  // Every field below traces to either the artifacts themselves or a fixed,
  // imported constant this same experiment's runner uses (EXP_P1_REVIEW_QUESTION,
  // INDEPENDENCE_RUBRIC_ID, the 'invariant-set' assetType literal) — never a
  // guessed value. The one thing NOT recoverable from the 4 required
  // artifacts (a `.request.json` file the runner never writes) is
  // reconstructed deterministically from those constants plus the receipt.
  const request: ReviewRequest = {
    reviewId: expectedReviewId,
    experimentId: `EXP-P1/${version}`,
    assetType: 'invariant-set',
    reviewMode: receipt.payload.reviewMode,
    reviewQuestion: EXP_P1_REVIEW_QUESTION,
    targetDefinition: pkg.targetDefinition,
    rubricId: INDEPENDENCE_RUBRIC_ID,
    packageRef: `codexes/packs/irl/foundation/reviews/${version}/${expectedReviewId}/run-manifest.json`,
    packageHash: pkg.packageHash,
    requestedAt: receipt.payload.reviewStartedAt,
    requestedByRef: receipt.payload.stewardRef,
  };

  const queueState: ReviewQueueState = computedTally.contested > 0 ? 'contested' : 'completed';

  return {
    ok: true,
    record: {
      reviewId: expectedReviewId,
      queueState,
      request,
      package: pkg,
      assignments,
      steward,
      blockDecisions: [...pkg.blockDecisions],
      r1Decisions: decisions.r1,
      r2Decisions: decisions.r2,
      resolutions: resolutions.resolutions,
      action: null,
      actionReason: null,
      actionByRef: null,
      actionAt: null,
      receiptId: null,
      // Provenance — never omitted for a CLI-imported review (operator
      // ruling 2026-07-31): source, and exactly where/when it was imported
      // from, ride alongside the record so a reader never mistakes an
      // import for a web-submitted review.
      source: 'cli-independent-review',
      importedFrom,
    } as Omit<ReviewRecord, 'createdAt' | 'updatedAt'>,
  };
}
