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
import { Loader2, ArrowRight } from "lucide-react";

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

export interface IntentChainDto {
  events: TimelineEventDto[];
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

export function IntentChainPanel({
  chainState,
  isDark = true,
}: {
  chainState: ChainCacheEntry | undefined;
  isDark?: boolean;
}) {
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
        <ChainTimeline data={chainState.data} isDark={isDark} />
      )}
    </div>
  );
}

function ChainTimeline({ data, isDark }: { data: IntentChainDto; isDark: boolean }) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
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
        <p className={`text-xs ${mutedClass}`}>
          No orchestration events recorded yet for this intent.
        </p>
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
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          isDark ? "text-emerald-300/80" : "text-emerald-700/80"
                        }`}
                      >
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

  return { cache, requestChain };
}
