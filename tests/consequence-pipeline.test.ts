/**
 * Consequence Operating Model — pipeline canaries (Chrysalis Foundation Phase 3).
 *
 * Pins the canonical 13-stage pipeline (CFS-006a), the pre/post approval split,
 * the flywheel recursion, and the pure risk/value heuristics. Stage functions
 * that hit the invariant substrate (curation, forecasting) require a DB and are
 * verified in the operator environment.
 */

import { describe, expect, it } from 'vitest';
import {
  CONSEQUENCE_PIPELINE,
  PRE_APPROVAL_STAGES,
  POST_APPROVAL_STAGES,
  FLYWHEEL_RETURN,
  stageDefinition,
} from '@/services/consequence/pipeline';
import { assessRiskHeuristic, assessValueHeuristic } from '@/services/consequence/stages';

const NOW = '2026-07-03T00:00:00Z';

describe('canonical pipeline (CFS-006a)', () => {
  it('has the 13 stages in canonical order', () => {
    expect(CONSEQUENCE_PIPELINE).toHaveLength(13);
    expect(CONSEQUENCE_PIPELINE[0].stage).toBe('intent');
    expect(CONSEQUENCE_PIPELINE[CONSEQUENCE_PIPELINE.length - 1].stage).toBe('knowledge_evolution');
  });

  it('names the four new substrate-consuming stages', () => {
    const newStages = CONSEQUENCE_PIPELINE.filter((s) => s.isNew).map((s) => s.stage);
    expect(newStages).toEqual([
      'knowledge_curation',
      'knowledge_compression',
      'consequence_forecasting',
      'knowledge_evolution',
    ]);
  });

  it('splits pre/post approval with no overlap and full coverage', () => {
    const all = [...PRE_APPROVAL_STAGES, ...POST_APPROVAL_STAGES];
    expect(all).toHaveLength(CONSEQUENCE_PIPELINE.length);
    expect(new Set(all).size).toBe(CONSEQUENCE_PIPELINE.length);
    expect(PRE_APPROVAL_STAGES[PRE_APPROVAL_STAGES.length - 1]).toBe('planning');
    expect(POST_APPROVAL_STAGES[0]).toBe('execution');
  });

  it('the flywheel returns evolution → curation (recursive, not linear)', () => {
    expect(FLYWHEEL_RETURN.from).toBe('knowledge_evolution');
    expect(FLYWHEEL_RETURN.to).toBe('knowledge_curation');
  });

  it('stageDefinition resolves and throws on unknown', () => {
    expect(stageDefinition('planning').product).toBe('Plan (disposition)');
    // @ts-expect-error — invalid stage
    expect(() => stageDefinition('nope')).toThrow();
  });
});

describe('risk/value heuristics (v1; phase2 wiring point)', () => {
  it('risk rises as confidence falls and flags incoherent knowledge', () => {
    const confident = assessRiskHeuristic({ iqubeId: 'i', aggregateConfidence: 0.95, knowledgeSize: 3, coherent: true, now: NOW });
    const shaky = assessRiskHeuristic({ iqubeId: 'i', aggregateConfidence: 0.3, knowledgeSize: 3, coherent: true, now: NOW });
    const incoherent = assessRiskHeuristic({ iqubeId: 'i', aggregateConfidence: 0.9, knowledgeSize: 3, coherent: false, now: NOW });
    expect(shaky.overall_score).toBeGreaterThan(confident.overall_score);
    expect(incoherent.risk_flags).toContain('incoherent_knowledge');
    expect(confident.overall_score).toBeGreaterThanOrEqual(0);
    expect(shaky.overall_score).toBeLessThanOrEqual(100);
  });

  it('high risk recommends guardian approval', () => {
    const risky = assessRiskHeuristic({ iqubeId: 'i', aggregateConfidence: 0.2, knowledgeSize: 10, coherent: false, now: NOW });
    expect(risky.recommended_controls).toContain('require_guardian_approval');
  });

  it('value rises with standing and knowledge breadth', () => {
    const low = assessValueHeuristic({ iqubeId: 'i', aggregateStanding: 10, knowledgeSize: 1, now: NOW });
    const high = assessValueHeuristic({ iqubeId: 'i', aggregateStanding: 90, knowledgeSize: 8, now: NOW });
    expect(high.work_potential_qc!).toBeGreaterThan(low.work_potential_qc!);
  });
});
