/**
 * DETERMINISTIC BATCHED EXTRACTION — Stage 3's real remedy (operator ruling,
 * 2026-08-03).
 *
 * ── The defect, in the operator's own sharper wording ───────────────────────
 *
 *   > "Partial evidence was processed as though the full population had been
 *   >  processed."
 *
 * Not "truncation" — truncation names the mechanism and hides the consequence.
 * The consequence was that a run over four of thirty-two admitted sources
 * reported success, and every downstream reader treated the resulting
 * candidates as the corpus's output.
 *
 * The earlier fix (`break` → `continue`, plus typed exclusions) made the result
 * HONEST. The operator's verdict was that it "does not solve extraction
 * completeness" — an honest partial is still partial. This module is the
 * completeness half:
 *
 *   partition full admitted population
 *     → process deterministic batches
 *     → receipt each batch
 *     → record failures and exclusions
 *     → reconcile all batch outputs
 *     → deduplicate candidates globally
 *     → report total input / processed / excluded
 *
 * ── THE HARD COMPLETION RULE ────────────────────────────────────────────────
 *
 *   Stage 3 may only become `complete` when
 *
 *       processed + explicitly excluded === admitted population
 *
 *   Otherwise it stays `partially-complete`.
 *
 * That arithmetic identity is the invariant made executable, and
 * `reconcileExtraction` is the only place it is evaluated. A run whose sum does
 * not reconcile reports `partially-complete` no matter how healthy every other
 * signal looks — including a run where every batch succeeded, because an
 * unaccounted row means the accounting itself is wrong.
 *
 * ── Determinism, and the order-dependence bug that is NOT coming back ───────
 *
 * The pre-fix loop excluded a row that FIT because an earlier, larger row did
 * not — inclusion depended on list order. Partitioning here sorts by evidence
 * id BEFORE packing, so the same admitted population yields byte-identical
 * batches on any machine, in any fetch order, at any time. Nothing in this
 * module reads the clock or a random source.
 *
 * Pure: no I/O, no LLM, no DB. The orchestrator that actually calls the model
 * lives in `discoveryEngine.ts` and composes these functions.
 */

import type { IsolationException, ProgrammeProgression } from '@/services/research/exceptionIsolation';
import { computeCohortHash } from '@/services/research/cohortAuthorization';

/** The minimum an evidence row must expose to be partitioned. Structurally
 *  satisfied by `EvidenceRow` — declared structurally so this module never
 *  imports the engine and create a cycle. */
export interface PartitionableEvidence {
  id: string;
  title: string;
  content: string;
}

/**
 * Per-batch context budget. Unchanged from the single-pass value it replaces —
 * this is a real model-context limit, not a tunable, and raising it was
 * explicitly NOT the fix.
 */
export const BATCH_MAX_CHARS = 24_000;
/** Per-row cap within a batch, also carried over unchanged. */
export const ROW_MAX_CHARS = 6_000;

export interface EvidenceBatch {
  /** 0-based, stable across re-runs over the same population. */
  index: number;
  rows: PartitionableEvidence[];
  /** Sum of the capped row lengths — never exceeds `BATCH_MAX_CHARS`. */
  charCount: number;
}

export interface PartitionResult {
  batches: EvidenceBatch[];
  /**
   * Rows that cannot be processed by ANY batch — a single row whose capped
   * content still exceeds the whole batch budget. This is the only lawful
   * exclusion at partition time, and it is a property of the ROW, not of where
   * it happened to sit in the list.
   *
   * Unreachable while `rowMaxChars <= batchMaxChars`, which is the shipped
   * configuration. Kept because the guard is a function of the two parameters
   * and a caller may pass others — an inert branch that becomes live under a
   * legal configuration is a guard, not dead code.
   */
  unprocessable: PartitionableEvidence[];
  /**
   * ── THE SAME DEFECT, ONE LEVEL DOWN (found 2026-08-03 by this module's own
   *    canary, while asserting `unprocessable`) ────────────────────────────
   *
   * A row longer than `rowMaxChars` is CAPPED, and the candidate extracted
   * from it cites the whole row as its evidence. One `discovery_evidence` row
   * holds up to 200,000 characters (`ingestionBroker.ts`'s chunk size, and
   * `addEvidence`'s own cap), while extraction reads 6,000 — so up to 97% of a
   * source's text can go unread while the resulting invariant claims that
   * source as its basis.
   *
   * That is *"partial evidence processed as though the full population had
   * been processed"* applied to ONE ROW instead of to the population. It is
   * NOT fixed here — splitting a row across batches and reconciling partial
   * readings of one document is a distinct mechanism, and inventing it under
   * cover of this change would be the speculative build the rules forbid.
   *
   * It is DISCLOSED here, which is the part that was missing: every capped row
   * is reported, counted, and carried into the reconciliation as a stated
   * limitation on the candidates derived from it.
   */
  truncatedRows: { row: PartitionableEvidence; readChars: number; totalChars: number }[];
}

