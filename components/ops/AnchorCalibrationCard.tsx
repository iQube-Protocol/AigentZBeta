"use client";

/**
 * AnchorCalibrationCard — runtime tunable K / T / cron cadence + pause.
 *
 * Reads + writes /api/ops/sync/calibration. Surfaces the current values
 * with editable inputs, a save button, and a live anchor-history mini-
 * feed showing the most recent cycle decisions. Lets the operator tune
 * the network-cost vs audit-SLA trade-off without env-var changes or
 * redeploys.
 *
 * See:
 *   - app/api/ops/sync/cron-tick/route.ts  — the consumer of these knobs
 *   - codexes/packs/agentiq/items/AGENTIQ_NETWORK_COSTS.md — cost model
 */

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, Pause, Play, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ConfigRow {
  batch_size_k: number;
  max_age_minutes_t: number;
  cron_cadence_seconds: number;
  is_paused: boolean;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  batch_id: string | null;
  anchor_txid: string | null;
  receipt_count: number;
  cycle_action: "anchored" | "deferred" | "skipped" | "failed";
  decision_reason: "size_k" | "time_t" | "manual" | "idle" | "paused" | "error";
  drift_before: number | null;
  drift_after: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

function Card({
  title,
  children,
  actions,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-4 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function actionBadge(action: HistoryRow["cycle_action"]) {
  switch (action) {
    case "anchored":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "deferred":
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    case "skipped":
      return "bg-slate-600/15 text-slate-400 border-slate-600/30";
    case "failed":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  }
}

function fmtAge(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function AnchorCalibrationCard({ title }: { title: string }) {
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [draft, setDraft] = useState<ConfigRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, histRes] = await Promise.all([
        personaFetch("/api/ops/sync/calibration", { cache: "no-store" }),
        personaFetch("/api/ops/sync/anchor-history?limit=20", { cache: "no-store" }),
      ]);
      if (!cfgRes.ok) throw new Error(`config HTTP ${cfgRes.status}`);
      const cfg = (await cfgRes.json()) as ConfigRow;
      setConfig(cfg);
      setDraft(cfg);
      if (histRes.ok) {
        const j = await histRes.json();
        setHistory(Array.isArray(j.entries) ? j.entries : []);
      }
    } catch (e) {
      setError((e as Error).message || "Failed to load anchor calibration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const dirty =
    draft &&
    config &&
    (draft.batch_size_k !== config.batch_size_k ||
      draft.max_age_minutes_t !== config.max_age_minutes_t ||
      draft.cron_cadence_seconds !== config.cron_cadence_seconds ||
      draft.is_paused !== config.is_paused);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/ops/sync/calibration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_size_k: draft.batch_size_k,
          max_age_minutes_t: draft.max_age_minutes_t,
          cron_cadence_seconds: draft.cron_cadence_seconds,
          is_paused: draft.is_paused,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as ConfigRow;
      setConfig(updated);
      setDraft(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function togglePause() {
    if (!config) return;
    setDraft({ ...config, is_paused: !config.is_paused });
    // Auto-save pause toggle for immediate effect
    setSaving(true);
    try {
      const res = await personaFetch("/api/ops/sync/calibration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: !config.is_paused }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ConfigRow;
        setConfig(updated);
        setDraft(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={title}
      actions={
        <>
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          <button
            onClick={togglePause}
            disabled={saving || !config}
            title={config?.is_paused ? "Resume anchor cycles" : "Pause anchor cycles"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border ${
              config?.is_paused
                ? "bg-amber-500/15 text-amber-200 border-amber-500/40 hover:bg-amber-500/25"
                : "bg-slate-700/50 text-slate-200 border-slate-600 hover:bg-slate-700"
            }`}
          >
            {config?.is_paused ? (
              <>
                <Play size={12} /> Resume
              </>
            ) : (
              <>
                <Pause size={12} /> Pause
              </>
            )}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </>
      }
    >
      <div className="text-xs text-slate-400">
        Live tuning of the K (batch size) / T (max-age) anchor policy + cron cadence. Edits land on the next cron tick — no redeploy needed.
        See the network-costs doc for the cost vs audit-SLA trade-off.
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-xs">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {draft && config && (
        <>
          {config.is_paused && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              <span className="font-semibold">Anchor cycles paused.</span> The cron will return no-op until resumed.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                K — Batch size (receipts)
                <span className="ml-1 text-slate-500">[1–10000]</span>
              </div>
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                value={draft.batch_size_k}
                onChange={(e) => setDraft({ ...draft, batch_size_k: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
              />
              <div className="text-[10px] text-slate-500 mt-1">Higher K = cheaper per receipt</div>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                T — Max age (minutes)
                <span className="ml-1 text-slate-500">[1–1440]</span>
              </div>
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                value={draft.max_age_minutes_t}
                onChange={(e) => setDraft({ ...draft, max_age_minutes_t: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
              />
              <div className="text-[10px] text-slate-500 mt-1">Lower T = tighter audit SLA</div>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                Cron cadence (seconds)
                <span className="ml-1 text-slate-500">[10–3600]</span>
              </div>
              <input
                type="number"
                min={10}
                max={3600}
                step={10}
                value={draft.cron_cadence_seconds}
                onChange={(e) => setDraft({ ...draft, cron_cadence_seconds: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
              />
              <div className="text-[10px] text-slate-500 mt-1">Informational — set in trigger config</div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              Updated {config.updated_at ? fmtAge(config.updated_at) : "never"}
            </div>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                dirty
                  ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/40 hover:bg-indigo-500/30"
                  : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
              }`}
            >
              <Save size={12} /> {saving ? "Saving…" : dirty ? "Save changes" : "No changes"}
            </button>
          </div>
        </>
      )}

      {/* Cost summary at current K/T */}
      {draft && (
        <div className="rounded-md border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-200 mb-1.5">Current policy at a glance</div>
          <ul className="space-y-0.5">
            <li>
              Anchor when <span className="text-violet-300">≥ {draft.batch_size_k} receipts</span> pending
              <span className="text-slate-500"> (size trigger)</span>
            </li>
            <li>
              OR when oldest pending receipt is <span className="text-violet-300">≥ {draft.max_age_minutes_t} min old</span>
              <span className="text-slate-500"> (time trigger)</span>
            </li>
            <li>
              Audit SLA: <span className="text-emerald-300">≤ {draft.max_age_minutes_t} min</span> from receipt to BTC anchor
            </li>
            <li>
              Cron expected to fire every <span className="text-violet-300">{draft.cron_cadence_seconds}s</span>
              <span className="text-slate-500"> (caps anchor frequency)</span>
            </li>
          </ul>
        </div>
      )}

      {/* Recent ticks */}
      <div>
        <div className="text-xs font-medium text-slate-300 mb-2">Recent anchor cycles</div>
        {history.length === 0 ? (
          <div className="text-xs text-slate-500 italic">
            No ticks recorded yet. Either the cron hasn't fired or the migration hasn't been applied.
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div
                key={h.id}
                className="grid grid-cols-12 gap-2 items-center text-xs bg-slate-800/40 rounded px-2 py-1.5 border border-slate-700/40"
              >
                <span className={`col-span-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] border ${actionBadge(h.cycle_action)}`}>
                  {h.cycle_action}
                </span>
                <span className="col-span-2 text-slate-400 text-[11px]">{h.decision_reason}</span>
                <span className="col-span-2 text-slate-300 tabular-nums">
                  {h.receipt_count} rx
                </span>
                <span className="col-span-3 text-slate-400 tabular-nums text-[11px]">
                  drift {h.drift_before ?? "?"} → {h.drift_after ?? "?"}
                </span>
                <span className="col-span-3 text-right text-slate-500 text-[11px]">
                  {fmtAge(h.created_at)}
                  {typeof h.duration_ms === "number" && (
                    <span className="ml-1 text-slate-600">({h.duration_ms}ms)</span>
                  )}
                </span>
                {h.error && (
                  <span className="col-span-12 text-rose-300 text-[11px] truncate" title={h.error}>
                    ✗ {h.error}
                  </span>
                )}
                {h.anchor_txid && (
                  <span className="col-span-12 text-slate-500 text-[10px] font-mono truncate" title={h.anchor_txid}>
                    anchor: {h.anchor_txid}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
