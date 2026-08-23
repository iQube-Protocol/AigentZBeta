/**
 * MoneyPenny Financial Services Runtime — the ONE generic service-request
 * lifecycle implementation (Phase 3, Stage 3.1; rewritten in the 2026-08-23
 * repair pass, Repairs B/C/D/F).
 *
 * `requestFinancialService()` sequences the full lifecycle the operator
 * specified — service discovery -> eligibility -> Authority -> Mandate ->
 * ProposedAction -> ConsequenceProjection -> ActionAuthorisation -> bounded
 * execution -> ObservedConsequence -> validation -> receipts -> Standing —
 * by calling ONLY existing, frozen modules:
 *
 *   discovery      services/financialServices/serviceCatalog.ts
 *   context        services/financialServices/agentEligibilityContext.ts (resolved ONCE)
 *   eligibility    services/financialServices/eligibility.ts (pure over that context)
 *   authority      services/financialServices/constitutionalAuthorityAdapter.ts
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
 * `request.requestingAgentId` — no branch on which consumer agent is asking.
 *
 * Repair D (operator directive, 2026-08-23): `invokeCapability()`'s `allow`
 * decision is a GOVERNANCE permission to dispatch, never itself a delivered
 * result. For advisor/architect (`executionReachable: false`), an `allow` is
 * now followed by an ACTUAL call to the canonical PRD-MPY-001 provider
 * (`draftFinancialStructure` for Architect, `runMoneyPennyChat` for
 * Advisor); only a real, successful provider result reaches `DELIVERED` and
 * triggers Standing accrual. A technical provider failure resolves
 * `UNRESOLVED`, never a silent `DELIVERED`.
 *
 * Server-side only.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveFinancialServiceDefinition } from './serviceCatalog';
import { evaluateFinancialServiceEligibility } from './eligibility';
import { resolveAgentEligibilityContext } from './agentEligibilityContext';
import { resolveConstitutionalAuthorityForService } from './constitutionalAuthorityAdapter';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { draftFinancialStructure } from '@/services/constitutional/moneyPennyArchitect';
import { runMoneyPennyChat } from '@/app/api/moneypenny/chat/route';
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
import { invokeCapability, emitCapabilityInvocationCompleted } from '@/services/registry/invocationGateway';
import { accrueStanding } from '@/services/crm/standingAccrualService';
import type { ConsequenceForecast } from '@/types/consequence';
import type { ProposedAction, ProjectionDisposition } from '@/types/constitutionalCommerce';
import type { CapabilityInvocation } from '@/types/capabilityInvocation';
import { SERVICE_CLASS_EXECUTION_MODE } from '@/types/financialServices';
import type { FinancialServiceDefinition, FinancialServiceOutcome, FinancialServiceRequest } from '@/types/financialServices';

/** A fixed, non-tuned contribution weight for a completed service interaction. Standing SCORING is a separate, later decision — this only wires the call site the lifecycle requires. */
const SERVICE_COMPLETION_CVS = 1;

export interface RequestFinancialServiceInput {
  request: FinancialServiceRequest;
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
  /**
   * The AUTHENTICATED human caller directing this agent's request — resolved
   * server-side via the identity spine (`getActivePersona`), NEVER accepted
   * from client input (Repair C: "Remove client assertions from
   * constitutional gates"). Used to resolve the persona-scoped delegation
   * check (Repair A) and the real `ConstitutionalAuthority` (Repair C) —
   * never a client-supplied `standingPersonaId`/synthetic authority.
   */
  callerAuthProfileId?: string | null;
  actorPersonaId?: string | null;
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

/**
 * Actually invoke the canonical PRD-MPY-001 provider for an
 * `executionReachable: false` service (Repair D) — never a second
 * implementation of Architect/Advisor, only their existing entry points.
 */
async function dispatchInformationalProvider(
  definition: FinancialServiceDefinition,
  request: FinancialServiceRequest,
): Promise<{ ok: true; resultRef: string } | { ok: false; error: string }> {
  const rawInput = request.input as Record<string, unknown> | undefined;
  const intentCandidate = rawInput?.intent ?? rawInput?.message;
  const intent = typeof intentCandidate === 'string' ? intentCandidate.trim() : '';
  if (!intent) return { ok: false, error: "request input carries no non-empty 'intent' or 'message' string" };

  if (definition.providerMode === 'ARCHITECT') {
    const result = await draftFinancialStructure({ intent }).catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    }));
    if (!result.ok || !result.artifactId) return { ok: false, error: result.error ?? 'Architect returned no artifact' };
    return { ok: true, resultRef: result.artifactId };
  }

  if (definition.providerMode === 'ADVISOR') {
    const result = await runMoneyPennyChat({ messages: [{ role: 'user', content: intent }] }).catch(() => null);
    if (!result?.response?.trim()) return { ok: false, error: 'Advisor returned no response' };
    return { ok: true, resultRef: createHash('sha256').update(result.response).digest('hex').slice(0, 16) };
  }

  return { ok: false, error: `no provider dispatch implemented for providerMode '${definition.providerMode}'` };
}

