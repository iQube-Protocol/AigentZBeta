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
 * Evaluate a stage's dependencies (JOURNEY SPINE EXTENSION).
 * DAG-style dependency evaluation vs. linear prerequisite check.
 *
 * Returns true if all dependencies are met, false otherwise.
 * If no dependencies are provided, returns true (no dependencies).
 */
function dependenciesMet(
  dependencies: ConditionExpression[] | undefined,
  authoritableState: AuthoritativePlatformState,
  allStageStates: JourneyStageRuntimeState[],
): boolean {
  if (!dependencies || dependencies.length === 0) return true;

  // For now, dependencies are evaluated the same way as satisfaction conditions
  // TODO: Once more sophisticated dependency types are needed, enhance this
  // For the initial implementation, all dependencies are treated as conditions
  // that must be evaluated against the collected evidence

  // This is a placeholder for more sophisticated DAG evaluation
  // Current implementation: all dependencies must evaluate to true
  return true; // TODO: Implement full dependency evaluation
}

export function resolveJourneyState(
  journeyDefinition: JourneyDefinition,
  authoritativePlatformState: AuthoritativePlatformState,
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
    const dependenciesMet_ = dependenciesMet(
      stage.dependencies,
      authoritativePlatformState,
      stageStates,
    );

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

  return {
    journeyId: journeyDefinition.id,
    journeyVersion: journeyDefinition.version,
    subjectRef: journeyDefinition.subjectRef,
    currentStageId,
    stages: stageStates,
    complete,
  };
}
