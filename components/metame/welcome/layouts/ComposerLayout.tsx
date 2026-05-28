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
 * ─── OVERLAY CONTRACT — READ BEFORE EDITING ────────────────────────
 * ComposerLayout mounts ONLY as a transparent overlay on top of the
 * active Capsule foreground (Brief / Move-forward / Venture / Specialists).
 * The Capsule layout stays mounted underneath so the operator can return
 * to it after the compose form closes — its Pills, queued state, drafted
 * artifacts, and second-tier approvals are preserved across the compose
 * round-trip.
 *
 * DO NOT call `onRequestLayout('stack')` (or any other layout swap) from
 * this component's dismiss/close/onCreate/cancel handlers. Doing so
 * unmounts whatever Capsule layout was foreground and the operator's
 * work vanishes. This was the 2026-05-28 "capsule disappears after Act"
 * regression — capsule data persisted in parent state but the dedicated
 * layout was gone, and the only way to recover was to click the
 * quick-action chip to re-mount. The legacy `onRequestLayout('stack')`
 * calls were vestigial from when ComposerLayout was a foreground
 * surface, before the overlay refactor.
 *
 * Dismiss path: call `onComposerClose?.()` only. The parent's
 * `setComposerKind(null)` unmounts the overlay; the foreground Capsule
 * remains intact.
 * ───────────────────────────────────────────────────────────────────
 *
 * DIS template id: `composer-layout-v1`.
 */

import React, { useCallback } from "react";
import { Pencil, Send, Save, ArrowRight } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import { accent } from "./accentTokens";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";
import { ComposeGmailDraftModal } from "@/components/metame/connections/ComposeGmailDraftModal";
import { ComposeCalendarEventModal } from "@/components/metame/connections/ComposeCalendarEventModal";
import { ComposeGoogleDocModal } from "@/components/metame/connections/ComposeGoogleDocModal";
import { ComposeGoogleSheetModal } from "@/components/metame/connections/ComposeGoogleSheetModal";
import { ComposeSlidesModal } from "@/components/metame/connections/ComposeSlidesModal";
import { ComposeMarketaEmailModal } from "@/components/metame/connections/ComposeMarketaEmailModal";

const KIND_LABELS: Record<string, string> = {
  gmail:   "Compose email",
  event:   "Compose event",
  doc:     "Compose doc",
  sheet:   "Compose sheet",
  slides:  "Compose slides",
  marketa: "Compose Marketa email",
};

function ComposerLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    artifacts,
    actionPendingArtifactId,
    actionErrors,
    onSendArtifact,
    onDismissArtifact,
    composerKind,
    composerHandlers,
    composerInitialPrompt,
    onComposerClose,
    personaId,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const surfaceClass = isDark
    ? "border-slate-700/60 bg-slate-900/40"
    : "border-slate-200 bg-white";

  const draft = artifacts && artifacts.length > 0 ? artifacts[0] : null;
  const pending = draft ? actionPendingArtifactId === draft.id : false;
  const err = draft ? actionErrors?.[draft.id] : null;

  // Composer mounts only as an overlay now. Dismiss clears composerKind
  // so the overlay unmounts; the foreground Capsule (Brief / Move-forward
  // / Venture / Specialists) stays mounted underneath. The earlier
  // onRequestLayout('stack') call was a legacy fallback from when the
  // composer was a foreground layout — it actively broke the active
  // Capsule by swapping activeLayoutId out from under it after compose.
  const handleDismiss = useCallback(() => {
    onComposerClose?.();
  }, [onComposerClose]);

  // Inline form factory — when a composerKind is selected, render the
  // matching modal in `inline` mode (no overlay chrome) so the form
  // body hosts directly inside the layout. The modal's onClose returns
  // the pane to stack; onCreate fires the existing artifact-create API
  // via the handler the tab passed down.
  const inlineForm = (() => {
    if (!composerKind || !composerHandlers) return null;
    // Modal X / Cancel → clear composerKind so the overlay unmounts.
    // No foreground layout swap — the active Capsule (Brief / Move
    // forward / Venture / Specialists) stays mounted underneath.
    const closeToStack = () => {
      onComposerClose?.();
    };
    switch (composerKind) {
      case "gmail":
        if (!composerHandlers.onCreateGmail || !composerHandlers.onDraftGmail) return null;
        return (
          <ComposeGmailDraftModal
            open
            inline
            onClose={closeToStack}
            onCreate={composerHandlers.onCreateGmail}
            onDraftWithAigentMe={composerHandlers.onDraftGmail}
            theme={theme}
            initialPrompt={composerInitialPrompt ?? undefined}
            personaId={personaId}
          />
        );
      case "event":
        if (!composerHandlers.onCreateCalendar || !composerHandlers.onDraftCalendar) return null;
        return (
          <ComposeCalendarEventModal
            open
            inline
            onClose={closeToStack}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onCreate={composerHandlers.onCreateCalendar as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDraftWithAigentMe={composerHandlers.onDraftCalendar as any}
            theme={theme}
            initialPrompt={composerInitialPrompt ?? undefined}
          />
        );
      case "doc":
        if (!composerHandlers.onCreateDoc || !composerHandlers.onDraftDoc) return null;
        return (
          <ComposeGoogleDocModal
            open
            inline
            onClose={closeToStack}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onCreate={composerHandlers.onCreateDoc as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDraftWithAigentMe={composerHandlers.onDraftDoc as any}
            theme={theme}
            initialPrompt={composerInitialPrompt ?? undefined}
          />
        );
      case "sheet":
        if (!composerHandlers.onCreateSheet || !composerHandlers.onDraftSheet) return null;
        return (
          <ComposeGoogleSheetModal
            open
            inline
            onClose={closeToStack}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onCreate={composerHandlers.onCreateSheet as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDraftWithAigentMe={composerHandlers.onDraftSheet as any}
            theme={theme}
            initialPrompt={composerInitialPrompt ?? undefined}
          />
        );
      case "slides":
        if (!composerHandlers.onCreateSlides || !composerHandlers.onDraftSlides) return null;
        return (
          <ComposeSlidesModal
            open
            inline
            onClose={closeToStack}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onCreate={composerHandlers.onCreateSlides as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDraftWithAigentMe={composerHandlers.onDraftSlides as any}
            theme={theme}
            initialPrompt={composerInitialPrompt ?? undefined}
          />
        );
      case "marketa":
        if (!composerHandlers.onCreateMarketa || !composerHandlers.onDraftMarketa) return null;
        return (
          <ComposeMarketaEmailModal
            open
            inline
            onClose={closeToStack}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onCreate={composerHandlers.onCreateMarketa as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDraftWithAigentMe={composerHandlers.onDraftMarketa as any}
            theme={theme}
            initialPrompt={composerInitialPrompt ?? undefined}
            personaId={personaId}
          />
        );
      default:
        return null;
    }
  })();

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
      headerTitle={
        composerKind
          ? KIND_LABELS[composerKind] ?? "Composer"
          : draft?.title ?? "No draft open"
      }
      onDismiss={handleDismiss}
      dismissLabel="Close composer"
      footer={
        // Footer only renders when a draft exists and we're not in the
        // compose-form state. The inline compose form ships its own
        // Submit / Cancel buttons.
        !composerKind && draft ? (
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
        // Composing? Render the inline form first. Once a draft lands
        // (artifact created), the form unmounts and the draft preview
        // shows below — same surface, no popup, no surface switching.
        composerKind && inlineForm ? (
          inlineForm
        ) : !draft ? (
          <ComposerEmptyState isDark={isDark} mutedClass={mutedClass} />
        ) : (
          <div className="space-y-3">
            {/* Thread context chip (cyan — composition context). Collapses
                to a single line; tap to expand (future slice). Surfaces
                artifact kind + cartridge so the operator knows what's
                going where. */}
            {(() => {
              const ctx = accent("cyan", isDark ? "dark" : "light");
              return (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between backdrop-blur-sm ${ctx.border} ${ctx.fillSoft}`}
                >
                  <div className="min-w-0">
                    <span className={`uppercase tracking-[0.16em] text-[10px] font-medium ${ctx.eyebrow}`}>
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
              );
            })()}

            {/* Draft body (violet eyebrow — action-bearing surface) */}
            <div className={`rounded-lg border p-4 ${surfaceClass}`}>
              <div className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${isDark ? "text-violet-300" : "text-violet-700"}`}>
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
