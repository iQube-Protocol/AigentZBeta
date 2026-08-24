/**
 * ServiceOrchestrationPanel — cross-agent state isolation (2026-08-23 P0 repair).
 *
 * Live browser testing exposed a cross-agent client-state bleed: Nakamoto and
 * Kn0w1 shared Advisor/Architect input and result state because the panel's
 * `intents`/`outcomes` maps were keyed only by `serviceId`. Selecting a
 * different agent did not clear it either — a mutation the operator
 * explicitly forbade ("Do not merely clear state on agent switch") because
 * clearing loses the OTHER agent's own concurrent state instead of isolating
 * it.
 *
 * This module is the single source of truth for that state machine — a pure,
 * framework-independent reducer the component wires to `useReducer`. It is
 * extracted (rather than left inline in the component) because this repo's
 * test environment is `node` (no jsdom/RTL — see `vitest.config.mjs` and
 * `tests/moneypenny-service-orchestration-route.test.ts`'s header note), so a
 * REAL behavioural proof of cross-agent isolation requires the state
 * transitions to be callable and assertable without rendering React. The
 * component imports this file directly — there is no parallel/duplicated
 * copy of the transition logic anywhere.
 *
 * The isolation invariant: every mutable piece of per-request state (intent
 * text, outcome, provider output/result ref inside the outcome, the
 * requesting/loading flag, and the service-level error) is keyed on the
 * EXACT `(agentId, serviceId)` pair, never `serviceId` alone. A completion
 * action carries the `agentId` CAPTURED when the request began
 * (`REQUEST_START`) — never re-read from "whichever agent is selected now" —
 * so a response that resolves after the operator has switched agents still
 * writes only under its own originating agent.
 *
 * Discovery/admission-diagnostic state is agent-scoped differently: it
 * represents "the currently selected agent's live eligibility view", not a
 * per-agent cache, so it is guarded by a monotonically increasing
 * `discoveryGeneration` instead of a composite key — the reducer only applies
 * a `DISCOVERY_SUCCESS`/`DISCOVERY_ERROR` action when its `generation`
 * matches the CURRENT state's generation (i.e. no newer `SELECT_AGENT` has
 * happened since that fetch was issued). A stale discovery response for a
 * previously selected agent can therefore never overwrite what the operator
 * is looking at now.
 */

export interface AdvisorDisplayOutput {
  kind: "ADVISOR_RESPONSE";
  text: string;
}

export interface ArchitectDisplayOutput {
  kind: "ARCHITECT_PROPOSAL";
  title: string;
  preview: string;
  truncated: boolean;
  artifactId: string;
}

/** Constitutional Runtime's real execution result (the EXISTING
 *  constitutionalAgreement.ts 409 gate + runConstitutionalServicePattern
 *  pipeline) — never VELA's own authorisation/execution primitives. */
export interface RuntimeExecutionDisplayOutput {
  kind: "RUNTIME_EXECUTION";
  domain: string;
  executed: boolean;
  agreementId: string | null;
  summary: string;
}

export type ProviderDisplayOutput = AdvisorDisplayOutput | ArchitectDisplayOutput | RuntimeExecutionDisplayOutput;

export interface FinancialServiceOutcome {
  requestRef: string;
  serviceId: string;
  serviceClass: string;
  providerMode: string | null;
  status: string;
  reason: string;
  authorisationRef: string | null;
  executionRef: string | null;
  observedConsequenceRef: string | null;
  validationState: string | null;
  providerResultRef?: string | null;
  providerOutput?: ProviderDisplayOutput | null;
  errorCode?: "INFERENCE_PROVIDER_UNAVAILABLE" | null;
}

export interface FinancialServiceDefinitionSummary {
  serviceId: string;
  providerMode: string;
  serviceClass: string;
  displayName: string;
  attestationRequirement: string;
  /** Which constitutional mechanism governs this service (`types/financialServices.ts`).
   *  Always present on the real API payload — added here (2026-08-24 UI closeout) so the
   *  panel can render the Constitutional vs Confidential Runtime variant explicitly instead
   *  of inferring it from `providerMode` alone (both variants share `providerMode: 'RUNTIME'`). */
  governancePath?: string;
}

export interface EligibilityResult {
  eligible: boolean | undefined;
  code: string;
  reason: string;
}

export interface AuthorityPrerequisite {
  state: "NONE" | "PENDING" | "BOUNDED" | "ACTIVE";
  met: boolean;
  code: string;
  reason: string;
}

export type ReadinessState = "ready" | "not-ready" | "pending" | "unresolved" | "not-required";

/** A DERIVED, read-only readiness projection (2026-08-23) — see
 *  `services/financialServices/runtimeReadinessProjection.ts`'s header for
 *  the full invariant. Never a new frozen constitutional state.
 *  `systemReady` (2026-08-23 "close Standing + MoneyPenny Runtime" directive)
 *  is the Runtime pipeline's OWN operational fact — independent of the
 *  selected consumer's eligibility/standing/authority below it. */
export interface RuntimeReadinessProjection {
  systemReady: ReadinessState;
  eligibility: ReadinessState;
  standing: ReadinessState;
  authority: ReadinessState;
  confidentialExecution: ReadinessState;
}

export interface DiscoveredService {
  definition: FinancialServiceDefinitionSummary;
  eligibility: EligibilityResult;
  authority: AuthorityPrerequisite | null;
  readiness: RuntimeReadinessProjection | null;
}

/** `(agentId, serviceId)` -> value. Never keyed on `serviceId` alone. */
export type KeyedRecord<T> = Record<string, T>;

