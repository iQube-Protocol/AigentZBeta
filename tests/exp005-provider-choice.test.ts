/**
 * PSE-2 (EXP-005) — the Provider-Choice Drill. Pins the pure orchestration
 * contract: deterministic rotation, cross-provider judging (judge ≠ answerer),
 * honest switch-integrity measurement, and the bundle-component / rung sets.
 */
import {
  EXP005_MIN_PROVIDERS,
  EXP005_BUNDLE_COMPONENTS,
  EXP005_OPEN_WEIGHT_COMPONENT,
  exp005ValidateProviders,
  exp005AnswerProviderForTask,
  exp005JudgeProviderForTask,
  exp005SwitchIntegrity,
  exp005BundleComponentsForRun,
  exp005RungForRun,
  type Exp005TaskResult,
} from '@/services/experiments/exp005';
import { EXPERIMENT_REGISTRY, SERIES_REGISTRY } from '@/types/research';

describe('EXP-005 provider-choice drill', () => {
  const rot = ['openai', 'venice', 'chaingpt'] as const;

  it('rotation covers all selected providers deterministically', () => {
    const answerers = [0, 1, 2, 3, 4].map((i) => exp005AnswerProviderForTask(i, rot as any));
    expect(answerers).toEqual(['openai', 'venice', 'chaingpt', 'openai', 'venice']);
  });

  it('the judge provider never equals the answer provider', () => {
    for (let i = 0; i < 6; i++) {
      expect(exp005JudgeProviderForTask(i, rot as any)).not.toBe(exp005AnswerProviderForTask(i, rot as any));
    }
    // holds at the minimum rotation size too
    const two = ['openai', 'venice'] as const;
    for (let i = 0; i < 4; i++) {
      expect(exp005JudgeProviderForTask(i, two as any)).not.toBe(exp005AnswerProviderForTask(i, two as any));
    }
  });

  it('validation rejects <2, unknown, and duplicate providers', () => {
    expect(() => exp005ValidateProviders(['openai'])).toThrow();
    expect(() => exp005ValidateProviders(['openai', 'nope'])).toThrow();
    expect(() => exp005ValidateProviders(['openai', 'openai'])).toThrow();
    expect(() => exp005ValidateProviders(['openai', 'venice'])).not.toThrow();
    expect(EXP005_MIN_PROVIDERS).toBe(2);
  });

  it('switchIntegrity: constitutional failure iff a task did not complete', () => {
    const ok: Exp005TaskResult[] = [
      { taskId: 't1', answerProvider: 'openai', judgeProvider: 'venice', completed: true },
      { taskId: 't2', answerProvider: 'venice', judgeProvider: 'openai', completed: true },
    ];
    const good = exp005SwitchIntegrity(ok);
    expect(good.constitutionalFailures).toBe(0);
    expect(good.completedAcrossProviders).toBe(true);
    expect(good.crossJudgePairs).toHaveLength(2);

    const bad = exp005SwitchIntegrity([
      ...ok,
      { taskId: 't3', answerProvider: 'chaingpt', judgeProvider: null, completed: false },
    ]);
    expect(bad.constitutionalFailures).toBe(1);
    expect(bad.completedAcrossProviders).toBe(false);
  });

  it('bundle components + rung: pinned set on completion, nothing on failure', () => {
    expect(exp005BundleComponentsForRun(['openai', 'chaingpt'] as any, true)).toEqual(EXP005_BUNDLE_COMPONENTS);
    expect(exp005BundleComponentsForRun(['openai', 'venice'] as any, true)).toContain(EXP005_OPEN_WEIGHT_COMPONENT);
    expect(exp005BundleComponentsForRun(['openai', 'venice'] as any, false)).toEqual([]);
    expect(exp005RungForRun(true)).toBe('s2-substitutable');
    expect(exp005RungForRun(false)).toBeNull();
  });

  it('is registered in EXPERIMENT_REGISTRY and the PSE series', () => {
    expect(EXPERIMENT_REGISTRY.find((e) => e.id === 'EXP-005')?.seriesId).toBe('PSE');
    expect(SERIES_REGISTRY.find((s) => s.id === 'PSE')?.members).toContain('EXP-005');
  });
});
