"use client";

/**
 * MetaMeAnalysisTab — pattern analysis over recent activity.
 *
 * Reads the last 100 receipts and surfaces three lightweight views:
 *   - Action-type breakdown (what you mostly do)
 *   - Cartridge breakdown (where you mostly act)
 *   - 14-day daily-count sparkline (rhythm of activity)
 *
 * Pure client-side aggregation — no new endpoint. Phase 6+ may move some
 * of this server-side once volumes grow.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, BarChart3, PieChart, TrendingUp } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";

interface ReceiptShape {
  id: string;
  activeCartridge: string;
  actionType: string;
  summary: string;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  intent_queued: "Intents queued",
  specialist_consulted: "Specialists consulted",
  artifact_created: "Artifacts created",
  artifact_sent: "Artifacts sent",
  approval_granted: "Approvals granted",
  approval_rejected: "Approvals rejected",
  experience_model_updated: "Experience updates",
  session_started: "Sessions started",
  session_completed: "Sessions completed",
};

function startOfDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return out;
}

export function MetaMeAnalysisTab({ personaId }: { personaId?: string }) {
  const [receipts, setReceipts] = useState<ReceiptShape[]>([]);
  const [loading, setLoading] = useState(!!personaId);

  useEffect(() => {
    if (!personaId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    personaFetch("/api/assistant/receipts?limit=100", { personaIdHint: personaId })
      .then((r) => r.json() as Promise<{ receipts: ReceiptShape[] }>)
      .then((d) => { if (!cancelled) setReceipts(d.receipts ?? []); })
      .catch(() => { /* empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  const { actionCounts, cartridgeCounts, dailyCounts, total, maxDaily } = useMemo(() => {
    const action: Record<string, number> = {};
    const cartridge: Record<string, number> = {};
    const daily: Record<string, number> = {};
    for (const r of receipts) {
      action[r.actionType] = (action[r.actionType] ?? 0) + 1;
      cartridge[r.activeCartridge] = (cartridge[r.activeCartridge] ?? 0) + 1;
      const day = startOfDay(r.createdAt);
      daily[day] = (daily[day] ?? 0) + 1;
    }
    const days = lastNDays(14);
    const dailySeries = days.map((day) => ({ day, count: daily[day] ?? 0 }));
    const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count));
    return {
      actionCounts: Object.entries(action).sort((a, b) => b[1] - a[1]),
      cartridgeCounts: Object.entries(cartridge).sort((a, b) => b[1] - a[1]),
      dailyCounts: dailySeries,
      total: receipts.length,
      maxDaily,
    };
  }, [receipts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Analysing patterns…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="p-6 rounded border border-slate-700 bg-slate-800/40 text-slate-300 text-sm m-4">
        No activity yet. Patterns will appear here once you start working through aigentMe.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full text-slate-100 space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Analysis</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Patterns across your most recent {total} receipts. What you do, where you do it, when you do it.
        </p>
      </header>

      {/* Action-type breakdown */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <PieChart className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold">What you do</h3>
        </div>
        <ul className="space-y-1.5">
          {actionCounts.map(([type, count]) => {
            const pct = (count / total) * 100;
            return (
              <li key={type} className="grid grid-cols-[160px_1fr_40px] items-center gap-3">
                <span className="text-xs text-slate-300">{ACTION_LABEL[type] ?? type}</span>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-violet-500/70" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-400 text-right">{count}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Cartridge breakdown */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold">Where you act</h3>
        </div>
        <ul className="space-y-1.5">
          {cartridgeCounts.map(([cartridge, count]) => {
            const pct = (count / total) * 100;
            return (
              <li key={cartridge} className="grid grid-cols-[160px_1fr_40px] items-center gap-3">
                <span className="text-xs text-slate-300">{cartridge}</span>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-violet-500/70" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-400 text-right">{count}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Daily rhythm */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold">Activity rhythm (last 14 days)</h3>
        </div>
        <div className="flex items-end gap-1.5 h-24">
          {dailyCounts.map(({ day, count }) => {
            const h = Math.round((count / maxDaily) * 100);
            return (
              <div key={day} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${day}: ${count}`}>
                <div
                  className={`w-full rounded-t ${count === 0 ? "bg-slate-800" : "bg-violet-500/70"}`}
                  style={{ height: `${Math.max(h, 3)}%` }}
                />
                <span className="text-[9px] text-slate-500">{day.slice(-2)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default MetaMeAnalysisTab;
