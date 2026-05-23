"use client";

/**
 * ArtifactCard — Aigent Me Phase 6.
 * Per PRD v0.2 §9.2 — title, artifact type, location/link, source context,
 * next actions.
 *
 * Alpha behaviour: destination='runtime' artifacts live as receipt-bound
 * records. Drive/Gmail/Calendar destinations are deferred (501) until
 * Phase 6.b wires Google Workspace OAuth.
 */

import React from "react";
import {
  FileText,
  Mail,
  Calendar,
  Image,
  Video,
  Presentation,
  Layers,
  Clipboard,
  X,
  ExternalLink,
  Loader2,
  Send,
} from "lucide-react";

export interface ArtifactCardData {
  artifactId: string;
  artifactType: string;
  title: string;
  destination: "runtime" | "drive" | "gmail" | "cartridge_store";
  status: "draft" | "ready_for_review" | "approved" | "sent" | "published";
  receiptId: string | null;
  intentId: string | null;
  message?: string;
  createdAt: string;
  /** Phase 6.b populates this when destination !== 'runtime'. */
  locationUrl?: string | null;
  /**
   * Phase 6.b Part 2.5 — externalisation hint. When present, ArtifactCard
   * renders a "Send / share / publish" button bound to this connector. The
   * second-tier ApprovalCard gates the actual /api/connectors/execute call.
   */
  actionConnectorId?: string;
  actionConnectorLabel?: string;
  actionInput?: Record<string, unknown>;
}

interface Props {
  data: ArtifactCardData;
  onDismiss?: () => void;
  /** Phase 6.b Part 2.5 — fired when the user clicks the externalise button. */
  onAction?: () => void;
  /** Set while the connector execution is in flight. */
  actionPending?: boolean;
  /** Inline error from the last action attempt. */
  actionError?: string | null;
  theme?: "light" | "dark";
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  "google-doc": <FileText className="w-4 h-4" />,
  "gmail-draft": <Mail className="w-4 h-4" />,
  "calendar-block": <Calendar className="w-4 h-4" />,
  "brief": <Clipboard className="w-4 h-4" />,
  "post-set": <Layers className="w-4 h-4" />,
  "image-prompt": <Image className="w-4 h-4" />,
  "video-script": <Video className="w-4 h-4" />,
  "slide-outline": <Presentation className="w-4 h-4" />,
  "venture-report": <Clipboard className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  "google-doc": "Google Doc",
  "gmail-draft": "Gmail draft",
  "calendar-block": "Calendar block",
  "brief": "Brief",
  "post-set": "Post set",
  "image-prompt": "Image prompt",
  "video-script": "Video script",
  "slide-outline": "Slide outline",
  "venture-report": "Venture report",
};

const STATUS_META: Record<ArtifactCardData["status"], { label: string; ring: string }> = {
  draft:            { label: "Draft",            ring: "border-slate-700 text-slate-300" },
  ready_for_review: { label: "Ready for review", ring: "border-violet-500/40 text-violet-200 bg-violet-500/10" },
  approved:         { label: "Approved",         ring: "border-violet-500/70 text-violet-100 bg-violet-500/15" },
  sent:             { label: "Sent",             ring: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" },
  published:        { label: "Published",        ring: "border-emerald-500/70 text-emerald-100 bg-emerald-500/15" },
};

export function ArtifactCard({
  data,
  onDismiss,
  onAction,
  actionPending,
  actionError,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const actionBtnClass = isDark
    ? "bg-violet-500 hover:bg-violet-400 text-white"
    : "bg-violet-600 hover:bg-violet-700 text-white";

  const icon = TYPE_ICONS[data.artifactType] ?? <FileText className="w-4 h-4" />;
  const typeLabel = TYPE_LABELS[data.artifactType] ?? data.artifactType;
  const statusMeta = STATUS_META[data.status];

  const canExternalise =
    !!onAction &&
    !!data.actionConnectorId &&
    (data.status === "draft" || data.status === "ready_for_review");

  return (
    <div className={`rounded-lg border p-4 ${surfaceClass}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${accentClass}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs uppercase tracking-wider mb-0.5 ${mutedClass}`}>
            {typeLabel} · {data.destination}
          </div>
          <h4 className="font-semibold leading-tight truncate">{data.title}</h4>
          {data.message && (
            <p className={`text-xs mt-1 ${mutedClass}`}>{data.message}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded-full border ${statusMeta.ring}`}>
              {statusMeta.label}
            </span>
            {/*
              Gmail / Drive / Calendar location link.
              Visible ONLY after the artifact has been approved + sent
              (status: approved | sent | published). While the artifact
              is still a draft awaiting send-approval, showing this
              link side-by-side with the "Send draft" button was a UX
              trap — operators clicked `Open` thinking it was the next
              step, got dropped into Gmail in a new tab, and the
              in-app approval never ran. Per the Phase-1 flow contract:
              approve in app → send via API → link to view post-send.
            */}
            {data.locationUrl &&
              (data.status === "approved" ||
                data.status === "sent" ||
                data.status === "published") && (
              <a
                href={data.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 underline ${accentClass}`}
              >
                {data.destination === "gmail"
                  ? "View in Gmail"
                  : data.destination === "drive"
                    ? "View in Drive"
                    : "Open"}{" "}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {data.receiptId && (
              <span className={mutedClass}>
                receipt: <span className="font-mono">{data.receiptId.slice(0, 8)}…</span>
              </span>
            )}
            <span className={`${mutedClass} ml-auto`}>
              {new Date(data.createdAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 rounded hover:bg-slate-800/40"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {canExternalise && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onAction}
            disabled={actionPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${actionBtnClass}`}
          >
            {actionPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {actionPending
              ? "Working…"
              : data.actionConnectorLabel ?? "Send / share / publish"}
          </button>
          {actionError && (
            <span className="text-xs text-amber-400">{actionError}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default ArtifactCard;
