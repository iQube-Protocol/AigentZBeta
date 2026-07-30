/**
 * Deterministic batching for reviewer dispatch — the fix for the confirmed
 * live-run defect (2026-07-29): asking one reviewer to adjudicate hundreds of
 * subjects in a single completion returns one decision and hundreds of
 * `unanswered` rows. Raising the output ceiling changed nothing — the model
 * cannot reliably track hundreds of individual adjudications in one pass
 * regardless of how much room it is given to answer. The fix is architectural:
 * partition each reviewer's assignment into deterministic, manifest-bound
 * batches; adjudicate each independently; merge only after every batch is
 * accounted for.
 *
 * ── What this module is NOT ──────────────────────────────────────────────────
 *
 * It does not change the frozen package, the review question, the rubric, or
 * the parsing contract. `parseAdjudication` (adjudication.ts) is reused
 * unmodified at the batch level — this module wraps it with batch-scoped
 * dispatch, retry and merge, it does not fork it.
 *
 * ── Ordering is the reproducibility contract, same as the rest of this dir ──
 *
 * A batch plan is a pure function of (reviewer slot, package hash, manifest
 * hash, the frozen subject order, batch size). No clock, no randomness, no
 * response ordering enters batch membership. Merge is by that same frozen
 * order — never response order, batch completion time, or retry order —
 * so the merged decision array is reproducible independent of dispatch timing.
 */

import { commit } from './deterministic';
import { parseAdjudication } from './adjudication';
import { buildReviewerPrompt } from './rubric';
import { assertPromptCarriesNoPriorAdjudication } from './isolation';
import { ReviewRefusal, type ReviewDecision, type ReviewPackage, type ReviewSubjectRecord, type ReviewerSlot } from './types';
import type { AdjudicationResponse, DeterminismSettings, ReviewProvider } from './providers';

/**
 * 16 subjects per batch: 464 subjects → 29 batches. Originally 32 per rulings
 * §1 (464 → 15 batches); revised down after a live run (2026-07-30) against
 * the real corpus at 32/batch and a 300s per-batch timeout still failed —
 * batch-000 timed out on attempt 1 and succeeded on a fresh attempt 2 (so the
 * work itself was not consistently over budget), but batch-001 timed out on
 * BOTH attempts, refusing the whole run rather than silently completing a
 * partial one. Halving batch size directly shrinks the output size and
 * processing time of the single largest risk factor in that timeout, rather
 * than layering on a third guess at `timeoutMs` alone. This is a deviation
 * from the ratified rulings §1 number — flagged as such rather than silently
 * overridden; open for the operator/Aletheon to confirm or set differently.
 * Configuration-backed and frozen into the pre-run manifest either way — never
 * hardcoded somewhere the manifest can't see it (rulings §1).
 */
export const DEFAULT_BATCH_SIZE = 16;

/**
 * Batches beyond this many attempts per batch are not retried automatically.
 * Raised from 2 to 3 (2026-07-30, same live-run evidence as DEFAULT_BATCH_SIZE
 * above): batch-000's own attempt-1-fails/attempt-2-succeeds pattern shows a
 * fresh attempt can clear a batch that stalled once: not "sit for a fixed time
 * outside the model's control" — it's the difference between the same request
 * landing in a slow window at Venice versus a fresh one. One more attempt
 * gives a genuinely transient stall a further chance without extending any
 * single attempt's own timeout.
 */
export const DEFAULT_MAX_ATTEMPTS_PER_BATCH = 3;

export interface BatchPlanBatch {
  batchId: string;
  batchHash: string;
  /** The frozen order of this batch — a slice of the reviewer's full assignment. */
  subjectRefs: string[];
}

export interface BatchPlan {
  reviewerSlot: ReviewerSlot;
  batchSize: number;
  packageHash: string;
  manifestHash: string;
  batches: BatchPlanBatch[];
}

export interface BuildBatchPlanInput {
  reviewerSlot: ReviewerSlot;
  packageHash: string;
  /** The pre-run manifest's commitment — batches are bound to it (rulings §3). */
  manifestHash: string;
  /** The reviewer's full assignment, in the FROZEN order — never resorted here. */
  subjectRefs: readonly string[];
  batchSize: number;
}

