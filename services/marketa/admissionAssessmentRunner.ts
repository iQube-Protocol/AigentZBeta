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
  type MarketaAdmissionAssessmentRecord,
} from './admissionAssessmentStore';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export interface RunMarketaAdmissionAssessmentInput {
  aigentQubeId: string;
  actorPersonaId: string;
  agentCardUrl: string;
  mode: MarketaAdmissionMode;
}

export type RunMarketaAdmissionAssessmentResult =
  | { ok: true; record: MarketaAdmissionAssessmentRecord }
  | { ok: false; refusalCode: 'AIGENTQUBE_NOT_FOUND'; detail: string };

export async function runMarketaAdmissionAssessment(
  input: RunMarketaAdmissionAssessmentInput,
  deps: AssembleEvidenceDeps = {},
): Promise<RunMarketaAdmissionAssessmentResult> {
  const evidenceResult = await assembleExternalAgentAdmissionEvidence(
    { aigentQubeId: input.aigentQubeId, actorPersonaId: input.actorPersonaId, agentCardUrl: input.agentCardUrl },
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
