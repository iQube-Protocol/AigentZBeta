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
} from '@/types/journey';

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
    const prerequisitesMet = stage.prerequisites.every((prereqId) => {
      const prereqStage = stageStates.find((s) => s.stageId === prereqId);
      return prereqStage?.state === 'COMPLETE';
    });

    if (isRefused) {
      state = 'REFUSED';
    } else if (missing.length === 0 && stage.completionEvidence.length > 0) {
      /*
       * ESTABLISHED COMPLETION EVIDENCE PRECEDES PREREQUISITE GATING
       * (Horizen Journey correction, 2026-08-09).
       *
       * "Would this stage be available to begin from scratch today?" and "has
       * this stage's own ceremony already happened?" are different questions.
       * Prerequisites answer the first — they govern entry into a stage that
       * has NOT yet completed. They must never answer the second by erasing a
       * historically-established completion.
       *
       * THE DEFECT THIS CLOSES: inserting Orient between Claim and Passport
       * (services/journey/horizenMoneyPennyJourney.ts) added a NEW prerequisite
       * to Passport's chain. Nakamoto's Passport/Delegate/aigentMe/Ratify/
       * Ingest stages all carry real, pre-existing canonical completion
       * evidence that predates Orient's introduction. Under the old ordering
       * (prerequisite check before evidence check), every one of those stages
       * rendered BLOCKED the moment Orient's own evidence was absent — a
       * journey-definition evolution visually un-completing constitutional
       * facts that were never invalidated. See
       * tests/journey-orient-legacy-regression.test.ts's "REPRODUCES THE
       * DEFECT" canary for the pinned pre-fix behaviour.
       */
      state = 'COMPLETE';
    } else if (!prerequisitesMet) {
      state = 'BLOCKED';
    } else if (present.length > 0) {
      state = 'IN_PROGRESS';
    } else if (priorStagesAllComplete) {
      state = 'READY';
    } else {
      state = 'NOT_STARTED';
    }

    if (state !== 'COMPLETE') {
      priorStagesAllComplete = false;
    } else {
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
    const firstIncomplete = stageStates.find((s) => s.state !== 'COMPLETE');
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
