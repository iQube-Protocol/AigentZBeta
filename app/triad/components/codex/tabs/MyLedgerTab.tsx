"use client";

/**
 * MyLedgerTab — the persona's personal DVN-receipted activity ledger.
 *
 * Source of truth: activity_receipts table, scoped to the active
 * persona via the spine. Surfaces only events that emitted a receipt
 * — anything in-flight (draft entries on myCanvas, queued intents on
 * myWorkspace) is excluded until it hits DVN.
 *
 * Filter chips at the top let the operator scope the audit view:
 *
 *   All         — no filter
 *   myCanvas    — receipts originating from canvas publishes / remixes
 *                 (action_type heuristic: artifact_sent or
 *                 artifact_created where activeCartridge isn't a
 *                 specialist-owned cartridge)
 *   myWorkspace — receipts originating from workspace flows (intent
 *                 lifecycle, ingestion, executed CTAs)
 *   aigentMe    — receipts where agents_invoked includes 'aigent-me'
 *   Specialists — receipts where agents_invoked includes any specialist
 *                 id (marketa, quill, kn0w1, aigent-c, aigent-z,
 *                 aigent-nakamoto, moneypenny, metaye)
 *
 * Mental model demarcation:
 *   - myCanvas    — social / creative content (remixes + public ideas)
 *   - myWorkspace — private work artifacts (intents, drafts, uploads)
 *   - myLedger    — THIS — DVN-receipted activities cross-surface
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, Loader2, RefreshCw } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

interface ActivityReceipt {
  id: string;
  sessionId: string | null;
  intentId: string | null;
  activeCartridge: string;
  actionType: string;
  summary: string;
  agentsInvoked: string[];
  toolsUsed: string[];
  iqubesUsed: string[];
  contextShared: string[];
  artifactsCreated: string[];
  approvalsGranted: string[];
  receiptStatus?: string;
  dvnReceiptId?: string;
  createdAt: string;
}

type FilterChip = 'all' | 'mycanvas' | 'myworkspace' | 'aigentme' | 'specialists';

const SPECIALIST_AGENT_IDS = new Set([
  'marketa', 'quill', 'kn0w1', 'aigent-c', 'aigent-z',
  'aigent-nakamoto', 'moneypenny', 'metaye',
]);

const CHIP_LABELS: Record<FilterChip, string> = {
  all: 'All',
  mycanvas: 'myCanvas',
  myworkspace: 'myWorkspace',
  aigentme: 'aigentMe',
  specialists: 'Specialists',
};

const CANVAS_ACTION_HINTS = new Set([
  'experience_published',
  'community_content_published',
  'community_content_remixed',
  'artifact_sent',
]);

export function MyLedgerTab({ personaId }: Props) {
  const [receipts, setReceipts] = useState<ActivityReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<FilterChip>('all');

  const load = useCallback(async () => {
    if (!personaId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/assistant/receipts?limit=100', { personaIdHint: personaId });
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      const json = await res.json() as { receipts?: ActivityReceipt[] };
      setReceipts(json.receipts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (activeChip === 'all') return receipts;
    return receipts.filter((r) => {
      const agents = r.agentsInvoked ?? [];
      if (activeChip === 'aigentme') return agents.includes('aigent-me');
      if (activeChip === 'specialists') return agents.some((a) => SPECIALIST_AGENT_IDS.has(a));
      if (activeChip === 'mycanvas') {
        // Canvas publishes — heuristic: artifact_sent on metame, or any
        // community-content action.
        return CANVAS_ACTION_HINTS.has(r.actionType);
      }
      if (activeChip === 'myworkspace') {
        // Workspace flows — anything with an intentId (queued/executed
        // CTAs) or action types that are workspace-side.
        return Boolean(r.intentId) || ['intent_queued', 'artifact_created', 'approval_granted', 'approval_rejected', 'experience_model_updated'].includes(r.actionType);
      }
      return true;
    });
  }, [receipts, activeChip]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header + filter chips */}
      <div className="border-b border-slate-700/40 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold">myLedger</h2>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">DVN-receipted activity audit</span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !personaId}
            title="Reload receipts"
            className="ml-auto p-1 rounded hover:bg-slate-800/40 text-slate-400 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CHIP_LABELS) as FilterChip[]).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveChip(chip)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                activeChip === chip
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {CHIP_LABELS[chip]}
            </button>
          ))}
        </div>
      </div>

      {/* Receipt list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!personaId ? (
          <div className="text-xs text-slate-500 italic">Active persona not resolved yet.</div>
        ) : error ? (
          <div className="text-xs text-rose-300">Load failed: {error}</div>
        ) : loading ? (
          <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading receipts…</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-slate-500 italic">
            {activeChip === 'all'
              ? 'No DVN receipts yet for this persona. Send an email, publish a canvas entry, or execute an intent to generate one.'
              : `No receipts matching "${CHIP_LABELS[activeChip]}" filter.`}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((r) => (
              <li key={r.id} className="rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300">
                    {r.actionType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400">{r.activeCartridge}</span>
                  {r.dvnReceiptId && (
                    <span className="text-[10px] font-mono text-emerald-400">{r.dvnReceiptId.slice(0, 16)}…</span>
                  )}
                  <span className="text-[10px] text-slate-500 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-white mt-1">{r.summary}</div>
                {(r.agentsInvoked.length > 0 || r.toolsUsed.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1.5 text-[10px] text-slate-400">
                    {r.agentsInvoked.map((a) => (
                      <span key={`a-${a}`} className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/40">{a}</span>
                    ))}
                    {r.toolsUsed.map((t) => (
                      <span key={`t-${t}`} className="px-1.5 py-0.5 rounded border border-slate-700/60 bg-slate-800/20 text-slate-500">{t}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MyLedgerTab;
