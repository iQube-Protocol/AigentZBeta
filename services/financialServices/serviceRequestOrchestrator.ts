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
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveAgentStandingPersonaId } from '@/services/standing/agentStandingPersona';
import { draftFinancialStructure } from '@/services/constitutional/moneyPennyArchitect';
import { runMoneyPennyChat } from '@/app/api/moneypenny/chat/route';
import { isProviderUnavailableError, describeInferenceUnavailability } from '@/services/constitutional/modelRouter';
import { runConstitutionalServicePattern } from '@/services/constitutional/constitutionalServicePipeline';
import {
  MONEYPENNY_RUNTIME_AGENT_REF,
  resolveMoneyPennyRuntimeCapabilityRef,
} from '@/services/constitutional/moneyPennyRuntimeRefs';
import { isExecutionDomain, type FinancialDomain } from '@/services/resolution/executionTaxonomy';
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
import { SERVICE_CLASS_EXECUTION_MODE, GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE } from '@/types/financialServices';
import type {
  FinancialServiceDefinition,
  FinancialServiceOutcome,
  FinancialServiceRequest,
  ProviderDisplayOutput,
} from '@/types/financialServices';

/** Bounded display preview length for a persisted Architect proposal body — the canonical, complete body always lives on the artifact record (`artifactId`); this only bounds what rides alongside the outcome for display. */
const ARCHITECT_PREVIEW_MAX_CHARS = 600;

/**
 * A fixed, non-tuned contribution weight for a completed service interaction.
 * Standing SCORING is a separate, later decision — this only wires the call
 * site the lifecycle requires. Exported so the one-time reconciliation route
 * for the pre-P0-A live pilot interactions (`app/api/ops/journey/
 * reconcile-provider-standing-attribution/route.ts`) reverses the exact same
 * magnitude it originally credited — never a second, independently-guessed
 * constant.
 */
export const SERVICE_COMPLETION_CVS = 1;

