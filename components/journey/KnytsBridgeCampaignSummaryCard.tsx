'use client';

/**
 * KnytsBridgeCampaignSummaryCard — Gate D wallet legibility
 * (`KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md` §11).
 *
 * "Your KNYTS Campaign" — makes the three independent outputs legible
 * together in the SAME Reputation & Standing tab SmartWalletDrawer already
 * renders, without collapsing their semantics:
 *   - Reputation — persona context
 *   - Standing — person-grade constitutional contribution (evidence count,
 *     not a raw score — the score itself is the existing Standing section
 *     directly above this card)
 *   - Knightcoin — campaign reward balance/earned amount
 *
 * Self-fetching and self-contained so mounting it in SmartWalletDrawer.tsx
 * is a single JSX line — reads `/api/journey/knyts-bridge/campaign-summary`
 * (a pure aggregation over the evidence ledger; no new write path). Renders
 * nothing if the persona has no campaign evidence yet, so wallets untouched
 * by the campaign are unaffected.
 */

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface CampaignSummary {
  reputationEarned: number;
  standingEvidenceCount: number;
  knytcoinEarned: number;
  recentActions: Array<{ actionType: string; occurredAt: string }>;
}

const ACTION_LABELS: Record<string, string> = {
  campaign_preregistered: 'Pre-registered for the Kickstarter',
  kickstarter_preview_clicked: 'Opened the Kickstarter preview',
  kickstarter_follow_confirmed: 'Confirmed Kickstarter follow',
  bridge_shared: 'Shared the KNYTS Bridge',
  qualified_campaign_visit: 'Referral drove a qualified visit',
  crossing_story_published: 'Published a Crossing Story',
  crossing_story_liked: 'Liked a Crossing Story',
  crossing_story_engagement_threshold_reached: 'Story reached 5 unique likes',
  campaign_referral_converted: 'Referral converted to a follower',
};

export function KnytsBridgeCampaignSummaryCard() {
  const [summary, setSummary] = useState<CampaignSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/journey/knyts-bridge/campaign-summary', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ok?: boolean; summary?: CampaignSummary } | null) => {
        if (!cancelled && json?.ok && json.summary) setSummary(json.summary);
      })
      .catch(() => {
        /* non-fatal — the campaign summary is supplementary to the wallet */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || (summary.reputationEarned === 0 && summary.standingEvidenceCount === 0 && summary.knytcoinEarned === 0)) {
    return null;
  }

  return (
    <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50 mb-2">
        <Sparkles className="h-3 w-3 text-amber-300" />
        Your KNYTS Campaign
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/60">Reputation <span className="text-white/30">— persona</span></span>
          <span className="text-white/90 font-semibold">+{summary.reputationEarned.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60">Standing <span className="text-white/30">— person</span></span>
          <span className="text-white/90 font-semibold">
            {summary.standingEvidenceCount} evidence event{summary.standingEvidenceCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60">Knightcoin <span className="text-white/30">— reward</span></span>
          <span className="text-white/90 font-semibold">{summary.knytcoinEarned.toFixed(2)} KNYT</span>
        </div>
      </div>
      {summary.recentActions.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
          {summary.recentActions.slice(0, 3).map((a, i) => (
            <li key={i} className="text-[10px] text-white/40">
              {ACTION_LABELS[a.actionType] ?? a.actionType}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default KnytsBridgeCampaignSummaryCard;
