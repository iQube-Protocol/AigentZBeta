"use client";

/**
 * MyWorkspaceTab — private work-artifact surface for the persona.
 *
 * Three sub-sections, ordered per operator's mental model
 * (most-operationally-current first):
 *
 *   1. Active intents     — queued / awaiting_approval / completed CTAs
 *                            from intent_qubes + activity_receipts.
 *                            Sourced from /api/assistant/workbench-ledger
 *                            (the same endpoint that powered the legacy
 *                            WorkbenchLedger).
 *   2. Working drafts     — surface='workspace' entries from the
 *                            mycanvas entries table. Operator-authored
 *                            free-text drafts, briefs, reports, etc.
 *                            Leverages MyCanvasTab in workspace mode.
 *   3. Strategic uploads  — persona_uploads tagged use_kind in
 *                            (venture_iqube, iqube_payload, workbench).
 *                            Sourced from /api/uploads filtered by
 *                            use_kind.
 *
 * Each section is independently collapsible. The right pane shows the
 * selected item's detail for whichever section the operator drilled
 * into.
 *
 * Mental model demarcation:
 *   - myCanvas    — social / creative content (remixes + public ideas)
 *   - myWorkspace — THIS — private work artifacts (intents, drafts,
 *                   strategic uploads)
 *   - myLedger    — DVN-receipted activities cross-surface
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Sparkles, FileText, UploadCloud, Hammer, BookMarked } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MyCanvasTab } from "./MyCanvasTab";

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

type Section = 'intents' | 'drafts' | 'uploads';

export function MyWorkspaceTab({ personaId, theme = "dark" }: Props) {
  const [openSections, setOpenSections] = useState<Record<Section, boolean>>({
    intents: true,
    drafts: true,
    uploads: false,
  });
  const toggleSection = useCallback((s: Section) => {
    setOpenSections((prev) => ({ ...prev, [s]: !prev[s] }));
  }, []);

  // ── Active intents ────────────────────────────────────────────────
  const [intents, setIntents] = useState<ActiveIntent[]>([]);
  const [intentsLoading, setIntentsLoading] = useState(false);
  const [intentsError, setIntentsError] = useState<string | null>(null);
  useEffect(() => {
    if (!personaId) return;
    setIntentsLoading(true);
    setIntentsError(null);
    void (async () => {
      try {
        const res = await personaFetch('/api/assistant/workbench-ledger?limit=50', { personaIdHint: personaId });
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
  }, [personaId]);

  // ── Strategic uploads ─────────────────────────────────────────────
  const [uploads, setUploads] = useState<StrategicUpload[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  useEffect(() => {
    if (!personaId) return;
    setUploadsLoading(true);
    setUploadsError(null);
    void (async () => {
      try {
        const res = await personaFetch('/api/uploads?limit=50', { personaIdHint: personaId });
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
  }, [personaId]);

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

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Section: Active intents */}
      <section className="border-b border-slate-700/40">
        <button
          type="button"
          onClick={() => toggleSection('intents')}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-800/40"
        >
          {openSections.intents ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold">Active intents</span>
          <span className="text-[10px] text-slate-500">queued · approved · executed</span>
          {intents.length > 0 && (
            <span className="ml-auto text-[10px] text-slate-400">{intents.length}</span>
          )}
        </button>
        {openSections.intents && (
          <div className="px-4 pb-3">
            {intentsLoading ? (
              <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
            ) : intentsError ? (
              <div className="text-xs text-rose-300">Load failed: {intentsError}</div>
            ) : intents.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No active intents yet. Act on a Brief NBA in aigentMe to queue one.</div>
            ) : (
              <ul className="space-y-1">
                {intents.map((i) => (
                  <li
                    key={i.intentId}
                    className="rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2 hover:border-slate-600"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusChip(i.status)}`}>
                        {i.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{i.cartridge}</span>
                      <span className="text-[10px] text-slate-500 ml-auto">{new Date(i.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-white mt-1 truncate">{i.intentName}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Section: Working drafts (legacy MyCanvasTab in workspace mode) */}
      <section className="border-b border-slate-700/40 flex-1 min-h-0">
        <button
          type="button"
          onClick={() => toggleSection('drafts')}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-800/40"
        >
          {openSections.drafts ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          <Hammer className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold">Working drafts</span>
          <span className="text-[10px] text-slate-500">docs · reports · briefs · tools · workflows</span>
        </button>
        {openSections.drafts && (
          <div className="h-[600px]">
            <MyCanvasTab personaId={personaId} theme={theme} surface="workspace" />
          </div>
        )}
      </section>

      {/* Section: Strategic uploads */}
      <section>
        <button
          type="button"
          onClick={() => toggleSection('uploads')}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-800/40"
        >
          {openSections.uploads ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          <UploadCloud className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold">Strategic uploads</span>
          <span className="text-[10px] text-slate-500">venture iQube · iQube payload · workbench</span>
          {uploads.length > 0 && (
            <span className="ml-auto text-[10px] text-slate-400">{uploads.length}</span>
          )}
        </button>
        {openSections.uploads && (
          <div className="px-4 pb-3">
            {uploadsLoading ? (
              <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
            ) : uploadsError ? (
              <div className="text-xs text-rose-300">Load failed: {uploadsError}</div>
            ) : uploads.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No strategic uploads yet. Drop a Venture iQube JSON into the upload drawer to populate.</div>
            ) : (
              <ul className="space-y-1">
                {uploads.map((u) => (
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
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default MyWorkspaceTab;
