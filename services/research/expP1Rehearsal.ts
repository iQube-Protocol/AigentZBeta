/**
 * EXP-P1 internal rehearsal runner — PRD-EPI-001 §7 execution layer.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT (operator ruling, 2026-09-07: "EXP-P1
 *    now has a frozen internal-pilot substrate. Update the experiment
 *    execution model so we can rehearse internally without weakening the
 *    registered confirmatory protocol.") ────────────────────────────────────
 *
 * The registered four-arm design (README.md,
 * `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/`):
 *   Arm A — Cold: task prompt only, no grounding material.
 *   Arm B — Full Runtime: IRL's live, per-task selection + orchestration.
 *   Arm C — Flattened Invariants: a FIXED, pre-registered slice, no live
 *           selection.
 *   Arm D — Expert Prose: externally authored (Austin's side), token-budget-
 *           matched to Arm C, fixed once, identical across all tasks.
 *
 * This runner exercises the REAL shape of that design — real retrieval (Arm B
 * via `buildInvariantSlice`, the actual production selection path; Arm C via
 * the frozen crystal's own committed `memberSnapshot`), real task loading,
 * real receipts, real persistence — against ONLY materials that genuinely
 * exist today:
 *   - the FROZEN `crystal-vP2` substrate (never mutated by this runner);
 *   - an IRL-authored PROVISIONAL task set (`PROVISIONAL_REHEARSAL_TASK_SET`
 *     below) — never the sealed, externally-authored held-out set Austin has
 *     not produced yet;
 *   - a fixed, IRL-authored PROVISIONAL Arm D prose placeholder — never
 *     Austin's externally-authored expert prose.
 *
 * It does NOT call a live model/judge — no judge-config, rubric, or model-
 * calling seam exists anywhere in this codebase for EXP-P1 (judge config +
 * rubric are explicitly Austin's deliverable per the registered protocol's
 * division of responsibility). Scoring here is MECHANICAL — keyword/id
 * coverage against a provisional, synthetic ground truth derived from the
 * frozen crystal's own content — mirroring the established precision/recall
 * convention `services/experiments/expP3.ts` (EXP-012) already uses for a
 * different experiment's mechanical harness, though THIS harness computes
 * recall only (never precision/F1) — see `RehearsalScoreMetric`. This is a
 * REHEARSAL of the pipeline's plumbing (task loading, arm construction,
 * retrieval, scoring, receipts, persistence), never a scientific result.
 *
 * ── INSTRUMENT-VALIDATION FINDINGS, 2026-09-07 (first rehearsal,
 *    `EXP-P1/execution-run/internal-rehearsal/2026-09-06T17:47:45.131Z`) ────
 *
 * The first rehearsal run surfaced a genuine instrument defect, not a
 * scientific result: Arm B's ONE up-front `buildInvariantSlice` call was
 * given `limit: members.length` — the frozen population's own size — which
 * defeats `buildInvariantSlice`'s standing-ranked TRUNCATION entirely (its
 * `.slice(0, limit)` becomes a no-op once `limit` ≥ the candidate pool). The
 * result: Arm B's `groundingInvariantIds` was the ENTIRE 63-member frozen
 * population, on every one of the 6 tasks, vs Arm C's genuine 25-member
 * (⌊63×0.4⌋) fixed slice. Since every task's ground-truth ids are themselves
 * drawn FROM the frozen population, an arm holding the whole population
 * recalls 100% BY CONSTRUCTION — Arm B's "B > C" scores were a mechanical
 * artifact of context QUANTITY, not evidence of runtime/selection value
 * (README §4's Arm B is "IRL's complete pipeline... per-task intent-scoped
 * SELECTION"; giving it everything is not selection, it is the absence of
 * selection). Fixed by splitting the single call into two — `available`
 * (the domain-filtered candidate pool, kept only as a diagnostic upper bound,
 * never used to ground a score) and `selected` (`buildInvariantSlice`'s own
 * UNMODIFIED default limit — the real, bounded, standing-ranked selection —
 * which now grounds Arm B's score). See `RehearsalArmTaskResult`'s three
 * invariant-id fields.
 *
 * The same run also surfaced two tasks (`rehearsal-003`, `rehearsal-005`)
 * whose keywords ('settlement'/'value', 'reserve') matched ZERO of the 63
 * frozen invariant statements — an empty `groundTruthInvariantIds` set that
 * `idRecallScore`'s defensive `groundTruthIds.length === 0 ? 0` branch was
 * silently reporting as a real "0% recall" score for every arm, indistinguishable
 * from an arm that had material to recall and failed to. Fixed by marking such
 * a task `scorable: false` with an explicit `unscorableReason`, retaining its
 * raw per-arm scores as diagnostics but excluding it from every aggregate —
 * see `RehearsalTaskResult.scorable` and `summarizeRehearsalRun`. The task
 * set's keywords are deliberately NOT edited to "fix" this — that would erase
 * the diagnostic rather than report it.
 *
 * Every run this module writes is `runExecutionDesignation: 'internal-
 * rehearsal'`, `confirmatoryEligible: false`, unconditionally — see
 * `recordExecutionRun`'s own refusal if a caller ever tried to claim
 * otherwise. It NEVER calls `recordExperimentRunLifecycle` (the EXPERIMENT-
 * level `designed -> protocol-ratified -> running -> ...` macro-transition) —
 * that transition is reserved for the real confirmatory execution, and
 * `protocol-ratified` cannot legally be reached yet (task-set, arm-config,
 * answer-key, judge-config, analysis-config, interpretation-table are all
 * still unfrozen — `deriveProtocolRatified`). A rehearsal run must never be
 * able to advance, or be read as advancing, that macro-lifecycle.
 *
 * Server-only.
 */