export async function requestFinancialService(
  input: RequestFinancialServiceInput,
): Promise<RequestFinancialServiceResult> {
  const { request, publicForecast, confidentialEvidence, admin } = input;

  // ── Service discovery ────────────────────────────────────────────────
  const definition = resolveFinancialServiceDefinition(request.serviceId);
  if (!definition) {
    return refusedOutcome(request, 'INFORMATIONAL', null, 'INELIGIBLE', `unknown serviceId '${request.serviceId}'`);
  }

  const agent = resolveRegistrableAgentByRuntimeId(request.requestingAgentId);
  if (!agent) {
    return refusedOutcome(
      request,
      definition.serviceClass,
      definition.providerMode,
      'INELIGIBLE',
      `'${request.requestingAgentId}' is not a canonical registrable agent`,
    );
  }

  // ── Resolve once — admission/delegation/verification/Standing (Repair F) ─
  const context = await resolveAgentEligibilityContext(
    admin,
    agent,
    input.actorPersonaId ?? null,
    input.callerAuthProfileId ?? null,
  );

  // ── Eligibility — pure decision over the resolved context (Repair B) ────
  const eligibility = evaluateFinancialServiceEligibility(definition, context);
  if (eligibility.eligible !== true) {
    return refusedOutcome(
      request,
      definition.serviceClass,
      definition.providerMode,
      'INELIGIBLE',
      `${eligibility.code}: ${eligibility.reason}`,
    );
  }

  // ── Real ConstitutionalAuthority — never a synthetic one (Repair C) ──────
  const { authority } = await resolveConstitutionalAuthorityForService(admin, context, definition);

  // ── Mandate + ProposedAction ─────────────────────────────────────────
  const action: ProposedAction = {
    actionRef: request.requestRef,
    actorRef: request.requestingAgentId,
    mandateRef: authority.mandateRef,
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
  // `orchestratorAgentId` is deliberately OMITTED: this consumer
  // (`request.requestingAgentId`, e.g. Aigent Nakamoto) is not orchestrating
  // anything — it is a principal-directed CONSUMER requesting a capability
  // from a separately-resolved provider (MoneyPenny). Gate 1
  // (services/registry/capabilityInvocationGates.ts) recognises this exact
  // shape — requester !== resolved provider, no orchestratorAgentId — as its
  // own admitted-consumer pattern (2026-08-23 repair). Previously this field
  // was set to `request.requestingAgentId` to satisfy the orchestrated-
  // pattern's structural check, which misrepresented the consumer as an
  // orchestrator; do not reintroduce that.
  const envelope: CapabilityInvocation = {
    mode: 'capability',
    invocationId: `fsvc-${request.requestRef}`,
    principalRef: authority.principalRef,
    originatingSurface: 'financial-services',
    requestingAgentId: request.requestingAgentId,
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

  // ── Advisor/Architect — real dispatch, THEN (and only then) DELIVERED ───
  // (Repair D — see file header. No projection/authorisation/execution/
  // observation is attempted for these classes; see types/financialServices.ts's
  // `DELIVERED` note for why reusing AUTHORISED for them would overclaim.)
  if (!definition.executionPolicy.executionReachable) {
    if (decision.decision !== 'allow') {
      const code = decision.decision === 'refuse' ? decision.code : decision.decision;
      const reason = decision.decision === 'refuse' ? decision.reason : `gateway decision '${decision.decision}'`;
      return refusedOutcome(request, definition.serviceClass, definition.providerMode, 'REFUSED', `${code}: ${reason}`);
    }

    const dispatch = await dispatchInformationalProvider(definition, request);
    if (!dispatch.ok) {
      // A technical provider failure — never a silent DELIVERED, and never a
      // REFUSED (the gate already allowed; nothing constitutional refused
      // this, the provider itself simply did not complete).
      return {
        outcome: {
          requestRef: request.requestRef,
          serviceId: request.serviceId,
          serviceClass: definition.serviceClass,
          providerMode: definition.providerMode,
          status: 'UNRESOLVED',
          reason: `gate allowed but provider invocation did not complete: ${dispatch.error}`,
          authorisationRef: null,
          executionRef: null,
          observedConsequenceRef: null,
          validationState: null,
          projectionDisposition: null,
          providerResultRef: null,
        },
        causalChain: null,
      };
    }

    await emitCapabilityInvocationCompleted(envelope, input.personaId, definition.providerAgentId, {
      providerResultRef: dispatch.resultRef,
    });
    // Standing accrues only now — after a REAL completed provider result,
    // never merely on the gate's earlier 'allow' (the exact bug this repair
    // removes).
    await accrueStandingBestEffort(context.standingPersonaId);

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
        providerResultRef: dispatch.resultRef,
      },
      causalChain: null,
    };
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

  await accrueStandingBestEffort(context.standingPersonaId);

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
