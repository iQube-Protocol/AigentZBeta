/**
 * analysisCards.ts — Sprint 5, COD-502
 *
 * Shared analysis card logic used across Studio, Admin (Codex),
 * and Runtime surfaces. Single source of truth for analysis card
 * generation, filtering, and scoring.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export type AnalysisCardType =
  | 'goal_alignment'
  | 'stage_readiness'
  | 'nbe_confidence'
  | 'blocker'
  | 'rationale'
  | 'recommendation';

export interface AnalysisCard {
  id?: string;
  persona_id: string;
  experience_id: string;
  card_type: AnalysisCardType;
  content: string;
  score: number | null;
  created_at?: string;
}

export interface AnalysisCardFilters {
  personaId: string;
  experienceId?: string;
  cardTypes?: AnalysisCardType[];
  limit?: number;
}

/**
 * Fetch analysis cards for a persona — used by Studio, Codex admin, and runtime.
 */
export async function fetchAnalysisCards(filters: AnalysisCardFilters): Promise<AnalysisCard[]> {
  let query = supabase
    .from('analysis_cards')
    .select('persona_id, experience_id, card_type, content, score, created_at')
    .eq('persona_id', filters.personaId)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 10);

  if (filters.experienceId) query = query.eq('experience_id', filters.experienceId);
  if (filters.cardTypes?.length) query = query.in('card_type', filters.cardTypes);

  const { data } = await query;
  return (data ?? []) as AnalysisCard[];
}

/**
 * Synthesize an analysis summary from cards — used in dashboard and studio views.
 */
export function synthesizeAnalysisSummary(cards: AnalysisCard[]): {
  overall_score: number | null;
  blockers: string[];
  top_recommendation: string | null;
  goal_alignment: number | null;
} {
  const scoreable = cards.filter((c) => c.score != null);
  const overall_score = scoreable.length > 0
    ? Math.round(scoreable.reduce((sum, c) => sum + (c.score ?? 0), 0) / scoreable.length)
    : null;

  const blockers = cards
    .filter((c) => c.card_type === 'blocker')
    .map((c) => c.content);

  const topRec = cards.find((c) => c.card_type === 'recommendation');
  const goalCard = cards.find((c) => c.card_type === 'goal_alignment');

  return {
    overall_score,
    blockers,
    top_recommendation: topRec?.content ?? null,
    goal_alignment: goalCard?.score ?? null,
  };
}

/**
 * COD-502 — Upsert an analysis card (used by orchestration engine and Studio).
 */
export async function upsertAnalysisCard(card: Omit<AnalysisCard, 'id' | 'created_at'>): Promise<void> {
  await supabase.from('analysis_cards').insert({
    persona_id: card.persona_id,
    experience_id: card.experience_id,
    card_type: card.card_type,
    content: card.content,
    score: card.score,
  });
}