/**
 * Partition a frozen subject order into deterministic batches. Same inputs,
 * same batch ids, same membership, same hashes — on any machine, any process,
 * any order of computation.
 */
export function buildBatchPlan(input: BuildBatchPlanInput): BatchPlan {
  if (!Number.isInteger(input.batchSize) || input.batchSize <= 0) {
    throw new ReviewRefusal('invalid-batch-size', `batchSize must be a positive integer; received ${input.batchSize}`);
  }
  if (input.subjectRefs.length === 0) {
    throw new ReviewRefusal('empty-batch-plan', `${input.reviewerSlot} has no subjects to partition into batches`);
  }

  const batches: BatchPlanBatch[] = [];
  for (let i = 0; i * input.batchSize < input.subjectRefs.length; i++) {
    const subjectRefs = input.subjectRefs.slice(i * input.batchSize, (i + 1) * input.batchSize);
    const batchId = `batch-${String(i).padStart(3, '0')}`;
    const batchHash = commit({
      reviewerSlot: input.reviewerSlot,
      packageHash: input.packageHash,
      manifestHash: input.manifestHash,
      batchId,
      subjectRefs,
    });
    batches.push({ batchId, batchHash, subjectRefs });
  }

  return {
    reviewerSlot: input.reviewerSlot,
    batchSize: input.batchSize,
    packageHash: input.packageHash,
    manifestHash: input.manifestHash,
    batches,
  };
}

/**
 * Reconstruct the frozen manifest order from a batch plan. Used by the "full
 * reconstruction" canary and available to any caller that wants to verify a
 * plan covers its population exactly once, in order, before trusting it.
 */
export function flattenBatchPlan(plan: BatchPlan): string[] {
  return plan.batches.flatMap((b) => b.subjectRefs);
}

/**
 * A completeness check a caller can apply independently of the lenient
 * "record as unanswered" behaviour `runBatchedAdjudication` uses by default.
 * Throws, naming every subjectRef the reviewer did not answer for — never a
 * generic count.
 */
export function assertReviewerComplete(
  reviewerSlot: ReviewerSlot,
  expectedSubjectRefs: readonly string[],
  decisions: readonly ReviewDecision[],
): void {
  const answered = new Set(decisions.map((d) => d.subjectRef));
  const missing = expectedSubjectRefs.filter((ref) => !answered.has(ref));
  if (missing.length > 0) {
    throw new ReviewRefusal(
      'incomplete-reviewer-pass',
      `${reviewerSlot} did not return a decision for: ${missing.join(', ')}`,
    );
  }
}

function assertNoDuplicateSubjectRefs(slot: ReviewerSlot, batchId: string, decisions: readonly ReviewDecision[]): void {
  const seen = new Set<string>();
  for (const d of decisions) {
    if (seen.has(d.subjectRef)) {
      throw new ReviewRefusal(
        'duplicate-batch-decision',
        `${slot} batch ${batchId} returned more than one decision for ${d.subjectRef} — last-write-wins is refused`,
      );
    }
    seen.add(d.subjectRef);
  }
}

/** One dispatch attempt for one batch, successful or not — kept for audit (rulings §6). */
export interface BatchAttemptRecord {
  reviewerSlot: ReviewerSlot;
  batchId: string;
  batchHash: string;
  attempt: number;
  rawOutputRef: string;
  raw: string;
  outputHash: string;
  accepted: boolean;
  failureReason?: string;
}

export interface BatchRawOutput {
  reviewerSlot: ReviewerSlot;
  batchId: string;
  rawOutputRef: string;
  raw: string;
  outputHash: string;
}

export interface BatchDispatchOutcome {
  decisions: ReviewDecision[];
  /** Every expected subjectRef with no accepted decision, in frozen order. */
  unanswered: string[];
  rawOutputs: BatchRawOutput[];
  attempts: BatchAttemptRecord[];
}

