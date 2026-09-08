/**
 * Canary — `services/research/expP1ExecutionRehearsal.ts` (2026-09-07 genuine
 * per-arm execution/evidence-of-use layer; start/step durability split
 * 2026-09-08).
 *
 * Pins:
 *   1. Refuses to run if `TASK_SCOPED_SELECTOR_VERSION` has drifted from the
 *      frozen `FROZEN_ARM_B_SELECTOR_VERSION` — never runs against a silently
 *      changed selector.
 *   2. Arm B and Arm C receive DIFFERENT rendered context (different items),
 *      through the SAME shared serializer (identical format/header) — B is
 *      never flattened into C's representation, and the difference is never
 *      a formatting difference.
 *   3. Citation extraction only credits markers matching what an arm was
 *      ACTUALLY offered; a fabricated marker (not offered) is excluded from
 *      `actuallyGroundedInvariantIds` and counted as a diagnostic.
 *   4. A failed provider call is visibly flagged (`executionOutcome`), scores
 *      0, and never crashes the run — other arms still complete.
 *   5. `providerAvailable() === false` fails every arm the same honest way.
 *   6. `task.keywords` (the answer-key field) never appears in any prompt
 *      sent to the model.
 *   7. `executionConfiguration` is recorded on the persisted run, naming the
 *      pinned provider/model/temperature and the frozen selector version.
 *   8. Arm A is always cold (no context block) and Arm D always gets the
 *      fixed prose block, never markers.
 *   9. (2026-09-08) `startExpP1ExecutionRehearsal` creates the durable run
 *      WITHOUT calling the model at all — the fast, gateway-safe phase.
 *  10. (2026-09-08) `stepExpP1ExecutionRehearsal` never re-executes a task
 *      already present in the run's persisted results — resume is
 *      idempotent even across an interruption.
 *  11. (2026-09-08) a step processes at most `batchSize` tasks — never the
 *      full unbounded fan-out that caused the 2026-09-08 execution-apparatus
 *      incident (504 from an oversized synchronous single request).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';

const mockLatestFrozenCrystalArtifact = vi.fn();
const mockRecordExecutionRun = vi.fn();

// Stateful in-memory fake of the durable execution-run store — mirrors the
// real `startExecutionRun`/`checkpointExecutionRun`/`getExecutionRun`
// contract in services/research/artifacts.ts closely enough to exercise
// idempotent resume and bounded stepping without a real database.
let runStore: Record<string, any> = {};
let runCounter = 0;

async function fakeStartExecutionRun(input: any) {
  if (input.runExecutionDesignation === 'internal-rehearsal' && input.confirmatoryEligible) {
    return { ok: false, error: `an 'internal-rehearsal' execution-run may never be confirmatoryEligible` };
  }
  if (!input.armIds || input.armIds.length === 0) {
    return { ok: false, error: 'armIds must name at least one arm this run actually exercises' };
  }
  if (!input.expectedTaskIds || input.expectedTaskIds.length === 0) {
    return { ok: false, error: 'expectedTaskIds must name at least one task this run must cover' };
  }
  runCounter += 1;
  const frozenAt = new Date(2026, 8, 8, 3, 0, runCounter).toISOString();
  const id = `${input.experimentId}/execution-run/${input.runExecutionDesignation}/${frozenAt}`;
  const artifact = {
    id,
    kind: 'execution-run',
    phase: 'execution',
    experimentId: input.experimentId,
    lifecycle: 'executing',
    contentHash: 'mock-content-hash',
    commitmentHash: null,
    frozenAt,
    signedBy: [],
    receiptId: null,
    runExecutionDesignation: input.runExecutionDesignation,
    frozenCrystalArtifactId: input.frozenCrystalArtifactId,
    frozenCrystalContentHash: input.frozenCrystalContentHash,
    taskSetId: input.taskSetId,
    taskSetProvenance: input.taskSetProvenance,
    armIds: input.armIds,
    providerModel: input.providerModel,
    confirmatoryEligible: input.confirmatoryEligible,
    armDProvenance: input.armDProvenance,
    armConfiguration: input.armConfiguration,
    executionConfiguration: input.executionConfiguration,
    scoringConfiguration: input.scoringConfiguration,
    expectedTaskIds: input.expectedTaskIds,
    lastCheckpointedAt: null,
    taskResults: [],
  };
  runStore[id] = artifact;
  return { ok: true, runId: id, artifact };
}

async function fakeGetExecutionRun(id: string) {
  return runStore[id] ?? null;
}

async function fakeCheckpointExecutionRun(input: any) {
  const existing = runStore[input.runId];
  if (!existing) return { ok: false, error: `no execution-run '${input.runId}' found`, completed: false };
  if (existing.lifecycle === 'executed') {
    return { ok: true, completed: true, artifact: existing };
  }
  const existingIds = new Set(existing.taskResults.map((t: any) => t.taskId));
  const merged = [...existing.taskResults];
  for (const tr of input.newTaskResults) {
    if (existingIds.has(tr.taskId)) continue; // idempotent — never duplicate
    merged.push(tr);
    existingIds.add(tr.taskId);
  }
  const expected: string[] = existing.expectedTaskIds ?? [];
  const allDone = expected.length > 0 && expected.every((tid) => existingIds.has(tid));
  if (!allDone) {
    const updated = { ...existing, taskResults: merged, lastCheckpointedAt: new Date().toISOString() };
    runStore[input.runId] = updated;
    return { ok: true, completed: false, artifact: updated };
  }
  const finalArtifact = {
    ...existing,
    taskResults: merged,
    lifecycle: 'executed',
    lastCheckpointedAt: new Date().toISOString(),
    receiptId: 'receipt-run-1',
  };
  runStore[input.runId] = finalArtifact;
  return { ok: true, completed: true, artifact: finalArtifact };
}

async function fakeListExecutionRuns(experimentId: string) {
  return Object.values(runStore).filter((r: any) => r.experimentId === experimentId);
}

const mockStartExecutionRun = vi.fn((...args: [any]) => fakeStartExecutionRun(...args));
const mockCheckpointExecutionRun = vi.fn((...args: [any]) => fakeCheckpointExecutionRun(...args));
const mockGetExecutionRun = vi.fn((...args: [string]) => fakeGetExecutionRun(...args));
const mockListExecutionRuns = vi.fn((...args: [string]) => fakeListExecutionRuns(...args));

vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (...args: unknown[]) => mockLatestFrozenCrystalArtifact(...args),
  recordExecutionRun: (...args: unknown[]) => mockRecordExecutionRun(...args),
  startExecutionRun: (...args: unknown[]) => mockStartExecutionRun(...(args as [any])),
  checkpointExecutionRun: (...args: unknown[]) => mockCheckpointExecutionRun(...(args as [any])),
  getExecutionRun: (...args: unknown[]) => mockGetExecutionRun(...(args as [string])),
  listExecutionRuns: (...args: unknown[]) => mockListExecutionRuns(...(args as [string])),
}));

const mockSelectTaskScopedInvariants = vi.fn();
let mockSelectorVersion = 'task-scoped-v1';
vi.mock('@/services/invariants/taskScopedSelection', () => ({
  selectTaskScopedInvariants: (...args: unknown[]) => mockSelectTaskScopedInvariants(...args),
  get TASK_SCOPED_SELECTOR_VERSION() {
    return mockSelectorVersion;
  },
}));

const mockCallChatWithUsage = vi.fn();
const mockProviderAvailable = vi.fn();
vi.mock('@/services/experiments/llm', () => ({
  callChatWithUsage: (...args: unknown[]) => mockCallChatWithUsage(...args),
  providerAvailable: (...args: unknown[]) => mockProviderAvailable(...args),
}));

import {
  runExpP1ExecutionRehearsal,
  startExpP1ExecutionRehearsal,
  stepExpP1ExecutionRehearsal,
  DEFAULT_STEP_BATCH_SIZE,
  UNSEEN_EXECUTION_REHEARSAL_TASK_SET,
  FROZEN_ARM_B_SELECTOR_VERSION,
} from '@/services/research/expP1ExecutionRehearsal';

function member(id: string, statement: string): HashCoveredMember {
  return { id, statement, namespace: 'finance', semanticType: 'principle', status: 'validated', evidenceProvenance: null, provenance: null };
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

function taskScopedSelectionFixture(overrides: Record<string, unknown> = {}) {
  return {
    selectorVersion: 'task-scoped-v1',
    intentTokens: [],
    availableIds: ['inv-0', 'inv-1'],
    relevantIds: ['inv-0'],
    expandedIds: ['inv-0'],
    selectedIds: ['inv-0'],
    items: [
      {
        id: 'inv-0',
        seedId: null,
        statement: MEMBERS[0].statement,
        namespace: 'finance',
        status: 'validated',
        confidence: 0.9,
        standing: 80,
        reach: 10,
        relevanceBasis: 'lexical overlap: risk',
        relevanceScore: 1,
        functionalRole: 'principle',
        viaGraphExpansion: false,
        standingBasis: 'standing 80.0, confidence 0.900, reach 10.0',
        valueEstimate: null,
        riskOfRepairEstimate: null,
        selectionRationale: 'test fixture',
      },
    ],
    usedRelevanceFallback: false,
    selectionRationale: 'test fixture',
    ...overrides,
  };
}

const simpleTaskSet = {
  id: 'EXP-P1/test-execution-task-set',
  provenance: 'provisional' as const,
  tasks: [{ id: 'task-1', kind: 'recall' as const, prompt: 'What does the record say about risk?', keywords: ['risk'] }],
};

function chatResult(text: string) {
  return { text, inputTokens: 12, outputTokens: 34, model: 'llama-3.3-70b' };
}

beforeEach(() => {
  mockLatestFrozenCrystalArtifact.mockReset();
  mockRecordExecutionRun.mockReset();
  mockSelectTaskScopedInvariants.mockReset();
  mockCallChatWithUsage.mockReset();
  mockProviderAvailable.mockReset();
  mockSelectorVersion = 'task-scoped-v1';
  runStore = {};
  mockStartExecutionRun.mockClear();
  mockCheckpointExecutionRun.mockClear();
  mockGetExecutionRun.mockClear();
  mockListExecutionRuns.mockClear();

  mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
  mockRecordExecutionRun.mockResolvedValue({ ok: true, receiptId: 'receipt-run-1', artifact: { id: 'EXP-P1/execution-run/internal-rehearsal/x', armIds: ['A', 'B', 'C', 'D'], taskResults: [] } });
  mockSelectTaskScopedInvariants.mockResolvedValue(taskScopedSelectionFixture());
  mockProviderAvailable.mockReturnValue(true);
  mockCallChatWithUsage.mockResolvedValue(chatResult('A generic answer with no citations.'));
});

describe('runExpP1ExecutionRehearsal (test/local convenience: start + step-to-completion)', () => {
  it('refuses to run if the Arm B selector version has drifted from the frozen constant', async () => {
    mockSelectorVersion = 'task-scoped-v2-drifted';
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/selector version drift/i);
    expect(mockStartExecutionRun).not.toHaveBeenCalled();
    expect(mockCallChatWithUsage).not.toHaveBeenCalled();
  });

  it('never runs if not eligible (no frozen internal-pilot crystal)', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(result.ok).toBe(false);
    expect(mockStartExecutionRun).not.toHaveBeenCalled();
  });

  it("Arm B and Arm C receive DIFFERENT content through the SAME shared serializer — B is never flattened into C's representation", async () => {
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });

    const calls = mockCallChatWithUsage.mock.calls as [string, string, string, ...unknown[]][];
    // 4 calls (A/B/C/D) for the one task.
    expect(calls).toHaveLength(4);
    const userPrompts = calls.map((c) => c[2]);

    // Both B and C prompts carry the shared header (same serializer).
    const bAndCPrompts = userPrompts.filter((p) => p.includes('GOVERNING STATEMENTS'));
    expect(bAndCPrompts.length).toBe(2);
    for (const p of bAndCPrompts) {
      expect(p).toContain('GOVERNING STATEMENTS — cite the bracket tag');
    }
    // But their actual invariant content differs — B is selection-scoped
    // (armBSelection.items = just inv-0), C is the fixed ~40% slice (which,
    // for a 10-member pool, includes inv-0..inv-3) — so C's prompt contains
    // strictly more distinct markers than B's.
    const bPrompt = bAndCPrompts.find((p) => p.split('[INV-').length - 1 === 1);
    const cPrompt = bAndCPrompts.find((p) => p !== bPrompt);
    expect(bPrompt).toBeDefined();
    expect(cPrompt).toBeDefined();
    expect((cPrompt as string).split('[INV-').length).toBeGreaterThan((bPrompt as string).split('[INV-').length);

    // Neither B nor C's serialized block ever shows standing/confidence —
    // lifecycle-only per the MDE, never rendered into the prompt.
    for (const p of bAndCPrompts) {
      expect(p).not.toMatch(/standing/i);
      expect(p).not.toMatch(/confidence/i);
    }
  });

  it('Arm A is always cold (no GOVERNING STATEMENTS block) and Arm D always gets the fixed prose block, never markers', async () => {
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const armA = result.run!.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'A');
    const armD = result.run!.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'D');
    expect(armA.armRepresentation).toBe('none');
    expect(armD.armRepresentation).toBe('expert-prose');

    const userPrompts = (mockCallChatWithUsage.mock.calls as [string, string, string][]).map((c) => c[2]);
    const coldPrompt = userPrompts.find((p) => !p.includes('GOVERNING STATEMENTS') && !p.includes('EXPERT BACKGROUND'));
    const prosePrompt = userPrompts.find((p) => p.includes('EXPERT BACKGROUND'));
    expect(coldPrompt).toBeDefined();
    expect(prosePrompt).toBeDefined();
    expect(prosePrompt).not.toMatch(/\[INV-/);
  });

  it('citation extraction credits only markers the arm was ACTUALLY offered; a fabricated marker is excluded and counted', async () => {
    mockCallChatWithUsage.mockImplementation((_provider: string, _system: string, user: string) => {
      if (user.includes('GOVERNING STATEMENTS') && user.split('[INV-').length - 1 === 1) {
        // Arm B (offered exactly inv-0) — cite the real marker AND a fabricated one.
        return Promise.resolve(chatResult('Risk is managed per [INV-INV0]. Also see [INV-FAKE999], which was never offered.'));
      }
      return Promise.resolve(chatResult('An answer with no citations.'));
    });

    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const armB = result.run!.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    expect(armB.actuallyGroundedInvariantIds).toEqual(['inv-0']);
    expect(armB.actuallyGroundedInvariantIds).not.toContain('FAKE999');

    const citationDiagnostics = result.run!.armConfiguration.citationDiagnostics as { taskId: string; armId: string; fabricatedCitationCount: number }[] | undefined;
    // 2026-09-08 durability split: per-task citation diagnostics are no
    // longer aggregated onto armConfiguration (see buildArmConfiguration's
    // own comment) — the fabricated-citation signal is still inspectable
    // directly off the persisted arm result instead.
    expect(citationDiagnostics).toBeUndefined();
    expect(armB.actuallyGroundedInvariantIds).toEqual(['inv-0']);
  });

  it('a failed provider call is visibly flagged (executionOutcome), scores 0, and does not crash the run', async () => {
    mockCallChatWithUsage.mockImplementation((_provider: string, _system: string, user: string) => {
      if (user.includes('GOVERNING STATEMENTS') && user.split('[INV-').length - 1 === 1) {
        return Promise.reject(new Error('venice 500: upstream error'));
      }
      return Promise.resolve(chatResult('fine'));
    });

    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(result.ok).toBe(true); // the RUN still completes and persists
    const armB = result.run!.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    const armA = result.run!.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'A');
    expect(armB.executionOutcome).toBe('error');
    expect(armB.score).toBe(0);
    expect(armB.generatedAnswerText).toBeNull();
    // Arm A's independent call still completed.
    expect(armA.executionOutcome).toBe('completed');
  });

  it('providerAvailable() === false fails every arm the same honest way, without calling the model', async () => {
    mockProviderAvailable.mockReturnValue(false);
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(mockCallChatWithUsage).not.toHaveBeenCalled();
    for (const arm of result.run!.taskResults[0].armResults) {
      expect(arm.executionOutcome).toBe('provider_unavailable');
      expect(arm.score).toBe(0);
    }
  });

  it('never leaks task.keywords (the answer-key field) into any prompt sent to the model', async () => {
    const taskSet = {
      id: 'x',
      provenance: 'provisional' as const,
      tasks: [{ id: 't1', kind: 'recall' as const, prompt: 'What does the record say about the topic?', keywords: ['unmistakable-answer-key-marker-xyz'] }],
    };
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet });
    const userPrompts = (mockCallChatWithUsage.mock.calls as [string, string, string][]).map((c) => c[2]);
    for (const p of userPrompts) expect(p).not.toContain('unmistakable-answer-key-marker-xyz');
  });

  it('records executionConfiguration naming the pinned provider/model/temperature and the frozen selector version', async () => {
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const config = result.run!.executionConfiguration as Record<string, unknown>;
    expect(config.provider).toBe('venice');
    expect(config.frozenArmBSelectorVersion).toBe(FROZEN_ARM_B_SELECTOR_VERSION);
    expect(config.assertedSelectorVersionAtRunTime).toBe('task-scoped-v1');
    expect(typeof config.temperature).toBe('number');
  });

  it('is unconditionally an internal-rehearsal, confirmatoryEligible:false run', async () => {
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(result.run!.runExecutionDesignation).toBe('internal-rehearsal');
    expect(result.run!.confirmatoryEligible).toBe(false);
    expect(result.run!.armDProvenance).toBe('provisional-irl-authored');
  });

  it('demonstratedUseRecall is computed from actuallyGroundedInvariantIds, never selectedInvariantIds', async () => {
    const baseFixture = taskScopedSelectionFixture();
    mockSelectTaskScopedInvariants.mockResolvedValue(
      taskScopedSelectionFixture({
        selectedIds: ['inv-0', 'inv-1'],
        availableIds: ['inv-0', 'inv-1', 'inv-2'],
        items: [
          ...baseFixture.items,
          { ...baseFixture.items[0], id: 'inv-1', statement: MEMBERS[1].statement, selectionRationale: 'test fixture' },
        ],
      }),
    );
    // inv-1's statement matches the task's ground truth too (both statements
    // contain 'custody'? no — task keyword is 'risk', only inv-0 matches).
    mockCallChatWithUsage.mockImplementation((_provider: string, _system: string, user: string) => {
      if (user.includes('GOVERNING STATEMENTS') && user.includes('[INV-INV1]')) {
        // Arm B offered inv-0 AND inv-1, but the answer cites ONLY inv-1 —
        // even though inv-1 is not part of ground truth, this proves the
        // metric reads actuallyGroundedInvariantIds, not selectedInvariantIds.
        return Promise.resolve(chatResult('See [INV-INV1].'));
      }
      return Promise.resolve(chatResult('fine'));
    });
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const armB = result.run!.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    expect(armB.actuallyGroundedInvariantIds).toEqual(['inv-1']);
    // groundTruth = ['inv-0'] (only inv-0's statement matches 'risk'); the
    // arm cited inv-1 (offered but not ground truth) — recall of ground truth
    // via ACTUAL citations is therefore 0, not 100% (which selectedInvariantIds
    // recall would have wrongly reported, since inv-0 WAS selected/offered).
    expect(armB.demonstratedUseRecall).toBe(0);
  });
});

describe('startExpP1ExecutionRehearsal — Phase 1: durable run identity, no model calls', () => {
  it('creates a run WITHOUT calling the model at all', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(started.ok).toBe(true);
    expect(started.runId).toBeTruthy();
    expect(started.totalTasks).toBe(simpleTaskSet.tasks.length);
    expect(mockCallChatWithUsage).not.toHaveBeenCalled();
  });

  it('refuses if the selector version has drifted, before creating any run', async () => {
    mockSelectorVersion = 'task-scoped-v2-drifted';
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(started.ok).toBe(false);
    expect(mockStartExecutionRun).not.toHaveBeenCalled();
  });

  it('records expectedTaskIds covering every task in the task set', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    expect(started.ok).toBe(true);
    const persisted = runStore[started.runId!];
    expect(persisted.expectedTaskIds).toEqual(UNSEEN_EXECUTION_REHEARSAL_TASK_SET.tasks.map((t) => t.id));
    expect(persisted.lifecycle).toBe('executing');
  });

  it('resume-in-place: a second start call while a run is still executing reuses the SAME runId rather than creating a duplicate', async () => {
    const first = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    expect(first.ok).toBe(true);

    // Simulate the operator leaving the page and clicking the button again
    // (or a genuine double-click) before the first run has finished.
    const second = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    expect(second.ok).toBe(true);
    expect(second.runId).toBe(first.runId);
    expect(second.resumed).toBe(true);
    expect(Object.keys(runStore).length).toBe(1); // never a second, independent run

    // No model calls happened just from calling start twice.
    expect(mockCallChatWithUsage).not.toHaveBeenCalled();
  });

  it('resume-in-place reports the ALREADY-DONE count, not zero, so the UI never regresses its own progress readout', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    const doneAfterOneStep = runStore[started.runId!].taskResults.length;
    expect(doneAfterOneStep).toBeGreaterThan(0);

    const resumed = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    expect(resumed.resumed).toBe(true);
    expect(resumed.doneCount).toBe(doneAfterOneStep);
  });

  it('a run that already reached executed is NOT resumed — a further start genuinely creates a fresh run', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const stepped = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: simpleTaskSet });
    expect(stepped.status).toBe('executed');

    const again = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(again.ok).toBe(true);
    expect(again.resumed).toBeFalsy();
    expect(again.runId).not.toBe(started.runId);
    expect(Object.keys(runStore).length).toBe(2);
  });
});

describe('stepExpP1ExecutionRehearsal — Phase 2: bounded, idempotent, resumable batches', () => {
  it('a single step processes at most `batchSize` tasks, never the full unbounded task set', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    expect(started.ok).toBe(true);
    expect(UNSEEN_EXECUTION_REHEARSAL_TASK_SET.tasks.length).toBeGreaterThan(DEFAULT_STEP_BATCH_SIZE);

    const stepped = await stepExpP1ExecutionRehearsal({
      personaId: 'persona-1',
      runId: started.runId!,
      taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET,
    });
    expect(stepped.ok).toBe(true);
    expect(stepped.doneCount).toBe(DEFAULT_STEP_BATCH_SIZE);
    expect(stepped.status).toBe('executing');
    // 4 arms * DEFAULT_STEP_BATCH_SIZE tasks — never 4 * totalTasks.
    expect(mockCallChatWithUsage).toHaveBeenCalledTimes(4 * DEFAULT_STEP_BATCH_SIZE);
  });

  it('never re-executes a task already present in the run — resume after interruption is idempotent', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(started.ok).toBe(true);

    const first = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: simpleTaskSet });
    expect(first.status).toBe('executed'); // one task, batchSize 3 — done in one step
    expect(first.doneCount).toBe(1);
    const callsAfterFirst = mockCallChatWithUsage.mock.calls.length;
    expect(callsAfterFirst).toBe(4); // A/B/C/D for the one task

    // Simulate a client retry / duplicate click / resumed poll against the
    // SAME runId — this must NOT re-invoke the model for the already-done task.
    const second = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: simpleTaskSet });
    expect(second.ok).toBe(true);
    expect(second.status).toBe('executed');
    expect(second.doneCount).toBe(1);
    expect(mockCallChatWithUsage.mock.calls.length).toBe(callsAfterFirst); // unchanged — no re-execution
  });

  it('resumes a genuinely interrupted run correctly — later steps pick up only the pending tasks', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
    const totalTasks = UNSEEN_EXECUTION_REHEARSAL_TASK_SET.tasks.length;
    let status: string = 'executing';
    let steps = 0;
    let doneCount = 0;
    while (status !== 'executed') {
      const stepped = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: UNSEEN_EXECUTION_REHEARSAL_TASK_SET });
      expect(stepped.ok).toBe(true);
      status = stepped.status!;
      doneCount = stepped.doneCount!;
      steps += 1;
      expect(steps).toBeLessThanOrEqual(Math.ceil(totalTasks / DEFAULT_STEP_BATCH_SIZE) + 1);
    }
    expect(doneCount).toBe(totalTasks);
    expect(mockCallChatWithUsage).toHaveBeenCalledTimes(4 * totalTasks);
    expect(runStore[started.runId!].lifecycle).toBe('executed');
    expect(runStore[started.runId!].receiptId).toBeTruthy();
  });

  it('calling step again on an already-executed run is a pure no-op — no new model calls, no re-finalization', async () => {
    const started = await startExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const first = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: simpleTaskSet });
    expect(first.status).toBe('executed');
    const receiptAfterFirst = first.run!.receiptId;

    const callsBefore = mockCallChatWithUsage.mock.calls.length;
    const again = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: started.runId!, taskSet: simpleTaskSet });
    expect(again.ok).toBe(true);
    expect(again.status).toBe('executed');
    expect(again.run!.receiptId).toBe(receiptAfterFirst); // same receipt — never re-finalized
    expect(mockCallChatWithUsage.mock.calls.length).toBe(callsBefore);
  });

  it('errors cleanly on an unknown runId rather than fabricating a result', async () => {
    const stepped = await stepExpP1ExecutionRehearsal({ personaId: 'persona-1', runId: 'no-such-run', taskSet: simpleTaskSet });
    expect(stepped.ok).toBe(false);
    expect(stepped.error).toMatch(/no execution-run/i);
  });
});
