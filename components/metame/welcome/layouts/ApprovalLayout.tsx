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
    secondTierApproval,
    onApprovalApprove,
    onApprovalCancel,
    onApproveSecondTier,
    onCancelSecondTier,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  // Sheet surface picks up a soft amber tint so the authorization
  // intent reads at a glance — mirrors the Phase-1 amber card the
  // operator was used to. Border stays amber-tinted; backdrop dim is
  // still neutral so the foreground layout reads underneath.
  const surfaceClass = isDark
    ? "border-amber-500/40 bg-slate-900/95"
    : "border-amber-300 bg-white";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const iconBg = isDark
    ? "bg-amber-500/15 text-amber-300"
    : "bg-amber-100 text-amber-700";
  // Primary CTA carries the authorization intent in amber as well,
  // matching the Phase-1 "Approve & send" button so the operator's
  // muscle memory transfers unchanged.
  const primaryBtn = isDark
    ? "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-100"
    : "bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900";
  const cancelBtn = isDark
    ? "border-slate-700/60 text-slate-300 hover:bg-slate-800/40"
    : "border-slate-200 text-slate-600 hover:bg-slate-100";

  // Two approval shapes converge here:
  //   - `secondTierApproval`  → external-action confirm (Send email, Create
  //                              event, Share doc, etc). Takes precedence
  //                              because it's the concrete user-facing gate.
  //   - `pendingApproval`     → an NBE that requires approval before queue.
  //
  // Both render through the same bottom-sheet/centered overlay so the
  // operator's flow stays in-app, regardless of which gate fired.
  const variant: "second-tier" | "nbe" | null = secondTierApproval
    ? "second-tier"
    : pendingApproval
      ? "nbe"
      : null;

  const handleDismiss = useCallback(() => {
    if (variant === "second-tier") onCancelSecondTier?.();
    else if (variant === "nbe") onApprovalCancel?.();
    onRequestLayout?.("stack");
  }, [variant, onApprovalCancel, onCancelSecondTier, onRequestLayout]);

  const handleApprove = useCallback(() => {
    if (variant === "second-tier") onApproveSecondTier?.();
    else if (variant === "nbe") onApprovalApprove?.();
  }, [variant, onApprovalApprove, onApproveSecondTier]);

  if (!variant) {
    // Safety: nothing to approve — bounce back to stack.
    return null;
  }

  // ── Variant-specific surface text ─────────────────────────────────
  // Two shapes converge on the same overlay; pull the right strings
  // out once so the JSX stays flat.
  const eyebrow =
    variant === "second-tier"
      ? secondTierApproval?.connectorLabel || "Confirm external action"
      : "Approval required";
  const title =
    variant === "second-tier"
      ? secondTierApproval?.summary || "Confirm send"
      : pendingApproval?.label || "Approve action";
  const body =
    variant === "second-tier"
      ? secondTierApproval?.detail ||
        "This will leave your account. Confirm to send."
      : pendingApproval?.rationale || "";
  const submitting =
    variant === "second-tier"
      ? !!secondTierApproval?.submitting
      : !!submittingApproval;
  const errorText =
    variant === "second-tier" ? secondTierApproval?.error ?? null : approvalError ?? null;
  const approveLabel =
    variant === "second-tier"
      ? submitting ? "Sending…" : "Approve & send"
      : submitting ? "Approving…" : "Approve";
  const cancelLabel = variant === "second-tier" ? "Cancel" : "Decline";

  return (
    <div
      data-aigentme-right-pane="approval-interrupt"
      data-aigentme-layout="approval-interrupt-layout-v1"
      data-aigentme-approval-variant={variant}
      className="absolute inset-0 z-40 flex md:items-center md:justify-center"
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
              {eyebrow}
            </div>
            <div id="approval-title" className="text-sm font-semibold leading-tight">
              {title}
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
          {body && (
            <p className={`text-xs leading-relaxed ${mutedClass}`}>{body}</p>
          )}

          {/* NBE variant only — using iQubes + specialist routing */}
          {variant === "nbe" && usingIqubes && usingIqubes.length > 0 && (
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

          {variant === "nbe" && pendingApproval?.specialist && (
            <div className={`text-[11px] ${mutedClass}`}>
              Will route to <span className="font-medium">{pendingApproval.specialist}</span>.
            </div>
          )}

          {errorText && (
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
            disabled={submitting}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${cancelBtn} disabled:opacity-50`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium ${primaryBtn} disabled:opacity-50`}
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {approveLabel}
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
