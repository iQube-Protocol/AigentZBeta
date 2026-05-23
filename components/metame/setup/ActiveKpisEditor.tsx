"use client";

/**
 * ActiveKpisEditor — focused modal for declaring the KPIs that make
 * venture progress measurable (the `blak.activeKpis` slice of the
 * ExperienceQube).
 *
 * Each KPI is a name → target pair. The strategy inference layer only
 * counts entries (privacy: values stay on-server), but storing the
 * target line gives the user something concrete to point to when the
 * brief / NBE flow asks "how are you measuring this?"
 *
 * Saves via POST /api/assistant/experience-model with
 * `{ blak: { activeKpis } }`. The route merges, so partial updates are
 * safe.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, X, TrendingUp } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  onSaved?: (kpis: Record<string, string>) => void;
}

interface KpiRow {
  name: string;
  target: string;
}

const MAX_KPIS = 10;
const MAX_NAME = 60;
const MAX_TARGET = 200;

function recordToRows(record: Record<string, unknown> | null | undefined): KpiRow[] {
  if (!record) return [];
  return Object.entries(record).map(([name, target]) => ({
    name,
    target: typeof target === "string" ? target : JSON.stringify(target),
  }));
}

function rowsToRecord(rows: KpiRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    out[name] = r.target.trim();
  }
  return out;
}

export function ActiveKpisEditor({ open, onOpenChange, personaId, onSaved }: Props) {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftTarget, setDraftTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !personaId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    personaFetch("/api/assistant/experience-model", { personaIdHint: personaId })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRows(recordToRows(data?.activeKpis));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load current KPIs");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, personaId]);

  const addKpi = useCallback(() => {
    const name = draftName.trim();
    const target = draftTarget.trim();
    if (!name) return;
    if (rows.length >= MAX_KPIS) {
      setError(`Limit ${MAX_KPIS} KPIs — remove one first.`);
      return;
    }
    if (rows.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`Already have a KPI named "${name}".`);
      return;
    }
    setRows((prev) => [...prev, { name: name.slice(0, MAX_NAME), target: target.slice(0, MAX_TARGET) }]);
    setDraftName("");
    setDraftTarget("");
    setError(null);
  }, [draftName, draftTarget, rows]);

  const removeKpi = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateKpi = useCallback((idx: number, patch: Partial<KpiRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const handleSave = useCallback(async () => {
    if (!personaId) return;
    setSaving(true);
    setError(null);
    try {
      const activeKpis = rowsToRecord(rows);
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
      <DialogContent className="max-w-xl bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Active KPIs
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            The measurements that turn motion into progress. Name the KPI, declare a target.
            Strategy inference uses presence; the values stay on-server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loading ? (
            <div className="flex items-center text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading KPIs…
            </div>
          ) : (
            <>
              <ul className="space-y-1.5">
                {rows.length === 0 ? (
                  <li className="text-xs text-slate-500 italic">
                    No KPIs yet — add your first below.
                  </li>
                ) : (
                  rows.map((r, i) => (
                    <li
                      key={`${i}-${r.name}`}
                      className="flex items-start gap-2 rounded border border-slate-700/60 bg-slate-800/40 px-2.5 py-1.5"
                    >
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-1.5">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => updateKpi(i, { name: e.target.value })}
                          maxLength={MAX_NAME}
                          className="px-2 py-1 text-sm rounded border border-slate-700 bg-slate-900/60 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                          aria-label="KPI name"
                        />
                        <input
                          type="text"
                          value={r.target}
                          onChange={(e) => updateKpi(i, { target: e.target.value })}
                          placeholder="Target (e.g. 500 weekly actives by Q3)"
                          maxLength={MAX_TARGET}
                          className="px-2 py-1 text-sm rounded border border-slate-700 bg-slate-900/60 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                          aria-label="KPI target"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeKpi(i)}
                        className="p-1 text-slate-400 hover:text-rose-300 shrink-0 mt-1"
                        aria-label="Remove KPI"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="KPI name"
                  maxLength={MAX_NAME}
                  className="px-3 py-2 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
                />
                <input
                  type="text"
                  value={draftTarget}
                  onChange={(e) => setDraftTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKpi();
                    }
                  }}
                  placeholder="Target"
                  maxLength={MAX_TARGET}
                  className="px-3 py-2 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addKpi}
                  disabled={!draftName.trim() || rows.length >= MAX_KPIS}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-violet-500/40 bg-violet-500/10 text-violet-200 text-sm disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                {rows.length}/{MAX_KPIS} KPIs. One concrete target per row beats a dashboard of vague intent.
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

export default ActiveKpisEditor;