/**
 * Partition the full population into deterministic batches.
 *
 * Sorted by `id` first, so batching is a function of the SET, never of fetch
 * order. Greedy first-fit over the sorted rows: a row that does not fit the
 * current batch opens a new one rather than being dropped. Every row lands in
 * exactly one batch or in `unprocessable` — the property `reconcileExtraction`
 * later depends on.
 */
export function partitionEvidence(
  evidence: readonly PartitionableEvidence[],
  opts: { batchMaxChars?: number; rowMaxChars?: number } = {},
): PartitionResult {
  const batchMax = opts.batchMaxChars ?? BATCH_MAX_CHARS;
  const rowMax = opts.rowMaxChars ?? ROW_MAX_CHARS;

  const sorted = [...evidence].sort((a, b) => a.id.localeCompare(b.id));
  const batches: EvidenceBatch[] = [];
  const unprocessable: PartitionableEvidence[] = [];
  const truncatedRows: PartitionResult['truncatedRows'] = [];
  let current: EvidenceBatch | null = null;

  for (const row of sorted) {
    const size = Math.min(row.content.length, rowMax);
    // Disclosed, never silent — see `truncatedRows`.
    if (row.content.length > rowMax) {
      truncatedRows.push({ row, readChars: rowMax, totalChars: row.content.length });
    }
    // A row larger than an entire batch can never be processed by this
    // mechanism. Recorded as unprocessable rather than silently skipped —
    // and rather than being truncated further, which would process a
    // fragment while reporting the whole row as done.
    if (size > batchMax) {
      unprocessable.push(row);
      continue;
    }
    if (!current || current.charCount + size > batchMax) {
      current = { index: batches.length, rows: [], charCount: 0 };
      batches.push(current);
    }
    current.rows.push(row);
    current.charCount += size;
  }
  return { batches, unprocessable, truncatedRows };
}

// ── Reconciliation ──────────────────────────────────────────────────────────

/** One batch's outcome, as the orchestrator reports it. */
export interface BatchOutcome {
  index: number;
  /** Ids of the rows this batch was built from. */
  evidenceIds: string[];
  ok: boolean;
  /** Present when `ok` is false — the batch failed and its rows were NOT read. */
  error?: string;
  /** Candidate statements this batch produced. Empty is legal for a successful
   *  batch: evidence that yields no invariant is a finding, not a failure. */
  candidates: ExtractedCandidate[];
}

export interface ExtractedCandidate {
  statement: string;
  rationale: string;
  evidenceIds: string[];
  confidence: number;
  abstractionLevel: string | null;
}

export interface ExtractionReconciliation {
  /** |admitted population| — every evidence row the run was asked to process. */
  totalInput: number;
  /** Rows that were actually READ by a successful batch. */
  processed: number;
  /** Rows explicitly accounted for as not processed, with a reason each. */
  excluded: number;
  /**
   * THE IDENTITY. `processed + excluded === totalInput`. When false, some row
   * is unaccounted for and the run cannot claim completeness — that is a
   * defect in the accounting, not merely in the extraction.
   */
  reconciles: boolean;
  /** `complete` ONLY when `reconciles` AND nothing was excluded. */
  progression: ProgrammeProgression;
  /** Rows neither processed nor excluded. Non-empty ⇒ `reconciles` is false. */
  unaccountedEvidenceIds: string[];
  exceptions: IsolationException[];
  /** Candidates after GLOBAL dedup across every batch. */
  candidates: ExtractedCandidate[];
  /** How many candidates global dedup removed. */
  duplicatesRemoved: number;
  batchCount: number;
  failedBatchCount: number;
  /** Rows read only in part. Counted as processed; disclosed, never implied. */
  truncatedRowCount: number;
}

/** Dedup key for a candidate statement — normalised the same way
 *  `crystalReadiness`'s near-duplicate check normalises, so two stages do not
 *  disagree about what "the same statement" means. Exact-match only: this is a
 *  mechanical dedup, not a semantic merge, and a near-duplicate remains a
 *  judgement for the reviewer. */
