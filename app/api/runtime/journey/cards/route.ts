/**
 * GET /api/runtime/journey/cards?personaId=<id>
 *
 * Returns all data needed to render the RuntimeJourneyDeck cards:
 * goals, stage, matrix, NBE, why/rationale, unlocks, handoff context.
 *
 * COD-401..409 — Sprint 4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const STAGE_ORDER = ['prospect', 'acolyte', 'keta', 'keji', 'first', 'zero'];
const DEPTH_ORDER = ['L0', 'L1', 'L2', 'L3'];

function nextStage(stage: string): string | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

function nextDepth(depth: string): string | null {
  const idx = DEPTH_ORDER.indexOf(depth);
  return idx >= 0 && idx < DEPTH_ORDER.length - 1 ? DEPTH_ORDER[idx + 1] : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId');

  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  const [journeyRes, nbeRes, matrixRes, analysisRes, strategyRes] = await Promise.all([
    supabase
      .from('journey_states')
      .select('stage, depth, current_experience_id, completed_experience_ids, active_at')
      .eq('persona_id', personaId)
      .order('active_at', { ascending: false })
      .limit(1),

    supabase
      .from('nbe_plans')
      .select('disposition, next_experience_depth, rationale, experience_id, expires_at')
      .eq('persona_id', personaId)
      .is('expires_at', null)
      .order('created_at', { ascending: false })
      .limit(1),

    supabase
      .from('experience_matrices')
      .select('stage, depth_ladder')
      .order('stage'),

    supabase
      .from('analysis_cards')
      .select('card_type, content, score')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('experience_strategies')
      .select('name, description, target_segments')
      .eq('active', true)
      .limit(1),
  ]);

  const journey = journeyRes.data?.[0] ?? null;
  const nbe = nbeRes.data?.[0] ?? null;
  const matrix = matrixRes.data ?? [];
  const analysis = analysisRes.data ?? [];
  const strategy = strategyRes.data?.[0] ?? null;

  // Goals card — derive from strategy + analysis
  const goals = strategy
    ? {
        summary: strategy.description,
        strategy_name: strategy.name,
        segments: strategy.target_segments ?? [],
      }
    : null;

  // Stage card
  const stageCard = journey
    ? {
        current_stage: journey.stage,
        current_depth: journey.depth,
        next_stage: nextStage(journey.stage),
        completed_count: (journey.completed_experience_ids ?? []).length,
        active_at: journey.active_at,
      }
    : null;

  // Matrix status card — simplified user-facing
  const currentStageMatrix = matrix.find((m) => m.stage === journey?.stage);
  const matrixCard = currentStageMatrix
    ? {
        current_stage: journey?.stage ?? null,
        available_depths: currentStageMatrix.depth_ladder,
        current_depth: journey?.depth ?? null,
        progress_pct: journey
          ? Math.round(
              (DEPTH_ORDER.indexOf(journey.depth) /
                Math.max(currentStageMatrix.depth_ladder.length - 1, 1)) *
                100
            )
          : 0,
      }
    : null;

  // NBE card
  const nbeCard = nbe
    ? {
        disposition: nbe.disposition,
        next_depth: nbe.next_experience_depth,
        experience_id: nbe.experience_id,
        cta:
          nbe.disposition === 'act'
            ? 'Continue your journey'
            : nbe.disposition === 'ask'
            ? 'Share your thoughts'
            : nbe.disposition === 'wait'
            ? 'Check back soon'
            : nbe.disposition === 'escalate'
            ? 'Connect with your guide'
            : null,
      }
    : null;

  // Why card — rationale from NBE plan or analysis
  const whyCard = nbe?.rationale
    ? { rationale: nbe.rationale, source: 'nbe_plan' }
    : analysis.find((a) => a.card_type === 'rationale')
    ? { rationale: analysis.find((a) => a.card_type === 'rationale')!.content, source: 'analysis' }
    : null;

  // Unlocks card — next stage/depth preview
  const unlocksCard = journey
    ? {
        next_stage: nextStage(journey.stage),
        next_depth: nextDepth(journey.depth),
        hint:
          nextStage(journey.stage)
            ? `Unlock ${nextStage(journey.stage)} by completing your current ${journey.stage} path.`
            : 'You are approaching the final stage of your journey.',
      }
    : null;

  // Handoff card — active guide context from NBE disposition
  const handoffCard = {
    active_agent:
      nbe?.disposition === 'escalate' ? 'Aigent C' : 'Aigent Z',
    reason:
      nbe?.disposition === 'escalate'
        ? 'Your guide is ready to connect with you directly.'
        : 'Aigent Z is routing your next experience.',
    stage: journey?.stage ?? null,
  };

  // KNYT recognition (COD-409) — is this a returning KNYT user?
  const isKnytUser = journey != null;
  const knytRecognition = isKnytUser
    ? {
        recognized: true,
        stage: journey!.stage,
        message:
          journey!.stage === 'prospect'
            ? 'Welcome to KNYT. Your journey begins here.'
            : `Welcome back. You're on the ${journey!.stage} path.`,
      }
    : { recognized: false, message: 'Start your KNYT journey today.' };

  return NextResponse.json({
    persona_id: personaId,
    has_journey: journey != null,
    knyt_recognition: knytRecognition,
    cards: {
      goals: goals,
      stage: stageCard,
      matrix: matrixCard,
      nbe: nbeCard,
      why: whyCard,
      unlocks: unlocksCard,
      handoff: handoffCard,
    },
  });
}
