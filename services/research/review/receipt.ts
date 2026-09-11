/**
 * The review receipt (SPEC §11).
 *
 *   > "The receipt records the review event. It does not ratify the asset."
 *
 * That sentence is doctrine until it is data. A receipt is read downstream by
 * code and by people who did not read the SPEC; if the only thing distinguishing
 * "reviewed" from "approved" is the prose in a design document, then the first
 * consumer that treats the presence of a receipt as a green light is behaving
 * reasonably and the guarantee is gone.
 *
 * So the payload carries four explicit negative facts — `ratifiesAsset`,
 * `grantsStanding`, `changesLifecycle`, `freezesAsset` — typed as literal
 * `false`. There is no input that can set them, and a consumer reading the
 * receipt finds the disclaimer in the data it is already parsing.
 */

import { commit } from './deterministic';
import type { ResolutionTally } from './adjudication';
import type { BlockDecision, ReviewRequest, ReviewerAssignment, StewardAssignment } from './types';

/** Permitted DVN addition: a new anchorable action type and nothing else. */
export const REVIEW_RECEIPT_ACTION_TYPE = 'independent_review_completed' as const;

export interface ReviewReceiptPayload {
  reviewId: string;
  assetRef: string;
  assetCommitment: string;
  packageHash: string;
  rubricRef: string;
  rubricVersion: string;
  promptVersion: string;
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
  rawOutputCommitments: string[];
  parsedOutputCommitments: string[];
  blockDecisionCommitments: string[];
  agreedCount: number;
  contestedCount: number;
  rejectedCount: number;
  unknownCount: number;
  resolutionStatus: 'complete' | 'awaiting-governed-resolution';
  reviewStartedAt: string;
  reviewCompletedAt: string;

  // ── What this receipt is NOT. Data, not prose. ────────────────────────────
  ratifiesAsset: false;
  grantsStanding: false;
  changesLifecycle: false;
  freezesAsset: false;
  /** The one-line reading instruction, carried with the record. */
  authorityNote: string;
}

export const RECEIPT_AUTHORITY_NOTE =
  'This receipt records that an independent review took place. It does not ratify, approve, ' +
  'canonize, freeze or grant Standing to the reviewed asset. Acceptance and freeze remain ' +
  'separate governed acts.';

export interface BuildReviewReceiptInput {
  request: ReviewRequest;
  assetRef: string;
  assetCommitment: string;
  assignments: readonly ReviewerAssignment[];
  steward: StewardAssignment;
  blockDecisions: readonly BlockDecision[];
  rawOutputCommitments: readonly string[];
  parsedOutputCommitments: readonly string[];
  tally: ResolutionTally;
  promptVersion: string;
  rubricRef: string;
  rubricVersion: string;
  reviewStartedAt: string;
  reviewCompletedAt: string;
}

export function buildReviewReceipt(input: BuildReviewReceiptInput): {
  actionType: typeof REVIEW_RECEIPT_ACTION_TYPE;
  summary: string;
  payload: ReviewReceiptPayload;
  payloadCommitment: string;
} {
  const payload: ReviewReceiptPayload = {
    reviewId: input.request.reviewId,
    assetRef: input.assetRef,
    assetCommitment: input.assetCommitment,
    packageHash: input.request.packageHash,
    rubricRef: input.rubricRef,
    rubricVersion: input.rubricVersion,
    promptVersion: input.promptVersion,
    reviewMode: input.request.reviewMode,
    reviewers: input.assignments.map((a) => ({
      reviewerSlot: a.reviewerSlot,
      reviewerType: a.reviewerType,
      provider: a.provider ?? null,
      requestedModelId: a.requestedModelId ?? null,
      resolvedModelId: a.resolvedModelId ?? null,
      modelFamily: a.modelFamily ?? null,
      humanReviewerRef: a.humanReviewerRef ?? null,
    })),
    stewardRef: input.steward.stewardRef,
    stewardInterim: input.steward.interim,
    rawOutputCommitments: [...input.rawOutputCommitments],
    parsedOutputCommitments: [...input.parsedOutputCommitments],
    blockDecisionCommitments: input.blockDecisions.map((b) =>
      commit({ blockId: b.blockId, assessed: b.assessed, admitted: b.admitted, extracted: b.extracted }),
    ),
    agreedCount: input.tally.agreed,
    contestedCount: input.tally.contested,
    rejectedCount: input.tally.rejected,
    unknownCount: input.tally.unknown,
    resolutionStatus: input.tally.contested > 0 ? 'awaiting-governed-resolution' : 'complete',
    reviewStartedAt: input.reviewStartedAt,
    reviewCompletedAt: input.reviewCompletedAt,
    ratifiesAsset: false,
    grantsStanding: false,
    changesLifecycle: false,
    freezesAsset: false,
    authorityNote: RECEIPT_AUTHORITY_NOTE,
  };

  const summary =
    `Independent review ${input.request.reviewId} completed over package ${input.request.packageHash.slice(0, 16)}: ` +
    `${input.tally.agreed} agreed, ${input.tally.contested} contested, ${input.tally.rejected} rejected, ` +
    `${input.tally.unknown} unknown. Records the review event only — no ratification, no Standing, no freeze.`;

  return { actionType: REVIEW_RECEIPT_ACTION_TYPE, summary, payload, payloadCommitment: commit(payload) };
}

/**
 * Exported so a downstream consumer can ask the question directly instead of
 * inferring an answer from the receipt's existence.
 */
export function reviewReceiptGrantsApproval(_payload: ReviewReceiptPayload): false {
  return false;
}
