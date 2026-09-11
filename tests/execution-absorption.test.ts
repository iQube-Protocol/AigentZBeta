/**
 * EXECUTION CONSTRAINT ABSORPTION (operator ruling, 2026-08-03).
 *
 *   > "Implementation constraints that do not alter constitutional intent shall
 *   >  be absorbed by the system rather than projected onto the operator."
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 *
 * The operator selected 33 sources, chose one disposition, one provenance class
 * and one rationale, and was told to "split the selection" — the system had
 * detected a constraint and handed back the remedy it could have performed
 * itself.
 *
 * ── The load-bearing requirement these canaries defend ──────────────────────
 *
 * The server's refuse-rather-than-truncate rule is CORRECT and stays. Absorbing
 * the batching on the client must not reintroduce the very defect that refusal
 * was protecting against: a partially applied run that reports success. Every
 * assertion about partial failure below exists for that reason.
 *
 * Subject selection is by the property under test throughout, never by array
 * index (CI-2026-08-03-CANARY-SUBJECT-SELECTION-001).
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  ABSORBED_BATCH_LIMIT,
  partitionForExecution,
  renderPartitionPreview,
  summariseAbsorbedExecution,
  type ExecutionBatch,
  type ExecutionBatchOutcome,
} from '@/services/corpusScout/executionAbsorption';

/** The operator's live selection: 33 sources against a 25 limit. */
const THIRTY_THREE = Array.from({ length: 33 }, (_, i) => `SRC-live-${String(i).padStart(3, '0')}`);

const outcomeFor = (batch: ExecutionBatch, ok: boolean, error?: string): ExecutionBatchOutcome => ({
  ordinal: batch.ordinal,
  sourceIds: batch.sourceIds,
  ok,
  ...(error ? { error } : {}),
});

// ── 1 · THE ABSORPTION ITSELF ──────────────────────────────────────────────

describe('one operator act becomes N batches without operator work', () => {
  it("the operator's 33-source selection partitions into 25 + 8", () => {
    // The live case. Mutation: refuse instead of partitioning -> the operator
    // is handed the remedy again.
    const batches = partitionForExecution(THIRTY_THREE);
    expect(batches.map((b) => b.sourceIds.length)).toEqual([25, 8]);
    expect(batches.map((b) => b.ordinal)).toEqual([1, 2]);
  });

  it('no batch ever exceeds the server limit — the limit is absorbed, not raised', () => {
    for (const n of [1, 24, 25, 26, 33, 100]) {
      const ids = Array.from({ length: n }, (_, i) => `SRC-${String(i).padStart(4, '0')}`);
      const batches = partitionForExecution(ids);
      for (const b of batches) {
        expect(b.sourceIds.length, `a batch of ${b.sourceIds.length} exceeds the limit`).toBeLessThanOrEqual(
          ABSORBED_BATCH_LIMIT,
        );
      }
      // And every selected id lands in exactly one batch.
      const placed = batches.flatMap((b) => b.sourceIds);
      expect(placed.sort()).toEqual([...ids].sort());
      expect(new Set(placed).size).toBe(n);
    }
  });

  it('a selection at or below the limit is still ONE batch — absorption adds no ceremony', () => {
    expect(partitionForExecution(THIRTY_THREE.slice(0, 25))).toHaveLength(1);
    expect(partitionForExecution(['SRC-a'])).toHaveLength(1);
  });

  it('partitioning is deterministic — a function of the SET, not of click order', () => {
    // Mutation: drop the sort -> the same selection yields different batches on
    // re-run and the reconciliation becomes unverifiable. This is the same
    // discipline Stage 3's partitioner already carries.
    const forward = partitionForExecution(THIRTY_THREE);
    const reversed = partitionForExecution([...THIRTY_THREE].reverse());
    expect(reversed.map((b) => b.sourceIds)).toEqual(forward.map((b) => b.sourceIds));
  });

  it('duplicate ids in a selection are collapsed, never double-submitted', () => {
    const batches = partitionForExecution(['SRC-a', 'SRC-a', 'SRC-b']);
    expect(batches.flatMap((b) => b.sourceIds)).toEqual(['SRC-a', 'SRC-b']);
  });
});

// ── 2 · PARTIAL FAILURE STAYS HONEST — the load-bearing requirement ─────────

