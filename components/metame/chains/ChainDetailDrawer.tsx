"use client";

/**
 * ChainDetailDrawer — chain step history + feedback footer.
 *
 * Spec §8 (UI contract) + §6.7 (feedback loop).
 *
 * Opens via the ExpandedNBEPill chain breadcrumb (commit 8) or the
 * MyWorkspaceTab clickable intent cards (commit 9). Displays:
 *   - Chain status badge (Active / Waiting / Completed / Failed / Cancelled)
 *   - Step list with per-step status + outcome + receipt anchor link
 *   - Feedback footer on terminated chains (like single-click /
 *     dislike expands a comment textarea)
 *   - Operator-facing "Cancel chain" button for active/waiting chains
 */

import React, { useCallback, useEffect, useState } from "react";
import { X, Loader2, ThumbsUp, ThumbsDown, CheckCircle2, Circle, AlertTriangle, Pause, Clock, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ChainView {
  chain_id: string;
  template_id: string;
  template_version: string;
  initiating_nbe_id: string | null;
  cartridge: string | null;
  status: "active" | "waiting" | "completed" | "failed" | "cancelled";
  current_step_id: string | null;
  current_step_kind: string | null;
  cost_qc: number;
  charge_status: "none" | "committed" | "refunded";
  started_at: string;
  terminated_at: string | null;
  termination_outcome: string | null;
}

interface HistoryRow {
  event_id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown>;
  receipt_eligible: boolean;
}

interface FeedbackRow {
  feedback_id: string;
  rating: "like" | "dislike";
  comment: string | null;
  rated_at: string;
  receipt_event_id?: string | null;
}

export interface ChainDetailDrawerProps {
  open: boolean;
  chain_id: string | null;
  onClose: () => void;
  onCancelled?: (chain_id: string) => void;
  /** Optional persona id hint for personaFetch. */
  personaId?: string;
  theme?: "light" | "dark";
}

function statusBadge(status: ChainView["status"]) {
  switch (status) {
    case "active":
      return { label: "Active", cls: "bg-indigo-500/20 text-indigo-200 ring-indigo-500/40", Icon: Loader2, spin: true };
    case "waiting":
      return { label: "Waiting", cls: "bg-amber-500/20 text-amber-200 ring-amber-500/40", Icon: Pause };
    case "completed":
      return { label: "Completed", cls: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40", Icon: CheckCircle2 };
    case "failed":
      return { label: "Failed", cls: "bg-rose-500/20 text-rose-200 ring-rose-500/40", Icon: AlertTriangle };
    case "cancelled":
      return { label: "Cancelled", cls: "bg-slate-500/20 text-slate-200 ring-slate-500/40", Icon: X };
  }
}

function summarizeEvent(ev: HistoryRow): { kind: "step" | "chain" | "other"; title: string; subtitle?: string; anchor?: string } {
  const m = ev.metadata ?? {};
  const stepId = (m as { step_id?: string }).step_id;
  const stepKind = (m as { step_kind?: string }).step_kind;
  switch (ev.event_type) {
    case "intent_chain_started":
      return { kind: "chain", title: "Chain started" };
    case "intent_chain_step_dispatched":
      return { kind: "step", title: `${stepId ?? "Step"} dispatched`, subtitle: stepKind ?? undefined };
    case "intent_chain_step_completed":
      return { kind: "step", title: `${stepId ?? "Step"} completed`, subtitle: stepKind ?? undefined };
    case "intent_chain_step_failed":
      return { kind: "step", title: `${stepId ?? "Step"} failed`, subtitle: (m as { error_class?: string }).error_class ?? undefined };
    case "intent_chain_step_user_pending":
      return { kind: "step", title: `${stepId ?? "Step"} awaiting user`, subtitle: stepKind ?? undefined };
    case "intent_chain_step_rerouted":
      return { kind: "step", title: `Rerouted → ${(m as { to_step_id?: string }).to_step_id ?? "?"}`, subtitle: `from ${(m as { from_step_id?: string }).from_step_id ?? "?"}` };
    case "intent_chain_completed":
      return { kind: "chain", title: "Chain completed", subtitle: `${(m as { duration_ms?: number }).duration_ms ?? ""}ms` };
    case "intent_chain_failed":
      return { kind: "chain", title: "Chain failed" };
    case "intent_chain_cancelled":
      return { kind: "chain", title: "Chain cancelled" };
    case "intent_chain_timeout":
      return { kind: "chain", title: "Wait step timeout", subtitle: stepId };
    case "intent_chain_charge_committed":
      return { kind: "chain", title: `Charged ${(m as { cost_qc?: number }).cost_qc ?? 0} Q¢` };
    case "intent_chain_charge_refunded":
      return { kind: "chain", title: "Charge refunded" };
    case "intent_chain_feedback_recorded":
      return { kind: "chain", title: `Feedback recorded (${(m as { rating?: string }).rating ?? "?"})` };
    case "proposal_drafted":
      return { kind: "step", title: "Marketa proposal drafted", subtitle: (m as { proposal_artifact_id?: string }).proposal_artifact_id };
    case "artifact_sent":
      return { kind: "step", title: "Artifact sent", subtitle: (m as { message_id?: string }).message_id };
    default:
      return { kind: "other", title: ev.event_type };
  }
}

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function ChainDetailDrawer({ open, chain_id, onClose, onCancelled, personaId, theme = "dark" }: ChainDetailDrawerProps) {
  const isDark = theme === "dark";
  const [chain, setChain] = useState<ChainView | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feedback UI state
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [draftComment, setDraftComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!chain_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/intent-chains/${chain_id}`, { cache: "no-store", personaIdHint: personaId });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { chain: ChainView; history: HistoryRow[]; feedback: FeedbackRow | null };
      setChain(body.chain);
      setHistory(body.history ?? []);
      setFeedback(body.feedback ?? null);
      if (body.feedback) {
        setDraftComment(body.feedback.comment ?? "");
        setShowCommentInput(body.feedback.rating === "dislike" && (body.feedback.comment ?? "").length > 0);
      }
    } catch (e) {
      setError((e as Error).message || "Failed to load chain");
    } finally {
      setLoading(false);
    }
  }, [chain_id, personaId]);

  useEffect(() => {
    if (open && chain_id) void load();
  }, [open, chain_id, load]);

  const submitRating = async (rating: "like" | "dislike", comment?: string) => {
    if (!chain_id) return;
    setSubmittingFeedback(true);
    try {
      const res = await personaFetch(`/api/intent-chains/${chain_id}/feedback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment ?? null }),
        personaIdHint: personaId,
      });
      if (res.ok) {
        const body = (await res.json()) as { feedback: FeedbackRow };
        setFeedback(body.feedback);
        if (rating === "like") setShowCommentInput(false);
      }
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleLike = () => void submitRating("like");
  const handleDislike = () => {
    if (showCommentInput) {
      void submitRating("dislike", draftComment.trim() || undefined);
    } else {
      setShowCommentInput(true);
    }
  };
  const handleSubmitComment = () => void submitRating("dislike", draftComment.trim() || undefined);

  const cancel = async () => {
    if (!chain_id) return;
    setCancelling(true);
    try {
      const res = await personaFetch(`/api/intent-chains/${chain_id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        personaIdHint: personaId,
      });
      if (res.ok) {
        onCancelled?.(chain_id);
        await load();
      }
    } finally {
      setCancelling(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} aria-label="Dismiss" />
      <div
        className={`flex h-full w-full max-w-2xl flex-col ${
          isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
        } shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-700/40 p-5">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-violet-300 mb-1">Intent Chain</div>
            <div className="text-lg font-semibold truncate">{chain?.template_id ?? chain_id ?? "—"}</div>
            {chain && (
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <span>v{chain.template_version}</span>
                <span>•</span>
                <span>{fmtAge(chain.started_at)}</span>
                {chain.cost_qc > 0 && (
                  <>
                    <span>•</span>
                    <span>{chain.cost_qc} Q¢</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {chain && (() => {
              const b = statusBadge(chain.status);
              const Icon = b.Icon;
              return (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ${b.cls}`}>
                  <Icon className={`w-3.5 h-3.5 ${b.spin ? "animate-spin" : ""}`} />
                  {b.label}
                </span>
              );
            })()}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800/60" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading chain…
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
          )}

          {!loading && !error && chain && (
            <>
              {/* Step history */}
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Step history</div>
                {history.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No events recorded yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {history.map((ev) => {
                      const s = summarizeEvent(ev);
                      const isDispatched = ev.event_type.endsWith("dispatched");
                      const isFailed = ev.event_type.endsWith("_failed");
                      return (
                        <div
                          key={ev.event_id}
                          className={`flex items-start gap-3 rounded-md border ${
                            isFailed
                              ? "border-rose-500/40 bg-rose-500/5"
                              : isDispatched
                                ? "border-indigo-500/30 bg-indigo-500/5"
                                : "border-slate-700/40 bg-slate-800/40"
                          } px-3 py-2 text-sm`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {ev.event_type.endsWith("completed") ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                            ) : ev.event_type.endsWith("failed") ? (
                              <AlertTriangle className="w-4 h-4 text-rose-300" />
                            ) : ev.event_type.includes("scheduled") || ev.event_type.includes("timeout") ? (
                              <Clock className="w-4 h-4 text-amber-300" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-100">{s.title}</div>
                            {s.subtitle && <div className="text-xs text-slate-400 truncate">{s.subtitle}</div>}
                          </div>
                          <div className="shrink-0 text-right text-xs text-slate-500">
                            {fmtAge(ev.created_at)}
                            {ev.receipt_eligible && (
                              <div className="mt-0.5 text-[10px] text-emerald-400/70 inline-flex items-center gap-0.5">
                                <span>receipt</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer — cancel button (active/waiting) OR feedback (terminated) */}
        {!loading && !error && chain && (
          <div className="border-t border-slate-700/40 p-5 space-y-3">
            {(chain.status === "active" || chain.status === "waiting") && (
              <button
                onClick={cancel}
                disabled={cancelling}
                className="w-full rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel chain"}
              </button>
            )}

            {(chain.status === "completed" || chain.status === "failed" || chain.status === "cancelled") && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                  {feedback ? "Your feedback" : "How was this chain?"}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleLike}
                    disabled={submittingFeedback}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                      feedback?.rating === "like"
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200"
                    } disabled:opacity-50`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Like
                  </button>
                  <button
                    onClick={handleDislike}
                    disabled={submittingFeedback}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                      feedback?.rating === "dislike"
                        ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
                        : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-rose-500/40 hover:text-rose-200"
                    } disabled:opacity-50`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Dislike
                  </button>
                </div>

                {(showCommentInput || feedback?.rating === "dislike") && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={draftComment}
                      onChange={(e) => setDraftComment(e.target.value)}
                      placeholder="What didn't work? (optional — helps us tune this chain)"
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleSubmitComment}
                        disabled={submittingFeedback}
                        className="rounded-md bg-indigo-500/20 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50"
                      >
                        {submittingFeedback ? "Saving…" : "Submit feedback"}
                      </button>
                    </div>
                  </div>
                )}

                {feedback?.comment && !showCommentInput && (
                  <div className="mt-2 text-xs text-slate-400 italic">"{feedback.comment}"</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChainDetailDrawer;
