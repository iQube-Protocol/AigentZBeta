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
import { Loader2, ArrowRight, ExternalLink, FileText, Sparkles, Link2, ChevronDown, PlusCircle, CheckCircle2 } from "lucide-react";

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

export interface ChildIntentSummaryDto {
  intentId: string;
  intentName: string;
  status: string;
}

export interface IntentChainDto {
  events: TimelineEventDto[];
  receipts?: AttachedReceiptDto[];
  chain: AttachedChainDto | null;
  childIntents?: ChildIntentSummaryDto[];
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

// Extract recommendation name from an intent_queued receipt summary.
// "Queued next action: Create visual aids…" → "Create visual aids…"
function extractQueuedName(summary: string): string {
  return summary.replace(/^Queued( next action)?:\s*/i, "").trim();
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
  const { events, receipts = [], chain, childIntents = [] } = data;
  const status = deriveChainStatus(data);

  // Map child intent name → child intent summary so ReceiptRow can find
  // the matching child for each intent_queued receipt.
  const childByName = React.useMemo(() => {
    const m = new Map<string, ChildIntentSummaryDto>();
    for (const c of childIntents) {
      m.set(c.intentName.trim(), c);
    }
    return m;
  }, [childIntents]);

  // Terminal state — resolves from explicit intentStatus prop first,
  // falls back to data.intent.status when the chain endpoint surfaced
  // it, then derives from receipts (session_completed / approval_rejected
  // both lock the capsule). Terminal = all action buttons hide.
  const dataIntent = (data as IntentChainDto & { intent?: { status?: string } }).intent;
  const effectiveStatus = intentStatus ?? dataIntent?.status;
  const derivedTerminal =
    receipts.some((r) => r.actionType === "session_completed") ||
    receipts.some((r) => r.actionType === "approval_rejected");
  const isTerminal =
    effectiveStatus === "completed" ||
    effectiveStatus === "cancelled" ||
    effectiveStatus === "failed" ||
    derivedTerminal;

  // Top-of-capsule action buttons (Approve / Mark complete / Cancel)
  // render only on non-terminal intents. Once terminal, the entire
  // capsule is read-only — no double-approval surface anywhere.
  const canAct = !!intentId && !!onAdvanced && !isTerminal;
  const alreadyApproved = receipts.some((r) => r.actionType === "approval_granted");

  // Build the set of recommendation prefixes that have already been
  // queued as child intents. The intent-queue-next route truncates
  // recommendations at 160 chars (157 + '…') for the receipt summary —
  // store the prefix (minus the ellipsis) so we can prefix-match the
  // rendered recommendation text. Survives chain refetches so the
  // green ✓ Queued state never reverts back to violet.
  const queuedRecommendations = new Set<string>();
  for (const r of receipts) {
    if (r.actionType === "intent_queued" && r.summary) {
      const stripped = r.summary
        .replace(/^Queued( next action)?:\s*/i, "")
        .replace(/…$/, "")
        .trim();
      if (stripped) queuedRecommendations.add(stripped);
    }
  }

  function isRecommendationQueued(rec: string): boolean {
    const cleaned = rec.trim();
    for (const queued of queuedRecommendations) {
      if (cleaned === queued || cleaned.startsWith(queued)) return true;
    }
    return false;
  }

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
            pendingChildren={childIntents.filter(
              (c) => c.status === "awaiting_approval" || c.status === "in_progress",
            )}
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
            // state without forcing every other row to re-render. Threads
            // the parent intentId so each recommendation can spawn a
            // child intent via /api/assistant/intent-queue-next.
            return (
              <ReceiptRow
                key={row.key}
                r={row.receipt!}
                isDark={isDark}
                parentIntentId={intentId}
                isTerminal={isTerminal}
                isRecommendationQueued={isRecommendationQueued}
                childByName={childByName}
                onChildSpawned={onAdvanced}
              />
            );
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

function RecommendationItem({
  recommendation,
  parentIntentId,
  parentSpecialist,
  isDark,
  isTerminal,
  alreadyQueued,
  onSpawned,
}: {
  recommendation: string;
  parentIntentId: string | null;
  parentSpecialist: string | null;
  isDark: boolean;
  isTerminal: boolean;
  alreadyQueued: boolean;
  onSpawned?: () => void;
}) {
  const [state, setState] = React.useState<"idle" | "spawning" | "spawned" | "error">(
    alreadyQueued ? "spawned" : "idle",
  );
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  // Effective spawned = derived-from-chain OR local optimistic state.
  // alreadyQueued comes from the parent's intent_queued receipts so the
  // green ✓ state survives chain refetches that would otherwise reset
  // local component state.
  const effectiveSpawned = alreadyQueued || state === "spawned";
  const canSpawn = !!parentIntentId && !isTerminal && !effectiveSpawned && state !== "spawning";

  // Re-sync local state when alreadyQueued flips true after a refetch
  // (the optimistic "spawned" we set on click is now confirmed by the
  // chain data — keep showing green, don't snap back to idle).
  React.useEffect(() => {
    if (alreadyQueued && state !== "spawned") setState("spawned");
  }, [alreadyQueued, state]);

  const queue = async () => {
    if (!parentIntentId) return;
    setState("spawning");
    setErrMsg(null);
    try {
      const { personaFetch } = await import("@/utils/personaSpine");
      const res = await personaFetch("/api/assistant/intent-queue-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentIntentId,
          recommendation,
          specialist: parentSpecialist ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `queue failed (${res.status})`);
      }
      setState("spawned");
      onSpawned?.();
    } catch (err) {
      setState("error");
      setErrMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <li className="flex items-start gap-1.5">
      <span className={`mt-0.5 text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>•</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          {recommendation}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canSpawn}
            onClick={(e) => {
              e.stopPropagation();
              void queue();
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition disabled:opacity-50 disabled:cursor-not-allowed ${
              effectiveSpawned
                ? isDark
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-emerald-400 bg-emerald-50 text-emerald-700"
                : isDark
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
                  : "border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100"
            }`}
            title={
              !parentIntentId
                ? "Recommendation needs a parent intent to queue under"
                : isTerminal
                  ? "Intent is closed — no further actions"
                  : "Spawn a child intent for this action — appears in Active Intents"
            }
          >
            {state === "spawning" ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : effectiveSpawned ? (
              <CheckCircle2 className="w-2.5 h-2.5" />
            ) : (
              <PlusCircle className="w-2.5 h-2.5" />
            )}
            {effectiveSpawned ? "Queued" : state === "spawning" ? "Queueing…" : "Queue as next action"}
          </button>
          {errMsg && (
            <span className={`text-[10px] ${isDark ? "text-rose-400" : "text-rose-600"}`}>{errMsg}</span>
          )}
        </div>
      </div>
    </li>
  );
}

function ChainActionRow({
  intentId,
  isDark,
  alreadyApproved,
  pendingChildren,
  onAdvanced,
}: {
  intentId: string;
  isDark: boolean;
  alreadyApproved: boolean;
  pendingChildren: ChildIntentSummaryDto[];
  onAdvanced: () => void;
}) {
  const [pending, setPending] = React.useState<"approve" | "approveAll" | "complete" | "cancel" | null>(null);
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

  // Approve all pending child intents in sequence.
  const approveAll = async () => {
    if (pendingChildren.length === 0) return;
    setPending("approveAll");
    setError(null);
    try {
      const { personaFetch } = await import("@/utils/personaSpine");
      for (const child of pendingChildren) {
        const res = await personaFetch("/api/assistant/intent-advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intentId: child.intentId, action: "approve" }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || body?.error || `approve-all failed on child (${res.status})`);
        }
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
  const approveAllBtn = isDark
    ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
    : "border-emerald-500 bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
  const completeBtn = isDark
    ? "border-sky-500/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
    : "border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100";
  const cancelBtn = isDark
    ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
    : "border-rose-400 text-rose-700 hover:bg-rose-50";

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/40 flex flex-wrap items-center gap-1.5">
      {/* Approve All — only when pending children exist */}
      {pendingChildren.length > 0 && (
        <button
          type="button"
          disabled={!!pending}
          onClick={(e) => {
            e.stopPropagation();
            void approveAll();
          }}
          className={`${baseBtn} ${approveAllBtn}`}
          title={`Approve all ${pendingChildren.length} pending action${pendingChildren.length === 1 ? "" : "s"}`}
        >
          {pending === "approveAll" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Approve All ({pendingChildren.length})
        </button>
      )}
      <button
        type="button"
        disabled={!!pending}
        onClick={(e) => {
          e.stopPropagation();
          void fire("approve");
        }}
        className={`${baseBtn} ${approveBtn}`}
        title="Approve this intent (plan approved — individual actions still need per-chip approval)"
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

/**
 * Per-chip Approve / Reject for a CHILD intent spawned from a queued
 * recommendation. Targets the child intentId — independent from the
 * parent intent's approval. Approve → chip turns emerald.
 * Reject → chip turns rose.
 */
function ChildIntentActionRow({
  child,
  isDark,
  onActioned,
}: {
  child: ChildIntentSummaryDto;
  isDark: boolean;
  onActioned?: () => void;
}) {
  const [localStatus, setLocalStatus] = React.useState(child.status);
  const [pending, setPending] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Sync if parent refetches with a new status
  React.useEffect(() => {
    setLocalStatus(child.status);
  }, [child.status]);

  const fire = async (action: "approve" | "cancel") => {
    const uiKey = action === "approve" ? "approve" : "reject";
    setPending(uiKey);
    setError(null);
    try {
      const { personaFetch } = await import("@/utils/personaSpine");
      const res = await personaFetch("/api/assistant/intent-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: child.intentId, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `action failed (${res.status})`);
      }
      setLocalStatus(action === "approve" ? "approved" : "cancelled");
      onActioned?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  // Derive display state from local optimistic status OR child.status
  const isApproved = localStatus === "approved" || localStatus === "completed" || child.status === "completed";
  const isCancelled = localStatus === "cancelled" || child.status === "cancelled";
  const isTerminal = isApproved || isCancelled;

  const baseBtn = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {isApproved && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${
          isDark ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200" : "border-emerald-400 bg-emerald-50 text-emerald-700"
        }`}>
          <CheckCircle2 className="w-2.5 h-2.5" /> Approved
        </span>
      )}
      {isCancelled && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${
          isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-rose-400 bg-rose-50 text-rose-700"
        }`}>
          × Rejected
        </span>
      )}
      {!isTerminal && (
        <>
          <button
            type="button"
            disabled={!!pending}
            onClick={(e) => { e.stopPropagation(); void fire("approve"); }}
            className={`${baseBtn} ${isDark
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              : "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {pending === "approve" ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
            Approve
          </button>
          <button
            type="button"
            disabled={!!pending}
            onClick={(e) => { e.stopPropagation(); void fire("cancel"); }}
            className={`${baseBtn} ${isDark
              ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
              : "border-rose-400 text-rose-700 hover:bg-rose-50"
            }`}
          >
            {pending === "reject" ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
            Reject
          </button>
        </>
      )}
      {error && (
        <span className={`text-[10px] ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</span>
      )}
    </div>
  );
}

/**
 * Approve & complete — lives ON the artifact_created receipt row.
 * Closes the loop the operator follows: open the doc, review it, come
 * back, approve it here, capsule turns fully green. Hits the same
 * /api/assistant/intent-advance(complete) endpoint as the chain-header
 * Mark complete button so receipts + intent status stay in sync.
 */
function ArtifactApproveButton({
  intentId,
  isDark,
  onApproved,
}: {
  intentId: string;
  isDark: boolean;
  onApproved?: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fire = async () => {
    setPending(true);
    setError(null);
    try {
      const { personaFetch } = await import("@/utils/personaSpine");
      const res = await personaFetch("/api/assistant/intent-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId, action: "complete" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `complete failed (${res.status})`);
      }
      onApproved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          void fire();
        }}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] transition disabled:opacity-50 disabled:cursor-not-allowed ${
          isDark
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
            : "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}
        title="Approve this artifact and mark the intent complete"
      >
        {pending ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-2.5 h-2.5" />
        )}
        {pending ? "Approving…" : "Approve & complete"}
      </button>
      {error && (
        <span className={`text-[10px] ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</span>
      )}
    </>
  );
}

function receiptRowColors(actionType: string, isDark: boolean): { border: string; icon: string } {
  switch (actionType) {
    case "specialist_consulted":
      return {
        border: isDark ? "border-cyan-500/30 bg-cyan-950/20" : "border-cyan-300 bg-cyan-50",
        icon: isDark ? "text-cyan-300" : "text-cyan-600",
      };
    case "artifact_created":
    case "artifact_sent":
      return {
        border: isDark ? "border-amber-500/30 bg-amber-950/20" : "border-amber-300 bg-amber-50",
        icon: isDark ? "text-amber-300" : "text-amber-600",
      };
    case "approval_granted":
      return {
        border: isDark ? "border-emerald-500/30 bg-emerald-950/20" : "border-emerald-300 bg-emerald-50",
        icon: isDark ? "text-emerald-300" : "text-emerald-600",
      };
    case "approval_rejected":
      return {
        border: isDark ? "border-rose-500/30 bg-rose-950/20" : "border-rose-300 bg-rose-50",
        icon: isDark ? "text-rose-300" : "text-rose-600",
      };
    case "intent_queued":
      return {
        border: isDark ? "border-violet-500/30 bg-violet-950/20" : "border-violet-300 bg-violet-50",
        icon: isDark ? "text-violet-300" : "text-violet-700",
      };
    case "_child_done":
      return {
        border: isDark ? "border-emerald-500/30 bg-emerald-950/20" : "border-emerald-300 bg-emerald-50",
        icon: isDark ? "text-emerald-300" : "text-emerald-600",
      };
    case "_child_cancelled":
      return {
        border: isDark ? "border-rose-500/20 bg-rose-950/10" : "border-rose-200 bg-rose-50/60",
        icon: isDark ? "text-rose-400" : "text-rose-500",
      };
    case "session_completed":
      return {
        border: isDark ? "border-slate-600/40 bg-slate-800/30" : "border-slate-300 bg-slate-100",
        icon: isDark ? "text-slate-300" : "text-slate-600",
      };
    default:
      return {
        border: isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-slate-50",
        icon: isDark ? "text-violet-300" : "text-violet-700",
      };
  }
}

function ReceiptRow({
  r,
  isDark,
  parentIntentId,
  isTerminal,
  isRecommendationQueued,
  childByName,
  onChildSpawned,
}: {
  r: AttachedReceiptDto;
  isDark: boolean;
  parentIntentId?: string;
  isTerminal: boolean;
  isRecommendationQueued: (rec: string) => boolean;
  childByName?: Map<string, ChildIntentSummaryDto>;
  onChildSpawned?: () => void;
}) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  // Auto-expand specialist responses so recommendations are visible without an extra click.
  const [bodyOpen, setBodyOpen] = React.useState(r.actionType === "specialist_consulted");
  const label = ACTION_LABELS[r.actionType] ?? r.actionType.replace(/_/g, " ");
  const spec = specialistFromReceipt(r);
  const hasBody = !!r.specialistResponse;

  // For intent_queued rows: resolve the matching child intent by name.
  // The receipt summary is "Queued next action: <intentName>"; the child's
  // intentName is that same string (both truncated to 160 chars identically).
  const childIntent = React.useMemo(() => {
    if (r.actionType !== "intent_queued" || !childByName) return undefined;
    const queuedName = extractQueuedName(r.summary);
    // Exact match first; then try prefix (truncation may add '…')
    if (childByName.has(queuedName)) return childByName.get(queuedName);
    for (const [key, val] of childByName) {
      if (queuedName.startsWith(key.replace(/…$/, "")) || key.startsWith(queuedName.replace(/…$/, ""))) {
        return val;
      }
    }
    return undefined;
  }, [r.actionType, r.summary, childByName]);

  // Color intent_queued rows based on child intent status.
  const effectiveActionType =
    r.actionType === "intent_queued" && childIntent
      ? childIntent.status === "completed" || childIntent.status === "approved"
        ? "_child_done"
        : childIntent.status === "cancelled"
        ? "_child_cancelled"
        : "intent_queued"
      : r.actionType;
  const colors = receiptRowColors(effectiveActionType, isDark);

  return (
    <li className={`flex items-start gap-2 text-xs rounded-md border p-2 ${colors.border}`}>
      <Sparkles className={`w-3 h-3 mt-0.5 shrink-0 ${colors.icon}`} />
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
              <ul className="space-y-1">
                {r.specialistResponse.recommendations.map((rec, i) => (
                  <RecommendationItem
                    key={i}
                    recommendation={rec}
                    parentIntentId={parentIntentId ?? null}
                    parentSpecialist={specialistFromReceipt(r)}
                    isDark={isDark}
                    isTerminal={isTerminal}
                    alreadyQueued={isRecommendationQueued(rec)}
                    onSpawned={onChildSpawned}
                  />
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
        {/* Per-chip approve/reject for queued child intents */}
        {r.actionType === "intent_queued" && childIntent && !isTerminal && (
          <ChildIntentActionRow
            child={childIntent}
            isDark={isDark}
            onActioned={onChildSpawned}
          />
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
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
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
            {r.actionType === "artifact_created" && parentIntentId && !isTerminal && (
              <ArtifactApproveButton
                intentId={parentIntentId}
                isDark={isDark}
                onApproved={onChildSpawned}
              />
            )}
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
