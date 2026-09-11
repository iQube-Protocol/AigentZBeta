/**
 * EXECUTION CONSTRAINT ABSORPTION — the client-side executor that turns ONE
 * operator act into N governed batches (operator ruling, 2026-08-03).
 *
 * ── The invariant this implements ───────────────────────────────────────────
 *
 *   > "Implementation constraints that do not alter constitutional intent shall
 *   >  be absorbed by the system rather than projected onto the operator."
 *
 * Named non-constitutional constraints: pagination, batching, retries,
 * chunking, cursor continuation, rate limits, API segmentation, transaction
 * grouping. None of these is a constitutional decision, so none may become an
 * operator decision.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 *
 * The operator selected 33 sources, chose one disposition, one provenance class
 * and one rationale, and was told:
 *
 *   > "33 sources exceeds the 25-source batch limit… Split the selection."
 *
 * The operator's verdict: *"technically honest but operationally poor. It has
 * detected the constraint. It has not solved the operator's problem."*
 *
 * ── WHAT IS NOT CHANGING, AND WHY IT MATTERS ────────────────────────────────
 *
 * **The server's refusal stays exactly as it is.** `MAX_BATCH = 25` and the
 * refuse-rather-than-truncate rule are correct: a silently truncated batch
 * reporting success is the population-shrink defect
 * (`CI-2026-08-03-BOUNDED-PROCESSOR-PARTIAL-COMPLETION-001`, found at Stage 3
 * and fixed there). This module does not raise the limit and does not ask the
 * server to relax it. It ABSORBS it — partitioning client-side and submitting
 * batches that each satisfy the unchanged rule.
 *
 * ── The load-bearing requirement ────────────────────────────────────────────
 *
 * Absorbing the batching must NOT reintroduce the very defect the refusal was
 * protecting against. If batch 2 fails after batch 1 succeeded, the result must
 * say EXACTLY that — how many were recorded, how many were not, and where it
 * stopped. `summariseAbsorbedExecution` reports a partial run as partial and
 * can never describe it as complete.
 *
 * Pure: no I/O, no clock. The caller performs the requests; this module decides
 * the partition and reconciles the outcomes.
 */

/** The server's own cap, mirrored here as the value being ABSORBED. Kept in
 *  sync by a canary rather than imported, because the route is a server module
 *  and this runs on the client. If the server's limit changes and this does
 *  not, the canary fails — which is the drift that would otherwise reappear as
 *  the refusal the operator saw. */
export const ABSORBED_BATCH_LIMIT = 25;

export interface ExecutionBatch {
  /** 1-based, for "Batch 1 of 2" — the operator's own numbering. */
  ordinal: number;
  sourceIds: string[];
}

/**
 * Partition a selection into batches that each satisfy the server limit.
 *
 * DETERMINISTIC: sorted by source id BEFORE packing, so the same selection
 * yields the same batches regardless of click order or set iteration order.
 * This is the discipline `partitionEvidence` already applies at Stage 3, for
 * the same reason — a re-run that produces different batches makes the
 * reconciliation unverifiable.
 */
export function partitionForExecution(
  sourceIds: readonly string[],
  limit: number = ABSORBED_BATCH_LIMIT,
): ExecutionBatch[] {
  const sorted = [...new Set(sourceIds)].sort((a, b) => a.localeCompare(b));
  const batches: ExecutionBatch[] = [];
  for (let i = 0; i < sorted.length; i += limit) {
    batches.push({ ordinal: batches.length + 1, sourceIds: sorted.slice(i, i + limit) });
  }
  return batches;
}

/** One batch's result, as the caller reports it after the request returns. */
export interface ExecutionBatchOutcome {
  ordinal: number;
  sourceIds: string[];
  ok: boolean;
  /** Present when `ok` is false. */
  error?: string;
  /** From the server's own response — how many it actually recorded. */
  written?: number;
  ingestionFailures?: number;
  receiptWritten?: boolean;
}

