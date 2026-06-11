"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bot,
  Download,
  FileJson,
  Gavel,
  Link2,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Send,
  Upload,
} from "lucide-react";
import type { CandidateAgent } from "@/services/marketa/activation/types";

interface CandidateListResponse {
  ok: boolean;
  candidates?: CandidateAgent[];
  error?: string;
}

const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl";

function statusClass(status: string) {
  if (
    [
      "scored",
      "shortlisted",
      "approved_for_outreach",
      "qualified",
      "activated",
      "revenue_active",
    ].includes(status)
  ) {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }
  if (["needs_review", "pending_passport", "application_recommended"].includes(status)) {
    return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  }
  if (["rejected", "deferred", "do_not_contact"].includes(status)) {
    return "bg-red-500/15 text-red-300 border-red-500/30";
  }
  return "bg-slate-700/50 text-slate-300 border-slate-600";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

const DEMO_CANDIDATE = {
  name: "Example Agent Candidate",
  description:
    "Founder-operator research and outreach agent with Agent Card readiness, CRM support, and human-approved campaign drafting.",
  sourceType: "manual",
  sourceUrl: "manual://operator-entry",
  operatorName: "Example Operator",
  operatorType: "organization",
  capabilities: ["research", "CRM", "outreach drafting", "agent card support"],
  targetUsers: ["founder operators", "media operators"],
};

const BUREAU_CONSENTS: Array<{ key: string; label: string }> = [
  { key: "participant_terms_accepted", label: "Participant terms accepted" },
  { key: "registry_pending_record_consent", label: "Public pending-registry record consent" },
  { key: "constraints_and_obligations_accepted", label: "Constraints & obligations accepted" },
  { key: "review_process_accepted", label: "Review process accepted" },
];

export function MarketaActivationEngineTab() {
  const [candidates, setCandidates] = useState<CandidateAgent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastDraft, setLastDraft] = useState<{ subject: string; body: string; cta: string } | null>(
    null,
  );
  const [lastActionNote, setLastActionNote] = useState<string | null>(null);
  const [bureauConsents, setBureauConsents] = useState<Record<string, boolean>>({});
  const [agentCardInput, setAgentCardInput] = useState("");
  const [savingAgentCard, setSavingAgentCard] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_review" | "exec" | "vulnerable" | "legal">(
    "all",
  );

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketa/activation/candidates", { cache: "no-store" });
      const json = (await res.json()) as CandidateListResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setCandidates(json.candidates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  // Consents are per-candidate decisions — clear them on selection change.
  useEffect(() => {
    setBureauConsents({});
    setAgentCardInput("");
  }, [selectedId]);

  const saveAgentCardUrl = async (candidateId: string) => {
    setSavingAgentCard(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/activation/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentCardUrl: agentCardInput.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidate?: CandidateAgent;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.candidate)
        throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      setCandidates(prev =>
        prev.map(candidate => (candidate.id === candidateId ? json.candidate! : candidate)),
      );
      setAgentCardInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingAgentCard(false);
    }
  };

  const selected =
    candidates.find(candidate => candidate.id === selectedId) ?? candidates[0] ?? null;

  const filtered = useMemo(
    () =>
      candidates.filter(candidate => {
        if (filter === "needs_review")
          return candidate.activationStatus === "needs_review" || candidate.riskFlags.length > 0;
        if (filter === "exec") return candidate.topBottomRelevance.supportsExecMobility;
        if (filter === "vulnerable")
          return candidate.topBottomRelevance.supportsVulnerablePersonsMobility;
        if (filter === "legal") return candidate.legalTrack !== "none";
        return true;
      }),
    [candidates, filter],
  );

  const metrics = useMemo(
    () => ({
      total: candidates.length,
      needsReview: candidates.filter(
        candidate =>
          candidate.activationStatus === "needs_review" || candidate.riskFlags.length > 0,
      ).length,
      exec: candidates.filter(candidate => candidate.topBottomRelevance.supportsExecMobility)
        .length,
      vulnerable: candidates.filter(
        candidate => candidate.topBottomRelevance.supportsVulnerablePersonsMobility,
      ).length,
      legal: candidates.filter(candidate => candidate.legalTrack !== "none").length,
    }),
    [candidates],
  );

  const createDemoCandidate = async () => {
    setCreating(true);
    setError(null);
    try {
      // Each sample gets a RESOLVABLE agent card served by this host — real
      // A2A card JSON, unique per click (the Bureau allows one open
      // application per agent card URL).
      const seed = Date.now();
      const agentCardUrl = `${window.location.origin}/api/marketa/activation/sample-agent-card?seed=${seed}`;
      const res = await fetch("/api/marketa/activation/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...DEMO_CANDIDATE,
          name: `${DEMO_CANDIDATE.name} ${seed}`,
          agentCardUrl,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidate?: CandidateAgent;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.candidate)
        throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      setCandidates(prev => [json.candidate!, ...prev]);
      setSelectedId(json.candidate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const scoreCandidate = async (candidateId: string) => {
    setScoringId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/activation/candidates/${candidateId}/score`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidate?: CandidateAgent;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.candidate)
        throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      setCandidates(prev =>
        prev.map(candidate => (candidate.id === candidateId ? json.candidate! : candidate)),
      );
      setSelectedId(candidateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScoringId(null);
    }
  };

  const runCandidateAction = async (
    candidateId: string,
    action: "registry" | "reputation" | "outreach" | "passport",
    extraBody?: Record<string, unknown>,
  ) => {
    setActionId(`${action}:${candidateId}`);
    setError(null);
    setLastActionNote(null);
    if (action !== "outreach") setLastDraft(null);
    try {
      const res = await fetch(`/api/marketa/activation/candidates/${candidateId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: "marketa", ...extraBody }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidate?: CandidateAgent;
        draft?: { subject: string; body: string; cta: string };
        note?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.candidate)
        throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      setCandidates(prev =>
        prev.map(candidate => (candidate.id === candidateId ? json.candidate! : candidate)),
      );
      setSelectedId(candidateId);
      if (json.draft) setLastDraft(json.draft);
      if (json.note) setLastActionNote(json.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionId(null);
    }
  };

  const importCandidates = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const res = await fetch("/api/marketa/activation/import", {
        method: "POST",
        headers: { "Content-Type": isCsv ? "text/csv" : "application/json" },
        body: await file.text(),
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidates?: CandidateAgent[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      setCandidates(prev => [...(json.candidates ?? []), ...prev]);
      if (json.candidates?.[0]) setSelectedId(json.candidates[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${GLASS_CARD} p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-5 h-5 text-pink-300" />
              <h3 className="text-xl font-semibold text-white">Activation Engine</h3>
              <Badge className="bg-pink-400/15 text-pink-300 border-pink-400/30">Phase 2</Badge>
            </div>
            <p className="text-sm text-slate-400 max-w-3xl">
              Candidate-agent recruitment spine for Marketa. Reuses the existing Marketa cartridge,
              existing import/export patterns, and existing outreach/Passport/Registry/Reputation
              systems as integration targets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-white/20 text-slate-200"
              title="Reload the candidate list from the server"
              onClick={loadCandidates}
              disabled={loading}
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-white/20 text-slate-200"
              title="Download all candidates as JSON (re-importable)"
              asChild
            >
              <a href="/api/marketa/activation/export?format=json" download>
                <FileJson className="w-4 h-4 mr-2" /> Export JSON
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-white/20 text-slate-200"
              title="Download all candidates as a CSV spreadsheet"
              asChild
            >
              <a href="/api/marketa/activation/export?format=csv" download>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </a>
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="hidden"
              onChange={event => void importCandidates(event.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-white/20 text-slate-200"
              title="Import candidates from a JSON or CSV file"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}{" "}
              Import
            </Button>
            <Button
              size="sm"
              className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm"
              title="Create a sample candidate pre-filled with demo data (including an example agent card URL) so you can walk the full pipeline"
              onClick={createDemoCandidate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}{" "}
              Add sample
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["All candidates", metrics.total, "all"],
          ["Needs review", metrics.needsReview, "needs_review"],
          ["Exec mobility", metrics.exec, "exec"],
          ["Vulnerable mobility", metrics.vulnerable, "vulnerable"],
          ["Legal split", metrics.legal, "legal"],
        ].map(([label, value, key]) => (
          <button
            key={String(key)}
            onClick={() => setFilter(key as typeof filter)}
            className={`${GLASS_CARD} p-4 text-left ${filter === key ? "ring-pink-400/60" : ""}`}
          >
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className={`${GLASS_CARD} p-4 xl:col-span-2`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white">Candidate agents</h4>
            <span className="text-xs text-slate-500">{filtered.length} shown</span>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {loading && (
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading candidates…
              </p>
            )}
            {!loading && filtered.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                No candidate agents yet. Add a sample or import JSON/CSV through the Activation
                Engine import endpoint.
                <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                  <Upload className="w-3 h-3" /> POST /api/marketa/activation/import
                </div>
              </div>
            )}
            {filtered.map(candidate => (
              <button
                key={candidate.id}
                onClick={() => setSelectedId(candidate.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === candidate.id ? "border-pink-400/50 bg-pink-400/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-700"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{candidate.name}</p>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {candidate.description || "No description yet."}
                    </p>
                  </div>
                  <Badge className={statusClass(candidate.activationStatus)}>
                    {formatLabel(candidate.activationStatus)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {candidate.strategicLanes.slice(0, 2).map(lane => (
                    <Badge
                      key={lane}
                      className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]"
                    >
                      {formatLabel(lane)}
                    </Badge>
                  ))}
                  {candidate.legalTrack !== "none" && (
                    <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30 text-[10px]">
                      <Gavel className="w-3 h-3 mr-1" />
                      {formatLabel(candidate.legalTrack)}
                    </Badge>
                  )}
                  {candidate.topBottomRelevance.mobilityReferenceTag !== "none" && (
                    <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 text-[10px]">
                      {formatLabel(candidate.topBottomRelevance.mobilityReferenceTag)}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={`${GLASS_CARD} p-4 space-y-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-white">Scorecard</h4>
              <p className="text-xs text-slate-500">Clean revenue + Passport readiness</p>
            </div>
            {selected && (
              <div className="flex flex-wrap gap-1 justify-end">
                <Button
                  size="sm"
                  className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm"
                  title="Run classification (lanes, verticals, legal track, mobility) + clean-revenue screen + priority scoring"
                  onClick={() => scoreCandidate(selected.id)}
                  disabled={scoringId === selected.id}
                >
                  {scoringId === selected.id ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 mr-1" />
                  )}{" "}
                  Score
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-white/20 text-slate-200"
                  title="Create/link this candidate's Agent iQube in the iQube Registry — required before the Passport handoff"
                  onClick={() => runCandidateAction(selected.id, "registry")}
                  disabled={actionId === `registry:${selected.id}`}
                >
                  {actionId === `registry:${selected.id}` ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Link2 className="w-3 h-3 mr-1" />
                  )}{" "}
                  Registry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-white/20 text-slate-200"
                  title="Read reputation standing from the RQH canister (authoritative), with mirror/score fallback"
                  onClick={() => runCandidateAction(selected.id, "reputation")}
                  disabled={actionId === `reputation:${selected.id}`}
                >
                  {actionId === `reputation:${selected.id}` ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 mr-1" />
                  )}{" "}
                  Rep
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-white/20 text-slate-200"
                  title="Prepare a Polity Passport Bureau application draft (or re-sync Bureau status). Submission happens below after you give the four operator consents"
                  onClick={() => runCandidateAction(selected.id, "passport")}
                  disabled={actionId === `passport:${selected.id}`}
                >
                  {actionId === `passport:${selected.id}` ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 mr-1" />
                  )}{" "}
                  Passport
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-white/20 text-slate-200"
                  title="Draft a human-approved outreach email — nothing is ever sent automatically"
                  onClick={() => runCandidateAction(selected.id, "outreach")}
                  disabled={actionId === `outreach:${selected.id}`}
                >
                  {actionId === `outreach:${selected.id}` ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3 mr-1" />
                  )}{" "}
                  Draft
                </Button>
              </div>
            )}
          </div>

          {!selected ? (
            <p className="text-sm text-slate-400">Select a candidate to inspect the scorecard.</p>
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold text-white">{selected.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {selected.operatorName || "Unknown operator"} · {formatLabel(selected.sourceType)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/70 p-4 text-center">
                <p className="text-xs text-slate-400">Overall priority</p>
                <p className="text-4xl font-bold text-pink-300">
                  {selected.scores.overallPriorityScore}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Strategic fit", selected.scores.strategicFitScore],
                  ["aigentMe fit", selected.scores.aigentmeFitScore],
                  ["Marketa mult.", selected.scores.marketaMultiplierScore],
                  ["Clean revenue", selected.scores.cleanRevenuePotentialScore],
                  ["Trust ready", selected.scores.trustReadinessScore],
                  ["Passport ready", selected.scores.passportReadinessScore],
                  ["Technical", selected.scores.technicalIntegrationScore],
                  ["Risk", selected.scores.riskScore],
                  ["Mobility freq.", selected.scores.mobilityFrequencyScore],
                  ["Mobility leverage", selected.scores.mobilityLeverageScore],
                  ["Mobility continuity", selected.scores.mobilityContinuityScore],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded bg-slate-900/60 p-2">
                    <p className="text-slate-500">{label}</p>
                    <p className="font-semibold text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
              <section>
                <h5 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Risk / policy flags
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {[...selected.riskFlags, ...selected.policyFlags].length === 0 ? (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      No flags
                    </Badge>
                  ) : (
                    [...selected.riskFlags, ...selected.policyFlags].map(flag => (
                      <Badge
                        key={flag}
                        className="bg-amber-500/15 text-amber-300 border-amber-500/30"
                      >
                        {formatLabel(flag)}
                      </Badge>
                    ))
                  )}
                </div>
              </section>
              <section>
                <h5 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Integration state
                </h5>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="space-y-1">
                    <p>
                      Agent card:{" "}
                      {selected.agentCardUrl ? (
                        <span className="text-slate-500 break-all">{selected.agentCardUrl}</span>
                      ) : (
                        <span className="text-amber-400/80">
                          missing — required before Registry/Passport handoffs
                        </span>
                      )}
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        value={agentCardInput}
                        onChange={event => setAgentCardInput(event.target.value)}
                        placeholder={
                          selected.agentCardUrl
                            ? "Replace agent card URL…"
                            : "https://… agent card URL"
                        }
                        title="The Bureau anchors participant identity on this URL — the agent's public Agent Card (A2A) JSON"
                        className="flex-1 rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-slate-800/50 border-white/20 text-slate-200"
                        title={
                          selected.agentCardUrl
                            ? "Replace the agent card URL on this candidate"
                            : "Save the agent card URL onto this candidate"
                        }
                        disabled={
                          savingAgentCard ||
                          !agentCardInput.trim().startsWith("http") ||
                          agentCardInput.trim() === selected.agentCardUrl
                        }
                        onClick={() => saveAgentCardUrl(selected.id)}
                      >
                        {savingAgentCard ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : selected.agentCardUrl ? (
                          "Replace"
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                  <p>
                    Passport:{" "}
                    <span className="text-slate-500">
                      {formatLabel(selected.passportIntegration.passportApplicationStatus)}
                    </span>
                  </p>
                  <p>
                    iQube Registry:{" "}
                    <span className="text-slate-500">
                      {formatLabel(selected.iqubeRegistry.registryStatus)}
                    </span>
                    {selected.iqubeRegistry.agentIqubeId ? (
                      <span className="text-slate-600">
                        {" "}
                        · {selected.iqubeRegistry.agentIqubeId}
                      </span>
                    ) : null}
                  </p>
                  <p>
                    Reputation:{" "}
                    <span className="text-slate-500">
                      {formatLabel(selected.reputation.standingStatus)}
                    </span>
                    {selected.reputation.publicScore !== null ? (
                      <span className="text-slate-600"> · {selected.reputation.publicScore}</span>
                    ) : null}
                  </p>
                  <p>
                    Outreach:{" "}
                    <span className="text-slate-500">{formatLabel(selected.outreachStatus)}</span>
                  </p>
                </div>
                {lastActionNote && (
                  <p className="mt-2 rounded bg-slate-900/60 border border-slate-800 p-2 text-[11px] text-amber-300/90">
                    {lastActionNote}
                  </p>
                )}
              </section>
              {selected.passportIntegration.passportApplicationStatus === "draft" && (
                <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                  <h5 className="text-xs uppercase tracking-wider text-slate-500">
                    Advance to Bureau — operator consents
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    The Bureau requires all four consents from a human operator. Checking them here
                    records you ({"marketa-operator"}) as the consenting actor; Marketa never
                    consents on anyone&apos;s behalf.
                  </p>
                  {BUREAU_CONSENTS.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={bureauConsents[key] === true}
                        onChange={event =>
                          setBureauConsents(prev => ({ ...prev, [key]: event.target.checked }))
                        }
                        className="accent-current"
                      />
                      {label}
                    </label>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-slate-800/50 border-white/20 text-slate-200 w-full"
                    title="Submit the prepared application to the Bureau with your operator consents — it will appear in the Bureau steward queue"
                    disabled={
                      actionId === `passport:${selected.id}` ||
                      !BUREAU_CONSENTS.every(({ key }) => bureauConsents[key] === true)
                    }
                    onClick={() =>
                      runCandidateAction(selected.id, "passport", {
                        action: "submit",
                        actorId: "marketa-operator",
                        consents: bureauConsents,
                      }).then(() => setBureauConsents({}))
                    }
                  >
                    {actionId === `passport:${selected.id}` ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3 mr-1" />
                    )}{" "}
                    Submit to Passport Bureau
                  </Button>
                </section>
              )}
              {["submitted", "pending_approval", "needs_more_information"].includes(
                selected.passportIntegration.passportApplicationStatus,
              ) && (
                <p className="rounded bg-slate-900/60 border border-slate-800 p-2 text-[11px] text-sky-300/90">
                  Application is with the Bureau ({formatLabel(
                    selected.passportIntegration.passportApplicationStatus,
                  )}) — review it in the Polity Passport Bureau cartridge, Steward queue tab. Click
                  Passport again any time to re-sync status.
                </p>
              )}
              {lastDraft && (
                <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <h5 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Latest outreach draft
                  </h5>
                  <p className="text-xs font-semibold text-slate-200">{lastDraft.subject}</p>
                  <p className="text-xs text-slate-400 whitespace-pre-wrap mt-2 max-h-36 overflow-y-auto">
                    {lastDraft.body}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-2">CTA: {lastDraft.cta}</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketaActivationEngineTab;
