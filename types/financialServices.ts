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

// ── Consequence classes (generic, provider-neutral) ─────────────────────

/**
 * The generic constitutional-consequence taxonomy a Financial Service
 * belongs to — provider-neutral, so a future non-MoneyPenny provider is
 * never forced into MoneyPenny's own mode vocabulary (see `providerMode`
 * below). Each class maps to exactly one `CapabilityExecutionMode` — the
 * mapping IS the mechanism that keeps INFORMATIONAL/PROPOSAL from ever
 * reaching a real authorisation without any branch in the orchestrator's own
 * code: Gate 2 (`services/registry/capabilityInvocationGates.ts`) already
 * treats `preview`/`shadow` as unconditionally passable and `authoritative`
 * as refused-by-default-except-the-one-named-capability. Nothing here
 * reimplements that; it only selects which mode a service requests.
 *
 *   INFORMATIONAL -> preview      — informational only; never executes
 *   PROPOSAL      -> shadow       — proposes/plans; never authorises the
 *                                    real action (existing
 *                                    `deriveActionAuthorisation` rule:
 *                                    "shadow-only" is REFUSED)
 *   CONSEQUENTIAL -> authoritative — the only class that can reach
 *                                    AUTHORISED and bind execution
 *
 * Operator ruling (2026-08-22): this replaces an earlier `advisor|architect
 * |runtime` serviceClass — those names are MoneyPenny's own `providerMode`
 * (PRD-MPY-001's pre-existing, canonical vocabulary for her operating
 * modes), not a generic taxonomy. Conflating the two would have created a
 * second "Architect"/"Runtime" concept alongside PRD-MPY-001's already-live
 * one under the same names but a different ontology.
 */
export type FinancialServiceConsequenceClass = 'INFORMATIONAL' | 'PROPOSAL' | 'CONSEQUENTIAL';

export const SERVICE_CLASS_EXECUTION_MODE: Record<FinancialServiceConsequenceClass, CapabilityExecutionMode> = {
  INFORMATIONAL: 'preview',
  PROPOSAL: 'shadow',
  CONSEQUENTIAL: 'authoritative',
};

/** Only `CONSEQUENTIAL`-class services ever attempt authorisation/execution — see file header. */
export const SERVICE_CLASS_EXECUTION_REACHABLE: Record<FinancialServiceConsequenceClass, boolean> = {
  INFORMATIONAL: false,
  PROPOSAL: false,
  CONSEQUENTIAL: true,
};

/**
 * The execution/governance-path discriminator (operator ruling, 2026-08-23,
 * correcting an earlier repair pass that had misclassified MoneyPenny's
 * Constitutional Runtime as `serviceClass: 'PROPOSAL'` purely to dodge Gate
 * 2's `authoritative`-mode refusal).
 *
 * `serviceClass` answers "what KIND of consequence does this service carry"
 * — a generic, provider-neutral taxonomy. It does NOT answer "which
 * constitutional mechanism actually governs that consequence." Two services
 * can both be genuinely `CONSEQUENTIAL` (both bind real financial
 * consequence) while being governed by two entirely different, mutually
 * exclusive mechanisms — and `serviceClass` alone cannot express that
 * without collapsing one into looking like the other's class. This field is
 * the second axis that keeps them distinct:
 *
 *   NONE                          — no constitutional execution mechanism
 *                                    applies (Advisor/Architect: informational
 *                                    or proposal-only, never execute anything)
 *   CONSTITUTIONAL_SERVICE_PIPELINE — governed by the EXISTING, unmodified
 *                                    PRD-MPY-001 pipeline
 *                                    (`runConstitutionalServicePattern()` +
 *                                    `constitutionalAgreement.ts`'s own 409
 *                                    gate). MoneyPenny's Constitutional
 *                                    Runtime (`moneypenny.runtime.constitutional`).
 *   CONSTITUTIONAL_COMMERCE       — governed by the frozen VELA-001
 *                                    constitutional-commerce ontology
 *                                    (`composeUnifiedConsequenceProjection` /
 *                                    `deriveActionAuthorisation` /
 *                                    `bindExecution`). MoneyPenny's
 *                                    Confidential Runtime (`moneypenny.runtime`).
 *
 * CRITICAL: this field must NEVER be used to widen Gate 2. Gate 2
 * (`services/registry/capabilityInvocationGates.ts`) remains completely
 * unmodified and still refuses `authoritative` execution mode for every
 * capability id except the one frozen exception
 * (`CONFIDENTIAL_CONSEQUENCE_PROJECTION`). What this field changes is which
 * Gate-2-request MODE a service asks for in the first place — see
 * `GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE` below — never what Gate 2 itself
 * permits once asked. A `CONSTITUTIONAL_SERVICE_PIPELINE` service requests
 * `shadow` (Gate 2's existing unconditional pass, identical to
 * Advisor/Architect's own request) precisely so it is never routed through
 * Gate 2's `authoritative`-mode exception at all — its real authoritative
 * decision happens entirely downstream, inside the unmodified constitutional
 * service pipeline, never inside Gate 2 and never inside VELA's
 * ActionAuthorisation/execution primitives.
 */
