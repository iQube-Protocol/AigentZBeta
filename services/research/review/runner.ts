/**
 * The two-reviewer runner — SPEC §5's nine steps, as one testable function.
 *
 * ── Why this is a service and not a script ──────────────────────────────────
 *
 * Every invariant worth canarying lives in the ORCHESTRATION: that R2's prompt
 * carries no trace of R1's pass, that coverage is complete before dispatch,
 * that reproducibility artifacts are committed BEFORE the first model call,
 * that a partial run is not recorded as a review. None of that is checkable if
 * it lives in a CLI. So the orchestration is here, driven by an injected
 * provider and an injected clock, and the CLI is a thin shell that reads the
 * database, calls this, and writes files.
 *
 * ── No database, ever ───────────────────────────────────────────────────────
 *
 * This module — and every module in this directory — imports no database
 * client and performs no write. Reviewers receive a frozen package and return
 * decisions; they cannot reach the corpus even by accident, because the code
 * path they run through has no way to address it. `tests/…-capability.test.ts`
 * greps the directory to keep it that way.
 *
 * ── Order of operations is the reproducibility contract ─────────────────────
 *
 * The pre-run manifest (model ids, prompt version, rubric version, package
 * hash, determinism settings) is produced and returned BEFORE any provider is
 * called. Committing it afterwards would let a run that went badly be re-run
 * with different settings and still look like the original.
 */

import { commit } from './deterministic';
import { assertPromptCarriesNoPriorAdjudication } from './isolation';
import { assertCoverageComplete, selectReviewer2Coverage, type Reviewer2Coverage } from './coverage';
import { buildReviewerPrompt, INDEPENDENCE_PROMPT_VERSION, INDEPENDENCE_RUBRIC_ID, INDEPENDENCE_RUBRIC_VERSION } from './rubric';
import { assertReviewerIndependence } from './reviewerIndependence';
import { parseAdjudication, resolveDecisions, tallyResolutions, contestedQueue, type ResolutionTally } from './adjudication';
import { buildReviewReceipt, type ReviewReceiptPayload } from './receipt';
import { verifyPackageHash } from './reviewPackage';
import {
  ReviewRefusal,
  type ReviewDecision,
  type ReviewPackage,
  type ReviewRequest,
  type ReviewResolution,
  type ReviewerAssignment,
  type StewardAssignment,
} from './types';
import type { AdjudicationRequest, DeterminismSettings, ReviewProvider } from './providers';

export interface PreRunManifest {
  reviewId: string;
  packageId: string;
  packageHash: string;
  rubricRef: string;
  rubricVersion: string;
  promptVersion: string;
  determinism: DeterminismSettings;
  assignments: ReviewerAssignment[];
  steward: StewardAssignment;
  coverageSampleRate: number;
  coverageSampleSeed: string;
  committedAt: string;
  manifestCommitment: string;
}

export interface RunArtifacts {
  preRunManifest: PreRunManifest;
  r1Decisions: ReviewDecision[];
  r2Decisions: ReviewDecision[];
  coverage: Reviewer2Coverage;
  resolutions: ReviewResolution[];
  contested: ReviewResolution[];
  tally: ResolutionTally;
  rawOutputs: Array<{ reviewerSlot: string; rawOutputRef: string; raw: string; outputHash: string }>;
  unanswered: Array<{ reviewerSlot: string; subjectRefs: string[] }>;
  receipt: { actionType: string; summary: string; payload: ReviewReceiptPayload; payloadCommitment: string };
}

export interface RunDualReviewInput {
  request: ReviewRequest;
  pkg: ReviewPackage;
  r1: { assignment: ReviewerAssignment; provider: ReviewProvider };
  r2: { assignment: ReviewerAssignment; provider: ReviewProvider };
  steward: StewardAssignment;
  determinism: DeterminismSettings;
  coverage: { sampleRate: number; sampleSeed: string; mechanicallyFlagged: readonly string[] };
  assetRef: string;
  assetCommitment: string;
  /** Injected. No clock is read inside this module. */
  now: () => string;
  /** Optional observer for the CLI's progress output. */
  onStep?: (step: string, detail: string) => void;
}

export function buildPreRunManifest(input: {
  request: ReviewRequest;
  pkg: ReviewPackage;
  assignments: readonly ReviewerAssignment[];
  steward: StewardAssignment;
  determinism: DeterminismSettings;
  sampleRate: number;
  sampleSeed: string;
  committedAt: string;
}): PreRunManifest {
  const body = {
    reviewId: input.request.reviewId,
    packageId: input.pkg.packageId,
    packageHash: input.pkg.packageHash,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    promptVersion: INDEPENDENCE_PROMPT_VERSION,
    determinism: input.determinism,
    assignments: input.assignments.map((a) => ({ ...a })),
    steward: { ...input.steward },
    coverageSampleRate: input.sampleRate,
    coverageSampleSeed: input.sampleSeed,
    committedAt: input.committedAt,
  };
  return { ...body, manifestCommitment: commit(body) };
}

