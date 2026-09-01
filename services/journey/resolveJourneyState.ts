/**
 * Guided Journey Runtime — authoritative state resolver (PRD-GJR-001 §9).
 *
 * Pure, deterministic, no I/O. Journey Guidance Principle (§5.1): a stage is
 * COMPLETE only when every one of its `completionEvidence` fields is present
 * and truthy in the caller-supplied AuthoritativePlatformState — never from
 * client navigation or a click. Callers assemble that state from real reads
 * (Agent Card fetch, receipts query, passport/delegation services) and pass
 * it in; this function never fetches anything itself, so it can't be fooled
 * by a stale or partial read pretending to be current.
 *
 * One-State Principle (§5.3): the journey bar, stage viewport and Companion
 * all derive from THIS resolver's output — never from three independent
 * "is this stage done" checks that could disagree.
 */

import type {
  JourneyDefinition,
  JourneyRuntimeState,
  JourneyStageRuntimeState,
  JourneyStageState,
  ConditionExpression,
} from '@/types/journey';
import { evaluateCondition } from './conditionEvaluator';
import type { AuthoritativePlatformState as ConditionEvaluatorState } from './conditionEvaluator';

/**
 * Per-stage evidence, keyed by the stage's own `completionEvidence` field
 * names (services/journey/horizenMoneyPennyJourney.ts). A field absent from
 * the record, or present but falsy/null, counts as missing evidence — it is
 * never assumed complete by omission.
 */
export type StageEvidenceRecord = Record<string, boolean | string | number | null | undefined>;

export interface AuthoritativePlatformState {
  /** Keyed by stage id. */
  stages: Record<string, StageEvidenceRecord | undefined>;
  /** Optional: receipt refs already recorded, keyed by ActivityActionType. */
  receiptRefs?: Record<string, string[]>;
  /** True if any refusal is currently blocking progress; see §12.3/§16. */
  refusal?: { stageId: string; reason: string };
}

function evidencePresence(
  requiredFields: string[],
  evidence: StageEvidenceRecord | undefined,
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const field of requiredFields) {
    const value = evidence?.[field];
    if (value !== undefined && value !== null && value !== false && value !== '') {
      present.push(field);
    } else {
      missing.push(field);
    }
  }
  return { present, missing };
}

/**
 * Evaluate a stage's satisfaction condition (JOURNEY SPINE EXTENSION).
 * Maps the condition to authoritative state using the condition evaluator.
 *
 * Returns true if the condition is satisfied, false otherwise.
 * If no condition is provided, returns true (unconditionally satisfied).
 *
 * Converts the AuthoritativePlatformState format to what the condition
 * evaluator expects (settledFacts + receiptsByType).
 */
function satisfactionConditionMet(
  condition: ConditionExpression | undefined,
  authoritableState: AuthoritativePlatformState,
  stageEvidenceRecord: StageEvidenceRecord | undefined,
): boolean {
  if (!condition) return true; // No condition = always satisfied

  // Build condition evaluator state from evidence record
  // Convert evidence fields to receipt presence
  const conditionState: ConditionEvaluatorState = {
    settledFacts: {},
    receiptsByType: {},
  };

  // Map evidence fields to receipt existence (present = true)
  if (stageEvidenceRecord) {
    for (const [key, value] of Object.entries(stageEvidenceRecord)) {
      if (value !== undefined && value !== null && value !== false && value !== '') {
        conditionState.receiptsByType[key] = true;
      }
    }
  }

  // TODO: Also map settledFacts once that infrastructure is available
  // For now, the condition evaluator will only see receipts from evidence

  try {
    return evaluateCondition(condition, conditionState);
  } catch (err) {
    // If condition evaluation fails, treat as not yet satisfied
    // (not as a blocker or error — the evidence may still be arriving)
    console.warn(`condition evaluation failed for stage:`, err);
    return false;
  }
}

