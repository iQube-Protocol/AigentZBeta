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

import React, { useState } from "react";
import {
  FileText,
  Mail,
  Calendar,
  Image,
  Video,
  Presentation,
  Layers,
  Clipboard,
  ClipboardCheck,
  X,
  ExternalLink,
  Loader2,
  Send,
  AlertTriangle,
} from "lucide-react";

export interface ArtifactCardData {
  artifactId: string;
  artifactType: string;
  title: string;
  destination: "runtime" | "drive" | "gmail" | "calendar" | "cartridge_store";
  status: "draft" | "ready_for_review" | "approved" | "sent" | "published";
  receiptId: string | null;
  intentId: string | null;
  message?: string;
  createdAt: string;
  /** Phase 6.b populates this when destination !== 'runtime'. */
  locationUrl?: string | null;
  /**
   * Optional connector-emitted warning for a partial-success outcome
   * (e.g. Drive created the doc but the Docs API was disabled so the
   * body insert failed 403). Rendered as an amber callout on the
   * card. When the text contains a Google Cloud Console URL, the
   * card extracts it as a clickable "Enable API" CTA so the operator
   * can fix the disabled-API issue in one click.
   */
  warning?: string | null;
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
  "marketa-email": <Mail className="w-4 h-4" />,
  "marketa-cohort-email": <Mail className="w-4 h-4" />,
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
  "marketa-email": "Marketa email",
  "marketa-cohort-email": "Marketa cohort email",
};

const STATUS_META: Record<ArtifactCardData["status"], { label: string; ring: string }> = {
  draft:            { label: "Draft",            ring: "border-slate-700 text-slate-300" },
  ready_for_review: { label: "Ready for review", ring: "border-violet-500/40 text-violet-200 bg-violet-500/10" },
  approved:         { label: "Approved",         ring: "border-violet-500/70 text-violet-100 bg-violet-500/15" },
  sent:             { label: "Sent",             ring: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" },
  published:        { label: "Published",        ring: "border-emerald-500/70 text-emerald-100 bg-emerald-500/15" },
};

/**
 * Renders `receipt: <8-char prefix>…` followed by a small Clipboard button
 * that copies the FULL receipt id to the system clipboard. Click feedback
 * swaps the icon to ClipboardCheck for ~1.5s. Lives inside the artifact
 * chip row in ArtifactCard / ExpandedNBEPill so the operator can grab the
 * id without leaving the Capsule. Receipt-detail view in-pill is on the
 * backlog; this is the smaller, safe interim.
 */
function ReceiptIdChip({ receiptId, mutedClass }: { receiptId: string; mutedClass: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(receiptId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Permission denied / non-secure-context — silently no-op; the
      // truncated id is still visible for manual copy.
    }
  };
  return (
    <span className={`inline-flex items-center gap-1 ${mutedClass}`}>
      receipt: <span className="font-mono">{receiptId.slice(0, 8)}…</span>
      <button
        type="button"
        onClick={onCopy}
        title={copied ? "Copied!" : `Copy receipt id ${receiptId}`}
        aria-label={copied ? "Receipt id copied" : "Copy receipt id"}
        className={`p-0.5 rounded transition-colors ${
          copied
            ? "text-emerald-300"
            : "text-slate-500 hover:text-violet-300 hover:bg-violet-500/10"
        }`}
      >
        {copied ? <ClipboardCheck className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
      </button>
    </span>
  );
}

export function ArtifactCard({
  data,
  onDismiss,
  onAction,
  actionPending,
  actionError,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  // Sent/published artifacts get an emerald border so the operator can
  // tell at a glance that the externalisation completed — without this
  // the card looks identical pre- and post-send except for the small
  // status chip.
  //
  // Calendar events and Drive artifacts (Doc / Sheet / Slides) finish
  // ON CREATION — there's no separate "Send" step like Gmail/Marketa.
  // Once a locationUrl is attached, the artifact lives in the operator's
  // calendar / drive and IS the completion. Treating these as "sent"
  // for the green-border glance keeps parity across all 6 composer CTAs
  // (Gmail, Event, Doc, Sheet, Slides, Marketa).
  const completedOnCreation =
    data.status === "draft" &&
    !!data.locationUrl &&
    (data.destination === "calendar" || data.destination === "drive");
  const isSent = data.status === "sent" || data.status === "published" || completedOnCreation;
  const surfaceClass = isSent
    ? isDark
      ? "bg-emerald-500/5 border-emerald-500/60 text-slate-100"
      : "bg-emerald-50 border-emerald-400 text-slate-900"
    : isDark
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
          {data.warning && (
            <ArtifactWarningCallout warning={data.warning} theme={theme} />
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded-full border ${statusMeta.ring}`}>
              {statusMeta.label}
            </span>
            {(() => {
              // Attachment-count chip — surfaces the persona uploads that
              // will ride with the artifact when the operator clicks
              // Send. Diagnostic: without this the picker can fall to
              // empty (wrong persona, fetch race, etc.) and the operator
              // ships an email expecting an attachment that never made
              // it into the multipart MIME body. Lives on the card so
              // the count is visible before Send + confirmed after.
              const ids = (data.actionInput as { attachmentUploadIds?: unknown } | undefined)?.attachmentUploadIds;
              const count = Array.isArray(ids) ? ids.length : 0;
              if (count === 0) return null;
              return (
                <span className="px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-200">
                  {count} attached
                </span>
              );
            })()}
            {data.locationUrl && (
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
                    : data.destination === "calendar"
                      ? "View in Calendar"
                      : "Open"}{" "}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {data.receiptId && (
              <ReceiptIdChip receiptId={data.receiptId} mutedClass={mutedClass} />
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

/**
 * Amber callout for a connector-emitted partial-success warning.
 * Extracts the first URL from the warning text — when it points at
 * `console.developers.google.com` or `console.cloud.google.com`, the
 * URL is surfaced as an "Enable API" CTA the operator can click to
 * fix the disabled-API issue and re-run.
 */
function ArtifactWarningCallout({
  warning,
  theme,
}: {
  warning: string;
  theme: "light" | "dark";
}) {
  const isDark = theme === "dark";
  const box = isDark
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-amber-400 bg-amber-50 text-amber-800";
  const linkClass = isDark
    ? "text-amber-100 underline hover:text-amber-50"
    : "text-amber-900 underline hover:text-amber-700";
  // Pull the first https:// URL out of the warning if present.
  const urlMatch = warning.match(/https?:\/\/[^\s)>"']+/);
  const fullUrl = urlMatch?.[0] ?? null;
  const isGoogleApiConsole =
    !!fullUrl &&
    /console\.(developers|cloud)\.google\.com\/apis\/api\//.test(fullUrl);
  // Strip the URL out of the displayed text so the CTA isn't
  // duplicated as raw text plus button.
  const displayText = fullUrl ? warning.replace(fullUrl, "").trim() : warning;
  return (
    <div className={`mt-2 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug ${box}`}>
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="break-words">{displayText}</div>
          {fullUrl && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${linkClass}`}
            >
              {isGoogleApiConsole ? "Enable API" : "Open link"}{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArtifactCard;
