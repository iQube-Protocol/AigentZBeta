"use client";

/**
 * MyWorkspaceTab — private work-artifact surface for the persona.
 *
 * Standard cartridge sub-menu pattern: horizontal tab bar at the top
 * with five entries (one action + four content panels), each panel
 * paginated for long lists. Matches the visual treatment used across
 * other cartridges' internal navs so the operator doesn't have to
 * learn a new layout.
 *
 *   + New          — quick-action button. Switches to Working drafts
 *                    and creates a new entry via MyCanvasTab's own
 *                    "+ New" plumbing.
 *   Active Intents — queued / awaiting_approval / completed CTAs from
 *                    /api/assistant/workbench-ledger. Paginated 20/page.
 *   Working Drafts — embeds MyCanvasTab(surface='workspace') which now
 *                    talks to /api/myworkspace/entries exclusively.
 *   Uploads        — persona_uploads filtered to use_kind in
 *                    (venture_iqube / iqube_payload / workbench).
 *                    Paginated 20/page.
 *   Cohorts        — restored cohort intel (CohortMetricsCard) —
 *                    operator-requested per "the cohort intel we had
 *                    in place before… can be surfaced in that tab".
 *
 * Mental model demarcation (unchanged):
 *   myCanvas    — social / creative content (remixes + public ideas)
 *   myWorkspace — THIS — private work artifacts
 *   myLedger    — DVN-receipted activities cross-surface
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Sparkles, Hammer, UploadCloud, Users, FileText, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MyCanvasTab } from "./MyCanvasTab";
import { CohortMetricsCard } from "@/components/metame/workbench/CohortMetricsCard";
import { ChainDetailDrawer } from "@/components/metame/chains/ChainDetailDrawer";
import { IntentChainPanel, useIntentChainCache } from "@/components/metame/workbench/IntentChainPanel";
import { GenesisCapsule, type IntentStage } from "@/components/metame/workbench/GenesisCapsule";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

interface ActiveIntent {
  intentId: string;
  intentName: string;
  status: 'in_progress' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  cartridge: string;
  createdAt: string;
}

interface StrategicUpload {
  id: string;
  filename: string;
  useKind: string;
  status: string;
  sizeBytes: number;
  createdAt: string;
}

type WorkspaceSubTab = 'intents' | 'drafts' | 'uploads' | 'cohorts';

const PAGE_SIZE = 20;

function intentStatusToStage(status: ActiveIntent['status']): IntentStage {
  switch (status) {
    case 'awaiting_approval': return 'specialist_consulted';
    case 'completed': return 'complete';
    case 'failed':
    case 'cancelled': return 'cancelled';
    default: return 'cta_issued';
  }
}

/**
 * Stage derivation that prefers RECEIPT signals over intent.status.
 * intent-advance(approve) writes an approval_granted receipt but does
 * NOT mutate intent.status, so the strip must read receipts to surface
 * APPROVED / ACTED states. Mirrors deriveStageFromReceipts in MyLedgerTab.
 */
function deriveStageFromIntentAndChain(
  status: ActiveIntent['status'],
  chainData: { receipts?: Array<{ actionType: string; contextShared?: string[] }> } | null | undefined,
): IntentStage {
  if (status === 'cancelled' || status === 'failed') return 'cancelled';
  if (status === 'completed') return 'complete';
  const receipts = chainData?.receipts ?? [];
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
  return intentStatusToStage(status);
}

