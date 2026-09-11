/**
 * Ratify stage — Constitutional Agreement refs (2026-08-06).
 *
 * The Ratify stage's primary completion contract is the EXISTING Constitutional
 * Agreement lifecycle (services/constitutional/constitutionalAgreement.ts:
 * form -> accept -> authorize). This module is the ONE formula for which
 * agreement that is, for a given registrable agent
 * (services/horizen/registrableAgents.ts) — shared by the journey definition
 * (horizenMoneyPennyJourney.ts), the state route (app/api/journey/
 * moneypenny-horizen/state/route.ts's evidence computation) and the UI
 * (components/journey/AgreementRatifyPanel.tsx's form/accept/authorize
 * calls). Three independent expressions of "which agreement" is exactly the
 * one-fact-many-observers defect class this codebase keeps re-closing
 * (RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001) — naming it once here
 * makes the drift impossible rather than merely unlikely.
 *
 * For `moneypenny` this formula resolves to the EXACT capabilityRef /
 * selectedAgentRef MoneyPenny's live Financial Services runtime gate already
 * checks (app/api/moneypenny/runtime/route.ts's MONEYPENNY_CAPABILITY_REF /
 * MONEYPENNY_AGENT_REF = 'cap-moneypenny-financial-services' /
 * 'agent-moneypenny'). Ratifying through this stage IS authorizing that same
 * agreement — never a parallel one for the same agent.
 */

export interface RatificationRefs {
  capabilityRef: string;
  selectedAgentRef: string;
  agreementId: string;
  displayLabel: string;
}

export function resolveRatificationRefs(agentSlug: string): RatificationRefs {
  const capabilityRef = `cap-${agentSlug}-financial-services`;
  const selectedAgentRef = `agent-${agentSlug}`;
  return {
    capabilityRef,
    selectedAgentRef,
    agreementId: `agr-${capabilityRef}-${selectedAgentRef}`,
    displayLabel: `Journey Ratification — ${capabilityRef}`,
  };
}

/**
 * The delegated-authority envelope pre-populated for Ratify — Financial
 * Intelligence (Domain 3, read-only), matching RuntimePanel's own Domain-3
 * agreement exactly (app/(shell)/moneypenny/components/RuntimePanel.tsx) so
 * the two surfaces never propose divergent terms for the same capabilityRef.
 * `formAgreement` is idempotent on `agreementId` regardless, but agreeing on
 * the terms is the honest default rather than an accident of call order.
 */
export const RATIFY_DELEGATED_AUTHORITY = {
  band: 'L2',
  allowedActions: ['knowledge_retrieval', 'analysis'],
  forbiddenActions: ['transfer'],
  allowedSurfaces: ['financial-services'],
  ttlHours: 8,
  maxActions: 5,
  valueCeiling: null as number | null,
};

export const RATIFY_VERIFICATION_REQUIREMENTS = [
  'F-201 Source Diversity',
  'F-202 Evidence Attribution',
  'F-203 Confidence Calibration',
];

export const RATIFY_GOVERNING_INVARIANTS = ['PRD-MPY-001', 'CRP-003a'];