export type FinancialServiceGovernancePath = 'NONE' | 'CONSTITUTIONAL_SERVICE_PIPELINE' | 'CONSTITUTIONAL_COMMERCE';

/**
 * The Gate-2-request `executionMode` a real governed mechanism requires —
 * NEVER derived from `serviceClass` for these two paths, precisely so
 * `CONSEQUENTIAL` does not collapse onto Gate 2's frozen `authoritative`
 * exception merely by declaring the class. `NONE` has no entry here; a
 * `NONE`-path service (Advisor/Architect) falls back to
 * `SERVICE_CLASS_EXECUTION_MODE[serviceClass]` (preview/shadow respectively).
 */
export const GOVERNANCE_PATH_EXECUTION_MODE_OVERRIDE: Partial<Record<FinancialServiceGovernancePath, CapabilityExecutionMode>> = {
  CONSTITUTIONAL_SERVICE_PIPELINE: 'shadow',
  CONSTITUTIONAL_COMMERCE: 'authoritative',
};

// ── Provider modes (provider-specific) ───────────────────────────────────

/**
 * MoneyPenny's own canonical operating modes (PRD-MPY-001) — how SHE
 * performs a service, distinct from what constitutional consequence class
 * it belongs to. A future second provider defines its own `providerMode`
 * vocabulary; nothing here requires it to have an "Architect mode" or a
 * "Runtime mode" of its own.
 */
export type MoneyPennyProviderMode = 'ADVISOR' | 'ARCHITECT' | 'RUNTIME';

/**
 * The single explicit mapping MoneyPenny's catalog entries derive
 * `serviceClass` from — one place, so `providerMode` and `serviceClass`
 * can never drift apart on a MoneyPenny catalog entry. Not itself a second
 * implementation of anything: it is data, read by
 * `services/financialServices/serviceCatalog.ts`.
 */
export const MONEYPENNY_PROVIDER_MODE_CONSEQUENCE_CLASS: Record<MoneyPennyProviderMode, FinancialServiceConsequenceClass> = {
  ADVISOR: 'INFORMATIONAL',
  ARCHITECT: 'PROPOSAL',
  RUNTIME: 'CONSEQUENTIAL',
};

// ── FinancialServiceDefinition — the catalog entry ──────────────────────

/**
 * Whether a CONSUMER of this service must itself hold completed Financial
 * Services (Pulse + P&L) verification. Reuses the `REQUIRED`/`NOT_REQUIRED`
 * vocabulary already established by `AttestationRequirement`/
 * `ConfidentialRequirement` (`constitutionalCommerce.ts`) rather than a
 * second boolean-vs-string-union convention.
 *
 * Operator correction, 2026-08-23 (second correction pass): Financial
 * Services verification (`services/journey/agentFinancialServicesVerification.ts`)
 * answers "may THIS agent perform Financial Services work" — a
 * PROVIDER/specialist qualification question. Nakamoto/Kn0w1 requesting a
 * MoneyPenny service are CONSUMERS of that service, not providers of
 * Financial Services themselves, so this must default to `NOT_REQUIRED` and
 * never be folded into `requiresAdmission`. A future service that genuinely
 * needs its CONSUMER to be independently FS-verified declares
 * `REQUIRED` explicitly here — never inferred from admission.
 */
export type ConsumerVerificationRequirement = 'NOT_REQUIRED' | 'REQUIRED';

