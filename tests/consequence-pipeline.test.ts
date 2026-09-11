/**
 * Consequence Operating Model — pipeline canaries (Chrysalis Foundation Phase 3).
 *
 * Pins the canonical 13-stage pipeline (CFS-006a), the pre/post approval split,
 * the flywheel recursion, and the pure risk/value heuristics. Stage functions
 * that hit the invariant substrate (curation, forecasting) require a DB and are
 * verified in the operator environment.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  CONSEQUENCE_PIPELINE,
  PRE_APPROVAL_STAGES,
  POST_APPROVAL_STAGES,
  FLYWHEEL_RETURN,
  stageDefinition,
} from '@/services/consequence/pipeline';
import { assessRiskHeuristic, assessValueHeuristic } from '@/services/consequence/stages';
import { validateTemplate } from '@/services/intentChains/registry';
import type { ChainTemplate } from '@/types/intentChains';

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

describe('Phase 3b — consequence-operating-model.v1 chain template', () => {
  const templatePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'services/intentChains/templates/consequence-operating-model.v1.json',
  );
  const template = JSON.parse(readFileSync(templatePath, 'utf-8')) as ChainTemplate;

  it('passes the chain registry validator', () => {
    expect(validateTemplate(template)).toEqual([]);
  });

  it('gates the flywheel behind the disposition/approval seam', () => {
    const preflight = template.steps.find((s) => s.id === 'preflight')!;
    // deny and ask terminate; act skips straight to the flywheel; the default
    // next (escalate) routes through the human approval step.
    expect(preflight.branches?.some((b) => b.if.includes("'deny'") && b.terminate)).toBe(true);
    expect(preflight.branches?.some((b) => b.if.includes("'act'") && b.next === 'execute-flywheel')).toBe(true);
    expect(preflight.next).toBe('review-plan');
    const review = template.steps.find((s) => s.id === 'review-plan')!;
    expect(review.kind).toBe('approve');
    expect(review.branches?.some((b) => b.if.includes("'reject'") && b.terminate)).toBe(true);
  });

  it('rpc steps target the step adapter with matching outcome events', () => {
    const rpcSteps = template.steps.filter((s) => s.kind === 'rpc');
    expect(rpcSteps).toHaveLength(2);
    for (const step of rpcSteps) {
      expect(step.rpc!.endpoint).toBe('/api/consequence/steps');
    }
    expect(rpcSteps[0].rpc!.expected_outcome_event_type).toBe('consequence_preflight_completed');
    expect(rpcSteps[1].rpc!.expected_outcome_event_type).toBe('consequence_flywheel_completed');
  });
});