describe('absorbing the batching does NOT reintroduce "partial reported as success"', () => {
  const batches = partitionForExecution(THIRTY_THREE);

  it('batch 2 failing after batch 1 succeeded reports PARTIAL, names where it stopped, and lists what was not recorded', () => {
    /*
     * THE canary. The server refuses oversized batches precisely so a partially
     * applied run cannot report success; absorbing the batching client-side
     * would recreate that defect if a mid-run failure were smoothed over.
     *
     * Mutation: return `outcome: 'complete'` whenever any batch succeeded, or
     * drop `notRecordedSourceIds` -> a run that recorded 25 of 33 looks
     * finished and the operator cannot tell which 8 are still pending.
     */
    const summary = summariseAbsorbedExecution({
      totalSelected: 33,
      batches,
      outcomes: [outcomeFor(batches[0], true), outcomeFor(batches[1], false, 'service unavailable')],
    });
    expect(summary.outcome).toBe('partial');
    expect(summary.outcome).not.toBe('complete');
    expect(summary.recorded).toBe(25);
    expect(summary.notRecorded).toBe(8);
    expect(summary.stoppedAtBatch).toBe(2);
    // The unrecorded sources are NAMED, never merely counted.
    expect(summary.notRecordedSourceIds).toHaveLength(8);
    const second = batches.find((b) => b.ordinal === 2)!;
    for (const id of second.sourceIds) {
      expect(summary.notRecordedSourceIds, `${id} must be named as not recorded`).toContain(id);
    }
    expect(summary.headline).toMatch(/PARTIAL/);
    expect(summary.headline).toMatch(/25 of 33/);
    expect(summary.headline).toMatch(/still at whatever status they already had/);
  });

  it('the identity holds: recorded + notRecorded === totalSelected', () => {
    for (const outcomes of [
      [outcomeFor(batches[0], true), outcomeFor(batches[1], true)],
      [outcomeFor(batches[0], true), outcomeFor(batches[1], false, 'boom')],
      [outcomeFor(batches[0], false, 'boom')],
      [],
    ]) {
      const s = summariseAbsorbedExecution({ totalSelected: 33, batches, outcomes });
      expect(s.reconciles, `identity failed for ${outcomes.length} outcome(s)`).toBe(true);
      expect(s.recorded + s.notRecorded).toBe(33);
    }
  });

  it('a first-batch failure records NOTHING and says so', () => {
    const summary = summariseAbsorbedExecution({
      totalSelected: 33,
      batches,
      outcomes: [outcomeFor(batches[0], false, 'service unavailable')],
    });
    expect(summary.outcome).toBe('failed');
    expect(summary.recorded).toBe(0);
    expect(summary.notRecorded).toBe(33);
    expect(summary.headline).toMatch(/Nothing was recorded/);
  });

  it('only an all-batches-succeeded run is complete', () => {
    const summary = summariseAbsorbedExecution({
      totalSelected: 33,
      batches,
      outcomes: batches.map((b) => outcomeFor(b, true)),
    });
    expect(summary.outcome).toBe('complete');
    expect(summary.recorded).toBe(33);
    expect(summary.notRecorded).toBe(0);
  });

  it('an unattempted batch counts as NOT recorded, not as absent', () => {
    // A loop that broke early leaves batch 2 with no outcome at all. Its
    // sources are still not recorded, and conflating "never attempted" with
    // "fine" is the same defect as smoothing over a failure.
    const summary = summariseAbsorbedExecution({
      totalSelected: 33,
      batches,
      outcomes: [outcomeFor(batches[0], true)],
    });
    expect(summary.outcome).toBe('partial');
    expect(summary.notRecorded).toBe(8);
    expect(summary.batchesAttempted).toBe(1);
    expect(summary.batchCount).toBe(2);
  });
});

// ── 3 · SHAPE A — the partition as DETAIL, carrying the shared decision ─────

describe('the partition preview shows one decision applied to every batch', () => {
  it("renders the operator's own shape", () => {
    const lines = renderPartitionPreview(partitionForExecution(THIRTY_THREE), {
      decisionLabel: 'Admit — EXP-P1',
      provenanceClass: 'external-established',
      rationale: 'Institutional authority sources for the EXP-P1 lane.',
    });
    expect(lines).toContain('Batch 1 — 25 source(s)');
    expect(lines).toContain('Batch 2 — 8 source(s)');
    const shared = lines.find((l) => l.startsWith('All batches use:'));
    expect(shared, 'the shared decision line must be present').toBeDefined();
    expect(shared!).toMatch(/Admit — EXP-P1/);
    expect(shared!).toMatch(/external-established/);
  });
});

// ── 4 · THE SERVER'S REFUSAL IS UNCHANGED ──────────────────────────────────

