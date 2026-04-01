/**
 * KNYT Editorial — Featured Content Surfacing
 *
 * Aggregates elevated/featured Living Canon content for editorial insertion
 * in Qriptopian and other tenant surfaces.
 *
 * Returns:
 *   - Recently canon-elevated publications (highest authority)
 *   - Canon-eligible publications (strong candidates for promotion)
 *   - Active elections + current leaders (community-driven features)
 *   - Top correspondents by recent dispatch volume
 *
 * This endpoint is designed for Qriptopian's editorial slot system:
 *   - "Featured from 21 Sats" editorial block
 *   - Correspondent byline injection
 *   - Community vote callout widgets
 *
 * GET /api/codex/knyt/editorial/featured
 *   ?world_id=21sats (default)
 *   ?branch=canon|community|correspondent (optional filter)
 *   ?limit=5 (per section, max 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('world_id') ?? '21sats';
    const branchFilter = searchParams.get('branch');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 20);
    const now = new Date().toISOString();

    // Build branch filter clause
    const branchClause = (q: ReturnType<typeof supabase.from>) =>
      branchFilter ? (q as unknown as { eq: (a: string, b: string) => typeof q }).eq('branch', branchFilter) : q;

    const [
      canonResult,
      eligibleResult,
      electionsResult,
      dispatchCountResult,
    ] = await Promise.all([
      // 1. Recently canon-elevated (last 30 days)
      branchClause(
        supabase
          .from('knyt_publication_states')
          .select('id, subject_type, subject_id, branch, elevated_at, autodrive_cid, reviewed_by')
          .eq('state', 'canon')
          .gte('elevated_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
          .order('elevated_at', { ascending: false })
          .limit(limit)
      ),

      // 2. Canon-eligible (ready for promotion consideration)
      branchClause(
        supabase
          .from('knyt_publication_states')
          .select('id, subject_type, subject_id, branch, updated_at')
          .eq('state', 'canon_eligible')
          .order('updated_at', { ascending: false })
          .limit(limit)
      ),

      // 3. Active elections (for vote callout widgets)
      supabase
        .from('knyt_elections')
        .select('id, title, branch, votable_type, closes_at, total_ballots_cast, per_voter_reward_knyt')
        .eq('world_id', worldId)
        .eq('status', 'open')
        .lte('opens_at', now)
        .gte('closes_at', now)
        .order('total_ballots_cast', { ascending: false })
        .limit(limit),

      // 4. Top correspondents by recent accepted dispatches (last 60 days)
      supabase
        .from('knyt_publication_states')
        .select('elevated_by')
        .eq('branch', 'correspondent')
        .in('state', ['approved', 'canon_eligible', 'canon'])
        .gte('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
        .limit(100), // aggregate client-side
    ]);

    // Aggregate top correspondents
    const personaCounts: Record<string, number> = {};
    for (const row of dispatchCountResult.data ?? []) {
      if (row.elevated_by) {
        personaCounts[row.elevated_by] = (personaCounts[row.elevated_by] ?? 0) + 1;
      }
    }
    const topCorrespondents = Object.entries(personaCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([persona_id, dispatch_count]) => ({ persona_id, dispatch_count }));

    return NextResponse.json({
      world_id: worldId,
      generated_at: now,
      canon: (canonResult.data ?? []).map((p) => ({
        publication_id: p.id,
        subject_type: p.subject_type,
        subject_id: p.subject_id,
        branch: p.branch,
        elevated_at: p.elevated_at,
        autodrive_cid: p.autodrive_cid,
        elevated_by: p.reviewed_by,
        editorial_weight: 3, // highest weight — canon-confirmed
      })),
      canon_eligible: (eligibleResult.data ?? []).map((p) => ({
        publication_id: p.id,
        subject_type: p.subject_type,
        subject_id: p.subject_id,
        branch: p.branch,
        updated_at: p.updated_at,
        editorial_weight: 2, // elevated — pending canon confirmation
      })),
      active_elections: (electionsResult.data ?? []).map((e) => ({
        election_id: e.id,
        title: e.title,
        branch: e.branch,
        votable_type: e.votable_type,
        closes_at: e.closes_at,
        closes_in_ms: Math.max(0, new Date(e.closes_at).getTime() - Date.now()),
        total_ballots: e.total_ballots_cast,
        per_voter_reward: e.per_voter_reward_knyt,
        editorial_weight: 1, // community signal — vote callout widget
      })),
      top_correspondents: topCorrespondents,
    });
  } catch (err) {
    console.error('[editorial/featured] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
