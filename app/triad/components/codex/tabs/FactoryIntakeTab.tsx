"use client";

/**
 * FactoryIntakeTab — Registry Ingestion Factory pipeline view
 *
 * Shows all intake submissions for the current tenant with stage
 * progression, trust band, status, and failure diagnostics.
 * Reads from GET /api/registry/intake?tenantId=xxx (existing route).
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Factory,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type IngestionStatus =
  | "received"
  | "fetching"
  | "classifying"
  | "packaging"
  | "validating"
  | "scored"
  | "review_pending"
  | "published"
  | "rejected"
  | "failed";

type IngestionStage =
  | "intake.created"
  | "source.fetched"
  | "classified"
  | "packaged"
  | "validation.running"
  | "trust.scored"
  | "review.pending"
  | "asset.published"
  | "ingestion.failed";

interface StageEvent {
  stage: IngestionStage;
  enteredAt: string;
  exitedAt?: string;
  durationMs?: number;
  notes?: string;
  error?: string;
}

interface Intake {
  intakeId: string;
  tenantId: string;
  submittedBy: string;
  sourceType: string;
  sourceUri?: string;
  status: IngestionStatus;
  currentStage: IngestionStage;
  stageHistory: StageEvent[];
  assetId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<IngestionStatus, string> = {
  received:       "border-slate-600 text-slate-300",
  fetching:       "border-blue-500/60 text-blue-200",
  classifying:    "border-sky-500/60 text-sky-200",
  packaging:      "border-indigo-500/60 text-indigo-200",
  validating:     "border-amber-500/60 text-amber-200",
  scored:         "border-amber-400/80 text-amber-100",
  review_pending: "border-yellow-400/80 text-yellow-200",
  published:      "border-emerald-500/70 text-emerald-200",
  rejected:       "border-rose-500/70 text-rose-200",
  failed:         "border-red-500/70 text-red-200",
};

const STATUS_ICON: Record<IngestionStatus, React.ReactNode> = {
  received:       <Clock className="h-3.5 w-3.5" />,
  fetching:       <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
  classifying:    <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
  packaging:      <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
  validating:     <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
  scored:         <Clock className="h-3.5 w-3.5" />,
  review_pending: <Clock className="h-3.5 w-3.5" />,
  published:      <CheckCircle2 className="h-3.5 w-3.5" />,
  rejected:       <XCircle className="h-3.5 w-3.5" />,
  failed:         <AlertTriangle className="h-3.5 w-3.5" />,
};

const STAGE_LABELS: Record<IngestionStage, string> = {
  "intake.created":    "Received",
  "source.fetched":    "Source Fetched",
  "classified":        "Classified",
  "packaged":          "Packaged",
  "validation.running":"Validating",
  "trust.scored":      "Trust Scored",
  "review.pending":    "Pending Review",
  "asset.published":   "Published",
  "ingestion.failed":  "Failed",
};

const PIPELINE_STAGES: IngestionStage[] = [
  "intake.created",
  "source.fetched",
  "classified",
  "packaged",
  "validation.running",
  "trust.scored",
  "review.pending",
  "asset.published",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stageIndex(stage: IngestionStage): number {
  const i = PIPELINE_STAGES.indexOf(stage);
  return i === -1 ? 0 : i;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface FactoryIntakeTabProps {
  theme?: "light" | "dark";
  personaId?: string;
  /** Override tenant — defaults to "platform" for operator view */
  tenantId?: string;
}

