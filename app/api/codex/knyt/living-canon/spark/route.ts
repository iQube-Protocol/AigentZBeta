/**
 * KNYT Living Canon — Spark Signal
 *
 * Records a strong endorsement/highlight signal on a KNYT publication.
 * Spark is a higher-intent signal than Like — it surfaces content to
 * wider audience and carries a larger $KNYT micro-reward.
 * One spark per persona per content (unique constraint enforced at DB).
 *
 * POST body:
 *   content_id      string   required — publication being sparked
 *   persona_id      string   required
 *   wallet_task_id  string   optional — SmartWallet task reference
 *
 * Flow:
 *   1. Validate inputs.
 *   2. Insert knyt_signals row (unique constraint prevents double-spark).
 *   3. Emit micro-reward grant (fire-and-forget, non-blocking).
 *   4. Return signal_id + reward_preview.
 *
 * Reward: SPARK_REWARD_KNYT (2.5 KNYT) — cartridge-local $KNYT only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SPARK_REWARD_KNYT = 2.5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, persona_id, wallet_task_id } = body;

    if (typeof content_id !== 'string' || !content_id)
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 });
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });

    // Insert signal — unique(persona_id, content_id, signal_type) prevents double-spark
    const { data: signal, error: signalErr } = await supabase
      .from('knyt_signals')
      .insert({
        persona_id,
        content_id,
        signal_type: 'spark',
        wallet_task_id: typeof wallet_task_id === 'string' ? wallet_task_id : null,
      })
      .select()
      .single();

    if (signalErr) {
      if (signalErr.code === '23505')
        return NextResponse.json({ error: 'Already sparked this content' }, { status: 409 });
      throw signalErr;
    }

    // Emit micro-reward — async, non-blocking
    supabase.from('knyt_reward_grants').insert({
      persona_id,
      task_type: 'LivingCanonSparkCast',
      amount_knyt: SPARK_REWARD_KNYT,
      base_amount_knyt: SPARK_REWARD_KNYT,
      rep_multiplier: 1.0,
      source_event_id: signal.id,
      metadata: { content_id, signal_id: signal.id, wallet_task_id: wallet_task_id ?? null },
    }).then(() => {/* fire-and-forget */}).catch((e) => {
      console.warn('[spark] reward grant insert failed (non-fatal):', e);
    });

    return NextResponse.json({
      success: true,
      signal_id: signal.id,
      reward_preview: {
        amount: SPARK_REWARD_KNYT,
        asset: 'KNYT',
        note: 'Spark reward credited to $KNYT balance',
      },
    });
  } catch (err) {
    console.error('[living-canon/spark] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
