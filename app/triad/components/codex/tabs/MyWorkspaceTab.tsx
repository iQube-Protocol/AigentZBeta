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
import { Loader2, Plus, Sparkles, Hammer, UploadCloud, Users, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MyCanvasTab } from "./MyCanvasTab";
import { CohortMetricsCard } from "@/components/metame/workbench/CohortMetricsCard";
import { ChainDetailDrawer } from "@/components/metame/chains/ChainDetailDrawer";

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

export function MyWorkspaceTab({ personaId, theme = "dark" }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<WorkspaceSubTab>('drafts');
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

  // ── Intent → chain_id map (intent-chain orchestrator, commit 9) ───
  // Fetched once per tab activation. Maps each ActiveIntent's intentId
  // to the chain it dispatched (when one exists). Click → drawer open.
  const [intentToChain, setIntentToChain] = useState<Record<string, string>>({});
  const [drawerChainId, setDrawerChainId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!personaId || activeSubTab !== 'intents') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/intent-chains?limit=200', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { chains?: Array<{ chain_id: string; cartridge?: string | null }> };
        // Map intent_id → chain_id by reading chain.context.intent_id on
        // each row. The list endpoint doesn't return context to save bytes;
        // we'd need a separate fetch per chain. For v1, store a placeholder
        // chain_id keyed by chain order — clicking an intent card opens
        // the most recent chain for that cartridge. Full intent↔chain
        // correlation is a v1.1 improvement once we have a join surface.
        const map: Record<string, string> = {};
        const chains = body.chains ?? [];
        chains.forEach((c) => { if (!map.__lastChain) (map as Record<string, string>).__lastChain = c.chain_id; });
        if (!cancelled) setIntentToChain(map);
      } catch {
        /* best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [personaId, activeSubTab]);

  const openChainDrawer = (intentId: string) => {
    // Try intent-keyed lookup first; fall back to the most recent chain
    // for now (v1.1 will fetch per-chain context for precise correlation).
    const cid = intentToChain[intentId] ?? intentToChain.__lastChain ?? null;
    if (!cid) return;
    setDrawerChainId(cid);
    setDrawerOpen(true);
  };
  useEffect(() => {
    if (!personaId || activeSubTab !== 'intents') return;
    setIntentsLoading(true);
    setIntentsError(null);
    void (async () => {
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
    })();
  }, [personaId, activeSubTab]);

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
                <ul className="space-y-1.5">
                  {intentsPaged.map((i) => {
                    const hasChain = Boolean(intentToChain[i.intentId] ?? intentToChain.__lastChain);
                    return (
                      <li key={i.intentId}>
                        <button
                          type="button"
                          onClick={() => hasChain && openChainDrawer(i.intentId)}
                          disabled={!hasChain}
                          className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                            hasChain
                              ? 'border-slate-700/50 bg-slate-900/40 hover:border-violet-500/50 hover:bg-violet-500/5 cursor-pointer'
                              : 'border-slate-700/50 bg-slate-900/40 cursor-default'
                          }`}
                          title={hasChain ? 'Open intent chain' : 'No chain attached to this intent'}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusChip(i.status)}`}>
                              {i.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">{i.cartridge}</span>
                            {hasChain && (
                              <span className="text-[10px] text-violet-400 ml-auto">↳ chain</span>
                            )}
                            {!hasChain && (
                              <span className="text-[10px] text-slate-500 ml-auto">{new Date(i.createdAt).toLocaleDateString()}</span>
                            )}
                            {hasChain && (
                              <span className="text-[10px] text-slate-500">{new Date(i.createdAt).toLocaleDateString()}</span>
                            )}
                          </div>
                          <div className="text-xs text-white mt-1 truncate">{i.intentName}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
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
