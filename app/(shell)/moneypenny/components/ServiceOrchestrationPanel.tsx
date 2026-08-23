/**
 * ServiceOrchestrationPanel — Phase 3 Track A, the operator-facing MoneyPenny
 * Financial Services oversight console.
 *
 * "It shows admitted agents consuming services and lets the human principal
 * observe/trigger/authorise them." (operator ruling, 2026-08-22). This is an
 * OVERSIGHT surface, not a first-person consumer flow: the human operator
 * picks one of MoneyPenny's own admitted, delegated agents (Nakamoto/Kn0w1/
 * MoneyPenny herself) and observes/triggers THAT agent's consumption of a
 * Financial Service. The human is never `requestingAgentId`.
 *
 * Distinct from — and does not duplicate — PRD-MPY-001's existing Architect/
 * Runtime panels (`ArchitectPanel.tsx`, `RuntimePanel.tsx`): those remain
 * MoneyPenny's canonical modes. This panel is generic across MoneyPenny's
 * four Financial Services (Advisor/Architect/Runtime-Confidential/
 * Runtime-Constitutional) and across consumers — it "routes into" the
 * existing mode panels rather than re-implementing them (a link per
 * `serviceId`, below — both Runtime variants share `providerMode: 'RUNTIME'`
 * but are distinct catalog entries with distinct gating, see
 * `services/financialServices/serviceCatalog.ts`).
 *
 * Spine-authenticated via personaFetch (CLAUDE.md PARAMOUNT). Slate house
 * style — no white hairlines.
 *
 * 2026-08-23 P0 — cross-agent state isolation: every mutable per-request
 * piece of state (intent, outcome, provider output, requesting/loading, the
 * service-level error) is keyed on the exact `(agentId, serviceId)` pair via
 * `serviceOrchestrationPanelState.ts`'s reducer — never on `serviceId` alone,
 * and never cleared on agent switch. See that module's header for the full
 * invariant and why the state machine is extracted into a plain, testable
 * reducer rather than left inline (this repo's tests run in a `node`
 * environment — no jsdom/RTL — so a real behavioural proof of isolation
 * requires the transitions to be unit-testable without rendering React).
 */

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Network, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  panelReducer,
  initialPanelState,
  selectIntent,
  selectOutcome,
  selectIsRequesting,
  selectServiceError,
  type FinancialServiceDefinitionSummary,
  type DiscoveredService,
  type EligibilityResult,
  type AuthorityPrerequisite,
  type ReadinessState,
  type RuntimeReadinessProjection,
} from "./serviceOrchestrationPanelState";

interface RegistrableAgentSummary {
  slug: string;
  displayName: string;
  runtimeAgentId: string;
}

/**
 * Every service requiring a real, operator-entered request — never a
 * synthesized one (2026-08-23 orchestration-boundary repair). Keyed by
 * `serviceId`, NOT `providerMode`: both Runtime variants
 * (`moneypenny.runtime` Confidential, `moneypenny.runtime.constitutional`
 * Constitutional) share `providerMode: 'RUNTIME'` but need distinct UI
 * treatment — only the Constitutional variant takes an inline intent here
 * (the Confidential variant can never dispatch from this console without
 * Vela attestation, so it keeps its existing "Open in MoneyPenny Runtime"
 * link only).
 */
const SERVICE_INTENT_PROMPT: Record<string, string> = {
  "moneypenny.advisor": "What should MoneyPenny advise this agent about?",
  "moneypenny.architect": "What financial structure should MoneyPenny design?",
  "moneypenny.runtime.constitutional": "What should MoneyPenny do (Constitutional Runtime, no Vela attestation)?",
};

// Mirrors CanonicalSurfaceStyling — translucent slate, slate hairlines.
const PANEL_CLASS = "bg-slate-900/40 border-slate-800 backdrop-blur-xl";

/** Deep-links into MoneyPenny's own dedicated mode panels — keyed by
 *  `serviceId` for the same reason as `SERVICE_INTENT_PROMPT` above. */
const SERVICE_ROUTE: Record<string, string> = {
  "moneypenny.architect": "architect",
  "moneypenny.runtime": "runtime",
  "moneypenny.runtime.constitutional": "runtime",
};

