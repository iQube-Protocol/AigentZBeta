/**
 * Governance Receipt Helper — Operation Chrysalis Phase 0A
 *
 * Thin wrapper around createActivityReceipt() that maps governance-specific
 * context (decisionId, decisionType, affectedRoles, affectedAssets,
 * authorityBasis, sovereigntyImpact) into the existing receipt input shape.
 *
 * Governance receipts flow through the same DVN pipeline as all other
 * activity receipts — no parallel infrastructure. The origin/child/grandchild
 * chain model applies: a governance decision that spawns downstream actions
 * inherits the chain via parentIntentId / rootIntentId enrichment.
 */

import {
  createActivityReceipt,
  type ActivityActionType,
  type ActivityReceiptRecord,
} from '@/services/receipts/activityReceiptService';
import type { SovereigntyImpact } from './governanceDecisionLog';
import type { ConstitutionalRoleId, AuthorityDomain } from './sovereignAgentRoles';

// ─── Governance receipt types ─────────────────────────────────────────────

export type GovernanceActionType = Extract<
  ActivityActionType,
  | 'governance_decision_ratified'
  | 'governance_decision_amended'
  | 'governance_authority_exercised'
  | 'governance_escalation_triggered'
>;

export interface GovernanceReceiptInput {
  personaId: string;
  sessionId?: string | null;
  intentId?: string | null;
  actionType: GovernanceActionType;
  decisionId: string;
  decisionType: string;
  affectedRoles: ConstitutionalRoleId[];
  affectedAssets: string[];
  authorityBasis: string;
  constitutionalBasis: string;
  escalationPath: string;
  sovereigntyImpact: SovereigntyImpact;
  summary: string;
}

// ─── Create governance receipt ────────────────────────────────────────────

export async function createGovernanceReceipt(
  input: GovernanceReceiptInput,
): Promise<ActivityReceiptRecord | null> {
  const impactLabel = `Me:${input.sovereigntyImpact.me} C:${input.sovereigntyImpact.c} Z:${input.sovereigntyImpact.z}`;

  return createActivityReceipt({
    personaId: input.personaId,
    sessionId: input.sessionId,
    intentId: input.intentId,
    activeCartridge: 'agentiq-os',
    actionType: input.actionType,
    summary: input.summary,
    agentsInvoked: input.affectedRoles,
    toolsUsed: [`decision:${input.decisionId}`, `type:${input.decisionType}`],
    iqubesUsed: input.affectedAssets,
    contextShared: [
      `authority:${input.authorityBasis}`,
      `constitutional-basis:${input.constitutionalBasis}`,
      `escalation-path:${input.escalationPath}`,
      `impact:${impactLabel}`,
    ],
    artifactsCreated: [`governance-decision:${input.decisionId}`],
    approvalsGranted: [],
  });
}
