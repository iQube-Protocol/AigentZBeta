"use client";

/**
 * ComposerLayout — Phase 2 Slice 4.
 *
 * Focused editor surface for drafted artifacts (emails, briefs, posts).
 * v1 surfaces the most recent draft from the existing artifacts list in
 * a single-pane editor with thread context at top and send/save/route
 * actions in the footer.
 *
 * Mobile: full-screen editor; thread context collapses to a chip; sticky
 * bottom action bar (DIS `mobileShapes.composer-layout-v1`).
 *
 * Activator wiring: future slices will add a "Compose" chip and an
 * "Open in composer" action on artifact cards. For now the layout is
 * registered + reachable by `setActiveLayoutId('composer')` and
 * gracefully renders the most-recent-draft state.
 *
 * DIS template id: `composer-layout-v1`.
 */

import React, { useCallback } from "react";
import { Pencil, Send, Save, ArrowRight } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

function ComposerLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    artifacts,
    actionPendingArtifactId,
    actionErrors,
    onSendArtifact,
    onDismissArtifact,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const surfaceClass = isDark
    ? "border-slate-700/60 bg-slate-900/40"
    : "border-slate-200 bg-white";

  const draft = artifacts && artifacts.length > 0 ? artifacts[0] : null;
  const pending = draft ? actionPendingArtifactId === draft.id : false;
  const err = draft ? actionErrors?.[draft.id] : null;

  const handleDismiss = useCallback(() => {
    onRequestLayout?.("stack");
  }, [onRequestLayout]);

  const primaryBtn = isDark
    ? "bg-violet-500/20 hover:bg-violet-500/30 border-violet-500/40 text-violet-100"
    : "bg-violet-100 hover:bg-violet-200 border-violet-300 text-violet-800";
  const secondaryBtn = isDark
    ? "border-slate-700/60 text-slate-300 hover:bg-slate-800/40"
    : "border-slate-200 text-slate-600 hover:bg-slate-100";

  return (
    <LayoutShell
      surfaceId="composer"
      disTemplateId="composer-layout-v1"
      theme={theme}
      headerIcon={<Pencil className="h-3.5 w-3.5" />}
      headerEyebrow="Composer"
      headerTitle={draft?.title ?? "No draft open"}
      onDismiss={handleDismiss}
      dismissLabel="Close composer"
      footer={
        draft ? (
          <>
            <button
              type="button"
              onClick={() => onDismissArtifact?.(draft.id)}
              disabled={pending}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${secondaryBtn} disabled:opacity-50`}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => onSendArtifact?.(draft.id)}
              disabled={pending}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${primaryBtn} disabled:opacity-50`}
            >
              <Send className="h-3 w-3" />
              {pending ? "Sending…" : "Send"}
            </button>
          </>
        ) : undefined
      }
      body={
        !draft ? (
          <ComposerEmptyState isDark={isDark} mutedClass={mutedClass} />
        ) : (
          <div className="space-y-3">
            {/* Thread context chip — collapses to a single line; tap to expand
                (future slice). For v1 the chip surfaces the artifact kind and
                cartridge so the operator knows what they're sending. */}
            <div
              className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between ${surfaceClass}`}
            >
              <div className="min-w-0">
                <span className={`uppercase tracking-[0.16em] text-[10px] ${mutedClass}`}>
                  {String((draft as { kind?: string }).kind ?? "draft")}
                </span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="truncate">
                  {String((draft as { cartridge?: string }).cartridge ?? "metame")}
                </span>
              </div>
              {(draft as { specialist?: string }).specialist && (
                <span className={`inline-flex items-center gap-1 ${mutedClass}`}>
                  <ArrowRight className="h-3 w-3" />
                  {String((draft as { specialist?: string }).specialist)}
                </span>
              )}
            </div>

            {/* Draft body */}
            <div className={`rounded-lg border p-4 ${surfaceClass}`}>
              <div className={`text-[10px] uppercase tracking-[0.16em] mb-2 ${mutedClass}`}>
                Draft
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {String((draft as { body?: string; summary?: string }).body
                  ?? (draft as { summary?: string }).summary
                  ?? "(no body yet)")}
              </div>
            </div>

            {err && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${
                isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
              }`}>
                {err}
              </div>
            )}

            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${secondaryBtn}`}
              disabled
              title="Save to myCanvas — wiring in next pass"
            >
              <Save className="h-3 w-3" />
              Save to myCanvas
            </button>
          </div>
        )
      }
    />
  );
}

function ComposerEmptyState({ isDark, mutedClass }: { isDark: boolean; mutedClass: string }) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <div className="flex items-start gap-3">
        <Pencil className={`h-5 w-5 mt-0.5 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
        <div>
          <h3 className="text-sm font-semibold mb-1">No draft open</h3>
          <p className={`text-xs leading-relaxed ${mutedClass}`}>
            Composer surfaces drafted artifacts as a focused editor. Trigger
            a draft from an NBE (e.g. "Draft email to dele") or from a
            cartridge action — the artifact will land here.
          </p>
        </div>
      </div>
    </div>
  );
}

export const ComposerLayout: RightPaneLayoutDefinition = {
  id: "composer",
  label: "Composer",
  component: ComposerLayoutComponent,
  disTemplateId: "composer-layout-v1",
};
