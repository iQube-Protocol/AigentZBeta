/**
 * KNYT Living Canon — Steward Review API
 *
 * Role-controlled state transitions for publication states.
 * All actions are audited in knyt_publication_state_log.
 *
 * POST body:
 *   publication_id   UUID     required
 *   action           string   required — see ALLOWED_TRANSITIONS
 *   actor_persona_id UUID     required — steward/editor persona
 *   notes            string   optional
 *
 * Actions and their state transitions:
 *   approve            submitted | under_review → approved
 *   reject             submitted | under_review → rejected
 *   request_review     submitted → under_review
 *   archive            approved | rejected → archived
 *   elevate_eligible   approved → canon_eligible
 *
 * Canon elevation (canon_eligible → canon) is handled by the dedicated
 * /api/codex/knyt/canon-elevation route which also writes to Autodrive.
 *
 * GET ?persona_id=<id>&state=submitted,under_review
 *   Returns pending review queue for a steward.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReviewAction = 'approve' | 'reject' | 'request_review' | 'archive' | 'elevate_eligible';

const TRANSITIONS: Record<ReviewAction, { from: string[]; to: string }> = {
  request_review:    { from: ['submitted'],               to: 'under_review' },
  approve:           { from: ['submitted', 'under_review'], to: 'approved' },
  reject:            { from: ['submitted', 'under_review'], to: 'rejected' },
  archive:           { from: ['approved', 'rejected'],    to: 'archived' },
  elevate_eligible:  { from: ['approved'],                to: 'canon_eligible' },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publication_id, action, actor_persona_id, notes } = body;

    if (typeof publication_id !== 'string' || !publication_id)
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 });
    if (typeof action !== 'string' || !(action in TRANSITIONS))
      return NextResponse.json({ error: `action must be one of: ${Object.keys(TRANSITIONS).join(', ')}` }, { status: 400 });
    if (typeof actor_persona_id !== 'string' || !actor_persona_id)
      return NextResponse.json({ error: 'actor_persona_id is required' }, { status: 400 });

    const transition = TRANSITIONS[action as ReviewAction];

    // Load current state
    const { data: pub, error: fetchErr } = await supabase
      .from('knyt_publication_states')
      .select('id, state, branch, subject_type, subject_id')
      .eq('id', publication_id)
      .single();

    if (fetchErr || !pub)
      return NextResponse.json({ error: 'Publication record not found' }, { status: 404 });

    if (!transition.from.includes(pub.state)) {
      return NextResponse.json(
        { error: `Cannot apply '${action}' from state '${pub.state}'. Expected: ${transition.from.join(' or ')}` },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();

    // Apply transition
    const { data: updated, error: updateErr } = await supabase
      .from('knyt_publication_states')
      .update({
        state: transition.to,
        reviewed_by: actor_persona_id,
        reviewed_at: now,
        review_notes: notes ?? null,
        updated_at: now,
      })
      .eq('id', publication_id)
      .select()
      .single();

    if (updateErr)
      return NextResponse.json({ error: 'Failed to update state', detail: updateErr.message }, { status: 500 });

    // Audit log
    await supabase.from('knyt_publication_state_log').insert({
      publication_id,
      from_state: pub.state,
      to_state: transition.to,
      actor_persona: actor_persona_id,
      reason: notes ?? action,
    });

    // On acceptance: emit contribution reward grant
    if (action === 'approve' || action === 'elevate_eligible') {
      const rewardType = action === 'elevate_eligible'
        ? 'LivingCanonContributionFeatured'
        : 'LivingCanonContributionAccepted';

      // Resolve persona_id from contribution
      const { data: contrib } = await supabase
        .from('crm_contributions')
        .select('persona_id, base_pokw_weight')
        .eq('id', pub.subject_id)
        .maybeSingle();

      if (contrib?.persona_id) {
        await supabase.from('knyt_reward_grants').insert({
          persona_id: contrib.persona_id,
          task_type: rewardType,
          amount_knyt: action === 'elevate_eligible' ? 1.0 : 0.5,
          base_amount_knyt: action === 'elevate_eligible' ? 1.0 : 0.5,
          rep_multiplier: 1.0,
          source_event_id: publication_id,
          metadata: { action, publication_id, branch: pub.branch },
        }).catch((e) => console.warn('[review] reward grant failed (non-fatal):', e));

        // Update contribution status to reflect review outcome
        await supabase
          .from('crm_contributions')
          .update({ status: 'accepted', reviewed_at: now, reviewed_by_persona_id: actor_persona_id })
          .eq('id', pub.subject_id);
      }
    }

    if (action === 'reject') {
      await supabase
        .from('crm_contributions')
        .update({ status: 'rejected', reviewed_at: now, reviewed_by_persona_id: actor_persona_id })
        .eq('id', pub.subject_id);
    }

    return NextResponse.json({ success: true, publication: updated });
  } catch (err) {
    console.error('[living-canon/review] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const states = (searchParams.get('state') ?? 'submitted,under_review').split(',').map(s => s.trim());
    const branch = searchParams.get('branch');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

    let query = supabase
      .from('knyt_publication_states')
      .select('id, subject_type, subject_id, branch, state, created_at, updated_at, review_notes')
      .in('state', states)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (branch) query = query.eq('branch', branch);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ queue: data ?? [], count: (data ?? []).length });
  } catch (err) {
    console.error('[living-canon/review GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