export function compositeKey(agentId: string, serviceId: string): string {
  return `${agentId}::${serviceId}`;
}

function setKeyed<T>(record: KeyedRecord<T>, agentId: string, serviceId: string, value: T): KeyedRecord<T> {
  return { ...record, [compositeKey(agentId, serviceId)]: value };
}

function clearKeyed<T>(record: KeyedRecord<T>, agentId: string, serviceId: string): KeyedRecord<T> {
  const key = compositeKey(agentId, serviceId);
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export interface PanelState {
  selectedAgentId: string | null;
  discovery: DiscoveredService[] | null;
  admissionDiagnostic: Record<string, unknown> | null;
  /** Bumped on every SELECT_AGENT; a discovery action for an older generation is dropped. */
  discoveryGeneration: number;
  loadingDiscovery: boolean;
  discoveryError: string | null;
  intents: KeyedRecord<string>;
  outcomes: KeyedRecord<FinancialServiceOutcome>;
  requestingKeys: KeyedRecord<true>;
  serviceErrors: KeyedRecord<string>;
}

export const initialPanelState: PanelState = {
  selectedAgentId: null,
  discovery: null,
  admissionDiagnostic: null,
  discoveryGeneration: 0,
  loadingDiscovery: false,
  discoveryError: null,
  intents: {},
  outcomes: {},
  requestingKeys: {},
  serviceErrors: {},
};

export type PanelAction =
  | { type: "SELECT_AGENT"; agentId: string; generation: number }
  | { type: "DISCOVERY_SUCCESS"; generation: number; discovery: DiscoveredService[]; admissionDiagnostic: Record<string, unknown> | null }
  | { type: "DISCOVERY_ERROR"; generation: number; error: string }
  | { type: "SET_INTENT"; agentId: string; serviceId: string; text: string }
  | { type: "REQUEST_START"; agentId: string; serviceId: string }
  | { type: "REQUEST_VALIDATION_ERROR"; agentId: string; serviceId: string; error: string }
  | { type: "REQUEST_SUCCESS"; agentId: string; serviceId: string; outcome: FinancialServiceOutcome }
  | { type: "REQUEST_ERROR"; agentId: string; serviceId: string; error: string };

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "SELECT_AGENT":
      // Selecting an agent resets the DISCOVERY view only — every per-
      // (agent, service) map (intents/outcomes/requestingKeys/serviceErrors)
      // is left untouched, so switching back restores that agent's own
      // state exactly as it was (never "merely clear state on agent switch").
      return {
        ...state,
        selectedAgentId: action.agentId,
        discovery: null,
        admissionDiagnostic: null,
        discoveryError: null,
        loadingDiscovery: true,
        discoveryGeneration: action.generation,
      };

    case "DISCOVERY_SUCCESS":
      if (action.generation !== state.discoveryGeneration) return state; // stale — a newer selection superseded this fetch
      return {
        ...state,
        discovery: action.discovery,
        admissionDiagnostic: action.admissionDiagnostic,
        loadingDiscovery: false,
      };

    case "DISCOVERY_ERROR":
      if (action.generation !== state.discoveryGeneration) return state; // stale
      return { ...state, discoveryError: action.error, loadingDiscovery: false };

    case "SET_INTENT":
      return { ...state, intents: setKeyed(state.intents, action.agentId, action.serviceId, action.text) };

    case "REQUEST_START":
      return {
        ...state,
        requestingKeys: setKeyed(state.requestingKeys, action.agentId, action.serviceId, true),
        serviceErrors: clearKeyed(state.serviceErrors, action.agentId, action.serviceId),
      };

    case "REQUEST_VALIDATION_ERROR":
      return { ...state, serviceErrors: setKeyed(state.serviceErrors, action.agentId, action.serviceId, action.error) };

    case "REQUEST_SUCCESS":
      // `action.agentId` is the requestAgentId CAPTURED by the caller before
      // the request began — never re-derived from "the selected agent now".
      // A response landing after the operator switched agents still writes
      // only under its own originating (agentId, serviceId) key.
      return {
        ...state,
        outcomes: setKeyed(state.outcomes, action.agentId, action.serviceId, action.outcome),
        requestingKeys: clearKeyed(state.requestingKeys, action.agentId, action.serviceId),
      };

    case "REQUEST_ERROR":
      return {
        ...state,
        serviceErrors: setKeyed(state.serviceErrors, action.agentId, action.serviceId, action.error),
        requestingKeys: clearKeyed(state.requestingKeys, action.agentId, action.serviceId),
      };

    default:
      return state;
  }
}

// ── Selectors — every read goes through the exact composite key too ────────

export function selectIntent(state: PanelState, agentId: string | null, serviceId: string): string {
  if (!agentId) return "";
  return state.intents[compositeKey(agentId, serviceId)] ?? "";
}

export function selectOutcome(state: PanelState, agentId: string | null, serviceId: string): FinancialServiceOutcome | undefined {
  if (!agentId) return undefined;
  return state.outcomes[compositeKey(agentId, serviceId)];
}

export function selectIsRequesting(state: PanelState, agentId: string | null, serviceId: string): boolean {
  if (!agentId) return false;
  return Boolean(state.requestingKeys[compositeKey(agentId, serviceId)]);
}

export function selectServiceError(state: PanelState, agentId: string | null, serviceId: string): string | undefined {
  if (!agentId) return undefined;
  return state.serviceErrors[compositeKey(agentId, serviceId)];
}