export function candidateDedupeKey(statement: string): string {
  return statement.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Reconcile every batch outcome into one honest account of the run.
 *
 * Global dedup happens HERE, after reconciliation — never per batch. Two
 * batches can independently surface the same invariant from different
 * evidence, and that is a convergence signal: the surviving candidate carries
 * the UNION of the contributing evidence ids rather than whichever batch
 * happened to be first.
 */
export function reconcileExtraction(input: {
  /** Every evidence id the run was asked to process. */
  admittedEvidenceIds: readonly string[];
  batches: readonly BatchOutcome[];
  /** Rows excluded at partition time (too large for any batch). */
  unprocessable: readonly PartitionableEvidence[];
  /** Rows READ ONLY IN PART. They count as processed — they did contribute —
   *  but the limitation on what was read is disclosed rather than implied. */
  truncatedRows?: readonly { row: PartitionableEvidence; readChars: number; totalChars: number }[];
}): ExtractionReconciliation {
  const total = new Set(input.admittedEvidenceIds);
  const processedIds = new Set<string>();
  const excludedIds = new Set<string>();
  const exceptions: IsolationException[] = [];

  for (const row of input.unprocessable) {
    excludedIds.add(row.id);
    exceptions.push({
      scope: 'source',
      recordId: row.id,
      recordLabel: row.title,
      cause: `A single evidence row larger than the whole ${BATCH_MAX_CHARS.toLocaleString()}-character batch budget cannot be processed by this mechanism.`,
      causeGroup: 'unreadable-content',
      disposition: 'exception',
      stage: 'extract-candidates',
      blocksCurrentStage: false,
      blocksCrystalAssignment: false,
      blocksReadiness: false,
      blocksFreeze: false,
      consequence:
        'No candidate was extracted from this row. It remains admitted evidence and is unchanged; every other row was processed.',
      recommendedAction:
        'Split the source into smaller evidence rows at ingestion, or extract from it in a sub-domain-scoped run of its own.',
      deferrableUntil: null,
    });
  }

  for (const t of input.truncatedRows ?? []) {
    // NOT an exclusion: the row was read and did contribute. What is recorded
    // is that only part of it was read, so a reader of the resulting candidate
    // is never left to assume the whole source backed it.
    exceptions.push({
      scope: 'source',
      recordId: t.row.id,
      recordLabel: t.row.title,
      cause: `Only ${t.readChars.toLocaleString()} of ${t.totalChars.toLocaleString()} characters were read (${Math.round((t.readChars / t.totalChars) * 100)}% of the row).`,
      causeGroup: 'unreadable-content',
      disposition: 'exception',
      stage: 'extract-candidates',
      blocksCurrentStage: false,
      blocksCrystalAssignment: false,
      blocksReadiness: false,
      blocksFreeze: false,
      consequence:
        'Candidates citing this row were derived from part of it. The row counts as processed; what it could not ' +
        'contribute is disclosed rather than assumed absent.',
      recommendedAction:
        'Split this source into smaller evidence rows at ingestion so each is read whole, or extract from it in a ' +
        'run scoped to it alone.',
      deferrableUntil: null,
    });
  }

  for (const batch of input.batches) {
    if (batch.ok) {
      for (const id of batch.evidenceIds) processedIds.add(id);
      continue;
    }
    // A FAILED BATCH ISOLATES ITSELF. Its rows are excluded — explicitly, with
    // the failure named — and every other batch's output still stands. This is
    // the exception-isolation ruling applied inside Stage 3.
    for (const id of batch.evidenceIds) excludedIds.add(id);
    exceptions.push({
      scope: 'batch',
      recordId: `batch-${batch.index}`,
      recordLabel: `Extraction batch ${batch.index} (${batch.evidenceIds.length} evidence row(s))`,
      cause: batch.error ?? 'the batch failed without a reported reason',
      causeGroup: 'unreadable-content',
      disposition: 'exception',
      stage: 'extract-candidates',
      // The other batches proceeded. That is the whole point.
      blocksCurrentStage: false,
      blocksCrystalAssignment: false,
      blocksReadiness: false,
      blocksFreeze: false,
      consequence: `${batch.evidenceIds.length} evidence row(s) were not read. Every other batch's candidates stand.`,
      recommendedAction: 'Re-run extraction for this domain — batching is deterministic, so the same rows will be retried together.',
      deferrableUntil: null,
    });
  }

  // Anything in neither set is UNACCOUNTED, and that breaks the identity. It
  // is reported rather than quietly folded into `excluded`, because a row
  // nobody can explain is a different fact from a row with a stated reason.
  const unaccountedEvidenceIds = [...total].filter((id) => !processedIds.has(id) && !excludedIds.has(id)).sort();

  // ── GLOBAL dedup, after reconciliation ────────────────────────────────────
  const byKey = new Map<string, ExtractedCandidate>();
  let seen = 0;
  for (const batch of input.batches) {
    if (!batch.ok) continue;
    for (const c of batch.candidates) {
      seen += 1;
      const key = candidateDedupeKey(c.statement);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...c, evidenceIds: [...new Set(c.evidenceIds)] });
        continue;
      }
      // Convergence: the same statement from two batches keeps the UNION of
      // its evidence and the higher confidence, rather than whichever arrived
      // first.
      existing.evidenceIds = [...new Set([...existing.evidenceIds, ...c.evidenceIds])];
      existing.confidence = Math.max(existing.confidence, c.confidence);
    }
  }
  const candidates = [...byKey.values()];

  const processed = processedIds.size;
  const excluded = excludedIds.size;
  const reconciles = unaccountedEvidenceIds.length === 0 && processed + excluded === total.size;

  return {
    totalInput: total.size,
    processed,
    excluded,
    reconciles,
    progression: extractionProgression({ reconciles, processed, excluded, totalInput: total.size }),
    unaccountedEvidenceIds,
    exceptions,
    candidates,
    duplicatesRemoved: seen - candidates.length,
    batchCount: input.batches.length,
    failedBatchCount: input.batches.filter((b) => !b.ok).length,
    truncatedRowCount: (input.truncatedRows ?? []).length,
  };
}

