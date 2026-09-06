/**
 * Canary — `services/research/artifacts.ts::recordExecutionRun` /
 * `listExecutionRuns` (2026-09-07 two-mode execution model).
 *
 * Pins:
 *   1. An `internal-rehearsal` run may NEVER be persisted with
 *      `confirmatoryEligible: true` — refused outright, never silently
 *      corrected.
 *   2. `armIds` must name at least one arm.
 *   3. A successful write persists every execution-run-specific field
 *      verbatim and `listExecutionRuns` reads them all back — never just the
 *      base `FrozenArtifact` shape (`listArtifacts`'s generic `fromRow` does
 *      not reconstruct these fields at all).
 *   4. `listExecutionRuns` is scoped to the requested experiment and to
 *      `kind: 'execution-run'` rows only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListResearchObjects = vi.fn();
const mockUpsertResearchObject = vi.fn();
const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  listResearchObjects: (...args: unknown[]) => mockListResearchObjects(...args),
  upsertResearchObject: (...args: unknown[]) => mockUpsertResearchObject(...args),
  writeLifecycleReceipt: (...args: unknown[]) => mockWriteLifecycleReceipt(...args),
}));

import { recordExecutionRun, listExecutionRuns, getExecutionRun } from '@/services/research/artifacts';
import type { RehearsalTaskResult } from '@/types/research';

const TASK_RESULTS: RehearsalTaskResult[] = [
  {
    taskId: 'rehearsal-001',
    taskKind: 'recall',
    groundTruthInvariantIds: ['inv-1'],
    armResults: [
      { armId: 'A', armLabel: 'Cold', groundingInvariantIds: [], score: 0 },
      { armId: 'B', armLabel: 'Full Runtime', groundingInvariantIds: ['inv-1'], score: 1 },
      { armId: 'C', armLabel: 'Flattened Invariants', groundingInvariantIds: ['inv-1'], score: 1 },
      { armId: 'D', armLabel: 'Expert Prose', groundingInvariantIds: [], score: 0.5 },
    ],
  },
];

function baseInput(overrides: Partial<Parameters<typeof recordExecutionRun>[0]> = {}) {
  return {
    personaId: 'persona-1',
    experimentId: 'EXP-P1',
    runExecutionDesignation: 'internal-rehearsal' as const,
    frozenCrystalArtifactId: 'EXP-P1/crystal-vP2',
    frozenCrystalContentHash: 'hash-abc',
    taskSetId: 'EXP-P1/rehearsal-task-set-provisional-v1',
    taskSetProvenance: 'provisional' as const,
    armIds: ['A', 'B', 'C', 'D'] as const,
    providerModel: 'deterministic-retrieval-v1',
    confirmatoryEligible: false,
    taskResults: TASK_RESULTS,
    ...overrides,
  };
}

beforeEach(() => {
  mockListResearchObjects.mockReset();
  mockUpsertResearchObject.mockReset();
  mockWriteLifecycleReceipt.mockReset();
  mockWriteLifecycleReceipt.mockResolvedValue({ ok: true, receiptId: 'receipt-1' });
  mockUpsertResearchObject.mockResolvedValue({ ok: true });
});

describe('recordExecutionRun', () => {
  it('refuses an internal-rehearsal run marked confirmatoryEligible: true', async () => {
    const result = await recordExecutionRun(baseInput({ confirmatoryEligible: true }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/never be confirmatoryEligible/);
    expect(mockUpsertResearchObject).not.toHaveBeenCalled();
  });

  it('refuses a run with no arms named', async () => {
    const result = await recordExecutionRun(baseInput({ armIds: [] }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least one arm/);
    expect(mockUpsertResearchObject).not.toHaveBeenCalled();
  });

  it('persists every execution-run-specific field verbatim on a valid internal-rehearsal write', async () => {
    const result = await recordExecutionRun(baseInput());
    expect(result.ok).toBe(true);
    expect(result.receiptId).toBe('receipt-1');
    expect(mockUpsertResearchObject).toHaveBeenCalledTimes(1);
    const call = mockUpsertResearchObject.mock.calls[0][0];
    expect(call.objectKind).toBe('artifact');
    expect(call.lifecycleState).toBe('executed');
    expect(call.payload.kind).toBe('execution-run');
    expect(call.payload.runExecutionDesignation).toBe('internal-rehearsal');
    expect(call.payload.confirmatoryEligible).toBe(false);
    expect(call.payload.frozenCrystalArtifactId).toBe('EXP-P1/crystal-vP2');
    expect(call.payload.taskSetProvenance).toBe('provisional');
    expect(call.payload.armIds).toEqual(['A', 'B', 'C', 'D']);
    expect(call.payload.taskResults).toEqual(TASK_RESULTS);
  });

  it('never touches EXPERIMENT_LIFECYCLE / recordExperimentRunLifecycle — writes a research_objects artifact row only', async () => {
    await recordExecutionRun(baseInput());
    // The only object_kind this function ever writes is 'artifact' — never
    // 'experiment' (the row recordExperimentRunLifecycle's macro-transition
    // touches). A rehearsal run must never be able to advance, or be read as
    // advancing, the experiment's own designed/protocol-ratified/running/...
    // lifecycle.
    for (const call of mockUpsertResearchObject.mock.calls) {
      expect(call[0].objectKind).toBe('artifact');
    }
  });
});

describe('listExecutionRuns', () => {
  it('reconstructs the FULL ExecutionRunArtifact shape — never just the base FrozenArtifact fields', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [
        {
          objectKind: 'artifact',
          objectId: 'EXP-P1/execution-run/internal-rehearsal/2026-09-07T00:00:00.000Z',
          payload: {
            kind: 'execution-run',
            phase: 'execution',
            experimentId: 'EXP-P1',
            contentHash: null,
            commitmentHash: null,
            frozenAt: '2026-09-07T00:00:00.000Z',
            signedBy: [],
            runExecutionDesignation: 'internal-rehearsal',
            frozenCrystalArtifactId: 'EXP-P1/crystal-vP2',
            frozenCrystalContentHash: 'hash-abc',
            taskSetId: 'EXP-P1/rehearsal-task-set-provisional-v1',
            taskSetProvenance: 'provisional',
            armIds: ['A', 'B', 'C', 'D'],
            providerModel: 'deterministic-retrieval-v1',
            confirmatoryEligible: false,
            taskResults: TASK_RESULTS,
          },
          lifecycleState: 'executed',
          receiptId: 'receipt-1',
        },
      ],
    });
    const runs = await listExecutionRuns('EXP-P1');
    expect(runs).toHaveLength(1);
    expect(runs[0].confirmatoryEligible).toBe(false);
    expect(runs[0].taskSetProvenance).toBe('provisional');
    expect(runs[0].taskResults).toEqual(TASK_RESULTS);
    expect(runs[0].receiptId).toBe('receipt-1');
  });

  it('excludes rows of a different kind and a different experimentId', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [
        { objectKind: 'artifact', objectId: 'EXP-P1/crystal-vP2', payload: { kind: 'crystal-version', experimentId: 'EXP-P1' }, lifecycleState: 'frozen', receiptId: null },
        { objectKind: 'artifact', objectId: 'EXP-OTHER/execution-run/internal-rehearsal/x', payload: { kind: 'execution-run', experimentId: 'EXP-OTHER' }, lifecycleState: 'executed', receiptId: null },
      ],
    });
    const runs = await listExecutionRuns('EXP-P1');
    expect(runs).toHaveLength(0);
  });
});

describe('getExecutionRun — the "View results" affordance\'s single-run reader (2026-09-07)', () => {
  it('returns null when the id does not resolve to any row', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [] });
    const run = await getExecutionRun('EXP-P1/execution-run/internal-rehearsal/does-not-exist');
    expect(run).toBeNull();
  });

  it('returns null when the id resolves to a row of a different kind (e.g. the frozen crystal itself)', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [{ objectKind: 'artifact', objectId: 'EXP-P1/crystal-vP2', payload: { kind: 'crystal-version', experimentId: 'EXP-P1' }, lifecycleState: 'frozen', receiptId: null }],
    });
    const run = await getExecutionRun('EXP-P1/crystal-vP2');
    expect(run).toBeNull();
  });

  it('returns the FULL ExecutionRunArtifact shape, including taskResults, when found', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [
        {
          objectKind: 'artifact',
          objectId: 'EXP-P1/execution-run/internal-rehearsal/2026-09-07T00:00:00.000Z',
          payload: {
            kind: 'execution-run',
            phase: 'execution',
            experimentId: 'EXP-P1',
            contentHash: null,
            commitmentHash: null,
            frozenAt: '2026-09-07T00:00:00.000Z',
            signedBy: [],
            runExecutionDesignation: 'internal-rehearsal',
            frozenCrystalArtifactId: 'EXP-P1/crystal-vP2',
            frozenCrystalContentHash: 'hash-abc',
            taskSetId: 'EXP-P1/rehearsal-task-set-provisional-v1',
            taskSetProvenance: 'provisional',
            armIds: ['A', 'B', 'C', 'D'],
            providerModel: 'deterministic-retrieval-v1',
            confirmatoryEligible: false,
            taskResults: TASK_RESULTS,
          },
          lifecycleState: 'executed',
          receiptId: 'receipt-1',
        },
      ],
    });
    const run = await getExecutionRun('EXP-P1/execution-run/internal-rehearsal/2026-09-07T00:00:00.000Z');
    expect(run).not.toBeNull();
    expect(run?.taskResults).toEqual(TASK_RESULTS);
    expect(run?.confirmatoryEligible).toBe(false);
    expect(run?.receiptId).toBe('receipt-1');
  });
});
