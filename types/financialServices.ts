/**
 * MoneyPenny Financial Services Runtime — Phase 3 Stage 3.1.
 *
 * The catalog/orchestration layer that sits ABOVE the frozen VELA-001
 * constitutional commerce ontology (`types/constitutionalCommerce.ts`) and
 * the governed capability invocation gateway
 * (`types/capabilityInvocation.ts`, `services/registry/invocationGateway.ts`).
 * This module defines what a "financial service" IS (a catalog entry, a
 * request, an orchestrated sequence) — it does NOT define a second authority,
 * projection, authorisation or execution mechanism. Every constitutional
 * decision a service produces is still made by the existing, frozen
 * modules; this layer only describes services and sequences requests to
 * them (`services/financialServices/serviceRequestOrchestrator.ts`).
 *
 * `AttestationRequirement`/`ConfidentialRequirement` are REUSED directly
 * from `constitutionalCommerce.ts` — not re-declared — so "UNSPECIFIED fails
 * closed" and the REQUIRED/NOT_REQUIRED vocabulary mean exactly one thing
 * across both layers.
 */

import type { AttestationRequirement, ConfidentialRequirement, ProjectionDisposition } from './constitutionalCommerce';
import type { CapabilityExecutionMode } from './capabilityInvocation';

// ── Service classes ─────────────────────────────────────────────────────

/**
 * MoneyPenny's three initial services. Each maps to exactly one
 * `CapabilityExecutionMode` — the mapping IS the mechanism that keeps
 * advisor/architect from ever reaching a real authorisation without any
 * branch in the orchestrator's own code: Gate 2
 * (`services/registry/capabilityInvocationGates.ts`) already treats
 * `preview`/`shadow` as unconditionally passable and `authoritative` as
 * refused-by-default-except-the-one-named-capability. Nothing here
 * reimplements that; it only selects which mode a service requests.
 *
 *   advisor   -> preview      — informational only; never executes
 *   architect -> shadow       — proposes/plans; never authorises the real
 *                                action (existing `deriveActionAuthorisation`
 *                                rule: "shadow-only" is REFUSED)
 *   runtime   -> authoritative — the only class that can reach AUTHORISED
 *                                and bind execution
 */
export type FinancialServiceClass = 'advisor' | 'architect' | 'runtime';

export const SERVICE_CLASS_EXECUTION_MODE: Record<FinancialServiceClass, CapabilityExecutionMode> = {
  advisor: 'preview',
  architect: 'shadow',
  runtime: 'authoritative',
};

/** Only `runtime`-class services ever attempt authorisation/execution — see file header. */
export const SERVICE_CLASS_EXECUTION_REACHABLE: Record<FinancialServiceClass, boolean> = {
  advisor: false,
  architect: false,
  runtime: true,
};

// ── FinancialServiceDefinition — the catalog entry ──────────────────────

export interface FinancialServiceEligibilityPolicy {
  /** Re-checked via the SAME `resolveAgentAdmissionState` Gate 1 already calls — an early, presentational check, never a second admission decision. */
  requiresAdmission: boolean;
  /** `null` = no Standing floor. Non-null reuses `computeStandingScore()` (`services/standing/standingScore.ts`) — never a second Standing computation. */
  minimumStandingScore: number | null;
}

export interface FinancialServiceAuthorityRequirement {
  /** Acceptable `ConstitutionalAuthority.authoritySource` values; empty = any. */
  requiredAuthoritySource: string[];
  requiresActiveAuthority: boolean;
}

export interface FinancialServiceExecutionPolicy {
  /** The only execution primitive that exists anywhere in this codebase for this ontology: an intent binding via `bindExecution()`, never a signed/broadcast transfer. Always true — named explicitly so a reader never has to infer it. */
  boundedOnly: true;
  /** Whether this service class ever reaches AUTHORISED/execution at all. Mirrors `SERVICE_CLASS_EXECUTION_REACHABLE[serviceClass]` — carried on the definition too so a service's OWN record is self-describing without cross-referencing the class table. */
  executionReachable: boolean;
}

export interface FinancialServicePricingPolicy {
  /** Integer Q¢ cents (CLAUDE.md Q¢ convention — never a USD float). 0 = free. */
  priceQc: number;
}

