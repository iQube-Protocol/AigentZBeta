"use client";

/**
 * ApprovalLayout — Phase 2 Slice 5 (interrupt class).
 *
 * Overlays the current foreground layout when a pending approval arrives.
 * Underlying layout stays mounted underneath at reduced opacity so the
 * user keeps their context. On dismiss, the previous layout resumes.
 *
 * Desktop: centered focus card with backdrop dim.
 * Mobile: bottom-sheet slide-up with drag handle (DIS
 * `mobileShapes.approval-interrupt-layout-v1`).
 *
 * Activator wiring: this is an INTERRUPT layout — it is set by the
 * tab when `pendingApprovalNbe` arrives, not by a chip. The previous
 * `activeLayoutId` is restored on dismiss. v1 falls back to 'stack' on
 * dismiss; later slices may snapshot the prior layout.
 *
 * DIS template id: `approval-interrupt-layout-v1`.
 */

import React, { useCallback } from "react";
import { ShieldAlert, Check, X, Loader2 } from "lucide-react";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

function ApprovalLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    pendingApproval,
    submittingApproval,
    approvalError,
    usingIqubes,
    onApprovalApprove,
    onApprovalCancel,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "border-slate-700/60 bg-slate-900/95"
    : "border-slate-200 bg-white";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const iconBg = isDark
    ? "bg-amber-500/15 text-amber-300"
    : "bg-amber-100 text-amber-700";
  const primaryBtn = isDark
    ? "bg-violet-500/20 hover:bg-violet-500/30 border-violet-500/40 text-violet-100"
    : "bg-violet-100 hover:bg-violet-200 border-violet-300 text-violet-800";
  const cancelBtn = isDark
    ? "border-slate-700/60 text-slate-300 hover:bg-slate-800/40"
    : "border-slate-200 text-slate-600 hover:bg-slate-100";

  const handleDismiss = useCallback(() => {
    onApprovalCancel?.();
    onRequestLayout?.("stack");
  }, [onApprovalCancel, onRequestLayout]);

  const handleApprove = useCallback(() => {
    onApprovalApprove?.();
  }, [onApprovalApprove]);

  if (!pendingApproval) {
    // Safety: nothing to approve — bounce back to stack.
    return null;
  }

  return (
    <div
      data-aigentme-right-pane="approval-interrupt"
      data-aigentme-layout="approval-interrupt-layout-v1"
      className="absolute inset-0 z-30 flex md:items-center md:justify-center"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss approval"
        onClick={handleDismiss}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Sheet (mobile: bottom; desktop: centered card) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className={`
          relative w-full md:max-w-md md:rounded-2xl rounded-t-2xl border ${surfaceClass}
          md:m-4 md:shadow-lg
          mt-auto md:mt-0
          flex flex-col overflow-hidden
        `}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex items-center justify-center py-2">
          <div className={`h-1 w-10 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
        </div>

        {/* Header */}
        <header className={`flex items-start gap-3 px-5 pt-3 pb-2`}>
          <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${iconBg}`}>
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
              Approval required
            </div>
            <div id="approval-title" className="text-sm font-semibold leading-tight">
              {pendingApproval.label}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md ${
              isDark
                ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        {/* Body */}
        <div className="px-5 py-3 space-y-3">
          <p className={`text-xs leading-relaxed ${mutedClass}`}>
            {pendingApproval.rationale}
          </p>

          {usingIqubes && usingIqubes.length > 0 && (
            <div>
              <div className={`text-[10px] uppercase tracking-[0.16em] mb-1 ${mutedClass}`}>
                Using
              </div>
              <div className="flex flex-wrap gap-1.5">
                {usingIqubes.map((q) => (
                  <span
                    key={q}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      isDark
                        ? "border-slate-700/60 bg-slate-800/40 text-slate-200"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pendingApproval.specialist && (
            <div className={`text-[11px] ${mutedClass}`}>
              Will route to <span className="font-medium">{pendingApproval.specialist}</span>.
            </div>
          )}

          {approvalError && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              {approvalError}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${
          isDark ? "border-slate-800/60" : "border-slate-200"
        }`}>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={submittingApproval}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${cancelBtn} disabled:opacity-50`}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submittingApproval}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${primaryBtn} disabled:opacity-50`}
          >
            {submittingApproval ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {submittingApproval ? "Approving…" : "Approve"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export const ApprovalLayout: RightPaneLayoutDefinition = {
  id: "approval-interrupt",
  label: "Approval",
  component: ApprovalLayoutComponent,
  disTemplateId: "approval-interrupt-layout-v1",
};
