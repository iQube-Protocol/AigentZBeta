/**
 * DETERMINISTIC BATCHED EXTRACTION — Stage 3 completeness (operator ruling,
 * 2026-08-03).
 *
 *   > "Partial evidence was processed as though the full population had been
 *   >  processed."
 *
 *   > "Stage 3 may only become `complete` when
 *   >   processed + explicitly excluded = admitted population.
 *   >   Otherwise it stays `partially-complete`."
 *
 * The arithmetic identity is the invariant made executable, and the headline
 * canary here asserts it DIRECTLY: a run whose sum does not reconcile must not
 * report complete, whatever else looks fine.
 *
 * OS-9: these are behavioural tests over pure functions, so they exercise the
 * real code path rather than asserting the shape of its source. Each was
 * verified to fail against the pre-change behaviour — see the update doc's
 * mutation table.
 */

import { describe, it, expect } from 'vitest';
import {
  BATCH_MAX_CHARS,
  ROW_MAX_CHARS,
  candidateDedupeKey,
  extractionProgression,
  partitionEvidence,
  reconcileExtraction,
  renderExtractionAccount,
  type BatchOutcome,
  type PartitionableEvidence,
} from '@/services/invariants/batchedExtraction';

const row = (id: string, chars: number, title = `row ${id}`): PartitionableEvidence => ({
  id,
  title,
  content: 'x'.repeat(chars),
});

/** A population shaped like the real one: 32 admitted sources whose extracted
 *  text runs to a few thousand chars each — the case that produced the defect
 *  (four rows read of thirty-two, reported as success). */
function realisticPopulation(n = 32, chars = 5_000): PartitionableEvidence[] {
  return Array.from({ length: n }, (_, i) => row(`e-${String(i).padStart(3, '0')}`, chars));
}

// ── 1 · THE HARD COMPLETION RULE ───────────────────────────────────────────

describe('the hard completion rule — processed + excluded === admitted population', () => {
  it('a row simply never handed to a batch is unaccounted, and the run is not complete', () => {
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a', 'b', 'c'],
      batches: [{ index: 0, evidenceIds: ['a', 'b'], ok: true, candidates: [] }],
      unprocessable: [],
    });
    expect(r.processed).toBe(2);
    expect(r.excluded).toBe(0);
    expect(r.reconciles).toBe(false);
    expect(r.unaccountedEvidenceIds).toEqual(['c']);
    expect(r.progression).toBe('partially-complete');
  });

  it('a count that LOOKS complete but does not reconcile is refused — the guard is load-bearing here', () => {
    /*
     * OS-9, applied to this file's own first draft.
     *
     * The canary above passes with OR without the `!reconciles` guard, because
     * `processed !== totalInput` already forces `partially-complete`. A test
     * that survives removal of the mechanism it claims to protect is not
     * protecting it — the exact defect `CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001`
     * names, found here by mutating the guard and watching nothing fail.
     *
     * This is the case where ONLY the guard saves us: a batch reports an
     * evidence id that is NOT in the admitted population (a stale or foreign
     * id), so `processed` reaches `totalInput` by counting a row that was never
     * admitted — while a genuinely admitted row went unread. Every surface
     * count looks like a finished run.
     *
     * Mutation: delete `if (!input.reconciles) return 'partially-complete';`
     * -> this reports `complete` over a population it never finished.
     */
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a', 'b'],
      batches: [{ index: 0, evidenceIds: ['a', 'stale-not-admitted'], ok: true, candidates: [] }],
      unprocessable: [],
    });
    // The counts look finished…
    expect(r.processed).toBe(r.totalInput);
    expect(r.excluded).toBe(0);
    // …but a real admitted row was never read.
    expect(r.unaccountedEvidenceIds).toEqual(['b']);
    expect(r.reconciles).toBe(false);
    // …so the stage must NOT claim completion.
    expect(r.progression).toBe('partially-complete');
    expect(r.progression).not.toBe('complete');
  });

  it('complete requires every admitted row READ — reconciling with exclusions is partially-complete', () => {
    // Reconciling is NECESSARY for complete, not sufficient.
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a', 'b'],
      batches: [{ index: 0, evidenceIds: ['a'], ok: true, candidates: [] }],
      unprocessable: [row('b', BATCH_MAX_CHARS + 1)],
    });
    expect(r.reconciles).toBe(true);
    expect(r.processed + r.excluded).toBe(r.totalInput);
    expect(r.progression).toBe('partially-complete');
  });

  it('complete is reachable — a fully processed population reports it', () => {
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a', 'b'],
      batches: [{ index: 0, evidenceIds: ['a', 'b'], ok: true, candidates: [] }],
      unprocessable: [],
    });
    expect(r.reconciles).toBe(true);
    expect(r.progression).toBe('complete');
  });

  it('the rule is evaluated in ONE place and refuses complete on a broken identity', () => {
    expect(extractionProgression({ reconciles: false, processed: 99, excluded: 0, totalInput: 100 })).toBe(
      'partially-complete',
    );
    expect(extractionProgression({ reconciles: true, processed: 100, excluded: 0, totalInput: 100 })).toBe('complete');
    expect(extractionProgression({ reconciles: true, processed: 0, excluded: 5, totalInput: 5 })).toBe('blocked');
    expect(extractionProgression({ reconciles: true, processed: 0, excluded: 0, totalInput: 0 })).toBe('not-started');
  });
});

