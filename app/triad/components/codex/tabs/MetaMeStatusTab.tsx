"use client";

/**
 * MetaMeStatusTab — current operational status.
 *
 * What is happening right now? Renders:
 *   - Alignment banner (from PersonalGuide)
 *   - Active repair risks list
 *   - Recent activity receipts (last 15)
 *   - Cartridge activity breakdown over the receipt window
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Activity, AlertTriangle, ListChecks } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import {
  ALIGNMENT_LABEL,
  SPHERE_LABEL,
  type AlignmentState,
  type PersonalGuideData,
} from "@/types/experienceGuide";

interface ReceiptShape {
  id: string;
  activeCartridge: string;
  actionType: string;
  summary: string;
  createdAt: string;
}

const ALIGNMENT_BG: Record<AlignmentState, string> = {
  aligned:  "border-emerald-500/40 bg-emerald-500/10",
  drifting: "border-amber-500/40 bg-amber-500/10",
  at_risk:  "border-orange-500/40 bg-orange-500/10",
  repair:   "border-rose-500/40 bg-rose-500/10",
};

const ACTION_LABEL: Record<string, string> = {
  intent_queued: "Intent queued",
  specialist_consulted: "Specialist consulted",
  artifact_created: "Artifact created",
  artifact_sent: "Artifact sent",
  approval_granted: "Approval granted",
  approval_rejected: "Approval rejected",
  experience_model_updated: "Experience updated",
  session_started: "Session started",
  session_completed: "Session completed",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function MetaMeStatusTab({ personaId }: { personaId?: string }) {
  const [guide, setGuide] = useState<PersonalGuideData | null>(null);
  const [receipts, setReceipts] = useState<ReceiptShape[]>([]);
  const [loading, setLoading] = useState(!!personaId);

  useEffect(() => {
    if (!personaId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      personaFetch("/api/assistant/experience-guide", { personaIdHint: personaId })
        .then((r) => r.json() as Promise<{ guide: PersonalGuideData | null }>),
      personaFetch("/api/assistant/receipts?limit=15", { personaIdHint: personaId })
        .then((r) => r.json() as Promise<{ receipts: ReceiptShape[] }>),
    ])
      .then(([g, rs]) => {
        if (cancelled) return;
        setGuide(g.guide ?? null);
        setReceipts(rs.receipts ?? []);
      })
      .catch(() => { /* empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  const cartridgeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of receipts) {
      counts[r.activeCartridge] = (counts[r.activeCartridge] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [receipts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading status…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full text-slate-100 space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Status</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Operational state right now — alignment, risks, and recent activity.
        </p>
      </header>

      {/* Alignment */}
      {guide ? (
        <div className={`px-4 py-3 rounded-lg border ${ALIGNMENT_BG[guide.alignmentState]}`}>
          <p className="text-xs text-slate-300/80 mb-0.5">Alignment</p>
          <p className="text-base font-semibold text-slate-100">{ALIGNMENT_LABEL[guide.alignmentState]}</p>
          {guide.focusIntent && (
            <p className="text-xs text-slate-300/80 mt-1">Focus: {guide.focusIntent}</p>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/40">
          <p className="text-sm text-slate-300">No ExperienceGuide configured — alignment is unknown.</p>
        </div>
      )}

      {/* Repair risks */}
      {guide && (guide.repairRisks ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Active repair risks</h3>
          </div>
          <ul className="space-y-1.5">
            {guide.repairRisks.map((risk, idx) => (
              <li key={`${risk.sphere}-${idx}`} className="px-3 py-2 rounded border border-slate-700 bg-slate-800/40 text-sm">
                <span className="text-xs text-slate-400 mr-2">{SPHERE_LABEL[risk.sphere]}</span>
                <span className="text-slate-100">{risk.signal}</span>
                {risk.suggestion && (
                  <p className="text-xs text-slate-400 mt-1">↳ {risk.suggestion}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cartridge breakdown */}
      {cartridgeBreakdown.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">Cartridge activity (last {receipts.length} receipts)</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cartridgeBreakdown.map(([cartridge, count]) => (
              <div key={cartridge} className="px-3 py-2 rounded border border-slate-700 bg-slate-800/40">
                <p className="text-xs text-slate-400">{cartridge}</p>
                <p className="text-lg font-semibold text-slate-100">{count}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent receipts */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold">Recent activity</h3>
        </div>
        {receipts.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {receipts.map((r) => (
              <li key={r.id} className="px-3 py-2 rounded border border-slate-700 bg-slate-800/40">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-400">{ACTION_LABEL[r.actionType] ?? r.actionType}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-100 mt-0.5">{r.summary}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.activeCartridge}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default MetaMeStatusTab;
