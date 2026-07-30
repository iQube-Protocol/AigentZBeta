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
import { assertCoverageComplete, selectReviewer2Coverage, type Reviewer2Coverage } from './coverage';
import { INDEPENDENCE_PROMPT_VERSION, INDEPENDENCE_RUBRIC_ID, INDEPENDENCE_RUBRIC_VERSION } from './rubric';
import { assertReviewerIndependence } from './reviewerIndependence';
import { resolveDecisions, tallyResolutions, contestedQueue, type ResolutionTally } from './adjudication';
import { buildReviewReceipt, type ReviewReceiptPayload } from './receipt';
import { verifyPackageHash } from './reviewPackage';
import {
  buildBatchPlan,
  runBatchedAdjudication,
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_ATTEMPTS_PER_BATCH,
  type BatchAttemptRecord,
  type BatchPlan,
} from './batching';
import {
  ReviewRefusal,
  type ReviewDecision,
  type ReviewPackage,
  type ReviewRequest,
  type ReviewResolution,
  type ReviewerAssignment,
  type ReviewerSlot,
  type StewardAssignment,
} from './types';
import type { DeterminismSettings, ReviewProvider } from './providers';

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
  /**
   * Dispatch is batched (rulings 2026-07-29): a reviewer's assignment is
   * partitioned into batches of at most this many subjects rather than sent
   * as one completion. Frozen here, before any provider is called, so a
   * rerun cannot quietly change the partition and still look like the
   * original (rulings §1).
   */
  batchSize: number;
  maxAttemptsPerBatch: number;
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
  /** The deterministic batch partition each reviewer was actually dispatched against. */
  r1BatchPlan: BatchPlan;
  r2BatchPlan: BatchPlan;
  /** Every batch dispatch attempt, successful or not — the audit trail rulings §6 asks for. */
  r1BatchAttempts: BatchAttemptRecord[];
  r2BatchAttempts: BatchAttemptRecord[];
}

export interface RunDualReviewInput {
  request: ReviewRequest;
  pkg: ReviewPackage;
  r1: { assignment: ReviewerAssignment; provider: ReviewProvider };
  r2: { assignment: ReviewerAssignment; provider: ReviewProvider };
  steward: StewardAssignment;
  determinism: DeterminismSettings;
  coverage: {
    sampleRate: number;
    sampleSeed: string;
    mechanicallyFlagged: readonly string[];
    /** Operator-directed full coverage for this run — see coverage.ts. Optional; defaults off. */
    fullCoveragePolicy?: boolean;
  };
  assetRef: string;
  assetCommitment: string;
  /** Injected. No clock is read inside this module. */
  now: () => string;
  /**
   * Pins the pre-run-manifest's `committedAt` to an exact prior value —
   * used ONLY when resuming a run, to reproduce the identical manifest
   * commitment (and hence identical batchHashes) an interrupted run already
   * committed to. Omitted by both existing consumers; defaults to `now()`.
   */
  startedAt?: string;
  /** Optional observer for the CLI's progress output. */
  onStep?: (step: string, detail: string) => void;
  /**
   * Batch size + retry policy. Optional — both consumers (the CLI and the
   * Lab route) omit this and get the frozen defaults, so this is additive:
   * neither consumer's call shape has to change to get batched dispatch.
   */
  batching?: { batchSize?: number; maxAttemptsPerBatch?: number };
  /**
   * Previously accepted batch attempts to resume from, per reviewer slot — a
   * rerun after a partial failure need only redispatch the unresolved
   * batches (rulings §6, "resume safety"). Optional; omitted by both
   * consumers today.
   */
  resumeFrom?: { r1?: readonly BatchAttemptRecord[]; r2?: readonly BatchAttemptRecord[] };
  /**
   * Restrict this call to one reviewer pass (2026-07-30, reviewer-slot
   * control). `'r2-only'` means R1 is NOT dispatched at all — its decisions
   * come entirely from `resumeFrom.r1`, which must already cover every one
   * of R1's subjects (verified before anything else happens; missing
   * coverage refuses rather than silently treating gaps as `unanswered`).
   * `runBatchedAdjudication` is never called for R1 in this mode — not "zero
   * calls happened to occur," but the call itself does not exist on this
   * path. Default `'both'`.
   */
  reviewerMode?: 'both' | 'r2-only';
  /**
   * Checkpoint persistence hooks (2026-07-30 resilience amendment). Optional
   * and additive — omitted by both existing consumers (the CLI without
   * `--resume`, and the Lab route), which get identical behaviour to before
   * this field existed. When supplied, `onBatchAccepted` fires once per
   * FRESH batch acceptance (R1 or R2), and `onR2BatchPlanFrozen` fires the
   * moment R2's batch plan is computed — BEFORE its first dispatch — so a
   * caller can persist the frozen plan before any R2 batch executes (rulings:
   * "a resumed run must use the same batch size and exact batch membership").
   */
  checkpoint?: {
    onBatchAccepted?: (
      reviewerSlot: ReviewerSlot,
      input: { batchId: string; batchHash: string; attempt: BatchAttemptRecord; decisions: ReviewDecision[] },
    ) => void | Promise<void>;
    /** Fired right after R1's batch plan is built, before its first dispatch. */
    onR1BatchPlanReady?: (batchPlan: BatchPlan) => void | Promise<void>;
    onR2BatchPlanFrozen?: (batchPlan: BatchPlan) => void | Promise<void>;
  };
}

