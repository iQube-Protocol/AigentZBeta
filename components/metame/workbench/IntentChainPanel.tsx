"use client";

/**
 * IntentChainPanel — shared inline expander for the chain-of-intent
 * timeline. Mounted under expandable pill rows on both the Workbench
 * ledger (myWorkbench) and the Active intents list (myWorkspace).
 *
 * Fetches /api/assistant/intent-chain?intentId=... on first expand and
 * renders the orchestration_events timeline (specialist_invoked etc.)
 * plus the attached intent_chains row when present.
 *
 * Owned by myWorkbench module because the contract was authored
 * alongside the workbench ledger; importable from anywhere.
 */

import React from "react";
import { Loader2, ArrowRight, ExternalLink, FileText, Sparkles, Link2, ChevronDown } from "lucide-react";

export interface TimelineEventDto {
  eventId: string;
  eventType: string;
  fromRole: string;
  toRole: string;
  reason: string;
  cartridge: string | null;
  receiptEligible: boolean;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export interface AttachedChainDto {
  chainId: string;
  templateId: string;
  templateVersion: number | null;
  status: string;
  currentStepId: string | null;
  currentStepIndex: number | null;
  totalSteps: number | null;
  costQc: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AttachedSpecialistResponseDto {
  title: string;
  summary: string;
  recommendations: string[];
  suggestedArtifacts: string[];
  confidence: "low" | "medium" | "high";
  source: "llm" | "template";
}

export interface AttachedReceiptDto {
  receiptId: string;
  actionType: string;
  summary: string;
  agentsInvoked: string[];
  toolsUsed: string[];
  artifactsCreated: string[];
  receiptStatus: string;
  specialistResponse?: AttachedSpecialistResponseDto | null;
  createdAt: string;
}

export interface IntentChainDto {
  events: TimelineEventDto[];
  receipts?: AttachedReceiptDto[];
  chain: AttachedChainDto | null;
}

export interface ChainCacheEntry {
  loading: boolean;
  error: string | null;
  data: IntentChainDto | null;
}

const EVENT_LABELS: Record<string, string> = {
  specialist_invoked: "Specialist invoked",
  z_delegated: "Aigent Z delegated",
  c_took_control: "Aigent C took control",
  control_returned_to_metame: "Returned to metaMe",
  intent_chain_started: "Chain started",
  intent_chain_step_dispatched: "Step dispatched",
  intent_chain_step_completed: "Step completed",
  intent_chain_step_user_pending: "Awaiting your input",
  intent_chain_step_failed: "Step failed",
  intent_chain_completed: "Chain complete",
  intent_chain_failed: "Chain failed",
  intent_chain_cancelled: "Chain cancelled",
  intent_chain_charge_committed: "Q¢ debit committed",
  intent_chain_charge_refunded: "Q¢ refunded",
  proposal_drafted: "Proposal drafted",
  proposal_redrafted: "Proposal redrafted",
  artifact_sent: "Artifact sent",
  policy_blocked: "Policy blocked",
  guardian_intervened: "Guardian intervened",
};

function roleLabel(role: string): string {
  switch (role) {
    case "aigent-z":
      return "Aigent Z";
    case "aigent-c":
      return "Aigent C";
    case "metame-guardian":
      return "metaMe";
    case "guide-agent":
      return "Specialist";
    case "cartridge-lead":
      return "Cartridge lead";
    case "specialist":
      return "Specialist";
    default:
      return role || "—";
  }
}

function specialistLabel(meta: Record<string, unknown>): string | null {
  const s = meta?.specialist;
  if (typeof s !== "string") return null;
  switch (s) {
    case "marketa":
      return "Marketa";
    case "kn0w1":
      return "Know1";
    case "quill":
      return "Quill";
    case "aigent-me":
      return "Aigent Me";
    case "aigent-z":
      return "Aigent Z";
    case "aigent-c":
      return "Aigent C";
    default:
      return s;
  }
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export interface IntentChainPanelProps {
  chainState: ChainCacheEntry | undefined;
  isDark?: boolean;
  /**
   * When provided, the chain header renders Approve / Mark complete /
   * Cancel buttons that POST /api/assistant/intent-advance and call
   * onAdvanced() so the caller can refresh the panel. Omit to render
   * read-only (e.g. inside ActivityReceiptCard where the receipt
   * itself owns the action surface).
   */
  intentId?: string;
  intentStatus?: string;
  onAdvanced?: () => void;
}

export function IntentChainPanel({
  chainState,
  isDark = true,
  intentId,
  intentStatus,
  onAdvanced,
}: IntentChainPanelProps) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const surfaceClass = isDark ? "border-slate-700/60 bg-slate-950/40" : "border-slate-200 bg-slate-50";
  return (
    <div className={`border-t ${surfaceClass} px-3 py-3`}>
      {(!chainState || chainState.loading) && (
        <div className={`flex items-center gap-2 text-xs ${mutedClass}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading chain of intent…
        </div>
      )}
      {chainState?.error && !chainState.loading && (
        <p className={`text-xs ${isDark ? "text-rose-400" : "text-rose-600"}`}>{chainState.error}</p>
      )}
      {chainState?.data && !chainState.loading && (
        <ChainTimeline
          data={chainState.data}
          isDark={isDark}
          intentId={intentId}
          intentStatus={intentStatus}
          onAdvanced={onAdvanced}
        />
      )}
    </div>
  );
}

// Friendly action_type → label for activity_receipts.
const ACTION_LABELS: Record<string, string> = {
  intent_queued: "Intent queued",
  specialist_consulted: "Specialist consulted",
  artifact_created: "Artifact created",
  artifact_sent: "Artifact sent",
  approval_granted: "Approval granted",
  approval_rejected: "Approval rejected",
  experience_model_updated: "ExperienceModel updated",
};

// Per-type Drive/Gmail/Calendar URL builders for artifact entries
// (mirrors ActivityReceiptCard.ARTIFACT_URL_BUILDERS).
const ARTIFACT_URL_BUILDERS: Record<string, (id: string) => string> = {
  "google-doc":     (id) => `https://docs.google.com/document/d/${id}/edit`,
  "google-sheet":   (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`,
  "google-slides":  (id) => `https://docs.google.com/presentation/d/${id}/edit`,
  "slide-outline":  (id) => `https://docs.google.com/presentation/d/${id}/edit`,
  "gmail-draft":    (id) => `https://mail.google.com/mail/u/0/#drafts/${id}`,
  "calendar-block": (id) => `https://calendar.google.com/calendar/u/0/r/eventedit/${id}`,
};

function buildArtifactUrl(entry: string): { type: string; label: string; url: string | null } {
  const colon = entry.indexOf(":");
  if (colon === -1) return { type: "", label: entry, url: null };
  const type = entry.slice(0, colon);
  const id = entry.slice(colon + 1);
  const builder = ARTIFACT_URL_BUILDERS[type];
  if (!builder || !id || id.length < 15 || !/^[\w-]+$/.test(id)) {
    return { type, label: entry, url: null };
  }
  const friendly: Record<string, string> = {
    "google-doc": "Open Doc",
    "google-sheet": "Open Sheet",
    "google-slides": "Open Slides",
    "slide-outline": "Open Slides",
    "gmail-draft": "Open Draft",
    "calendar-block": "Open Event",
  };
  return { type, label: friendly[type] ?? "Open", url: builder(id) };
}

interface UnifiedRow {
  key: string;
  recordedAt: string;
  kind: "event" | "receipt";
  event?: TimelineEventDto;
  receipt?: AttachedReceiptDto;
}

function specialistFromReceipt(r: AttachedReceiptDto): string | null {
  const known = ["marketa", "quill", "kn0w1", "aigent-z", "aigent-c", "aigent-me", "moneypenny", "metaye"];
  return r.agentsInvoked.find((a) => known.includes(a) && a !== "aigent-me") ?? null;
}

function deriveChainStatus(data: IntentChainDto): {
  badgeLabel: string;
  badgeClass: string;
  flow: string | null;
} {
  const { chain, receipts = [], events } = data;
  // Chain attached — use its declared status.
  if (chain) {
    const flow = `${chain.templateId}${
      typeof chain.totalSteps === "number" && typeof chain.currentStepIndex === "number"
        ? ` · step ${chain.currentStepIndex + 1}/${chain.totalSteps}`
        : ""
    }`;
    return { badgeLabel: chain.status, badgeClass: "border-violet-500/60 text-violet-200 bg-violet-500/10", flow };
  }
  // No chain — derive a pseudo-chain status from receipts + events.
  const hasArtifactSent = receipts.some((r) => r.actionType === "artifact_sent");
  const hasArtifact = receipts.some((r) => r.actionType === "artifact_created" || r.artifactsCreated.length > 0);
  const hasConsultation = receipts.some((r) => r.actionType === "specialist_consulted");
  const hasInvoke = events.some((e) => e.eventType === "specialist_invoked");
  if (hasArtifactSent) return { badgeLabel: "delivered", badgeClass: "border-emerald-500/60 text-emerald-200 bg-emerald-500/10", flow: null };
  if (hasArtifact)
    return {
      badgeLabel: "draft ready",
      badgeClass: "border-sky-500/60 text-sky-200 bg-sky-500/10",
      flow: hasConsultation ? "Specialist drafted — awaiting your review" : null,
    };
  if (hasConsultation)
    return {
      badgeLabel: "consulted",
      badgeClass: "border-sky-500/60 text-sky-200 bg-sky-500/10",
      flow: "Specialist consulted — output recorded in this intent",
    };
  if (hasInvoke)
    return {
      badgeLabel: "invoked",
      badgeClass: "border-amber-500/60 text-amber-200 bg-amber-500/10",
      flow: "Specialist invoked — awaiting response",
    };
  return { badgeLabel: "queued", badgeClass: "border-slate-600 text-slate-300 bg-slate-500/10", flow: null };
}

function ChainTimeline({
  data,
  isDark,
  intentId,
  intentStatus,
  onAdvanced,
}: {
  data: IntentChainDto;
  isDark: boolean;
  intentId?: string;
  intentStatus?: string;
  onAdvanced?: () => void;
}) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const { events, receipts = [], chain } = data;
  const status = deriveChainStatus(data);

  // Action buttons render when the caller has provided intentId +
  // onAdvanced. Hide once the intent is terminated so the operator
  // doesn't try to re-advance a completed/cancelled row.
  const canAct =
    !!intentId && !!onAdvanced && intentStatus !== "completed" && intentStatus !== "cancelled";
  // Whether an approval_granted receipt is already present — when so,
  // the Approve button reads "Re-approve" so the operator can still
  // record a fresh approval if needed but the primary CTA shifts to
  // Mark complete.
  const alreadyApproved = receipts.some((r) => r.actionType === "approval_granted");

  // Merge orchestration events + activity receipts into one chronological
  // timeline. Receipts carry the human-readable consultation summary +
  // artifact references; events carry the spine attribution.
  const merged: UnifiedRow[] = [
    ...events.map<UnifiedRow>((e) => ({ key: `e:${e.eventId}`, recordedAt: e.recordedAt, kind: "event", event: e })),
    ...receipts.map<UnifiedRow>((r) => ({ key: `r:${r.receiptId}`, recordedAt: r.createdAt, kind: "receipt", receipt: r })),
  ].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));

  return (
    <div className="space-y-3">
      {/* Chain identity header — always present so the operator can see
          the chain status even when no intent_chains row exists. */}
      <div className={`rounded-md border px-2.5 py-2 ${isDark ? "border-slate-700/60 bg-slate-900/60" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Link2 className={`w-3 h-3 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
          <span className={`uppercase tracking-wider ${mutedClass}`}>Chain of intent</span>
          <span className={`px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${status.badgeClass}`}>
            {status.badgeLabel}
          </span>
          {chain ? (
            <span className={isDark ? "text-violet-300" : "text-violet-700"}>{status.flow}</span>
          ) : status.flow ? (
            <span className={mutedClass}>· {status.flow}</span>
          ) : null}
          {chain && typeof chain.costQc === "number" && chain.costQc > 0 && (
            <span className={mutedClass}>· ${(chain.costQc / 100).toFixed(2)}</span>
          )}
          {intentStatus && (
            <span className={`ml-auto text-[10px] uppercase tracking-wider ${mutedClass}`}>
              intent: {intentStatus.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {canAct && (
          <ChainActionRow
            intentId={intentId!}
            isDark={isDark}
            alreadyApproved={alreadyApproved}
            onAdvanced={onAdvanced!}
          />
        )}
      </div>

      {merged.length === 0 ? (
        <p className={`text-xs ${mutedClass}`}>
          No orchestration events or receipts recorded yet for this intent.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {merged.map((row) => {
            if (row.kind === "event" && row.event) {
              const evt = row.event;
              const label = EVENT_LABELS[evt.eventType] ?? evt.eventType.replace(/_/g, " ");
              const spec = specialistLabel(evt.metadata);
              const reason = evt.reason && evt.reason.length > 0 ? evt.reason : null;
              return (
                <li key={row.key} className="flex items-start gap-2 text-xs">
                  <ArrowRight className={`w-3 h-3 mt-0.5 shrink-0 ${mutedClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        {label}
                      </span>
                      {spec ? (
                        <span className={mutedClass}>· {roleLabel(evt.fromRole)} → {spec}</span>
                      ) : (
                        <span className={mutedClass}>· {roleLabel(evt.fromRole)} → {roleLabel(evt.toRole)}</span>
                      )}
                      {evt.receiptEligible && (
                        <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-emerald-300/80" : "text-emerald-700/80"}`}>· receipt</span>
                      )}
                    </div>
                    {reason && (
                      <p className={`text-[11px] mt-0.5 truncate ${mutedClass}`} title={reason}>{reason}</p>
                    )}
                    <p className={`text-[10px] ${mutedClass}`} title={evt.recordedAt}>{formatTimeAgo(evt.recordedAt)}</p>
                  </div>
                </li>
              );
            }
            // Receipt row — own component so it can hold the body-expand
            // state without forcing every other row to re-render.
            return <ReceiptRow key={row.key} r={row.receipt!} isDark={isDark} />;
          })}
        </ol>
      )}
    </div>
  );
}

function specialistDisplay(s: string): string {
  switch (s) {
    case "marketa": return "Marketa";
    case "kn0w1": return "Know1";
    case "quill": return "Quill";
    case "moneypenny": return "Moneypenny";
    case "metaye": return "metaye";
    default: return s;
  }
}

function ChainActionRow({
  intentId,
  isDark,
  alreadyApproved,
  onAdvanced,
}: {
  intentId: string;
  isDark: boolean;
  alreadyApproved: boolean;
  onAdvanced: () => void;
}) {
  const [pending, setPending] = React.useState<"approve" | "complete" | "cancel" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fire = async (action: "approve" | "complete" | "cancel") => {
    setPending(action);
    setError(null);
    try {
      const { personaFetch } = await import("@/utils/personaSpine");
      const res = await personaFetch("/api/assistant/intent-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `advance failed (${res.status})`);
      }
      onAdvanced();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  const baseBtn = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition disabled:opacity-50 disabled:cursor-not-allowed";
  const approveBtn = isDark
    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
    : "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  const completeBtn = isDark
    ? "border-sky-500/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
    : "border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100";
  const cancelBtn = isDark
    ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
    : "border-rose-400 text-rose-700 hover:bg-rose-50";

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/40 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={!!pending}
        onClick={(e) => {
          e.stopPropagation();
          void fire("approve");
        }}
        className={`${baseBtn} ${approveBtn}`}
      >
        {pending === "approve" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {alreadyApproved ? "Re-approve" : "Approve"}
      </button>
      <button
        type="button"
        disabled={!!pending}
        onClick={(e) => {
          e.stopPropagation();
          void fire("complete");
        }}
        className={`${baseBtn} ${completeBtn}`}
      >
        {pending === "complete" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Mark complete
      </button>
      <button
        type="button"
        disabled={!!pending}
        onClick={(e) => {
          e.stopPropagation();
          void fire("cancel");
        }}
        className={`${baseBtn} ${cancelBtn}`}
      >
        {pending === "cancel" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Cancel
      </button>
      {error && (
        <span className={`text-[10px] ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</span>
      )}
    </div>
  );
}

function ReceiptRow({ r, isDark }: { r: AttachedReceiptDto; isDark: boolean }) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const [bodyOpen, setBodyOpen] = React.useState(false);
  const label = ACTION_LABELS[r.actionType] ?? r.actionType.replace(/_/g, " ");
  const spec = specialistFromReceipt(r);
  const hasBody = !!r.specialistResponse;

  return (
    <li className={`flex items-start gap-2 text-xs rounded-md border p-2 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-slate-50"}`}>
      <Sparkles className={`w-3 h-3 mt-0.5 shrink-0 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>{label}</span>
          {spec && (
            <span className={mutedClass}>· Aigent Z → {specialistDisplay(spec)}</span>
          )}
          <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-emerald-300/80" : "text-emerald-700/80"}`}>· receipt</span>
          {r.specialistResponse?.source && (
            <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
              · {r.specialistResponse.source}
            </span>
          )}
          {r.specialistResponse?.confidence && (
            <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
              · {r.specialistResponse.confidence} confidence
            </span>
          )}
        </div>
        {r.summary && (
          <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            {r.summary}
          </p>
        )}
        {hasBody && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBodyOpen((v) => !v);
            }}
            className={`mt-1.5 inline-flex items-center gap-1 text-[11px] underline ${
              isDark ? "text-violet-300 hover:text-violet-200" : "text-violet-700 hover:text-violet-900"
            }`}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${bodyOpen ? "rotate-180" : ""}`} />
            {bodyOpen ? "Hide specialist response" : "Show specialist response"}
          </button>
        )}
        {bodyOpen && r.specialistResponse && (
          <div className={`mt-1.5 rounded-md border p-2 space-y-1.5 ${isDark ? "border-slate-700/60 bg-slate-950/40" : "border-slate-200 bg-white"}`}>
            <p className={`text-[11px] leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
              {r.specialistResponse.summary}
            </p>
            {r.specialistResponse.recommendations.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5">
                {r.specialistResponse.recommendations.map((rec, i) => (
                  <li key={i} className={`text-[11px] leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    {rec}
                  </li>
                ))}
              </ul>
            )}
            {r.specialistResponse.suggestedArtifacts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>Suggested</span>
                {r.specialistResponse.suggestedArtifacts.map((a, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 rounded border text-[10px] ${
                      isDark
                        ? "border-slate-700 bg-slate-800/60 text-slate-300"
                        : "border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {r.artifactsCreated.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <FileText className={`w-3 h-3 ${mutedClass}`} />
            {r.artifactsCreated.map((entry) => {
              const { url, label: lbl } = buildArtifactUrl(entry);
              if (url) {
                return (
                  <a
                    key={entry}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${
                      isDark
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
                        : "border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100"
                    }`}
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> {lbl}
                  </a>
                );
              }
              return (
                <span
                  key={entry}
                  className={`px-1.5 py-0.5 rounded border text-[10px] ${
                    isDark ? "border-slate-700 bg-slate-800/60 text-slate-300" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {entry}
                </span>
              );
            })}
          </div>
        )}
        <p className={`text-[10px] mt-1 ${mutedClass}`} title={r.createdAt}>{formatTimeAgo(r.createdAt)}</p>
      </div>
    </li>
  );
}

/**
 * Shared hook: lazy-fetches the intent-chain payload on demand and
 * caches it keyed by intentId. Mirror the workbench-ledger pattern.
 */
export function useIntentChainCache(personaId?: string) {
  const [cache, setCache] = React.useState<Record<string, ChainCacheEntry>>({});

  React.useEffect(() => {
    const pending = Object.entries(cache).filter(
      ([, v]) => v.loading && !v.data && !v.error,
    );
    if (pending.length === 0) return;
    let cancelled = false;
    pending.forEach(async ([intentId]) => {
      try {
        const { personaFetch } = await import("@/utils/personaSpine");
        const res = await personaFetch(
          `/api/assistant/intent-chain?intentId=${encodeURIComponent(intentId)}`,
          { personaIdHint: personaId },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || body?.error || `chain fetch failed (${res.status})`);
        }
        const json = (await res.json()) as IntentChainDto;
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [intentId]: { loading: false, error: null, data: json } }));
      } catch (err) {
        if (cancelled) return;
        setCache((prev) => ({
          ...prev,
          [intentId]: {
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            data: null,
          },
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cache, personaId]);

  const requestChain = React.useCallback((intentId: string) => {
    setCache((prev) => {
      if (prev[intentId]?.data || prev[intentId]?.loading) return prev;
      return { ...prev, [intentId]: { loading: true, error: null, data: null } };
    });
  }, []);

  /**
   * Force a re-fetch after an operator action (Approve / Mark complete /
   * Cancel) so the chain header status badge re-derives without a full
   * panel close+open dance.
   */
  const invalidate = React.useCallback((intentId: string) => {
    setCache((prev) => ({
      ...prev,
      [intentId]: { loading: true, error: null, data: null },
    }));
  }, []);

  return { cache, requestChain, invalidate };
}