import { buildInvariantSlice } from '@/services/invariants/grounding';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { latestFrozenCrystalArtifact, recordExecutionRun } from '@/services/research/artifacts';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';
import type {
  ExecutionRunArtifact,
  RehearsalArmId,
  RehearsalArmSummary,
  RehearsalArmTaskResult,
  RehearsalRunSummary,
  RehearsalTaskResult,
  TaskSetProvenance,
} from '@/types/research';

export const REHEARSAL_ARM_LABELS: Record<RehearsalArmId, string> = {
  A: 'Cold',
  B: 'Full Runtime',
  C: 'Flattened Invariants',
  D: 'Expert Prose',
};

export interface RehearsalTaskDefinition {
  id: string;
  kind: 'recall' | 'derivation';
  prompt: string;
  /** Used to (a) select this task's provisional/synthetic ground-truth
   *  grounding set from the frozen crystal's `memberSnapshot` by substring
   *  match on `statement`, and (b) mechanically score Arm D's prose (which
   *  has no discrete invariant ids to compare against). Never the real
   *  held-out answer key Austin will author — this is a rehearsal fixture. */
  keywords: string[];
}

export interface ProvisionalTaskSet {
  id: string;
  provenance: TaskSetProvenance;
  tasks: RehearsalTaskDefinition[];
}

/**
 * A small, checked-in, IRL-authored PROVISIONAL task set — never the sealed
 * held-out set the confirmatory protocol requires. Exists so the rehearsal
 * harness has something real to load without inventing per-run content or
 * waiting on external materials. Marked `provenance: 'provisional'`
 * unconditionally; a caller may substitute `provenance: 'synthetic'` fixtures
 * instead (e.g. generated from the frozen crystal's own members) but may
 * never mark anything `'external-held-out'` — that provenance describes
 * materials this codebase has no way to construct.
 */
export const PROVISIONAL_REHEARSAL_TASK_SET: ProvisionalTaskSet = {
  id: 'EXP-P1/rehearsal-task-set-provisional-v1',
  provenance: 'provisional',
  tasks: [
    { id: 'rehearsal-001', kind: 'recall', prompt: 'What does the governed record say about risk?', keywords: ['risk'] },
    { id: 'rehearsal-002', kind: 'recall', prompt: 'What does the governed record say about custody?', keywords: ['custody'] },
    {
      id: 'rehearsal-003',
      kind: 'derivation',
      prompt: 'How does the governed record relate settlement to value?',
      keywords: ['settlement', 'value'],
    },
    { id: 'rehearsal-004', kind: 'recall', prompt: 'What does the governed record say about governance?', keywords: ['governance'] },
    { id: 'rehearsal-005', kind: 'recall', prompt: 'What does the governed record say about reserves?', keywords: ['reserve'] },
    {
      id: 'rehearsal-006',
      kind: 'derivation',
      prompt: 'How does the governed record relate compliance to disclosure?',
      keywords: ['compliance', 'disclosure'],
    },
  ],
};