/**
 * THE HARD COMPLETION RULE, in one place.
 *
 *   > "Stage 3 may only become `complete` when
 *   >  processed + explicitly excluded = admitted population.
 *   >  Otherwise it stays `partially-complete`."
 *
 * Read that carefully: reconciling is NECESSARY for `complete`, not sufficient.
 * A run that reconciles but excluded rows is `partially-complete` — it is
 * accurately reporting that part of the population was not processed. `complete`
 * means every admitted row was READ.
 *
 * A run that does not reconcile can never be `complete` whatever else looks
 * fine: an unaccounted row means the accounting is wrong, and a stage cannot
 * claim to have finished a population it cannot count.
 */
export function extractionProgression(input: {
  reconciles: boolean;
  processed: number;
  excluded: number;
  totalInput: number;
}): ProgrammeProgression {
  if (input.totalInput === 0) return 'not-started';
  // Never `complete` on a broken identity — this is the load-bearing guard.
  if (!input.reconciles) return 'partially-complete';
  if (input.excluded === 0 && input.processed === input.totalInput) return 'complete';
  if (input.processed === 0) return 'blocked';
  return 'partially-complete';
}

/** The operator's "report total input / processed / excluded", in one line. */
export function renderExtractionAccount(r: ExtractionReconciliation): string {
  return (
    `Extraction over ${r.totalInput} admitted evidence row(s): ${r.processed} processed, ${r.excluded} excluded ` +
    `across ${r.batchCount} batch(es) (${r.failedBatchCount} failed). ` +
    `${r.candidates.length} candidate(s) after global dedup (${r.duplicatesRemoved} duplicate(s) merged). ` +
    (r.truncatedRowCount > 0
      ? `${r.truncatedRowCount} row(s) were read only in part — disclosed on the exception list. `
      : '') +
    (r.reconciles
      ? `Accounted: ${r.processed} + ${r.excluded} = ${r.totalInput}.`
      : `DOES NOT RECONCILE — ${r.unaccountedEvidenceIds.length} row(s) unaccounted for: ${r.unaccountedEvidenceIds.join(', ')}.`)
  );
}

// ── The extraction receipt — the identity RECHECKABLE by a third party ─────

