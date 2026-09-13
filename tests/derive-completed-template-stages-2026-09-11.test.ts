/**
 * deriveCompletedTemplateStages (services/research/experimentLifecycleState.ts,
 * 2026-09-11 — Progressive Surface Pipeline evidence backing, message 3 item
 * 3: "a stage may show completed ONLY from canonical lifecycle/artifact/
 * receipt evidence, never from ordinal position relative to the current
 * stage alone"). Each case asserts a stage is complete ONLY once its OWN
 * gating signal is true — never merely because the phase machine has moved
 * past it ordinally.
 *
 * UPDATED 2026-09-12 (IRL OS Workspace information-architecture correction,
 * operator instruction verbatim: "For current EXP-P1, Concept and Protocol
 * should resolve completed if the persisted evidence supports that"). The
 * function previously derived ONLY Review/Preregistration/Task Construction
 * — Concept, Protocol, Freeze, Run, Adjudication, Interpretation,
 * Publication and Replication were never derivable at all, so an experiment
 * whose crystal had genuinely frozen still showed Concept/Protocol/Freeze as
 * merely "not evidence-backed" on the Pipeline surface. This is a DELIBERATE,
 * operator-authorized widening of what the function derives, not a silent
 * regression of the 2026-09-11 pass's own discipline: every new signal below
 * is still a real, persisted fact (`isFrozen`, `protocolPresent`, the
 * published-run floor lifecycle), never an ordinal-position stand-in, and
 * Review still requires actual observer acceptance — nothing here lets a
 * later stage's completion imply an earlier one that lacks its own evidence.
 */
import { describe, it, expect } from 'vitest';
import { deriveCompletedTemplateStages, type ExperimentLifecycleState } from '@/services/research/experimentLifecycleState';

function baseState(overrides: Partial<ExperimentLifecycleState>): ExperimentLifecycleState {
  return {
    experimentId: 'EXP-P1',
    isFrozen: false,
    artifactId: null,
    contentHash: null,
    commitmentHash: null,
    frozenAt: null,
    protocolReady: false,
    protocolMissing: [],
    protocolPresent: [],
    floorLifecycle: 'designed',
    observerRoundExists: false,
    observerRoundStatus: null,
    observerAcceptance: 'not-applicable',
    phase: 'pre-freeze-review',
    stageLabel: 'Review',
    ...overrides,
  };
}

describe('deriveCompletedTemplateStages', () => {
  it('names nothing complete pre-freeze, with no protocol-freeze-artifact evidence either', () => {
    expect(deriveCompletedTemplateStages(baseState({}))).toEqual([]);
  });

  it('marks Concept/Protocol complete once SOME protocol-freeze-artifact evidence exists, even pre-freeze', () => {
    const state = baseState({ protocolPresent: ['arm-config'] });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Concept', 'Protocol']);
  });

  it('does NOT mark Review complete merely because the crystal is frozen — observer acceptance is the real gate', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'awaiting-observer-assignment',
      stageLabel: 'Review',
      observerAcceptance: 'awaiting-assignment',
    });
    // Concept/Protocol/Freeze ARE evidenced by the freeze itself; Review is not.
    expect(deriveCompletedTemplateStages(state)).toEqual(['Concept', 'Protocol', 'Freeze']);
  });

  it('marks Review complete once observer acceptance is accepted', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'protocol-preparation',
      stageLabel: 'Preregistration',
      observerRoundExists: true,
      observerAcceptance: 'accepted',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Concept', 'Protocol', 'Review', 'Freeze']);
  });

  it('marks Preregistration complete once the protocol-freeze gate is ready, independent of Review', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'ready-for-execution',
      stageLabel: 'Task Construction',
      observerRoundExists: true,
      observerAcceptance: 'accepted',
      protocolReady: true,
      protocolPresent: ['arm-config', 'task-set'],
    });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Concept', 'Protocol', 'Review', 'Preregistration', 'Freeze']);
  });

  it('marks Task Construction complete once the floor lifecycle has moved past designed', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'execution',
      stageLabel: 'Run',
      observerRoundExists: true,
      observerAcceptance: 'accepted',
      protocolReady: true,
      protocolPresent: ['arm-config'],
      floorLifecycle: 'protocol-ratified',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Concept', 'Protocol', 'Review', 'Preregistration', 'Freeze', 'Task Construction']);
  });

  it('marks Run/Adjudication/Interpretation/Publication/Replication complete as the published-run floor lifecycle advances (2026-09-12 fix)', () => {
    const running = baseState({ isFrozen: true, floorLifecycle: 'running' });
    expect(deriveCompletedTemplateStages(running)).toEqual(['Concept', 'Protocol', 'Freeze', 'Task Construction', 'Run']);

    const evaluated = baseState({ isFrozen: true, floorLifecycle: 'evaluated' });
    expect(deriveCompletedTemplateStages(evaluated)).toEqual(['Concept', 'Protocol', 'Freeze', 'Task Construction', 'Run', 'Adjudication']);

    const published = baseState({ isFrozen: true, floorLifecycle: 'published' });
    expect(deriveCompletedTemplateStages(published)).toEqual([
      'Concept', 'Protocol', 'Freeze', 'Task Construction', 'Run', 'Adjudication', 'Interpretation', 'Publication',
    ]);

    const replicated = baseState({ isFrozen: true, floorLifecycle: 'replicated' });
    expect(deriveCompletedTemplateStages(replicated)).toEqual([
      'Concept', 'Protocol', 'Freeze', 'Task Construction', 'Run', 'Adjudication', 'Interpretation', 'Publication', 'Replication',
    ]);
  });

  it('a real EXP-P1-shaped state (frozen, no observer round yet) evidences Concept/Protocol/Freeze but never Review without acceptance', () => {
    // The exact live-production shape: crystal-vP2 frozen, zero
    // observer_review_round rows, zero protocol-freeze artifacts yet.
    // Concept/Protocol/Freeze ARE now evidenced (the crystal genuinely
    // froze); Review correctly stays open until observer acceptance is real
    // — an ordinal-position reading would have wrongly marked it complete
    // too, which this still refuses.
    const state = baseState({
      isFrozen: true,
      artifactId: 'EXP-P1/crystal-vP2',
      phase: 'awaiting-observer-assignment',
      stageLabel: 'Review',
      observerRoundExists: false,
      observerAcceptance: 'awaiting-assignment',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Concept', 'Protocol', 'Freeze']);
  });
});