export function MyWorkspaceTab({ personaId, theme = "dark" }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<WorkspaceSubTab>('intents');
  const [intentsPage, setIntentsPage] = useState(0);
  const [uploadsPage, setUploadsPage] = useState(0);
  // When the operator hits "+ New", switch to drafts and tag a
  // request-new flag — MyCanvasTab reads this through its own
  // empty-state CTA. For now we just route to drafts and let the
  // existing "+ New" button take it from there.
  const handleNew = useCallback(() => {
    setActiveSubTab('drafts');
  }, []);

  // ── Active intents ────────────────────────────────────────────────
  const [intents, setIntents] = useState<ActiveIntent[]>([]);
  const [intentsLoading, setIntentsLoading] = useState(false);
  const [intentsError, setIntentsError] = useState<string | null>(null);

  // ── Intent expand / chain-of-intent surface ─────────────────────────
  // Every intent expands inline to show its orchestration timeline
  // (specialist_invoked + chain events) via /api/assistant/intent-chain.
  // When the timeline payload reports an attached intent_chains row, the
  // "open full chain" affordance below the panel deep-links into the
  // existing ChainDetailDrawer.
  const { cache: chainCache, requestChain, invalidate: invalidateChain } = useIntentChainCache(personaId);
  const [drawerChainId, setDrawerChainId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openChainDrawer = (chainId: string) => {
    setDrawerChainId(chainId);
    setDrawerOpen(true);
  };
  const refetchIntents = useCallback(async () => {
    if (!personaId) return;
    setIntentsLoading(true);
    setIntentsError(null);
    try {
      const res = await personaFetch('/api/assistant/workbench-ledger?limit=200', { personaIdHint: personaId });
      if (!res.ok) { setIntentsError(`HTTP ${res.status}`); return; }
      const json = await res.json() as { entries?: Array<{ kind: string; intentId?: string; intentName?: string; status?: string; cartridge?: string; createdAt?: string }> };
      const pills = (json.entries ?? []).filter((e) => e.kind === 'pill').map((e) => ({
        intentId: e.intentId ?? '',
        intentName: e.intentName ?? '',
        status: (e.status as ActiveIntent['status']) ?? 'in_progress',
        cartridge: e.cartridge ?? '',
        createdAt: e.createdAt ?? '',
      }));
      setIntents(pills);
    } catch (err) {
      setIntentsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIntentsLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    if (!personaId || activeSubTab !== 'intents') return;
    void refetchIntents();
  }, [personaId, activeSubTab, refetchIntents]);

  // Called after an intent-advance click lands. Invalidate the chain
  // cache for that intent so the chain header re-derives, and refetch
  // the workspace pill list so the status chip flips (in_progress →
  // completed/cancelled) without requiring a full tab switch.
  const handleIntentAdvanced = useCallback(
    (intentId: string) => {
      invalidateChain(intentId);
      void refetchIntents();
    },
    [invalidateChain, refetchIntents],
  );

  // ── Strategic uploads ─────────────────────────────────────────────
  const [uploads, setUploads] = useState<StrategicUpload[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  useEffect(() => {
    if (!personaId || activeSubTab !== 'uploads') return;
    setUploadsLoading(true);
    setUploadsError(null);
    void (async () => {
      try {
        const res = await personaFetch('/api/uploads?limit=200', { personaIdHint: personaId });
        if (!res.ok) { setUploadsError(`HTTP ${res.status}`); return; }
        const json = await res.json() as { uploads?: StrategicUpload[] };
        const strategic = (json.uploads ?? []).filter((u) =>
          ['venture_iqube', 'iqube_payload', 'workbench'].includes(u.useKind),
        );
        setUploads(strategic);
      } catch (err) {
        setUploadsError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploadsLoading(false);
      }
    })();
  }, [personaId, activeSubTab]);

  // Pagination slices
  const intentsPaged = useMemo(
    () => intents.slice(intentsPage * PAGE_SIZE, (intentsPage + 1) * PAGE_SIZE),
    [intents, intentsPage],
  );
  const intentsPageCount = Math.max(1, Math.ceil(intents.length / PAGE_SIZE));
  const uploadsPaged = useMemo(
    () => uploads.slice(uploadsPage * PAGE_SIZE, (uploadsPage + 1) * PAGE_SIZE),
    [uploads, uploadsPage],
  );
  const uploadsPageCount = Math.max(1, Math.ceil(uploads.length / PAGE_SIZE));

  const statusChip = (status: ActiveIntent['status']) => {
    const map: Record<ActiveIntent['status'], string> = {
      'in_progress':       'border-violet-500/40 bg-violet-500/10 text-violet-200',
      'awaiting_approval': 'border-amber-500/40 bg-amber-500/10 text-amber-200',
      'completed':         'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
      'failed':            'border-rose-500/40 bg-rose-500/10 text-rose-200',
      'cancelled':         'border-slate-500/40 bg-slate-500/10 text-slate-300',
    };
    return map[status];
  };

  const tabBtn = (tabId: WorkspaceSubTab, label: string, Icon: typeof Sparkles, count?: number) => (
    <button
      type="button"
      onClick={() => setActiveSubTab(tabId)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all rounded-lg whitespace-nowrap ${
        activeSubTab === tabId
          ? 'bg-violet-500/10 ring-1 ring-violet-500/30 text-violet-300'
          : 'text-slate-400 hover:text-slate-300 hover:bg-white/4'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="ml-1 text-[10px] text-slate-500">{count}</span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Standard sub-menu nav bar — five entries, matches other cartridges' internal nav */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700/40 bg-slate-950/60">
        <button
          type="button"
          onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
        <div className="mx-1 h-4 w-px bg-slate-700/60" />
        {tabBtn('intents', 'Active Intents', Sparkles, intents.length)}
        {tabBtn('drafts', 'Working Drafts', Hammer)}
        {tabBtn('uploads', 'Uploads', UploadCloud, uploads.length)}
        {tabBtn('cohorts', 'Cohorts', Users)}
      </div>

      {/* Panel content — single active panel at a time */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === 'intents' && (
          <div className="px-4 py-3">
            {intentsLoading ? (
              <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
            ) : intentsError ? (
              <div className="text-xs text-rose-300">Load failed: {intentsError}</div>
            ) : intents.length === 0 ? (
              <div className="text-xs text-slate-500 italic">
                No active intents yet. Act on a Brief NBA in aigentMe to queue one.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {intentsPaged.map((i) => {
                    const chainState = chainCache[i.intentId];
                    const attachedChain = chainState?.data?.chain ?? null;
                    return (
                      <GenesisCapsule
                        key={i.intentId}
                        label={i.intentName}
                        cartridge={i.cartridge}
                        createdAt={i.createdAt}
                        currentStage={deriveStageFromIntentAndChain(i.status, chainState?.data)}
                        isDark={theme !== 'light'}
                        defaultCollapsed={true}
                        persistKey={`workspace:${i.intentId}`}
                        onExpandChange={(expanded) => {
                          if (expanded) requestChain(i.intentId);
                        }}
                      >
                        {/* Status chip row */}
                        <div className="flex items-center gap-2 px-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusChip(i.status)}`}>
                            {i.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {/* Chain of intent timeline */}
                        <div className={`rounded-md border overflow-hidden ${
                          theme !== 'light'
                            ? 'border-slate-700/50'
                            : 'border-slate-200'
                        }`}>
                          <IntentChainPanel
                            chainState={chainState}
                            isDark={theme !== 'light'}
                            intentId={i.intentId}
                            intentStatus={i.status}
                            onAdvanced={() => handleIntentAdvanced(i.intentId)}
                          />
                          {attachedChain && (
                            <div className={`border-t px-3 py-2 ${
                              theme !== 'light'
                                ? 'border-emerald-500/30 bg-emerald-950/20'
                                : 'border-emerald-200 bg-emerald-50'
                            }`}>
                              <button
                                type="button"
                                onClick={() => openChainDrawer(attachedChain.chainId)}
                                className="text-[11px] inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                              >
                                <ExternalLink className="w-3 h-3" /> Open full chain
                              </button>
                            </div>
                          )}
                        </div>
                      </GenesisCapsule>
                    );
                  })}
                </div>
                {intentsPageCount > 1 && (
                  <Pager page={intentsPage} pageCount={intentsPageCount} onChange={setIntentsPage} />
                )}
              </>
            )}
          </div>
        )}

        {activeSubTab === 'drafts' && (
          <div className="h-full">
            <MyCanvasTab personaId={personaId} theme={theme} surface="workspace" />
          </div>
        )}

        {activeSubTab === 'uploads' && (
          <div className="px-4 py-3">
            {uploadsLoading ? (
              <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
            ) : uploadsError ? (
              <div className="text-xs text-rose-300">Load failed: {uploadsError}</div>
            ) : uploads.length === 0 ? (
              <div className="text-xs text-slate-500 italic">
                No strategic uploads yet. Drop a Venture iQube JSON into the upload drawer to populate.
              </div>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {uploadsPaged.map((u) => (
                    <li
                      key={u.id}
                      className="rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2 hover:border-slate-600"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-violet-300" />
                        <span className="text-xs font-medium text-white truncate flex-1 min-w-0">{u.filename}</span>
                        <span className="text-[10px] uppercase tracking-wider text-violet-300">{u.useKind.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 pl-5">
                        {u.status} · {(u.sizeBytes / 1024).toFixed(1)} KB · {new Date(u.createdAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
                {uploadsPageCount > 1 && (
                  <Pager page={uploadsPage} pageCount={uploadsPageCount} onChange={setUploadsPage} />
                )}
              </>
            )}
          </div>
        )}

        {activeSubTab === 'cohorts' && (
          <div className="px-4 py-3">
            <CohortMetricsCard personaId={personaId} theme={theme} />
          </div>
        )}
      </div>

      {/* Intent Chain detail drawer (commit 9) — opens via clickable
          intent card; renders nothing when drawerChainId is null */}
      <ChainDetailDrawer
        open={drawerOpen}
        chain_id={drawerChainId}
        onClose={() => setDrawerOpen(false)}
        personaId={personaId}
        theme={theme}
      />
    </div>
  );
}

function Pager({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 mt-3 text-xs text-slate-400">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="p-1 rounded hover:bg-slate-800/40 disabled:opacity-30"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="tabular-nums">
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="p-1 rounded hover:bg-slate-800/40 disabled:opacity-30"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default MyWorkspaceTab;