/** Arm C is a genuine SUBSET, never the whole frozen population — mirrors the
 *  registered protocol's own ⊆40% collection-size guard (README §"Collection-
 *  size guard"). Sorted by id (the same deterministic order `memberSnapshot`
 *  already carries) so the fixed slice is stable across repeated rehearsals
 *  of the same frozen generation. */
const ARM_C_SLICE_FRACTION = 0.4;

function buildFixedArmCSlice(members: HashCoveredMember[]): HashCoveredMember[] {
  const cap = Math.max(1, Math.floor(members.length * ARM_C_SLICE_FRACTION));
  return [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, cap);
}

/** A FIXED, IRL-authored provisional prose placeholder — never Austin's
 *  externally-authored Arm D expert prose. Built once per run, identical
 *  across every task (mirrors the registered protocol's "fixed once at
 *  freeze; identical across all tasks" property for the real Arm D). Because
 *  the real Arm D is deliberately curated WITHOUT access to the invariant
 *  collection's decomposition, this placeholder carries no discrete
 *  invariant-id citations — it is scored by keyword coverage of its TEXT,
 *  never by an id-overlap check, exactly like the real arm's structural
 *  role. */
function buildProvisionalArmDProse(members: HashCoveredMember[]): string {
  const sample = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 5);
  const body = sample.map((m) => m.statement).join(' ');
  return (
    '[PROVISIONAL REHEARSAL PROSE — NOT Austin\'s Arm D — INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE] ' +
    body
  );
}

function keywordCoverageScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const hay = text.toLowerCase();
  const hits = keywords.filter((k) => hay.includes(k.toLowerCase())).length;
  return hits / keywords.length;
}

/** Invariant-id RECALL only — never precision, never F1 (see
 *  `RehearsalScoreMetric`'s own doc for why that gap matters: an
 *  over-broad `retrievedIds` set — e.g. the whole frozen population —
 *  recalls 100% of ANY ground truth drawn from that population BY
 *  CONSTRUCTION, which is precisely the confound the available/selected
 *  split above exists to prevent upstream of this function ever being
 *  called with an unbounded set again). Returns 0 for an empty
 *  `groundTruthIds` — a defensive divide-by-zero guard, NOT a scoring-
 *  specification decision; callers MUST treat that case as `scorable: false`
 *  and exclude it from aggregates rather than trust this 0 as a real score. */