function assertStewardWellFormed(steward: StewardAssignment): void {
  if (!steward.stewardRef.trim()) {
    throw new ReviewRefusal('missing-steward', 'a review requires a named Independent Review Steward');
  }
  if (steward.interim && !steward.interimReason?.trim()) {
    throw new ReviewRefusal(
      'unexplained-interim-steward',
      'an interim steward must record why the arrangement is interim. An interim arrangement that ' +
        'is never written down becomes the permanent one.',
    );
  }
}

/**
 * Run both passes. Throws — never returns a partial result — because a review
 * that stopped halfway is not a review with fewer rows, it is a review that did
 * not happen.
 */
export async function runDualReview(input: RunDualReviewInput): Promise<RunArtifacts> {
  const step = input.onStep ?? (() => {});

  if (!verifyPackageHash(input.pkg)) {
    throw new ReviewRefusal(
      'package-hash-mismatch',
      `package ${input.pkg.packageId} does not hash to its recorded packageHash — it was modified after sealing`,
    );
  }
  if (input.request.packageHash !== input.pkg.packageHash) {
    throw new ReviewRefusal('request-package-mismatch', 'the review request references a different package hash');
  }
  assertStewardWellFormed(input.steward);
  assertReviewerIndependence(input.r1.assignment, input.r2.assignment);

  const startedAt = input.now();
  const preRunManifest = buildPreRunManifest({
    request: input.request,
    pkg: input.pkg,
    assignments: [input.r1.assignment, input.r2.assignment],
    steward: input.steward,
    determinism: input.determinism,
    sampleRate: input.coverage.sampleRate,
    sampleSeed: input.coverage.sampleSeed,
    committedAt: startedAt,
  });
  step('pre-run-manifest', preRunManifest.manifestCommitment);

  const rawOutputs: RunArtifacts['rawOutputs'] = [];
  const unanswered: RunArtifacts['unanswered'] = [];

  // ── Reviewer 1: the complete package ──────────────────────────────────────
  const r1Subjects = input.pkg.subjects;
  const r1Prompt = buildReviewerPrompt({
    reviewerSlot: 'R1',
    pkg: input.pkg,
    subjects: r1Subjects,
    includeBlockDecisions: true,
  });
  assertPromptCarriesNoPriorAdjudication('R1', r1Prompt, []);

  const r1Request: AdjudicationRequest = {
    modelId: input.r1.assignment.resolvedModelId ?? input.r1.assignment.requestedModelId ?? 'human',
    system: r1Prompt.system,
    user: r1Prompt.user,
    determinism: input.determinism,
  };
  step('dispatch-r1', `${r1Subjects.length} subjects to ${input.r1.provider.providerName}`);
  const r1Raw = await input.r1.provider.adjudicate(r1Request);
  const r1RawRef = `raw/${input.request.reviewId}/R1`;
  const r1Parsed = parseAdjudication({
    reviewId: input.request.reviewId,
    reviewerSlot: 'R1',
    reviewerRef: input.r1.assignment.humanReviewerRef ?? `${input.r1.provider.providerName}:${r1Request.modelId}`,
    raw: r1Raw.raw,
    rawOutputRef: r1RawRef,
    reviewedAt: input.now(),
    expectedSubjectRefs: r1Subjects.map((s) => s.subjectRef),
  });
  rawOutputs.push({ reviewerSlot: 'R1', rawOutputRef: r1RawRef, raw: r1Raw.raw, outputHash: r1Parsed.outputHash });
  if (r1Parsed.unanswered.length > 0) unanswered.push({ reviewerSlot: 'R1', subjectRefs: r1Parsed.unanswered });
  step('parsed-r1', `${r1Parsed.decisions.length} decisions, ${r1Parsed.unanswered.length} unanswered`);

  // ── Coverage: WHICH rows R2 sees may depend on R1. WHAT R1 said may not. ──
  const coverage = selectReviewer2Coverage({
    subjects: input.pkg.subjects,
    r1Decisions: r1Parsed.decisions,
    packageExclusions: input.pkg.exclusionsFromPackage,
    mechanicallyFlagged: input.coverage.mechanicallyFlagged,
    sampleRate: input.coverage.sampleRate,
    sampleSeed: input.coverage.sampleSeed,
  });
  assertCoverageComplete(coverage, {
    subjects: input.pkg.subjects,
    r1Decisions: r1Parsed.decisions,
    packageExclusions: input.pkg.exclusionsFromPackage,
    mechanicallyFlagged: input.coverage.mechanicallyFlagged,
    sampleRate: input.coverage.sampleRate,
    sampleSeed: input.coverage.sampleSeed,
  });
  step('coverage', `${coverage.subjectRefs.length} rows to second review`);

  const coveredSet = new Set(coverage.subjectRefs);
  const r2Subjects = input.pkg.subjects.filter((s) => coveredSet.has(s.subjectRef));
  if (r2Subjects.length === 0) {
    throw new ReviewRefusal(
      'empty-second-review',
      'second review selected no rows. In dual mode that is a construction error, not a clean result.',
    );
  }

  const r2Prompt = buildReviewerPrompt({
    reviewerSlot: 'R2',
    pkg: input.pkg,
    subjects: r2Subjects,
    includeBlockDecisions: false,
  });
  // The isolation gate, applied to the FINAL text about to leave the process.
  assertPromptCarriesNoPriorAdjudication('R2', r2Prompt, r1Parsed.decisions);

  const r2Request: AdjudicationRequest = {
    modelId: input.r2.assignment.resolvedModelId ?? input.r2.assignment.requestedModelId ?? 'human',
    system: r2Prompt.system,
    user: r2Prompt.user,
    determinism: input.determinism,
  };
  step('dispatch-r2', `${r2Subjects.length} subjects to ${input.r2.provider.providerName}`);
  const r2Raw = await input.r2.provider.adjudicate(r2Request);
  const r2RawRef = `raw/${input.request.reviewId}/R2`;
  const r2Parsed = parseAdjudication({
    reviewId: input.request.reviewId,
    reviewerSlot: 'R2',
    reviewerRef: input.r2.assignment.humanReviewerRef ?? `${input.r2.provider.providerName}:${r2Request.modelId}`,
    raw: r2Raw.raw,
    rawOutputRef: r2RawRef,
    reviewedAt: input.now(),
    expectedSubjectRefs: r2Subjects.map((s) => s.subjectRef),
  });
  rawOutputs.push({ reviewerSlot: 'R2', rawOutputRef: r2RawRef, raw: r2Raw.raw, outputHash: r2Parsed.outputHash });
  if (r2Parsed.unanswered.length > 0) unanswered.push({ reviewerSlot: 'R2', subjectRefs: r2Parsed.unanswered });
  step('parsed-r2', `${r2Parsed.decisions.length} decisions, ${r2Parsed.unanswered.length} unanswered`);

  const completedAt = input.now();
  const resolutions = resolveDecisions({
    reviewId: input.request.reviewId,
    subjectRefs: input.pkg.subjects.map((s) => s.subjectRef),
    r1: r1Parsed.decisions,
    r2: r2Parsed.decisions,
    r2Coverage: coverage.subjectRefs,
    resolvedAt: completedAt,
  });
  const tally = tallyResolutions(resolutions);
  const contested = contestedQueue(resolutions);
  step('resolved', `${tally.agreed} agreed, ${tally.contested} contested, ${tally.unknown} unknown`);

  const receipt = buildReviewReceipt({
    request: input.request,
    assetRef: input.assetRef,
    assetCommitment: input.assetCommitment,
    assignments: [input.r1.assignment, input.r2.assignment],
    steward: input.steward,
    blockDecisions: input.pkg.blockDecisions,
    rawOutputCommitments: rawOutputs.map((r) => r.outputHash),
    parsedOutputCommitments: [commit(r1Parsed.decisions), commit(r2Parsed.decisions)],
    tally,
    promptVersion: INDEPENDENCE_PROMPT_VERSION,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    reviewStartedAt: startedAt,
    reviewCompletedAt: completedAt,
  });

  return {
    preRunManifest,
    r1Decisions: r1Parsed.decisions,
    r2Decisions: r2Parsed.decisions,
    coverage,
    resolutions,
    contested,
    tally,
    rawOutputs,
    unanswered,
    receipt,
  };
}

