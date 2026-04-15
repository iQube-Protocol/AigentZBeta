"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, GitBranch, Package2, Plug, FileText, Workflow, Loader2, ChevronRight, SlidersHorizontal, X, Zap, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle, Share2, Wrench, Network, GitMerge } from "lucide-react";
import { AssetDetailPanel } from "./AssetDetailPanel";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
import type {
  IngestionSourceType,
  RegistryAssetSummary,
  TrustBand,
  RegistryAssetClass,
} from "@/types/registryIngestion";
import { TRUST_BAND_LABELS as TBL, TRUST_BAND_ORDER } from "@/types/registryIngestion";

const ASSET_CLASS_LABELS: Record<RegistryAssetClass, string> = {
  ToolQube: "ToolQube",
  SkillQube: "SkillQube",
  WorkflowQube: "WorkflowQube",
  ConnectorQube: "ConnectorQube",
  AigentQube: "AigentQube",
};

const ASSET_STATUSES = ["pending", "fetched", "packaged", "validated", "published", "rejected"] as const;
type AssetStatus = typeof ASSET_STATUSES[number];

// ─────────────────────────────────────────────────────────────────────────────
// Source type config
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_TYPES: Array<{
  id: IngestionSourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
}> = [
  {
    id: "github_repo",
    label: "GitHub Repo",
    description: "Import from a public GitHub repository URL",
    icon: <GitBranch className="h-5 w-5" />,
    placeholder: "https://github.com/owner/repo",
  },
  {
    id: "package_ref",
    label: "Package Reference",
    description: "Import from an npm package name",
    icon: <Package2 className="h-5 w-5" />,
    placeholder: "e.g. @anthropic-ai/sdk",
  },
  {
    id: "mcp_endpoint",
    label: "MCP Endpoint",
    description: "Connect an MCP server endpoint",
    icon: <Plug className="h-5 w-5" />,
    placeholder: "https://mcp.example.com/sse",
  },
  {
    id: "manual_bundle",
    label: "Manual Bundle",
    description: "Describe a skill or tool manually",
    icon: <FileText className="h-5 w-5" />,
    placeholder: "",
  },
  {
    id: "workflow_def",
    label: "Workflow Definition",
    description: "Import a workflow definition",
    icon: <Workflow className="h-5 w-5" />,
    placeholder: "",
  },
  {
    id: "make_scenario",
    label: "Connect from Make",
    description: "Connect a Make.com scenario as a workflow asset",
    icon: <Share2 className="h-5 w-5" />,
    placeholder: "",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Intake form
// ─────────────────────────────────────────────────────────────────────────────

interface MakeScenario {
  id: number;
  name: string;
  isActive: boolean;
}

function IntakeForm({ onSuccess, formId, onSubmittingChange }: { onSuccess: (assetId: string) => void; formId?: string; onSubmittingChange?: (v: boolean, canSubmit: boolean) => void }) {
  const [sourceType, setSourceType] = useState<IngestionSourceType>("github_repo");
  const [sourceUri, setSourceUri] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "intake" | "fetching" | "packaging" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  // Make.com scenario state
  const [makeScenarios, setMakeScenarios] = useState<MakeScenario[] | null>(null);
  const [makeScenarioLoading, setMakeScenarioLoading] = useState(false);
  const [makeScenarioError, setMakeScenarioError] = useState<string | null>(null);
  const [selectedMakeScenario, setSelectedMakeScenario] = useState<MakeScenario | null>(null);
  const [showMakePicker, setShowMakePicker] = useState(false);

  const selectedType = SOURCE_TYPES.find((t) => t.id === sourceType)!;

  // Notify parent of submitting + canSubmit state for external button
  useEffect(() => {
    const canSubmit = !(sourceType === "make_scenario" && !selectedMakeScenario);
    onSubmittingChange?.(submitting, canSubmit);
  }, [submitting, sourceType, selectedMakeScenario, onSubmittingChange]);

  function fetchMakeScenarios() {
    setMakeScenarioLoading(true);
    setMakeScenarioError(null);
    fetch("/api/make/scenarios")
      .then((r) => r.json())
      .then((d) => {
        if (d.scenarios) setMakeScenarios(d.scenarios);
        else setMakeScenarioError(d.error ?? "Failed to load scenarios");
      })
      .catch(() => setMakeScenarioError("Network error loading scenarios"))
      .finally(() => setMakeScenarioLoading(false));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sourceType === "make_scenario" && !selectedMakeScenario) return;
    setSubmitting(true);
    setStep("intake");
    setStatusMsg("Creating intake record…");

    try {
      // Step 1: create intake — tenantId "platform" aligns with codex FactoryIntakeTab and RegistrySupplyTab
      const sourcePayload: Record<string, unknown> = { name, description };
      if (sourceType === "make_scenario" && selectedMakeScenario) {
        sourcePayload.scenarioId = selectedMakeScenario.id;
        sourcePayload.scenarioName = selectedMakeScenario.name;
        sourcePayload.isActive = selectedMakeScenario.isActive;
        if (!name) sourcePayload.name = selectedMakeScenario.name;
      }
      const intakeRes = await fetch("/api/registry/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "platform",
          submittedBy: "user",
          sourceType,
          sourceUri: sourceUri || undefined,
          sourcePayload,
        }),
      }).then((r) => r.json());

      if (!intakeRes.ok) throw new Error(intakeRes.error);
      const intakeId = intakeRes.data.intakeId;

      // Step 2: fetch + fingerprint
      setStep("fetching");
      setStatusMsg("Fetching and fingerprinting source…");
      const fetchRes = await fetch(`/api/registry/intake/${intakeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch" }),
      }).then((r) => r.json());
      if (!fetchRes.ok) throw new Error(fetchRes.error);

      // Step 3: classify + package
      setStep("packaging");
      setStatusMsg("Classifying and packaging asset…");
      const packageRes = await fetch(`/api/registry/intake/${intakeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "package" }),
      }).then((r) => r.json());
      if (!packageRes.ok) throw new Error(packageRes.error);

      const assetId = packageRes.data.assetId;

      // Step 4: run validation + trust score
      setStatusMsg("Running validation and trust scoring…");
      await fetch(`/api/registry/assets/${assetId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "user" }),
      });

      setStep("done");
      setStatusMsg("Asset packaged and scored.");
      onSuccess(assetId);
    } catch (err) {
      setStep("error");
      setStatusMsg(err instanceof Error ? err.message : "Intake failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      {/* Source type selector */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Source Type</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SOURCE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSourceType(t.id)}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                sourceType === t.id
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-300"
              }`}
            >
              {t.icon}
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-slate-500">{selectedType.description}</div>
      </div>

      {/* Source URI — not shown for make_scenario */}
      {selectedType.placeholder && sourceType !== "make_scenario" && (
        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 mb-1.5 block">
            Source URL / Reference
          </label>
          <input
            value={sourceUri}
            onChange={(e) => setSourceUri(e.target.value)}
            placeholder={selectedType.placeholder}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
        </div>
      )}

      {/* Make scenario picker */}
      {sourceType === "make_scenario" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-widest text-slate-500">Make Scenario</label>
            <button
              type="button"
              className="rounded-lg border border-violet-600/50 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-300 hover:bg-violet-500/20 transition"
              onClick={() => {
                setShowMakePicker(true);
                if (!makeScenarios && !makeScenarioLoading) fetchMakeScenarios();
              }}
            >
              Browse Scenarios
            </button>
          </div>

          {selectedMakeScenario && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-500/30 bg-violet-950/20 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-violet-200 truncate">{selectedMakeScenario.name}</p>
                <p className="text-[10px] text-slate-500">
                  ID: {selectedMakeScenario.id}
                  {" · "}
                  {selectedMakeScenario.isActive
                    ? <span className="text-emerald-400">active</span>
                    : <span className="text-slate-500">inactive</span>}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300"
                onClick={() => setSelectedMakeScenario(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {showMakePicker && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-950/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-violet-300">Your Make Scenarios</span>
                <button
                  type="button"
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                  onClick={() => { setShowMakePicker(false); setMakeScenarios(null); setMakeScenarioError(null); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {makeScenarioLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading scenarios…
                </div>
              )}
              {makeScenarioError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-300">
                  {makeScenarioError.toLowerCase().includes("not configured")
                    ? "Make.com API token is not configured. Add MAKE_API_TOKEN to your environment variables."
                    : makeScenarioError}
                </div>
              )}
              {makeScenarios && makeScenarios.length === 0 && (
                <p className="text-slate-400 text-[11px]">No scenarios found in your Make team.</p>
              )}
              {makeScenarios && makeScenarios.map((sc) => (
                <div key={sc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-slate-200">{sc.name}</p>
                    <p className="text-[10px] text-slate-500">
                      ID: {sc.id}
                      {" · "}
                      {sc.isActive ? <span className="text-emerald-400">active</span> : <span className="text-slate-500">inactive</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-violet-500/50 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/20 transition"
                    onClick={() => {
                      setSelectedMakeScenario(sc);
                      if (!name) setName(sc.name);
                      setShowMakePicker(false);
                    }}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Name + Description */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 mb-1.5 block">
            Name (optional)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 mb-1.5 block">
            Description (optional)
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
        </div>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div className={`text-xs ${step === "error" ? "text-red-400" : step === "done" ? "text-emerald-400" : "text-slate-400"}`}>
          {step !== "idle" && step !== "done" && step !== "error" && (
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
          )}
          {statusMsg}
        </div>
      )}

      {/* Pipeline progress */}
      {submitting && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {(["intake", "fetching", "packaging"] as const).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={step === s ? "text-amber-300 font-medium" : step === "done" || (["fetching","packaging"].includes(step) && i < ["intake","fetching","packaging"].indexOf(step)) ? "text-emerald-400" : ""}>
                {s === "intake" ? "Intake" : s === "fetching" ? "Fetch" : "Package"}
              </span>
            </span>
          ))}
        </div>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset list
// ─────────────────────────────────────────────────────────────────────────────

const BAND_COLORS: Record<TrustBand, string> = {
  L1_EXPERIMENTAL:         "text-red-300",
  L2_VERIFIED_COMMUNITY:   "text-orange-300",
  L3_PRODUCTION_CANDIDATE: "text-yellow-300",
  L4_PRODUCTION_APPROVED:  "text-emerald-300",
  L5_CORE_SOVEREIGN:       "text-cyan-300",
};

function AssetRow({
  asset,
  onClick,
}: {
  asset: RegistryAssetSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200 truncate">{asset.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
            {asset.assetClass}
          </span>
          <span className={`text-[10px] ${BAND_COLORS[asset.trustBand]}`}>
            {TBL[asset.trustBand]}
          </span>
        </div>
        {asset.description && (
          <div className="mt-0.5 text-xs text-slate-500 truncate">{asset.description}</div>
        )}
      </div>
      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ring-1 ${
        asset.publicationStatus === "published"
          ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
          : "bg-slate-700/30 text-slate-400 ring-slate-500/20"
      }`}>
        {asset.publicationStatus}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Q¢ Platform Rail Banner
// ─────────────────────────────────────────────────────────────────────────────

function PlatformRailBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2">
      <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Q¢ — Platform Rail</span>
        <p className="text-[11px] text-slate-400">Base currency for content, access, and platform rewards across all cartridges.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Intake pipeline view (mirrors codex FactoryIntakeTab)
// ─────────────────────────────────────────────────────────────────────────────

type IntakeStatus = "received" | "fetching" | "classifying" | "packaging" | "validating" | "scored" | "review_pending" | "published" | "rejected" | "failed";

interface IntakeRecord {
  intakeId: string;
  submittedBy: string;
  sourceType: string;
  status: IntakeStatus;
  currentStage: string;
  createdAt: string;
  failureReason?: string;
}

const INTAKE_STATUS_ICON: Record<IntakeStatus, React.ReactNode> = {
  received:       <Clock className="h-3 w-3 text-slate-400" />,
  fetching:       <Loader2 className="h-3 w-3 animate-spin text-blue-300" />,
  classifying:    <Loader2 className="h-3 w-3 animate-spin text-sky-300" />,
  packaging:      <Loader2 className="h-3 w-3 animate-spin text-amber-300" />,
  validating:     <Loader2 className="h-3 w-3 animate-spin text-amber-300" />,
  scored:         <Clock className="h-3 w-3 text-amber-300" />,
  review_pending: <Clock className="h-3 w-3 text-yellow-300" />,
  published:      <CheckCircle2 className="h-3 w-3 text-emerald-300" />,
  rejected:       <XCircle className="h-3 w-3 text-rose-300" />,
  failed:         <AlertTriangle className="h-3 w-3 text-red-300" />,
};

function IntakePipelineView() {
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/registry/intake?tenantId=platform");
      const data = await res.json();
      if (!res.ok && !data._note) { setError(`Error ${res.status}`); return; }
      setIntakes(data.data ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          Active and recent intake submissions flowing through the factory pipeline.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2 text-xs text-rose-300">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : intakes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
          No active intakes. Submit an asset on the{" "}
          <span className="text-amber-400">Ingest New Asset</span> tab to start the pipeline.
        </div>
      ) : (
        <div className="space-y-1.5">
          {intakes.map((intake) => (
            <div
              key={intake.intakeId}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="shrink-0">
                {INTAKE_STATUS_ICON[intake.status] ?? <Clock className="h-3 w-3 text-slate-400" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {intake.sourceType.replace("_", " ")}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${
                    intake.status === "published"
                      ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                      : intake.status === "failed" || intake.status === "rejected"
                      ? "bg-rose-500/20 text-rose-300 ring-rose-500/30"
                      : "bg-slate-700/30 text-slate-400 ring-slate-500/20"
                  }`}>
                    {intake.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">
                  {intake.intakeId.slice(0, 20)}…
                  {" · "}
                  Stage: {intake.currentStage}
                </div>
                {intake.failureReason && (
                  <div className="text-[10px] text-rose-400 truncate mt-0.5">{intake.failureReason}</div>
                )}
              </div>
              <div className="text-[10px] text-slate-600 shrink-0">
                {new Date(intake.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Asset card (grid view placeholder — full card design in next workstream)
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_CLASS_ICON: Record<RegistryAssetClass, React.ReactNode> = {
  ToolQube:      <Wrench className="h-5 w-5" />,
  SkillQube:     <Network className="h-5 w-5" />,
  WorkflowQube:  <GitMerge className="h-5 w-5" />,
  ConnectorQube: <Plug className="h-5 w-5" />,
};

function AssetCard({ asset, onClick }: { asset: RegistryAssetSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors focus-within:ring-2 focus-within:ring-amber-500/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">{ASSET_CLASS_ICON[asset.assetClass] ?? <Workflow className="h-5 w-5" />}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${
          asset.publicationStatus === "published"
            ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
            : "bg-slate-700/30 text-slate-400 ring-slate-500/20"
        }`}>{asset.publicationStatus}</span>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-200 truncate">{asset.name}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{ASSET_CLASS_LABELS[asset.assetClass]}</div>
      </div>
      {asset.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2">{asset.description}</p>
      )}
      <div className={`text-[10px] ${BAND_COLORS[asset.trustBand]}`}>{TBL[asset.trustBand]}</div>
    </button>
  );
}

export function IngestionFactoryPanel() {
  const [assets, setAssets] = useState<RegistryAssetSummary[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<RegistryAssetClass | "">("");
  const [bandFilter, setBandFilter] = useState<TrustBand | "">("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeSection, setActiveSection] = useState<"ingest" | "pipeline" | "assets">("ingest");
  const [assetsViewMode, setAssetsViewMode] = useState<ViewMode>("list");
  const [ingestSubmitting, setIngestSubmitting] = useState(false);
  const [ingestCanSubmit, setIngestCanSubmit] = useState(true);

  const handleIngestStateChange = useCallback((submitting: boolean, canSubmit: boolean) => {
    setIngestSubmitting(submitting);
    setIngestCanSubmit(canSubmit);
  }, []);

  const activeFilterCount = [classFilter, bandFilter, statusFilter].filter(Boolean).length;

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      // tenantId "platform" aligns with codex FactoryIntakeTab and RegistrySupplyTab
      const params = new URLSearchParams({ tenantId: "platform", limit: "100" });
      if (search) params.set("search", search);
      if (classFilter) params.set("assetClass", classFilter);
      if (bandFilter) params.set("trustBand", bandFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/registry/assets?${params}`).then((r) => r.json());
      if (res.ok || res._note) setAssets(res.data ?? []);
    } finally {
      setLoadingAssets(false);
    }
  }, [search, classFilter, bandFilter, statusFilter]);

  // Auto-reload when filters change
  useEffect(() => {
    if (activeSection === "assets") loadAssets();
  }, [classFilter, bandFilter, statusFilter, activeSection, loadAssets]);

  function handleIngestionSuccess(assetId: string) {
    setActiveSection("assets");
    loadAssets().then(() => setSelectedAssetId(assetId));
  }

  function clearFilters() {
    setClassFilter("");
    setBandFilter("");
    setStatusFilter("");
    setSearch("");
  }

  return (
    <div className="space-y-6">
      {/* Section tabs + right-justified ingest button */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-0">
        <div className="flex items-center gap-1">
          {(["ingest", "pipeline", "assets"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setActiveSection(s);
                if (s === "assets") loadAssets();
              }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeSection === s
                  ? "text-white border-b-2 border-amber-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s === "ingest" ? "Ingest New Asset" : s === "pipeline" ? "Pipeline Status" : "Ingested Assets"}
            </button>
          ))}
        </div>
        {/* Ingest / Connect button — only visible on ingest tab */}
        {activeSection === "ingest" && (
          <button
            type="submit"
            form="registry-intake-form"
            disabled={ingestSubmitting || !ingestCanSubmit}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-0.5 rounded-lg text-sm font-semibold bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
          >
            {ingestSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {ingestSubmitting ? "Processing…" : "Ingest Asset"}
          </button>
        )}
      </div>

      {activeSection === "ingest" && (
        <div>
          <div className="mb-4 text-sm text-slate-400">
            Submit an external tool, skill, MCP endpoint, or workflow definition for ingestion.
            The factory will fetch, classify, package, validate, and score it automatically.
            Submitted assets appear in the <strong className="text-slate-300">Pipeline Status</strong> tab
            and, once published, in the AgentiQ Codex Registry tab.
          </div>
          <IntakeForm formId="registry-intake-form" onSuccess={handleIngestionSuccess} onSubmittingChange={handleIngestStateChange} />
        </div>
      )}

      {activeSection === "pipeline" && <IntakePipelineView />}

      {activeSection === "assets" && (
        <div className="space-y-3">
          {/* Search + filter bar */}
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadAssets()}
              placeholder="Search assets…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
            />
            <button
              type="button"
              onClick={loadAssets}
              className="px-4 py-2 rounded-xl text-sm text-slate-300 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <ViewModeToggle value={assetsViewMode} onChange={setAssetsViewMode} />
          </div>

          {/* Filter dropdowns — green glass panel */}
          {showFilters && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 backdrop-blur-sm p-3 space-y-2 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500">Filters</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Asset Class</label>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value as RegistryAssetClass | "")}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  >
                    <option value="">All classes</option>
                    {(Object.keys(ASSET_CLASS_LABELS) as RegistryAssetClass[]).map((c) => (
                      <option key={c} value={c}>{ASSET_CLASS_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Trust Band</label>
                  <select
                    value={bandFilter}
                    onChange={(e) => setBandFilter(e.target.value as TrustBand | "")}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  >
                    <option value="">All bands</option>
                    {TRUST_BAND_ORDER.map((b) => (
                      <option key={b} value={b}>{TBL[b]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "")}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  >
                    <option value="">All statuses</option>
                    {ASSET_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {classFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                  {ASSET_CLASS_LABELS[classFilter]}
                  <button type="button" onClick={() => setClassFilter("")}><X className="h-2.5 w-2.5" /></button>
                </span>
              )}
              {bandFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                  {TBL[bandFilter]}
                  <button type="button" onClick={() => setBandFilter("")}><X className="h-2.5 w-2.5" /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-300">
                  {statusFilter}
                  <button type="button" onClick={() => setStatusFilter("")}><X className="h-2.5 w-2.5" /></button>
                </span>
              )}
            </div>
          )}

          {/* Results count */}
          {!loadingAssets && assets.length > 0 && (
            <div className="text-[10px] text-slate-500">
              {assets.length} asset{assets.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 ? " matching filters" : ""}
            </div>
          )}

          {loadingAssets ? (
            <div className={assetsViewMode === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 animate-pulse" : "space-y-2 animate-pulse"}>
              {[1, 2, 3].map((i) => <div key={i} className={`rounded-xl bg-white/5 ${assetsViewMode === "grid" ? "h-36" : "h-14"}`} />)}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
              {activeFilterCount > 0 ? (
                <>No assets match the current filters. <button type="button" onClick={clearFilters} className="text-emerald-400 hover:text-emerald-300 underline">Clear filters</button></>
              ) : (
                <>No assets yet. <button type="button" onClick={() => setActiveSection("ingest")} className="text-amber-400 hover:text-amber-300 underline">Ingest your first asset</button></>
              )}
            </div>
          ) : assetsViewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assets.map((a) => (
                <AssetCard
                  key={a.assetId}
                  asset={a}
                  onClick={() => setSelectedAssetId(a.assetId)}
                />
              ))}
            </div>
          ) : assetsViewMode === "table" ? (
            <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Class</th>
                    <th className="text-left px-4 py-3">Trust Band</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.assetId} className="border-t border-white/10 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedAssetId(a.assetId)}>
                      <td className="px-4 py-3 text-slate-200 truncate max-w-xs" title={a.name}>{a.name}</td>
                      <td className="px-4 py-3 text-slate-300">{ASSET_CLASS_LABELS[a.assetClass]}</td>
                      <td className={`px-4 py-3 text-[11px] ${BAND_COLORS[a.trustBand]}`}>{TBL[a.trustBand]}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${
                          a.publicationStatus === "published"
                            ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                            : "bg-slate-700/30 text-slate-400 ring-slate-500/20"
                        }`}>{a.publicationStatus}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" className="text-[11px] text-amber-400 hover:text-amber-300" onClick={(e) => { e.stopPropagation(); setSelectedAssetId(a.assetId); }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-1.5">
              {assets.map((a) => (
                <AssetRow
                  key={a.assetId}
                  asset={a}
                  onClick={() => setSelectedAssetId(a.assetId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asset detail slide-out */}
      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}
    </div>
  );
}