function idRecallScore(retrievedIds: string[], groundTruthIds: string[]): number {
  if (groundTruthIds.length === 0) return 0;
  const retrieved = new Set(retrievedIds);
  const hits = groundTruthIds.filter((id) => retrieved.has(id)).length;
  return hits / groundTruthIds.length;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface RehearsalEligibility {
  eligible: boolean;
  reason?: string;
  frozenCrystalArtifactId: string | null;
  frozenCrystalContentHash: string | null;
}

/** Whether an internal rehearsal may run right now — a frozen `crystal-
 *  version` generation with `executionDesignation: 'internal-pilot'`, and
 *  nothing else. Never checks Track 2's own (slow, multi-signal) programme
 *  composition — the same "governed act eligibility is independent of slow
 *  composition" discipline `FreezeVP2InternalPilotAction.tsx` already
 *  established (CI-2026-09-07-GOVERNED-ACT-ELIGIBILITY-INDEPENDENT-OF-SLOW-COMPOSITION-001). */
export async function rehearsalEligibility(experimentId: string): Promise<RehearsalEligibility> {
  const frozen = await latestFrozenCrystalArtifact(experimentId);
  if (!frozen) {
    return { eligible: false, reason: 'no frozen crystal-version generation exists yet', frozenCrystalArtifactId: null, frozenCrystalContentHash: null };
  }
  if (frozen.executionDesignation !== 'internal-pilot') {
    return {
      eligible: false,
      reason: `'${frozen.id}' is frozen as '${frozen.executionDesignation ?? 'confirmatory'}' — internal rehearsal requires an 'internal-pilot' designated freeze`,
      frozenCrystalArtifactId: frozen.id,
      frozenCrystalContentHash: frozen.contentHash,
    };
  }
  if (!frozen.memberSnapshot || frozen.memberSnapshot.length === 0) {
    return {
      eligible: false,
      reason: `'${frozen.id}' has no persisted memberSnapshot — cannot construct arms without the frozen hash pre-image`,
      frozenCrystalArtifactId: frozen.id,
      frozenCrystalContentHash: frozen.contentHash,
    };
  }
  return { eligible: true, frozenCrystalArtifactId: frozen.id, frozenCrystalContentHash: frozen.contentHash };
}

export interface RunRehearsalResult {
  ok: boolean;
  error?: string;
  receiptId?: string | null;
  runId?: string;
  taskResults?: RehearsalTaskResult[];
  /** The FULL persisted execution-run artifact — the same shape
   *  `getExecutionRun`/`GET .../rehearsal?runId=` returns for a past run, so
   *  a caller (the UI's "copy as JSON" affordance) has ONE shape to work
   *  with regardless of whether the run just completed or is being looked
   *  up later. */
  run?: ExecutionRunArtifact;
}

/**
 * Run the internal rehearsal — real four-arm construction against the frozen
 * substrate, mechanically scored, persisted as `runExecutionDesignation:
 * 'internal-rehearsal'`, `confirmatoryEligible: false`, unconditionally. Never
 * mutates the frozen crystal artifact (read-only against it); never touches
 * `EXPERIMENT_LIFECYCLE`/`recordExperimentRunLifecycle`.
 */
export async function runExpP1Rehearsal(input: {
  personaId: string;
  experimentId: string;
  taskSet?: ProvisionalTaskSet;
}): Promise<RunRehearsalResult> {
  const eligibility = await rehearsalEligibility(input.experimentId);
  if (!eligibility.eligible || !eligibility.frozenCrystalArtifactId) {
    return { ok: false, error: eligibility.reason ?? 'internal rehearsal is not eligible right now' };
  }

  const frozen = await latestFrozenCrystalArtifact(input.experimentId);
  const members = frozen?.memberSnapshot ?? [];
  if (members.length === 0) {
    return { ok: false, error: `'${eligibility.frozenCrystalArtifactId}' has no persisted memberSnapshot` };
  }
  const memberIds = new Set(members.map((m) => m.id));

  const taskSet = input.taskSet ?? PROVISIONAL_REHEARSAL_TASK_SET;
  if (taskSet.provenance === 'external-held-out') {
    return {
      ok: false,
      error: `an internal rehearsal may never load an 'external-held-out' task set — that provenance describes materials this codebase cannot construct (the confirmatory protocol's sealed set, Austin's own deliverable)`,
    };
  }
  if (taskSet.tasks.length === 0) {
    return { ok: false, error: `task set '${taskSet.id}' has no tasks` };
  }

  const domain = crystalDomainForExperiment(input.experimentId)?.domain;

  // Arm B — AVAILABLE: the domain-filtered candidate pool this rehearsal's
  // up-front call can see, before any ranking/truncation — a diagnostic
  // upper bound ONLY, never used to ground a score (2026-09-07: this used to
  // be the ONLY call, with `limit: members.length` defeating truncation
  // entirely and silently grounding Arm B on the whole frozen population —
  // see this module's header). Constrained to ids that are ALSO members of
  // the FROZEN snapshot — the live table may have moved on since freeze (a
  // successor generation under construction), and Arm B must stay scoped to
  // the frozen substrate this run is against, never to whatever the live
  // table currently holds.
  const armBAvailableSlice = await buildInvariantSlice({ domains: domain ? [domain] : undefined, limit: members.length });
  const armBAvailableIds = armBAvailableSlice.items.map((i) => i.id).filter((id) => memberIds.has(id));

  // Arm B — SELECTED: the REGISTERED Arm B selection procedure actually
  // enforced — `buildInvariantSlice`'s own UNMODIFIED default limit
  // (standing-ranked, truncated), never overridden to the population size.
  // THIS is what grounds Arm B's score. Called ONCE (not per task):
  // buildInvariantSlice has no per-task free-text intent scoping in this
  // codebase today — every task shares the same domain-filtered,
  // standing-ranked slice, an honest simplification from the confirmatory
  // design's true per-task intent-scoped selection, which does not exist as
  // a callable function here.
  const armBSelectedSlice = await buildInvariantSlice({ domains: domain ? [domain] : undefined });
  const armBSelectedIds = armBSelectedSlice.items.map((i) => i.id).filter((id) => memberIds.has(id));

  // Arm C — AVAILABLE is the whole frozen population it was carved from;
  // SELECTED is the fixed, pre-registered slice.
  const armCAvailableIds = members.map((m) => m.id);
  const armCSlice = buildFixedArmCSlice(members);
  const armCSelectedIds = armCSlice.map((m) => m.id);

  // Arm D — fixed, IRL-authored provisional prose placeholder (never Austin's).
  const armDProse = buildProvisionalArmDProse(members);

  const taskResults: RehearsalTaskResult[] = taskSet.tasks.map((task) => {
    const groundTruthInvariantIds = members
      .filter((m) => task.keywords.some((k) => m.statement.toLowerCase().includes(k.toLowerCase())))
      .map((m) => m.id);
    const scorable = groundTruthInvariantIds.length > 0;
    const unscorableReason = scorable
      ? null
      : `no frozen invariant statement in '${eligibility.frozenCrystalArtifactId}' matched this task's keyword set (${task.keywords.join(', ')}) — nothing to score recall against; raw per-arm scores below are diagnostics only`;

    const armResults: RehearsalArmTaskResult[] = [
      {
        armId: 'A',
        armLabel: REHEARSAL_ARM_LABELS.A,
        availableInvariantIds: [],
        selectedInvariantIds: [],
        actuallyGroundedInvariantIds: [],
        scoreMetric: 'invariant-id-recall',
        score: idRecallScore([], groundTruthInvariantIds),
      },
      {
        armId: 'B',
        armLabel: REHEARSAL_ARM_LABELS.B,
        availableInvariantIds: armBAvailableIds,
        selectedInvariantIds: armBSelectedIds,
        actuallyGroundedInvariantIds: armBSelectedIds,
        scoreMetric: 'invariant-id-recall',
        score: idRecallScore(armBSelectedIds, groundTruthInvariantIds),
      },
      {
        armId: 'C',
        armLabel: REHEARSAL_ARM_LABELS.C,
        availableInvariantIds: armCAvailableIds,
        selectedInvariantIds: armCSelectedIds,
        actuallyGroundedInvariantIds: armCSelectedIds,
        scoreMetric: 'invariant-id-recall',
        score: idRecallScore(armCSelectedIds, groundTruthInvariantIds),
      },
      {
        armId: 'D',
        armLabel: REHEARSAL_ARM_LABELS.D,
        availableInvariantIds: [],
        selectedInvariantIds: [],
        actuallyGroundedInvariantIds: [],
        scoreMetric: 'keyword-substring-coverage',
        score: keywordCoverageScore(armDProse, task.keywords),
      },
    ];

    return { taskId: task.id, taskKind: task.kind, groundTruthInvariantIds, scorable, unscorableReason, armResults };
  });

  const recorded = await recordExecutionRun({
    personaId: input.personaId,
    experimentId: input.experimentId,
    runExecutionDesignation: 'internal-rehearsal',
    frozenCrystalArtifactId: eligibility.frozenCrystalArtifactId,
    frozenCrystalContentHash: eligibility.frozenCrystalContentHash,
    taskSetId: taskSet.id,
    taskSetProvenance: taskSet.provenance,
    armIds: ['A', 'B', 'C', 'D'],
    providerModel: 'deterministic-retrieval-v1',
    confirmatoryEligible: false,
    armDProvenance: 'provisional-irl-authored',
    armConfiguration: {
      armA: { description: 'Cold — no grounding material by protocol definition' },
      armB: {
        domain: domain ?? null,
        selectionProcedure:
          "buildInvariantSlice (services/invariants/grounding.ts) — its own unmodified default limit, standing-ranked, domain-filtered — never overridden to the frozen population size",
        availableSetSize: armBAvailableIds.length,
        selectedSetSize: armBSelectedIds.length,
      },
      armC: {
        sliceFraction: ARM_C_SLICE_FRACTION,
        fixedSliceSize: armCSelectedIds.length,
        frozenPopulationSize: members.length,
      },
      armD: { proseSampleSize: 5, provenance: 'provisional-irl-authored' },
    },
    scoringConfiguration: {
      'invariant-id-recall': 'hits / groundTruthInvariantIds.length — invariant-id retrieval RECALL only (no precision/F1 computed); applies to arms A/B/C',
      'keyword-substring-coverage':
        'keyword substring hits / task.keywords.length against a FIXED prose blob (arm D) — a text-coverage metric, NOT id-based, not comparable arm-for-arm with the invariant-id-recall metric',
      unscorableRule:
        'a task with an empty groundTruthInvariantIds set (no frozen invariant statement matched its keywords) is scorable:false and excluded from every aggregate; its raw per-arm scores are retained for diagnostics only',
    },
    taskResults,
  });
  if (!recorded.ok) return { ok: false, error: recorded.error };

  return { ok: true, receiptId: recorded.receiptId, runId: recorded.artifact?.id, taskResults, run: recorded.artifact };
}

/**
 * A proper rehearsal summary (2026-09-07 instrument-validation finding) —
 * derived entirely from `taskResults` at read time, never persisted
 * redundantly. See `RehearsalRunSummary`'s own doc for what each field means
 * and why unscorable tasks and the two score metrics are never blended.
 */
export function summarizeRehearsalRun(run: Pick<ExecutionRunArtifact, 'armIds' | 'taskResults'>): RehearsalRunSummary {
  const scored = run.taskResults.filter((t) => t.scorable);
  const unscorable = run.taskResults.filter((t) => !t.scorable);

  const perArm: RehearsalArmSummary[] = run.armIds.map((armId) => {
    let armLabel: string = armId;
    let scoreMetric: RehearsalArmTaskResult['scoreMetric'] = 'invariant-id-recall';
    const overall: number[] = [];
    const recall: number[] = [];
    const derivation: number[] = [];
    for (const task of scored) {
      const armResult = task.armResults.find((a) => a.armId === armId);
      if (!armResult) continue;
      armLabel = armResult.armLabel;
      scoreMetric = armResult.scoreMetric;
      overall.push(armResult.score);
      (task.taskKind === 'derivation' ? derivation : recall).push(armResult.score);
    }
    return {
      armId,
      armLabel,
      scoreMetric,
      meanScoreOverall: mean(overall),
      meanScoreRecall: mean(recall),
      meanScoreDerivation: mean(derivation),
    };
  });

  const firstArmB = run.taskResults[0]?.armResults.find((a) => a.armId === 'B');
  const firstArmC = run.taskResults[0]?.armResults.find((a) => a.armId === 'C');

  return {
    taskCounts: { total: run.taskResults.length, scored: scored.length, unscorable: unscorable.length },
    unscorableTaskIds: unscorable.map((t) => t.taskId),
    perArm,
    frozenPopulationSize: firstArmC?.availableInvariantIds.length ?? null,
    armBAvailableSetSize: firstArmB?.availableInvariantIds.length ?? null,
    armBSelectedSetSize: firstArmB?.selectedInvariantIds.length ?? null,
    armCFixedSliceSize: firstArmC?.selectedInvariantIds.length ?? null,
    instrumentCaveat:
      'INTERNAL REHEARSAL — INSTRUMENT VALIDATION ONLY, NOT A SCIENTIFIC RESULT. The task set is provisional/synthetic (never the sealed, externally-authored held-out set); Arm D prose is an IRL-authored placeholder (never Austin\'s externally-authored expert prose); no live judge/model exists in this codebase — every score is mechanical invariant-id recall or keyword-substring coverage. No cross-arm or cross-run comparison from this run may be read as evidence for or against any registered EXP-P1 hypothesis.',
  };
}
