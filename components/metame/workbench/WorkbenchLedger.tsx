"use client";

/**
 * WorkbenchLedger — Pills & Artifacts ledger inside myWorkbench.
 *
 * The historical view of every Pill the persona has Acted on (queued
 * and complete) and every artifact they've drafted (linked to a Pill
 * or orphan from the compose strip). Sources its data from
 * /api/assistant/workbench-ledger which combines intent_qubes +
 * activity_receipts.
 *
 * Each card carries:
 *   - state chip (Blue Queued / Green Complete / Amber Awaiting / etc.)
 *   - source chip (Brief / Move forward / Venture / Specialist /
 *     Compose strip when orphan)
 *   - the artifact references (clickable when a Drive/Gmail/Calendar
 *     URL can be inferred from the connector reference)
 *   - created timestamp
 *
 * No re-engagement plumbing yet — clicking an artifact opens the
 * external link in a new tab; the "resume compose" / "open approval"
 * flows that re-thread state back into the aigentMe right pane land
 * in the next pass.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ExternalLink, FileText, Mail, Calendar, Sparkles, CheckCircle2, Check, AlertCircle, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface LedgerArtifact {
  reference: string;
  type: string | null;
  id: string | null;
  receiptId: string;
  recordedAt: string;
  sent: boolean;
}

interface LedgerPill {
  kind: "pill";
  intentId: string;
  intentName: string;
  intentType: string;
  cartridge: string;
  status: "in_progress" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  approvalRequired: boolean;
  createdAt: string;
  agents: string[];
  artifacts: LedgerArtifact[];
}

interface LedgerOrphan {
  kind: "orphan_artifact";
  receiptId: string;
  summary: string;
  cartridge: string;
  createdAt: string;
  artifacts: LedgerArtifact[];
}

type LedgerEntry = LedgerPill | LedgerOrphan;

interface LedgerResponse {
  entries: LedgerEntry[];
  counts: {
    total: number;
    pills: number;
    orphans: number;
    queued: number;
    complete: number;
  };
}

type FilterId = "all" | "queued" | "complete" | "drafts";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

const STATUS_META: Record<
  LedgerPill["status"],
  { label: string; ring: string; icon: React.ComponentType<{ className?: string }> }
> = {
  in_progress: {
    label: "Queued",
    ring: "border-sky-500/60 text-sky-200 bg-sky-500/10",
    icon: Check,
  },
  awaiting_approval: {
    label: "Awaiting approval",
    ring: "border-amber-500/60 text-amber-200 bg-amber-500/10",
    icon: AlertCircle,
  },
  completed: {
    label: "Complete",
    ring: "border-emerald-500/60 text-emerald-200 bg-emerald-500/10",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    ring: "border-rose-500/60 text-rose-200 bg-rose-500/10",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    ring: "border-slate-600 text-slate-400 bg-slate-500/10",
    icon: AlertCircle,
  },
};

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  mvl: "metaMe Venture Lab",
};

const ARTIFACT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "google-doc": FileText,
  "gmail-draft": Mail,
  "calendar-block": Calendar,
  "calendar-invite": Calendar,
  brief: FileText,
  "venture-report": FileText,
  "slide-outline": FileText,
};

/**
 * Best-effort external URL builder from a connector reference. Returns
 * null when the reference is too short to be a real Drive/Gmail id (the
 * title-fallback case). Mirrors the ActivityReceiptCard rule.
 */
