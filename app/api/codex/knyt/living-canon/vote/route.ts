/**
 * KNYT Living Canon — Cast Ballot
 *
 * Codex authority endpoint for recording a vote.
 * Called when a SmartWallet 'vote' task is completed
 * (CompleteTaskPayload.proof carries the serialised ballot).
 *
 * POST body:
 *   election_id      UUID       required
 *   persona_id       UUID       required
 *   voted_for        UUID[]     required — candidate publication IDs
 *   wallet_task_id   string     required — WalletTask.id from SmartWallet
 *   proof            string     optional — signed ballot proof from wallet
 *
 * Flow:
 *   1. Validate election is open.
 *   2. Check persona has not already voted (unique constraint enforced at DB).
 *   3. Check persona meets eligibility rules (min_reputation_bucket, required_entitlements).
 *   4. Check proof-of-consumption: persona must have at least one PoKW record
 *      (any crm_contributions row or prior knyt_reward_grant) to vote.
 *      This prevents zero-activity accounts from influencing elections.
 *   5. Insert ballot.
 *   6. Emit reward entitlement (LivingCanonVoteCast) — processed asynchronously.
 *   7. Return ballot ID and reward preview.
 *
 * Reward model: turnout-positive
 *   Per-voter reward = election.per_voter_reward_knyt (fixed, independent of turnout).
 *   Pool grows as more voters participate. No dilution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { election_id, persona_id, voted_for, wallet_task_id, proof } = body;

    // Input validation
    if (typeof election_id !== 'string' || !election_id)
      return NextResponse.json({ error: 'election_id is required' }, { status: 400 });
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    if (!Array.isArray(voted_for) || voted_for.length === 0)
      return NextResponse.json({ error: 'voted_for must be a non-empty array of candidate IDs' }, { status: 400 });
    if (typeof wallet_task_id !== 'string' || !wallet_task_id)
      return NextResponse.json({ error: 'wallet_task_id is required' }, { status: 400 });

    // 1. Load and validate election
    const now = new Date().toISOString();
    const { data: election, error: electionErr } = await supabase
      .from('knyt_elections')
      .select('*')
      .eq('id', election_id)
      .single();

    if (electionErr || !election)
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });

    if (election.status !== 'open')
      return NextResponse.json({ error: `Election is not open (status: ${election.status})` }, { status: 422 });

    if (election.opens_at > now)
      return NextResponse.json({ error: 'Election has not opened yet' }, { status: 422 });

    if (election.closes_at < now)
      return NextResponse.json({ error: 'Election has closed' }, { status: 422 });

    // 2. Check eligibility (reputation bucket — entitlements checked at wallet level)
    if (typeof election.min_reputation_bucket === 'number' && election.min_reputation_bucket > 0) {
      const { data: persona } = await supabase
        .from('crm_personas')
        .select('reputation_bucket')
        .eq('id', persona_id)
        .maybeSingle();

      const repBucket = typeof persona?.reputation_bucket === 'number' ? persona.reputation_bucket : 0;
      if (repBucket < election.min_reputation_bucket) {
        return NextResponse.json(
          { error: 'Persona does not meet minimum reputation requirement for this election' },
          { status: 403 }
        );
      }
    }

    // 3. Proof-of-consumption gate: persona must have at least one prior activity record.
    //    This prevents fresh/bot accounts with zero engagement from influencing elections.
    //    We check in parallel for any crm_contributions OR any knyt_reward_grants.
    const [contribCheck, grantCheck] = await Promise.all([
      supabase
        .from('crm_contributions')
        .select('id', { count: 'exact', head: true })
        .eq('persona_id', persona_id)
        .limit(1),
      supabase
        .from('knyt_reward_grants')
        .select('id', { count: 'exact', head: true })
        .eq('persona_id', persona_id)
        .limit(1),
    ]);

    const hasActivity = (contribCheck.count ?? 0) > 0 || (grantCheck.count ?? 0) > 0;
    if (!hasActivity) {
      return NextResponse.json(
        {
          error: 'No activity on record — consume or contribute content before voting.',
          hint: 'Read content, submit a contribution, or complete a task to establish proof of knowledge work.',
        },
        { status: 403 }
      );
    }

    // 4. Cast ballot (unique constraint on election_id + persona_id prevents double-voting)
    const { data: ballot, error: ballotErr } = await supabase
      .from('knyt_ballots')
      .insert({
        election_id,
        persona_id,
        voted_for,
        proof: typeof proof === 'string' ? proof : null,
        wallet_task_id,
        // reward_knyt set at settlement time (not at cast time)
      })
      .select()
      .single();

    if (ballotErr) {
      // Unique violation = already voted
      if (ballotErr.code === '23505') {
        return NextResponse.json({ error: 'Persona has already voted in this election' }, { status: 409 });
      }
      throw ballotErr;
    }

    // 5. Emit reward entitlement — async, non-blocking
    //    Creates a pending reward grant for LivingCanonVoteCast.
    //    Settled by the election settlement job at close.
    //    We record it now so the wallet can show a pending reward immediately.
    await supabase.from('knyt_reward_grants').insert({
      persona_id,
      task_type: 'LivingCanonVoteCast',
      amount_knyt: election.per_voter_reward_knyt,
      base_amount_knyt: election.per_voter_reward_knyt,
      rep_multiplier: 1.0, // multiplier applied at final settlement
      source_event_id: ballot.id,
      metadata: { election_id, ballot_id: ballot.id, wallet_task_id },
    }).then(() => {/* fire-and-forget */}).catch((e) => {
      console.warn('[vote] reward grant insert failed (non-fatal):', e);
    });

    return NextResponse.json({
      success: true,
      ballot_id: ballot.id,
      reward_preview: {
        amount: election.per_voter_reward_knyt,
        asset: 'KNYT',
        note: 'Pending — settled when election closes',
      },
    });
  } catch (err) {
    console.error('[living-canon/vote] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