export function buildPreRunManifest(input: {
  request: ReviewRequest;
  pkg: ReviewPackage;
  assignments: readonly ReviewerAssignment[];
  steward: StewardAssignment;
  determinism: DeterminismSettings;
  sampleRate: number;
  sampleSeed: string;
  batchSize: number;
  maxAttemptsPerBatch: number;
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
    batchSize: input.batchSize,
    maxAttemptsPerBatch: input.maxAttemptsPerBatch,
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

  const batchSize = input.batching?.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxAttemptsPerBatch = input.batching?.maxAttemptsPerBatch ?? DEFAULT_MAX_ATTEMPTS_PER_BATCH;

  // A resumed run MUST reproduce the identical pre-run-manifest commitment —
  // every batchHash is bound to it, so a fresh `committedAt` on resume would
  // make EVERY checkpoint's batchHash mismatch even though nothing else
  // changed. `startedAt` lets a resuming caller pin this to the ORIGINAL
  // run's `committedAt` (read back from its manifest) while `input.now()`
  // still supplies every OTHER timestamp in this run fresh (decision
  // `reviewedAt`, `completedAt`) — only the manifest-commitment instant is
  // pinned, nothing else is backdated.
  const startedAt = input.startedAt ?? input.now();
  const preRunManifest = buildPreRunManifest({
    request: input.request,
    pkg: input.pkg,
    assignments: [input.r1.assignment, input.r2.assignment],
    steward: input.steward,
    determinism: input.determinism,
    sampleRate: input.coverage.sampleRate,
    sampleSeed: input.coverage.sampleSeed,
    batchSize,
    maxAttemptsPerBatch,
    committedAt: startedAt,
  });
  step('pre-run-manifest', preRunManifest.manifestCommitment);

  const rawOutputs: RunArtifacts['rawOutputs'] = [];
  const unanswered: RunArtifacts['unanswered'] = [];

  // ── Reviewer 1: the complete package, partitioned into deterministic ──────
  // batches (rulings 2026-07-29). The batch plan is frozen against the
  // pre-run manifest commitment BEFORE any provider is called — same timing
  // guarantee the manifest itself already gave the rest of this run.
  const r1Subjects = input.pkg.subjects;
  const r1BatchPlan = buildBatchPlan({
    reviewerSlot: 'R1',
    packageHash: input.pkg.packageHash,
    manifestHash: preRunManifest.manifestCommitment,
    subjectRefs: r1Subjects.map((s) => s.subjectRef),
    batchSize,
  });

  let r1Outcome: Awaited<ReturnType<typeof runBatchedAdjudication>>;
  if (input.reviewerMode === 'r2-only') {
    // R1 is NOT dispatched — runBatchedAdjudication is never called on this
    // path. Every one of R1's subjects must already have a decision supplied
    // via resumeFrom.r1; any gap refuses rather than silently treating it as
    // unanswered (SPEC-level fail-closed behaviour, same as the dispatched
    // path's own completeness contract).
    step('batch-plan-r1', `${r1BatchPlan.batches.length} batch(es) of up to ${batchSize} — NOT dispatched (reviewerMode=r2-only)`);
    const decisionByRef = new Map<string, ReviewDecision>();
    for (const attempt of input.resumeFrom?.r1 ?? []) {
      for (const d of attempt.decisions ?? []) decisionByRef.set(d.subjectRef, d);
    }
    const missing = r1Subjects.map((s) => s.subjectRef).filter((ref) => !decisionByRef.has(ref));
    if (missing.length > 0) {
      throw new ReviewRefusal(
        'r2-only-requires-complete-r1',
        `reviewerMode 'r2-only' requires every R1 subject to already have a decision via resumeFrom.r1; ` +
          `missing ${missing.length}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}. ` +
          'R1 is not dispatched in this mode — it cannot fill the gap.',
      );
    }
    r1Outcome = {
      decisions: r1Subjects.map((s) => decisionByRef.get(s.subjectRef)!),
      unanswered: [],
      rawOutputs: [],
      attempts: [...(input.resumeFrom?.r1 ?? [])],
    };
    step('r1-skipped', `${r1Outcome.decisions.length} decisions sourced entirely from resumeFrom.r1 — no dispatch`);
  } else {
    step('batch-plan-r1', `${r1BatchPlan.batches.length} batch(es) of up to ${batchSize}`);
    await input.checkpoint?.onR1BatchPlanReady?.(r1BatchPlan);

    const r1ModelId = input.r1.assignment.resolvedModelId ?? input.r1.assignment.requestedModelId ?? 'human';
    step('dispatch-r1', `${r1Subjects.length} subjects to ${input.r1.provider.providerName} across ${r1BatchPlan.batches.length} batch(es)`);
    r1Outcome = await runBatchedAdjudication({
      reviewId: input.request.reviewId,
      reviewerSlot: 'R1',
      reviewerRef: input.r1.assignment.humanReviewerRef ?? `${input.r1.provider.providerName}:${r1ModelId}`,
      pkg: input.pkg,
      subjects: r1Subjects,
      includeBlockDecisions: true,
      priorForeignDecisions: [],
      provider: input.r1.provider,
      modelId: r1ModelId,
      determinism: input.determinism,
      batchPlan: r1BatchPlan,
      maxAttemptsPerBatch,
      now: input.now,
      onStep: step,
      resumeFrom: input.resumeFrom?.r1,
      onBatchAccepted: input.checkpoint?.onBatchAccepted
        ? (b) => input.checkpoint!.onBatchAccepted!('R1', b)
        : undefined,
    });
  }
  rawOutputs.push(...r1Outcome.rawOutputs);
  if (r1Outcome.unanswered.length > 0) unanswered.push({ reviewerSlot: 'R1', subjectRefs: r1Outcome.unanswered });
  step('parsed-r1', `${r1Outcome.decisions.length} decisions, ${r1Outcome.unanswered.length} unanswered`);

  // ── Coverage: WHICH rows R2 sees may depend on R1. WHAT R1 said may not. ──
  const coverage = selectReviewer2Coverage({
    subjects: input.pkg.subjects,
    r1Decisions: r1Outcome.decisions,
    packageExclusions: input.pkg.exclusionsFromPackage,
    mechanicallyFlagged: input.coverage.mechanicallyFlagged,
    sampleRate: input.coverage.sampleRate,
    sampleSeed: input.coverage.sampleSeed,
    fullCoveragePolicy: input.coverage.fullCoveragePolicy,
  });
  assertCoverageComplete(coverage, {
    subjects: input.pkg.subjects,
    r1Decisions: r1Outcome.decisions,
    packageExclusions: input.pkg.exclusionsFromPackage,
    mechanicallyFlagged: input.coverage.mechanicallyFlagged,
    sampleRate: input.coverage.sampleRate,
    sampleSeed: input.coverage.sampleSeed,
    fullCoveragePolicy: input.coverage.fullCoveragePolicy,
  });
  // Honest breakdown, not a single opaque total (2026-07-30 ruling): the count
  // dispatched to R2 is the sum of every MANDATORY_COVERAGE_RULES bucket, the
  // stratified sample, and — only when this run set it — rows added solely by
  // an operator-directed full-coverage policy for this specific run.
  const byRuleCounts = Object.entries(coverage.byRule)
    .map(([rule, refs]) => `${rule}:${refs.length}`)
    .join(', ');
  step(
    'coverage',
    `${coverage.subjectRefs.length} rows to second review ` +
      `(by rule — ${byRuleCounts}` +
      (coverage.addedByFullCoveragePolicy.length > 0
        ? `, operator-directed-full-coverage:${coverage.addedByFullCoveragePolicy.length}`
        : '') +
      ')',
  );

  const coveredSet = new Set(coverage.subjectRefs);
  const r2Subjects = input.pkg.subjects.filter((s) => coveredSet.has(s.subjectRef));
  if (r2Subjects.length === 0) {
    throw new ReviewRefusal(
      'empty-second-review',
      'second review selected no rows. In dual mode that is a construction error, not a clean result.',
    );
  }

  // R2's batch plan is committed the moment its subject list is known — the
  // same timing coverage.ts already documents for coverage itself (WHICH
  // rows R2 sees may depend on R1; this plan is that dependency, made
  // deterministic and hashed before R2's first call rather than after).
  const r2BatchPlan = buildBatchPlan({
    reviewerSlot: 'R2',
    packageHash: input.pkg.packageHash,
    manifestHash: preRunManifest.manifestCommitment,
    subjectRefs: r2Subjects.map((s) => s.subjectRef),
    batchSize,
  });
  step('batch-plan-r2', `${r2BatchPlan.batches.length} batch(es) of up to ${batchSize}`);
  // Fired BEFORE R2's first dispatch — a caller (the CLI) freezes the plan
  // into its run manifest here, so a resumed run has the exact same batch
  // membership to verify against rather than repartitioning mid-run.
  await input.checkpoint?.onR2BatchPlanFrozen?.(r2BatchPlan);

  const r2ModelId = input.r2.assignment.resolvedModelId ?? input.r2.assignment.requestedModelId ?? 'human';
  step('dispatch-r2', `${r2Subjects.length} subjects to ${input.r2.provider.providerName} across ${r2BatchPlan.batches.length} batch(es)`);
  const r2Outcome = await runBatchedAdjudication({
    reviewId: input.request.reviewId,
    reviewerSlot: 'R2',
    reviewerRef: input.r2.assignment.humanReviewerRef ?? `${input.r2.provider.providerName}:${r2ModelId}`,
    pkg: input.pkg,
    subjects: r2Subjects,
    includeBlockDecisions: false,
    // The isolation gate, applied to EVERY R2 batch's dispatched text.
    priorForeignDecisions: r1Outcome.decisions,
    provider: input.r2.provider,
    modelId: r2ModelId,
    determinism: input.determinism,
    batchPlan: r2BatchPlan,
    maxAttemptsPerBatch,
    now: input.now,
    onStep: step,
    resumeFrom: input.resumeFrom?.r2,
    onBatchAccepted: input.checkpoint?.onBatchAccepted
      ? (b) => input.checkpoint!.onBatchAccepted!('R2', b)
      : undefined,
  });
  rawOutputs.push(...r2Outcome.rawOutputs);
  if (r2Outcome.unanswered.length > 0) unanswered.push({ reviewerSlot: 'R2', subjectRefs: r2Outcome.unanswered });
  step('parsed-r2', `${r2Outcome.decisions.length} decisions, ${r2Outcome.unanswered.length} unanswered`);

  const completedAt = input.now();
  const resolutions = resolveDecisions({
    reviewId: input.request.reviewId,
    subjectRefs: input.pkg.subjects.map((s) => s.subjectRef),
    r1: r1Outcome.decisions,
    r2: r2Outcome.decisions,
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
    parsedOutputCommitments: [commit(r1Outcome.decisions), commit(r2Outcome.decisions)],
    tally,
    promptVersion: INDEPENDENCE_PROMPT_VERSION,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    reviewStartedAt: startedAt,
    reviewCompletedAt: completedAt,
  });

  return {
    preRunManifest,
    r1Decisions: r1Outcome.decisions,
    r2Decisions: r2Outcome.decisions,
    coverage,
    resolutions,
    contested,
    tally,
    rawOutputs,
    unanswered,
    receipt,
    r1BatchPlan,
    r2BatchPlan,
    r1BatchAttempts: r1Outcome.attempts,
    r2BatchAttempts: r2Outcome.attempts,
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
