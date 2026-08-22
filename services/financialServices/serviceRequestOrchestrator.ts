/**
 * MoneyPenny Financial Services Runtime — the ONE generic service-request
 * lifecycle implementation (Phase 3, Stage 3.1).
 *
 * `requestFinancialService()` sequences the full lifecycle the operator
 * specified — service discovery -> eligibility -> Authority -> Mandate ->
 * ProposedAction -> ConsequenceProjection -> ActionAuthorisation -> bounded
 * execution -> ObservedConsequence -> validation -> receipts -> Standing —
 * by calling ONLY existing, frozen modules:
 *
 *   discovery      services/financialServices/serviceCatalog.ts
 *   eligibility    services/financialServices/eligibility.ts
 *   projection     services/constitutionalCommerce/unifiedConsequenceProjection.ts
 *   gateway        services/registry/invocationGateway.ts (Gate 1/2/3, UNCHANGED)
 *   authorisation  services/constitutionalCommerce/actionAuthorisation.ts
 *   execution      services/constitutionalCommerce/boundedExecution.ts
 *   observation    services/constitutionalCommerce/observedConsequence.ts
 *   causal chain   services/constitutionalCommerce/causalChain.ts
 *   receipts       services/constitutionalCommerce/commerceReceipts.ts
 *   Standing       services/crm/standingAccrualService.ts
 *
 * This module computes NO authority, projection, authorisation or execution
 * decision of its own — it is glue, plus the service-catalog/eligibility
 * layer. There is exactly ONE implementation, used identically regardless of
 * `request.requestingAgentId` — no branch on which consumer agent is asking
 * (Phase 3 Stage 3.2's genericity requirement is satisfied by this file
 * never being touched to add a per-consumer path, not by a separate
 * mechanism).
 *
 * Advisor/architect (`executionReachable: false`) stop after Gate 2 — no
 * projection, authorisation, execution or observation is attempted for them
 * (see `types/financialServices.ts`'s `DELIVERED` status: calling
 * `deriveActionAuthorisation()` for a purely informational/planning service
 * would overclaim what happened). Only `runtime`-class services traverse the
 * full chain.
 *
 * Server-side only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveFinancialServiceDefinition } from './serviceCatalog';
import { evaluateFinancialServiceEligibility } from './eligibility';
import {
  composeUnifiedConsequenceProjection,
  type ConfidentialEvidenceInput,
} from '@/services/constitutionalCommerce/unifiedConsequenceProjection';
import { deriveActionAuthorisation } from '@/services/constitutionalCommerce/actionAuthorisation';
import { bindExecution } from '@/services/constitutionalCommerce/boundedExecution';
import { recordObservedConsequence } from '@/services/constitutionalCommerce/observedConsequence';
import { assembleCausalChain, type CausalChainRefs } from '@/services/constitutionalCommerce/causalChain';
import {
  emitActionAuthorisationReceipt,
  emitExecutionReceipt,
  emitConsequenceReceipt,
} from '@/services/constitutionalCommerce/commerceReceipts';
import { invokeCapability } from '@/services/registry/invocationGateway';
import { accrueStanding } from '@/services/crm/standingAccrualService';
import type { ConsequenceForecast } from '@/types/consequence';
import type { ConstitutionalAuthority, ProposedAction, ProjectionDisposition } from '@/types/constitutionalCommerce';
import type { CapabilityInvocation } from '@/types/capabilityInvocation';
import { SERVICE_CLASS_EXECUTION_MODE } from '@/types/financialServices';
import type { FinancialServiceOutcome, FinancialServiceRequest } from '@/types/financialServices';

/** A fixed, non-tuned contribution weight for a completed service interaction. Standing SCORING is a separate, later decision — this only wires the call site the lifecycle requires. */
const SERVICE_COMPLETION_CVS = 1;

export interface RequestFinancialServiceInput {
  request: FinancialServiceRequest;
  authority: ConstitutionalAuthority;
  /** CFS-006a's public forecast — caller-resolved (live or fallback), same discipline as every VELA-001 live script. */
  publicForecast: ConsequenceForecast;
  /** Present only when the resolved service's `confidentialityRequirement === 'REQUIRED'`; null otherwise. Never computed by this module — the same "gateway never computes a projection itself" discipline `capabilityInvocation.ts` already documents. */
  confidentialEvidence: ConfidentialEvidenceInput | null;
  /**
   * Supplied once the real-world outcome of a BOUND execution is known.
   * Omitted (or null) means "not yet observed" — the function still returns
   * a complete outcome through execution binding; a later, separate call
   * records the observation once it exists (execution and observation are
   * temporally separate acts).
   */
  observedDisposition?: ProjectionDisposition | null;
  observedState?: unknown;
  /** T0 persona id for receipt attribution — omitted means receipts are best-effort skipped, per `commerceReceipts.ts`'s existing contract. */
  personaId?: string;
  /** CRM persona id for Standing eligibility/accrual — caller-resolved via the identity spine, never derived here. */
  standingPersonaId?: string | null;
  now: string;
  admin: SupabaseClient;
}

