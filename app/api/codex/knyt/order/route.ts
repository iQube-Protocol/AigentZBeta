/**
 * KNYT Order of Metaiye — Live Data API
 *
 * Returns a persona's current Order state: tier, ascension history,
 * progression metrics, and any pending milestone rewards.
 *
 * Previously a stub. Now queries:
 *   - crm_contributions (accepted count, PoKW total, correspondent flag)
 *   - knyt_ballots (vote participation)
 *   - knyt_publication_states (canon elevations)
 *   - knyt_reward_grants (total KNYT earned via Living Canon)
 *
 * Order tier thresholds (v1 — subject to governance revision):
 *   SEEKER      entry; any authenticated persona
 *   INITIATE    1+ accepted contribution OR 3+ votes cast
 *   SENTINEL    5+ accepted contributions OR correspondent elevation
 *   CHAMPION    1+ canon elevation credited to persona
 *   KNIGHT      10+ accepted + 1+ canon elevation + 500+ PoKW
 *   SATOSHI     reserved; governance-only ascension
 *
 * Rights-bearing and reward-affecting Order state is also written to
 * Codex (Autodrive) at the canon-elevation route. This endpoint reads
 * from Supabase (cache layer) for speed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Order tier thresholds for v1
const ORDER_TIERS = [
  { tier: 'SATOSHI',  label: 'SatoshiKNYT',   rank: 5, governance_only: true },
  { tier: 'KNIGHT',   label: 'Knight',         rank: 4, minAccepted: 10, minCanonElevations: 1, minPokw: 500 },
  { tier: 'CHAMPION', label: 'Champion',       rank: 3, minCanonElevations: 1 },
  { tier: 'SENTINEL', label: 'Sentinel',       rank: 2, minAccepted: 5 },
  { tier: 'INITIATE', label: 'Initiate',       rank: 1, minAccepted: 1 },
  { tier: 'SEEKER',   label: 'Seeker',         rank: 0 },
] as const;

type OrderTierName = typeof ORDER_TIERS[number]['tier'];

function deriveTier(metrics: {
  acceptedContributions: number;
  votesCast: number;
  canonElevations: number;
  pokwTotal: number;
  isCorrespondent: boolean;
}): OrderTierName {
  const { acceptedContributions, canonElevations, pokwTotal } = metrics;

  if (canonElevations >= 1 && acceptedContributions >= 10 && pokwTotal >= 500) return 'KNIGHT';
  if (canonElevations >= 1) return 'CHAMPION';
  if (acceptedContributions >= 5 || metrics.isCorrespondent) return 'SENTINEL';
  if (acceptedContributions >= 1 || metrics.votesCast >= 3) return 'INITIATE';
  return 'SEEKER';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('persona_id');

    if (!personaId) {
      return NextResponse.json({ error: 'persona_id query param required' }, { status: 400 });
    }

    // Run metrics queries in parallel
    const [contribResult, ballotsResult, elevationsResult, rewardsResult] = await Promise.all([
      // Accepted contributions + PoKW + correspondent flag
      supabase
        .from('crm_contributions')
        .select('id, pokw_score, status, metadata')
        .eq('persona_id', personaId)
        .in('status', ['accepted', 'distributed']),

      // Votes cast
      supabase
        .from('knyt_ballots')
        .select('id, election_id, reward_settled, reward_knyt')
        .eq('persona_id', personaId),

      // Canon elevations credited to this persona
      supabase
        .from('knyt_publication_states')
        .select('id, subject_type, elevated_at, autodrive_cid')
        .eq('elevated_by', personaId)
        .eq('state', 'canon'),

      // Total KNYT earned via Living Canon reward types
      supabase
        .from('knyt_reward_grants')
        .select('amount_knyt, task_type')
        .eq('persona_id', personaId)
        .like('task_type', 'LivingCanon%'),
    ]);

    const contributions = contribResult.data ?? [];
    const ballots = ballotsResult.data ?? [];
    const canonElevations = elevationsResult.data ?? [];
    const rewardGrants = rewardsResult.data ?? [];

    // Derive metrics
    const acceptedContributions = contributions.length;
    const pokwTotal = contributions.reduce((sum, c) => sum + (Number(c.pokw_score) || 0), 0);
    const votesCast = ballots.length;
    const canonElevationCount = canonElevations.length;
    const isCorrespondent = contributions.some(
      (c) => typeof c.metadata === 'object' && c.metadata !== null && (c.metadata as Record<string, unknown>).branch_target === 'correspondent'
    );
    const totalRewardKnyt = rewardGrants.reduce((sum, g) => sum + (Number(g.amount_knyt) || 0), 0);

    const currentTier = deriveTier({
      acceptedContributions,
      votesCast,
      canonElevations: canonElevationCount,
      pokwTotal,
      isCorrespondent,
    });

    const tierMeta = ORDER_TIERS.find((t) => t.tier === currentTier)!;

    // Next tier thresholds (for progression display)
    const nextTierMeta = ORDER_TIERS.find((t) => t.rank === tierMeta.rank + 1) ?? null;

    // Ascension milestone detection — check for un-recorded tier crossings
    // All tiers up to and including the current tier should have milestone rows.
    // Exclude SEEKER (entry) and SATOSHI (governance-only).
    const ascendableTiers = ORDER_TIERS.filter(
      (t) => t.rank > 0 && t.rank <= tierMeta.rank && !t.governance_only
    );

    const newMilestones: string[] = [];

    if (ascendableTiers.length > 0) {
      // Load existing milestones for this persona in one query
      const { data: existingMilestones } = await supabase
        .from('knyt_order_milestones')
        .select('tier')
        .eq('persona_id', personaId)
        .in('tier', ascendableTiers.map((t) => t.tier));

      const recordedTiers = new Set((existingMilestones ?? []).map((m) => m.tier));

      for (const tierDef of ascendableTiers) {
        if (recordedTiers.has(tierDef.tier)) continue;

        // New tier crossing detected — emit milestone reward
        const nowIso = new Date().toISOString();

        // Milestone reward amounts (scaled by tier rank)
        const milestoneAmounts: Record<string, number> = {
          INITIATE: 0.25,
          SENTINEL: 0.5,
          CHAMPION: 1.0,
          KNIGHT: 2.0,
        };
        const amount = milestoneAmounts[tierDef.tier] ?? 0.25;

        // For rights-bearing tiers (CHAMPION+), attempt Autodrive write
        let milestoneCid: string | null = null;
        if (tierMeta.rank >= 3) {
          // CHAMPION = rank 3
          try {
            const { uploadCodexAsset } = await import('@/server/services/autonomysContentService');
            const ascensionRecord = {
              persona_id: personaId,
              tier: tierDef.tier,
              tier_label: tierDef.label,
              achieved_at: nowIso,
              metrics: { acceptedContributions, canonElevationCount, pokwTotal, votesCast },
            };
            const result = await uploadCodexAsset({
              content: JSON.stringify(ascensionRecord),
              fileName: `order-ascension-${personaId}-${tierDef.tier}.json`,
              mimeType: 'application/json',
              metadata: { type: 'order_ascension', persona_id: personaId, tier: tierDef.tier },
            });
            milestoneCid = result.cid ?? null;
          } catch (e) {
            console.warn(`[order] Autodrive ascension write failed for ${tierDef.tier} (non-fatal):`, e);
          }
        }

        // Insert reward grant
        const { data: grant } = await supabase
          .from('knyt_reward_grants')
          .insert({
            persona_id: personaId,
            task_type: 'OrderAscensionMilestone',
            amount_knyt: amount,
            base_amount_knyt: amount,
            rep_multiplier: 1.0,
            source_event_id: null,
            metadata: { tier: tierDef.tier, tier_label: tierDef.label },
          })
          .select('id')
          .single();

        // Record milestone
        await supabase.from('knyt_order_milestones').insert({
          persona_id: personaId,
          tier: tierDef.tier,
          achieved_at: nowIso,
          reward_granted: true,
          reward_grant_id: grant?.id ?? null,
          autodrive_cid: milestoneCid,
        }).catch((e) => console.warn(`[order] milestone insert failed for ${tierDef.tier}:`, e));

        newMilestones.push(tierDef.tier);
      }
    }

    return NextResponse.json({
      persona_id: personaId,
      order: {
        tier: currentTier,
        tier_label: tierMeta.label,
        rank: tierMeta.rank,
      },
      metrics: {
        accepted_contributions: acceptedContributions,
        pokw_total: pokwTotal,
        votes_cast: votesCast,
        canon_elevations: canonElevationCount,
        is_correspondent: isCorrespondent,
        total_reward_knyt: totalRewardKnyt,
      },
      progression: nextTierMeta
        ? {
            next_tier: nextTierMeta.tier,
            next_tier_label: nextTierMeta.label,
          }
        : null,
      canon_elevations: canonElevations.map((e) => ({
        id: e.id,
        subject_type: e.subject_type,
        elevated_at: e.elevated_at,
        autodrive_cid: e.autodrive_cid,
      })),
      new_milestones: newMilestones.length > 0 ? newMilestones : undefined,
    });
  } catch (err) {
    console.error('[knyt/order] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
