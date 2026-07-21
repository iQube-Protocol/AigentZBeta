/**
 * Research ICE loop — the stage machine (CFS-019 Phase C3).
 *
 * The Dev Command Center's ICE loop (services/devCommandCenter/devLoop.ts) gives
 * software a staged develop → validate → deploy cadence. C3 brings experiments to
 * the SAME cadence — design → protocol → run → analyze → publish — reusing the
 * research lifecycle (types/research.ts), the proposal kinds
 * (services/research/proposals.ts), and the run-lifecycle wiring
 * (services/research/lifecycle.ts) already built. This module is the research
 * ANALOG of devLoop, not a fork of it: it is a PURE stage machine scoped to a
 * single ACTIVE experiment, deriving its stage from that experiment's lifecycle.
 *
 * Constitutional boundary (the research analog of the dev loop's "execution stays
 * human", CFS-016 D1): the `run` stage carries NO proposal kind. Running an
 * experiment is NOT a copilot action — it is EXECUTED in the Experiment Lab
 * (InvariantExperimentLab, the EXP-001…005 runners), where the run advances the
 * research object's lifecycle via recordExperimentRunLifecycle (C2.3). The loop
 * then re-derives its stage from the advanced lifecycle. The copilot NEVER runs
 * an experiment; it hands off to the lab and narrates.
 *
 * Everything here is pure + canary-pinned (tests/irl-research-loop.test.ts):
 * no fs, no DB, no receipt — safe for the chat route (stage → instruction kind)
 * and the client tab (stage strip + flow-through).
 */

import { EXPERIMENT_LIFECYCLE, type ExperimentLifecycleState } from '@/types/research';
import type { ResearchProposalKind } from '@/services/research/proposals';

// ─── Loop stages (order is meaning — canary-pinned) ─────────────────────────

/**
 * The research ICE loop stages, in progression order. `design → protocol → run
 * → analyze → publish` is the develop→run→validate→publish cadence; `replicated`
 * is the terminal state (a finding earns replication through the lifecycle, never
 * by assertion). The `run` stage is the lab hand-off (constitutional boundary).
 */
export const RESEARCH_LOOP_STAGE_ORDER = [
  'design',
  'protocol',
  'run',
  'analyze',
  'publish',
  'replicated',
] as const;
export type ResearchLoopStage = (typeof RESEARCH_LOOP_STAGE_ORDER)[number];

/**
 * How the loop should treat the current stage in the UI:
 *  - `propose`     — the copilot produces a proposal (design/protocol/analyze/publish)
 *  - `run-in-lab`  — hand off to the Experiment Lab; execution stays there (run)
 *  - `complete`    — terminal, nothing further the loop drives (replicated)
 */
export type ResearchStageActionable = 'propose' | 'run-in-lab' | 'complete';

// ─── Lifecycle → stage (every EXPERIMENT_LIFECYCLE state maps to a stage) ─────

/**
 * Map an experiment's lifecycle state to its loop stage. This is the heart of
 * the machine: the stage is DERIVED from the lifecycle, never set independently
 * (the same discipline as lifecycle.ts — states are facts, not assertions).
 *
 *  designed          → protocol  (designed, awaiting protocol ratification)
 *  protocol-ratified → run       (ratified, awaiting the lab run)
 *  running           → run       (run in progress, awaiting the lab's results)
 *  evaluated         → analyze   (results in — record the finding)
 *  published         → publish   (a canonical run exists — draft the publication)
 *  replicated        → replicated(runs on ≥2 providers — terminal)
 */
export function researchStageForLifecycle(state: ExperimentLifecycleState): ResearchLoopStage {
  switch (state) {
    case 'designed':
      return 'protocol';
    case 'protocol-ratified':
      return 'run';
    case 'running':
      return 'run';
    case 'evaluated':
      return 'analyze';
    case 'published':
      return 'publish';
    case 'replicated':
      return 'replicated';
    default:
      return 'design';
  }
}

