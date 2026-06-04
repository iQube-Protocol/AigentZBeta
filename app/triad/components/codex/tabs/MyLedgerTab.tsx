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
import { ActivityReceiptCard, type ActivityReceiptData } from "@/components/metame/cards/ActivityReceiptCard";

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
  specialistResponse?: {
    title: string;
    summary: string;
    recommendations: string[];
    suggestedArtifacts: string[];
    confidence: 'low' | 'medium' | 'high';
    source: 'llm' | 'template';
  } | null;
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
          <ul className="space-y-2">
            {filtered.map((r) => {
              // Adapt MyLedgerTab's lightweight ActivityReceipt shape to
              // the canonical ActivityReceiptData the card expects. The
              // receipt status enum defaults to 'local' when the receipts
              // endpoint hasn't set it.
              const cardData: ActivityReceiptData = {
                id: r.id,
                sessionId: r.sessionId,
                intentId: r.intentId,
                activeCartridge: r.activeCartridge,
                actionType: r.actionType,
                summary: r.summary,
                agentsInvoked: r.agentsInvoked,
                toolsUsed: r.toolsUsed,
                iqubesUsed: r.iqubesUsed,
                contextShared: r.contextShared,
                artifactsCreated: r.artifactsCreated,
                approvalsGranted: r.approvalsGranted,
                policyEnvelopeId: null,
                receiptStatus: (r.receiptStatus as ActivityReceiptData['receiptStatus']) ?? 'local',
                dvnReceiptId: r.dvnReceiptId ?? null,
                specialistResponse: r.specialistResponse ?? null,
                createdAt: r.createdAt,
              };
              return (
                <li key={r.id}>
                  <ActivityReceiptCard data={cardData} theme="dark" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MyLedgerTab;
