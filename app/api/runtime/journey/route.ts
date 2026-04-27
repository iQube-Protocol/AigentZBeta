/**
 * GET  /api/runtime/journey?personaId=<id>
 *   Returns the most recent journey_state row for a persona.
 *
 * PATCH /api/runtime/journey
 *   Body: { personaId, stage?, depth?, active_cartridge?, active_codex? }
 *   Upserts the journey state and emits telemetry when stage or depth changes.
 *
 * Phase 1 — KNYT Sprint 1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitJourneyTelemetry } from '@/services/orchestration/journeyTelemetry';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const personaId = request.nextUrl.searchParams.get('personaId');
  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('journey_states')
    .select('*')
    .eq('persona_id', personaId)
    .order('active_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ journey: data ?? null });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { personaId, stage, depth, active_cartridge, active_codex, completed_experience_ids } = body;

  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  const db = getDb();

  // Fetch existing state to detect stage / depth changes for telemetry
  const { data: existing } = await db
    .from('journey_states')
    .select('id, stage, depth')
    .eq('persona_id', personaId)
    .order('active_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    active_at: new Date().toISOString(),
  };
  if (stage !== undefined) updates.stage = stage;
  if (depth !== undefined) updates.depth = depth;
  if (active_cartridge !== undefined) updates.current_experience_id = active_cartridge;
  if (active_codex !== undefined) updates.active_codex = active_codex;
  if (completed_experience_ids !== undefined) updates.completed_experience_ids = completed_experience_ids;

  let result;
  if (existing?.id) {
    const { data, error } = await db
      .from('journey_states')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  } else {
    const { data, error } = await db
      .from('journey_states')
      .insert({ persona_id: personaId, ...updates })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  // Emit telemetry for stage change
  if (stage && stage !== existing?.stage) {
    void emitJourneyTelemetry({
      event: 'stage_change',
      persona_id: personaId,
      from_stage: existing?.stage,
      to_stage: stage,
      metadata: { active_cartridge, active_codex },
    });
  }

  // Emit telemetry for depth change
  if (depth && depth !== existing?.depth) {
    void emitJourneyTelemetry({
      event: 'experience_activated',
      persona_id: personaId,
      from_depth: existing?.depth,
      to_depth: depth,
      metadata: { active_cartridge },
    });
  }

  return NextResponse.json({ journey: result });
}