export interface RequestFinancialServiceResult {
  outcome: FinancialServiceOutcome;
  causalChain: CausalChainRefs | null;
}

function refusedOutcome(
  request: FinancialServiceRequest,
  serviceClass: FinancialServiceOutcome['serviceClass'],
  providerMode: string | null,
  status: FinancialServiceOutcome['status'],
  reason: string,
): RequestFinancialServiceResult {
  return {
    outcome: {
      requestRef: request.requestRef,
      serviceId: request.serviceId,
      serviceClass,
      providerMode,
      status,
      reason,
      authorisationRef: null,
      executionRef: null,
      observedConsequenceRef: null,
      validationState: null,
      projectionDisposition: null,
    },
    causalChain: null,
  };
}

export async function requestFinancialService(
  input: RequestFinancialServiceInput,
): Promise<RequestFinancialServiceResult> {
  const { request, authority, publicForecast, confidentialEvidence, admin } = input;

  // ── Service discovery ────────────────────────────────────────────────
  const definition = resolveFinancialServiceDefinition(request.serviceId);
  if (!definition) {
    return refusedOutcome(request, 'INFORMATIONAL', null, 'INELIGIBLE', `unknown serviceId '${request.serviceId}'`);
  }

  // ── Eligibility ──────────────────────────────────────────────────────
  const eligibility = await evaluateFinancialServiceEligibility(
    definition,
    { requestingAgentId: request.requestingAgentId, standingPersonaId: input.standingPersonaId },
    admin,
  );
  if (eligibility.eligible !== true) {
    return refusedOutcome(
      request,
      definition.serviceClass,
      definition.providerMode,
      'INELIGIBLE',
      `${eligibility.code}: ${eligibility.reason}`,
    );
  }

  // ── Authority + Mandate + ProposedAction ────────────────────────────
  const action: ProposedAction = {
    actionRef: request.requestRef,
    actorRef: request.requestingAgentId,
    mandateRef: request.mandateRef,
    actionType: definition.serviceId,
    consequenceDomain: 'financial-services',
  };

  const executionMode = SERVICE_CLASS_EXECUTION_MODE[definition.serviceClass];

  // ── ConsequenceProjection — runtime-class only ───────────────────────
  const projection =
    definition.executionPolicy.executionReachable
      ? composeUnifiedConsequenceProjection({
          projectionContextRef: `fsvc:${definition.serviceId}:${request.requestRef}`,
          actionRef: action.actionRef,
          authorityRef: authority.principalRef,
          mandateRef: authority.mandateRef,
          publicForecast,
          confidentialRequirement: definition.confidentialityRequirement,
          confidentialEvidence,
          policy: { attestationRequirement: definition.attestationRequirement },
        })
      : null;

  // ── Governed capability invocation — Gate 1/2/3, UNCHANGED ──────────
  const envelope: CapabilityInvocation = {
    mode: 'capability',
    invocationId: `fsvc-${request.requestRef}`,
    principalRef: request.principalRef,
    originatingSurface: 'financial-services',
    requestingAgentId: request.requestingAgentId,
    orchestratorAgentId: request.requestingAgentId,
    capabilityId: definition.capabilityId,
    targetAgentId: definition.providerAgentId,
    runtimeMembershipRef: 'financial-services',
    executionMode,
    intent: `Consume financial service '${definition.serviceId}'`,
    input: request.input,
    policyBindingRefs: [],
    delegationDepth: 0,
    invocationPath: [],
    maxInvocationDepth: 2,
    consequenceProjection: projection ?? undefined,
  };
  const decision = await invokeCapability(envelope, input.personaId);

  // ── Advisor/Architect terminate here — see file header ──────────────
  if (!definition.executionPolicy.executionReachable) {
    if (decision.decision === 'allow') {
      await accrueStandingBestEffort(input.standingPersonaId);
      return {
        outcome: {
          requestRef: request.requestRef,
          serviceId: request.serviceId,
          serviceClass: definition.serviceClass,
          providerMode: definition.providerMode,
          status: 'DELIVERED',
          reason: `'${definition.serviceId}' delivered in ${executionMode} mode`,
          authorisationRef: null,
          executionRef: null,
          observedConsequenceRef: null,
          validationState: null,
          projectionDisposition: null,
        },
        causalChain: null,
      };
    }
    const code = decision.decision === 'refuse' ? decision.code : decision.decision;
    const reason = decision.decision === 'refuse' ? decision.reason : `gateway decision '${decision.decision}'`;
    return refusedOutcome(request, definition.serviceClass, definition.providerMode, 'REFUSED', `${code}: ${reason}`);
  }

  // ── ActionAuthorisation — runtime-class only ─────────────────────────
  if (!projection) throw new Error('unreachable: executionReachable service without a composed projection');
  const authorisation = deriveActionAuthorisation({
    authority,
    projection,
    invocationDecision: decision,
    now: input.now,
  });

  const chainBase = { action, projection, authorisation };

  if (authorisation.status !== 'AUTHORISED') {
    const chain = assembleCausalChain(chainBase);
    const status: FinancialServiceOutcome['status'] = authorisation.status === 'UNRESOLVED' ? 'UNRESOLVED' : 'REFUSED';
    await emitActionAuthorisationReceipt(authorisation, chain, input.personaId, 'financial-services');
    return {
      outcome: {
        requestRef: request.requestRef,
        serviceId: request.serviceId,
        serviceClass: definition.serviceClass,
        providerMode: definition.providerMode,
        status,
        reason: `ActionAuthorisation ${authorisation.status}`,
        authorisationRef: authorisation.authorisationRef,
        executionRef: null,
        observedConsequenceRef: null,
        validationState: null,
        projectionDisposition: projection.disposition,
      },
      causalChain: chain,
    };
  }

  await emitActionAuthorisationReceipt(authorisation, assembleCausalChain(chainBase), input.personaId, 'financial-services');

  // ── Bounded execution ────────────────────────────────────────────────
  const bound = bindExecution({ authorisation, signerRef: request.requestingAgentId, now: input.now });
  const chainWithExecution = assembleCausalChain({ ...chainBase, execution: bound.execution });
  await emitExecutionReceipt(bound, chainWithExecution, input.personaId, 'financial-services');

  if (bound.status !== 'execution_bound' || !bound.execution) {
    return {
      outcome: {
        requestRef: request.requestRef,
        serviceId: request.serviceId,
        serviceClass: definition.serviceClass,
        providerMode: definition.providerMode,
        status: 'UNRESOLVED',
        reason: bound.reason,
        authorisationRef: authorisation.authorisationRef,
        executionRef: null,
        observedConsequenceRef: null,
        validationState: null,
        projectionDisposition: projection.disposition,
      },
      causalChain: chainWithExecution,
    };
  }

  await accrueStandingBestEffort(input.standingPersonaId);

  // ── ObservedConsequence + validation — only when the caller supplied
  //    what actually happened; execution binding and observation are
  //    temporally separate acts. ────────────────────────────────────────
  if (input.observedDisposition === undefined || input.observedDisposition === null) {
    return {
      outcome: {
        requestRef: request.requestRef,
        serviceId: request.serviceId,
        serviceClass: definition.serviceClass,
        providerMode: definition.providerMode,
        status: 'AUTHORISED',
        reason: 'execution bound; observation not yet supplied',
        authorisationRef: authorisation.authorisationRef,
        executionRef: bound.execution.executionRef,
        observedConsequenceRef: null,
        validationState: null,
        projectionDisposition: projection.disposition,
      },
      causalChain: chainWithExecution,
    };
  }

  const observed = recordObservedConsequence({
    execution: bound.execution,
    projection,
    observedState: input.observedState ?? null,
    observedDisposition: input.observedDisposition,
  });
  const finalChain = assembleCausalChain({ ...chainBase, execution: bound.execution, observedConsequence: observed });
  await emitConsequenceReceipt(observed, finalChain, input.personaId, 'financial-services');

  return {
    outcome: {
      requestRef: request.requestRef,
      serviceId: request.serviceId,
      serviceClass: definition.serviceClass,
      providerMode: definition.providerMode,
      status: 'AUTHORISED',
      reason: 'execution bound and observed',
      authorisationRef: authorisation.authorisationRef,
      executionRef: bound.execution.executionRef,
      observedConsequenceRef: observed.consequenceRef,
      validationState: observed.validationState,
      projectionDisposition: projection.disposition,
    },
    causalChain: finalChain,
  };
}

/** Best-effort Standing accrual on a successfully completed service interaction. A Standing failure must never break the service outcome it describes — same discipline as `commerceReceipts.ts`'s receipt emitters. */
async function accrueStandingBestEffort(standingPersonaId: string | null | undefined): Promise<void> {
  if (!standingPersonaId) return;
  await accrueStanding({ crmPersonaId: standingPersonaId, cvs: SERVICE_COMPLETION_CVS }).catch(() => undefined);
}