function externalUrlFor(art: LedgerArtifact): string | null {
  if (!art.id || art.id.length < 15 || !/^[\w-]+$/.test(art.id)) return null;
  switch (art.type) {
    case "google-doc":
      return `https://docs.google.com/document/d/${art.id}`;
    case "google-sheet":
      return `https://docs.google.com/spreadsheets/d/${art.id}`;
    case "google-slides":
    case "slide-outline":
      return `https://docs.google.com/presentation/d/${art.id}`;
    case "gmail-draft":
      return `https://mail.google.com/mail/u/0/#drafts/${art.id}`;
    case "calendar-block":
    case "calendar-invite":
      return `https://calendar.google.com/calendar/u/0/r/eventedit/${art.id}`;
    default:
      return null;
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

interface TimelineEventDto {
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

interface AttachedChainDto {
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

interface IntentChainDto {
  events: TimelineEventDto[];
  chain: AttachedChainDto | null;
}

type ChainCache = Record<string, { loading: boolean; error: string | null; data: IntentChainDto | null }>;

export function WorkbenchLedger({ personaId, theme = "dark" }: Props) {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [chainCache, setChainCache] = useState<ChainCache>({});

  const toggleExpanded = useCallback(
    (intentId: string, hint?: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(intentId)) {
          next.delete(intentId);
        } else {
          next.add(intentId);
        }
        return next;
      });
      // Lazy fetch on first expand. The hint silences a TS unused-arg
      // warning when callers omit it.
      void hint;
      setChainCache((prev) => {
        if (prev[intentId]?.data || prev[intentId]?.loading) return prev;
        return { ...prev, [intentId]: { loading: true, error: null, data: null } };
      });
    },
    [],
  );

  useEffect(() => {
    const pending = Object.entries(chainCache).filter(
      ([, v]) => v.loading && !v.data && !v.error,
    );
    if (pending.length === 0) return;
    let cancelled = false;
    pending.forEach(async ([intentId]) => {
      try {
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
        setChainCache((prev) => ({
          ...prev,
          [intentId]: { loading: false, error: null, data: json },
        }));
      } catch (err) {
        if (cancelled) return;
        setChainCache((prev) => ({
          ...prev,
          [intentId]: { loading: false, error: err instanceof Error ? err.message : String(err), data: null },
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chainCache, personaId]);

  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const cardClass = isDark
    ? "border-slate-700/60 bg-slate-900/40"
    : "border-slate-200 bg-white";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await personaFetch("/api/assistant/workbench-ledger?limit=50", {
          personaIdHint: personaId,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || body?.error || `ledger fetch failed (${res.status})`);
        }
        const json = (await res.json()) as LedgerResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  const filteredEntries = useMemo<LedgerEntry[]>(() => {
    if (!data) return [];
    if (filter === "all") return data.entries;
    if (filter === "drafts") {
      // Drafts = orphan artifacts whose nothing has been sent yet. A
      // sent orphan reads as Complete (green), not Draft.
      return data.entries.filter(
        (e) => e.kind === "orphan_artifact" && !e.artifacts.some((a) => a.sent),
      );
    }
    if (filter === "queued") {
      return data.entries.filter(
        (e) =>
          e.kind === "pill" && (e.status === "in_progress" || e.status === "awaiting_approval"),
      );
    }
    if (filter === "complete") {
      return data.entries.filter((e) => {
        if (e.kind === "pill") return e.status === "completed";
        // Sent orphan → also "Complete".
        return e.artifacts.some((a) => a.sent);
      });
    }
    return data.entries;
  }, [data, filter]);

  return (
    <section className={`rounded-lg border p-5 ${surfaceClass}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className={`w-4 h-4 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              Pills &amp; artifacts
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-tight">Work ledger</h3>
          <p className={`text-sm mt-1 ${mutedClass}`}>
            Every CTA you&rsquo;ve acted on and every artifact drafted, across every Capsule. Re-open from here.
          </p>
        </div>
        {data && (
          <div className={`text-[11px] text-right ${mutedClass}`}>
            <div>
              <span className="font-mono text-sky-300">{data.counts.queued}</span> queued
            </div>
            <div>
              <span className="font-mono text-emerald-300">{data.counts.complete}</span> complete
            </div>
            <div>
              <span className="font-mono text-slate-300">{data.counts.orphans}</span> drafts
            </div>
          </div>
        )}
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {(["all", "queued", "complete", "drafts"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full border text-[11px] uppercase tracking-wider transition ${
              filter === f
                ? isDark
                  ? "border-violet-500/60 bg-violet-500/10 text-violet-100"
                  : "border-violet-400 bg-violet-50 text-violet-800"
                : isDark
                  ? "border-slate-700 text-slate-400 hover:border-slate-500"
                  : "border-slate-300 text-slate-600 hover:border-slate-500"
            }`}
          >
            {f === "all" ? "All" : f === "queued" ? "Queued" : f === "complete" ? "Complete" : "Drafts"}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`flex items-center gap-2 text-sm ${mutedClass}`}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading work ledger…
        </div>
      )}
      {error && !loading && (
        <p className={`text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>
      )}
      {!loading && !error && filteredEntries.length === 0 && (
        <p className={`text-sm ${mutedClass}`}>
          Nothing yet for this filter. Engage a Capsule from the aigentMe tab to populate the ledger.
        </p>
      )}

      <div className="space-y-2">
        {filteredEntries.map((entry) => {
          if (entry.kind === "pill") {
            const meta = STATUS_META[entry.status];
            const StatusIcon = meta.icon;
            const isOpen = expanded.has(entry.intentId);
            const chainState = chainCache[entry.intentId];
            return (
              <article key={entry.intentId} className={`rounded-lg border ${cardClass} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(entry.intentId)}
                  aria-expanded={isOpen}
                  className={`w-full text-left p-3 space-y-2 transition ${
                    isDark ? "hover:bg-slate-900/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${meta.ring}`}>
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                          {CARTRIDGE_LABELS[entry.cartridge] ?? entry.cartridge}
                        </span>
                        {entry.approvalRequired && entry.status !== "completed" && (
                          <span className="text-[10px] uppercase tracking-wider text-amber-300/80">
                            · external action
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                        {isOpen ? (
                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${mutedClass}`} />
                        ) : (
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${mutedClass}`} />
                        )}
                        <span className="truncate">{entry.intentName}</span>
                      </h4>
                      {entry.agents.length > 0 && (
                        <p className={`text-[11px] mt-1 pl-5 ${mutedClass}`}>
                          with {entry.agents.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className={`text-[11px] shrink-0 ${mutedClass}`} title={entry.createdAt}>
                      {formatTimeAgo(entry.createdAt)}
                    </span>
                  </div>
                  {entry.artifacts.length > 0 && (
                    <ArtifactList artifacts={entry.artifacts} isDark={isDark} mutedClass={mutedClass} />
                  )}
                </button>
                {isOpen && (
                  <IntentChainPanel
                    chainState={chainState}
                    isDark={isDark}
                    mutedClass={mutedClass}
                  />
                )}
              </article>
            );
          }
          // Orphan artifact entry — compose-strip draft with no parent
          // Pill. Promote to "complete" (green) when at least one of
          // its artifacts has been sent / published; otherwise show
          // as a slate "Draft" chip. Mirrors the nested-CTA semantic
          // so the ledger reads consistently.
          const orphanComplete = entry.artifacts.some((a) => a.sent);
          const chipClass = orphanComplete
            ? "border-emerald-500/60 text-emerald-200 bg-emerald-500/10"
            : isDark
              ? "border-slate-600 text-slate-300 bg-slate-500/10"
              : "border-slate-300 text-slate-700 bg-slate-100";
          const ChipIcon = orphanComplete ? CheckCircle2 : null;
          return (
            <article key={entry.receiptId} className={`rounded-lg border p-3 ${cardClass} space-y-2`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${chipClass}`}>
                      {ChipIcon ? <ChipIcon className="w-3 h-3" /> : null}
                      {orphanComplete ? "Complete" : "Draft"}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                      Compose strip · {CARTRIDGE_LABELS[entry.cartridge] ?? entry.cartridge}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">{entry.summary}</p>
                </div>
                <span className={`text-[11px] shrink-0 ${mutedClass}`} title={entry.createdAt}>
                  {formatTimeAgo(entry.createdAt)}
                </span>
              </div>
              {entry.artifacts.length > 0 && (
                <ArtifactList artifacts={entry.artifacts} isDark={isDark} mutedClass={mutedClass} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArtifactList({
  artifacts,
  isDark,
  mutedClass,
}: {
  artifacts: LedgerArtifact[];
  isDark: boolean;
  mutedClass: string;
}) {
  return (
    <ul className="space-y-1">
      {artifacts.map((art) => {
        const Icon = (art.type && ARTIFACT_ICON_MAP[art.type]) ?? FileText;
        const href = externalUrlFor(art);
        const typeLabel = art.type ?? "artifact";
        const sentLabel = art.sent ? "sent" : "drafted";
        return (
          <li key={`${art.receiptId}-${art.reference}`} className="flex items-center gap-2 text-xs">
            <Icon className={`w-3.5 h-3.5 ${mutedClass}`} />
            <span className={`uppercase tracking-wider ${mutedClass}`}>{typeLabel}</span>
            <span className={mutedClass}>·</span>
            <span className={mutedClass}>{sentLabel}</span>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 underline ${isDark ? "text-sky-300 hover:text-sky-200" : "text-sky-700 hover:text-sky-900"}`}
              >
                open <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Friendly labels for orchestration_events.event_type values surfaced
 * in the timeline. Anything not listed falls back to the raw type.
 */
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

function IntentChainPanel({
  chainState,
  isDark,
  mutedClass,
}: {
  chainState: { loading: boolean; error: string | null; data: IntentChainDto | null } | undefined;
  isDark: boolean;
  mutedClass: string;
}) {
  const borderClass = isDark ? "border-slate-700/60 bg-slate-950/40" : "border-slate-200 bg-slate-50";
  return (
    <div className={`border-t ${borderClass} px-3 py-3`}>
      {(!chainState || chainState.loading) && (
        <div className={`flex items-center gap-2 text-xs ${mutedClass}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading chain of intent…
        </div>
      )}
      {chainState?.error && !chainState.loading && (
        <p className={`text-xs ${isDark ? "text-rose-400" : "text-rose-600"}`}>{chainState.error}</p>
      )}
      {chainState?.data && !chainState.loading && (
        <ChainTimeline data={chainState.data} isDark={isDark} mutedClass={mutedClass} />
      )}
    </div>
  );
}

function ChainTimeline({
  data,
  isDark,
  mutedClass,
}: {
  data: IntentChainDto;
  isDark: boolean;
  mutedClass: string;
}) {
  const { events, chain } = data;
  return (
    <div className="space-y-2.5">
      {chain && (
        <div className={`text-[11px] flex flex-wrap items-center gap-1.5 ${mutedClass}`}>
          <span className="uppercase tracking-wider">Chain</span>
          <span className={isDark ? "text-violet-300" : "text-violet-700"}>{chain.templateId}</span>
          {typeof chain.totalSteps === "number" && typeof chain.currentStepIndex === "number" && (
            <span>
              · step {chain.currentStepIndex + 1}/{chain.totalSteps}
            </span>
          )}
          <span>· {chain.status}</span>
          {typeof chain.costQc === "number" && chain.costQc > 0 && (
            <span>· ${(chain.costQc / 100).toFixed(2)}</span>
          )}
        </div>
      )}
      {events.length === 0 ? (
        <p className={`text-xs ${mutedClass}`}>No orchestration events recorded yet for this intent.</p>
      ) : (
        <ol className="space-y-1.5">
          {events.map((evt) => {
            const label = EVENT_LABELS[evt.eventType] ?? evt.eventType.replace(/_/g, " ");
            const spec = specialistLabel(evt.metadata);
            const reason =
              typeof evt.reason === "string" && evt.reason.length > 0 ? evt.reason : null;
            return (
              <li key={evt.eventId} className="flex items-start gap-2 text-xs">
                <ArrowRight className={`w-3 h-3 mt-0.5 shrink-0 ${mutedClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      {label}
                    </span>
                    {spec ? (
                      <span className={mutedClass}>
                        · {roleLabel(evt.fromRole)} → {spec}
                      </span>
                    ) : (
                      <span className={mutedClass}>
                        · {roleLabel(evt.fromRole)} → {roleLabel(evt.toRole)}
                      </span>
                    )}
                    {evt.receiptEligible && (
                      <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-emerald-300/80" : "text-emerald-700/80"}`}>
                        · receipt
                      </span>
                    )}
                  </div>
                  {reason && (
                    <p className={`text-[11px] mt-0.5 truncate ${mutedClass}`} title={reason}>
                      {reason}
                    </p>
                  )}
                  <p className={`text-[10px] ${mutedClass}`} title={evt.recordedAt}>
                    {formatTimeAgo(evt.recordedAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default WorkbenchLedger;
