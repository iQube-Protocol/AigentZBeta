"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bot,
  Download,
  FileJson,
  FileText,
  Gavel,
  Link2,
  Loader2,
  Plus,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Send,
  Upload,
} from "lucide-react";
import type { CandidateAgent, CandidateOpportunity } from "@/services/marketa/activation/types";
import { STRATEGIC_LANES } from "@/services/marketa/activation/types";
import { attributeRevenue } from "@/services/marketa/activation/normalizers";

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
  return "bg-slate-400/10 text-slate-300 border-slate-500/30";
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
  const [opportunities, setOpportunities] = useState<CandidateOpportunity[]>([]);
  const [oppDescription, setOppDescription] = useState("");
  const [oppValue, setOppValue] = useState("");
  const [oppType, setOppType] = useState("other");
  const [oppBusy, setOppBusy] = useState<string | null>(null);
  const [outreachTo, setOutreachTo] = useState("");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachBody, setOutreachBody] = useState("");
  const [sendVia, setSendVia] = useState<"mailjet" | "gmail">("mailjet");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverKind, setDiscoverKind] = useState<"a2a_card" | "mcp_registry">("a2a_card");
  const [discoverUrl, setDiscoverUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverNote, setDiscoverNote] = useState<string | null>(null);
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      strategicLane: string;
      subjectTemplate: string;
      bodyTemplate: string;
      cta: string;
      enabled: boolean;
    }>
  >([]);
  const [templateId, setTemplateId] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  // "" = closed, "new" = create form, otherwise the template id being edited
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [tplForm, setTplForm] = useState({
    name: "",
    strategicLane: "any",
    subjectTemplate: "",
    bodyTemplate: "",
    cta: "",
  });
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

  // Outreach template library — empty list (table not yet migrated or
  // nothing curated) means the built-in draft copy is used.
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/marketa/activation/templates", { cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; templates?: typeof templates };
      if (json.ok) setTemplates(json.templates ?? []);
    } catch {
      // built-in fallback covers drafting; no error surface needed
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // Consents are per-candidate decisions — clear them on selection change.
  useEffect(() => {
    setBureauConsents({});
    setAgentCardInput("");
    setOppDescription("");
    setOppValue("");
    setOppType("other");
    setOutreachTo("");
    setOutreachSubject("");
    setOutreachBody("");
    setLastDraft(null);
  }, [selectedId]);

  // Opportunities belong to the selected candidate — load on selection change.
  useEffect(() => {
    if (!selectedId) {
      setOpportunities([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/marketa/activation/candidates/${selectedId}/opportunities`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { ok: boolean; opportunities?: CandidateOpportunity[] };
        if (!cancelled) setOpportunities(json.ok ? (json.opportunities ?? []) : []);
      } catch {
        if (!cancelled) setOpportunities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Auto-sync passport status from the Bureau whenever we select a
  // candidate whose passport is in-flight — so steward approvals show up
  // without requiring the operator to re-click Passport.
  useEffect(() => {
    if (!selectedId) return;
    const selected = candidates.find(c => c.id === selectedId);
    if (!selected) return;
    const inFlight = ["submitted", "pending_approval", "needs_more_information"];
    if (!inFlight.includes(selected.passportIntegration.passportApplicationStatus)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/marketa/activation/candidates/${selectedId}/passport`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId: "marketa-auto-sync" }),
          },
        );
        const json = (await res.json()) as { ok: boolean; candidate?: CandidateAgent };
        if (!cancelled && json.ok && json.candidate) {
          setCandidates(prev =>
            prev.map(c => (c.id === selectedId ? json.candidate! : c)),
          );
        }
      } catch {
        // silent — manual re-click still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, candidates]);

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
      pipeline: candidates.reduce(
        (sum, candidate) => sum + candidate.revenueTracking.estimatedPipelineValue,
        0,
      ),
      closed: candidates.reduce(
        (sum, candidate) => sum + candidate.revenueTracking.closedCleanRevenue,
        0,
      ),
      mrr: candidates.reduce(
        (sum, candidate) => sum + (candidate.revenueTracking.recurringMonthlyRevenue ?? 0),
        0,
      ),
    }),
    [candidates],
  );

  const attribution = useMemo(() => attributeRevenue(candidates), [candidates]);

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
      if (json.draft) {
        setLastDraft(json.draft);
        setOutreachSubject(json.draft.subject);
        setOutreachBody(json.draft.body);
      }
      if (json.note) setLastActionNote(json.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionId(null);
    }
  };

  const applyOpportunityResponse = (json: {
    candidate?: CandidateAgent;
    opportunities?: CandidateOpportunity[];
  }) => {
    if (json.opportunities) setOpportunities(json.opportunities);
    if (json.candidate) {
      setCandidates(prev =>
        prev.map(candidate => (candidate.id === json.candidate!.id ? json.candidate! : candidate)),
      );
    }
  };

  const addOpportunity = async (candidateId: string) => {
    setOppBusy("create");
    setError(null);
    try {
      const res = await fetch(`/api/marketa/activation/candidates/${candidateId}/opportunities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: oppDescription.trim(),
          estimatedValue: Number(oppValue) || 0,
          opportunityType: oppType,
          actorId: "marketa-operator",
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidate?: CandidateAgent;
        opportunities?: CandidateOpportunity[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      applyOpportunityResponse(json);
      setOppDescription("");
      setOppValue("");
      setOppType("other");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOppBusy(null);
    }
  };

  const updateOpportunity = async (
    candidateId: string,
    opportunityId: string,
    activationStatus: CandidateOpportunity["activationStatus"],
  ) => {
    setOppBusy(opportunityId);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/activation/candidates/${candidateId}/opportunities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, activationStatus, actorId: "marketa-operator" }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        candidate?: CandidateAgent;
        opportunities?: CandidateOpportunity[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      applyOpportunityResponse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOppBusy(null);
    }
  };

  const runDiscovery = async () => {
    const url = discoverUrl.trim();
    if (!url) return;
    setDiscovering(true);
    setDiscoverNote(null);
    setError(null);
    try {
      const res = await fetch("/api/marketa/activation/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: [{ kind: discoverKind, url }],
          actorId: "marketa-operator",
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        discovered?: number;
        skippedExisting?: number;
        errors?: Array<{ url: string; error: string }>;
        candidates?: CandidateAgent[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      if (json.candidates?.length) {
        setCandidates(prev => [...(json.candidates ?? []), ...prev]);
        setSelectedId(json.candidates[0].id);
      }
      const fetchError = json.errors?.[0]?.error;
      setDiscoverNote(
        `Discovered ${json.discovered ?? 0} new` +
          ((json.skippedExisting ?? 0) > 0 ? `, skipped ${json.skippedExisting} already known` : "") +
          (fetchError ? ` — source error: ${fetchError}` : ""),
      );
      if ((json.discovered ?? 0) > 0) setDiscoverUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiscovering(false);
    }
  };

  const startTemplateEdit = (id: string) => {
    if (id === "new") {
      setTplForm({ name: "", strategicLane: "any", subjectTemplate: "", bodyTemplate: "", cta: "" });
    } else {
      const template = templates.find(t => t.id === id);
      if (!template) return;
      setTplForm({
        name: template.name,
        strategicLane: template.strategicLane,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        cta: template.cta,
      });
    }
    setEditingTemplateId(id);
  };

  const saveTemplate = async () => {
    setTemplateBusy(true);
    setError(null);
    try {
      const isNew = editingTemplateId === "new";
      const res = await fetch(
        isNew
          ? "/api/marketa/activation/templates"
          : `/api/marketa/activation/templates/${editingTemplateId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tplForm),
        },
      );
      const json = (await res.json()) as { ok: boolean; error?: string; detail?: string };
      if (!res.ok || !json.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      setEditingTemplateId("");
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTemplateBusy(false);
    }
  };

  const toggleTemplate = async (id: string, enabled: boolean) => {
    setTemplateBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/activation/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; detail?: string };
      if (!res.ok || !json.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
      if (!enabled && templateId === id) setTemplateId("");
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTemplateBusy(false);
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
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
              title="Reload the candidate list from the server"
              onClick={loadCandidates}
              disabled={loading}
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
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
              className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
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
              className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
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
              variant="outline"
              size="sm"
              className={`bg-slate-800/50 border-white/20 text-slate-200 shrink-0 ${discoverOpen ? "border-pink-400/50 text-pink-200" : ""}`}
              title="Discover candidates from an A2A agent card URL or an MCP-registry-style listing URL"
              onClick={() => setDiscoverOpen(open => !open)}
            >
              <Radar className="w-4 h-4 mr-2" /> Discover
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`bg-slate-800/50 border-white/20 text-slate-200 shrink-0 ${templatesOpen ? "border-pink-400/50 text-pink-200" : ""}`}
              title="Manage outreach templates — per-lane subject/body copy used by the Draft action"
              onClick={() => setTemplatesOpen(open => !open)}
            >
              <FileText className="w-4 h-4 mr-2" /> Templates
            </Button>
            <Button
              size="sm"
              className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm shrink-0"
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
        {discoverOpen && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={discoverKind}
                onChange={event => setDiscoverKind(event.target.value as typeof discoverKind)}
                title="Source kind — agent card expects a single A2A agent-card JSON; MCP registry expects a server listing (array or { servers: [] })"
                className="rounded bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              >
                <option value="a2a_card">A2A agent card</option>
                <option value="mcp_registry">MCP registry listing</option>
              </select>
              <input
                type="url"
                value={discoverUrl}
                onChange={event => setDiscoverUrl(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") void runDiscovery();
                }}
                placeholder="https://… source URL (agent-card.json or registry servers endpoint)"
                title="URL the server will fetch and parse — already-known candidates are skipped by URL/name"
                className="flex-1 min-w-0 rounded bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
              />
              <Button
                size="sm"
                className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm shrink-0"
                title="Fetch the source, parse candidates, skip duplicates, add the rest"
                onClick={() => void runDiscovery()}
                disabled={discovering || !discoverUrl.trim()}
              >
                {discovering ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Radar className="w-4 h-4 mr-2" />
                )}{" "}
                Run discovery
              </Button>
            </div>
            {discoverNote && <p className="mt-2 text-[11px] text-slate-400">{discoverNote}</p>}
          </div>
        )}
        {templatesOpen && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                Outreach templates per strategic lane — the Draft action auto-picks by the
                candidate&apos;s lane, falling back to the built-in copy when nothing matches.
              </p>
              {editingTemplateId === "" && (
                <Button
                  size="sm"
                  className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm shrink-0"
                  title="Create a new outreach template"
                  onClick={() => startTemplateEdit("new")}
                  disabled={templateBusy}
                >
                  <Plus className="w-3 h-3 mr-1" /> New template
                </Button>
              )}
            </div>
            {templates.length === 0 && editingTemplateId === "" && (
              <p className="text-[11px] text-slate-500">
                No templates yet — drafts use the built-in copy. (If creating fails with a
                table-missing error, the templates migration hasn&apos;t been run in Supabase.)
              </p>
            )}
            {editingTemplateId === "" &&
              templates.map(template => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 rounded bg-slate-900/50 border border-slate-700/60 px-2 py-1.5"
                >
                  <span className={`text-xs ${template.enabled ? "text-slate-200" : "text-slate-500 line-through"}`}>
                    {template.name}
                  </span>
                  <Badge className="bg-slate-700/40 text-slate-300 border-slate-600/40 whitespace-nowrap">
                    {formatLabel(template.strategicLane)}
                  </Badge>
                  <span className="flex-1" />
                  <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer" title="Disabled templates are excluded from the Draft picker and auto-selection">
                    <input
                      type="checkbox"
                      checked={template.enabled}
                      onChange={event => void toggleTemplate(template.id, event.target.checked)}
                      disabled={templateBusy}
                    />
                    enabled
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-slate-800/50 border-white/20 text-slate-200 h-6 px-2 text-[11px]"
                    onClick={() => startTemplateEdit(template.id)}
                    disabled={templateBusy}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            {editingTemplateId !== "" && (
              <div className="space-y-2 rounded bg-slate-900/50 border border-slate-700/60 p-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={tplForm.name}
                    onChange={event => setTplForm(form => ({ ...form, name: event.target.value }))}
                    placeholder="Template name"
                    className="flex-1 min-w-0 rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                  <select
                    value={tplForm.strategicLane}
                    onChange={event =>
                      setTplForm(form => ({ ...form, strategicLane: event.target.value }))
                    }
                    title="Strategic lane this template targets — 'Any lane' is the catch-all"
                    className="rounded bg-slate-900/70 border border-slate-700 px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                  >
                    <option value="any">Any lane</option>
                    {STRATEGIC_LANES.map(lane => (
                      <option key={lane} value={lane}>
                        {formatLabel(lane)}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={tplForm.subjectTemplate}
                  onChange={event =>
                    setTplForm(form => ({ ...form, subjectTemplate: event.target.value }))
                  }
                  placeholder="Subject — e.g. Explore Polity Participant activation for {{operator}}"
                  className="w-full rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                />
                <textarea
                  value={tplForm.bodyTemplate}
                  onChange={event =>
                    setTplForm(form => ({ ...form, bodyTemplate: event.target.value }))
                  }
                  placeholder="Body — placeholders are substituted per candidate at draft time"
                  rows={8}
                  className="w-full rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono"
                />
                <input
                  type="text"
                  value={tplForm.cta}
                  onChange={event => setTplForm(form => ({ ...form, cta: event.target.value }))}
                  placeholder="CTA (optional)"
                  className="w-full rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                />
                <p className="text-[11px] text-slate-500">
                  Placeholders: {"{{operator}} {{candidate_name}} {{primary_lane}} {{capabilities_bullets}} {{legal_line}} {{mobility_line}} {{angle_note}}"}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm"
                    onClick={() => void saveTemplate()}
                    disabled={
                      templateBusy ||
                      !tplForm.name.trim() ||
                      !tplForm.subjectTemplate.trim() ||
                      !tplForm.bodyTemplate.trim()
                    }
                  >
                    {templateBusy ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : null}
                    {editingTemplateId === "new" ? "Create template" : "Save changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-slate-800/50 border-white/20 text-slate-200"
                    onClick={() => setEditingTemplateId("")}
                    disabled={templateBusy}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
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
        <div className={`${GLASS_CARD} p-4`} title="Sum of open opportunity values (proposed/approved/active/paused) across all candidates">
          <p className="text-xs text-slate-400 whitespace-nowrap">Pipeline value</p>
          <p className="text-2xl font-bold text-pink-200">${metrics.pipeline}</p>
        </div>
        <div className={`${GLASS_CARD} p-4`} title="Sum of completed opportunity values across all candidates — what Marketa has earned">
          <p className="text-xs text-slate-400 whitespace-nowrap">Closed revenue</p>
          <p className="text-2xl font-bold text-emerald-300">${metrics.closed}</p>
        </div>
        <div className={`${GLASS_CARD} p-4`} title="Monthly recurring revenue — sum of active subscription-type opportunities (activation/subscription fees from activated agents)">
          <p className="text-xs text-slate-400 whitespace-nowrap">MRR</p>
          <p className="text-2xl font-bold text-sky-300">${metrics.mrr}/mo</p>
        </div>
      </div>

      {(attribution.byLane.length > 0 || attribution.bySource.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(
            [
              ["By strategic lane", attribution.byLane, "Revenue attributed to each candidate's primary strategic lane"],
              ["By discovery source", attribution.bySource, "Revenue attributed to where each candidate was discovered"],
            ] as const
          ).map(([title, buckets, hint]) => (
            <div key={title} className={`${GLASS_CARD} p-4`} title={hint}>
              <p className="text-xs font-semibold text-slate-300 mb-2">Revenue attribution — {title.toLowerCase()}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 text-left">
                    <th className="font-normal pb-1">{title === "By strategic lane" ? "Lane" : "Source"}</th>
                    <th className="font-normal pb-1 text-right">Pipeline</th>
                    <th className="font-normal pb-1 text-right">MRR</th>
                    <th className="font-normal pb-1 text-right">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map(bucket => (
                    <tr key={bucket.key} className="text-slate-200">
                      <td className="py-0.5 pr-2">{formatLabel(bucket.key)}</td>
                      <td className="py-0.5 text-right">${bucket.pipeline}</td>
                      <td className="py-0.5 text-right text-sky-300">{bucket.mrr > 0 ? `$${bucket.mrr}/mo` : "—"}</td>
                      <td className="py-0.5 text-right text-emerald-300">${bucket.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

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
                  <div className="min-w-0">
                    <p className="font-medium text-white">{candidate.name}</p>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {candidate.description || "No description yet."}
                    </p>
                  </div>
                  <Badge className={`${statusClass(candidate.activationStatus)} shrink-0 backdrop-blur-sm`}>
                    {formatLabel(candidate.activationStatus)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {candidate.strategicLanes.slice(0, 2).map(lane => (
                    <Badge
                      key={lane}
                      className="bg-slate-400/10 text-slate-300 border-slate-500/30 text-[10px]"
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
          <div className="flex items-baseline gap-2">
            <h4 className="font-semibold text-white">Scorecard</h4>
            <p className="text-xs text-slate-500">Clean revenue + Passport readiness</p>
          </div>

          {!selected ? (
            <p className="text-sm text-slate-400">Select a candidate to inspect the scorecard.</p>
          ) : (
            <>
              <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1">
                <Button
                  size="sm"
                  className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm shrink-0"
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
                  className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
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
                  className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
                  title="Read reputation standing from the RQH canister (authoritative), with mirror/score fallback"
                  onClick={() => runCandidateAction(selected.id, "reputation")}
                  disabled={actionId === `reputation:${selected.id}`}
                >
                  {actionId === `reputation:${selected.id}` ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 mr-1" />
                  )}{" "}
                  Reputation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
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
                {templates.some(template => template.enabled) && (
                  <select
                    value={templateId}
                    onChange={event => setTemplateId(event.target.value)}
                    title="Outreach template for Draft — Auto picks the first enabled template matching the candidate's lane, falling back to the built-in copy"
                    className="rounded bg-slate-900/70 border border-slate-700 px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500 shrink-0"
                  >
                    <option value="">Auto (lane / built-in)</option>
                    {templates
                      .filter(template => template.enabled)
                      .map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({formatLabel(template.strategicLane)})
                        </option>
                      ))}
                  </select>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-white/20 text-slate-200 shrink-0"
                  title="Draft a human-approved outreach email — nothing is ever sent automatically"
                  onClick={() =>
                    runCandidateAction(
                      selected.id,
                      "outreach",
                      templateId ? { templateId } : undefined,
                    )
                  }
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
                  <p className="flex flex-wrap items-center gap-1.5">
                    Passport:{" "}
                    <Badge
                      className={
                        ["approved", "provisionally_approved"].includes(
                          selected.passportIntegration.passportApplicationStatus,
                        )
                          ? "bg-green-400/15 text-green-300 border-green-400/30 backdrop-blur-sm"
                          : selected.passportIntegration.passportApplicationStatus === "not_started"
                            ? "bg-slate-500/15 text-slate-400 border-slate-500/30"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      }
                    >
                      {formatLabel(selected.passportIntegration.passportApplicationStatus)}
                    </Badge>
                    {["submitted", "pending_approval"].includes(
                      selected.passportIntegration.passportApplicationStatus,
                    ) && (
                      <span
                        className="text-[11px] text-amber-300/90"
                        title="The application is in the Bureau queue — a human steward must approve it (Polity Passport → Steward, admin only). This card re-syncs automatically when you select it."
                      >
                        → awaiting steward approval
                      </span>
                    )}
                    {selected.passportIntegration.passportApplicationStatus ===
                      "needs_more_information" && (
                      <span
                        className="text-[11px] text-amber-300/90"
                        title="A steward requested more information — review the application in the Steward queue"
                      >
                        → steward requested more info
                      </span>
                    )}
                    {selected.passportIntegration.participantPassportId ? (
                      <>
                        <span className="text-slate-600">
                          {" "}
                          · {selected.passportIntegration.participantPassportId}
                        </span>{" "}
                        <a
                          href={`/api/polity-passport/credential/${selected.passportIntegration.participantPassportId}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Claim the signed W3C Verifiable Credential for this passport — the artifact the agent holds (FIO @aigent handle remains stubbed in Phase A)"
                          className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/15 px-2.5 py-0.5 text-[11px] font-medium text-green-300 backdrop-blur-sm hover:bg-green-400/25"
                        >
                          <ShieldCheck className="w-3 h-3" /> Claim passport (W3C VC)
                        </a>
                      </>
                    ) : null}
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
                  <p className="mt-2 rounded-lg bg-amber-950/40 border border-amber-700/40 p-2.5 text-xs text-amber-200 leading-relaxed">
                    {lastActionNote}
                  </p>
                )}
              </section>
              <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h5 className="text-xs uppercase tracking-wider text-slate-500">
                    Opportunities &amp; revenue
                  </h5>
                  <p className="text-[11px] text-slate-400 whitespace-nowrap">
                    Pipeline ${selected.revenueTracking.estimatedPipelineValue} · Closed $
                    {selected.revenueTracking.closedCleanRevenue}
                    {(selected.revenueTracking.recurringMonthlyRevenue ?? 0) > 0
                      ? ` · MRR $${selected.revenueTracking.recurringMonthlyRevenue}/mo`
                      : ""}
                  </p>
                </div>
                {opportunities.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No opportunities logged yet — this is the revenue half of the funnel.
                  </p>
                )}
                {opportunities.map(opp => {
                  const nextStatus: Record<string, CandidateOpportunity["activationStatus"] | undefined> = {
                    proposed: "approved",
                    approved: "active",
                    active: "completed",
                    paused: "active",
                  };
                  const next = nextStatus[opp.activationStatus];
                  const terminal = ["completed", "rejected"].includes(opp.activationStatus);
                  return (
                    <div
                      key={opp.id}
                      className="rounded border border-slate-800 bg-slate-950/40 p-2 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-slate-200 min-w-0">{opp.description}</p>
                        <span
                          className="text-xs font-semibold text-slate-100 whitespace-nowrap shrink-0"
                          title={`${opp.estimatedValue * 100} Q¢ ($1 = 100 Q¢)`}
                        >
                          ${opp.estimatedValue}
                          {opp.opportunityType === "subscription" ? "/mo" : ""}
                          <span className="ml-1 font-normal text-slate-500">
                            {(opp.estimatedValue * 100).toLocaleString()} Q¢
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto">
                        <Badge
                          className={`${
                            opp.activationStatus === "completed"
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : opp.activationStatus === "rejected"
                                ? "bg-red-500/15 text-red-300 border-red-500/30"
                                : "bg-sky-500/15 text-sky-300 border-sky-500/30"
                          } text-[10px] shrink-0`}
                        >
                          {formatLabel(opp.activationStatus)}
                        </Badge>
                        {next && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-slate-800/50 border-white/20 text-slate-200 h-6 px-2 text-[11px] shrink-0"
                            title={`Advance this opportunity to ${formatLabel(next)} — completed opportunities roll into closed clean revenue`}
                            disabled={oppBusy === opp.id}
                            onClick={() => updateOpportunity(selected.id, opp.id, next)}
                          >
                            {oppBusy === opp.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>→ {formatLabel(next)}</>
                            )}
                          </Button>
                        )}
                        {!terminal && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-slate-800/50 border-red-400/30 text-red-300 h-6 px-2 text-[11px] shrink-0"
                            title="Reject this opportunity — it drops out of the pipeline and revenue roll-up"
                            disabled={oppBusy === opp.id}
                            onClick={() => updateOpportunity(selected.id, opp.id, "rejected")}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={oppDescription}
                    onChange={event => setOppDescription(event.target.value)}
                    placeholder="New opportunity description…"
                    title="What revenue opportunity does this candidate represent?"
                    className="flex-1 min-w-0 rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                  <select
                    value={oppType}
                    onChange={event => setOppType(event.target.value)}
                    title="Opportunity type — subscriptions count as monthly recurring revenue while active; everything else is one-shot pipeline/closed"
                    className="rounded bg-slate-900/70 border border-slate-700 px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                  >
                    <option value="other">one-shot</option>
                    <option value="subscription">subscription /mo</option>
                    <option value="qualified_intro">qualified intro</option>
                    <option value="integration">integration</option>
                  </select>
                  <input
                    type="number"
                    value={oppValue}
                    onChange={event => setOppValue(event.target.value)}
                    placeholder="$"
                    title="Estimated value in USD — for subscriptions, the monthly fee"
                    className="w-20 rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                  <Button
                    size="sm"
                    className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm shrink-0"
                    title="Log a revenue opportunity for this candidate — it sums into the pipeline value until completed or rejected"
                    disabled={oppBusy === "create" || !oppDescription.trim()}
                    onClick={() => addOpportunity(selected.id)}
                  >
                    {oppBusy === "create" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                  </Button>
                </div>
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
                <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                  <h5 className="text-xs uppercase tracking-wider text-slate-500">
                    Outreach — review &amp; send
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Edit before sending. Sends via the Marketa Mailjet identity; you supply the
                    recipient — nothing goes out without your review.
                  </p>
                  <input
                    type="email"
                    value={outreachTo}
                    onChange={event => setOutreachTo(event.target.value)}
                    placeholder="Recipient email (agent operator)…"
                    title="The agent operator's email address — Marketa never infers a recipient"
                    className="w-full rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                  <input
                    type="text"
                    value={outreachSubject}
                    onChange={event => setOutreachSubject(event.target.value)}
                    placeholder="Subject…"
                    title="Email subject — prefilled from the draft, edit freely"
                    className="w-full rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                  <textarea
                    value={outreachBody}
                    onChange={event => setOutreachBody(event.target.value)}
                    rows={6}
                    placeholder="Body…"
                    title="Email body — prefilled from the draft, edit freely"
                    className="w-full rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-y"
                  />
                  <p className="text-[11px] text-slate-500">CTA: {lastDraft.cta}</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={sendVia}
                      onChange={event => setSendVia(event.target.value as typeof sendVia)}
                      title="Send via Mailjet (platform identity, cohort-grade) or Gmail (aigentMe 1:1 personal comms — requires connected Gmail)"
                      className="rounded bg-slate-900/70 border border-slate-700 px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    >
                      <option value="mailjet">Mailjet</option>
                      <option value="gmail">Gmail (1:1)</option>
                    </select>
                    <Button
                      size="sm"
                      className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-400/40 text-pink-100 backdrop-blur-sm flex-1"
                      title={
                        sendVia === "gmail"
                          ? "Send via aigentMe's Gmail — 1:1 personal outreach (requires the operator persona to have a connected Gmail account)"
                          : "Send via the Marketa Mailjet platform identity — flips outreach status to sent"
                      }
                      disabled={
                        actionId === `outreach:${selected.id}` ||
                        !outreachTo.includes("@") ||
                        !outreachSubject.trim() ||
                        !outreachBody.trim()
                      }
                      onClick={() =>
                        runCandidateAction(selected.id, "outreach", {
                          action: "send",
                          actorId: "marketa-operator",
                          to: outreachTo.trim(),
                          subject: outreachSubject.trim(),
                          body: outreachBody.trim(),
                          sendVia,
                        })
                      }
                    >
                      {actionId === `outreach:${selected.id}` ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3 mr-1" />
                      )}{" "}
                      Send via {sendVia === "gmail" ? "Gmail" : "Mailjet"}
                    </Button>
                  </div>
                </section>
              )}
              {selected.outreachStatus === "sent" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/50 border-emerald-400/30 text-emerald-300 w-full"
                  title="Record that the agent operator replied — moves the candidate toward qualification"
                  disabled={actionId === `outreach:${selected.id}`}
                  onClick={() =>
                    runCandidateAction(selected.id, "outreach", {
                      action: "mark_responded",
                      actorId: "marketa-operator",
                    })
                  }
                >
                  Mark responded
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketaActivationEngineTab;