/**
 * Flattens EVERY stage's evidence record into one global receipts map
 * (a key counts as present if truthy under ANY stage) for evaluating
 * conditions that may reference facts outside the declaring stage's own
 * namespace — e.g. a dependency naming a settled fact/receipt another
 * stage's evidence carries. No live journey does this yet (grep confirms
 * every `dependencies:` declaration today is `[]`), but `dependenciesMet`
 * below (XP-1, AEE-XP-001 §6) is the first REAL consumer, so a
 * single-stage-scoped view would be wrong the moment one is declared.
 */
function toConditionEvaluatorState(
  authoritativePlatformState: AuthoritativePlatformState,
): ConditionEvaluatorState {
  const conditionState: ConditionEvaluatorState = { settledFacts: {}, receiptsByType: {} };
  for (const evidence of Object.values(authoritativePlatformState.stages)) {
    if (!evidence) continue;
    for (const [key, value] of Object.entries(evidence)) {
      if (value !== undefined && value !== null && value !== false && value !== '') {
        conditionState.receiptsByType[key] = true;
      }
    }
  }
  return conditionState;
}

/**
 * Evaluate a stage's dependencies (JOURNEY SPINE EXTENSION, made real for
 * XP-1 — AEE-XP-001 §6). DAG-style dependency evaluation vs. linear
 * prerequisite check: every declared `ConditionExpression` must evaluate
 * true against the FULL authoritative platform state (not just this
 * stage's own evidence — a dependency may reference another stage's
 * evidence namespace). Evaluation failure (malformed expression) is
 * treated as not-yet-satisfied, mirroring `satisfactionConditionMet`'s own
 * fail-closed discipline — never a blocker crash, never a fabricated pass.
 */
function dependenciesMet(
  dependencies: ConditionExpression[] | undefined,
  authoritativePlatformState: AuthoritativePlatformState,
): boolean {
  if (!dependencies || dependencies.length === 0) return true;
  const conditionState = toConditionEvaluatorState(authoritativePlatformState);
  return dependencies.every((dep) => {
    try {
      return evaluateCondition(dep, conditionState);
    } catch (err) {
      console.warn('dependency evaluation failed for stage:', err);
      return false;
    }
  });
}

/**
 * DAG-correct reachability (XP-1, AEE-XP-001 §6) — independent of the
 * legacy linear `state==='READY'` computation above (see
 * `JourneyRuntimeState.reachableStageIds`'s own doc comment in
 * types/journey.ts for why). A stage is reachable when: it is not already
 * COMPLETE; every `prerequisites` entry is COMPLETE (an `optional`
 * prerequisite is exempt, mirroring `prerequisitesMet` above); its
 * `dependencies` are met; and — if it declares `activationBranch` — that
 * branch is present in `activatedBranches`. Order matches the journey's own
 * declared stage order, so `nextStageId` (the first reachable id) is
 * deterministic and matches "what a visitor would naturally reach next."
 *
 * FOCUS RULE, once any branch is activated: the reachable set narrows to
 * ONLY that branch's own stages — the always-open ambient stages (home,
 * view, orient, choose, ...) drop out. Without this, "home" (no
 * prerequisites, never gates) would always sort first by declared array
 * order and permanently outrank a just-activated branch's own first stage,
 * which defeats the entire point of declaring an intent. A visitor who
 * has said "I want Financial Services" is asking to be guided through
 * THAT branch, not offered the same ambient narrative pages available
 * before they said anything.
 */
