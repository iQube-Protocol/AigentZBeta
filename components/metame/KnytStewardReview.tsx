"use client";

/**
 * KnytStewardReview
 *
 * Inline steward review surface for Living Canon submissions.
 * Follows the same chip/panel UX as RuntimeCapsuleAdminEditor and KnytSubmissionShell.
 *
 * Shows the review queue (submitted + under_review items) and lets
 * stewards approve, reject, request further review, or elevate to canon-eligible.
 *
 * Canon elevation (canon_eligible → canon) is handled separately via the
 * canon-elevation route and requires additional confirmation.
 *
 * Access: role-gated — caller must pass a steward/editor persona.
 * The component itself does not enforce roles; the API does.
 */

import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Shield, ChevronDown, ChevronUp, CheckCircle, XCircle, Star, Eye } from "lucide-react";
import { BranchLabel, PublicationStateBadge, type PublicationState } from "@/components/ui/BranchLabel";
import { KnytCanonElevationConfirm } from "@/components/metame/KnytCanonElevationConfirm";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface ReviewQueueItem {
  id: string;
  subject_type: string;
  subject_id: string;
  branch: "canon" | "community" | "correspondent";
  state: PublicationState;
  created_at: string;
  updated_at: string;
  review_notes: string | null;
}

type ReviewAction = "approve" | "reject" | "request_review" | "elevate_eligible";

const ACTION_CONFIG: Record<ReviewAction, { label: string; icon: React.ReactNode; className: string }> = {
  request_review: {
    label: "Mark for Review",
    icon: <Eye className="h-3 w-3" />,
    className: "border-blue-300/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20",
  },
  approve: {
    label: "Approve",
    icon: <CheckCircle className="h-3 w-3" />,
    className: "border-green-300/30 bg-green-500/10 text-green-200 hover:bg-green-500/20",
  },
  reject: {
    label: "Reject",
    icon: <XCircle className="h-3 w-3" />,
    className: "border-red-300/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  },
  elevate_eligible: {
    label: "Canon Eligible",
    icon: <Star className="h-3 w-3" />,
    className: "border-violet-300/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
  },
};

// Which actions are available per current state
const STATE_ACTIONS: Record<string, ReviewAction[]> = {
  submitted:    ["request_review", "approve", "reject"],
  under_review: ["approve", "reject"],
  approved:     ["elevate_eligible"],
  // canon_eligible: handled via KnytCanonElevationConfirm, not action buttons
};

// =============================================================================
// PROPS
// =============================================================================

export interface KnytStewardReviewProps {
  /** Steward/editor persona ID */
  actorPersonaId: string;
  /** Filter by branch */
  branch?: "community" | "correspondent";
}

// =============================================================================
// COMPONENT
// =============================================================================

export function KnytStewardReview({ actorPersonaId, branch }: KnytStewardReviewProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      // Include approved + canon_eligible so stewards see the full journey to canon
      const params = new URLSearchParams({ state: "submitted,under_review,approved,canon_eligible" });
      if (branch) params.set("branch", branch);
      const res = await fetch(`/api/codex/knyt/living-canon/review?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load review queue.");
      const data = await res.json();
      setQueue(data.queue ?? []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load queue.", "error");
    } finally {
      setLoading(false);
    }
  }, [branch, toast]);

  useEffect(() => {
    if (open) void loadQueue();
  }, [open, loadQueue]);

  const handleAction = async (publicationId: string, action: ReviewAction) => {
    setActingOn(publicationId);
    try {
      const res = await fetch("/api/codex/knyt/living-canon/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_id: publicationId,
          action,
          actor_persona_id: actorPersonaId,
          notes: noteFor === publicationId ? noteText.trim() || null : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, unknown>).error as string || "Action failed.");
      }
      toast(ACTION_CONFIG[action].label + " applied.", "success");
      setNoteFor(null);
      setNoteText("");
      // Refresh queue
      await loadQueue();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="rounded-xl border border-violet-400/25 bg-slate-900/70 p-3 space-y-3">
      {/* Header chip */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-400" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80">Steward</div>
            <div className="text-sm font-medium text-white">
              Canon pipeline
              {queue.length > 0 && (
                <span className="ml-2 rounded-full bg-violet-500/20 border border-violet-400/30 px-2 py-0.5 text-[11px] text-violet-200">
                  {queue.length}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={loading && !open}
          className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
        >
          {loading && !open ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? "Close" : "Open"}
        </button>
      </div>

      {open && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
            </div>
          ) : queue.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No items pending review.</p>
          ) : (
            queue.map((item) => {
              const availableActions = STATE_ACTIONS[item.state] ?? [];
              const isActing = actingOn === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-slate-800/50 p-3 space-y-3"
                >
                  {/* Item header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <BranchLabel branch={item.branch} />
                    <PublicationStateBadge state={item.state} />
                    <span className="text-[11px] text-slate-500">{item.subject_type}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 truncate">{item.subject_id}</div>

                  {/* Note input toggle */}
                  {noteFor === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={2}
                        placeholder="Review notes (optional)"
                        className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-violet-300/40"
                      />
                      <button
                        type="button"
                        onClick={() => { setNoteFor(null); setNoteText(""); }}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        Cancel note
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteFor(item.id)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition"
                    >
                      + Add review note
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {item.state === 'canon_eligible' ? (
                      // Final step: canon elevation requires confirmation + Autodrive write
                      <KnytCanonElevationConfirm
                        publicationId={item.id}
                        publicationLabel={`${item.subject_type} — ${item.branch}`}
                        actorPersonaId={actorPersonaId}
                        onElevated={() => void loadQueue()}
                      />
                    ) : (
                      availableActions.map((action) => {
                        const cfg = ACTION_CONFIG[action];
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => void handleAction(item.id, action)}
                            disabled={isActing}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${cfg.className}`}
                          >
                            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : cfg.icon}
                            {cfg.label}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loading}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
            Refresh queue
          </button>
        </div>
      )}
    </div>
  );
}
