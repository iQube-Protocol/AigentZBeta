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
import { BookMarked, Loader2, RefreshCw, Anchor, CheckCircle } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { ActivityReceiptCard, type ActivityReceiptData } from "@/components/metame/cards/ActivityReceiptCard";
import { GenesisCapsule, type IntentStage } from "@/components/metame/workbench/GenesisCapsule";
import { IntentChainPanel, useIntentChainCache } from "@/components/metame/workbench/IntentChainPanel";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
  isAdmin?: boolean;
}

interface ActivityReceipt {
  id: string;
  sessionId: string | null;
  intentId: string | null;
  /**
   * Direct parent intentId when the receipt's intent is a child.
   * Set by the receipts API enrichment.
   */
  parentIntentId?: string | null;
  /**
   * Root ancestor intentId — the origin intent at the top of the chain.
   * Set by the receipts API enrichment. Used for grouping so grandchild
   * receipts fold into the root capsule (Content Capsule Containment,
   * CLAUDE.md).
   */
  rootIntentId?: string | null;
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

type FilterChip = 'all' | 'mycanvas' | 'myworkspace' | 'aigentme' | 'specialists' | 'myexperiments';

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
  myexperiments: 'myExperiments',
};

// Experiment publications are DVN-receipted activity too — a distinct class.
// They carry no intentId, so they render as standalone ActivityReceiptCards
// (with the DVN status + Retry DVN affordance), never folded into an
// intent-chain capsule.
const EXPERIMENT_ACTION_TYPES = new Set(['experiment_result_published']);

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

