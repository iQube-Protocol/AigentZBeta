"use client";

/**
 * SecondTierApprovalCard — Aigent Me Phase 6.b Part 2.5.
 *
 * Per PRD v0.2 §10 FR11 — "Approval gate before any send / share / publish."
 *
 * The first-tier ApprovalCard (intent-level) lives at the start of an NBE
 * flow. This card is the second tier: it fires only when a runtime
 * artifact is about to externalise to Google Workspace (Gmail send,
 * Calendar invite, Drive share, Doc publish). The route layer returns
 * `code: 'requires-approval'` for any connector whose `requiresApproval`
 * flag is set; the welcome surface shows this card inline next to the
 * artifact and the user must confirm before the action runs.
 *
 * Presentational only — submit logic lives at the call-site so the
 * welcome tab keeps the artifact <-> connector binding.
 */

import React from "react";
import { Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";

interface Props {
  /** Human label for the connector being run (e.g. "Gmail · Send email"). */
  connectorLabel: string;
  /** Short summary of what's being externalised. */
  summary: string;
  /** Optional secondary detail line. */
  detail?: string;
  submitting?: boolean;
  error?: string | null;
  onApprove: () => void;
  onCancel: () => void;
  theme?: "light" | "dark";
}

export function SecondTierApprovalCard({
  connectorLabel,
  summary,
  detail,
  submitting,
  error,
  onApprove,
  onCancel,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-amber-500/5 border-amber-500/40 text-slate-100"
    : "bg-amber-50 border-amber-300 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-amber-200" : "text-amber-800";
  const approveBtn = isDark
    ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
    : "bg-amber-500 hover:bg-amber-600 text-white";
  const ghostBtn = isDark
    ? "border-slate-700 text-slate-300 hover:border-slate-500"
    : "border-slate-300 text-slate-700 hover:border-slate-500";

  return (
    <div className={`rounded-lg border p-4 ${surfaceClass}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className={`w-4 h-4 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${accentClass}`}>
              Confirm external action
            </span>
          </div>
          <h4 className="font-semibold">{connectorLabel}</h4>
          <p className={`text-sm mt-1 ${mutedClass}`}>{summary}</p>
          {detail && <p className={`text-xs mt-1 ${mutedClass}`}>{detail}</p>}
        </div>
        <button
          onClick={onCancel}
          className="shrink-0 p-1 rounded hover:bg-slate-800/40"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={submitting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${approveBtn}`}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          {submitting ? "Sending…" : "Approve & send"}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition ${ghostBtn}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default SecondTierApprovalCard;
