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
 *   8. Arm B is computed ONCE PER TASK via `selectTaskScopedInvariants`,
 *      passing `intentText: task.prompt` — NEVER `task.keywords` — and
 *      `restrictToIds` scoped to the frozen snapshot's member ids (2026-09-07
 *      Arm B selection-fidelity fix; see `taskScopedSelection.ts`).
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

const mockSelectTaskScopedInvariants = vi.fn();
vi.mock('@/services/invariants/taskScopedSelection', () => ({
  selectTaskScopedInvariants: (...args: unknown[]) => mockSelectTaskScopedInvariants(...args),
  TASK_SCOPED_SELECTOR_VERSION: 'task-scoped-v1',
}));

import {
  rehearsalEligibility,
  runExpP1Rehearsal,
  PROVISIONAL_REHEARSAL_TASK_SET,
  LARGER_REHEARSAL_TASK_SET,
  UNSEEN_REHEARSAL_TASK_SET,
} from '@/services/research/expP1Rehearsal';

function taskScopedSelectionFixture(overrides: Record<string, unknown> = {}) {
  return {
    selectorVersion: 'task-scoped-v1',
    intentTokens: [],
    availableIds: [],
    relevantIds: [],
    expandedIds: [],
    selectedIds: [],
    items: [],
    usedRelevanceFallback: false,
    selectionRationale: 'test fixture',
    ...overrides,
  };
}

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
  mockSelectTaskScopedInvariants.mockReset();
  mockRecordExecutionRun.mockResolvedValue({ ok: true, receiptId: 'receipt-run-1', artifact: { id: 'EXP-P1/execution-run/internal-rehearsal/x' } });
  mockSelectTaskScopedInvariants.mockResolvedValue(taskScopedSelectionFixture());
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
    mockSelectTaskScopedInvariants.mockResolvedValue(
      taskScopedSelectionFixture({ availableIds: ['inv-0'], selectedIds: ['inv-0'] }),
    );

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

  it("Arm B passes restrictToIds scoped to the frozen snapshot's own member ids — a live-only id never leaks in (2026-09-07 selection-fidelity fix)", async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    // The selector itself is mocked here — this test proves the HARNESS
    // passes restrictToIds correctly, not the selector's own internal
    // filtering (that is `tests/task-scoped-selection.test.ts`'s job).
    mockSelectTaskScopedInvariants.mockResolvedValue(
      taskScopedSelectionFixture({ availableIds: ['inv-0'], selectedIds: ['inv-0'] }),
    );

    await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1' });
    const restrictArg = mockSelectTaskScopedInvariants.mock.calls[0][0].restrictToIds as string[];
    expect(new Set(restrictArg)).toEqual(new Set(MEMBERS.map((m) => m.id)));
    expect(restrictArg).not.toContain('inv-999-live-only');

    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armB = call.taskResults[0].armResults.find((a: { armId: string }) => a.armId === 'B');
    expect(armB.actuallyGroundedInvariantIds).toBeNull();
  });

  it('Arm B is computed ONCE PER TASK, passing intentText: task.prompt — and NEVER task.keywords (2026-09-07 selection-fidelity fix)', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(frozenArtifact());
    mockSelectTaskScopedInvariants.mockImplementation((input: { intentText: string }) =>
      Promise.resolve(
        // Echo something derived from the intent so different tasks visibly
        // produce different Arm B selections — mirrors the real selector's
        // task-scoped behavior without re-implementing it here.
        taskScopedSelectionFixture({
          availableIds: MEMBERS.map((m) => m.id),
          selectedIds: input.intentText.includes('risk') ? ['inv-0'] : ['inv-1'],
        }),
      ),
    );
    const taskSet = {
      id: 'test-task-set',
      provenance: 'synthetic' as const,
      tasks: [
        { id: 'task-risk', kind: 'recall' as const, prompt: 'What about risk?', keywords: ['risk'] },
        { id: 'task-custody', kind: 'recall' as const, prompt: 'What about custody?', keywords: ['custody'] },
      ],
    };

    await runExpP1Rehearsal({ personaId: 'persona-1', experimentId: 'EXP-P1', taskSet });

    expect(mockSelectTaskScopedInvariants).toHaveBeenCalledTimes(2);
    for (const [arg] of mockSelectTaskScopedInvariants.mock.calls as [Record<string, unknown>][]) {
      expect(arg.intentText).not.toBe(undefined);
      // The answer-key field must never be forwarded — no `keywords` key at all.
      expect('keywords' in arg).toBe(false);
    }
    const intents = mockSelectTaskScopedInvariants.mock.calls.map((c) => (c[0] as { intentText: string }).intentText);
    expect(intents).toEqual(['What about risk?', 'What about custody?']);

    const call = mockRecordExecutionRun.mock.calls[0][0];
    const armBRisk = call.taskResults.find((t: { taskId: string }) => t.taskId === 'task-risk').armResults.find((a: { armId: string }) => a.armId === 'B');
    const armBCustody = call.taskResults.find((t: { taskId: string }) => t.taskId === 'task-custody').armResults.find((a: { armId: string }) => a.armId === 'B');
    // Two materially different tasks produced DIFFERENT Arm B selections —
    // the exact property the old (task-blind, once-per-run) selector could
    // never exhibit.
    expect(armBRisk.selectedInvariantIds).not.toEqual(armBCustody.selectedInvariantIds);
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
    mockSelectTaskScopedInvariants.mockResolvedValue(
      taskScopedSelectionFixture({ availableIds: ['inv-0'], selectedIds: ['inv-0'] }),
    );
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

/**
 * The REAL, frozen `EXP-P1/crystal-vP2` corpus (63 statements, verified
 * verbatim against the live Supabase row on 2026-09-07 — frozen generations
 * are immutable, so this fixture cannot go stale). Used ONLY to verify
 * `LARGER_REHEARSAL_TASK_SET`'s keywords mechanically, BEFORE any rehearsal
 * run, against the exact material it will actually be scored against — the
 * discipline `rehearsal-003`/`rehearsal-005` (in `PROVISIONAL_REHEARSAL_TASK_SET`)
 * skipped, producing two silently-unscorable tasks in the first live run.
 */
const FROZEN_CRYSTAL_VP2_STATEMENTS: string[] = [
  "Financial institutions must have in place effective business continuity plans to ensure their ability to operate in stressful conditions.",
  "Cross-border payments must maintain transparency to ensure regulatory compliance and market integrity.",
  "Financial services must ensure user protection and market integrity.",
  "Financial services must ensure the integrity of markets by implementing comprehensive frameworks that address risks associated with unregulated financial instruments.",
  "Financial services utilizing distributed ledger technology must ensure transparency and accountability in transactions.",
  "Payments involving crypto-assets require compliance with anti-money laundering regulations.",
  "Cross-border transactions necessitate robust data protection measures to safeguard personal information across jurisdictions.",
  "Payment systems must ensure the protection of personal data in compliance with data protection regulations.",
  "Regulatory authorities must conduct regular assessments and monitoring of financial institutions to ensure their compliance with regulatory requirements.",
  "Investment operations require a clear framework for the regulation of crypto-assets to mitigate risks and enhance market integrity.",
  "The development of financial services must align with the principles of fairness and non-discrimination.",
  "Cross-border financial services must ensure transparency and accountability to mitigate risks associated with financial crime.",
  "Market operations must implement robust cybersecurity measures to mitigate risks associated with digital transactions.",
  "Market operations must ensure the protection of personal data in compliance with applicable data protection regulations.",
  "Accountability mechanisms are necessary to ensure compliance and mitigate risks in financial services.",
  "Cross-border financial services require mechanisms to facilitate the free flow of information while maintaining compliance with local regulations.",
  "Payment systems must provide verifiable accountability for all transactions.",
  "Investment operations must maintain transparency and accountability in all transactions to foster trust and compliance.",
  "Investment operations must implement robust cybersecurity measures to protect against threats and vulnerabilities.",
  "All trading operations must comply with applicable anti-money laundering (AML) regulations.",
  "Risk management practices are essential for addressing cybersecurity threats in financial services.",
  "Banks must ensure compliance with anti-money laundering regulations to mitigate financial crime risks.",
  "Financial services in banking must adapt to technological advancements to remain competitive.",
  "Market participants must have access to accurate and timely information to make informed trading decisions.",
  "Banking services must provide clear accountability for financial transactions to maintain market integrity.",
  "Trading activities must ensure transparency to prevent market manipulation.",
  "Investment operations must ensure the integrity and security of client data throughout all processes.",
  "Financial intelligence must facilitate transparency and accountability in transactions to prevent financial crime.",
  "The economic model of digital currencies should support low-cost, high-frequency transactions to enable new business models.",
  "Custodians must adhere to regulatory frameworks that govern the handling and protection of client data.",
  "Financial instruments in the Qripto ecosystem must comply with existing regulatory frameworks to ensure market integrity.",
  "Banks must implement robust cybersecurity measures to protect against financial crime.",
  "Crypto-asset trading platforms must implement measures to protect user assets and data.",
  "Financial institutions are required to protect personal data to uphold the rights of individuals and maintain trust in financial services.",
  "Trading systems must incorporate robust cybersecurity measures to protect against threats.",
  "Custody arrangements must provide clear and transparent reporting to clients regarding the status and management of their assets.",
  "Financial intelligence frameworks must incorporate risk management practices to address cybersecurity threats.",
  "Robust cybersecurity measures are critical to protect against threats and ensure the integrity of financial services.",
  "Financial services require a framework for accountability and compliance.",
  "Financial services must adapt to technological advancements.",
  "Financial institutions must maintain robust risk management and governance arrangements to ensure their stability and soundness.",
  "All market operations must ensure transparency and accountability to prevent market abuse and financial crime.",
  "The use of innovative technologies in financial services must prioritize consumer protection and data privacy.",
  "Financial services must ensure transparency and accountability in the use of emerging technologies to foster trust and compliance.",
  "A harmonized regulatory framework is essential for ensuring market integrity and consumer protection.",
  "All economic interactions involving QriptoCENT must prioritize user security and risk management protocols.",
  "Market operations involving crypto-assets require a harmonized regulatory framework to ensure user confidence and market integrity.",
  "Accountability mechanisms are necessary to uphold integrity in financial transactions.",
  "Risk management is a fundamental component of financial services.",
  "Custodians are required to implement robust security measures to protect client assets from unauthorized access and cyber threats.",
  "Agentic commerce requires real-time, micro-level transaction capabilities.",
  "Crypto-assets must be governed by a harmonized regulatory framework to ensure market integrity and consumer protection.",
  "Custody services must ensure compliance with anti-money laundering (AML) and counter-terrorism financing (CTF) regulations.",
  "Financial intelligence activities must ensure the protection of personal data in compliance with applicable regulations.",
  "Financial intelligence operations must support innovation while ensuring compliance with regulatory standards.",
  "Financial institutions must ensure the protection of personal data in all banking operations.",
  "Entities providing services related to crypto-assets must implement robust cybersecurity measures to mitigate risks.",
  "Financial services must establish clear governance structures to manage risks associated with the use of artificial intelligence.",
  "Innovative payment methods must be supported by a harmonized regulatory framework to foster market confidence.",
  "Transparency and accountability are essential for fostering trust in financial transactions.",
  "Custody services must ensure the segregation of client assets from the custodian's own assets.",
  "Financial services must implement robust cybersecurity measures to safeguard against threats and vulnerabilities that could compromise market integrity.",
  "Data protection is fundamental to maintaining trust and compliance in financial services.",
];

describe('LARGER_REHEARSAL_TASK_SET (2026-09-07, prepared after the actuallyGroundedInvariantIds audit repair)', () => {
  it('is roughly 12-18 tasks, balanced between recall and derivation', () => {
    expect(LARGER_REHEARSAL_TASK_SET.tasks.length).toBeGreaterThanOrEqual(12);
    expect(LARGER_REHEARSAL_TASK_SET.tasks.length).toBeLessThanOrEqual(18);
    const recall = LARGER_REHEARSAL_TASK_SET.tasks.filter((t) => t.kind === 'recall');
    const derivation = LARGER_REHEARSAL_TASK_SET.tasks.filter((t) => t.kind === 'derivation');
    expect(recall.length).toBeGreaterThan(0);
    expect(derivation.length).toBeGreaterThan(0);
    // "Balanced" — neither kind is more than 2x the other.
    expect(recall.length).toBeLessThanOrEqual(derivation.length * 2);
    expect(derivation.length).toBeLessThanOrEqual(recall.length * 2);
  });

  it('never mixes in an external-held-out or synthetic provenance — provisional only, like the v1 set', () => {
    expect(LARGER_REHEARSAL_TASK_SET.provenance).toBe('provisional');
  });

  it("EVERY keyword on EVERY task has at least one real hit against the frozen crystal-vP2 corpus — the exact discipline rehearsal-003/rehearsal-005 skipped, mechanically enforced so this task set can never silently produce an unscorable task", () => {
    for (const task of LARGER_REHEARSAL_TASK_SET.tasks) {
      for (const keyword of task.keywords) {
        const hits = FROZEN_CRYSTAL_VP2_STATEMENTS.filter((s) => s.toLowerCase().includes(keyword.toLowerCase()));
        expect(hits.length, `task '${task.id}' keyword '${keyword}' must hit the frozen corpus at least once`).toBeGreaterThan(0);
      }
      // The union (what the harness actually uses as groundTruthInvariantIds)
      // is therefore also always non-empty — no task in this set can ever be
      // marked unscorable against the frozen substrate it targets.
      const union = FROZEN_CRYSTAL_VP2_STATEMENTS.filter((s) => task.keywords.some((k) => s.toLowerCase().includes(k.toLowerCase())));
      expect(union.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate task ids and no duplicate id with the v1 set (both may be persisted side by side)', () => {
    const ids = LARGER_REHEARSAL_TASK_SET.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const v1Ids = new Set(PROVISIONAL_REHEARSAL_TASK_SET.tasks.map((t) => t.id));
    for (const id of ids) expect(v1Ids.has(id)).toBe(false);
  });
});

describe('UNSEEN_REHEARSAL_TASK_SET (2026-09-07, the unseen v3 set for evaluating the corrected task-scoped Arm B selector)', () => {
  it('is roughly 12-18 tasks, balanced between recall and derivation', () => {
    expect(UNSEEN_REHEARSAL_TASK_SET.tasks.length).toBeGreaterThanOrEqual(12);
    expect(UNSEEN_REHEARSAL_TASK_SET.tasks.length).toBeLessThanOrEqual(18);
    const recall = UNSEEN_REHEARSAL_TASK_SET.tasks.filter((t) => t.kind === 'recall');
    const derivation = UNSEEN_REHEARSAL_TASK_SET.tasks.filter((t) => t.kind === 'derivation');
    expect(recall.length).toBeGreaterThan(0);
    expect(derivation.length).toBeGreaterThan(0);
    expect(recall.length).toBeLessThanOrEqual(derivation.length * 2);
    expect(derivation.length).toBeLessThanOrEqual(recall.length * 2);
  });

  it('is provisional, never external-held-out or synthetic', () => {
    expect(UNSEEN_REHEARSAL_TASK_SET.provenance).toBe('provisional');
  });

  it('EVERY keyword on EVERY task has at least one real hit against the frozen crystal-vP2 corpus', () => {
    for (const task of UNSEEN_REHEARSAL_TASK_SET.tasks) {
      for (const keyword of task.keywords) {
        const hits = FROZEN_CRYSTAL_VP2_STATEMENTS.filter((s) => s.toLowerCase().includes(keyword.toLowerCase()));
        expect(hits.length, `task '${task.id}' keyword '${keyword}' must hit the frozen corpus at least once`).toBeGreaterThan(0);
      }
      const union = FROZEN_CRYSTAL_VP2_STATEMENTS.filter((s) => task.keywords.some((k) => s.toLowerCase().includes(k.toLowerCase())));
      expect(union.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate task ids, and no keyword string reused from v1 or v2 — genuinely unseen thematic ground', () => {
    const ids = UNSEEN_REHEARSAL_TASK_SET.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const v1Ids = new Set(PROVISIONAL_REHEARSAL_TASK_SET.tasks.map((t) => t.id));
    const v2Ids = new Set(LARGER_REHEARSAL_TASK_SET.tasks.map((t) => t.id));
    for (const id of ids) {
      expect(v1Ids.has(id)).toBe(false);
      expect(v2Ids.has(id)).toBe(false);
    }

    const priorKeywords = new Set(
      [...PROVISIONAL_REHEARSAL_TASK_SET.tasks, ...LARGER_REHEARSAL_TASK_SET.tasks].flatMap((t) => t.keywords.map((k) => k.toLowerCase())),
    );
    for (const task of UNSEEN_REHEARSAL_TASK_SET.tasks) {
      for (const keyword of task.keywords) {
        expect(priorKeywords.has(keyword.toLowerCase()), `'${keyword}' must not reuse a v1/v2 keyword string`).toBe(false);
      }
    }
  });
});