export interface FinancialServiceEligibilityPolicy {
  /** Re-checked via the SAME `resolveAgentAdmissionState` Gate 1 already calls — an early, presentational check, never a second admission decision. */
  requiresAdmission: boolean;
  /** See `ConsumerVerificationRequirement`'s doc above. */
  consumerVerificationRequirement: ConsumerVerificationRequirement;
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
  /** Generic, provider-neutral constitutional-consequence class — see the type doc above. */
  serviceClass: FinancialServiceConsequenceClass;
  /** Which constitutional mechanism actually governs this service's consequence — see `FinancialServiceGovernancePath`'s doc above. Independent of `serviceClass`; two `CONSEQUENTIAL` services may declare two different governance paths. */
  governancePath: FinancialServiceGovernancePath;
  /**
   * The PROVIDER's own operating-mode label (e.g. MoneyPenny's canonical
   * ADVISOR|ARCHITECT|RUNTIME, PRD-MPY-001). Deliberately typed `string`
   * here, not `MoneyPennyProviderMode` — a future non-MoneyPenny provider
   * defines its own vocabulary; nothing in the shared contract may require
   * it to reuse MoneyPenny's mode names.
   */
  providerMode: string;
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
  /**
   * Deprecated as caller input (2026-08-23 repair pass, Repair C): the real
   * principal/mandate are now resolved server-side by
   * `services/financialServices/constitutionalAuthorityAdapter.ts` from the
   * authenticated caller's identity — never accepted from a client. Optional
   * so no caller needs to fabricate a value; `requestFinancialService()`
   * ignores these fields entirely.
   */
  principalRef?: string;
  mandateRef?: string;
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
  serviceClass: FinancialServiceConsequenceClass;
  /** The resolved definition's `providerMode`, e.g. MoneyPenny's ADVISOR|ARCHITECT|RUNTIME. `null` only when no definition could be resolved (unknown serviceId). */
  providerMode: string | null;
  status: FinancialServiceOutcomeStatus;
  reason: string;
  /** Present only for `CONSEQUENTIAL`-class services that reached a real `ActionAuthorisation`. */
  authorisationRef: string | null;
  executionRef: string | null;
  observedConsequenceRef: string | null;
  validationState: 'MATCHED_PROJECTION' | 'DIVERGED_FROM_PROJECTION' | 'UNRESOLVED' | null;
  /** Whether the projected disposition (runtime-class only) was ACCEPTABLE/UNACCEPTABLE/UNRESOLVED, for observability — null for advisor/architect (no projection is composed for them). */
  projectionDisposition: ProjectionDisposition | null;
  /**
   * A reference to the REAL provider output this outcome is evidence of
   * (2026-08-23 repair pass, Repair D — "receive a real successful provider
   * result -> persist/reference its real output evidence"). For Architect,
   * the persisted `moneyPennyArchitect.ts` artifact id (already self-
   * persisted via `saveArtifactRecord`). For Advisor, a commitment over the
   * response text (never the raw response — this envelope is receipt-
   * adjacent). Omitted/undefined for runtime-class outcomes and for any
   * outcome that never reached a completed provider call.
   */
  providerResultRef?: string | null;
  /**
   * Operator-visible provider output for this outcome (2026-08-23 repair
   * pass, Part B) — see the `ProviderDisplayOutput` doc above. Additive
   * display data alongside `providerResultRef`, never a replacement for it.
   * Present only when a provider call actually completed successfully.
   */
  providerOutput?: ProviderDisplayOutput | null;
  /**
   * Set ONLY for the one infrastructure-level inference failure this
   * platform classifies distinctly
   * (`services/constitutional/modelRouter.ts::INFERENCE_PROVIDER_UNAVAILABLE`)
   * — never for a content-quality or governance refusal. Lets a caller
   * render "UNRESOLVED — inference provider unavailable" rather than
   * implying the service itself refused the request.
   */
  errorCode?: 'INFERENCE_PROVIDER_UNAVAILABLE' | null;
}

// ── Provider display output (2026-08-23 repair pass, Part B) ────────────
//
// Deliberately OUTSIDE the frozen VELA-001 constitutional-commerce ontology
// (Authority/Projection/Authorisation/Execution/ObservedConsequence) — this
// is SERVICE OUTPUT a human reads, not a second constitutional mechanism.
// `providerResultRef` on `FinancialServiceOutcome` remains the one immutable
// evidence/commitment reference for a delivered outcome; `providerOutput`
// below is purely a display payload alongside it. Neither field replaces the
// other: the operator directive was explicit that the evidence reference
// must never be swapped out for raw prose, and that the real provider output
// must never be silently discarded either.

/** MoneyPenny's real prose answer (ADVISOR/INFORMATIONAL class). The FULL
 *  text — never truncated, never replaced by the `providerResultRef` hash. */
export interface AdvisorDisplayOutput {
  kind: 'ADVISOR_RESPONSE';
  text: string;
}

/** The Architect's designed proposal (ARCHITECT/PROPOSAL class). The
 *  canonical, complete body is the persisted artifact record (`artifactId`,
 *  already durable via `saveArtifactRecord`) — `preview` is a bounded display
 *  convenience over it, never a second source of truth. */
export interface ArchitectDisplayOutput {
  kind: 'ARCHITECT_PROPOSAL';
  title: string;
  preview: string;
  truncated: boolean;
  artifactId: string;
}

/** The Constitutional Runtime's real execution result (RUNTIME/PROPOSAL
 *  class, `moneypenny.runtime.constitutional`) — the EXISTING
 *  `constitutionalAgreement.ts` 409 gate + `runConstitutionalServicePattern`
 *  pipeline result, never VELA's own authorisation/execution primitives. */
export interface RuntimeExecutionDisplayOutput {
  kind: 'RUNTIME_EXECUTION';
  domain: string;
  executed: boolean;
  agreementId: string | null;
  summary: string;
}

export type ProviderDisplayOutput = AdvisorDisplayOutput | ArchitectDisplayOutput | RuntimeExecutionDisplayOutput;

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