export interface AbsorbedExecutionSummary {
  totalSelected: number;
  batchCount: number;
  batchesAttempted: number;
  batchesSucceeded: number;
  /** Sources in batches that succeeded. */
  recorded: number;
  /** Sources in batches that failed or were never attempted. */
  notRecorded: number;
  /** THE IDENTITY, mirroring Stage 3's: recorded + notRecorded === totalSelected. */
  reconciles: boolean;
  /**
   * `complete` ONLY when every batch succeeded. A run that stopped partway is
   * `partial`, never `complete` — this is the property the server's refusal
   * existed to protect, preserved on the client side of the absorption.
   */
  outcome: 'complete' | 'partial' | 'failed' | 'not-started';
  /** The 1-based ordinal of the first batch that failed, or null. */
  stoppedAtBatch: number | null;
  /** Source ids that were NOT recorded, named — never merely counted. */
  notRecordedSourceIds: string[];
  /** One line stating what happened, in the operator's register. */
  headline: string;
}

/**
 * Reconcile the batch outcomes into ONE honest account of the operator's single
 * act.
 *
 * A partial run is reported as partial, with the batch it stopped at and the
 * ids that were not recorded. Nothing here can describe a partial run as
 * complete: `outcome` is derived from whether every batch succeeded, and the
 * unrecorded ids are listed rather than summarised away.
 */
export function summariseAbsorbedExecution(input: {
  totalSelected: number;
  batches: readonly ExecutionBatch[];
  outcomes: readonly ExecutionBatchOutcome[];
}): AbsorbedExecutionSummary {
  const attempted = input.outcomes.length;
  const succeeded = input.outcomes.filter((o) => o.ok);
  const recordedIds = new Set(succeeded.flatMap((o) => o.sourceIds));

  // Everything selected that is NOT in a succeeded batch — whether its batch
  // failed or was never attempted at all. Both are "not recorded", and
  // conflating them with success is the defect.
  const allSelected = input.batches.flatMap((b) => b.sourceIds);
  const notRecordedSourceIds = allSelected.filter((id) => !recordedIds.has(id)).sort();

  const firstFailure = input.outcomes.find((o) => !o.ok);
  const outcome: AbsorbedExecutionSummary['outcome'] =
    attempted === 0
      ? 'not-started'
      : succeeded.length === input.batches.length
        ? 'complete'
        : succeeded.length === 0
          ? 'failed'
          : 'partial';

  const recorded = recordedIds.size;
  const notRecorded = notRecordedSourceIds.length;

  const headline =
    outcome === 'complete'
      ? `Done. ${recorded} recorded across ${input.batches.length} batch(es).`
      : outcome === 'not-started'
        ? 'Nothing was attempted.'
        : outcome === 'failed'
          ? `Nothing was recorded. Batch ${firstFailure?.ordinal ?? 1} of ${input.batches.length} failed: ${firstFailure?.error ?? 'no reason reported'}. All ${input.totalSelected} source(s) are still at whatever status they already had.`
          : `PARTIAL — ${recorded} of ${input.totalSelected} recorded. Stopped at batch ${firstFailure?.ordinal} of ${input.batches.length}: ${firstFailure?.error ?? 'no reason reported'}. ${notRecorded} source(s) were NOT recorded and are still at whatever status they already had.`;

  return {
    totalSelected: input.totalSelected,
    batchCount: input.batches.length,
    batchesAttempted: attempted,
    batchesSucceeded: succeeded.length,
    recorded,
    notRecorded,
    reconciles: recorded + notRecorded === input.totalSelected,
    outcome,
    stoppedAtBatch: firstFailure?.ordinal ?? null,
    notRecordedSourceIds,
    headline,
  };
}

/**
 * Shape A — the explicit partition preview, offered as expandable detail.
 *
 * The operator preferred Shape B (batching that does not surface unless asked),
 * so this is what "show me how this will run" reveals rather than what the
 * surface leads with.
 */
export function renderPartitionPreview(
  batches: readonly ExecutionBatch[],
  shared: { decisionLabel: string; provenanceClass?: string | null; rationale: string },
): string[] {
  const lines = batches.map((b) => `Batch ${b.ordinal} — ${b.sourceIds.length} source(s)`);
  const sharedLine =
    `All batches use: ${shared.decisionLabel}` +
    (shared.provenanceClass ? ` · ${shared.provenanceClass}` : '') +
    ` · rationale (${shared.rationale.slice(0, 60)}${shared.rationale.length > 60 ? '…' : ''})`;
  return [...lines, sharedLine];
}