export function computeJourneyReachability(
  journeyDefinition: JourneyDefinition,
  stageStates: JourneyStageRuntimeState[],
  activatedBranches: Record<string, string> | undefined,
  authoritativePlatformState: AuthoritativePlatformState,
): { reachableStageIds: string[]; nextStageId: string | null } {
  const stateById = new Map(stageStates.map((s) => [s.stageId, s]));
  const anyBranchActivated = !!activatedBranches && Object.keys(activatedBranches).length > 0;
  const reachableStageIds: string[] = [];

  for (const stage of journeyDefinition.stages) {
    const runtime = stateById.get(stage.id);
    if (!runtime || runtime.state === 'COMPLETE') continue;
    if (stage.activationBranch) {
      if (!activatedBranches?.[stage.activationBranch]) continue; // still dormant
    } else if (anyBranchActivated) {
      continue; // focused on the activated branch — ambient stages step aside
    }

    const prerequisitesMet = stage.prerequisites.every((prereqId) => {
      const prereqDefinition = journeyDefinition.stages.find((s) => s.id === prereqId);
      if (prereqDefinition?.requirement === 'optional') return true;
      return stateById.get(prereqId)?.state === 'COMPLETE';
    });
    if (!prerequisitesMet) continue;
    if (!dependenciesMet(stage.dependencies, authoritativePlatformState)) continue;

    reachableStageIds.push(stage.id);
  }

  return { reachableStageIds, nextStageId: reachableStageIds[0] ?? null };
}

