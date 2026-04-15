/**
 * KNYT Living Canon — Curate Signal
 *
 * Records an editorial curation signal on a KNYT publication.
 * Curation indicates the persona is selecting this content as
 * worth elevating or including in a curated set. An optional
 * note provides editorial context.
 *
 * Curation does not emit a direct micro-reward (curation is a
 * contribution signal; reward is handled via the contribution
 * and PCS progression pathways).
 *
 * POST body:
 *   content_id      string   required — publication being curated
 *   persona_id      string   required
 *   note            string   optional — editorial curation note (max 280 chars)
 *   wallet_task_id  string   optional — SmartWallet task reference
 *
 * Flow:
 *   1. Validate inputs.
 *   2. Insert knyt_signals row (unique constraint prevents double-curation).
 *   3. Return signal_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitJourneyTelemetry } from '@/services/orchestration/journeyTelemetry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, persona_id, note, wallet_task_id } = body;

    if (typeof content_id !== 'string' || !content_id)
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 });
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });

    const sanitizedNote = typeof note === 'string'
      ? note.trim().slice(0, 280)
      : null;

    // Insert signal — unique(persona_id, content_id, signal_type) prevents double-curation
    const { data: signal, error: signalErr } = await supabase
      .from('knyt_signals')
      .insert({
        persona_id,
        content_id,
        signal_type: 'curate',
        note: sanitizedNote,
        wallet_task_id: typeof wallet_task_id === 'string' ? wallet_task_id : null,
      })
      .select()
      .single();

    if (signalErr) {
      if (signalErr.code === '23505')
        return NextResponse.json({ error: 'Already curated this content' }, { status: 409 });
      throw signalErr;
    }

    // Emit orchestration telemetry — fire-and-forget
    void emitJourneyTelemetry({
      event: 'experience_activated',
      persona_id,
      agent_id: 'aigent-kn0w1',
      metadata: {
        signal_type: 'curate',
        content_id,
        signal_id: signal.id,
        active_cartridge: 'knyt',
      },
    });

    return NextResponse.json({
      success: true,
      signal_id: signal.id,
    });
  } catch (err) {
    console.error('[living-canon/curate] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
