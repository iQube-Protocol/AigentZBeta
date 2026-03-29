"use client";

/**
 * KnytRewardView
 *
 * Enhanced reward history and PoKW receipts panel for Living Canon wallet.
 * Shows: earned KNYT by type, pending grants, milestone badges, PoKW total.
 *
 * Designed to mount inside the SmartWallet wallet drawer (wallet-narrow or wallet-wide)
 * or as a standalone panel in the Order tab.
 *
 * Data: fetches from /api/codex/knyt/order?persona_id=X
 *       + /api/codex/knyt/living-canon/rewards?persona_id=X
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Star, Zap, Trophy, BookOpen, Award } from "lucide-react";
import { PublicationStateBadge } from "@/components/ui/BranchLabel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RewardGrant {
  id: string;
  task_type: string;
  amount_knyt: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface OrderState {
  tier: string;
  tier_label: string;
  rank: number;
}

interface Metrics {
  accepted_contributions: number;
  pokw_total: number;
  votes_cast: number;
  canon_elevations: number;
  total_reward_knyt: number;
}

interface Milestone {
  tier: string;
  achieved_at: string;
  autodrive_cid: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<string, string> = {
  LivingCanonVoteCast:                "Vote Cast",
  LivingCanonContributionAccepted:    "Contribution Accepted",
  LivingCanonContributionFeatured:    "Contribution Featured",
  LivingCanonContributionCanonElevated:"Canon Elevation",
  LivingCanonCorrespondentDispatch:   "Correspondent Dispatch",
  LivingCanonCorrespondentElevation:  "Correspondent Role",
  OrderAscensionMilestone:            "Order Ascension",
};

const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  LivingCanonVoteCast:                <Zap className="h-3 w-3 text-yellow-400" />,
  LivingCanonContributionAccepted:    <BookOpen className="h-3 w-3 text-cyan-400" />,
  LivingCanonContributionFeatured:    <Star className="h-3 w-3 text-amber-400" />,
  LivingCanonContributionCanonElevated:<Trophy className="h-3 w-3 text-violet-400" />,
  LivingCanonCorrespondentDispatch:   <BookOpen className="h-3 w-3 text-amber-400" />,
  LivingCanonCorrespondentElevation:  <Award className="h-3 w-3 text-amber-300" />,
  OrderAscensionMilestone:            <Trophy className="h-3 w-3 text-violet-400" />,
};

const TIER_COLORS: Record<string, string> = {
  SEEKER:    "text-slate-400",
  INITIATE:  "text-cyan-300",
  SENTINEL:  "text-green-300",
  CHAMPION:  "text-amber-300",
  KNIGHT:    "text-violet-300",
  SATOSHI:   "text-yellow-300",
};

// ─── Component ───────────────────────────────────────────────────────────────

export interface KnytRewardViewProps {
  personaId: string;
  compact?: boolean;
}

export function KnytRewardView({ personaId, compact = false }: KnytRewardViewProps) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderState | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [grants, setGrants] = useState<RewardGrant[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestones, setNewMilestones] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, rewardsRes] = await Promise.all([
        fetch(`/api/codex/knyt/order?persona_id=${personaId}`, { cache: "no-store" }),
        fetch(`/api/codex/knyt/living-canon/rewards?persona_id=${personaId}`, { cache: "no-store" }),
      ]);

      if (orderRes.ok) {
        const od = await orderRes.json();
        setOrder(od.order ?? null);
        setMetrics(od.metrics ?? null);
        setMilestones(od.milestones ?? []);
        if (od.new_milestones?.length) setNewMilestones(od.new_milestones);
      }

      if (rewardsRes.ok) {
        const rd = await rewardsRes.json();
        setGrants(rd.grants ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading rewards…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Order tier + new milestone alert */}
      {order && (
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Order of Metaiye</div>
              <div className={`text-base font-semibold ${TIER_COLORS[order.tier] ?? "text-white"}`}>
                {order.tier_label}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">KNYT earned</div>
              <div className="text-sm font-mono text-white">
                {(metrics?.total_reward_knyt ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Metrics row */}
          {metrics && !compact && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Contributions", value: metrics.accepted_contributions },
                { label: "Votes", value: metrics.votes_cast },
                { label: "Canon", value: metrics.canon_elevations },
                { label: "PoKW", value: metrics.pokw_total.toFixed(0) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-white/5 bg-slate-800/50 p-2 text-center">
                  <div className="text-sm font-semibold text-white">{value}</div>
                  <div className="text-[9px] text-slate-500 leading-tight">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* New milestone banner */}
          {newMilestones.length > 0 && (
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-violet-400 shrink-0" />
              <span>
                New milestone{newMilestones.length > 1 ? "s" : ""} achieved:{" "}
                <span className="font-medium">{newMilestones.join(", ")}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reward grant history */}
      {grants.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recent Rewards</div>
          {grants.slice(0, compact ? 5 : 15).map((grant) => (
            <div
              key={grant.id}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2"
            >
              <div className="shrink-0">
                {TASK_TYPE_ICON[grant.task_type] ?? <Star className="h-3 w-3 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">
                  {TASK_TYPE_LABELS[grant.task_type] ?? grant.task_type}
                </div>
                <div className="text-[10px] text-slate-500">
                  {new Date(grant.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="text-xs font-mono text-cyan-300 shrink-0">
                +{Number(grant.amount_knyt).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {grants.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-2">
          No rewards yet — vote, contribute, or correspond to earn KNYT.
        </p>
      )}
    </div>
  );
}