export interface FinancialServiceReceiptPolicy {
  /** Whether this service's commerce receipts are DVN-anchorable. All six `commerce_*` ActivityActionTypes already are (`ANCHORABLE_ACTION_TYPES`); this field documents intent, it does not itself change anchoring behaviour. */
  anchorable: boolean;
}

export interface FinancialServiceDefinition {
  serviceId: string;
  serviceClass: FinancialServiceClass;
  displayName: string;
  /** The canonical `runtimeAgentId` of the agent that fulfils this service (`services/horizen/registrableAgents.ts`). */
  providerAgentId: string;
  /** The capability id resolved at the gateway (`resolveCapabilityProviders`/Gate 2). Runtime-class services MUST use the one Gate-2-gated capability id; advisor/architect may use any distinct id since preview/shadow pass Gate 2 unconditionally. */
  capabilityId: string;
  eligibilityPolicy: FinancialServiceEligibilityPolicy;
  authorityRequirement: FinancialServiceAuthorityRequirement;
  /** Whether a `ConsequenceProjection` must be composed before authorisation is attempted. Always `NOT_REQUIRED` for advisor/architect (they never reach authorisation). */
  projectionRequirement: 'NOT_REQUIRED' | 'REQUIRED';
  /** Reused directly from `constitutionalCommerce.ts` — never a second confidentiality vocabulary. */
  confidentialityRequirement: ConfidentialRequirement;
  /** Reused directly from `constitutionalCommerce.ts`. UNSPECIFIED fails closed exactly as it does in `unifiedConsequenceProjection.ts`. */
  attestationRequirement: AttestationRequirement;
  executionPolicy: FinancialServiceExecutionPolicy;
  pricingPolicy: FinancialServicePricingPolicy;
  receiptPolicy: FinancialServiceReceiptPolicy;
}

// ── FinancialServiceRequest — one consumer's request for one service ────

export interface FinancialServiceRequest {
  requestRef: string;
  serviceId: string;
  /** The CONSUMER — may be any admitted registrable agent, never assumed to be MoneyPenny. */
  requestingAgentId: string;
  principalRef: string;
  mandateRef: string;
  input: Record<string, unknown>;
  /** Only meaningful when the resolved service's `confidentialityRequirement === 'REQUIRED'`. */
  confidentialInputs?: Record<string, number> | null;
}

// ── FinancialServiceOutcome / Orchestration ─────────────────────────────

/**
 * `DELIVERED` is deliberately distinct from `AUTHORISED`: an advisor/architect
 * response is informational/a plan, never a constitutional authorisation to
 * act, and `deriveActionAuthorisation()` is never even called for those
 * classes — reusing `AUTHORISED` for them would overclaim what actually
 * happened.
 */
export type FinancialServiceOutcomeStatus = 'INELIGIBLE' | 'DELIVERED' | 'AUTHORISED' | 'REFUSED' | 'UNRESOLVED';

export interface FinancialServiceOutcome {
  requestRef: string;
  serviceId: string;
  serviceClass: FinancialServiceClass;
  status: FinancialServiceOutcomeStatus;
  reason: string;
  /** Present only for `runtime`-class services that reached a real `ActionAuthorisation`. */
  authorisationRef: string | null;
  executionRef: string | null;
  observedConsequenceRef: string | null;
  validationState: 'MATCHED_PROJECTION' | 'DIVERGED_FROM_PROJECTION' | 'UNRESOLVED' | null;
  /** Whether the projected disposition (runtime-class only) was ACCEPTABLE/UNACCEPTABLE/UNRESOLVED, for observability — null for advisor/architect (no projection is composed for them). */
  projectionDisposition: ProjectionDisposition | null;
}

export interface FinancialServiceOrchestrationStep {
  outcome: FinancialServiceOutcome;
}

/**
 * The "next/orchestrated service" record from the Stage 3.1 lifecycle spec —
 * a service-level sequence, one layer above the constitutional causal chain
 * (`services/constitutionalCommerce/causalChain.ts`), which already covers
 * the single-action reference trail. This is a read-only projection over
 * `FinancialServiceOutcome`s already produced elsewhere — it computes
 * nothing new and holds no parallel authority/authorisation state.
 */
export interface FinancialServiceOrchestration {
  orchestrationRef: string;
  consumerAgentId: string;
  steps: FinancialServiceOrchestrationStep[];
  /** The service this orchestration proposes to invoke next, if any. Not itself invoked here — a caller reads this and issues the next `FinancialServiceRequest`. */
  nextServiceId: string | null;
}
