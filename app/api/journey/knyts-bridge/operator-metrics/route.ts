/**
 * GET /api/journey/knyts-bridge/operator-metrics
 *
 * KNYTS Bridge campaign activation, Gate D — operator visibility (spec §12).
 * A small additive query over `knyts_bridge_campaign_evidence`, not a new
 * analytics product. Gated via `requireAdminPersona` — the SAME gate the
 * existing Crossing-of-the-Week admin route uses (never a hand-rolled admin
 * check, per CLAUDE.md's Security — Access Gates rule).
 *
 * Answers exactly the questions spec §12 lists: unique preregistrations,
 * existing-investor vs new-prospect split, preview clicks, confirmed
 * follows, shares/visits, stories/likes, referrals, Knightcoin
 * proposed/distributed, Reputation generated, Standing-eligible events
 * accrued.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await requireAdminPersona(req);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'admin required' }, { status: 403 });
    }

    const client = getCrmClient();
    const { data: rows, error } = await client
      .from('knyts_bridge_campaign_evidence')
      .select('action_type, investor_known, crm_persona_id, standing_applied_at, reputation_applied_at, reward_applied_at, reward_amount_knyt');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const byActionType: Record<string, number> = {};
    const uniqueProspects = new Set<string>();
    let investorReactivations = 0;
    let newProspects = 0;
    let standingEventsAccrued = 0;
    let reputationEventsAccrued = 0;
    let knytcoinDistributed = 0;

    for (const r of rows ?? []) {
      const row = r as Record<string, unknown>;
      const actionType = row.action_type as string;
      byActionType[actionType] = (byActionType[actionType] ?? 0) + 1;

      if (actionType === 'campaign_preregistered' && row.crm_persona_id) {
        const id = row.crm_persona_id as string;
        if (!uniqueProspects.has(id)) {
          uniqueProspects.add(id);
          if (row.investor_known) investorReactivations += 1;
          else newProspects += 1;
        }
      }
      if (row.standing_applied_at) standingEventsAccrued += 1;
      if (row.reputation_applied_at) reputationEventsAccrued += 1;
      if (row.reward_applied_at) knytcoinDistributed += Number(row.reward_amount_knyt ?? 0);
    }

    return NextResponse.json({
      ok: true,
      metrics: {
        uniquePreregistrations: uniqueProspects.size,
        existingInvestorReactivations: investorReactivations,
        newProspects,
        previewClicks: byActionType['kickstarter_preview_clicked'] ?? 0,
        confirmedFollows: byActionType['kickstarter_follow_confirmed'] ?? 0,
        shares: byActionType['bridge_shared'] ?? 0,
        qualifiedVisits: byActionType['qualified_campaign_visit'] ?? 0,
        storiesPublished: byActionType['crossing_story_published'] ?? 0,
        likes: byActionType['crossing_story_liked'] ?? 0,
        engagementThresholdsReached: byActionType['crossing_story_engagement_threshold_reached'] ?? 0,
        referralsConverted: byActionType['campaign_referral_converted'] ?? 0,
        standingEventsAccrued,
        reputationEventsAccrued,
        knytcoinDistributed,
        byActionType,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
