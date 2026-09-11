/**
 * Marketa admission-assessment orchestrator (GJR-MKT-001 Phase 4) — the one
 * place that composes: evidence assembly (Phase 3) -> the deterministic
 * rule engine (Phase 4) -> supersede-aware persistence -> receipts.
 *
 * "Recommendation Is Not Authority" and "Do not issue `recommended` for a
 * draft assessment" (§12): the rule engine can only ever produce
 * `RECOMMENDED` in FINAL mode by construction (DRAFT resolves to
 * DRAFT_ELIGIBLE/DRAFT_BLOCKED/QUARANTINED only) — the assertion below is a
 * defensive second layer, not the only guard.
 */

import { assembleExternalAgentAdmissionEvidence, type AssembleEvidenceDeps } from './externalAgentAdmissionEvidence';
import { assessExternalAgentAdmission, type MarketaAdmissionMode, type MarketaAdmissionAssessment } from './admissionAssessmentEngine';
import {
  createMarketaAdmissionAssessment,
  getCurrentMarketaAdmissionAssessment,
  checkMarketaAssessmentStoreAvailable,
  type MarketaAdmissionAssessmentRecord,
} from './admissionAssessmentStore';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export interface RunMarketaAdmissionAssessmentInput {
  aigentQubeId: string;
  actorPersonaId: string;
  agentCardUrl: string;
  mode: MarketaAdmissionMode;
  /** The runtime agent id the control proof was recorded against — see AssembleEvidenceInput.runtimeAgentId. */
  runtimeAgentId: string;
}

export type RunMarketaAdmissionAssessmentResult =
  | { ok: true; record: MarketaAdmissionAssessmentRecord }
  | { ok: false; refusalCode: 'AIGENTQUBE_NOT_FOUND' | 'MARKETA_ASSESSMENT_STORE_UNAVAILABLE'; detail: string };

export async function runMarketaAdmissionAssessment(
  input: RunMarketaAdmissionAssessmentInput,
  deps: AssembleEvidenceDeps = {},
): Promise<RunMarketaAdmissionAssessmentResult> {
  /*
   * A LOCAL PREREQUISITE IS CHECKED LOCALLY, BEFORE ANY WORK IS DONE
   * (operator, 2026-08-03 — found live: `agent_control_proven` was written
   * five times for Nakamoto while `marketa_agent_admission_assessments` was
   * absent from this deployment's schema, and `getCurrentMarketaAdmissionAssessment`
   * threw on every attempt, after evidence assembly and before Marketa ever
   * wrote a single receipt. Same shape as `checkAuthorizationStoreAvailable`
   * on the Verify path earlier the same day — checked here first so the
   * refusal names its cause instead of throwing through the caller.
   */
  const storeState = await checkMarketaAssessmentStoreAvailable();
  if (!storeState.available) {
    /*
     * THE OPERATOR'S EXACT ACCEPTANCE SHAPE (2026-08-03):
     *
     *   MARKETA_ASSESSMENT_STORE_UNAVAILABLE
     *   Migration required: <migration name>
     *   Claim control proof preserved
     *   Safe next act: apply migration and resume assessment
     *
     * Stated explicitly rather than implied: the wallet-control proof this
     * call was invoked WITH (or any prior one) is untouched by this refusal —
     * nothing here rolls it back, invalidates it, or asks for it again. The
     * caller resumes by re-running THIS SAME call once the store answers;
     * the control proof is read from existing evidence, not re-signed.
     */
    return {
      ok: false,
      refusalCode: 'MARKETA_ASSESSMENT_STORE_UNAVAILABLE',
      detail:
        `MARKETA_ASSESSMENT_STORE_UNAVAILABLE (${storeState.kind}). ` +
        `Migration required: 20260930000600_marketa_agent_admission_assessments.sql. ` +
        `Claim control proof preserved — nothing here undoes it, and none is requested again. ` +
        `Safe next act: apply the migration and resume assessment. ${storeState.detail}. Remedy: ${storeState.remedy}`,
    };
  }

  const evidenceResult = await assembleExternalAgentAdmissionEvidence(
    {
      aigentQubeId: input.aigentQubeId,
      actorPersonaId: input.actorPersonaId,
      agentCardUrl: input.agentCardUrl,
      runtimeAgentId: input.runtimeAgentId,
    },
    deps,
  );
  if (!evidenceResult.ok) {
    return { ok: false, refusalCode: evidenceResult.refusalCode, detail: evidenceResult.detail };
  }

  const assessment: MarketaAdmissionAssessment = assessExternalAgentAdmission(evidenceResult.evidence, input.mode);
  if (input.mode === 'DRAFT' && assessment.decision === 'RECOMMENDED') {
    throw new Error('Invariant violation: a DRAFT-mode assessment produced RECOMMENDED — this must never happen.');
  }

  const prior = await getCurrentMarketaAdmissionAssessment(input.aigentQubeId);
  const assessmentId = `marketa-admission-${input.aigentQubeId}-${evidenceResult.evidenceSnapshotHash.slice(0, 16)}`;

  const commonReceiptInput = {
    personaId: input.actorPersonaId,
    activeCartridge: 'agentiq' as const,
    agentsInvoked: [input.aigentQubeId],
    actionInput: {
      aigentQubeId: input.aigentQubeId,
      assessmentId,
      mode: assessment.mode,
      decision: assessment.decision,
      policyVersion: assessment.policyVersion,
      evidenceSnapshotHash: evidenceResult.evidenceSnapshotHash,
      satisfiedRules: assessment.satisfiedRules,
      missingRules: assessment.missingRules,
      failedRules: assessment.failedRules,
    },
  };

  const assessedReceipt = await createActivityReceipt({
    ...commonReceiptInput,
    actionType: 'marketa_eligibility_assessed',
    summary: `Marketa ${assessment.mode} assessment for ${input.aigentQubeId}: ${assessment.decision}`,
  });

  if (assessment.decision === 'RECOMMENDED') {
    await createActivityReceipt({
      ...commonReceiptInput,
      actionType: 'marketa_eligibility_recommended',
      summary: `Marketa recommends ${input.aigentQubeId} for Polity-bound Delegate admission`,
    });
  } else if (assessment.decision === 'REFUSED') {
    await createActivityReceipt({
      ...commonReceiptInput,
      actionType: 'marketa_eligibility_refused',
      summary: `Marketa refused ${input.aigentQubeId}'s admission assessment: ${assessment.rationale}`,
    });
  } else if (assessment.decision === 'QUARANTINED') {
    await createActivityReceipt({
      ...commonReceiptInput,
      actionType: 'marketa_eligibility_quarantined',
      summary: `Marketa quarantined ${input.aigentQubeId}'s admission assessment: ${assessment.rationale}`,
    });
  }

  const record = await createMarketaAdmissionAssessment({
    assessmentId,
    subjectAigentQubeId: input.aigentQubeId,
    assessment: { ...assessment, evidenceSnapshotHash: evidenceResult.evidenceSnapshotHash } as MarketaAdmissionAssessment & { evidenceSnapshotHash: string },
    actorPersonaId: input.actorPersonaId,
    receiptRef: assessedReceipt?.id ?? null,
    supersedesAssessmentId: prior && prior.assessmentId !== assessmentId ? prior.assessmentId : null,
  });

  return { ok: true, record };
}
