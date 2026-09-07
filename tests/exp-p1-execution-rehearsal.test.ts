/**
 * Canary — `services/research/expP1ExecutionRehearsal.ts` (2026-09-07 genuine
 * per-arm execution/evidence-of-use layer).
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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';

const mockLatestFrozenCrystalArtifact = vi.fn();
const mockRecordExecutionRun = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (...args: unknown[]) => mockLatestFrozenCrystalArtifact(...args),
  recordExecutionRun: (...args: unknown[]) => mockRecordExecutionRun(...args),
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

  mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
  mockRecordExecutionRun.mockResolvedValue({ ok: true, receiptId: 'receipt-run-1', artifact: { id: 'EXP-P1/execution-run/internal-rehearsal/x', armIds: ['A', 'B', 'C', 'D'], taskResults: [] } });
  mockSelectTaskScopedInvariants.mockResolvedValue(taskScopedSelectionFixture());
  mockProviderAvailable.mockReturnValue(true);
  mockCallChatWithUsage.mockResolvedValue(chatResult('A generic answer with no citations.'));
});

describe('runExpP1ExecutionRehearsal', () => {
  it('refuses to run if the Arm B selector version has drifted from the frozen constant', async () => {
    mockSelectorVersion = 'task-scoped-v2-drifted';
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/selector version drift/i);
    expect(mockRecordExecutionRun).not.toHaveBeenCalled();
    expect(mockCallChatWithUsage).not.toHaveBeenCalled();
  });

  it('never runs if not eligible (no frozen internal-pilot crystal)', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const result = await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(result.ok).toBe(false);
    expect(mockRecordExecutionRun).not.toHaveBeenCalled();
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
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armA = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'A');
    const armD = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'D');
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

    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armB = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    expect(armB.actuallyGroundedInvariantIds).toEqual(['inv-0']);
    expect(armB.actuallyGroundedInvariantIds).not.toContain('FAKE999');

    const citationDiagnostics = call.armConfiguration.citationDiagnostics as { taskId: string; armId: string; fabricatedCitationCount: number }[];
    const bDiag = citationDiagnostics.find((d) => d.armId === 'B');
    expect(bDiag?.fabricatedCitationCount).toBe(1);
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
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armB = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    const armA = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'A');
    expect(armB.executionOutcome).toBe('error');
    expect(armB.score).toBe(0);
    expect(armB.generatedAnswerText).toBeNull();
    // Arm A's independent call still completed.
    expect(armA.executionOutcome).toBe('completed');
  });

  it('providerAvailable() === false fails every arm the same honest way, without calling the model', async () => {
    mockProviderAvailable.mockReturnValue(false);
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    expect(mockCallChatWithUsage).not.toHaveBeenCalled();
    const call = mockRecordExecutionRun.mock.calls[0][0];
    for (const arm of call.taskResults[0].armResults) {
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
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    expect(call.executionConfiguration.provider).toBe('venice');
    expect(call.executionConfiguration.frozenArmBSelectorVersion).toBe(FROZEN_ARM_B_SELECTOR_VERSION);
    expect(call.executionConfiguration.assertedSelectorVersionAtRunTime).toBe('task-scoped-v1');
    expect(typeof call.executionConfiguration.temperature).toBe('number');
  });

  it('is unconditionally an internal-rehearsal, confirmatoryEligible:false run', async () => {
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    expect(call.runExecutionDesignation).toBe('internal-rehearsal');
    expect(call.confirmatoryEligible).toBe(false);
    expect(call.armDProvenance).toBe('provisional-irl-authored');
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
    await runExpP1ExecutionRehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet: simpleTaskSet });
    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armB = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    expect(armB.actuallyGroundedInvariantIds).toEqual(['inv-1']);
    // groundTruth = ['inv-0'] (only inv-0's statement matches 'risk'); the
    // arm cited inv-1 (offered but not ground truth) — recall of ground truth
    // via ACTUAL citations is therefore 0, not 100% (which selectedInvariantIds
    // recall would have wrongly reported, since inv-0 WAS selected/offered).
    expect(armB.demonstratedUseRecall).toBe(0);
  });
});