/**
 * The loop stage for the ACTIVE experiment. No experiment yet ⇒ `design` (the
 * operator's first move is to design one). Otherwise the stage is derived from
 * the experiment's lifecycle. Accepts anything carrying a `lifecycle` field
 * (ProposedExperiment, overview entry) — pure.
 */
export function researchStageForExperiment(
  exp: { lifecycle: ExperimentLifecycleState } | null | undefined,
): ResearchLoopStage {
  if (!exp) return 'design';
  return researchStageForLifecycle(exp.lifecycle);
}

// ─── Stage → proposal kind (run → null: the constitutional boundary) ─────────

/**
 * The proposal kind the copilot should produce at a stage — the research analog
 * of STAGE_PROPOSAL_KIND. `run` (and `replicated`) map to null: running is NOT a
 * proposal (it happens in the Experiment Lab), and replication is a computed
 * multi-provider signal, never a copilot-authored object. A null kind means the
 * chat route must NOT narrow to one schema and the copilot must NOT be pushed to
 * emit a fence (the CONDITIONAL fence contract stays intact).
 */
export function researchStageProposalKind(stage: ResearchLoopStage): ResearchProposalKind | null {
  switch (stage) {
    case 'design':
      return 'experiment_proposal';
    case 'protocol':
      return 'protocol_draft';
    case 'analyze':
      return 'finding';
    case 'publish':
      return 'publication_draft';
    case 'run':
      return null; // lab hand-off — running is not a copilot action
    case 'replicated':
      return null; // terminal — replication is computed, never proposed
    default:
      return null;
  }
}

/**
 * Whether a stage produces a proposal, hands off to the lab, or is terminal —
 * the signal the UI uses to render the Run stage as a lab pointer (never a fake
 * in-copilot run) and to gate the publish/analyze proposal affordances.
 */
export function researchStageActionable(stage: ResearchLoopStage): ResearchStageActionable {
  if (stage === 'run') return 'run-in-lab';
  if (stage === 'replicated') return 'complete';
  return 'propose';
}

// ─── Stage progression (forward-only, lifecycle-driven) ──────────────────────

/**
 * The next loop stage given the CURRENT stage and the experiment's (possibly
 * just-advanced) lifecycle state. The lifecycle is the source of truth: the
 * target stage is re-derived from it, but the loop only ever flows FORWARD — a
 * re-run (`running` re-entered from a later state, the flywheel) never drags the
 * strip backward. Returns the current stage unchanged when the lifecycle would
 * not move it forward. Pure — canary-pinned. Mirrors devLoop.nextStage's role
 * (the next position after an operator-gated transition).
 */
export function nextResearchStage(
  current: ResearchLoopStage,
  lifecycle: ExperimentLifecycleState,
): ResearchLoopStage {
  const target = researchStageForLifecycle(lifecycle);
  const ci = RESEARCH_LOOP_STAGE_ORDER.indexOf(current);
  const ti = RESEARCH_LOOP_STAGE_ORDER.indexOf(target);
  return ti >= ci ? target : current;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<ResearchLoopStage, string> = {
  design: 'Design',
  protocol: 'Protocol',
  run: 'Run',
  analyze: 'Analyze',
  publish: 'Publish',
  replicated: 'Replicated',
};

export function researchStageLabel(stage: ResearchLoopStage): string {
  return STAGE_LABEL[stage] ?? stage;
}

/** Runtime guard for untyped stage values (ground-context validation). Pure. */
export function isResearchLoopStage(value: unknown): value is ResearchLoopStage {
  return typeof value === 'string' && (RESEARCH_LOOP_STAGE_ORDER as readonly string[]).includes(value);
}

/**
 * Canary anchor: the count of lifecycle states the stage machine must cover.
 * Not used at runtime — the test imports EXPERIMENT_LIFECYCLE and checks each
 * maps to a stage; this is the human-readable statement of that invariant.
 */
export const _RESEARCH_LIFECYCLE_STATES_COVERED = EXPERIMENT_LIFECYCLE.length;