function stageChip(stage: IntentStage): { cls: string; label: string } {
  switch (stage) {
    case 'complete':              return { cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', label: 'complete' };
    case 'cancelled':             return { cls: 'border-slate-500/40 bg-slate-500/10 text-slate-300',       label: 'cancelled' };
    case 'approved':              return { cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', label: 'approved' };
    case 'acted':                 return { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-200',       label: 'acted' };
    case 'queued':                return { cls: 'border-violet-500/40 bg-violet-500/10 text-violet-200',    label: 'queued' };
    case 'specialist_consulted':  return { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-200',       label: 'awaiting review' };
    default:                      return { cls: 'border-violet-500/40 bg-violet-500/10 text-violet-200',    label: 'in progress' };
  }
}

function deriveStageFromReceipts(receipts: ActivityReceipt[]): IntentStage {
  const types = new Set(receipts.map((r) => r.actionType));
  if (types.has('approval_rejected')) return 'cancelled';
  if (types.has('session_completed') || types.has('artifact_sent')) return 'complete';
  if (types.has('artifact_created')) return 'acted';
  if (types.has('approval_granted')) return 'approved';
  const hasChildQueued = receipts.some(
    (r) => r.actionType === 'intent_queued' && (r.contextShared ?? []).includes('recommendation-spawn'),
  );
  if (hasChildQueued) return 'queued';
  if (types.has('specialist_consulted')) return 'specialist_consulted';
  return 'cta_issued';
}

export function MyLedgerTab({ personaId, isAdmin }: Props) {
  const [receipts, setReceipts] = useState<ActivityReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<FilterChip>('all');
  const [dvnOp, setDvnOp] = useState<{ running: boolean; result: string | null }>({ running: false, result: null });

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

  const handleAnchorLocal = useCallback(async () => {
    setDvnOp({ running: true, result: null });
    try {
      const res = await personaFetch('/api/admin/dvn-retry-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200, includeLocal: true }),
      });
      const json = await res.json() as { ok?: boolean; succeeded?: number; failed?: number; total?: number; message?: string };
      setDvnOp({ running: false, result: `Anchored ${json.succeeded ?? 0}/${json.total ?? 0} receipts` });
      if (json.succeeded) void load();
    } catch (err) {
      setDvnOp({ running: false, result: `Error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, [load]);

  const handleFinalizePending = useCallback(async () => {
    setDvnOp({ running: true, result: null });
    try {
      const res = await personaFetch('/api/admin/activity-receipts/finalize', { method: 'POST' });
      const json = await res.json() as { ok?: boolean; receiptsFinalized?: number; readyMessageCount?: number; error?: string };
      setDvnOp({ running: false, result: json.ok ? `Finalized ${json.receiptsFinalized ?? 0} of ${json.readyMessageCount ?? 0} ready` : `Error: ${json.error ?? 'unknown'}` });
      if (json.receiptsFinalized) void load();
    } catch (err) {
      setDvnOp({ running: false, result: `Error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, [load]);

  const filtered = useMemo(() => {
    if (activeChip === 'all') return receipts;
    return receipts.filter((r) => {
      const agents = r.agentsInvoked ?? [];
      if (activeChip === 'aigentme') return agents.includes('aigent-me');
      if (activeChip === 'specialists') return agents.some((a) => SPECIALIST_AGENT_IDS.has(a));
      if (activeChip === 'mycanvas') return CANVAS_ACTION_HINTS.has(r.actionType);
      if (activeChip === 'myexperiments') return EXPERIMENT_ACTION_TYPES.has(r.actionType);
      if (activeChip === 'myworkspace') {
        return Boolean(r.intentId) || ['intent_queued', 'artifact_created', 'approval_granted', 'approval_rejected', 'experience_model_updated'].includes(r.actionType);
      }
      return true;
    });
  }, [receipts, activeChip]);

  // Group receipts by EFFECTIVE intentId — `parentIntentId` when the
  // Group receipts by their ROOT ancestor intentId so all three
  // generations (origin → child → grandchild) fold into one capsule.
  // rootIntentId (set by the receipts API 2-level walk) takes priority;
  // falls back to parentIntentId (child) then intentId (root receipt).
  // Content Capsule Containment golden rule — CLAUDE.md.
  const { intentGroups, standalone } = useMemo(() => {
    const byIntent = new Map<string, ActivityReceipt[]>();
    const solo: ActivityReceipt[] = [];
    for (const r of filtered) {
      const groupKey = r.rootIntentId || r.parentIntentId || r.intentId;
      if (groupKey) {
        const arr = byIntent.get(groupKey) ?? [];
        arr.push(r);
        byIntent.set(groupKey, arr);
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
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleAnchorLocal}
              disabled={dvnOp.running}
              title="Submit local anchorable receipts to DVN"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-violet-500/40 text-violet-200 hover:bg-violet-500/15 disabled:opacity-50 transition-colors"
            >
              {dvnOp.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Anchor className="w-3 h-3" />}
              Anchor local to DVN
            </button>
            <button
              type="button"
              onClick={handleFinalizePending}
              disabled={dvnOp.running}
              title="Finalize dvn_pending receipts to dvn_recorded"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50 transition-colors"
            >
              {dvnOp.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Finalize pending
            </button>
            {dvnOp.result && (
              <span className="text-[10px] text-slate-400">{dvnOp.result}</span>
            )}
          </div>
        )}
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
            {intentGroups.map((group) => {
              const stage = deriveStageFromReceipts(group.receipts);
              const chip = stageChip(stage);
              return (
                <GenesisCapsule
                  key={group.intentId}
                  label={deriveGenesisLabel(group.receipts)}
                  cartridge={group.cartridge}
                  createdAt={new Date(group.latestAt).toISOString()}
                  currentStage={stage}
                  isDark={true}
                  defaultCollapsed={true}
                  persistKey={`ledger:${group.intentId}`}
                  generationLabel="Origin"
                  onExpandChange={(expanded) => {
                    if (expanded) requestChain(group.intentId);
                  }}
                >
                  {/* Status chip — mirrors myWorkspace pattern */}
                  <div className="flex items-center gap-2 px-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${chip.cls}`}>
                      {chip.label}
                    </span>
                  </div>
                  {/* Chain of intent timeline — inner border matches workspace */}
                  <div className="rounded-md border overflow-hidden border-slate-700/50">
                    <IntentChainPanel
                      chainState={chainCache[group.intentId]}
                      isDark={true}
                      intentId={group.intentId}
                      onAdvanced={() => {
                        invalidateChain(group.intentId);
                        void load();
                      }}
                    />
                  </div>
                </GenesisCapsule>
              );
            })}

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