export function FactoryIntakeTab({ theme = "dark", tenantId = "platform" }: FactoryIntakeTabProps) {
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [selected, setSelected] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ tenantId });
      const res = await fetch(`/api/registry/intake?${params}`);
      if (!res.ok) {
        setFetchError(`API error ${res.status} — ${res.statusText}`);
        return;
      }
      const data = await res.json();
      setIntakes(data.data ?? []);
    } catch {
      setFetchError("Network error — unable to reach the intake API.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = statusFilter
    ? intakes.filter((i) => i.status === statusFilter)
    : intakes;

  const base = "rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200";

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory className="h-5 w-5 text-amber-400" />
          <div>
            <div className="font-semibold text-slate-100">Registry Ingestion Factory</div>
            <div className="text-xs text-slate-400">
              Track asset intake submissions through the full pipeline
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Pipeline model — always visible so stakeholders understand the stages */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pipeline stages</div>
        <div className="flex items-center gap-0 w-full">
          {(["Received","Fetched","Classified","Packaged","Validating","Scored","Review","Published"] as const).map((label, idx, arr) => (
            <div key={label} className="flex items-center flex-1 min-w-0">
              <div className="h-1.5 w-1.5 rounded-full shrink-0 bg-slate-600" />
              {idx < arr.length - 1 && <div className="h-px flex-1 bg-slate-800" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>Received</span>
          <span>Validating</span>
          <span>Published</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Submissions advance through each stage when Factory pipeline services run. Intakes stuck at an in-progress stage are awaiting service processing or manual review.
        </p>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(["", "received", "validating", "review_pending", "published", "failed", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
              statusFilter === s
                ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-rose-300">{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}
            className="h-6 text-xs text-rose-400 hover:text-rose-300 shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className={`${base} space-y-4`}>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`gap-1 text-[11px] ${STATUS_STYLES[selected.status] ?? "border-slate-700 text-slate-400"}`}
                >
                  {STATUS_ICON[selected.status]}
                  {selected.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-400 text-[11px]">
                  {selected.sourceType}
                </Badge>
              </div>
              <div className="font-mono text-[11px] text-slate-400">{selected.intakeId}</div>
              <div className="text-xs text-slate-500">
                Submitted by <span className="text-slate-300">{selected.submittedBy}</span>
                {" · "}{fmtDate(selected.createdAt)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
              className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Pipeline progress bar */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pipeline Stage</div>
            <div className="flex items-center gap-0">
              {PIPELINE_STAGES.map((stage, idx) => {
                const current = stageIndex(selected.currentStage);
                const done = idx < current;
                const active = idx === current && selected.status !== "failed" && selected.status !== "rejected";
                const failed = selected.status === "failed" || selected.status === "rejected";
                const dot = done || (active && !failed);
                return (
                  <div key={stage} className="flex items-center flex-1 min-w-0">
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        failed && idx === current
                          ? "bg-rose-500"
                          : dot
                          ? "bg-emerald-500"
                          : active
                          ? "bg-amber-400"
                          : "bg-slate-700"
                      }`}
                      title={STAGE_LABELS[stage]}
                    />
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div className={`h-px flex-1 ${done ? "bg-emerald-500/40" : "bg-slate-800"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>{STAGE_LABELS[PIPELINE_STAGES[0]]}</span>
              <span className="text-amber-400/80">{STAGE_LABELS[selected.currentStage]}</span>
              <span>{STAGE_LABELS[PIPELINE_STAGES[PIPELINE_STAGES.length - 1]]}</span>
            </div>
          </div>

          {/* Source URI */}
          {selected.sourceUri && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Source</div>
              <div className="font-mono text-[11px] text-slate-300 break-all">{selected.sourceUri}</div>
            </div>
          )}

          {/* Published asset link */}
          {selected.assetId && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] text-emerald-400 font-semibold">Asset published</div>
                <div className="font-mono text-[11px] text-emerald-300">{selected.assetId}</div>
              </div>
            </div>
          )}

          {/* Failure reason */}
          {selected.failureReason && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-400 mb-1">Failure Reason</div>
              <div className="text-xs text-rose-300">{selected.failureReason}</div>
            </div>
          )}

          {/* Stage history */}
          {selected.stageHistory.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stage History</div>
              <div className="space-y-1">
                {selected.stageHistory.map((ev, i) => (
                  <div key={i} className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">{STAGE_LABELS[ev.stage] ?? ev.stage}</div>
                    <div className="text-[10px] text-slate-500 shrink-0">
                      {new Date(ev.enteredAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      {ev.durationMs != null && ` · ${ev.durationMs}ms`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Intake list */}
      <div className={base}>
        {filtered.length > 0 ? (
          <div className="space-y-1">
            {filtered.map((intake) => (
              <button
                key={intake.intakeId}
                onClick={() => setSelected(intake)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected?.intakeId === intake.intakeId
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`gap-1 text-[11px] ${STATUS_STYLES[intake.status] ?? "border-slate-700 text-slate-400"}`}
                    >
                      {STATUS_ICON[intake.status]}
                      {intake.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-[11px]">
                      {intake.sourceType}
                    </Badge>
                    <span className="font-mono text-[11px] text-slate-500 truncate">
                      {intake.intakeId.slice(0, 16)}…
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {intake.submittedBy}
                    {" · "}
                    {fmtDateShort(intake.createdAt)}
                    {" · "}
                    {STAGE_LABELS[intake.currentStage]}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading intakes…</div>
        ) : (
          <div className="py-8 text-center space-y-2">
            <div className="text-slate-300 text-sm font-medium">No intakes yet</div>
            <div className="text-slate-500 text-xs max-w-sm mx-auto">
              Intakes are created when contributors submit a ToolQube, SkillQube, WorkflowQube, or ConnectorQube
              via the Registry Ingestion Factory API or AgentiQ SDK.
            </div>
            <div className="text-slate-600 text-xs mt-1">
              Use <code className="bg-slate-800 px-1 rounded text-slate-400">POST /api/registry/intake</code> to submit your first asset.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FactoryIntakeTab;