/**
 * What one extraction run must preserve (operator ruling, 2026-08-03).
 *
 *   > "That will make silent truncation much harder to reintroduce."
 *
 * Each field independently closes a way the old defect could return, and
 * together they make the completion identity
 *
 *     processed + explicitly excluded === admitted population
 *
 * **verifiable from the receipt alone** — not merely enforced at runtime and
 * asserted afterwards as a boolean. A reader who has only this record can
 * recompute every number and every hash and disagree with us.
 *
 * | Field | What it makes impossible |
 * |---|---|
 * | `admittedPopulationHash` | changing what was *supposed* to be processed after the fact |
 * | `batchBoundaries` | an unauditable partition — the batches can be re-derived and compared |
 * | `processedSourceIds` | asserting a count without naming the rows behind it |
 * | `excludedSourceIds` + `exclusionReasons` | an unexplained gap between admitted and processed |
 * | `perBatchCandidateCounts` | hiding that one batch produced everything and the rest were empty |
 * | `deduplication` | a candidate count that silently double-counts convergence |
 * | `reconciliationHash` | editing any of the above without the commitment changing |
 *
 * Hashes use `computeCohortHash` — the SAME digest the cohort-authorization
 * receipts and the freeze package use — so an id set committed here and the
 * same set committed at assignment or freeze produce comparable digests. A
 * second hashing scheme would make exactly the cross-stage comparison the
 * operator asked for impossible.
 */
export interface ExtractionReceipt {
  /** Commitment over the admitted population this run was asked to process. */
  admittedPopulationHash: string;
  /** The deterministic partition, re-derivable and comparable. */
  batchBoundaries: { index: number; evidenceIds: string[]; charCount: number }[];
  processedSourceIds: string[];
  excludedSourceIds: string[];
  /** Why each excluded id was excluded — keyed by id, never a parallel array
   *  whose alignment can drift. */
  exclusionReasons: { recordId: string; reason: string }[];
  perBatchCandidateCounts: { index: number; ok: boolean; candidateCount: number }[];
  deduplication: { beforeDedup: number; afterDedup: number; duplicatesRemoved: number };
  /** The counts a reader recomputes the identity from — carried explicitly so
   *  the check does not depend on trusting `reconciles`. */
  totalInput: number;
  processed: number;
  excluded: number;
  /** Our claim. A verifier recomputes it from the fields above rather than
   *  believing this flag. */
  reconciles: boolean;
  progression: ProgrammeProgression;
  /** Commitment over the whole outcome — every id set and every count. */
  reconciliationHash: string;
}

/**
 * Build the receipt for one run. PURE. The caller writes it through the
 * EXISTING receipt machinery (`buildCohortAuthorization` /
 * `writeLifecycleReceipt`); no second receipt mechanism is introduced.
 */
export function buildExtractionReceipt(input: {
  admittedEvidenceIds: readonly string[];
  batches: readonly EvidenceBatch[];
  outcomes: readonly BatchOutcome[];
  reconciliation: ExtractionReconciliation;
}): ExtractionReceipt {
  const r = input.reconciliation;
  const processedSourceIds = input.outcomes.filter((o) => o.ok).flatMap((o) => o.evidenceIds).sort();
  const excludedSourceIds = [...new Set(r.exceptions.filter((e) => e.scope !== 'batch').map((e) => e.recordId).concat(
    input.outcomes.filter((o) => !o.ok).flatMap((o) => o.evidenceIds),
  ))].sort();

  const admittedPopulationHash = computeCohortHash(input.admittedEvidenceIds);
  const batchBoundaries = input.batches.map((b) => ({
    index: b.index,
    evidenceIds: b.rows.map((row) => row.id).sort(),
    charCount: b.charCount,
  }));
  const perBatchCandidateCounts = input.outcomes.map((o) => ({
    index: o.index,
    ok: o.ok,
    candidateCount: o.candidates.length,
  }));
  const beforeDedup = r.candidates.length + r.duplicatesRemoved;

  // The reconciliation commitment covers every id set AND every count, so no
  // field above can be edited without this changing. Built from the same
  // digest function as every other cohort commitment in the pipeline.
  const reconciliationHash = computeCohortHash([
    `admitted:${admittedPopulationHash}`,
    `processed:${computeCohortHash(processedSourceIds)}`,
    `excluded:${computeCohortHash(excludedSourceIds)}`,
    `batches:${computeCohortHash(batchBoundaries.map((b) => `${b.index}:${b.evidenceIds.join(',')}`))}`,
    `counts:${r.totalInput}:${r.processed}:${r.excluded}`,
    `dedup:${beforeDedup}:${r.candidates.length}`,
  ]);

  return {
    admittedPopulationHash,
    batchBoundaries,
    processedSourceIds,
    excludedSourceIds,
    // EVERY EXCLUDED SOURCE ID CARRIES ITS OWN REASON.
    //
    // A batch-scope exception explains the BATCH; it does not explain the rows
    // inside it, and the ruling asks for "excluded source IDs AND reasons".
    // `verifyExtractionReceipt` caught this on its first run — four excluded
    // ids with no reason attached — so batch failures are expanded here into a
    // per-row reason naming the batch that failed. A reader checking one id
    // never has to infer why it is missing.
    exclusionReasons: [
      ...r.exceptions.filter((e) => e.scope !== 'batch').map((e) => ({ recordId: e.recordId, reason: e.cause })),
      ...input.outcomes
        .filter((o) => !o.ok)
        .flatMap((o) =>
          o.evidenceIds.map((id) => ({
            recordId: id,
            reason: `Extraction batch ${o.index} failed and this row was not read: ${o.error ?? 'no reason reported'}`,
          })),
        ),
    ],
    perBatchCandidateCounts,
    deduplication: { beforeDedup, afterDedup: r.candidates.length, duplicatesRemoved: r.duplicatesRemoved },
    totalInput: r.totalInput,
    processed: r.processed,
    excluded: r.excluded,
    reconciles: r.reconciles,
    progression: r.progression,
    reconciliationHash,
  };
}

