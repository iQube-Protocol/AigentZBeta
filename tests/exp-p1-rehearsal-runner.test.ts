/**
 * Canary — `services/research/expP1Rehearsal.ts` (2026-09-07 two-mode
 * execution model: "Update the experiment execution model so we can
 * rehearse internally without weakening the registered confirmatory
 * protocol.").
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
      expect(armA.groundingInvariantIds).toEqual([]);
      expect(armA.score).toBe(0);
    }

    // Arm C — a genuine, bounded subset (≤ 40% of 10 members = 4).
    const armCIds = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'C').groundingInvariantIds;
    expect(armCIds.length).toBeGreaterThan(0);
    expect(armCIds.length).toBeLessThanOrEqual(4);
    for (const id of armCIds) expect(MEMBERS.some((m) => m.id === id)).toBe(true);
  });

  it("Arm B's grounding is constrained to the FROZEN snapshot — a live-only id never leaks in", async () => {
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
    const armBIds = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B').groundingInvariantIds;
    expect(armBIds).toContain('inv-0');
    expect(armBIds).not.toContain('inv-999-live-only');
  });
});
