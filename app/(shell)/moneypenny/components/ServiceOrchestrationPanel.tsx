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
 * three Financial Services (Advisor/Architect/Runtime `providerMode`) and
 * across consumers — it "routes into" the existing mode panels rather than
 * re-implementing them (a link per providerMode, below).
 *
 * Spine-authenticated via personaFetch (CLAUDE.md PARAMOUNT). Slate house
 * style — no white hairlines.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Network, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface RegistrableAgentSummary {
  slug: string;
  displayName: string;
  runtimeAgentId: string;
}

interface FinancialServiceDefinitionSummary {
  serviceId: string;
  providerMode: string;
  serviceClass: string;
  displayName: string;
  attestationRequirement: string;
}

interface EligibilityResult {
  eligible: boolean | undefined;
  code: string;
  reason: string;
}

/**
 * Non-blocking Authority Plane prerequisite (2026-08-23 correction) — present
 * only for Runtime (`executionReachable`). A service can be `eligible` while
 * this reads `met: false`: eligibility is structural (admission + assignment
 * + verification + Standing); authority is the separate, current-delegation/
 * mandate fact a CONSEQUENTIAL action still needs before it can execute.
 */
interface AuthorityPrerequisite {
  state: 'NONE' | 'PENDING' | 'BOUNDED' | 'ACTIVE';
  met: boolean;
  code: string;
  reason: string;
}

interface DiscoveredService {
  definition: FinancialServiceDefinitionSummary;
  eligibility: EligibilityResult;
  authority: AuthorityPrerequisite | null;
}

interface FinancialServiceOutcome {
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
}

// Mirrors CanonicalSurfaceStyling — translucent slate, slate hairlines.
const PANEL_CLASS = "bg-slate-900/40 border-slate-800 backdrop-blur-xl";

const PROVIDER_MODE_ROUTE: Record<string, string> = {
  ARCHITECT: "architect",
  RUNTIME: "runtime",
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

export function ServiceOrchestrationPanel() {
  const [agents, setAgents] = useState<RegistrableAgentSummary[]>([]);
  const [catalog, setCatalog] = useState<FinancialServiceDefinitionSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveredService[] | null>(null);
  const [admissionDiagnostic, setAdmissionDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, FinancialServiceOutcome>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/moneypenny/service-orchestration", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Failed to load Financial Services catalog");
          return;
        }
        setAgents(data.agents ?? []);
        setCatalog(data.catalog ?? []);
      } catch {
        if (!cancelled) setError("Failed to load Financial Services catalog");
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDiscovery = useCallback(async (agentId: string) => {
    setLoadingDiscovery(true);
    setDiscovery(null);
    setAdmissionDiagnostic(null);
    setError(null);
    try {
      const res = await personaFetch(
        `/api/moneypenny/service-orchestration?agentId=${encodeURIComponent(agentId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed to resolve eligibility for ${agentId}`);
        return;
      }
      setDiscovery(data.discovery ?? []);
      setAdmissionDiagnostic(data.admissionDiagnostic ?? null);
    } catch {
      setError(`Failed to resolve eligibility for ${agentId}`);
    } finally {
      setLoadingDiscovery(false);
    }
  }, []);

  const selectAgent = useCallback(
    (agentId: string) => {
      setSelectedAgentId(agentId);
      void loadDiscovery(agentId);
    },
    [loadDiscovery],
  );

  const requestService = useCallback(
    async (serviceId: string) => {
      if (!selectedAgentId) return;
      setRequesting(serviceId);
      setError(null);
      try {
        const res = await personaFetch("/api/moneypenny/service-orchestration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: selectedAgentId, serviceId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Request to '${serviceId}' failed`);
          return;
        }
        setOutcomes((prev) => ({ ...prev, [serviceId]: data.outcome }));
      } catch {
        setError(`Request to '${serviceId}' failed`);
      } finally {
        setRequesting(null);
      }
    },
    [selectedAgentId],
  );

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
        {error && <p className="text-sm text-rose-400">{error}</p>}

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
                {loadingDiscovery && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
                {admissionDiagnostic && (
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

            {showDiagnostic && admissionDiagnostic && (
              <pre className="overflow-x-auto rounded border border-slate-800 bg-black/30 p-2 text-[10px] text-white/60">
                {JSON.stringify(admissionDiagnostic, null, 2)}
              </pre>
            )}

            {(discovery ?? catalog.map((definition) => ({ definition, eligibility: undefined as unknown as EligibilityResult, authority: null as AuthorityPrerequisite | null })))
              .map(({ definition, eligibility, authority }) => {
                const outcome = outcomes[definition.serviceId];
                const route = PROVIDER_MODE_ROUTE[definition.providerMode];
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

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={requesting === definition.serviceId || eligibility?.eligible === false}
                        onClick={() => void requestService(definition.serviceId)}
                        className="w-fit bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        {requesting === definition.serviceId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : null}
                        Trigger
                      </Button>
                      {outcome && (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[outcome.status] ?? "border-slate-700 text-white/60"}`}>
                          {outcome.status} — {outcome.reason}
                        </span>
                      )}
                    </div>

                    {outcome && (outcome.executionRef || outcome.authorisationRef) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-white/40">
                        {outcome.authorisationRef && <span>authorisation: {outcome.authorisationRef}</span>}
                        {outcome.executionRef && <span>execution: {outcome.executionRef}</span>}
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
