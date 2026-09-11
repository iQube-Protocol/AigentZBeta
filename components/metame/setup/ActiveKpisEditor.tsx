"use client";

/**
 * ActiveKpisEditor — focused modal for declaring which KPIs the cockpit
 * tracks.
 *
 * Phase 2 B.1 refactor: the source picker is dynamically driven by the
 * persona's Activations tab. The operator picks a metric exposed by an
 * active activation (or "Manual" for operator-maintained values);
 * inactive activations show their metrics greyed out with an "Activate
 * this surface to track" hint. Adding a new activation in
 * `data/activation-catalog.ts` automatically expands the picker —
 * nothing else changes here.
 *
 * Schema: writes the rich `KpiRecord[]` shape to
 * `blak.activeKpis = { [id]: KpiRecord }`. Legacy `{name: target}` rows
 * are coerced on read so existing personas keep working.
 *
 * Saves via POST /api/assistant/experience-model with `{ blak: { activeKpis } }`.
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, X, TrendingUp, AlertCircle } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  coerceKpisToRichShape,
  legacyIdFromName,
  type KpiRecord,
  type KpiSource,
} from "@/services/strategy/kpiTypes";
import {
  ACTIVATION_CATALOG,
  type ActivationCatalogEntry,
  type ActivationMetric,
} from "@/data/activation-catalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  onSaved?: (kpis: Record<string, KpiRecord>) => void;
}

interface ActivationSurfaceLite {
  id: string;
  label: string;
  status: 'active' | 'pending' | 'revoked' | null;
}

const MAX_KPIS = 12;
const MAX_NAME = 60;
const MAX_TARGET = 200;

function newKpiId(): string {
  return `kpi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function ActiveKpisEditor({ open, onOpenChange, personaId, onSaved }: Props) {
  const [rows, setRows] = useState<KpiRecord[]>([]);
  const [activations, setActivations] = useState<ActivationSurfaceLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load both the persona's current KPIs AND their active activations
  // so the source picker can be filtered in-place.
  useEffect(() => {
    if (!open || !personaId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      personaFetch("/api/assistant/experience-model", { personaIdHint: personaId })
        .then((r) => r.json()),
      personaFetch("/api/assistant/activations", { personaIdHint: personaId })
        .then((r) => r.json())
        .catch(() => ({ activations: [] })),
    ])
      .then(([model, acts]) => {
        if (cancelled) return;
        const rich = coerceKpisToRichShape(model?.activeKpis);
        setRows(Object.values(rich));
        const surfaces: ActivationSurfaceLite[] = Array.isArray(acts?.activations)
          ? acts.activations.map((s: { id: string; label: string; status: ActivationSurfaceLite['status'] }) => ({
              id: s.id,
              label: s.label,
              status: s.status,
            }))
          : [];
        setActivations(surfaces);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load current KPIs");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, personaId]);

  // Source options — grouped by activation, with "Manual" always first.
  // Inactive activations stay visible but their metrics are tagged so
  // the operator knows they need to switch the surface on first.
  const sourceGroups = useMemo(() => {
    const activeSet = new Set(activations.filter((a) => a.status === 'active').map((a) => a.id));
    const groups: Array<{
      activationId: string;
      activationLabel: string;
      isActive: boolean;
      metrics: ActivationMetric[];
    }> = [];
    for (const entry of ACTIVATION_CATALOG) {
      const metrics = entry.metrics ?? [];
      if (metrics.length === 0) continue;
      groups.push({
        activationId: entry.id,
        activationLabel: entry.label,
        isActive: activeSet.has(entry.id),
        metrics,
      });
    }
    // Active activations first; inactive at the bottom.
    groups.sort((a, b) => Number(b.isActive) - Number(a.isActive));
    return groups;
  }, [activations]);

  const addKpi = useCallback(() => {
    if (rows.length >= MAX_KPIS) {
      setError(`Limit ${MAX_KPIS} KPIs — remove one first.`);
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: newKpiId(),
        name: '',
        target: '',
        current: null,
        trend: 'unknown',
        lastUpdatedAt: null,
        source: { kind: 'manual' },
        class: 'activity',
      },
    ]);
    setError(null);
  }, [rows.length]);

  const removeKpi = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateKpi = useCallback((id: string, patch: Partial<KpiRecord>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  /** Bind a row to a specific activation+metric source, auto-filling
      name/unit/class from the catalog entry. */
  const setSource = useCallback((id: string, source: KpiSource) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (source.kind !== 'activation' || !source.activationId || !source.metric) {
          return { ...r, source };
        }
        const entry = ACTIVATION_CATALOG.find((e) => e.id === source.activationId);
        const metric = entry?.metrics?.find((m) => m.metric === source.metric);
        if (!metric) return { ...r, source };
        return {
          ...r,
          source,
          name: r.name || metric.label,
          unit: r.unit || metric.defaultUnit,
          class: metric.class ?? 'activity',
        };
      }),
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!personaId) return;
    setSaving(true);
    setError(null);
    try {
      // Drop rows with empty name AND empty target.
      const trimmed = rows.filter((r) => r.name.trim() || r.target.trim());
      if (trimmed.length > MAX_KPIS) {
        setError(`Limit ${MAX_KPIS} KPIs — remove one first.`);
        return;
      }
      const activeKpis: Record<string, KpiRecord> = {};
      for (const r of trimmed) {
        const id = r.id || legacyIdFromName(r.name);
        activeKpis[id] = { ...r, id, name: r.name.trim(), target: r.target.trim() };
      }
      const res = await personaFetch("/api/assistant/experience-model", {
        personaIdHint: personaId,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blak: { activeKpis } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `Save failed (${res.status})`);
      }
      void personaFetch("/api/assistant/inferred-strategy", {
        personaIdHint: personaId,
        method: "POST",
      }).catch(() => undefined);
      onSaved?.(activeKpis);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [rows, onOpenChange, onSaved, personaId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Active KPIs
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            The measurements that turn motion into progress. Pick a metric
            from one of your active activations — its value resolves
            automatically. Or choose Manual to track a number yourself.
            New activations bring new KPI sources without any code change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading KPIs…
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {rows.length === 0 ? (
                  <li className="text-xs text-slate-500 italic">
                    No KPIs yet — add one below to start tracking.
                  </li>
                ) : (
                  rows.map((kpi) => (
                    <KpiEditorRow
                      key={kpi.id}
                      kpi={kpi}
                      sourceGroups={sourceGroups}
                      onChange={(patch) => updateKpi(kpi.id, patch)}
                      onSetSource={(source) => setSource(kpi.id, source)}
                      onRemove={() => removeKpi(kpi.id)}
                    />
                  ))
                )}
              </ul>

              <button
                type="button"
                onClick={addKpi}
                disabled={rows.length >= MAX_KPIS}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-200 text-sm hover:bg-violet-500/20 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Add KPI
              </button>

              <p className="text-[11px] text-slate-500">
                {rows.length}/{MAX_KPIS} KPIs. Outcome metrics get violet emphasis in the cockpit; activity metrics stay neutral.
              </p>
              {error && (
                <p className="text-xs text-amber-300">{error}</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-100 text-sm hover:bg-violet-500/30 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save KPIs
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────

interface RowProps {
  kpi: KpiRecord;
  sourceGroups: Array<{
    activationId: string;
    activationLabel: string;
    isActive: boolean;
    metrics: ActivationMetric[];
  }>;
  onChange: (patch: Partial<KpiRecord>) => void;
  onSetSource: (source: KpiSource) => void;
  onRemove: () => void;
}

function KpiEditorRow({ kpi, sourceGroups, onChange, onSetSource, onRemove }: RowProps) {
  // Build a stable select value: "manual" | "activation:<id>:<metric>"
  const sourceValue =
    kpi.source.kind === 'manual'
      ? 'manual'
      : kpi.source.kind === 'activation' && kpi.source.activationId && kpi.source.metric
        ? `activation:${kpi.source.activationId}:${kpi.source.metric}`
        : 'manual';

  const sourceInactive =
    kpi.source.kind === 'activation' &&
    !!kpi.source.activationId &&
    !sourceGroups.find((g) => g.activationId === kpi.source.activationId)?.isActive;

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'manual') {
      onSetSource({ kind: 'manual' });
      return;
    }
    const m = value.match(/^activation:([^:]+):(.+)$/);
    if (m) {
      onSetSource({ kind: 'activation', activationId: m[1], metric: m[2] });
    }
  };

  return (
    <li className="rounded border border-slate-700/60 bg-slate-800/40 p-2.5 space-y-2">
      {/* Row 1: name + target */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
        <input
          type="text"
          value={kpi.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={MAX_NAME}
          placeholder="KPI name"
          className="px-2 py-1 text-sm rounded border border-slate-700 bg-slate-900/60 text-slate-100 focus:border-violet-500/60 focus:outline-none"
          aria-label="KPI name"
        />
        <input
          type="text"
          value={kpi.target}
          onChange={(e) => onChange({ target: e.target.value })}
          placeholder="Target (e.g. 500 weekly actives by Q3)"
          maxLength={MAX_TARGET}
          className="px-2 py-1 text-sm rounded border border-slate-700 bg-slate-900/60 text-slate-100 focus:border-violet-500/60 focus:outline-none"
          aria-label="KPI target"
        />
      </div>
      {/* Row 2: source picker + remove */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-[0.16em] text-slate-400 shrink-0">
          Source
        </label>
        <select
          value={sourceValue}
          onChange={handleSourceChange}
          className="flex-1 px-2 py-1 text-xs rounded border border-slate-700 bg-slate-900/60 text-slate-100 focus:border-violet-500/60 focus:outline-none"
        >
          <option value="manual">Manual — operator maintained</option>
          {sourceGroups.map((g) => (
            <optgroup
              key={g.activationId}
              label={`${g.activationLabel}${g.isActive ? '' : ' (inactive)'}`}
            >
              {g.metrics.map((m) => (
                <option
                  key={`${g.activationId}:${m.metric}`}
                  value={`activation:${g.activationId}:${m.metric}`}
                >
                  {m.label}
                  {m.class === 'outcome' ? ' ◆' : m.class === 'standing' ? ' ▲' : ''}
                  {g.isActive ? '' : '  — activate to track'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove KPI"
          className="p-1 text-slate-400 hover:text-rose-300 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {sourceInactive && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90">
          <AlertCircle className="w-3 h-3" />
          This source activation is currently inactive. Switch it on in the Activations tab to start tracking.
        </div>
      )}
    </li>
  );
}

export default ActiveKpisEditor;
