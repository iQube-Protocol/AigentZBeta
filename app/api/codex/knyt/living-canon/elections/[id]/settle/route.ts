/**
 * KNYT Election Settlement
 *
 * Closes an election and settles all pending rewards.
 *
 * Flow:
 *   1. Validate election is 'open' and closes_at has passed (or actor is steward forcing close)
 *   2. Tally votes per candidate — winner_ids = candidates sorted by vote count
 *   3. Set reward_knyt on every ballot = per_voter_reward_knyt (fixed, turnout-positive)
 *   4. Mark all ballots reward_settled = true
 *   5. Update election: status='settled', settled_pool_knyt, settled_at
 *   6. Write settlement record to Autodrive for canon-affecting elections
 *   7. Debit 21sats_community_world treasury for settled pool
 *   8. Emit individual knyt_reward_grants for each ballot (previously they were 'pending')
 *
 * POST /api/codex/knyt/living-canon/elections/[id]/settle
 *   body: { actor_persona_id: string, force?: boolean }
 *
 * Authorization: server-only (steward-level actor required).
 * The route checks that the caller provides a valid actor_persona_id.
 * Full role-based auth can be layered on top via middleware.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const electionId = params.id;
    const body = await request.json();
    const { actor_persona_id, force = false } = body;

    if (!electionId) {
      return NextResponse.json({ error: 'Election ID required' }, { status: 400 });
    }
    if (typeof actor_persona_id !== 'string' || !actor_persona_id) {
      return NextResponse.json({ error: 'actor_persona_id is required' }, { status: 400 });
    }

    // 1. Load election
    const { data: election, error: fetchErr } = await supabase
      .from('knyt_elections')
      .select('*')
      .eq('id', electionId)
      .single();

    if (fetchErr || !election) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    if (election.status !== 'open') {
      return NextResponse.json(
        { error: `Cannot settle election in status '${election.status}'. Must be 'open'.` },
        { status: 422 }
      );
    }

    const now = new Date();
    const closesAt = new Date(election.closes_at);
    if (!force && closesAt > now) {
      return NextResponse.json(
        {
          error: `Election does not close until ${election.closes_at}. Pass force=true to settle early.`,
          closes_at: election.closes_at,
          closes_in_ms: closesAt.getTime() - now.getTime(),
        },
        { status: 422 }
      );
    }

    // 2. Load all ballots
    const { data: ballots, error: ballotsErr } = await supabase
      .from('knyt_ballots')
      .select('id, persona_id, voted_for, reward_settled')
      .eq('election_id', electionId);

    if (ballotsErr) throw ballotsErr;

    const allBallots = ballots ?? [];
    const totalBallots = allBallots.length;

    // 3. Tally votes per candidate
    const voteTally: Record<string, number> = {};
    for (const ballot of allBallots) {
      for (const candidateId of ballot.voted_for ?? []) {
        voteTally[candidateId] = (voteTally[candidateId] ?? 0) + 1;
      }
    }

    // Sort candidates by vote count descending
    const rankedCandidates = Object.entries(voteTally)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => id);

    const winnerIds = rankedCandidates.slice(0, 3); // top 3 winners

    // 4. Compute settled pool
    const perVoterReward = Number(election.per_voter_reward_knyt);
    const settledPool = perVoterReward * totalBallots;
    const nowIso = now.toISOString();

    // 5. Mark all unsettled ballots with their reward
    if (allBallots.length > 0) {
      const { error: ballotUpdateErr } = await supabase
        .from('knyt_ballots')
        .update({
          reward_knyt: perVoterReward,
          reward_settled: true,
          settled_at: nowIso,
        })
        .eq('election_id', electionId)
        .eq('reward_settled', false);

      if (ballotUpdateErr) throw ballotUpdateErr;
    }

    // 6. Emit individual reward grants for each voter
    if (allBallots.length > 0) {
      const rewardGrants = allBallots
        .filter((b) => !b.reward_settled) // only previously-unsettled
        .map((b) => ({
          persona_id: b.persona_id,
          task_type: 'LivingCanonVoteCast',
          amount_knyt: perVoterReward,
          base_amount_knyt: perVoterReward,
          rep_multiplier: 1.0,
          source_event_id: b.id,
          metadata: {
            election_id: electionId,
            voted_for: b.voted_for,
            settled: true,
          },
        }));

      if (rewardGrants.length > 0) {
        await supabase.from('knyt_reward_grants').upsert(rewardGrants, {
          onConflict: 'source_event_id',
          ignoreDuplicates: true,
        }).catch((e) => console.warn('[settle] reward grants upsert (non-fatal):', e));
      }
    }

    // 7. Write settlement record to Autodrive (for canon-affecting elections)
    let autodriveCid: string | null = null;
    const isCanonAffecting = election.votable_type === 'canon_elevation_candidate';

    if (isCanonAffecting) {
      try {
        const { uploadCodexAsset } = await import('@/server/services/autonomysContentService');
        const settlementRecord = {
          election_id: electionId,
          title: election.title,
          world_id: election.world_id,
          branch: election.branch,
          votable_type: election.votable_type,
          total_ballots: totalBallots,
          winner_ids: winnerIds,
          vote_tally: voteTally,
          settled_pool_knyt: settledPool,
          per_voter_reward_knyt: perVoterReward,
          settled_at: nowIso,
          settled_by: actor_persona_id,
        };
        const result = await uploadCodexAsset({
          content: JSON.stringify(settlementRecord),
          fileName: `election-settlement-${electionId}.json`,
          mimeType: 'application/json',
          metadata: { type: 'election_settlement', election_id: electionId, world_id: election.world_id },
        });
        autodriveCid = result.cid ?? null;
      } catch (autodriveErr) {
        console.error('[settle] Autodrive write failed (non-fatal):', autodriveErr);
      }
    }

    // 8. Update election record to 'settled'
    const { data: updatedElection, error: updateErr } = await supabase
      .from('knyt_elections')
      .update({
        status: 'settled',
        winner_ids: winnerIds,
        settled_pool_knyt: settledPool,
        settled_at: nowIso,
        autodrive_cid: autodriveCid ?? election.autodrive_cid,
        updated_at: nowIso,
      })
      .eq('id', electionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 9. Debit treasury for the settled pool
    if (settledPool > 0) {
      await supabase
        .from('knyt_treasury_ledger')
        .insert({
          namespace: '21sats_community_world',
          delta_knyt: -settledPool,
          reference_type: 'election_settlement',
          reference_id: electionId,
          note: `Election settled: ${election.title} (${totalBallots} voters)`,
        })
        .catch((e) => console.warn('[settle] treasury debit (non-fatal):', e));
    }

    return NextResponse.json({
      success: true,
      election: updatedElection,
      settlement: {
        total_ballots: totalBallots,
        winner_ids: winnerIds,
        vote_tally: voteTally,
        settled_pool_knyt: settledPool,
        per_voter_reward_knyt: perVoterReward,
        settled_at: nowIso,
        autodrive_cid: autodriveCid,
      },
    });
  } catch (err) {
    console.error('[elections/settle] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
