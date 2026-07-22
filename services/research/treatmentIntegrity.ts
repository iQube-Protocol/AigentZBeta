/**
 * Treatment Integrity Check — PRD-EPI-001 §7 (EXP-P1 Arm B instrumentation,
 * formalized as a gate).
 *
 * A B≈C outcome is NOT scientifically interpretable unless this check passes.
 * A Treatment Integrity failure classifies as `implementation-failure` in the
 * interpretation-table taxonomy (PRD-EPI-001 §6) — NEVER `scientific-null`.
 * This module only checks and classifies; it does not build or own the
 * six-way failure taxonomy itself (`scientific-null | substrate-insufficiency
 * | task-invalidity | implementation-failure | measurement-failure |
 * coverage-failure`) — that lives in the `interpretation-table` FrozenArtifact
 * (types/research.ts / PRD-EPI-001 §6).
 *
 * HONESTY NOTE: there is no live EXP-P1 runner yet (Track 2's crystal + task
 * construction is separately chartered and currently paused). This file is
 * the CHECKER a future Arm B runner will call, wired for when that runner
 * exists — it is not a runner itself and does not fabricate sample traces.
 *
 * `ExecutionTrace` is scoped to this file (not types/research.ts) because it
 * describes a runtime artifact that has no runner yet to produce it; adding
 * it to the shared research object model would assert an execution surface
 * that does not exist. Promote it to types/research.ts only once a real
 * runner needs to persist traces as `execution-run` FrozenArtifact payloads.
 */

import { createHash } from 'node:crypto';

/**
 * The minimal, honest shape of one Arm B task execution's instrumentation
 * trace, per PRD-EPI-001 §7's required log fields (candidate invariants
 * considered, selection, exclusions, projection trace, final rendered
 * prompt, hashes of every input/output). Fields beyond what §7's six checks
 * actually need are deliberately omitted — this is a checker's input
 * contract, not a full trace schema.
 */
export interface ExecutionTrace {
  armId: 'B';
  taskId: string;

  /** Candidate invariants the resolution/selection engine considered before
   * selecting. Empty (when `skippedSelection` is not explicitly true) means
   * the engine never ran for this task — check 1. */
  candidateInvariantsConsidered: string[];
  /** Explicit "the selection stage was skipped" flag — distinguishes a real
   * empty-candidate-set outcome from a stage that silently never ran.
   * Absent/false is the expected case for a genuine Arm B pass. */
  skippedSelection?: boolean;

  /** Invariants the engine actually selected out of the candidates above —
   * check 2 (candidate selection occurred, not skipped). */
  selectedInvariantIds: string[];

  /** Whether the composition/projection stage produced non-empty output
   * where the protocol expected it to — check 3. */
  projectionNonEmpty: boolean;

  /** The frozen `arm-config` this run claims to be executing under, and the
   * config actually recorded at run time — check 4 (recorded trace matches
   * the frozen arm-config/runtime configuration exactly). */
  armConfigId: string;
  armConfigHash: string;
  expectedArmConfigHash: string;

  /** Whether any fallback path (e.g. a static prompt shipped instead of live
   * selection) was silently substituted for the live runtime — check 5.
   * Must be explicit; there is no "assume no fallback" default. */
  usedFallback: boolean;

  /** The final rendered prompt text and its recorded hash — check 6 (the
   * final rendered prompt matches its recorded hash). Hashed here with the
   * same sha256 commitment discipline as the rest of the research object
   * model (services/experiments/publishResult.ts). */
  renderedPrompt: string;
  renderedPromptHash: string;
}

export interface TreatmentIntegrityResult {
  ok: boolean;
  /** Human-readable failure descriptions, each traceable to one of §7's six
   * checks. Empty iff ok === true. */
  failures: string[];
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Pure function — PRD-EPI-001 §7's six-check gate. No I/O, no persistence:
 * a future runner is responsible for producing the ExecutionTrace and for
 * recording the result (e.g. as part of an `execution-run` FrozenArtifact
 * payload) via services/research/artifacts.ts.
 *
 * Any failure here classifies as `implementation-failure` in the
 * interpretation table (PRD-EPI-001 §6) — never `scientific-null`. Callers
 * building interpretation-table entries should cite this function's
 * `failures` array as the objective criterion for that category.
 */
export function checkTreatmentIntegrity(trace: ExecutionTrace): TreatmentIntegrityResult {
  const failures: string[] = [];

  // Check 5 first and unconditionally: a fallback substitution invalidates
  // the run regardless of what the other fields claim — a silently
  // substituted static prompt can still produce non-empty candidates,
  // selections, and projections, so this must never be allowed to be
  // masked by otherwise-passing checks.
  if (trace.usedFallback) {
    failures.push(
      'fallback path used — a static/fallback prompt was silently substituted for the live runtime (PRD-EPI-001 §7 check 5)',
    );
  }

  // Check 1: the resolution/selection engine actually ran for the task.
  if (!trace.skippedSelection && trace.candidateInvariantsConsidered.length === 0) {
    failures.push(
      'resolution/selection engine did not run — candidateInvariantsConsidered is empty and skippedSelection is not set (PRD-EPI-001 §7 check 1)',
    );
  }
  if (trace.skippedSelection) {
    failures.push('selection stage explicitly skipped (PRD-EPI-001 §7 checks 1–2)');
  }

  // Check 2: candidate selection occurred (not skipped).
  if (!trace.skippedSelection && trace.selectedInvariantIds.length === 0) {
    failures.push(
      'candidate selection did not occur — selectedInvariantIds is empty (PRD-EPI-001 §7 check 2)',
    );
  }

  // Check 3: projection was non-empty where the protocol expected it to be.
  if (!trace.projectionNonEmpty) {
    failures.push(
      'projection was empty where the protocol expected non-empty output (PRD-EPI-001 §7 check 3)',
    );
  }

  // Check 4: recorded trace matches the frozen arm-config/runtime
  // configuration exactly.
  if (trace.armConfigHash !== trace.expectedArmConfigHash) {
    failures.push(
      `recorded arm-config hash does not match the frozen arm-config (armConfigId=${trace.armConfigId}) — PRD-EPI-001 §7 check 4`,
    );
  }

  // Check 6: the final rendered prompt matches its recorded hash.
  const computedPromptHash = sha256Hex(trace.renderedPrompt);
  if (computedPromptHash !== trace.renderedPromptHash) {
    failures.push(
      'rendered prompt does not match its recorded hash (PRD-EPI-001 §7 check 6)',
    );
  }

  return { ok: failures.length === 0, failures };
}
