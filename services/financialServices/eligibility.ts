/**
 * MoneyPenny Financial Services Runtime — eligibility (Phase 3, Stage 3.1;
 * corrected 2026-08-23, second pass).
 *
 * A PURE decision function over an already-resolved
 * `FinancialServiceAgentContext` (`services/financialServices/
 * agentEligibilityContext.ts`) — it performs NO reads of its own.
 *
 * Operator correction (verbatim): eligibility must never require a currently
 * active `delegation_grants` row — that store allows exactly one active grant
 * PER PERSONA, so it cannot serve as a multi-agent discoverability roster.
 * The corrected model:
 *
 *   constitutional admission established        (context.admission.registryActivated)
 *   + agent structurally assigned/bound to
 *     this principal/person                     (context.structurallyAssigned,
 *                                                  persona_agent_assignments)
 *   + Financial Services verification complete   (context.verification)
 *   + service-specific Standing satisfied        (context.standing, per-definition)
 *   = Financial Service eligible
 *
 * The ACTIVE bounded-delegation grant (+ an authorized Constitutional
 * Agreement/mandate) remains real, but belongs to the AUTHORITY PLANE for a
 * proposed CONSEQUENTIAL action (`constitutionalAuthorityAdapter.ts`,
 * `deriveActionAuthorisation()`) — never to discoverability. An otherwise-
 * eligible Runtime-class request that lacks current authority resolves
 * REFUSED/UNRESOLVED downstream, at request time, through the real
 * authority/authorisation path — never `INELIGIBLE` here.
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

    if (ctx.structurallyAssigned === undefined) {
      return {
        eligible: undefined,
        code: 'ASSIGNMENT_UNRESOLVED',
        reason: `'${agentId}' structural assignment to the requesting principal could not be determined`,
      };
    }
    if (ctx.structurallyAssigned === false) {
      return {
        eligible: false,
        code: 'NOT_ASSIGNED_TO_PRINCIPAL',
        reason: `'${agentId}' is not structurally assigned/bound to the requesting principal (persona_agent_assignments)`,
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
