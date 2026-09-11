"use client";

/**
 * ActiveWorkDetailLayout — Phase 2 B.2 (2/2).
 *
 * Per-intent focused detail surface. Mounts when the operator clicks
 * an Active Work card in the Venture Cockpit. Shows the intent's
 * name, owning cartridge, current status, specialist on the
 * handoff, next-action hint, and (when receipts wire lands) the
 * last activity receipt.
 *
 * Footer actions surface what the operator can do RIGHT NOW based on
 * status: Resume (failed intents), Hand off (live + specialist),
 * Cancel (live), Approve (awaiting_approval).
 *
 * Receives the selected `intentId` through `selectedIntentId` on
 * layoutProps. When set + activeLayoutId === 'active-work-detail',
 * this layout finds the matching row in
 * `ventureProgress.recentActivity` and renders detail.
 *
 * DIS template id: `active-work-detail-layout-v1`. Mobile shape:
 * full-screen reader (same as KpiDetail / Brief).
 */

import React, { useCallback, useState } from "react";
import { Activity, ArrowRight, Loader2, AlertCircle, Pause, Trash2, ShieldCheck } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import { accent } from "./accentTokens";
import { personaFetch } from "@/utils/personaSpine";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In progress",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function ActiveWorkDetailLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    personaId,
    ventureProgress,
    selectedIntentId,
    onRequestLayout,
    onIntentEdited,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  const row = (ventureProgress?.recentActivity ?? []).find((r) => r.intentId === selectedIntentId) ?? null;

  // Accent picks the row's status semantic:
  //   - failed / blockers → rose
  //   - awaiting_approval → amber (mirrors ApprovalLayout)
  //   - in_progress       → emerald (Active Work row's existing accent)
  //   - completed         → slate (closed-state, no further action)
  //   - cancelled         → slate
  const accentKey: 'emerald' | 'amber' | 'rose' | 'slate' =
    row?.status === 'failed' ? 'rose' :
    row?.status === 'awaiting_approval' ? 'amber' :
    row?.status === 'in_progress' ? 'emerald' :
    'slate';
  const tint = accent(accentKey, isDark ? "dark" : "light");

  const [busy, setBusy] = useState<null | 'cancel' | 'handoff' | 'resume'>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDismiss = useCallback(() => {
    onRequestLayout?.("venture-cockpit");
  }, [onRequestLayout]);

  // Action handlers — best-effort against /api/assistant/intents/[id]/
  // routes. If those routes aren't wired yet on the server, the
  // helper logs the failure and surfaces a friendly error rather
  // than crashing the layout. Operator can still see + read the
  // intent state.
  const runAction = useCallback(
    async (kind: 'cancel' | 'handoff' | 'resume') => {
      if (!row || !personaId) return;
      setBusy(kind);
      setError(null);
      try {
        const path =
          kind === 'cancel'  ? `/api/assistant/intents/${row.intentId}/cancel`  :
          kind === 'handoff' ? `/api/assistant/intents/${row.intentId}/handoff` :
          /* resume */          `/api/assistant/intents/${row.intentId}/resume`;
        const res = await personaFetch(path, {
          personaIdHint: personaId,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // 404 is the expected "endpoint not wired yet" path — surface
          // a clear note rather than a generic failure so the operator
          // knows it's a backlog item, not a bug in their flow.
          if (res.status === 404) {
            setError(`Server-side ${kind} endpoint not wired yet — backlog item. Intent state unchanged.`);
            return;
          }
          throw new Error(body?.detail || body?.error || `${kind} failed (${res.status})`);
        }
        onIntentEdited?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : `${kind} failed`);
      } finally {
        setBusy(null);
      }
    },
    [row, personaId, onIntentEdited],
  );

  if (!row) {
    return (
      <LayoutShell
        surfaceId="active-work-detail"
        disTemplateId="active-work-detail-layout-v1"
        theme={theme}
        headerIcon={<Activity className="h-3.5 w-3.5" />}
        headerEyebrow="Active work"
        headerTitle="No item selected"
        onDismiss={handleDismiss}
        dismissLabel="Back to cockpit"
        body={
          <div className={`rounded-lg border p-5 lg:p-6 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
            <p className={`text-xs ${mutedClass}`}>
              Pick an Active Work item in the Venture Cockpit to see its detail here.
            </p>
          </div>
        }
      />
    );
  }

  const statusLabel = STATUS_LABELS[row.status] ?? row.status;

  return (
    <LayoutShell
      surfaceId="active-work-detail"
      disTemplateId="active-work-detail-layout-v1"
      theme={theme}
      headerIcon={<Activity className="h-3.5 w-3.5" />}
      headerEyebrow="Active work"
      headerTitle={row.intentName}
      onDismiss={handleDismiss}
      dismissLabel="Back to cockpit"
      footer={
        <>
          {row.canCancel && (
            <button
              type="button"
              onClick={() => runAction('cancel')}
              disabled={!!busy}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${
                isDark
                  ? "border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                  : "border-rose-300 text-rose-700 hover:bg-rose-50"
              } disabled:opacity-50`}
            >
              {busy === 'cancel' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Cancel
            </button>
          )}
          {row.canHandOff && (
            <button
              type="button"
              onClick={() => runAction('handoff')}
              disabled={!!busy}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${
                isDark
                  ? "border-slate-700/60 text-slate-300 hover:bg-slate-800/40"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
              } disabled:opacity-50`}
            >
              {busy === 'handoff' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
              Hand off to {row.specialist ?? 'specialist'}
            </button>
          )}
          {row.canResume && (
            <button
              type="button"
              onClick={() => runAction('resume')}
              disabled={!!busy}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${
                isDark
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                  : "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
              } disabled:opacity-50`}
            >
              {busy === 'resume' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
              Resume
            </button>
          )}
        </>
      }
      body={
        <div className="space-y-4">
          {/* Status hero card */}
          <div className={`rounded-2xl border p-5 backdrop-blur-sm ${tint.border} ${tint.fillStrong}`}>
            <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-1`}>
              Status
            </div>
            <div className={`text-2xl font-semibold leading-none ${tint.text}`}>
              {statusLabel}
            </div>
            {row.nextActionHint && (
              <div className={`text-xs mt-2 ${mutedClass}`}>
                <span className={tint.eyebrow}>Next:</span> {row.nextActionHint}
              </div>
            )}
          </div>

          {/* Intent context card */}
          <div className={`rounded-lg border p-4 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-1`}>Cartridge</div>
                <div className="font-medium">{row.cartridge}</div>
              </div>
              {row.specialist && (
                <div>
                  <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-1`}>Specialist</div>
                  <div className="font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {row.specialist}
                  </div>
                </div>
              )}
              <div>
                <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-1`}>Queued</div>
                <div className="font-medium">{new Date(row.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass} mb-1`}>Intent id</div>
                <div className="font-mono text-[11px] truncate" title={row.intentId}>{row.intentId}</div>
              </div>
            </div>
          </div>

          {/* Blockers (when present) */}
          {row.blockers && row.blockers.length > 0 && (
            <div className={`rounded-lg border p-4 ${isDark ? "border-amber-500/40 bg-amber-500/5" : "border-amber-300 bg-amber-50"}`}>
              <div className={`text-[10px] uppercase tracking-[0.16em] mb-1 ${isDark ? "text-amber-300" : "text-amber-700"} flex items-center gap-1`}>
                <AlertCircle className="w-3 h-3" />
                Blockers
              </div>
              <ul className="text-xs space-y-1">
                {row.blockers.map((b, i) => (
                  <li key={i} className={isDark ? "text-amber-200" : "text-amber-800"}>• {b}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              {error}
            </div>
          )}
        </div>
      }
    />
  );
}

export const ActiveWorkDetailLayout: RightPaneLayoutDefinition = {
  id: "active-work-detail",
  label: "Active work detail",
  component: ActiveWorkDetailLayoutComponent,
  disTemplateId: "active-work-detail-layout-v1",
};
