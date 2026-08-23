/**
 * MoneyPenny Financial Services Runtime — eligibility (Phase 3, Stage 3.1;
 * rewritten in the 2026-08-23 repair pass, Repair B/F).
 *
 * A PURE decision function over an already-resolved
 * `FinancialServiceAgentContext` (`services/financialServices/
 * agentEligibilityContext.ts`) — it performs NO reads of its own. This is the
 * Repair F correction: admission/delegation/verification/Standing are
 * resolved ONCE per agent request by the caller (discovery.ts,
 * serviceRequestOrchestrator.ts) and projected into every service card; this
 * function only composes already-known facts into a decision.
 *
 * Composes the four already-ratified facts the operator specified (Repair B):
 *   1. Constitutional admission established   (context.admission.registryActivated)
 *   2. Current-principal bounded delegation to
 *      this exact agent                       (context.personaScopedDelegationActive)
 *   3. Canonical Financial Services
 *      verification complete (Pulse + P&L)    (context.verification)
 *   4. Service-specific Standing threshold     (context.standing, per-definition)
 *
 * Three-valued, matching this codebase's house style:
 * `eligible: true | false | undefined`, where `undefined` means the
 * underlying fact is an audit gap ("could not tell"), never a fabricated
 * "ineligible" — the exact defect class the resolution record
 * RES-2026-08-22-FSVC-ELIGIBILITY-UNDEFINED-COLLAPSE-001 closed and the
 * candidate invariant CI-2026-08-22-THREE-VALUED-NEGATION-COLLAPSE-001
 * generalizes.
 */

import type { FinancialServiceDefinition } from '@/types/financialServices';
import type { FinancialServiceAgentContext } from './agentEligibilityContext';

export interface FinancialServiceEligibilityResult {
  eligible: boolean | undefined;
  code: string;
  reason: string;
}

export function evaluateFinancialServiceEligibility(
  definition: FinancialServiceDefinition,
  ctx: FinancialServiceAgentContext,
): FinancialServiceEligibilityResult {
  const agentId = ctx.agent.runtimeAgentId;

  if (definition.eligibilityPolicy.requiresAdmission) {
    if (!ctx.admission) {
      return { eligible: undefined, code: 'ADMISSION_UNRESOLVED', reason: `'${agentId}' admission state could not be read` };
    }
    if (ctx.admission.registryActivated === undefined) {
      return {
        eligible: undefined,
        code: 'ADMISSION_UNRESOLVED',
        reason: `'${agentId}' registry activation has an unresolved audit gap: ${ctx.admission.auditGaps.join('; ') || 'unknown'}`,
      };
    }
    if (ctx.admission.registryActivated === false) {
      return {
        eligible: false,
        code: 'NOT_ADMITTED',
        reason: `'${agentId}' is not constitutionally admitted (registry activation incomplete)`,
      };
    }

    if (ctx.personaScopedDelegationActive === undefined) {
      return {
        eligible: undefined,
        code: 'DELEGATION_UNRESOLVED',
        reason: `'${agentId}' persona-scoped delegation state could not be determined`,
      };
    }
    if (ctx.personaScopedDelegationActive === false) {
      return {
        eligible: false,
        code: 'NOT_DELEGATED_TO_CURRENT_PRINCIPAL',
        reason: `the requesting principal has no active bounded delegation to '${agentId}'`,
      };
    }

    if (!ctx.verification) {
      return {
        eligible: undefined,
        code: 'FINANCIAL_SERVICES_VERIFICATION_UNRESOLVED',
        reason: `'${agentId}' Financial Services verification (Pulse + P&L) could not be read`,
      };
    }
    if (!ctx.verification.financialServicesEligible) {
      return {
        eligible: false,
        code: 'FINANCIAL_SERVICES_NOT_VERIFIED',
        reason: `'${agentId}' has not completed Financial Services verification (pulse=${ctx.verification.pulseComplete}, pnl=${ctx.verification.pnlComplete})`,
      };
    }
  }

  if (definition.eligibilityPolicy.minimumStandingScore !== null) {
    if (!ctx.standingPersonaId) {
      return {
        eligible: undefined,
        code: 'STANDING_PERSONA_UNRESOLVED',
        reason: `a minimum Standing score is required but '${agentId}' has no resolvable CRM Standing persona`,
      };
    }
    if (!ctx.standing) {
      return { eligible: undefined, code: 'STANDING_UNRESOLVED', reason: 'Standing score could not be computed' };
    }
    if (ctx.standing.score < definition.eligibilityPolicy.minimumStandingScore) {
      return {
        eligible: false,
        code: 'STANDING_BELOW_THRESHOLD',
        reason: `Standing score ${ctx.standing.score} is below the required ${definition.eligibilityPolicy.minimumStandingScore}`,
      };
    }
  }

  return { eligible: true, code: 'ELIGIBLE', reason: 'eligibility policy satisfied' };
}
