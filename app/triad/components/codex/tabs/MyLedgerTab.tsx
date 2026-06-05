"use client";

/**
 * MyLedgerTab — the persona's personal DVN-receipted activity ledger.
 *
 * Receipts are grouped by intentId so that all activity tied to a
 * single CTA lands in one GenesisCapsule, showing the IntentChainPanel
 * (which contains the specialist response + Queue buttons) rather than
 * a flat list of disconnected cards. Receipts with no intentId remain
 * as standalone ActivityReceiptCards.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, Loader2, RefreshCw } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { ActivityReceiptCard, type ActivityReceiptData } from "@/components/metame/cards/ActivityReceiptCard";
import { GenesisCapsule, type IntentStage } from "@/components/metame/workbench/GenesisCapsule";
import { IntentChainPanel, useIntentChainCache } from "@/components/metame/workbench/IntentChainPanel";

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

function deriveGenesisLabel(receipts: ActivityReceipt[]): string {
  // Prefer the specialist_consulted receipt — its summary is the most
  // descriptive ("Consulted Marketa: <topic>").
  const consulted = receipts.find((r) => r.actionType === 'specialist_consulted');
  if (consulted) return consulted.summary;
  // Fall back to intent_queued, stripping the "Queued: " prefix.
  const queued = receipts.find((r) => r.actionType === 'intent_queued');
  if (queued) return queued.summary.replace(/^Queued:\s*/i, '');
  return receipts[0]?.summary ?? 'Intent';
}

function deriveStageFromReceipts(receipts: ActivityReceipt[]): IntentStage {
  const types = new Set(receipts.map((r) => r.actionType));
  if (types.has('artifact_sent')) return 'complete';
  if (types.has('artifact_created')) return 'acted';
  if (types.has('approval_granted')) return 'approved';
  // Child intents queued from recommendations have recommendation-spawn in contextShared.
  const hasChildQueued = receipts.some(
    (r) => r.actionType === 'intent_queued' && (r.contextShared ?? []).includes('recommendation-spawn'),
  );
  if (hasChildQueued) return 'queued';
  if (types.has('specialist_consulted')) return 'specialist_consulted';
  return 'cta_issued';
}

export function MyLedgerTab({ personaId }: Props) {
  const [receipts, setReceipts] = useState<ActivityReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<FilterChip>('all');

  const { cache: chainCache, requestChain, invalidate: invalidateChain } = useIntentChainCache(personaId);

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
      if (activeChip === 'mycanvas') return CANVAS_ACTION_HINTS.has(r.actionType);
      if (activeChip === 'myworkspace') {
        return Boolean(r.intentId) || ['intent_queued', 'artifact_created', 'approval_granted', 'approval_rejected', 'experience_model_updated'].includes(r.actionType);
      }
      return true;
    });
  }, [receipts, activeChip]);

  // Group receipts by intentId. Receipts without intentId stay standalone.
  const { intentGroups, standalone } = useMemo(() => {
    const byIntent = new Map<string, ActivityReceipt[]>();
    const solo: ActivityReceipt[] = [];
    for (const r of filtered) {
      if (r.intentId) {
        const arr = byIntent.get(r.intentId) ?? [];
        arr.push(r);
        byIntent.set(r.intentId, arr);
      } else {
        solo.push(r);
      }
    }
    // Sort groups by most-recent receipt timestamp descending.
    const groups = Array.from(byIntent.entries())
      .map(([intentId, recs]) => ({
        intentId,
        receipts: recs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        latestAt: Math.max(...recs.map((r) => Date.parse(r.createdAt))),
        cartridge: recs[0]?.activeCartridge,
      }))
      .sort((a, b) => b.latestAt - a.latestAt);
    return { intentGroups: groups, standalone: solo };
  }, [filtered]);

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
          <div className="space-y-3">
            {/* Intent-grouped capsules — one per unique intentId */}
            {intentGroups.map((group) => (
              <GenesisCapsule
                key={group.intentId}
                label={deriveGenesisLabel(group.receipts)}
                cartridge={group.cartridge}
                createdAt={new Date(group.latestAt).toISOString()}
                currentStage={deriveStageFromReceipts(group.receipts)}
                isDark={true}
                defaultCollapsed={true}
                onExpandChange={(expanded) => {
                  if (expanded) requestChain(group.intentId);
                }}
              >
                <IntentChainPanel
                  chainState={chainCache[group.intentId]}
                  isDark={true}
                  intentId={group.intentId}
                  onAdvanced={() => {
                    invalidateChain(group.intentId);
                    void load();
                  }}
                />
              </GenesisCapsule>
            ))}

            {/* Standalone receipts — no intentId (e.g. canvas publishes) */}
            {standalone.map((r) => {
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
              return <ActivityReceiptCard key={r.id} data={cardData} theme="dark" />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyLedgerTab;
