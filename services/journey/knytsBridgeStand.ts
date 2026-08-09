/**
 * KNYTS Bridge STAND — thin read-only projection over existing signals.
 *
 * Per the approved plan (gap #2, #5 and item 6): the KNYT signal tray
 * (KnytRuntimeSurface) is only 6-of-9 actions real with no persisted reward
 * ledger read, and rewards/referral infrastructure is two non-unified
 * schemas. STAND does not pretend either of those is more complete than it
 * is — it queries the real, existing tables directly for whatever counts
 * are genuinely there (knyt_reactions, social_share_analytics,
 * community_generated_content.parent_id lineage) and returns a plain
 * aggregation. No new ledger, no new scoring formula, nothing written —
 * this module only reads.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from './knytsBridgeCrossingJourney';

export interface CrossingStanding {
  crossingId: string;
  title: string;
  reactions: { spark: number; like: number; question: number; canon_worthy: number };
  shareClicks: number;
  shareSignups: number;
  shareConversions: number;
  /** Count of other community_generated_content rows remixed FROM this one. */
  inspiredRemixes: number;
}

export interface KnytsBridgeStand {
  crossings: CrossingStanding[];
  totals: {
    crossingsPublished: number;
    reactionsReceived: number;
    sharesRegistered: number;
    inspiredRemixes: number;
  };
}

const EMPTY_REACTIONS = { spark: 0, like: 0, question: 0, canon_worthy: 0 };

/**
 * Reads every signal available for a persona's published KNYTS Bridge
 * crossings. Returns an empty projection (not an error) for a persona with
 * no published crossings yet — STAND is meaningless before REMIX, and an
 * empty state says exactly that.
 */
export async function getKnytsBridgeStand(
  supabase: SupabaseClient,
  personaId: string,
): Promise<KnytsBridgeStand> {
  const { data: crossingRows } = await supabase
    .from('community_generated_content')
    .select('id, title')
    .eq('creator_persona_id', personaId)
    .eq('campaign_tag', KNYTS_BRIDGE_CAMPAIGN_ID)
    .in('status', ['shared', 'runtime_promoted']);

  const crossingIds = (crossingRows ?? []).map((r) => r.id as string);
  if (crossingIds.length === 0) {
    return { crossings: [], totals: { crossingsPublished: 0, reactionsReceived: 0, sharesRegistered: 0, inspiredRemixes: 0 } };
  }

  const [reactionsRes, sharesRes, remixesRes] = await Promise.all([
    supabase.from('knyt_reactions').select('publication_id, reaction_type').in('publication_id', crossingIds),
    supabase
      .from('social_share_analytics')
      .select('content_id, clicks, signups, conversions')
      .in('content_id', crossingIds)
      .eq('campaign_id', KNYTS_BRIDGE_CAMPAIGN_ID),
    supabase.from('community_generated_content').select('id, parent_id').in('parent_id', crossingIds),
  ]);

  const reactionsByCrossing = new Map<string, typeof EMPTY_REACTIONS>();
  for (const row of reactionsRes.data ?? []) {
    const bucket = reactionsByCrossing.get(row.publication_id) ?? { ...EMPTY_REACTIONS };
    if (row.reaction_type in bucket) {
      (bucket as Record<string, number>)[row.reaction_type] += 1;
    }
    reactionsByCrossing.set(row.publication_id, bucket);
  }

  const sharesByCrossing = new Map<string, { clicks: number; signups: number; conversions: number }>();
  for (const row of sharesRes.data ?? []) {
    const existing = sharesByCrossing.get(row.content_id) ?? { clicks: 0, signups: 0, conversions: 0 };
    existing.clicks += row.clicks ?? 0;
    existing.signups += row.signups ?? 0;
    existing.conversions += row.conversions ?? 0;
    sharesByCrossing.set(row.content_id, existing);
  }

  const remixCountByCrossing = new Map<string, number>();
  for (const row of remixesRes.data ?? []) {
    if (!row.parent_id) continue;
    remixCountByCrossing.set(row.parent_id, (remixCountByCrossing.get(row.parent_id) ?? 0) + 1);
  }

  const crossings: CrossingStanding[] = (crossingRows ?? []).map((row) => {
    const reactions = reactionsByCrossing.get(row.id) ?? { ...EMPTY_REACTIONS };
    const shares = sharesByCrossing.get(row.id) ?? { clicks: 0, signups: 0, conversions: 0 };
    return {
      crossingId: row.id,
      title: row.title,
      reactions,
      shareClicks: shares.clicks,
      shareSignups: shares.signups,
      shareConversions: shares.conversions,
      inspiredRemixes: remixCountByCrossing.get(row.id) ?? 0,
    };
  });

  const totals = crossings.reduce(
    (acc, c) => {
      acc.reactionsReceived += c.reactions.spark + c.reactions.like + c.reactions.question + c.reactions.canon_worthy;
      acc.sharesRegistered += c.shareClicks + c.shareSignups + c.shareConversions;
      acc.inspiredRemixes += c.inspiredRemixes;
      return acc;
    },
    { crossingsPublished: crossings.length, reactionsReceived: 0, sharesRegistered: 0, inspiredRemixes: 0 },
  );

  return { crossings, totals };
}
