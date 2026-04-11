/**
 * GET /api/runtime/experience?experienceId=<id>&personaId=<id>
 *
 * Returns experience model data for the Studio Experience tab:
 * journey state, NBE plan, strategy, model, matrix, analysis cards.
 *
 * Epic 2A — EXP-201
 * Canonical source: docs/agent-harness/journey-state-schema.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const experienceId = searchParams.get('experienceId');
  const personaId = searchParams.get('personaId');

  if (!experienceId) {
    return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  }

  const [journeyRes, nbeRes, strategyRes, modelRes, matrixRes, analysisRes] = await Promise.all([
    // Journey state for this persona (most recent)
    personaId
      ? supabase
          .from('journey_states')
          .select('stage, depth, active_at')
          .eq('persona_id', personaId)
          .order('active_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null }),

    // Active NBE plan for this experience + persona
    personaId
      ? supabase
          .from('nbe_plans')
          .select('disposition, next_experience_depth, rationale, expires_at')
          .eq('experience_id', experienceId)
          .eq('persona_id', personaId)
          .is('expires_at', null)
          .limit(1)
      : Promise.resolve({ data: null }),

    // Strategy linked via model→matrix chain — fetch all active strategies for now
    supabase
      .from('experience_strategies')
      .select('name, description, target_segments')
      .eq('active', true)
      .limit(1),

    // Experience model (first active)
    supabase
      .from('experience_models')
      .select('name, description, stages')
      .limit(1),

    // Matrix rows
    supabase
      .from('experience_matrices')
      .select('stage, depth_ladder')
      .order('stage'),

    // Analysis cards for this experience + persona
    personaId
      ? supabase
          .from('analysis_cards')
          .select('card_type, content, score')
          .eq('experience_id', experienceId)
          .eq('persona_id', personaId)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    journey: journeyRes.data?.[0] ?? null,
    nbe: nbeRes.data?.[0] ?? null,
    strategy: strategyRes.data?.[0] ?? null,
    model: modelRes.data?.[0] ?? null,
    matrix: matrixRes.data ?? null,
    analysis: analysisRes.data ?? null,
  });
}
