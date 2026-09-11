/**
 * resolveJourneyState — XP-1 Experience Control Plane convergence additions
 * (AEE-XP-001 §6, 2026-09-01): real `dependenciesMet` (was a stub always
 * returning true), and `computeJourneyReachability` — the DAG-correct,
 * branch-aware "what's reachable next" signal AEE reads. Pure function
 * tests, mirroring this repo's existing resolveJourneyState test style
 * (hand-built AuthoritativePlatformState fixtures, no I/O).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveJourneyState,
  computeJourneyReachability,
  type AuthoritativePlatformState,
} from '@/services/journey/resolveJourneyState';
import type { JourneyDefinition } from '@/types/journey';

const FIXTURE_JOURNEY: JourneyDefinition = {
  id: 'reachability-fixture',
  version: '1.0.0',
  label: 'Reachability Fixture',
  subjectRef: 'visitor',
  copilot: { cartridgeSlug: 'agentiq-os' },
  stages: [
    {
      id: 'ambient',
      label: 'Ambient',
      description: 'Always-open, no activationBranch.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      companion: { before: '', complete: '' },
    },
    {
      id: 'a',
      label: 'A',
      description: '',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: ['aDone'],
      receiptTypes: [],
      companion: { before: '', complete: '' },
      activationBranch: 'demo',
    },
    {
      id: 'b',
      label: 'B',
      description: '',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [],
      prerequisites: ['a'],
      permittedActions: [],
      completionEvidence: ['bDone'],
      receiptTypes: [],
      companion: { before: '', complete: '' },
      activationBranch: 'demo',
    },
    {
      id: 'cross',
      label: 'Cross',
      description: '',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [],
      prerequisites: ['b'],
      permittedActions: ['cross-to-somewhere'],
      completionEvidence: [],
      receiptTypes: [],
      companion: { before: '', complete: '' },
      activationBranch: 'demo',
    },
  ],
};

function stateFor(evidence: Record<string, Record<string, boolean>>): AuthoritativePlatformState {
  return { stages: evidence };
}

describe('computeJourneyReachability — dormancy + DAG prerequisites', () => {
  it('a branch stage is NOT reachable when its branch is not activated', () => {
    const runtime = resolveJourneyState(FIXTURE_JOURNEY, stateFor({}));
    const { reachableStageIds } = computeJourneyReachability(FIXTURE_JOURNEY, runtime.stages, undefined, stateFor({}));
    expect(reachableStageIds).not.toContain('a');
    expect(reachableStageIds).not.toContain('b');
    expect(reachableStageIds).not.toContain('cross');
    // ambient has no activationBranch and nothing is activated -> reachable.
    expect(reachableStageIds).toContain('ambient');
  });

  it('once activated, only the FIRST reachable branch stage is offered — B is not reachable before A completes', () => {
    const runtime = resolveJourneyState(FIXTURE_JOURNEY, stateFor({}), { demo: 'JOIN' });
    const { reachableStageIds, nextStageId } = computeJourneyReachability(
      FIXTURE_JOURNEY,
      runtime.stages,
      { demo: 'JOIN' },
      stateFor({}),
    );
    expect(reachableStageIds).toEqual(['a']);
    expect(nextStageId).toBe('a');
  });

  it('FOCUS RULE: once any branch is activated, ambient (non-branch) stages step aside', () => {
    const runtime = resolveJourneyState(FIXTURE_JOURNEY, stateFor({}), { demo: 'JOIN' });
    const { reachableStageIds } = computeJourneyReachability(
      FIXTURE_JOURNEY,
      runtime.stages,
      { demo: 'JOIN' },
      stateFor({}),
    );
    expect(reachableStageIds).not.toContain('ambient');
  });

  it('A satisfied -> B becomes reachable, A drops out (COMPLETE, never re-offered)', () => {
    const evidence = stateFor({ a: { aDone: true } });
    const runtime = resolveJourneyState(FIXTURE_JOURNEY, evidence, { demo: 'JOIN' });
    expect(runtime.stages.find((s) => s.stageId === 'a')?.state).toBe('COMPLETE');
    const { reachableStageIds, nextStageId } = computeJourneyReachability(
      FIXTURE_JOURNEY,
      runtime.stages,
      { demo: 'JOIN' },
      evidence,
    );
    expect(reachableStageIds).toEqual(['b']);
    expect(nextStageId).toBe('b');
  });

  it('A + B satisfied -> Cross becomes reachable', () => {
    const evidence = stateFor({ a: { aDone: true }, b: { bDone: true } });
    const runtime = resolveJourneyState(FIXTURE_JOURNEY, evidence, { demo: 'JOIN' });
    const { reachableStageIds, nextStageId } = computeJourneyReachability(
      FIXTURE_JOURNEY,
      runtime.stages,
      { demo: 'JOIN' },
      evidence,
    );
    expect(reachableStageIds).toEqual(['cross']);
    expect(nextStageId).toBe('cross');
  });

  it('never marks a stage COMPLETE by itself — reachability is read-only over resolveJourneyState\'s own per-stage state', () => {
    const evidence = stateFor({});
    const before = resolveJourneyState(FIXTURE_JOURNEY, evidence, { demo: 'JOIN' });
    computeJourneyReachability(FIXTURE_JOURNEY, before.stages, { demo: 'JOIN' }, evidence);
    const after = resolveJourneyState(FIXTURE_JOURNEY, evidence, { demo: 'JOIN' });
    expect(after.stages).toEqual(before.stages);
  });
});

describe('resolveJourneyState — real dependenciesMet (was a stub returning true unconditionally)', () => {
  const journeyWithDependency: JourneyDefinition = {
    ...FIXTURE_JOURNEY,
    stages: FIXTURE_JOURNEY.stages.map((s) =>
      s.id === 'b' ? { ...s, dependencies: [{ type: 'receipt' as const, value: 'externalGate' }] } : s,
    ),
  };

  it('a stage with an unmet dependency is BLOCKED, not READY, even once its prerequisite is complete', () => {
    const evidence = stateFor({ a: { aDone: true } });
    const runtime = resolveJourneyState(journeyWithDependency, evidence, { demo: 'JOIN' });
    const bState = runtime.stages.find((s) => s.stageId === 'b');
    expect(bState?.state).toBe('BLOCKED');
  });

  it('once the dependency evidence is present (anywhere in platform state), the stage is no longer BLOCKED', () => {
    const evidence = stateFor({ a: { aDone: true }, externalGateHolder: { externalGate: true } });
    const runtime = resolveJourneyState(journeyWithDependency, evidence, { demo: 'JOIN' });
    const bState = runtime.stages.find((s) => s.stageId === 'b');
    expect(bState?.state).not.toBe('BLOCKED');
  });
});