// ── 2 · THE ORIGINAL DEFECT, as its own regression ─────────────────────────

describe('the original defect — partial evidence processed as though it were the whole population', () => {
  it('a 32-source population is FULLY partitioned, not capped at the four rows one context fits', () => {
    // The defect exactly: 24,000 chars / 6,000 per row = four rows, and the
    // rest were dropped. Mutation: revert to a single bounded pass -> 28 rows
    // vanish and this fails on the very first assertion.
    const pop = realisticPopulation(32, 5_000);
    const { batches, unprocessable } = partitionEvidence(pop);
    const partitioned = batches.flatMap((b) => b.rows.map((r) => r.id));
    expect(unprocessable).toHaveLength(0);
    expect(partitioned).toHaveLength(32);
    expect(new Set(partitioned).size).toBe(32);
    // And it really did take several batches — not one oversized one.
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(b.charCount).toBeLessThanOrEqual(BATCH_MAX_CHARS);
  });

  it('every admitted row lands in exactly one batch or in unprocessable — never nowhere', () => {
    const pop = [...realisticPopulation(10, 5_000), row('huge', BATCH_MAX_CHARS + 10)];
    const { batches, unprocessable } = partitionEvidence(pop);
    const seen = [...batches.flatMap((b) => b.rows.map((r) => r.id)), ...unprocessable.map((r) => r.id)];
    expect(seen.sort()).toEqual(pop.map((r) => r.id).sort());
    // No row is counted twice.
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('a fully partitioned population reconciles end-to-end', () => {
    const pop = realisticPopulation(32, 5_000);
    const { batches, unprocessable } = partitionEvidence(pop);
    const outcomes: BatchOutcome[] = batches.map((b) => ({
      index: b.index,
      evidenceIds: b.rows.map((r) => r.id),
      ok: true,
      candidates: [],
    }));
    const r = reconcileExtraction({ admittedEvidenceIds: pop.map((p) => p.id), batches: outcomes, unprocessable });
    expect(r.totalInput).toBe(32);
    expect(r.processed).toBe(32);
    expect(r.reconciles).toBe(true);
    expect(r.progression).toBe('complete');
  });
});

// ── 3 · DETERMINISM, and the order-dependence bug that must not return ─────

describe('partitioning is deterministic — a function of the SET, not of order', () => {
  it('the same population in any order yields identical batches', () => {
    // Mutation: drop the sort-by-id -> fetch order changes the batches and a
    // re-run over the same population produces different partitions.
    const pop = realisticPopulation(20, 4_000);
    const shuffled = [...pop].reverse();
    const a = partitionEvidence(pop);
    const b = partitionEvidence(shuffled);
    expect(b.batches.map((x) => x.rows.map((r) => r.id))).toEqual(a.batches.map((x) => x.rows.map((r) => r.id)));
  });

  it('a row that FITS is never excluded because an earlier row did not', () => {
    /*
     * THE REGRESSION THIS EXISTS TO PREVENT. The pre-fix loop `break`ed on the
     * first row that overflowed, so every later row — including small ones that
     * would have fitted — was silently dropped. I caused that bug in this same
     * area, which is exactly why it gets its own canary.
     *
     * Mutation: reintroduce `break` in the packing loop -> `small-z` disappears
     * from every batch while being neither processed nor excluded.
     */
    const pop = [row('a-big', ROW_MAX_CHARS), row('m-big', ROW_MAX_CHARS), row('s-big', ROW_MAX_CHARS), row('t-big', ROW_MAX_CHARS), row('u-big', ROW_MAX_CHARS), row('z-small', 10)];
    const { batches, unprocessable } = partitionEvidence(pop);
    const placed = batches.flatMap((b) => b.rows.map((r) => r.id));
    expect(placed).toContain('z-small');
    expect(unprocessable).toHaveLength(0);
    expect(placed).toHaveLength(pop.length);
  });

  it('a row is unprocessable only when it exceeds a whole batch — a property of the row, not of order', () => {
    /*
     * Reachable only when `rowMaxChars > batchMaxChars`, so the parameters are
     * passed explicitly. In the SHIPPED configuration (row 6k, batch 24k) the
     * branch cannot fire — which my first draft of this test got wrong, and
     * that failure is what surfaced the row-level truncation below.
     */
    const { batches, unprocessable } = partitionEvidence(
      [row('ok', 100), row('huge', 5_000)],
      { batchMaxChars: 1_000, rowMaxChars: 5_000 },
    );
    expect(unprocessable.map((r) => r.id)).toEqual(['huge']);
    expect(batches.flatMap((b) => b.rows.map((r) => r.id))).toEqual(['ok']);
  });
});

// ── 4 · A FAILED BATCH ISOLATES ITSELF ─────────────────────────────────────

describe('a failed batch quarantines its own rows and nothing else', () => {
  const outcomes: BatchOutcome[] = [
    { index: 0, evidenceIds: ['a', 'b'], ok: true, candidates: [{ statement: 'Accountability follows authority.', rationale: '', evidenceIds: ['a'], confidence: 0.7, abstractionLevel: 'L3' }] },
    { index: 1, evidenceIds: ['c', 'd'], ok: false, error: 'inference timed out', candidates: [] },
  ];

  it('the surviving batch keeps its candidates, and the failed batch becomes an explicit exclusion', () => {
    // Mutation: abort the run on the first failed batch -> one timeout
    // discards a whole population's extraction, which is the paralysis the
    // exception-isolation ruling abolished, reappearing inside Stage 3.
    const r = reconcileExtraction({ admittedEvidenceIds: ['a', 'b', 'c', 'd'], batches: outcomes, unprocessable: [] });
    expect(r.candidates).toHaveLength(1);
    expect(r.processed).toBe(2);
    expect(r.excluded).toBe(2);
    expect(r.reconciles).toBe(true);
    expect(r.progression).toBe('partially-complete');
    expect(r.failedBatchCount).toBe(1);
  });

  it('the failure is a typed exception that blocks nothing', () => {
    const r = reconcileExtraction({ admittedEvidenceIds: ['a', 'b', 'c', 'd'], batches: outcomes, unprocessable: [] });
    const batchException = r.exceptions.find((e) => e.scope === 'batch');
    expect(batchException).toBeDefined();
    expect(batchException!.stage).toBe('extract-candidates');
    expect(batchException!.cause).toContain('inference timed out');
    expect(batchException!.blocksCurrentStage).toBe(false);
    expect(batchException!.blocksReadiness).toBe(false);
    expect(batchException!.blocksFreeze).toBe(false);
  });
});

// ── 5 · GLOBAL dedup, AFTER reconciliation ─────────────────────────────────

describe('candidates are deduplicated globally, never per batch', () => {
  const same = 'Financial actions require verifiable accountability.';
  const outcomes: BatchOutcome[] = [
    { index: 0, evidenceIds: ['a'], ok: true, candidates: [{ statement: same, rationale: 'from a', evidenceIds: ['a'], confidence: 0.6, abstractionLevel: 'L3' }] },
    { index: 1, evidenceIds: ['b'], ok: true, candidates: [{ statement: `  ${same.toUpperCase()}  `, rationale: 'from b', evidenceIds: ['b'], confidence: 0.8, abstractionLevel: 'L3' }] },
  ];

  it('the same statement from two batches survives once, carrying the UNION of its evidence', () => {
    // Two batches independently surfacing one invariant is a CONVERGENCE
    // signal. Mutation: dedup inside each batch only -> the registry gets two
    // near-identical rows and the convergence is lost as noise.
    const r = reconcileExtraction({ admittedEvidenceIds: ['a', 'b'], batches: outcomes, unprocessable: [] });
    expect(r.candidates).toHaveLength(1);
    expect(r.duplicatesRemoved).toBe(1);
    expect([...r.candidates[0].evidenceIds].sort()).toEqual(['a', 'b']);
    // …and the stronger confidence survives, not whichever arrived first.
    expect(r.candidates[0].confidence).toBe(0.8);
  });

  it('the dedup key normalises case and punctuation, but does not merge distinct statements', () => {
    expect(candidateDedupeKey('Traceability enables accountability.')).toBe(
      candidateDedupeKey('  traceability   enables ACCOUNTABILITY  '),
    );
    expect(candidateDedupeKey('Traceability enables accountability.')).not.toBe(
      candidateDedupeKey('Traceability enables auditability.'),
    );
  });
});

// ── 6 · The operator's report line ─────────────────────────────────────────

describe('total input / processed / excluded is reported', () => {
  it('states the arithmetic when it reconciles', () => {
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a', 'b'],
      batches: [{ index: 0, evidenceIds: ['a', 'b'], ok: true, candidates: [] }],
      unprocessable: [],
    });
    expect(renderExtractionAccount(r)).toContain('2 processed, 0 excluded');
    expect(renderExtractionAccount(r)).toContain('Accounted: 2 + 0 = 2.');
  });

  it('SAYS SO, loudly, when it does not reconcile — and names the unaccounted rows', () => {
    // A failure of accounting must never render as a clean summary.
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a', 'b', 'c'],
      batches: [{ index: 0, evidenceIds: ['a'], ok: true, candidates: [] }],
      unprocessable: [],
    });
    const line = renderExtractionAccount(r);
    expect(line).toContain('DOES NOT RECONCILE');
    expect(line).toContain('b');
    expect(line).toContain('c');
  });
});