/**
 * Relations + exclusions export, in the shape a downstream snapshot exporter
 * already consumes (a `{ subjectRef: reviewRecord }` map).
 *
 * Only `agreed` rows carry a relation forward. Contested and unknown rows are
 * exported with NO relation, which such an exporter reads as `unknown` and
 * fails closed on — the fail-closed behaviour is therefore inherited rather
 * than reimplemented, and a bug here cannot open a gate the exporter would
 * close.
 */
export function exportRelations(input: {
  resolutions: readonly ReviewResolution[];
  decisions: readonly ReviewDecision[];
  reviewerRef: string;
  reviewedAt: string;
}): { relations: Record<string, unknown>; exclusions: Array<{ subjectRef: string; status: string; reason: string }> } {
  const reasonBy = new Map<string, string>();
  for (const d of input.decisions) if (!reasonBy.has(d.subjectRef)) reasonBy.set(d.subjectRef, d.reason);

  const relations: Record<string, unknown> = {};
  const exclusions: Array<{ subjectRef: string; status: string; reason: string }> = [];
  for (const r of input.resolutions) {
    if (r.status === 'agreed' && r.reviewer1Decision) {
      relations[r.subjectRef] = {
        relationship: r.reviewer1Decision,
        reason: reasonBy.get(r.subjectRef) ?? '',
        reviewer: input.reviewerRef,
        reviewedAt: input.reviewedAt,
        sourceRefs: [],
      };
    } else {
      exclusions.push({
        subjectRef: r.subjectRef,
        status: r.status,
        reason: r.resolutionReason ?? reasonBy.get(r.subjectRef) ?? 'no reason recorded',
      });
    }
  }
  return { relations, exclusions };
}