/**
 * RECHECK the completion identity from a receipt alone — the third-party
 * verification path. Takes only the receipt, recomputes what it can, and
 * reports disagreement rather than trusting `reconciles`.
 *
 * This exists because a boolean on a record is a claim, and the operator's
 * point is that the claim must be checkable by someone who was not there.
 */
export function verifyExtractionReceipt(receipt: ExtractionReceipt): {
  valid: boolean;
  failures: string[];
} {
  const failures: string[] = [];

  // The counts must match the id lists they summarise.
  if (new Set(receipt.processedSourceIds).size !== receipt.processed) {
    failures.push(
      `processed count ${receipt.processed} does not match ${new Set(receipt.processedSourceIds).size} distinct processed id(s)`,
    );
  }
  if (new Set(receipt.excludedSourceIds).size !== receipt.excluded) {
    failures.push(
      `excluded count ${receipt.excluded} does not match ${new Set(receipt.excludedSourceIds).size} distinct excluded id(s)`,
    );
  }
  // THE IDENTITY, recomputed rather than believed.
  if (receipt.processed + receipt.excluded !== receipt.totalInput) {
    failures.push(
      `identity fails: processed ${receipt.processed} + excluded ${receipt.excluded} !== admitted ${receipt.totalInput}`,
    );
  }
  // A row may not be both processed and excluded.
  const both = receipt.processedSourceIds.filter((id) => receipt.excludedSourceIds.includes(id));
  if (both.length > 0) failures.push(`${both.length} id(s) counted as BOTH processed and excluded: ${both.join(', ')}`);
  // Every excluded id must carry a stated reason.
  const explained = new Set(receipt.exclusionReasons.map((e) => e.recordId));
  const unexplained = receipt.excludedSourceIds.filter((id) => !explained.has(id));
  if (unexplained.length > 0) failures.push(`${unexplained.length} excluded id(s) carry no reason: ${unexplained.join(', ')}`);
  // The claimed flag must agree with the recomputation.
  const recomputed = failures.length === 0;
  if (receipt.reconciles !== recomputed) {
    failures.push(`receipt claims reconciles=${receipt.reconciles} but recomputation says ${recomputed}`);
  }
  // And a run that does not reconcile may never claim completion.
  if (!recomputed && receipt.progression === 'complete') {
    failures.push('receipt reports `complete` over an identity that does not hold');
  }
  // The commitment must cover what the receipt says.
  const expected = computeCohortHash([
    `admitted:${receipt.admittedPopulationHash}`,
    `processed:${computeCohortHash(receipt.processedSourceIds)}`,
    `excluded:${computeCohortHash(receipt.excludedSourceIds)}`,
    `batches:${computeCohortHash(receipt.batchBoundaries.map((b) => `${b.index}:${b.evidenceIds.join(',')}`))}`,
    `counts:${receipt.totalInput}:${receipt.processed}:${receipt.excluded}`,
    `dedup:${receipt.deduplication.beforeDedup}:${receipt.deduplication.afterDedup}`,
  ]);
  if (expected !== receipt.reconciliationHash) {
    failures.push('reconciliationHash does not commit to the fields on this receipt — it has been edited');
  }

  return { valid: failures.length === 0, failures };
}
