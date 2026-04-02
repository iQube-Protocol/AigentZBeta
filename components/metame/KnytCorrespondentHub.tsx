"use client";

/**
 * KnytCorrespondentHub
 *
 * Correspondent-specific panel showing:
 *   - Active campaigns with editorial prompts
 *   - Featured correspondent slots (open elections)
 *   - Recent dispatches from the correspondent branch
 *   - Quick-launch submission shell for the most relevant campaign
 *
 * Surfaces in the Living Canon / Correspondent tab and the SmartWallet
 * tasks panel for correspondents.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Radio, ChevronDown, ChevronUp, ExternalLink, BookOpen, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  prompt: string | null;
  reward_preview: string | null;
}

interface FeaturedSlot {
  election_id: string;
  title: string;
  description: string | null;
  closes_at: string;
  closes_in_ms: number;
  total_ballots: number;
  per_voter_reward: number;
  candidate_count: number;
}

interface RecentDispatch {
  id: string;
  subject_type: string;
  state: string;
  date: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatClosesIn(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface KnytCorrespondentHubProps {
  personaId: string;
  /** Called when user taps a campaign to launch submission shell */
  onLaunchSubmission?: (schemaSlug: string) => void;
}

export function KnytCorrespondentHub({ personaId, onLaunchSubmission }: KnytCorrespondentHubProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isCorrespondent, setIsCorrespondent] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [featuredSlots, setFeaturedSlots] = useState<FeaturedSlot[]>([]);
  const [recentDispatches, setRecentDispatches] = useState<RecentDispatch[]>([]);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/codex/knyt/correspondent/campaigns?persona_id=${personaId}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load campaigns.");
      const data = await res.json();
      setIsCorrespondent(data.is_correspondent ?? false);
      setCampaigns(data.campaigns ?? []);
      setFeaturedSlots(data.featured_slots ?? []);
      setRecentDispatches(data.recent_dispatches ?? []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load.", "error");
    } finally {
      setLoading(false);
    }
  }, [personaId, toast]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading correspondent hub…
      </div>
    );
  }

  if (!isCorrespondent) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-center space-y-2">
        <Radio className="h-6 w-6 text-amber-400 mx-auto" />
        <p className="text-sm text-amber-200 font-medium">Correspondent Access Required</p>
        <p className="text-xs text-slate-400">
          A steward must elevate your contributor status to Correspondent to access editorial campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active campaigns */}
      {campaigns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">Active Campaigns</span>
          </div>

          {campaigns.map((campaign) => {
            const isExpanded = expandedCampaign === campaign.id;
            return (
              <div
                key={campaign.id}
                className="rounded-xl border border-amber-400/15 bg-slate-900/60"
              >
                <button
                  type="button"
                  onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{campaign.title}</div>
                    {campaign.reward_preview && (
                      <div className="text-[11px] text-amber-300/70">{campaign.reward_preview}</div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-amber-400/10 px-3 py-3 space-y-3">
                    {campaign.description && (
                      <p className="text-xs text-slate-400">{campaign.description}</p>
                    )}
                    {campaign.prompt && (
                      <div className="rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-amber-400/60 mb-1">Editorial Prompt</div>
                        <p className="text-xs text-amber-100/90">{campaign.prompt}</p>
                      </div>
                    )}
                    {onLaunchSubmission && (
                      <button
                        type="button"
                        onClick={() => onLaunchSubmission(campaign.slug)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 transition hover:bg-amber-500/20"
                      >
                        <BookOpen className="h-3 w-3" />
                        File Dispatch
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Featured slots (correspondent candidate elections) */}
      {featuredSlots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80">Featured Slots</span>
          </div>
          {featuredSlots.map((slot) => (
            <div
              key={slot.election_id}
              className="rounded-xl border border-violet-400/15 bg-slate-900/60 px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm text-white">{slot.title}</div>
                <div className="text-[11px] text-slate-400">
                  {slot.candidate_count} candidates · {slot.total_ballots} votes · {formatClosesIn(slot.closes_in_ms)}
                </div>
              </div>
              <div className="text-xs font-mono text-cyan-300 shrink-0">
                +{Number(slot.per_voter_reward).toFixed(2)} KNYT
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent dispatches */}
      {recentDispatches.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recent Dispatches</div>
          {recentDispatches.slice(0, 5).map((dispatch) => (
            <div
              key={dispatch.id}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2"
            >
              <ExternalLink className="h-3 w-3 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white capitalize">{dispatch.subject_type.replace(/_/g, " ")}</div>
                <div className="text-[10px] text-slate-500">
                  {new Date(dispatch.date).toLocaleDateString()}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 capitalize shrink-0">{dispatch.state}</span>
            </div>
          ))}
        </div>
      )}

      {campaigns.length === 0 && featuredSlots.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-2">
          No active campaigns right now. Check back soon.
        </p>
      )}
    </div>
  );
}