describe('the constitutional refusal survives the absorption', () => {
  const ROUTE = 'app/api/corpus-scout/candidates/bulk-review/route.ts';

  it('the server still caps at 25 and still REFUSES rather than truncating', () => {
    // Mutation: raise MAX_BATCH or truncate server-side -> the population-shrink
    // defect returns, one layer down from where it was fixed at Stage 3.
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/const MAX_BATCH = 25;/);
    expect(src).toMatch(/exceeds the \$\{MAX_BATCH\}-source batch limit/);
    expect(src).toMatch(/refused rather than/);
    expect(src, 'the server must not truncate the array').not.toMatch(/sourceIds\.slice\(0, MAX_BATCH\)/);
  });

  it('the client mirrors the server limit exactly — drift would resurface the refusal', () => {
    /*
     * The absorbed limit is duplicated by necessity (the route is server-only
     * and this runs in the browser), so parity is CANARIED rather than derived
     * — the pattern tests/source-of-truth-parity.test.ts prescribes for a
     * projection that cannot import its source.
     *
     * Mutation: change either number alone -> a 26-source selection is sent as
     * one batch and refused, and the operator sees the old message again.
     */
    const server = stripComments(readSource(ROUTE));
    const declared = /const MAX_BATCH = (\d+);/.exec(server)?.[1];
    expect(declared, 'the server limit must be readable').toBeDefined();
    expect(ABSORBED_BATCH_LIMIT).toBe(Number(declared));
  });
});

// ── 5 · THE SURFACE — one act, N receipts, no projected remedy ──────────────

describe('the executor absorbs the constraint instead of surfacing it', () => {
  const PANEL = 'components/research/Track2ProgrammePanel.tsx';

  it('one act loops the batches — the operator never partitions', () => {
    // Mutation: send [...selected] in a single request -> the server refuses a
    // 33-source selection and the operator is told to split it.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const post = useCallback');
    const post = src.slice(at, at + 4200);
    expect(post).toMatch(/partitionForExecution\(\[\.\.\.selected\]\)/);
    expect(post).toMatch(/for \(const batch of batches\)/);
    expect(post).toMatch(/sourceIds: batch\.sourceIds/);
    expect(post, 'the whole selection must not be sent as one request').not.toMatch(
      /sourceIds: \[\.\.\.selected\]/,
    );
  });

  it('EACH BATCH KEEPS ITS OWN RECEIPT — the constitutional part is not collapsed', () => {
    /*
     * The operator: "One click. Two receipts. Zero operator work." Absorbing
     * the batching must not merge the receipts, because each batch is its own
     * governed act.
     *
     * Mutation: report receiptWritten true when ANY batch was receipted -> a
     * missing receipt hides behind a successful sibling.
     */
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const post = useCallback');
    const post = src.slice(at, at + 4600);
    expect(post).toMatch(/receiptsWritten === outcomes\.filter\(\(o\) => o\.ok\)\.length && receiptsWritten > 0/);
    expect(post).toMatch(/batch receipt\(s\) were not written/);
  });

  it('the run STOPS at the first failed batch rather than pressing on', () => {
    // Continuing past a failure would leave the operator unable to tell which
    // sources were recorded.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const post = useCallback');
    const post = src.slice(at, at + 4200);
    expect(post).toMatch(/ok: false,\s*error:[\s\S]{0,160}\}\);\s*break;/);
  });

  it('a partial run is rendered as partial, naming the sources not recorded', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/absorbed\.outcome !== "complete"/);
    expect(src).toMatch(/absorbed\.notRecordedSourceIds/);
    expect(src).toMatch(/not recorded/);
  });

  it('batching surfaces as PROGRESS, and the partition only when asked (Shape B over Shape A)', () => {
    const src = stripComments(readSource(PANEL));
    expect(src, 'progress line').toMatch(/Executing… batch \{progress\.current\} of \{progress\.total\}/);
    expect(src, 'partition is opt-in detail').toMatch(/Show\{" "\}how this will be executed|how this will be executed/);
    expect(src).toMatch(/const \[showPartition, setShowPartition\] = useState\(false\)/);
  });

  it('the duplicate warning now points at the resolution board instead of dead-ending', () => {
    /*
     * UX II. The warning previously ended "…only you can say which copy is
     * canonical", which was true before the board existed and is stale now.
     *
     * Mutation: restore the old sentence -> a warning with no act attached.
     */
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/Resolve them in the duplicate panel above/);
    expect(src).not.toMatch(/this is not blocked, because only you can say which copy\s+is canonical/);
  });
});
