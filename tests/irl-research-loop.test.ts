/**
 * IRL research ICE loop — Phase C3 canary (CFS-019).
 *
 * Pins the constitutional guarantees of the research analog of the Dev Command
 * Center's ICE loop (services/research/researchLoop.ts):
 *  1. lifecycle → stage: EVERY EXPERIMENT_LIFECYCLE state maps to a loop stage,
 *     and no-experiment maps to `design`.
 *  2. stage → proposal kind: design/protocol/analyze/publish carry a kind; the
 *     `run` stage carries NO kind (the constitutional boundary — running is not
 *     a copilot action, it is executed in the Experiment Lab); `replicated` is
 *     terminal and carries no kind.
 *  3. nextResearchStage advances correctly on each lifecycle transition and is
 *     forward-only (a re-run never drags the strip backward — the flywheel).
 *  4. researchStageActionable: 'run-in-lab' at protocol-ratified/running,
 *     'propose' at design/protocol/analyze/publish, 'complete' at replicated.
 *  5. STRUCTURAL: the Run stage's null proposal kind is stated in the source as
 *     the lab hand-off boundary (running is not a copilot action).
 *
 * Runs under vitest in CI; verified in the sandbox via an esbuild-bundle + node
 * drill (vitest + @supabase/supabase-js unavailable there — the drill aliases
 * @supabase/supabase-js to an empty stub for the import graph and exercises the
 * pure exports).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  RESEARCH_LOOP_STAGE_ORDER,
  researchStageForLifecycle,
  researchStageForExperiment,
  researchStageProposalKind,
  researchStageActionable,
  nextResearchStage,
  researchStageLabel,
  isResearchLoopStage,
  type ResearchLoopStage,
} from '@/services/research/researchLoop';
import { EXPERIMENT_LIFECYCLE, type ExperimentLifecycleState } from '@/types/research';

describe('C3 — lifecycle → stage (every state maps to a stage)', () => {
  const EXPECTED: Record<ExperimentLifecycleState, ResearchLoopStage> = {
    designed: 'protocol',
    'protocol-ratified': 'run',
    running: 'run',
    evaluated: 'analyze',
    published: 'publish',
    replicated: 'replicated',
  };

  it('maps every EXPERIMENT_LIFECYCLE state to a defined loop stage', () => {
    for (const state of EXPERIMENT_LIFECYCLE) {
      const stage = researchStageForLifecycle(state);
      expect(RESEARCH_LOOP_STAGE_ORDER).toContain(stage);
      expect(stage).toBe(EXPECTED[state]);
    }
  });

  it('no experiment yet ⇒ design (the operator\'s first move is to design one)', () => {
    expect(researchStageForExperiment(null)).toBe('design');
    expect(researchStageForExperiment(undefined)).toBe('design');
    expect(researchStageForExperiment({ lifecycle: 'designed' })).toBe('protocol');
    expect(researchStageForExperiment({ lifecycle: 'running' })).toBe('run');
  });
});

describe('C3 — stage → proposal kind (run carries NO kind: the boundary)', () => {
  it('design/protocol/analyze/publish each carry the expected proposal kind', () => {
    expect(researchStageProposalKind('design')).toBe('experiment_proposal');
    expect(researchStageProposalKind('protocol')).toBe('protocol_draft');
    expect(researchStageProposalKind('analyze')).toBe('finding');
    expect(researchStageProposalKind('publish')).toBe('publication_draft');
  });

  it('the RUN stage carries NO proposal kind — running is not a copilot action', () => {
    expect(researchStageProposalKind('run')).toBeNull();
  });

  it('the terminal replicated stage carries no proposal kind (replication is computed)', () => {
    expect(researchStageProposalKind('replicated')).toBeNull();
  });
});

describe('C3 — researchStageActionable', () => {
  it("'run-in-lab' at the run stage (protocol-ratified / running lifecycles)", () => {
    expect(researchStageActionable('run')).toBe('run-in-lab');
    expect(researchStageActionable(researchStageForLifecycle('protocol-ratified'))).toBe('run-in-lab');
    expect(researchStageActionable(researchStageForLifecycle('running'))).toBe('run-in-lab');
  });

  it("'propose' at design / protocol / analyze / publish", () => {
    for (const s of ['design', 'protocol', 'analyze', 'publish'] as ResearchLoopStage[]) {
      expect(researchStageActionable(s)).toBe('propose');
    }
  });

  it("'complete' at replicated", () => {
    expect(researchStageActionable('replicated')).toBe('complete');
  });
});

describe('C3 — nextResearchStage advances on each lifecycle transition', () => {
  it('advances forward across the whole cadence', () => {
    // design (no exp) → an experiment is created at `designed` → protocol
    expect(nextResearchStage('design', 'designed')).toBe('protocol');
    // designed → protocol-ratified → run
    expect(nextResearchStage('protocol', 'protocol-ratified')).toBe('run');
    // protocol-ratified → running (the lab run starts) → still run
    expect(nextResearchStage('run', 'running')).toBe('run');
    // running → evaluated (results in) → analyze
    expect(nextResearchStage('run', 'evaluated')).toBe('analyze');
    // evaluated → published → publish
    expect(nextResearchStage('analyze', 'published')).toBe('publish');
    // published → replicated → replicated (terminal)
    expect(nextResearchStage('publish', 'replicated')).toBe('replicated');
  });

  it('is forward-only — a re-run (running re-entered from a later state) never drags the strip back', () => {
    // The flywheel: re-running a published experiment sets lifecycle=running,
    // but the loop must not regress publish → run.
    expect(nextResearchStage('publish', 'running')).toBe('publish');
    expect(nextResearchStage('analyze', 'running')).toBe('analyze');
    // At or before the derived target, it moves to the target.
    expect(nextResearchStage('design', 'running')).toBe('run');
  });
});

describe('C3 — labels + guard', () => {
  it('every stage has a human label', () => {
    for (const s of RESEARCH_LOOP_STAGE_ORDER) {
      expect(researchStageLabel(s).length).toBeGreaterThan(0);
    }
  });

  it('isResearchLoopStage guards untyped ground-context values', () => {
    expect(isResearchLoopStage('run')).toBe(true);
    expect(isResearchLoopStage('deploy')).toBe(false);
    expect(isResearchLoopStage(null)).toBe(false);
    expect(isResearchLoopStage(3)).toBe(false);
  });
});

describe('C3 — structural: the run stage is the lab hand-off boundary', () => {
  it('the source states running is not a copilot action (null kind) and hands off to the Experiment Lab', () => {
    const src = readFileSync(join(process.cwd(), 'services/research/researchLoop.ts'), 'utf8');
    // The stage → kind function returns null at `run` with the boundary comment.
    expect(src).toMatch(/case 'run':\s*\n\s*return null;/);
    expect(src).toContain('Experiment Lab');
    expect(src).toContain('running is not a copilot action');
  });
});
