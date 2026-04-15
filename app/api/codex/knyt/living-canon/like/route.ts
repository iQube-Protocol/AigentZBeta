/**
 * KNYT Living Canon — Like Signal
 *
 * Records a positive engagement signal on a KNYT publication.
 * One like per persona per content (unique constraint enforced at DB).
 * Emits a small $KNYT micro-reward (LivingCanonLikeCast).
 *
 * POST body:
 *   content_id      string   required — publication being liked
 *   persona_id      string   required
 *   wallet_task_id  string   optional — SmartWallet task reference
 *
 * Flow:
 *   1. Validate inputs.
 *   2. Insert knyt_signals row (unique constraint prevents double-like).
 *   3. Emit micro-reward grant (fire-and-forget, non-blocking).
 *   4. Return signal_id + reward_preview.
 *
 * Reward: LIKE_REWARD_KNYT (1.0 KNYT) — cartridge-local $KNYT only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitJourneyTelemetry } from '@/services/orchestration/journeyTelemetry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIKE_REWARD_KNYT = 1.0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, persona_id, wallet_task_id } = body;

    if (typeof content_id !== 'string' || !content_id)
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 });
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });

    // Insert signal — unique(persona_id, content_id, signal_type) prevents double-like
    const { data: signal, error: signalErr } = await supabase
      .from('knyt_signals')
      .insert({
        persona_id,
        content_id,
        signal_type: 'like',
        wallet_task_id: typeof wallet_task_id === 'string' ? wallet_task_id : null,
      })
      .select()
      .single();

    if (signalErr) {
      if (signalErr.code === '23505')
        return NextResponse.json({ error: 'Already liked this content' }, { status: 409 });
      throw signalErr;
    }

    // Emit orchestration telemetry — fire-and-forget
    void emitJourneyTelemetry({
      event: 'experience_activated',
      persona_id,
      agent_id: 'aigent-kn0w1',
      metadata: {
        signal_type: 'like',
        content_id,
        signal_id: signal.id,
        reward_knyt: LIKE_REWARD_KNYT,
        active_cartridge: 'knyt',
      },
    });

    // Emit micro-reward — async, non-blocking
    supabase.from('knyt_reward_grants').insert({
      persona_id,
      task_type: 'LivingCanonLikeCast',
      amount_knyt: LIKE_REWARD_KNYT,
      base_amount_knyt: LIKE_REWARD_KNYT,
      rep_multiplier: 1.0,
      source_event_id: signal.id,
      metadata: { content_id, signal_id: signal.id, wallet_task_id: wallet_task_id ?? null },
    }).then(() => {/* fire-and-forget */}).catch((e) => {
      console.warn('[like] reward grant insert failed (non-fatal):', e);
    });

    return NextResponse.json({
      success: true,
      signal_id: signal.id,
      reward_preview: {
        amount: LIKE_REWARD_KNYT,
        asset: 'KNYT',
        note: 'Micro-reward credited to $KNYT balance',
      },
    });
  } catch (err) {
    console.error('[living-canon/like] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