export interface RunBatchedAdjudicationInput {
  reviewId: string;
  reviewerSlot: ReviewerSlot;
  reviewerRef: string;
  pkg: ReviewPackage;
  /** This reviewer's full frozen assignment, in canonical order. */
  subjects: readonly ReviewSubjectRecord[];
  includeBlockDecisions: boolean;
  /** Every OTHER reviewer's decisions, for the isolation gate. [] for R1. */
  priorForeignDecisions: readonly ReviewDecision[];
  provider: ReviewProvider;
  modelId: string;
  determinism: DeterminismSettings;
  batchPlan: BatchPlan;
  maxAttemptsPerBatch: number;
  /** Injected. No clock is read inside this module. */
  now: () => string;
  onStep?: (step: string, detail: string) => void;
  /**
   * Previously ACCEPTED attempts to resume from. A batch present here (and
   * whose batchHash still matches the current plan) is reused rather than
   * re-dispatched — a rerun after a partial failure executes only the
   * unresolved batches (rulings §6, "resume safety").
   */
  resumeFrom?: readonly BatchAttemptRecord[];
}

/**
 * Dispatch one reviewer's full assignment as a sequence of independent batch
 * calls, and merge the result in frozen manifest order.
 *
 * Fail-closed shape, preserved at the batch level exactly as it existed at the
 * whole-reviewer level before batching:
 *   - a row missing from an otherwise well-formed batch response is recorded
 *     as `unanswered`, never inferred or defaulted (adjudication.ts's contract,
 *     unchanged);
 *   - a row the reviewer answered OUTSIDE its assigned batch, or answered MORE
 *     THAN ONCE within a batch, is a structural violation of the batch
 *     boundary and refuses the batch (retryable, since it may be a transient
 *     model error under temperature 0 — the retry reuses the identical batch,
 *     prompt, model and determinism, never a different one);
 *   - a batch that cannot produce a valid response after
 *     `maxAttemptsPerBatch` attempts refuses the whole run, the same as a
 *     single-shot dispatch failure did before batching existed — batching
 *     changes how far a partial failure can be isolated, not whether a
 *     genuinely broken dispatch is allowed to look like a review.
 */
