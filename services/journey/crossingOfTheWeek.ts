/**
 * KNYTS Bridge — Crossing of the Week.
 *
 * The smallest new subsystem the campaign needs (approved plan, item 7): a
 * thin read over campaign-tagged content joined with real KNYT signal
 * counts (reactions, campaign-tagged shares, remix lineage), selecting one
 * winner per ISO week. Persisted as a single announcement row
 * (knyts_bridge_crossing_of_the_week) — never a ledger, never a recurring
 * reward schedule. v1's reward (graphic novel + featured Pulse placement)
 * is fulfilled manually by the operator once a winner is selected; this
 * module only decides and records WHICH crossing won.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from './knytsBridgeCrossingJourney';

export interface CrossingOfTheWeek {
  weekStart: string;
  communityContentId: string;
  title: string;
  creatorPersonaId: string;
  score: number;
  selectedBy: 'auto' | 'admin';
  selectedAt: string;
}

/** Monday of the ISO week containing `now`, as YYYY-MM-DD. */
export function isoWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** The currently-selected Crossing of the Week, or null if none yet this week. */
export async function getCurrentCrossingOfTheWeek(
  supabase: SupabaseClient,
  now: Date,
): Promise<CrossingOfTheWeek | null> {
  const weekStart = isoWeekStart(now);
  const { data, error } = await supabase
    .from('knyts_bridge_crossing_of_the_week')
    .select('week_start, community_content_id, score, selected_by, selected_at, community_generated_content(title, creator_persona_id)')
    .eq('week_start', weekStart)
    .maybeSingle();

  // Fail faithful: a missing ROW this week is legitimate (null, not an
  // error — see this route's own header). A missing TABLE or any other
  // query failure is a real error and must say so, not be silently
  // indistinguishable from "no winner yet".
  if (error) throw new Error(`knyts_bridge_crossing_of_the_week read failed: ${error.message}`);
  if (!data) return null;
  const content = data.community_generated_content as unknown as
    | { title: string; creator_persona_id: string }
    | { title: string; creator_persona_id: string }[]
    | null;
  const contentRow = Array.isArray(content) ? content[0] : content;
  return {
    weekStart: data.week_start,
    communityContentId: data.community_content_id,
    title: contentRow?.title ?? 'Untitled crossing',
    creatorPersonaId: contentRow?.creator_persona_id ?? '',
    score: data.score,
    selectedBy: data.selected_by,
    selectedAt: data.selected_at,
  };
}

/**
 * Selects and records this week's winner, if one hasn't already been
 * selected. Idempotent — calling it twice in the same week is a no-op on
 * the second call (returns the already-selected row). Score is the simple
 * sum of reactions + share counters + inspired remixes across every
 * campaign-tagged crossing published before `now` — the same real signals
 * STAND reads, never a fabricated formula.
 */
export async function selectCrossingOfTheWeek(
  supabase: SupabaseClient,
  now: Date,
  selectedBy: 'auto' | 'admin' = 'auto',
): Promise<CrossingOfTheWeek | null> {
  const existing = await getCurrentCrossingOfTheWeek(supabase, now);
  if (existing) return existing;

  const weekStart = isoWeekStart(now);

  const { data: crossings } = await supabase
    .from('community_generated_content')
    .select('id, title, creator_persona_id')
    .eq('campaign_tag', KNYTS_BRIDGE_CAMPAIGN_ID)
    .in('status', ['shared', 'runtime_promoted']);

  const crossingIds = (crossings ?? []).map((r) => r.id as string);
  if (crossingIds.length === 0) return null;

  const [reactionsRes, sharesRes, remixesRes] = await Promise.all([
    supabase.from('knyt_reactions').select('publication_id').in('publication_id', crossingIds),
    supabase
      .from('social_share_analytics')
      .select('content_id, clicks, signups, conversions')
      .in('content_id', crossingIds)
      .eq('campaign_id', KNYTS_BRIDGE_CAMPAIGN_ID),
    supabase.from('community_generated_content').select('parent_id').in('parent_id', crossingIds),
  ]);

  const scoreById = new Map<string, number>(crossingIds.map((id) => [id, 0]));
  for (const row of reactionsRes.data ?? []) {
    scoreById.set(row.publication_id, (scoreById.get(row.publication_id) ?? 0) + 1);
  }
  for (const row of sharesRes.data ?? []) {
    const add = (row.clicks ?? 0) + (row.signups ?? 0) + (row.conversions ?? 0);
    scoreById.set(row.content_id, (scoreById.get(row.content_id) ?? 0) + add);
  }
  for (const row of remixesRes.data ?? []) {
    if (!row.parent_id) continue;
    scoreById.set(row.parent_id, (scoreById.get(row.parent_id) ?? 0) + 1);
  }

  let winnerId: string | null = null;
  let winnerScore = -1;
  for (const [id, score] of scoreById.entries()) {
    if (score > winnerScore) {
      winnerId = id;
      winnerScore = score;
    }
  }
  if (!winnerId) return null;

  const { data: inserted, error } = await supabase
    .from('knyts_bridge_crossing_of_the_week')
    .insert({ week_start: weekStart, community_content_id: winnerId, score: winnerScore, selected_by: selectedBy })
    .select('week_start, community_content_id, score, selected_by, selected_at')
    .single();

  // A concurrent selection winning the UNIQUE(week_start) race is not an
  // error — re-read whatever won.
  if (error || !inserted) return getCurrentCrossingOfTheWeek(supabase, now);

  const winnerRow = (crossings ?? []).find((r) => r.id === winnerId);
  return {
    weekStart: inserted.week_start,
    communityContentId: inserted.community_content_id,
    title: winnerRow?.title ?? 'Untitled crossing',
    creatorPersonaId: winnerRow?.creator_persona_id ?? '',
    score: inserted.score,
    selectedBy: inserted.selected_by,
    selectedAt: inserted.selected_at,
  };
}
