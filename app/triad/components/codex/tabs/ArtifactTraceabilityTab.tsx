"use client";

/**
 * ArtifactTraceabilityTab — Codex operator traceability view
 *
 * COD-602: Allows operators to trace runtime/studio/admin behavior
 * back to source artifact and state lineage.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  FileSearch,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

type Artifact = {
  job_id: string;
  source_surface: string;
  status: string;
  created_at: string;
  created_by: string;
  target_surfaces: string[];
  journey_segments_affected: string[];
  ui_surfaces_affected: string[];
  package_dependencies: string[];
  validation_status: string;
  validation_errors: string[];
  rollback_available: boolean;
  parent_artifact_id: string | null;
  dvn_receipt_ids: string[];
  codex_entry_ids: string[];
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-slate-600 text-slate-400",
  pending_review: "border-amber-500/40 text-amber-300",
  approved: "border-emerald-500/40 text-emerald-300",
  ingested: "border-violet-500/40 text-violet-300",
  failed: "border-rose-500/40 text-rose-300",
  rolled_back: "border-slate-600 text-slate-500",
};

const VALIDATION_STYLES: Record<string, string> = {
  pending: "border-slate-600 text-slate-400",
  passed: "border-emerald-500/40 text-emerald-300",
  failed: "border-rose-500/40 text-rose-300",
  skipped: "border-slate-600 text-slate-500",
};

const SOURCE_STYLES: Record<string, string> = {
  studio: "border-blue-500/40 text-blue-300",
  codex: "border-violet-500/40 text-violet-300",
  registry: "border-amber-500/40 text-amber-300",
  guardian: "border-emerald-500/40 text-emerald-300",
  cli: "border-slate-600 text-slate-400",
};

interface ArtifactTraceabilityTabProps {
  theme?: "light" | "dark";
  personaId?: string;
}

export function ArtifactTraceabilityTab({ theme = "dark" }: ArtifactTraceabilityTabProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      const res = await fetch(`/api/admin/artifacts?${params}`);
      if (!res.ok) {
        setFetchError(`API error ${res.status} — ${res.statusText}`);
        return;
      }
      const data = await res.json();
      setArtifacts(data.artifacts ?? []);
    } catch {
      setFetchError("Network error — unable to reach the artifacts API.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => { void load(); }, [load]);

  const base = "rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200";

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSearch className="h-5 w-5 text-violet-400" />
          <div>
            <div className="font-semibold text-slate-100">Artifact Traceability</div>
            <div className="text-xs text-slate-400">
              Trace studio/runtime behavior back to source artifact and state lineage
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["", "draft", "pending_review", "approved", "ingested", "failed", "rolled_back"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
              statusFilter === s
                ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {s === "" ? "All statuses" : s.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {(["", "studio", "codex", "registry", "guardian", "cli"] as const).map((src) => (
          <button
            key={src}
            onClick={() => setSourceFilter(src)}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
              sourceFilter === src
                ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {src === "" ? "All sources" : src}
          </button>
        ))}
      </div>

      {/* COD-603 — Error state */}
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
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[11px] ${STATUS_STYLES[selected.status] ?? "border-slate-700 text-slate-400"}`}>
                  {selected.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={`text-[11px] ${SOURCE_STYLES[selected.source_surface] ?? "border-slate-700"}`}>
                  {selected.source_surface}
                </Badge>
                <Badge variant="outline" className={`text-[11px] ${VALIDATION_STYLES[selected.validation_status] ?? "border-slate-700 text-slate-400"}`}>
                  {selected.validation_status}
                </Badge>
              </div>
              <div className="font-mono text-xs text-slate-400">
                {selected.job_id}
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

          <div className="grid gap-3 md:grid-cols-2">
            {/* Target surfaces */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Target Surfaces</div>
              <div className="flex gap-1 flex-wrap">
                {selected.target_surfaces.length > 0
                  ? selected.target_surfaces.map((s) => (
                      <Badge key={s} variant="outline" className="border-slate-700 text-slate-300 text-[11px]">{s}</Badge>
                    ))
                  : <span className="text-xs text-slate-600">—</span>}
              </div>
            </div>

            {/* Journey segments */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Journey Segments</div>
              <div className="flex gap-1 flex-wrap">
                {selected.journey_segments_affected.length > 0
                  ? selected.journey_segments_affected.map((s) => (
                      <Badge key={s} variant="outline" className="border-violet-500/30 text-violet-300 text-[11px] capitalize">{s}</Badge>
                    ))
                  : <span className="text-xs text-slate-600">—</span>}
              </div>
            </div>

            {/* UI surfaces */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">UI Surfaces</div>
              <div className="flex gap-1 flex-wrap">
                {selected.ui_surfaces_affected.length > 0
                  ? selected.ui_surfaces_affected.map((s) => (
                      <Badge key={s} variant="outline" className="border-slate-700 text-slate-300 text-[11px]">{s}</Badge>
                    ))
                  : <span className="text-xs text-slate-600">—</span>}
              </div>
            </div>

            {/* Package dependencies */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Package Deps</div>
              <div className="flex gap-1 flex-wrap">
                {selected.package_dependencies.length > 0
                  ? selected.package_dependencies.map((s) => (
                      <Badge key={s} variant="outline" className="border-amber-500/30 text-amber-300 text-[11px]">{s}</Badge>
                    ))
                  : <span className="text-xs text-slate-600">—</span>}
              </div>
            </div>
          </div>

          {/* Lineage / provenance */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <GitBranch className="h-3 w-3" /> Provenance
            </div>
            <div className="grid gap-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28 shrink-0">Created by</span>
                <span className="font-mono text-slate-300">{selected.created_by}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28 shrink-0">Applied at</span>
                <span className="text-slate-300">
                  {new Date(selected.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              {selected.parent_artifact_id && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-28 shrink-0">Parent artifact</span>
                  <span className="font-mono text-slate-400 text-[11px]">{selected.parent_artifact_id.slice(0, 16)}…</span>
                </div>
              )}
              {selected.dvn_receipt_ids.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 w-28 shrink-0 pt-0.5">DVN receipts</span>
                  <div className="flex gap-1 flex-wrap">
                    {selected.dvn_receipt_ids.map((id) => (
                      <span key={id} className="font-mono text-[11px] text-emerald-400">{id.slice(0, 12)}…</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.codex_entry_ids.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 w-28 shrink-0 pt-0.5">Codex entries</span>
                  <div className="flex gap-1 flex-wrap">
                    {selected.codex_entry_ids.map((id) => (
                      <span key={id} className="font-mono text-[11px] text-violet-400">{id.slice(0, 12)}…</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validation errors */}
          {selected.validation_errors.length > 0 && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400">Validation Errors</div>
              <ul className="space-y-1">
                {selected.validation_errors.map((err, i) => (
                  <li key={i} className="text-xs text-rose-300 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>{err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.rollback_available && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-300">Rollback available for this artifact.</span>
            </div>
          )}
        </div>
      )}

      {/* Artifact list */}
      <div className={base}>
        {artifacts.length > 0 ? (
          <div className="space-y-1">
            {artifacts.map((a) => (
              <button
                key={a.job_id}
                onClick={() => setSelected(a)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors
                  ${selected?.job_id === a.job_id
                    ? "border-violet-500/40 bg-violet-500/5"
                    : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"}`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[11px] ${STATUS_STYLES[a.status] ?? "border-slate-700 text-slate-400"}`}>
                      {a.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className={`text-[11px] ${SOURCE_STYLES[a.source_surface] ?? "border-slate-700"}`}>
                      {a.source_surface}
                    </Badge>
                    <span className="font-mono text-[11px] text-slate-500 truncate">{a.job_id.slice(0, 16)}…</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {a.target_surfaces.join(", ") || "no targets"}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="py-6 text-center text-slate-400 text-sm">Loading artifacts…</div>
        ) : (
          <div className="py-6 text-center space-y-1">
            <div className="text-slate-400 text-sm">No artifacts found.</div>
            <div className="text-slate-600 text-xs">
              Artifacts are created when Studio, Codex, or CLI operations are committed via the orchestration engine.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArtifactTraceabilityTab;