const ELIGIBILITY_TONE: Record<string, string> = {
  true: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  false: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  undefined: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const STATUS_TONE: Record<string, string> = {
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  AUTHORISED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  UNRESOLVED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  REFUSED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  INELIGIBLE: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

function eligibilityLabel(eligible: boolean | undefined): string {
  if (eligible === true) return "eligible";
  if (eligible === false) return "not eligible";
  return "undetermined";
}

const READINESS_TONE: Record<ReadinessState, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  "not-ready": "border-rose-500/30 bg-rose-500/10 text-rose-300",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  unresolved: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "not-required": "border-slate-700 text-white/40",
};

/**
 * "The desired pre-Vela UI is not generic UNRESOLVED. It should make the
 * layered readiness visible" (2026-08-23 operator directive). `readiness`'s
 * `confidentialExecution` field is always about Vela attestation
 * specifically, so `pending` on that one field reads as the exact phrase the
 * operator asked for.
 */
function readinessLabel(field: keyof RuntimeReadinessProjection, state: ReadinessState): string {
  if (field === "systemReady") {
    return state === "ready" ? "Runtime: system ready" : `Runtime: ${state}`;
  }
  if (field === "confidentialExecution") {
    if (state === "pending") return "Confidential execution: Vela Live attestation pending";
    if (state === "not-required") return "Confidential execution: not required";
    return `Confidential execution: ${state}`;
  }
  const fieldLabel = field === "eligibility" ? "Eligibility" : field === "standing" ? "Standing" : "Authority";
  return `${fieldLabel}: ${state}`;
}

export function ServiceOrchestrationPanel() {
  const [agents, setAgents] = useState<RegistrableAgentSummary[]>([]);
  const [catalog, setCatalog] = useState<FinancialServiceDefinitionSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // Cross-agent-isolated state — see serviceOrchestrationPanelState.ts.
  const [state, dispatch] = useReducer(panelReducer, initialPanelState);
  const discoveryGenerationCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/moneypenny/service-orchestration", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setCatalogError(data.error ?? "Failed to load Financial Services catalog");
          return;
        }
        setAgents(data.agents ?? []);
        setCatalog(data.catalog ?? []);
      } catch {
        if (!cancelled) setCatalogError("Failed to load Financial Services catalog");
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDiscovery = useCallback(async (agentId: string, generation: number) => {
    try {
      const res = await personaFetch(
        `/api/moneypenny/service-orchestration?agentId=${encodeURIComponent(agentId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        dispatch({ type: "DISCOVERY_ERROR", generation, error: data.error ?? `Failed to resolve eligibility for ${agentId}` });
        return;
      }
      dispatch({
        type: "DISCOVERY_SUCCESS",
        generation,
        discovery: data.discovery ?? [],
        admissionDiagnostic: data.admissionDiagnostic ?? null,
      });
    } catch {
      dispatch({ type: "DISCOVERY_ERROR", generation, error: `Failed to resolve eligibility for ${agentId}` });
    }
  }, []);

  const selectAgent = useCallback(
    (agentId: string) => {
      // A fresh generation on every selection — the reducer drops any
      // DISCOVERY_* action whose generation doesn't match the CURRENT state,
      // so a slow response for a previously selected agent can never
      // overwrite what the operator is looking at now (P0).
      const generation = ++discoveryGenerationCounter.current;
      dispatch({ type: "SELECT_AGENT", agentId, generation });
      void loadDiscovery(agentId, generation);
    },
    [loadDiscovery],
  );

  const requestService = useCallback(
    async (definition: FinancialServiceDefinitionSummary) => {
      // Captured NOW, before the async request begins — the completion below
      // writes ONLY to this agent's composite key, never to "whichever agent
      // happens to be selected when the response arrives" (P0).
      const requestAgentId = state.selectedAgentId;
      if (!requestAgentId) return;
      const serviceId = definition.serviceId;
      const needsIntent = Boolean(SERVICE_INTENT_PROMPT[serviceId]);
      const intentText = selectIntent(state, requestAgentId, serviceId).trim();
      if (needsIntent && !intentText) {
        dispatch({
          type: "REQUEST_VALIDATION_ERROR",
          agentId: requestAgentId,
          serviceId,
          error: `Enter a request for ${definition.displayName} before triggering it`,
        });
        return;
      }

      dispatch({ type: "REQUEST_START", agentId: requestAgentId, serviceId });
      try {
        const res = await personaFetch("/api/moneypenny/service-orchestration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: requestAgentId,
            serviceId,
            input: needsIntent ? { intent: intentText } : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          // Always prefer the route's own structured reason (and the bounded
          // lifecycle `stage` it happened in, when present) over the generic
          // fallback — a malformed/missing-input failure must be visibly
          // distinguishable from every other kind of failure, never
          // collapsed into one indistinguishable "Request ... failed"
          // (2026-08-23 orchestration-boundary repair).
          const reason = data?.error ? String(data.error) : `Request to '${serviceId}' failed`;
          dispatch({
            type: "REQUEST_ERROR",
            agentId: requestAgentId,
            serviceId,
            error: data?.stage ? `${reason} (${data.stage})` : reason,
          });
          return;
        }
        dispatch({ type: "REQUEST_SUCCESS", agentId: requestAgentId, serviceId, outcome: data.outcome });
      } catch {
        dispatch({
          type: "REQUEST_ERROR",
          agentId: requestAgentId,
          serviceId,
          error: `Request to '${serviceId}' failed — no response from the server`,
        });
      }
    },
    [state],
  );

  const selectedAgentId = state.selectedAgentId;

  return (
    <Card className={`${PANEL_CLASS} h-full flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white/90">
          <Network className="h-5 w-5 text-emerald-400" />
          Financial Service Orchestration
        </CardTitle>
        <CardDescription className="text-white/60">
          Oversight console: observe and trigger an admitted, delegated agent&apos;s consumption of a
          MoneyPenny Financial Service. The human principal is never the consumer — the agent below
          is.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {catalogError && <p className="text-sm text-rose-400">{catalogError}</p>}

        {loadingCatalog ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <Button
                key={agent.runtimeAgentId}
                variant="outline"
                size="sm"
                onClick={() => selectAgent(agent.runtimeAgentId)}
                className={
                  selectedAgentId === agent.runtimeAgentId
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-800 bg-slate-900/40 text-white/70 hover:bg-slate-800/60"
                }
              >
                {agent.displayName}
              </Button>
            ))}
          </div>
        )}

        {selectedAgentId && (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/90">
                {agents.find((a) => a.runtimeAgentId === selectedAgentId)?.displayName ?? selectedAgentId}
              </h3>
              <div className="flex items-center gap-2">
                {state.loadingDiscovery && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
                {state.admissionDiagnostic && (
                  <button
                    type="button"
                    onClick={() => setShowDiagnostic((v) => !v)}
                    className="text-[10px] text-white/40 underline hover:text-white/70"
                  >
                    {showDiagnostic ? "hide" : "show"} admission diagnostic
                  </button>
                )}
              </div>
            </div>

            {state.discoveryError && <p className="text-xs text-rose-400">{state.discoveryError}</p>}

            {showDiagnostic && state.admissionDiagnostic && (
              <pre className="overflow-x-auto rounded border border-slate-800 bg-black/30 p-2 text-[10px] text-white/60">
                {JSON.stringify(state.admissionDiagnostic, null, 2)}
              </pre>
            )}

            {(state.discovery ?? catalog.map((definition) => ({ definition, eligibility: undefined as unknown as EligibilityResult, authority: null as AuthorityPrerequisite | null, readiness: null })))
              .map(({ definition, eligibility, authority, readiness }: DiscoveredService) => {
                const outcome = selectOutcome(state, selectedAgentId, definition.serviceId);
                const isRequesting = selectIsRequesting(state, selectedAgentId, definition.serviceId);
                const serviceError = selectServiceError(state, selectedAgentId, definition.serviceId);
                const intentValue = selectIntent(state, selectedAgentId, definition.serviceId);
                const route = SERVICE_ROUTE[definition.serviceId];
                return (
                  <div key={definition.serviceId} className="flex flex-col gap-2 rounded border border-slate-800 bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/90">{definition.displayName}</span>
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-white/50">
                          {definition.providerMode} / {definition.serviceClass}
                        </span>
                        {definition.attestationRequirement === "REQUIRED" && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                            attestation required
                          </span>
                        )}
                      </div>
                      {route && (
                        <a
                          href={`?panel=${route}`}
                          className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"
                        >
                          Open in MoneyPenny {definition.providerMode.charAt(0)}
                          {definition.providerMode.slice(1).toLowerCase()} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {eligibility && (
                      <span
                        className={`w-fit rounded border px-1.5 py-0.5 text-[10px] ${ELIGIBILITY_TONE[String(eligibility.eligible)]}`}
                      >
                        {eligibilityLabel(eligibility.eligible)} — {eligibility.code}
                      </span>
                    )}

                    {/* Authority is a SEPARATE, non-blocking prerequisite for
                        Runtime — a service can be eligible while this still
                        reads "current delegation/mandate required". */}
                    {authority && (
                      <span
                        className={`w-fit rounded border px-1.5 py-0.5 text-[10px] ${
                          authority.met
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        Authority: {authority.met ? "current" : "current delegation/mandate required"} ({authority.state})
                      </span>
                    )}

                    {/* Layered readiness — "the desired pre-Vela UI is not
                        generic UNRESOLVED" (2026-08-23). A derived, read-only
                        projection over facts already shown above; never a
                        new constitutional state. `systemReady` renders FIRST
                        and independently of the consumer-specific fields that
                        follow it — a consumer refused on standing/authority
                        never reads as the Runtime itself being down. */}
                    {readiness && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["systemReady", "eligibility", "standing", "authority", "confidentialExecution"] as const).map((field) => (
                          <span
                            key={field}
                            className={`w-fit rounded border px-1.5 py-0.5 text-[10px] ${READINESS_TONE[readiness[field]]}`}
                          >
                            {readinessLabel(field, readiness[field])}
                          </span>
                        ))}
                      </div>
                    )}

                    {SERVICE_INTENT_PROMPT[definition.serviceId] && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`intent-${definition.serviceId}`} className="text-[10px] text-white/50">
                          {SERVICE_INTENT_PROMPT[definition.serviceId]}
                        </label>
                        <textarea
                          id={`intent-${definition.serviceId}`}
                          value={intentValue}
                          onChange={(e) =>
                            dispatch({
                              type: "SET_INTENT",
                              agentId: selectedAgentId,
                              serviceId: definition.serviceId,
                              text: e.target.value,
                            })
                          }
                          rows={2}
                          placeholder="Enter the request the agent should carry to MoneyPenny…"
                          className="w-full resize-none rounded border border-slate-800 bg-black/30 p-2 text-xs text-white/80 placeholder:text-white/30 focus:border-emerald-500/40 focus:outline-none"
                        />
                      </div>
                    )}

                    {serviceError && <p className="text-[10px] text-rose-400">{serviceError}</p>}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={
                          isRequesting ||
                          eligibility?.eligible !== true ||
                          (Boolean(SERVICE_INTENT_PROMPT[definition.serviceId]) && !intentValue.trim())
                        }
                        onClick={() => void requestService(definition)}
                        className="w-fit bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        {isRequesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        Trigger
                      </Button>
                      {outcome && (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[outcome.status] ?? "border-slate-700 text-white/60"}`}>
                          {outcome.errorCode === "INFERENCE_PROVIDER_UNAVAILABLE"
                            ? "UNRESOLVED — inference provider unavailable"
                            : `${outcome.status} — ${outcome.reason}`}
                        </span>
                      )}
                    </div>

                    {/* An inference-provider-infrastructure failure is never
                        "Architect refused" — the bounded diagnostic is shown
                        separately from the badge above so the two read as
                        distinct things: a status, and a detail. */}
                    {outcome?.errorCode === "INFERENCE_PROVIDER_UNAVAILABLE" && (
                      <p className="text-[10px] text-amber-300/80">{outcome.reason}</p>
                    )}

                    {outcome?.providerOutput?.kind === "ADVISOR_RESPONSE" && (
                      <div className="rounded border border-slate-800 bg-black/30 p-2 text-xs text-white/80 whitespace-pre-wrap">
                        {outcome.providerOutput.text}
                      </div>
                    )}

                    {outcome?.providerOutput?.kind === "ARCHITECT_PROPOSAL" && (
                      <div className="rounded border border-slate-800 bg-black/30 p-2 text-xs text-white/80">
                        <div className="mb-1 font-semibold text-white/90">{outcome.providerOutput.title}</div>
                        <p className="whitespace-pre-wrap text-white/70">{outcome.providerOutput.preview}</p>
                        {outcome.providerOutput.truncated && (
                          <a
                            href={`?panel=architect&artifactId=${encodeURIComponent(outcome.providerOutput.artifactId)}`}
                            className="mt-1 flex w-fit items-center gap-1 text-[10px] text-white/50 hover:text-white/80"
                          >
                            View full proposal <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {outcome?.providerOutput?.kind === "RUNTIME_EXECUTION" && (
                      <div className="rounded border border-slate-800 bg-black/30 p-2 text-xs text-white/80">
                        {outcome.providerOutput.summary}
                      </div>
                    )}

                    {outcome && (outcome.executionRef || outcome.authorisationRef || outcome.providerResultRef) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-white/40">
                        {outcome.authorisationRef && <span>authorisation: {outcome.authorisationRef}</span>}
                        {outcome.executionRef && <span>execution: {outcome.executionRef}</span>}
                        {outcome.providerResultRef && <span>result: {outcome.providerResultRef}</span>}
                        {outcome.validationState && <span>validation: {outcome.validationState}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ServiceOrchestrationPanel;
