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

/**
 * Retry backoff (2026-07-30 ruling, R2 resume from batch-011): a batch that
 * fails is retried with a DELAY, not immediately — and the delay honors a
 * provider's `Retry-After` header when the failure is HTTP 429 (capacity),
 * falling back to bounded exponential backoff with jitter for a 429 with no
 * `Retry-After` and for every other transient dispatch failure alike.
 * `failureCategory` on the recorded attempt distinguishes a genuine capacity
 * condition from an adjudication failure (isolation breach, cross-batch
 * contamination, malformed output) even though both back off the same way —
 * the distinction matters for reading the log afterward, not for whether a
 * wait happens before the next attempt.
 *
 * The jitter is DERIVED, not read from `Math.random()` — this directory reads
 * no clock and no random source (rulings, `tests/independent-review-capability
 * .test.ts`'s "no Date.now / Math.random / new Date" canary), a guarantee that
 * exists so a package and its hash are always reproducible independent of
 * when or how many times construction runs. A retry delay is not part of any
 * hashed artifact, but the rule is enforced at the file level, not per call
 * site — so the jitter comes from `commit()` over the one thing that already
 * makes this attempt unique (reviewer slot, batch id, attempt number),
 * keeping the module's own no-randomness guarantee intact rather than
 * carving out an exception for itself.
 */
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A value in [0,1), deterministic in its inputs — never `Math.random()`. */
function deterministicUnitInterval(seed: Record<string, unknown>): number {
  const hash = commit(seed);
  return parseInt(hash.slice(0, 8), 16) / 0x100000000;
}

export type BatchFailureCategory = 'rate-limited' | 'transient';

export function computeBatchRetryBackoff(
  reviewerSlot: ReviewerSlot,
  batchId: string,
  attempt: number,
  err: unknown,
): { delayMs: number; category: BatchFailureCategory } {
  const httpStatus = err instanceof ReviewRefusal ? err.httpStatus : undefined;
  const retryAfterSeconds = err instanceof ReviewRefusal ? err.retryAfterSeconds : undefined;
  const jitter = deterministicUnitInterval({ purpose: 'batch-retry-backoff', reviewerSlot, batchId, attempt });
  if (httpStatus === 429) {
    if (typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return { delayMs: Math.min(retryAfterSeconds * 1000, RETRY_MAX_DELAY_MS), category: 'rate-limited' };
    }
    return { delayMs: jitter * Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS), category: 'rate-limited' };
  }
  return {
    delayMs: jitter * Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS),
    category: 'transient',
  };
}

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
  /** Set on a failed attempt — see `computeBatchRetryBackoff`. */
  failureCategory?: BatchFailureCategory;
  /**
   * Pre-parsed decisions for a batch resumed from a checkpoint that does not
   * carry raw provider text (2026-07-30 checkpoint amendment — checkpoints
   * deliberately omit raw provider output). When present, the resumed branch
   * uses these directly instead of re-parsing `raw`. Absent for the ordinary
   * in-memory `resumeFrom` path (e.g. within one process's own retry), which
   * still re-parses `raw` exactly as before — fully backward compatible.
   */
  decisions?: ReviewDecision[];
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
  /**
   * Fired once per FRESHLY-accepted batch (never for a batch reused via
   * `resumeFrom` — that batch's checkpoint already exists on disk). Awaited
   * before the loop proceeds to the next batch, so a checkpoint write is
   * complete before the next dispatch begins (2026-07-30 resilience
   * amendment — the vP1 batch-011 run lost 11 completed R2 batches because
   * nothing was persisted until the whole run finished; this is the hook
   * that fixes it). This module still performs no IO itself — the callback
   * is the caller's, same shape as `onStep`.
   */
  onBatchAccepted?: (input: {
    batchId: string;
    batchHash: string;
    attempt: BatchAttemptRecord;
    decisions: ReviewDecision[];
  }) => void | Promise<void>;
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
        raw: resumed.raw ?? '',
        outputHash: resumed.outputHash,
      });
      const resumedDecisions = resumed.decisions
        ? resumed.decisions
        : parseAdjudication({
            reviewId: input.reviewId,
            reviewerSlot: input.reviewerSlot,
            reviewerRef: input.reviewerRef,
            raw: resumed.raw,
            rawOutputRef: resumed.rawOutputRef,
            reviewedAt: input.now(),
            expectedSubjectRefs: batch.subjectRefs,
          }).decisions;
      for (const d of resumedDecisions) decisionsByRef.set(d.subjectRef, d);
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

        const acceptedAttempt: BatchAttemptRecord = {
          reviewerSlot: input.reviewerSlot,
          batchId: batch.batchId,
          batchHash: batch.batchHash,
          attempt,
          rawOutputRef,
          raw: res.raw,
          outputHash: parsed.outputHash,
          accepted: true,
        };
        attempts.push(acceptedAttempt);
        rawOutputs.push({ reviewerSlot: input.reviewerSlot, batchId: batch.batchId, rawOutputRef, raw: res.raw, outputHash: parsed.outputHash });
        for (const d of parsed.decisions) decisionsByRef.set(d.subjectRef, d);
        accepted = true;
        input.onStep?.(
          `batch-${input.reviewerSlot.toLowerCase()}`,
          `${batch.batchId}: ${parsed.decisions.length} decisions, ${parsed.unanswered.length} unanswered (attempt ${attempt})`,
        );
        // Persist BEFORE moving to the next batch — the fix for the
        // vP1 batch-011 loss (see the input field's own doc comment).
        await input.onBatchAccepted?.({ batchId: batch.batchId, batchHash: batch.batchHash, attempt: acceptedAttempt, decisions: parsed.decisions });
      } catch (err) {
        lastFailure = err instanceof Error ? err.message : String(err);
        const { delayMs, category } = computeBatchRetryBackoff(input.reviewerSlot, batch.batchId, attempt, err);
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
          failureCategory: category,
        });
        if (attempt === input.maxAttemptsPerBatch) {
          throw new ReviewRefusal(
            'batch-adjudication-failed',
            `${input.reviewerSlot} batch ${batch.batchId} failed after ${attempt} attempt(s) [${category}]: ${lastFailure}. ` +
              'The run stops here — retry is scoped to this batch, never silently to the whole reviewer pass, ' +
              'and a batch that cannot be completed is not recorded as a passing one.',
          );
        }
        input.onStep?.(
          `batch-retry-${input.reviewerSlot.toLowerCase()}`,
          `${batch.batchId} attempt ${attempt} failed [${category}] (${lastFailure}); ` +
            `backing off ${Math.round(delayMs)}ms before retrying`,
        );
        await sleep(delayMs);
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
