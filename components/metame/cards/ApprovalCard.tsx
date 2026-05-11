"use client";

/**
 * ApprovalCard — Aigent Me's canonical "approve before acting" surface.
 *
 * Per PRD v0.2 §9.2 (Runtime cards → Approval Card) and §10 FR11.
 *
 * Displays:
 *   - action requested
 *   - tool / target / data involved
 *   - iQubes used
 *   - approve / edit / cancel
 *
 * Phase 3.5 wires this for NextBestAction interactions only:
 *   - Approve → POST /api/assistant/intent → IntentQube created → card
 *     flips to a "queued" state showing the intent id + message.
 *   - Cancel → close the card; no record persisted.
 *   - Edit → preview only in this phase; the full edit surface lands in
 *     Phase 6 when the artifact/email content path lands.
 *
 * The card itself stays presentational. The submit fetch lives at the
 * call-site so the welcome surface can keep state on which NBE is
 * "pending approval" vs "queued".
 */

import React from "react";
import { Loader2, ShieldCheck, ShieldAlert, X, Pencil, CheckCircle2, Users } from "lucide-react";
import { IqubeContextDisclosure, type IqubeKind } from "./IqubeContextDisclosure";

export interface ApprovalCardAction {
  /** Catalogue id for the NBE being approved. */
  nbeId: string;
  label: string;
  rationale: string;
  cartridge: string;
  approvalRequired: boolean;
  specialist: "marketa" | "quill" | "kn0w1" | "aigent-z" | "aigent-c" | null;
  suggestedArtifact: string | null;
}

export interface ApprovalQueuedState {
  intentId: string;
  status: string;
  queueMessage: string;
}

interface Props {
  action: ApprovalCardAction;
  /** Set when the approval is in flight after the user clicks Approve. */
  submitting?: boolean;
  /** Set when the IntentQube has been created. Card switches to confirmed state. */
  queued?: ApprovalQueuedState | null;
  /** Diagnostic when the approve fetch fails. */
  error?: string | null;
  onApprove: () => void;
  onCancel: () => void;
  onEdit?: () => void;
  /** iQubes the user's session is using right now. */
  using: IqubeKind[];
  theme?: "light" | "dark";
}

const SPECIALIST_LABELS: Record<string, string> = {
  marketa: "Marketa",
  quill: "Quill, editor of The Qriptopian",
  kn0w1: "Kn0w1",
  "aigent-z": "Aigent Z",
  "aigent-c": "Aigent C",
};

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  avl: "AgentiQ Venture Lab",
};

export function ApprovalCard({
  action,
  submitting,
  queued,
  error,
  onApprove,
  onCancel,
  onEdit,
  using,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-violet-500/5 border-violet-500/40 text-slate-100"
    : "bg-violet-50 border-violet-300 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-200" : "text-violet-800";
  const approveBtn = isDark
    ? "bg-violet-500 hover:bg-violet-400 text-white"
    : "bg-violet-600 hover:bg-violet-700 text-white";
  const ghostBtn = isDark
    ? "border-slate-700 text-slate-300 hover:border-slate-500"
    : "border-slate-300 text-slate-700 hover:border-slate-500";

  if (queued) {
    return (
      <div className={`rounded-lg border p-4 ${surfaceClass}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={`w-5 h-5 mt-0.5 ${accentClass}`} />
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${accentClass}`}>Queued — {action.label}</h4>
            <p className={`text-sm mt-1 ${mutedClass}`}>{queued.queueMessage}</p>
            <p className={`text-[11px] mt-2 ${mutedClass}`}>
              intent: <span className="font-mono">{queued.intentId.slice(0, 8)}…</span>
              {" · status: "}<span className="font-mono">{queued.status}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className={`shrink-0 p-1 rounded hover:bg-slate-800/40`}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${surfaceClass}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className={`w-4 h-4 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${accentClass}`}>
              Approval required
            </span>
          </div>
          <h4 className="font-semibold">{action.label}</h4>
          <p className={`text-sm mt-1 ${mutedClass}`}>{action.rationale}</p>
        </div>
        <button
          onClick={onCancel}
          className={`shrink-0 p-1 rounded hover:bg-slate-800/40`}
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <dl className={`text-xs space-y-1 mb-3 ${mutedClass}`}>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Cartridge</dt>
          <dd>{CARTRIDGE_LABELS[action.cartridge] ?? action.cartridge}</dd>
        </div>
        {action.specialist && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Coordinate</dt>
            <dd className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {SPECIALIST_LABELS[action.specialist] ?? action.specialist}
            </dd>
          </div>
        )}
        {action.suggestedArtifact && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Artifact</dt>
            <dd>{action.suggestedArtifact}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">External</dt>
          <dd>
            {action.approvalRequired
              ? "Approval gate before any send / share / publish"
              : "No external action; queued for Aigent Me"}
          </dd>
        </div>
      </dl>

      <IqubeContextDisclosure using={using} theme={theme} />

      {error && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
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
          {submitting ? "Queuing…" : "Approve"}
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            disabled
            title="Edit-before-queue lands in Phase 6"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition opacity-40 cursor-not-allowed ${ghostBtn}`}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
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

export default ApprovalCard;