// ── 7 · THE SAME DEFECT ONE LEVEL DOWN — row-level truncation ──────────────

/**
 * Found by this file's own canary while asserting `unprocessable`: a row longer
 * than `ROW_MAX_CHARS` is CAPPED, and the candidate extracted from it cites the
 * whole row. One `discovery_evidence` row holds up to 200,000 characters
 * (`ingestionBroker.ts`'s chunk size) while extraction reads 6,000 — so up to
 * 97% of a source can go unread while the resulting invariant claims it as its
 * basis.
 *
 * That is *"partial evidence processed as though the full population had been
 * processed"* applied to ONE ROW. It is DISCLOSED here, not fixed — splitting a
 * row across batches is a distinct mechanism and is recorded as outstanding.
 */
describe('row-level truncation is disclosed, not silent', () => {
  it('a row read only in part is reported with how much was read', () => {
    // Mutation: drop `truncatedRows` from the partition result -> a 200k-char
    // source read at 3% produces candidates that silently claim the whole
    // source, which is the original defect at row scale.
    const big = row('big', 200_000);
    const { truncatedRows } = partitionEvidence([row('small', 100), big]);
    expect(truncatedRows).toHaveLength(1);
    expect(truncatedRows[0].row.id).toBe('big');
    expect(truncatedRows[0].readChars).toBe(ROW_MAX_CHARS);
    expect(truncatedRows[0].totalChars).toBe(200_000);
  });

  it('a truncated row still COUNTS AS PROCESSED — it contributed', () => {
    // It is not an exclusion: the row was read and did produce evidence. What
    // is recorded is the limit on what was read.
    const pop = [row('a', 200_000), row('b', 100)];
    const { batches, unprocessable, truncatedRows } = partitionEvidence(pop);
    const r = reconcileExtraction({
      admittedEvidenceIds: pop.map((p) => p.id),
      batches: batches.map((b) => ({ index: b.index, evidenceIds: b.rows.map((x) => x.id), ok: true, candidates: [] })),
      unprocessable,
      truncatedRows,
    });
    expect(r.processed).toBe(2);
    expect(r.excluded).toBe(0);
    expect(r.reconciles).toBe(true);
    expect(r.truncatedRowCount).toBe(1);
  });

  it('the truncation rides on the exception list and blocks nothing', () => {
    const pop = [row('a', 200_000)];
    const { batches, unprocessable, truncatedRows } = partitionEvidence(pop);
    const r = reconcileExtraction({
      admittedEvidenceIds: ['a'],
      batches: batches.map((b) => ({ index: b.index, evidenceIds: b.rows.map((x) => x.id), ok: true, candidates: [] })),
      unprocessable,
      truncatedRows,
    });
    const e = r.exceptions.find((x) => x.recordId === 'a');
    expect(e).toBeDefined();
    expect(e!.cause).toMatch(/6,000 of 200,000 characters/);
    expect(e!.cause).toMatch(/3% of the row/);
    expect(e!.blocksCurrentStage).toBe(false);
    expect(e!.blocksFreeze).toBe(false);
    // …and the account says so rather than reporting a clean full read.
    expect(renderExtractionAccount(r)).toMatch(/read only in part/);
  });
});
