/**
 * deriveCompletedTemplateStages (services/research/experimentLifecycleState.ts,
 * 2026-09-11 — Progressive Surface Pipeline evidence backing, message 3 item
 * 3: "a stage may show completed ONLY from canonical lifecycle/artifact/
 * receipt evidence, never from ordinal position relative to the current
 * stage alone"). Each case asserts a stage is complete ONLY once its OWN
 * gating signal is true — never merely because the phase machine has moved
 * past it ordinally.
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
  it('names nothing complete pre-freeze', () => {
    expect(deriveCompletedTemplateStages(baseState({}))).toEqual([]);
  });

  it('does NOT mark Review complete merely because the crystal is frozen — observer acceptance is the real gate', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'awaiting-observer-assignment',
      stageLabel: 'Review',
      observerAcceptance: 'awaiting-assignment',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual([]);
  });

  it('marks Review complete once observer acceptance is accepted', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'protocol-preparation',
      stageLabel: 'Preregistration',
      observerRoundExists: true,
      observerAcceptance: 'accepted',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Review']);
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
    expect(deriveCompletedTemplateStages(state)).toEqual(['Review', 'Preregistration']);
  });

  it('marks Task Construction complete once the floor lifecycle has moved past designed', () => {
    const state = baseState({
      isFrozen: true,
      phase: 'execution',
      stageLabel: 'Run',
      observerRoundExists: true,
      observerAcceptance: 'accepted',
      protocolReady: true,
      floorLifecycle: 'executed',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual(['Review', 'Preregistration', 'Task Construction']);
  });

  it('a real EXP-P1-shaped state (frozen, no observer round yet) evidences nothing complete — the regression this closes', () => {
    // The exact live-production shape at the time of the 2026-09-11 pass:
    // crystal-vP2 frozen, zero observer_review_round rows, zero protocol
    // artifacts. An ordinal-position reading would wrongly mark 'Review'
    // complete because the phase is past 'pre-freeze-review'; the evidence
    // reading correctly holds it open until observer acceptance is real.
    const state = baseState({
      isFrozen: true,
      artifactId: 'EXP-P1/crystal-vP2',
      phase: 'awaiting-observer-assignment',
      stageLabel: 'Review',
      observerRoundExists: false,
      observerAcceptance: 'awaiting-assignment',
    });
    expect(deriveCompletedTemplateStages(state)).toEqual([]);
  });
});
