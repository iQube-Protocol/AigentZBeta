/**
 * KNYT Living Canon — Election Config
 *
 * Returns election definitions for the KNYT Cartridge to inject into
 * the Runtime vote UI. Cartridge defines context; Codex settles.
 *
 * GET /api/codex/knyt/living-canon/elections
 *   Returns all open/upcoming elections for the active world.
 *
 * GET /api/codex/knyt/living-canon/elections?id=<election_id>
 *   Returns a single election's full config including candidate details.
 *
 * GET /api/codex/knyt/living-canon/elections?branch=community|correspondent
 *   Filter by branch.
 *
 * GET /api/codex/knyt/living-canon/elections?persona_id=<id>
 *   Includes whether this persona has already voted in each election.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORLD_ID = '21sats';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const electionId = searchParams.get('id');
    const branch = searchParams.get('branch');
    const personaId = searchParams.get('persona_id');

    // Single election detail
    if (electionId) {
      const { data: election, error } = await supabase
        .from('knyt_elections')
        .select('*')
        .eq('id', electionId)
        .eq('world_id', WORLD_ID)
        .single();

      if (error || !election) {
        return NextResponse.json({ error: 'Election not found' }, { status: 404 });
      }

      let hasVoted = false;
      if (personaId) {
        const { data: ballot } = await supabase
          .from('knyt_ballots')
          .select('id')
          .eq('election_id', electionId)
          .eq('persona_id', personaId)
          .maybeSingle();
        hasVoted = !!ballot;
      }

      // Resolve candidate labels from publication states
      const candidates = await resolveCandidates(election.candidate_ids ?? []);

      return NextResponse.json({
        election,
        candidates,
        has_voted: hasVoted,
      });
    }

    // List elections
    const now = new Date().toISOString();
    let query = supabase
      .from('knyt_elections')
      .select('id, title, description, votable_type, branch, opens_at, closes_at, status, total_ballots_cast, per_voter_reward_knyt')
      .eq('world_id', WORLD_ID)
      .in('status', ['open', 'draft'])
      .order('opens_at', { ascending: true });

    if (branch) {
      query = query.eq('branch', branch);
    }

    const { data: elections, error } = await query;
    if (error) throw error;

    // If persona provided, mark which elections they've already voted in
    let votedElectionIds = new Set<string>();
    if (personaId && elections && elections.length > 0) {
      const { data: ballots } = await supabase
        .from('knyt_ballots')
        .select('election_id')
        .eq('persona_id', personaId)
        .in('election_id', elections.map((e) => e.id));
      votedElectionIds = new Set((ballots ?? []).map((b) => b.election_id));
    }

    return NextResponse.json({
      world_id: WORLD_ID,
      elections: (elections ?? []).map((e) => ({
        ...e,
        is_open: e.status === 'open' && e.opens_at <= now && e.closes_at >= now,
        has_voted: votedElectionIds.has(e.id),
        closes_in_ms: Math.max(0, new Date(e.closes_at).getTime() - Date.now()),
      })),
    });
  } catch (err) {
    console.error('[living-canon/elections] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function resolveCandidates(candidateIds: string[]) {
  if (!candidateIds.length) return [];
  const { data } = await supabase
    .from('knyt_publication_states')
    .select('id, subject_type, subject_id, branch, state')
    .in('id', candidateIds);
  return data ?? [];
}
