/**
 * Task–Crystal Coverage Report — PRD-EPI-001 §3.2.
 *
 * Gates `task-set`'s `validated → frozen` transition — NOT the crystal
 * (services/research/artifacts.ts::checkFreezeGate has a TODO-style comment
 * marking exactly where this wires in; this module is a pure query+report
 * function and does not touch that gate itself — the calling session wires
 * the integration once this and a parallel crystal-readiness build both
 * land, to avoid two agents editing checkFreezeGate concurrently).
 *
 * Generated only AFTER Crystal vP1 is already frozen and tasks have been
 * independently constructed against the frozen domain boundary (IRL-016 §5 /
 * CRYSTAL-ENLARGEMENT_plan.md §4's "sacred" sequence). This function enforces
 * that precondition itself: it refuses to report coverage for an experiment
 * whose crystal-version artifact is not yet frozen.
 *
 * IMPORTANT — what this function does NOT verify (PRD-EPI-001 §3.2 lists five
 * checks; only the first three are mechanically checkable from invariant ids
 * alone):
 *   - "every task has ≥1 valid grounding path"        — CHECKED (structural)
 *   - "derivation tasks have required premises present" — CHECKED (structural)
 *   - "no task depends on absent material"            — CHECKED (structural)
 *   - "the expected answer is actually supported by those premises" — NOT
 *     mechanically verifiable from ids alone; requires human/LLM judgment at
 *     task-authoring time.
 *   - "no task collapses into answerability from general model knowledge
 *     alone" — NOT mechanically verifiable here either, same reason.
 * This report checks STRUCTURAL coverage only (do the cited invariants exist
 * and do they belong to the frozen crystal) and explicitly does NOT claim to
 * verify semantic entailment or the general-knowledge-collapse condition —
 * see `TaskCoverageReport`'s doc comment.
 *
 * Server-only.
 */

import { getArtifact } from '@/services/research/artifacts';
import { listInvariants } from '@/services/invariants/store';

export type TaskKind = 'recall' | 'derivation';

/**
 * Minimal, scoped to this file — no concrete task-set schema exists yet
 * anywhere in the codebase (§3.2 depends on a `task-set` artifact's actual
 * content, which PRD-EPI-001 does not specify beyond naming the object). Not
 * added to types/research.ts: this is deliberately provisional and narrower
 * than whatever the real `task-set`/`answer-key` payload shape ends up being
 * once §5's sealing procedure is built.
 */
export interface TaskDefinition {
  id: string;
  kind: TaskKind;
  /** Invariant ids this task's grounding path depends on. Recall tasks need
   * ≥1; derivation tasks need ≥2 (a derivation requires composing premises —
   * PRD-EPI-001 §3.2's "multi-invariant entailment path"). */
  requiredInvariantIds: string[];
  /** The sealed expected answer (PRD-EPI-001 §5's AnswerKeyArtifact is what
   * actually seals this; carried here only so a coverage report can be
   * generated against a draft task before the answer key exists). Not
   * validated by this function — see the file-level doc comment. */
  expectedAnswer: string;
}

export interface TaskCoverageResult {
  taskId: string;
  covered: boolean;
  missingInvariantIds: string[];
}

/**
 * `blockedReason` is set (and every task reported uncovered) when the
 * precondition itself isn't met — the frozen crystal doesn't exist yet, or
 * its membership couldn't be resolved — so a caller can distinguish
 * "coverage cannot be assessed yet" from "these specific tasks are
 * unsupported". Additive to the fixed `{ ok, taskResults }` shape.
 */
export interface TaskCoverageReport {
  ok: boolean;
  taskResults: TaskCoverageResult[];
  blockedReason?: string;
}

export interface TaskCoverageInput {
  experimentId: string;
  tasks: TaskDefinition[];
  /** Explicit frozen-crystal membership, when the caller has it (e.g. the
   * real Crystal vP1 snapshot's invariant id list). FrozenArtifact
   * (types/research.ts) does not yet carry an explicit membership field —
   * there is no "these ids are Crystal vP1's members" schema anywhere in the
   * codebase yet (Track 2, which would populate a real crystal, is paused).
   * When omitted, this function falls back to `crystalDomain` below — an
   * honest placeholder for the real frozen-snapshot boundary, not a
   * substitute for it. */
  crystalMemberInvariantIds?: string[];
  /** Domain fallback when crystalMemberInvariantIds is not supplied — same
   * default and same "no live data yet" caveat as crystalReadiness.ts. */
  crystalDomain?: string;
}

/**
 * Run PRD-EPI-001 §3.2's structural coverage checks for a candidate task
 * set. Never throws: any lookup failure (crystal artifact, invariant
 * substrate) is reported as `blockedReason` / missing invariants, not a
 * crash. A task citing a non-existent invariant id is always reported
 * `covered: false` with that id in `missingInvariantIds`.
 */
export async function runTaskCoverageReport(
  input: TaskCoverageInput,
): Promise<TaskCoverageReport> {
  const { experimentId, tasks } = input;
  const crystalDomain = input.crystalDomain ?? 'constitutional-reasoning';

  // Precondition (IRL-016 §5 / CRYSTAL-ENLARGEMENT_plan.md §4 — "sacred"):
  // Crystal vP1 must already be frozen before coverage can even be assessed.
  let crystalFrozen = false;
  try {
    const crystal = await getArtifact(experimentId, 'crystal-version');
    crystalFrozen = crystal?.lifecycle === 'frozen';
  } catch {
    crystalFrozen = false;
  }

  if (!crystalFrozen) {
    return {
      ok: false,
      blockedReason:
        `crystal-version artifact for experiment '${experimentId}' is not frozen — the Task–Crystal ` +
        `Coverage Report cannot run before Crystal vP1 is frozen (PRD-EPI-001 §3.2, IRL-016 §5)`,
      taskResults: tasks.map((task) => ({
        taskId: task.id,
        covered: false,
        missingInvariantIds: [...task.requiredInvariantIds],
      })),
    };
  }

  // Crystal membership — see the crystalMemberInvariantIds/crystalDomain doc
  // comments above for why this is a placeholder derivation, not the real
  // frozen-snapshot boundary, until Track 2 lands one.
  let memberIds: Set<string>;
  if (input.crystalMemberInvariantIds) {
    memberIds = new Set(input.crystalMemberInvariantIds);
  } else {
    try {
      const domainInvariants = await listInvariants({
        domain: crystalDomain,
        status: ['validated', 'canonical'],
        limit: 500,
      });
      memberIds = new Set(domainInvariants.map((inv) => inv.id));
    } catch {
      memberIds = new Set();
    }
  }

  const taskResults: TaskCoverageResult[] = tasks.map((task) => {
    const missingInvariantIds = task.requiredInvariantIds.filter((id) => !memberIds.has(id));
    const minPremises = task.kind === 'derivation' ? 2 : 1;
    const covered = missingInvariantIds.length === 0 && task.requiredInvariantIds.length >= minPremises;
    return { taskId: task.id, covered, missingInvariantIds };
  });

  const ok = tasks.length > 0 && taskResults.every((r) => r.covered);
  return { ok, taskResults };
}
