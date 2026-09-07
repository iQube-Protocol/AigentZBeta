/**
 * Canary — `services/research/expP1Rehearsal.ts` (2026-09-07 two-mode
 * execution model: "Update the experiment execution model so we can
 * rehearse internally without weakening the registered confirmatory
 * protocol." Extended same-day for the instrument-validation fixes found in
 * the first rehearsal run — see the module's own header.).
 *
 * Pins:
 *   1. Eligibility requires a FROZEN crystal-version generation with
 *      `executionDesignation: 'internal-pilot'` AND a persisted
 *      memberSnapshot — never eligible with none, a confirmatory freeze, or
 *      a missing snapshot.
 *   2. A rehearsal never loads an `'external-held-out'` task set (that
 *      provenance describes materials this codebase cannot construct).
 *   3. Arm A is always empty grounding / score 0 (Cold — task prompt only).
 *   4. Arm B's grounding is constrained to ids that are ALSO members of the
 *      FROZEN snapshot — a live-table id outside the frozen generation must
 *      never leak into a rehearsal's grounding.
 *   5. Arm C is a genuine, bounded SUBSET of the frozen snapshot (≤ 40%),
 *      never the whole population.
 *   6. The persisted run is unconditionally `runExecutionDesignation:
 *      'internal-rehearsal'`, `confirmatoryEligible: false` — never a caller
 *      override.
 *   7. The frozen crystal artifact is only ever READ (`latestFrozenCrystalArtifact`)
 *      — never mutated (no freeze/upsert call is made).
 *   8. Arm B's SELECTED set (what grounds its score) is a genuinely BOUNDED
 *      selection — `buildInvariantSlice` is called WITHOUT a `limit`
 *      override — distinct from its AVAILABLE set, which may be larger.
 *   9. A task with no keyword match anywhere in the frozen population is
 *      `scorable: false` with a non-null `unscorableReason`; a task with a
 *      match is `scorable: true` with `unscorableReason: null`.
 *  10. Arm D's `scoreMetric` is `'keyword-substring-coverage'`; A/B/C's is
 *      `'invariant-id-recall'`.
 *  11. `recordExecutionRun` receives `armDProvenance`, `armConfiguration`,
 *      `scoringConfiguration` reflecting the actual selection/scoring used.
 *  12. `summarizeRehearsalRun` excludes unscorable tasks from every mean and
 *      reports the B available/selected and C fixed-slice sizes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';

const mockLatestFrozenCrystalArtifact = vi.fn();
const mockRecordExecutionRun = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (...args: unknown[]) => mockLatestFrozenCrystalArtifact(...args),
  recordExecutionRun: (...args: unknown[]) => mockRecordExecutionRun(...args),
  freezeArtifact: vi.fn(() => {
    throw new Error('a rehearsal must never call freezeArtifact — the frozen crystal is never mutated');
  }),
  upsertArtifact: vi.fn(() => {
    throw new Error('a rehearsal must never call upsertArtifact — the frozen crystal is never mutated');
  }),
}));

const mockBuildInvariantSlice = vi.fn();
vi.mock('@/services/invariants/grounding', () => ({
  buildInvariantSlice: (...args: unknown[]) => mockBuildInvariantSlice(...args),
}));

import { rehearsalEligibility, runExpP1Rehearsal, PROVISIONAL_REHEARSAL_TASK_SET } from '@/services/research/expP1Rehearsal';

function member(id: string, statement: string): HashCoveredMember {
  return { id, statement, namespace: 'finance', semanticType: null, status: 'validated', evidenceProvenance: null, provenance: null };
}

const MEMBERS: HashCoveredMember[] = Array.from({ length: 10 }, (_, i) =>
  member(`inv-${i}`, i === 0 ? 'The system manages risk exposure carefully.' : `Statement number ${i} about custody and reserves.`),
);

function frozenArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'EXP-P1/crystal-vP2',
    kind: 'crystal-version',
    phase: 'protocol',
    experimentId: 'EXP-P1',
    lifecycle: 'frozen',
    contentHash: 'hash-abc',
    commitmentHash: 'hash-abc',
    frozenAt: '2026-09-06T00:00:00.000Z',
    signedBy: ['operator-ref-1'],
    receiptId: 'receipt-freeze-1',
    executionDesignation: 'internal-pilot',
    scientificDeviations: [],
    memberSnapshot: MEMBERS,
    ...overrides,
  };
}

beforeEach(() => {
  mockLatestFrozenCrystalArtifact.mockReset();
  mockRecordExecutionRun.mockReset();
  mockBuildInvariantSlice.mockReset();
  mockRecordExecutionRun.mockResolvedValue({ ok: true, receiptId: 'receipt-run-1', artifact: { id: 'EXP-P1/execution-run/internal-rehearsal/x' } });
  mockBuildInvariantSlice.mockResolvedValue({ generatedAt: null, context: {}, items: [], citedIds: [] });
});

describe('rehearsalEligibility', () => {
  it('is not eligible when no crystal generation has ever been frozen', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const e = await rehearsalEligibility('EXP-P1');
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/no frozen crystal-version/);
  });

  it('is not eligible for a confirmatory-designated freeze', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact({ executionDesignation: 'confirmatory' }));
    const e = await rehearsalEligibility('EXP-P1');
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/internal-pilot/);
  });

  it('is not eligible when the frozen artifact has no memberSnapshot', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact({ memberSnapshot: null }));
    const e = await rehearsalEligibility('EXP-P1');
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/memberSnapshot/);
  });

  it('is eligible for a frozen internal-pilot generation with a memberSnapshot', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    const e = await rehearsalEligibility('EXP-P1');
    expect(e.eligible).toBe(true);
    expect(e.frozenCrystalArtifactId).toBe('EXP-P1/crystal-vP2');
    expect(e.frozenCrystalContentHash).toBe('hash-abc');
  });
});

describe('runExpP1Rehearsal', () => {
  it('refuses to run when not eligible', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const result = await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1' });
    expect(result.ok).toBe(false);
    expect(mockRecordExecutionRun).not.toHaveBeenCalled();
  });

  it("refuses an 'external-held-out' task set", async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    const result = await runExpP1Rehearsal({
      personaId: 'persona-1',
      experimentId: 'EXP-P1',
      taskSet: { id: 'x', provenance: 'external-held-out', tasks: PROVISIONAL_REHEARSAL_TASK_SET.tasks },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/external-held-out/);
    expect(mockRecordExecutionRun).not.toHaveBeenCalled();
  });

  it('refuses a task set with zero tasks', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    const result = await runExpP1Rehearsal({
      personaId: 'persona-1',
      experimentId: 'EXP-P1',
      taskSet: { id: 'x', provenance: 'synthetic', tasks: [] },
    });
    expect(result.ok).toBe(false);
    expect(mockRecordExecutionRun).not.toHaveBeenCalled();
  });

  it('runs the four-arm harness and persists an internal-rehearsal, non-confirmatory-eligible run', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    mockBuildInvariantSlice.mockResolvedValue({
      generatedAt: null,
      context: {},
      items: [{ id: 'inv-0', seedId: null, statement: MEMBERS[0].statement, namespace: 'finance', semanticType: null, status: 'validated', confidence: 1, standing: 1, reach: 1 }],
      citedIds: ['inv-0'],
    });

    const result = await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1' });
    expect(result.ok).toBe(true);
    expect(mockRecordExecutionRun).toHaveBeenCalledTimes(1);
    const call = mockRecordExecutionRun.mock.calls[0][0];
    expect(call.runExecutionDesignation).toBe('internal-rehearsal');
    expect(call.confirmatoryEligible).toBe(false);
    expect(call.frozenCrystalArtifactId).toBe('EXP-P1/crystal-vP2');
    expect(call.frozenCrystalContentHash).toBe('hash-abc');
    expect(call.armIds).toEqual(['A', 'B', 'C', 'D']);
    expect(call.taskResults).toHaveLength(PROVISIONAL_REHEARSAL_TASK_SET.tasks.length);

    // Arm A — Cold — always empty grounding, score 0.
    for (const task of call.taskResults) {
      const armA = task.armResults.find((a: { armId: string }) => a.armId === 'A');
      // null, never [] and never a copy of anything — no model/runtime
      // execution exists in this harness to measure demonstrated use
      // (2026-09-07 audit: this field must never silently equal
      // selectedInvariantIds).
      expect(armA.actuallyGroundedInvariantIds).toBeNull();
      expect(armA.availableInvariantIds).toEqual([]);
      expect(armA.selectedInvariantIds).toEqual([]);
      expect(armA.scoreMetric).toBe('invariant-id-recall');
      expect(armA.score).toBe(0);
    }

    // Arm D — its scoreMetric is the DIFFERENT, text-based one.
    const armD = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'D');
    expect(armD.scoreMetric).toBe('keyword-substring-coverage');
    expect(armD.actuallyGroundedInvariantIds).toBeNull();

    // Arm C — a genuine, bounded subset (≤ 40% of 10 members = 4).
    const armC = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'C');
    expect(armC.selectedInvariantIds.length).toBeGreaterThan(0);
    expect(armC.selectedInvariantIds.length).toBeLessThanOrEqual(4);
    // actuallyGroundedInvariantIds is null — NEVER a copy of selectedInvariantIds,
    // even though score is computed FROM selectedInvariantIds.
    expect(armC.actuallyGroundedInvariantIds).toBeNull();
    // Arm C's AVAILABLE set is the whole frozen population it was carved from.
    expect(armC.availableInvariantIds).toHaveLength(MEMBERS.length);
    for (const id of armC.selectedInvariantIds) expect(MEMBERS.some((m) => m.id === id)).toBe(true);

    // recordExecutionRun receives the new audit-trail fields.
    expect(call.armDProvenance).toBe('provisional-irl-authored');
    expect(call.armConfiguration.armC.fixedSliceSize).toBe(armC.selectedInvariantIds.length);
    expect(call.armConfiguration.armC.frozenPopulationSize).toBe(MEMBERS.length);
    expect(call.scoringConfiguration['invariant-id-recall']).toMatch(/recall/i);
    expect(call.scoringConfiguration['keyword-substring-coverage']).toMatch(/not comparable/i);
  });

  it("Arm B's SELECTED grounding is constrained to the FROZEN snapshot — a live-only id never leaks in", async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    mockBuildInvariantSlice.mockResolvedValue({
      generatedAt: null,
      context: {},
      items: [
        { id: 'inv-0', seedId: null, statement: MEMBERS[0].statement, namespace: 'finance', semanticType: null, status: 'validated', confidence: 1, standing: 1, reach: 1 },
        // A live-table id that is NOT part of the frozen snapshot (e.g. a
        // successor generation's member, added after the freeze this run is
        // scoped to) — must never appear in Arm B's grounding.
        { id: 'inv-999-live-only', seedId: null, statement: 'a live-only member not in the frozen snapshot', namespace: 'finance', semanticType: null, status: 'validated', confidence: 1, standing: 1, reach: 1 },
      ],
      citedIds: ['inv-0', 'inv-999-live-only'],
    });

    await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1' });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armB = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    expect(armB.selectedInvariantIds).toContain('inv-0');
    expect(armB.selectedInvariantIds).not.toContain('inv-999-live-only');
    expect(armB.availableInvariantIds).toContain('inv-0');
    expect(armB.availableInvariantIds).not.toContain('inv-999-live-only');
    expect(armB.actuallyGroundedInvariantIds).toBeNull();
  });

  it("Arm B's SELECTED call never overrides buildInvariantSlice's limit — only the AVAILABLE call does (2026-09-07 instrument-validation fix)", async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    // Distinguish the two calls by whether `limit` was overridden: the
    // AVAILABLE call passes `limit: members.length` (10); the SELECTED call
    // must call buildInvariantSlice WITHOUT a limit override at all.
    mockBuildInvariantSlice.mockImplementation((ctx: { limit?: number }) => {
      if (ctx.limit === MEMBERS.length) {
        // AVAILABLE — the whole domain-filtered pool.
        return Promise.resolve({
          generatedAt: null,
          context: ctx,
          items: MEMBERS.map((m) => ({ id: m.id, seedId: null, statement: m.statement, namespace: 'finance', semanticType: null, status: 'validated', confidence: 1, standing: 1, reach: 1 })),
          citedIds: MEMBERS.map((m) => m.id),
        });
      }
      // SELECTED — buildInvariantSlice's own default (never a population-sized override).
      expect(ctx.limit).toBeUndefined();
      return Promise.resolve({
        generatedAt: null,
        context: ctx,
        items: [{ id: 'inv-0', seedId: null, statement: MEMBERS[0].statement, namespace: 'finance', semanticType: null, status: 'validated', confidence: 1, standing: 1, reach: 1 }],
        citedIds: ['inv-0'],
      });
    });

    await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1' });
    expect(mockBuildInvariantSlice).toHaveBeenCalledTimes(2);
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armB = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    // AVAILABLE is the whole population (10); SELECTED is genuinely bounded (1)
    // — the exact confound the first rehearsal run surfaced.
    expect(armB.availableInvariantIds).toHaveLength(MEMBERS.length);
    expect(armB.selectedInvariantIds).toEqual(['inv-0']);
    expect(armB.availableInvariantIds.length).toBeGreaterThan(armB.selectedInvariantIds.length);
  });

  it('marks a task unscorable when no frozen invariant matches its keywords, and scorable otherwise — excluding neither from the persisted taskResults', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    // MEMBERS' statements contain 'risk' (member 0) and 'custody'/'reserves'
    // (the rest) — 'nonexistent-keyword' matches nothing in the population.
    const taskSet = {
      id: 'test-task-set',
      provenance: 'synthetic' as const,
      tasks: [
        { id: 'scorable-task', kind: 'recall' as const, prompt: 'p', keywords: ['risk'] },
        { id: 'unscorable-task', kind: 'recall' as const, prompt: 'p', keywords: ['nonexistent-keyword'] },
      ],
    };
    await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const scorable = call.taskResults.find((t: { taskId: string }) => t.taskId === 'scorable-task');
    const unscorable = call.taskResults.find((t: { taskId: string }) => t.taskId === 'unscorable-task');
    expect(scorable.scorable).toBe(true);
    expect(scorable.unscorableReason).toBeNull();
    expect(unscorable.scorable).toBe(false);
    expect(unscorable.unscorableReason).toMatch(/nonexistent-keyword/);
    // Diagnostics retained, never dropped, even though unscorable.
    expect(unscorable.armResults).toHaveLength(4);
  });

  it('actuallyGroundedInvariantIds is null for every arm on every task (2026-09-07 audit: no model/runtime execution exists in this harness to demonstrate evidence-of-use, so it must NEVER be populated as a copy of selectedInvariantIds)', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    mockBuildInvariantSlice.mockResolvedValue({
      generatedAt: null,
      context: {},
      items: [{ id: 'inv-0', seedId: null, statement: MEMBERS[0].statement, namespace: 'finance', semanticType: null, status: 'validated', confidence: 1, standing: 1, reach: 1 }],
      citedIds: ['inv-0'],
    });
    await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1' });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    for (const task of call.taskResults) {
      for (const armResult of task.armResults) {
        expect(armResult.actuallyGroundedInvariantIds).toBeNull();
      }
    }
    // The persisted scoringConfiguration documents this explicitly, so a
    // reader of the raw JSON (not just the source code) can see why.
    expect(call.scoringConfiguration.actuallyGroundedInvariantIds).toMatch(/always null/i);
  });
});

describe('summarizeRehearsalRun', () => {
  it('excludes unscorable tasks from every mean and reports B/C set sizes', async () => {
    const { summarizeRehearsalRun } = await import('@/services/research/expP1Rehearsal');
    const run = {
      armIds: ['A', 'B', 'C', 'D'] as const,
      taskResults: [
        {
          taskId: 't1',
          taskKind: 'recall',
          groundTruthInvariantIds: ['inv-1'],
          scorable: true,
          unscorableReason: null,
          armResults: [
            { armId: 'A' as const, armLabel: 'Cold', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall' as const, score: 0 },
            { armId: 'B' as const, armLabel: 'Full Runtime', availableInvariantIds: ['inv-1', 'inv-2'], selectedInvariantIds: ['inv-1'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall' as const, score: 1 },
            { armId: 'C' as const, armLabel: 'Flattened Invariants', availableInvariantIds: ['inv-1', 'inv-2'], selectedInvariantIds: ['inv-1'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall' as const, score: 1 },
            { armId: 'D' as const, armLabel: 'Expert Prose', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'keyword-substring-coverage' as const, score: 0.5 },
          ],
        },
        {
          taskId: 't2-unscorable',
          taskKind: 'derivation',
          groundTruthInvariantIds: [],
          scorable: false,
          unscorableReason: 'no match',
          armResults: [
            { armId: 'A' as const, armLabel: 'Cold', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall' as const, score: 0 },
            { armId: 'B' as const, armLabel: 'Full Runtime', availableInvariantIds: ['inv-1', 'inv-2'], selectedInvariantIds: ['inv-1'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall' as const, score: 0 },
            { armId: 'C' as const, armLabel: 'Flattened Invariants', availableInvariantIds: ['inv-1', 'inv-2'], selectedInvariantIds: ['inv-1'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall' as const, score: 0 },
            { armId: 'D' as const, armLabel: 'Expert Prose', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'keyword-substring-coverage' as const, score: 0 },
          ],
        },
      ],
    };
    const summary = summarizeRehearsalRun(run);
    expect(summary.taskCounts).toEqual({ total: 2, scored: 1, unscorable: 1 });
    expect(summary.unscorableTaskIds).toEqual(['t2-unscorable']);
    // The unscorable task's zero scores must NOT drag the mean down.
    const armBSummary = summary.perArm.find((a) => a.armId === 'B')!;
    expect(armBSummary.meanScoreOverall).toBe(1);
    expect(armBSummary.meanScoreRecall).toBe(1);
    expect(armBSummary.meanScoreDerivation).toBeNull(); // no scorable derivation task
    expect(summary.armBAvailableSetSize).toBe(2);
    expect(summary.armBSelectedSetSize).toBe(1);
    expect(summary.armCFixedSliceSize).toBe(1);
    expect(summary.frozenPopulationSize).toBe(2);
    expect(summary.instrumentCaveat).toMatch(/NOT A SCIENTIFIC RESULT/);
  });
});