export async function runBatchedAdjudication(input: RunBatchedAdjudicationInput): Promise<BatchDispatchOutcome> {
  const subjectByRef = new Map(input.subjects.map((s) => [s.subjectRef, s]));
  const resumeByBatchId = new Map((input.resumeFrom ?? []).filter((a) => a.accepted).map((a) => [a.batchId, a] as const));

  const attempts: BatchAttemptRecord[] = [];
  const rawOutputs: BatchRawOutput[] = [];
  const decisionsByRef = new Map<string, ReviewDecision>();

  for (const batch of input.batchPlan.batches) {
    const batchSubjects: ReviewSubjectRecord[] = batch.subjectRefs.map((ref) => {
      const s = subjectByRef.get(ref);
      if (!s) {
        throw new ReviewRefusal(
          'batch-plan-mismatch',
          `batch ${batch.batchId} references subject ${ref}, which is not in the ${input.reviewerSlot} assignment`,
        );
      }
      return s;
    });

    const resumed = resumeByBatchId.get(batch.batchId);
    if (resumed) {
      if (resumed.batchHash !== batch.batchHash) {
        throw new ReviewRefusal(
          'resume-batch-hash-mismatch',
          `a prior accepted attempt for ${batch.batchId} does not match the current batch plan's hash — ` +
            'refusing to resume from a stale plan rather than silently reusing a mismatched answer',
        );
      }
      input.onStep?.(`batch-resumed-${input.reviewerSlot.toLowerCase()}`, `${batch.batchId} reused from a prior accepted attempt`);
      attempts.push(resumed);
      rawOutputs.push({
        reviewerSlot: input.reviewerSlot,
        batchId: batch.batchId,
        rawOutputRef: resumed.rawOutputRef,
        raw: resumed.raw,
        outputHash: resumed.outputHash,
      });
      const parsed = parseAdjudication({
        reviewId: input.reviewId,
        reviewerSlot: input.reviewerSlot,
        reviewerRef: input.reviewerRef,
        raw: resumed.raw,
        rawOutputRef: resumed.rawOutputRef,
        reviewedAt: input.now(),
        expectedSubjectRefs: batch.subjectRefs,
      });
      for (const d of parsed.decisions) decisionsByRef.set(d.subjectRef, d);
      continue;
    }

    const prompt = buildReviewerPrompt({
      reviewerSlot: input.reviewerSlot,
      pkg: input.pkg,
      subjects: batchSubjects,
      includeBlockDecisions: input.includeBlockDecisions,
    });
    // The isolation gate, applied to THIS BATCH's dispatched text — every
    // batch is a fresh chance for a leak to be introduced and a fresh chance
    // to catch it.
    assertPromptCarriesNoPriorAdjudication(input.reviewerSlot, prompt, input.priorForeignDecisions);

    let accepted = false;
    let lastFailure = '';
    for (let attempt = 1; attempt <= input.maxAttemptsPerBatch && !accepted; attempt++) {
      const rawOutputRef = `raw/${input.reviewId}/${input.reviewerSlot}/${batch.batchId}${attempt > 1 ? `/attempt-${attempt}` : ''}`;
      let res: AdjudicationResponse | undefined;
      try {
        res = await input.provider.adjudicate({
          modelId: input.modelId,
          system: prompt.system,
          user: prompt.user,
          determinism: input.determinism,
        });
        const parsed = parseAdjudication({
          reviewId: input.reviewId,
          reviewerSlot: input.reviewerSlot,
          reviewerRef: input.reviewerRef,
          raw: res.raw,
          rawOutputRef,
          reviewedAt: input.now(),
          expectedSubjectRefs: batch.subjectRefs,
        });
        if (parsed.unsolicited.length > 0) {
          throw new ReviewRefusal(
            'cross-batch-contamination',
            `${input.reviewerSlot} batch ${batch.batchId} answered for subject(s) outside its assigned batch: ` +
              parsed.unsolicited.join(', '),
          );
        }
        assertNoDuplicateSubjectRefs(input.reviewerSlot, batch.batchId, parsed.decisions);

        attempts.push({
          reviewerSlot: input.reviewerSlot,
          batchId: batch.batchId,
          batchHash: batch.batchHash,
          attempt,
          rawOutputRef,
          raw: res.raw,
          outputHash: parsed.outputHash,
          accepted: true,
        });
        rawOutputs.push({ reviewerSlot: input.reviewerSlot, batchId: batch.batchId, rawOutputRef, raw: res.raw, outputHash: parsed.outputHash });
        for (const d of parsed.decisions) decisionsByRef.set(d.subjectRef, d);
        accepted = true;
        input.onStep?.(
          `batch-${input.reviewerSlot.toLowerCase()}`,
          `${batch.batchId}: ${parsed.decisions.length} decisions, ${parsed.unanswered.length} unanswered (attempt ${attempt})`,
        );
      } catch (err) {
        lastFailure = err instanceof Error ? err.message : String(err);
        attempts.push({
          reviewerSlot: input.reviewerSlot,
          batchId: batch.batchId,
          batchHash: batch.batchHash,
          attempt,
          rawOutputRef,
          raw: res?.raw ?? '',
          outputHash: res ? commit({ raw: res.raw }) : '',
          accepted: false,
          failureReason: lastFailure,
        });
        if (attempt === input.maxAttemptsPerBatch) {
          throw new ReviewRefusal(
            'batch-adjudication-failed',
            `${input.reviewerSlot} batch ${batch.batchId} failed after ${attempt} attempt(s): ${lastFailure}. ` +
              'The run stops here — retry is scoped to this batch, never silently to the whole reviewer pass, ' +
              'and a batch that cannot be completed is not recorded as a passing one.',
          );
        }
        input.onStep?.(`batch-retry-${input.reviewerSlot.toLowerCase()}`, `${batch.batchId} attempt ${attempt} failed (${lastFailure}); retrying`);
      }
    }
  }

  // Merge in FROZEN MANIFEST ORDER (rulings §5) — `input.subjects` IS that
  // order: the runner passes the full package subject list for R1, and the
  // coverage-filtered — order-preserved — subset of it for R2.
  const decisions: ReviewDecision[] = [];
  const unanswered: string[] = [];
  for (const s of input.subjects) {
    const d = decisionsByRef.get(s.subjectRef);
    if (d) decisions.push(d);
    else unanswered.push(s.subjectRef);
  }

  return { decisions, unanswered, rawOutputs, attempts };
}
