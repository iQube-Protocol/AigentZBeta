"use client";

/**
 * KpiDetailLayout — Phase 2 B.1.
 *
 * Per-KPI focused detail surface. Mounts when the operator clicks a
 * KPI chip in the Venture Cockpit. Shows the full record (name,
 * target, current value, unit, trend, source provenance, last
 * updated) plus an inline editor for manual values and a
 * "Reconnect source" affordance when the source activation is
 * inactive.
 *
 * Receives the selected `kpiId` through `composerKind`-style state on
 * the tab (`selectedKpiId`). When `selectedKpiId` is set AND
 * activeLayoutId === 'kpi-detail', this layout finds the matching
 * KPI in `ventureProgress.activeKpis` and renders detail.
 *
 * DIS template id: `kpi-detail-layout-v1`. Mobile shape: full-screen
 * reader (same as Brief).
 */

import React, { useCallback, useState } from "react";
import { TrendingUp, ArrowUp, ArrowDown, Minus, Loader2, AlertCircle, Pencil } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import { accent } from "./accentTokens";
import { getActivationEntry } from "@/data/activation-catalog";
import { personaFetch } from "@/utils/personaSpine";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

function KpiDetailLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    personaId,
    ventureProgress,
    selectedKpiId,
    onRequestLayout,
    onKpiEdited,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  const kpi = (ventureProgress?.activeKpis ?? []).find((k) => k.id === selectedKpiId) ?? null;
  const metricClass = kpi?.class ?? "activity";
  const accentKey =
    kpi?.unresolvedReason
      ? "slate"
      : metricClass === "outcome"
        ? "violet"
        : metricClass === "standing"
          ? "amber"
          : "cyan";
  const tint = accent(accentKey, isDark ? "dark" : "light");

  const [draftValue, setDraftValue] = useState<string>(
    kpi?.current !== null && kpi?.current !== undefined ? String(kpi.current) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDismiss = useCallback(() => {
    onRequestLayout?.("venture-cockpit");
  }, [onRequestLayout]);

  const isManual = kpi?.source.kind === "manual";
  const activationEntry =
    kpi?.source.kind === "activation" && kpi.source.activationId
      ? getActivationEntry(kpi.source.activationId)
      : null;

  const handleSaveManual = useCallback(async () => {
    if (!kpi || !personaId) return;
    const next = Number(draftValue);
    if (!Number.isFinite(next)) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Read current KPIs, patch this one, write back. The
      // experience-model POST merges so partial writes are safe.
      const modelRes = await personaFetch("/api/assistant/experience-model", { personaIdHint: personaId });
      const model = await modelRes.json();
      const current = (model?.activeKpis ?? {}) as Record<string, unknown>;
      // Coerce shape — write rich back.
      const out: Record<string, unknown> = { ...current };
      out[kpi.id] = {
        ...kpi,
        current: next,
        lastUpdatedAt: new Date().toISOString(),
      };
      const saveRes = await personaFetch("/api/assistant/experience-model", {
        personaIdHint: personaId,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blak: { activeKpis: out } }),
      });
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `Save failed (${saveRes.status})`);
      }
      onKpiEdited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [kpi, draftValue, personaId, onKpiEdited]);

  if (!kpi) {
    return (
      <LayoutShell
        surfaceId="kpi-detail"
        disTemplateId="kpi-detail-layout-v1"
        theme={theme}
        headerIcon={<TrendingUp className="h-3.5 w-3.5" />}
        headerEyebrow="KPI"
        headerTitle="No KPI selected"
        onDismiss={handleDismiss}
        dismissLabel="Back to cockpit"
        body={
          <div className={`rounded-lg border p-5 lg:p-6 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
            <p className={`text-xs ${mutedClass}`}>
              Pick a KPI in the Venture Cockpit to see its detail here.
            </p>
          </div>
        }
      />
    );
  }

  const trendIcon =
    kpi.trend === "up" ? <ArrowUp className="h-4 w-4" /> :
    kpi.trend === "down" ? <ArrowDown className="h-4 w-4" /> :
    kpi.trend === "flat" ? <Minus className="h-4 w-4" /> : null;
  const trendClass =
    kpi.trend === "up" ? (isDark ? "text-emerald-300" : "text-emerald-700") :
    kpi.trend === "down" ? (isDark ? "text-rose-300" : "text-rose-700") :
    (isDark ? "text-slate-400" : "text-slate-500");

  const sourceLabel =
    kpi.source.kind === "manual"
      ? "Manual — operator maintained"
      : activationEntry
        ? `${activationEntry.label} → ${kpi.source.metric ?? "—"}`
        : "Unknown source";

  return (
    <LayoutShell
      surfaceId="kpi-detail"
      disTemplateId="kpi-detail-layout-v1"
      theme={theme}
      headerIcon={<TrendingUp className="h-3.5 w-3.5" />}
      headerEyebrow={
        metricClass === "outcome" ? "Outcome KPI" :
        metricClass === "standing" ? "Standing KPI" :
        "Activity KPI"
      }
      headerTitle={kpi.name}
      onDismiss={handleDismiss}
      dismissLabel="Back to cockpit"
      body={
        <div className="space-y-4">
          {/* Hero value */}
          <div className={`rounded-2xl border p-5 backdrop-blur-sm ${tint.border} ${tint.fillStrong}`}>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className={`text-3xl font-semibold leading-none ${tint.text}`}>
                {kpi.current === null ? "—" : kpi.current}
              </div>
              {kpi.unit && (
                <div className={`text-sm ${mutedClass}`}>{kpi.unit}</div>
              )}
              {trendIcon && (
                <div className={`flex items-center gap-1 text-sm ml-auto ${trendClass}`}>
                  {trendIcon}
                  <span>30-day trend</span>
                </div>
              )}
            </div>
            {kpi.target && (
              <div className={`text-xs mt-2 ${mutedClass}`}>
                <span className={tint.eyebrow}>Target:</span> {kpi.target}
              </div>
            )}
          </div>

          {/* Source provenance */}
          <div className={`rounded-lg border p-4 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
            <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-1`}>
              Source
            </div>
            <div className="text-sm font-medium">{sourceLabel}</div>
            {kpi.unresolvedReason && (
              <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${isDark ? "text-amber-300/90" : "text-amber-700"}`}>
                <AlertCircle className="w-3 h-3" />
                {kpi.unresolvedReason === "source-inactive"
                  ? `Activate ${activationEntry?.label ?? "the source"} in the Activations tab to start tracking.`
                  : kpi.unresolvedReason === "metric-unknown"
                    ? "Metric no longer available in the catalog."
                    : "Source query failed; showing stored value."}
              </div>
            )}
            {kpi.lastUpdatedAt && (
              <div className={`text-[10px] mt-2 ${mutedClass}`}>
                Last updated {new Date(kpi.lastUpdatedAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Manual value editor */}
          {isManual && (
            <div className={`rounded-lg border p-4 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
              <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-2 flex items-center gap-1`}>
                <Pencil className="w-3 h-3" />
                Update value
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  placeholder="Current value"
                  className={`flex-1 px-3 py-2 rounded border text-sm ${
                    isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                  } focus:border-violet-500/60 focus:outline-none`}
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={handleSaveManual}
                  disabled={saving}
                  className={`flex items-center gap-1 px-3 py-2 rounded border text-xs font-medium ${
                    isDark
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                      : "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
                  } disabled:opacity-50`}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </button>
              </div>
              {error && (
                <p className="text-xs text-amber-300 mt-2">{error}</p>
              )}
            </div>
          )}
        </div>
      }
    />
  );
}

export const KpiDetailLayout: RightPaneLayoutDefinition = {
  id: "kpi-detail",
  label: "KPI detail",
  component: KpiDetailLayoutComponent,
  disTemplateId: "kpi-detail-layout-v1",
};