export interface RequestFinancialServiceInput {
  request: FinancialServiceRequest;
  /**
   * CFS-006a's public forecast — caller-resolved (live or fallback), same
   * discipline as every VELA-001 live script. Optional/null: only a service
   * whose execution path is actually reachable (`executionPolicy.
   * executionReachable`, Runtime today) ever composes a projection from
   * this — Advisor/Architect never use it (2026-08-23 repair pass: a public
   * forecast was previously computed unconditionally from a hardcoded seed
   * id, which is invalid for a service that declares
   * `projectionRequirement: 'NOT_REQUIRED'`). A caller that omits this for
   * an `executionReachable` service gets a truthful `UNRESOLVED`, never a
   * crash and never a silently-skipped projection.
   */
  publicForecast?: ConsequenceForecast | null;
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

type ProviderDispatchResult =
  | { ok: true; resultRef: string; displayOutput: ProviderDisplayOutput }
  | { ok: false; error: string; errorCode?: 'INFERENCE_PROVIDER_UNAVAILABLE'; refused?: boolean };

/**
 * Actually invoke the canonical PRD-MPY-001 provider for an
 * `executionReachable: false` service (Repair D) — never a second
 * implementation of Architect/Advisor/Constitutional-Runtime, only their
 * existing entry points.
 *
 * 2026-08-23 repair pass (Parts A/B): a provider failure is classified as
 * `INFERENCE_PROVIDER_UNAVAILABLE` ONLY when it is the exact "every routed/
 * fallback inference provider was unreachable" infrastructure condition
 * (`isProviderUnavailableError`) — never a broader guess. And a SUCCESSFUL
 * result now carries the real provider output (`displayOutput`) alongside
 * `resultRef`, instead of discarding it: Advisor's `resultRef` stays a
 * hash/commitment over the response (never the raw prose itself — that
 * remains an evidence reference, not a display value), while `displayOutput`
 * carries the actual response text an operator reads. Architect's
 * `resultRef` stays the persisted artifact id; `displayOutput` carries a
 * bounded title+preview of the same persisted proposal.
 *
 * 2026-08-23 second repair pass — Constitutional Runtime
 * (`moneypenny.runtime.constitutional`, `providerMode: 'RUNTIME'`,
 * `executionPolicy.executionReachable: false` — see serviceCatalog.ts's own
 * comment for why): dispatches to the EXISTING, unmodified
 * `runConstitutionalServicePattern()` pipeline (`/api/moneypenny/runtime`'s
 * own implementation) in `mode: 'authoritative'`. That pipeline's OWN 409
 * `constitutionalAgreement.ts` gate is the real authorization boundary — a
 * refusal there is a genuine constitutional negative (`refused: true`),
 * never collapsed into the generic "technical dispatch failure" UNRESOLVED
 * bucket Advisor/Architect's own failures use.
 */
async function dispatchDelegatedProvider(
  definition: FinancialServiceDefinition,
  request: FinancialServiceRequest,
  callerPersonaId: string | null,
): Promise<ProviderDispatchResult> {
  const rawInput = request.input as Record<string, unknown> | undefined;
  const intentCandidate = rawInput?.intent ?? rawInput?.message;
  const intent = typeof intentCandidate === 'string' ? intentCandidate.trim() : '';
  if (!intent) return { ok: false, error: "request input carries no non-empty 'intent' or 'message' string" };

  if (definition.providerMode === 'ARCHITECT') {
    const result = await draftFinancialStructure({ intent }).catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
      errorCode: isProviderUnavailableError(e) ? ('INFERENCE_PROVIDER_UNAVAILABLE' as const) : undefined,
    }));
    if (!result.ok || !result.artifactId || !result.title || !result.body) {
      return {
        ok: false,
        error: result.error ?? 'Architect returned no artifact',
        errorCode: result.errorCode,
      };
    }
    const truncated = result.body.length > ARCHITECT_PREVIEW_MAX_CHARS;
    return {
      ok: true,
      resultRef: result.artifactId,
      displayOutput: {
        kind: 'ARCHITECT_PROPOSAL',
        title: result.title,
        preview: truncated ? `${result.body.slice(0, ARCHITECT_PREVIEW_MAX_CHARS)}…` : result.body,
        truncated,
        artifactId: result.artifactId,
      },
    };
  }

  if (definition.providerMode === 'ADVISOR') {
    let result;
    try {
      result = await runMoneyPennyChat({ messages: [{ role: 'user', content: intent }] });
    } catch (e) {
      if (isProviderUnavailableError(e)) {
        return {
          ok: false,
          error: `inference provider unavailable: ${describeInferenceUnavailability(e)}`,
          errorCode: 'INFERENCE_PROVIDER_UNAVAILABLE',
        };
      }
      return { ok: false, error: e instanceof Error ? e.message : 'Advisor invocation failed' };
    }
    const text = result?.response?.trim();
    if (!text) return { ok: false, error: 'Advisor returned no response' };
    return {
      ok: true,
      resultRef: createHash('sha256').update(text).digest('hex').slice(0, 16),
      displayOutput: { kind: 'ADVISOR_RESPONSE', text },
    };
  }

  if (definition.providerMode === 'RUNTIME') {
    if (!callerPersonaId) {
      return { ok: false, error: 'no authenticated principal directing this agent' };
    }
    const rawDomain = rawInput?.domain;
    const domain: FinancialDomain = isExecutionDomain(rawDomain) ? rawDomain : 'intelligence';
    const capabilityRef = resolveMoneyPennyRuntimeCapabilityRef(domain);

    let result;
    try {
      result = await runConstitutionalServicePattern({
        intent,
        capabilityRef,
        selectedAgentRef: MONEYPENNY_RUNTIME_AGENT_REF,
        requestingPersonaId: callerPersonaId,
        domain,
        mode: 'authoritative',
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Constitutional Runtime invocation failed' };
    }

    if (!result.ok) {
      // A REAL constitutional refusal from the EXISTING, unmodified
      // constitutionalAgreement.ts 409 gate, OR a later step (forbidden
      // action / spend cap) refusing even though the agreement itself was
      // authorized — `result.gate.reason` only exists on the 409 variant, so
      // the refused step's own trace detail is the one reason string that is
      // always present and always accurate — never collapsed into the
      // generic technical-failure UNRESOLVED bucket Advisor/Architect's own
      // dispatch failures use.
      const refusalDetail =
        result.trace.find((t) => t.step === result.blockedAtStep)?.detail ??
        (result.gate.ok ? 'refused by a later constitutional check' : result.gate.reason);
      return {
        ok: false,
        error: `Constitutional Runtime refused at step ${result.blockedAtStep} (${refusalDetail})`,
        refused: true,
      };
    }

    return {
      ok: true,
      resultRef: result.agreementId ?? createHash('sha256').update(JSON.stringify(result.trace)).digest('hex').slice(0, 16),
      displayOutput: {
        kind: 'RUNTIME_EXECUTION',
        domain,
        executed: result.executed,
        agreementId: result.agreementId,
        summary: `Constitutional Runtime [${domain}]: ${result.executed ? 'executed' : 'not executed'}${result.agreementId ? `, agreement ${result.agreementId}` : ''}`,
      },
    };
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

  // The Gate-2-request mode is driven by `governancePath`, NOT bare
  // `serviceClass`, precisely so a genuinely `CONSEQUENTIAL` service governed
  // by the constitutional SERVICE pipeline (Constitutional Runtime) never
  // collapses onto Gate 2's frozen `authoritative` exception merely by
  // sharing its consequence class with the service governed by
  // constitutional COMMERCE (Confidential Runtime). `NONE`-path services
  // (Advisor/Architect) have no override and fall back to the plain
  // serviceClass mapping. Gate 2 itself is untouched either way.
  const executionMode = GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE[definition.governancePath] ?? SERVICE_CLASS_EXECUTION_MODE[definition.serviceClass];

  // ── ConsequenceProjection — runtime-class only, and only when a real
  //    public forecast was actually supplied. `publicForecast` is optional
  //    precisely because Advisor/Architect (`executionReachable: false`)
  //    never reach this branch and must never require one; a runtime-class
  //    service that reaches here without one is a genuine "could not
  //    resolve a public projection input" gap — UNRESOLVED, never a throw
  //    and never a silently-skipped projection. ───────────────────────────
  if (definition.executionPolicy.executionReachable && !publicForecast) {
    return {
      outcome: {
        requestRef: request.requestRef,
        serviceId: request.serviceId,
        serviceClass: definition.serviceClass,
        providerMode: definition.providerMode,
        status: 'UNRESOLVED',
        reason: 'a public consequence forecast is required for an executionReachable service but none was supplied',
        authorisationRef: null,
        executionRef: null,
        observedConsequenceRef: null,
        validationState: null,
        projectionDisposition: null,
      },
      causalChain: null,
    };
  }

  const projection =
    definition.executionPolicy.executionReachable
      ? composeUnifiedConsequenceProjection({
          projectionContextRef: `fsvc:${definition.serviceId}:${request.requestRef}`,
          actionRef: action.actionRef,
          authorityRef: authority.principalRef,
          mandateRef: authority.mandateRef,
          publicForecast: publicForecast as ConsequenceForecast,
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

    const dispatch = await dispatchDelegatedProvider(definition, request, context.callerPersonaId);
    if (!dispatch.ok) {
      // Two distinct failure shapes, never collapsed into one:
      //   - a REAL constitutional refusal (Constitutional Runtime's own,
      //     unmodified 409 agreement gate / forbidden action / spend cap) ->
      //     REFUSED, dispatch.refused === true.
      //   - a technical provider failure (inference outage, no response) ->
      //     UNRESOLVED — the gate already allowed; nothing constitutional
      //     refused this, the provider itself simply did not complete. When
      //     the failure is specifically the inference-provider-infrastructure
      //     condition (2026-08-23 repair pass, Part A/C), `errorCode` lets a
      //     caller render "UNRESOLVED — inference provider unavailable"
      //     instead of implying the financial-service architecture failed.
      const status: FinancialServiceOutcome['status'] = dispatch.refused ? 'REFUSED' : 'UNRESOLVED';
      return {
        outcome: {
          requestRef: request.requestRef,
          serviceId: request.serviceId,
          serviceClass: definition.serviceClass,
          providerMode: definition.providerMode,
          status,
          reason: dispatch.refused ? dispatch.error : `gate allowed but provider invocation did not complete: ${dispatch.error}`,
          authorisationRef: null,
          executionRef: null,
          observedConsequenceRef: null,
          validationState: null,
          projectionDisposition: null,
          providerResultRef: null,
          providerOutput: null,
          errorCode: dispatch.errorCode ?? null,
        },
        causalChain: null,
      };
    }

    await emitCapabilityInvocationCompleted(envelope, input.personaId, definition.providerAgentId, {
      providerResultRef: dispatch.resultRef,
    });
    // Standing accrues only now — after a REAL completed provider result,
    // never merely on the gate's earlier 'allow' (the exact bug this repair
    // removes). Credits the PROVIDER that did the work, never the requester
    // that merely consumed it (2026-08-23 attribution repair — see the
    // function doc below).
    await accrueStandingBestEffort(admin, definition.providerAgentId, request.requestingAgentId);

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
        providerOutput: dispatch.displayOutput,
        errorCode: null,
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

  await accrueStandingBestEffort(admin, definition.providerAgentId, request.requestingAgentId);

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

/**
 * Best-effort Standing accrual on a successfully completed service
 * interaction. A Standing failure must never break the service outcome it
 * describes — same discipline as `commerceReceipts.ts`'s receipt emitters.
 *
 * 2026-08-23 operator directive ("Horizen Pilot — close Standing + MoneyPenny
 * Runtime now"), correcting the 2026-08-23 attribution repair above: crediting
 * `subjectAgentRef = request.requestingAgentId` fixed the receipt LABEL but
 * not the underlying defect — it still credited the CRM Standing persona of
 * whichever agent merely *requested* the service (`context.standingPersonaId`,
 * resolved for the requester), never the agent that actually performed the
 * work. Successful provider execution accrues contribution Standing to the
 * PROVIDER's own canonical Standing persona (`definition.providerAgentId`,
 * resolved the same way any agent's canonical Standing persona is resolved —
 * `resolveRegistrableAgentByRuntimeId` -> `resolveAgentAdmissionState` ->
 * `resolveAgentStandingPersonaId`, idempotently provisioning the provider's
 * `aigent-canonical-standing` persona if it does not yet exist). The
 * requester is preserved only as interaction/context evidence
 * (`requestingAgentRef`, folded into the receipt's `actionInput`, never into
 * `agentsInvoked`) — it is never the recipient of the provider's contribution
 * Standing.
 */
async function accrueStandingBestEffort(
  admin: SupabaseClient,
  providerAgentId: string,
  requestingAgentId: string,
): Promise<void> {
  try {
    const providerAgent = resolveRegistrableAgentByRuntimeId(providerAgentId);
    if (!providerAgent) return;
    const admission = await resolveAgentAdmissionState(admin, providerAgent).catch(() => undefined);
    const providerStandingPersonaId = await resolveAgentStandingPersonaId(admin, providerAgent, admission?.agentRootDid);
    if (!providerStandingPersonaId) return;
    await accrueStanding({
      crmPersonaId: providerStandingPersonaId,
      cvs: SERVICE_COMPLETION_CVS,
      subjectAgentRef: providerAgentId,
      requestingAgentRef: requestingAgentId,
    });
  } catch {
    // best-effort — see the doc above.
  }
}