export function resolveJourneyState(
  journeyDefinition: JourneyDefinition,
  authoritativePlatformState: AuthoritativePlatformState,
  activatedBranches?: Record<string, string>,
): JourneyRuntimeState {
  const stageStates: JourneyStageRuntimeState[] = [];
  let currentStageId = journeyDefinition.stages[0]?.id ?? '';
  let priorStagesAllComplete = true;

  for (const stage of journeyDefinition.stages) {
    const evidence = authoritativePlatformState.stages[stage.id];
    const { present, missing } = evidencePresence(stage.completionEvidence, evidence);

    let state: JourneyStageState;
    const isRefused = authoritativePlatformState.refusal?.stageId === stage.id;

    /*
     * JOURNEY SPINE EXTENSION: evaluate satisfactionCondition ONLY when the
     * stage actually declares one. `satisfactionConditionMet(undefined, ...)`
     * returns `true` (its OWN doc comment: "No condition = always satisfied")
     * — that is correct for a condition-evaluator asked "is this condition
     * satisfied", but WRONG to feed into `satisfactionMet` below, which is
     * OR'd against the evidence-based check. Every stage across every
     * existing journey (Horizen, Validation Programme, KNYTS/CI Bridge) that
     * never declares a satisfactionCondition would otherwise resolve
     * `satisfactionMet = true` unconditionally, short-circuiting the OR and
     * marking the stage COMPLETE with zero evidence the moment any receipt
     * arrived anywhere in the journey. Caught 2026-08-24 by
     * tests/validation-programme-journey.test.ts (47 failures across the
     * existing journey suite) when this file's Ian-journey changes were
     * exercised against the FULL test suite for the first time — a
     * regression from the original Journey Spine Stage 1 pass, not
     * introduced by this fix. "Fall back to evidence-based completion" must
     * mean defer to it, not silently outrank it.
     */
    const satisfactionMet = stage.satisfactionCondition
      ? satisfactionConditionMet(stage.satisfactionCondition, authoritativePlatformState, evidence)
      : false;

    // Evaluate prerequisites (existing logic), extended for JS-LAW-002:
    // "A step may block another step only where the underlying constitutional,
    // operational, or evidentiary dependency genuinely requires it. Optional
    // agent delegation must not block direct human artifact upload merely
    // because the UI previously presented delegation first." A prerequisite
    // stage DECLARED optional (`requirement: 'optional'`) never blocks its
    // dependent, regardless of whether that optional stage itself has been
    // completed or skipped — the dependent only waits on prerequisites that
    // are themselves required.
    const prerequisitesMet = stage.prerequisites.every((prereqId) => {
      const prereqDefinition = journeyDefinition.stages.find((s) => s.id === prereqId);
      if (prereqDefinition?.requirement === 'optional') return true;
      const prereqStage = stageStates.find((s) => s.stageId === prereqId);
      return prereqStage?.state === 'COMPLETE';
    });

    // JOURNEY SPINE EXTENSION: Evaluate dependencies alongside prerequisites
    const dependenciesMet_ = dependenciesMet(stage.dependencies, authoritativePlatformState);

    if (isRefused) {
      state = 'REFUSED';
    } else if (
      satisfactionMet ||
      (missing.length === 0 && stage.completionEvidence.length > 0)
    ) {
      /*
       * ESTABLISHED COMPLETION EVIDENCE PRECEDES PREREQUISITE GATING
       * (Horizen Journey correction, 2026-08-09, extended for Journey Spine).
       *
       * "Would this stage be available to begin from scratch today?" and "has
       * this stage's own ceremony already happened?" are different questions.
       * Prerequisites/dependencies answer the first — they govern entry into a
       * stage that has NOT yet completed. They must never answer the second by
       * erasing a historically-established completion.
       *
       * JOURNEY SPINE: satisfactionCondition takes precedence if it exists,
       * allowing evolving journeys to change completion criteria. If no
       * satisfactionCondition, fall back to evidence-based completion (existing
       * behavior for backward compatibility).
       */
      state = 'COMPLETE';
    } else if (!prerequisitesMet || !dependenciesMet_) {
      state = 'BLOCKED';
    } else if (present.length > 0 || satisfactionMet) {
      state = 'IN_PROGRESS';
    } else if (priorStagesAllComplete) {
      state = 'READY';
    } else {
      state = 'NOT_STARTED';
    }

    // JS-LAW-002, applied to the sequential READY gate too: an OPTIONAL
    // stage that was never completed (skipped) must not permanently starve
    // every later stage of READY, or "optional" would functionally mean
    // "disabled" the moment it's skipped rather than genuinely bypassed.
    if (state !== 'COMPLETE' && stage.requirement !== 'optional') {
      priorStagesAllComplete = false;
    } else if (state === 'COMPLETE') {
      currentStageId = stage.nextStageId ?? stage.id;
    }

    stageStates.push({
      stageId: stage.id,
      state,
      evidencePresent: present,
      evidenceMissing: missing,
      receiptRefs: stage.receiptTypes.flatMap(
        (type) => authoritativePlatformState.receiptRefs?.[type] ?? [],
      ),
      refusalReason: isRefused ? authoritativePlatformState.refusal?.reason : undefined,
    });
  }

  const complete = stageStates.length > 0 && stageStates.every((s) => s.state === 'COMPLETE');
  if (!complete) {
    /*
     * JS-LAW-002, applied to the final currentStageId fallback (OCSGA Bridge
     * projection fix, 2026-08-29). A naive "first stage that isn't COMPLETE"
     * search picks up a skipped OPTIONAL stage (e.g. delegation-establish)
     * purely because it sits earlier in array order than the real current
     * REQUIRED stage — even though the loop above already treats that same
     * optional stage as non-blocking for prerequisites and priorStagesAllComplete.
     * That mismatch made the projection report the optional stage as
     * "current" while every required stage past it (deposit, freeze, sign)
     * had already progressed further — for Ian's OCSGA exchange this
     * rendered the generic delegation shell instead of the Reciprocal
     * Artifact Exchange workspace he actually needed. Skipping optional,
     * not-completed stages here mirrors the exemption already applied to
     * `prerequisitesMet`/`priorStagesAllComplete` above — never a new rule.
     */
    const firstIncomplete = stageStates.find((s) => {
      if (s.state === 'COMPLETE') return false;
      const stageDefinition = journeyDefinition.stages.find((st) => st.id === s.stageId);
      return stageDefinition?.requirement !== 'optional';
    });
    if (firstIncomplete) currentStageId = firstIncomplete.stageId;
  }

  const reachability = computeJourneyReachability(
    journeyDefinition,
    stageStates,
    activatedBranches,
    authoritativePlatformState,
  );

  return {
    journeyId: journeyDefinition.id,
    journeyVersion: journeyDefinition.version,
    subjectRef: journeyDefinition.subjectRef,
    currentStageId,
    stages: stageStates,
    complete,
    ...(activatedBranches ? { activatedBranches } : {}),
    reachableStageIds: reachability.reachableStageIds,
    nextReachableStageId: reachability.nextStageId,
  };
}
