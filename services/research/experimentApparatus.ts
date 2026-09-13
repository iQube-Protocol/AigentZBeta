/**
 * experimentApparatus — a generalized, read-only projection of an
 * experiment's frozen artifacts + execution runs (PRD-EPI-001 §2/§7) for
 * rendering inside the Workspace → Experiments dossier (2026-09-11, "stop
 * treating Experiments as navigation").
 *
 * GENERALIZED, NEVER EXPERIMENT-SPECIFIC: this composes `listArtifacts` /
 * `listExecutionRuns` (services/research/artifacts.ts) for WHATEVER
 * `experimentId` is passed — it names no 'EXP-P1' literal and produces the
 * same shape for any experiment that has frozen artifacts/execution runs.
 * EXP-P1 (63-member Crystal vP2, Arms A–D, `task-scoped-v1`, v4 rehearsal)
 * simply happens to be the richest existing subject.
 *
 * T2-SAFE BY CONSTRUCTION: every field returned already lives on
 * `FrozenArtifact`/`ExecutionRunArtifact` (types/research.ts), neither of
 * which carries a personaId or any other T0 identifier — `signedBy` is a T2
 * ref array. `memberSnapshot` (the Crystal's hash pre-image, potentially
 * dozens of full statements) is deliberately reduced to a COUNT here; a
 * dossier viewer needs "63 members, this hash" for readiness/apparatus
 * inspection, not a full corpus dump through a summary panel — the full
 * corpus is what `contentHash`/`commitmentHash` already commit to.
 *
 * AUTHORIZATION IS APPLIED BY THE CALLER (the route), never here — this is a
 * pure composition over already-persisted rows, exactly like
 * `readinessDashboard.ts`'s own `buildReadinessDashboard`, which this
 * function is a sibling to (same inputs, apparatus-detail framing instead of
 * a green/amber/red gate summary).
 *
 * Server-only.
 */

import { listArtifacts, listExecutionRuns } from '@/services/research/artifacts';
import type { ExecutionRunArtifact, FrozenArtifact } from '@/types/research';

export interface ApparatusFrozenArtifact {
  id: string;
  kind: FrozenArtifact['kind'];
  lifecycle: FrozenArtifact['lifecycle'];
  contentHash: string | null;
  commitmentHash: string | null;
  frozenAt: string | null;
  signedBy: string[];
  receiptId: string | null;
  executionDesignation: FrozenArtifact['executionDesignation'] | null;
  freezeRationale: string | null;
  /** Count only — see module header for why the full member list never
   *  travels through this projection. */
  memberCount: number | null;
  scientificDeviations: { checkName: string; measuredDetail: string; rationale: string }[];
}

export interface ApparatusExecutionRun {
  id: string;
  lifecycle: FrozenArtifact['lifecycle'];
  runExecutionDesignation: ExecutionRunArtifact['runExecutionDesignation'];
  confirmatoryEligible: boolean;
  frozenCrystalArtifactId: string;
  frozenCrystalContentHash: string | null;
  taskSetId: string;
  taskSetProvenance: ExecutionRunArtifact['taskSetProvenance'];
  armIds: ExecutionRunArtifact['armIds'];
  providerModel: string;
  armDProvenance: string;
  executionConfiguration: Record<string, unknown> | null;
  frozenAt: string | null;
  lastCheckpointedAt: string | null;
  /** Per-task outcome tally — e.g. `{ completed: 12, timed_out: 2 }` — the
   *  honest per-call outcome distribution (`RehearsalExecutionOutcome`),
   *  never collapsed into a single pass/fail bit. `[]` when a run predates
   *  the outcome-taxonomy field or carries no task results yet. */
  outcomeTally: Record<string, number>;
  taskCount: number;
  expectedTaskCount: number | null;
}

export interface ExperimentApparatus {
  experimentId: string;
  frozenArtifacts: ApparatusFrozenArtifact[];
  executionRuns: ApparatusExecutionRun[];
}

export async function resolveExperimentApparatus(experimentId: string): Promise<ExperimentApparatus> {
  const [artifacts, runs] = await Promise.all([listArtifacts(experimentId), listExecutionRuns(experimentId)]);

  const frozenArtifacts: ApparatusFrozenArtifact[] = artifacts.map((a) => ({
    id: a.id,
    kind: a.kind,
    lifecycle: a.lifecycle,
    contentHash: a.contentHash,
    commitmentHash: a.commitmentHash,
    frozenAt: a.frozenAt,
    signedBy: a.signedBy,
    receiptId: a.receiptId,
    executionDesignation: a.executionDesignation ?? null,
    freezeRationale: a.freezeRationale ?? null,
    memberCount: a.memberSnapshot ? a.memberSnapshot.length : null,
    scientificDeviations: (a.scientificDeviations ?? []).map((d) => ({
      checkName: d.checkName,
      measuredDetail: d.measuredDetail,
      rationale: d.rationale,
    })),
  }));

  const executionRuns: ApparatusExecutionRun[] = runs.map((r) => {
    const outcomeTally: Record<string, number> = {};
    for (const t of r.taskResults ?? []) {
      for (const armResult of t.armResults ?? []) {
        const outcome = (armResult as unknown as { executionOutcome?: string }).executionOutcome;
        if (typeof outcome === 'string') outcomeTally[outcome] = (outcomeTally[outcome] ?? 0) + 1;
      }
    }
    return {
      id: r.id,
      lifecycle: r.lifecycle,
      runExecutionDesignation: r.runExecutionDesignation,
      confirmatoryEligible: r.confirmatoryEligible,
      frozenCrystalArtifactId: r.frozenCrystalArtifactId,
      frozenCrystalContentHash: r.frozenCrystalContentHash,
      taskSetId: r.taskSetId,
      taskSetProvenance: r.taskSetProvenance,
      armIds: r.armIds,
      providerModel: r.providerModel,
      armDProvenance: r.armDProvenance,
      executionConfiguration: r.executionConfiguration,
      frozenAt: r.frozenAt,
      lastCheckpointedAt: r.lastCheckpointedAt,
      outcomeTally,
      taskCount: r.taskResults?.length ?? 0,
      expectedTaskCount: r.expectedTaskIds?.length ?? null,
    };
  });

  return { experimentId, frozenArtifacts, executionRuns };
}
