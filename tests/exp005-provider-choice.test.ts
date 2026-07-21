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

  it('switchIntegrity: a clean multi-provider run HOLDS; the ONLY failure is a constitutional defect', () => {
    const ok: Exp005TaskResult[] = [
      { taskId: 't1', answerProvider: 'openai', judgeProvider: 'venice', outcome: 'completed', contradicting: 0 },
      { taskId: 't2', answerProvider: 'venice', judgeProvider: 'openai', outcome: 'completed', contradicting: 0 },
    ];
    const good = exp005SwitchIntegrity(ok);
    expect(good.verdict).toBe('held');
    expect(good.constitutionalFailures).toBe(0);
    expect(good.constitutionalPortability).toBe('held');
    expect(good.completedAcrossProviders).toBe(true);
    expect(good.crossJudgePairs).toHaveLength(2);

    // A reached+judged answer that contradicts the collection = the ONLY thing
    // that counts against switch integrity → verdict constitutional_failure.
    const defect = exp005SwitchIntegrity([
      { taskId: 't1', answerProvider: 'openai', judgeProvider: 'venice', outcome: 'completed', contradicting: 0 },
      { taskId: 't2', answerProvider: 'venice', judgeProvider: 'chaingpt', outcome: 'constitutionally_failed', contradicting: 5 },
    ]);
    expect(defect.constitutionalFailures).toBe(1);
    expect(defect.verdict).toBe('constitutional_failure');
    expect(defect.constitutionalPortability).toBe('broken');
  });

  it('switchIntegrity: timeout / provider_unavailable / judge_failed are infra classes — NOT constitutional failures; run is inconclusive', () => {
    const s = exp005SwitchIntegrity([
      { taskId: 't1', answerProvider: 'openai', judgeProvider: 'venice', outcome: 'completed', contradicting: 0 },
      { taskId: 't2', answerProvider: 'venice', judgeProvider: 'chaingpt', outcome: 'timed_out' },
      { taskId: 't3', answerProvider: 'chaingpt', judgeProvider: 'openai', outcome: 'provider_unavailable' },
      { taskId: 't4', answerProvider: 'openai', judgeProvider: 'venice', outcome: 'judge_failed' },
    ]);
    expect(s.constitutionalFailures).toBe(0);
    expect(s.timedOut).toBe(1);
    expect(s.providerUnavailable).toBe(1);
    expect(s.judgeFailed).toBe(1);
    expect(s.verdict).toBe('inconclusive');
    expect(s.providersUnavailable).toEqual(['venice', 'chaingpt']);
  });

  it('operationalViability: a provider can be viable JUDGING but not ANSWERING (the venice signature)', () => {
    // venice times out as an answerer twice, but judges fine — two independent axes.
    const s = exp005SwitchIntegrity([
      { taskId: 't1', answerProvider: 'openai', judgeProvider: 'venice', outcome: 'completed', contradicting: 0 },
      { taskId: 't2', answerProvider: 'venice', judgeProvider: 'chaingpt', outcome: 'timed_out' },
      { taskId: 't3', answerProvider: 'chaingpt', judgeProvider: 'openai', outcome: 'completed', contradicting: 0 },
      { taskId: 't4', answerProvider: 'openai', judgeProvider: 'venice', outcome: 'completed', contradicting: 0 },
      { taskId: 't5', answerProvider: 'venice', judgeProvider: 'chaingpt', outcome: 'timed_out' },
    ]);
    expect(s.operationalViability.venice.answerViable).toBe(false); // timed out answering
    expect(s.operationalViability.venice.judgeViable).toBe(true); // judged fine
    // No constitutional defect among the completed tasks → portability not broken.
    expect(s.constitutionalFailures).toBe(0);
    expect(s.verdict).toBe('inconclusive'); // infra timeouts prevented a full clean sweep
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
