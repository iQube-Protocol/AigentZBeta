/**
 * GET /api/runtime/knyt-state?personaId=<id>
 *
 * Single aggregate endpoint for the KNYT runtime surface.
 * Returns everything needed to render the five P0 cards in one call:
 *
 *   world_header      — title + subtitle derived from journey stage
 *   status_rail       — patronage stage + PCS stage labels
 *   signal_counts     — like / spark / curate totals for this persona
 *   knyt_balance      — total $KNYT granted (pending + settled)
 *   nbe               — active NBEPlan (non-expired), or null
 *   featured_moment   — latest editorial featured item, or null
 *
 * All queries run in parallel. Individual failures degrade gracefully —
 * the field is null rather than erroring the whole response.
 *
 * Phase 1 — KNYT Sprint 1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// PCS axis stages (Participant → Upstream contributor)
const PCS_STAGES = [
  'Participant',
  'Community',
  'Correspondent',
  'Operator',
  'Creator',
  'Upstream',
] as const;

// Patronage axis stages (from KNYT spec)
const PATRONAGE_STAGES = [
  'Outside Order',
  'Apprentice',
  'Knight',
  'Esquire',
  'Sennight',
  'Satoshi',
] as const;

// World header copy per journey stage
const WORLD_HEADER: Record<string, { title: string; subtitle: string }> = {
  prospect:                     { title: 'Welcome to the KNYT World',        subtitle: 'Your journey begins here.' },
  acolyte:                      { title: 'The Order Awaits',                  subtitle: 'You have been noticed.' },
  keta:                         { title: 'Keta Initiate',                     subtitle: 'The codex opens to you.' },
  keji:                         { title: 'Keji Adept',                        subtitle: 'Your signal carries weight.' },
  first:                        { title: 'First-Stage Participant',            subtitle: 'You stand among the vanguard.' },
  zero:                         { title: 'Zero — Sovereign Standing',          subtitle: 'Guardianship is yours.' },
  investor_reactivation_candidate: { title: 'Welcome Back',                   subtitle: 'Your place in the Order is remembered.' },
  collector_only:               { title: 'Collector',                          subtitle: 'The archive honours your curation.' },
  creator_contributor:          { title: 'Creator / Contributor',              subtitle: 'Your craft shapes the canon.' },
};

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function patronageStageFromJourneyStage(stage: string): string {
  const map: Record<string, string> = {
    prospect:  PATRONAGE_STAGES[0],
    acolyte:   PATRONAGE_STAGES[1],
    keta:      PATRONAGE_STAGES[2],
    keji:      PATRONAGE_STAGES[3],
    first:     PATRONAGE_STAGES[4],
    zero:      PATRONAGE_STAGES[5],
  };
  return map[stage] ?? PATRONAGE_STAGES[0];
}

function pcsStageFromSignalCount(total: number): string {
  if (total >= 100) return PCS_STAGES[5];
  if (total >= 50)  return PCS_STAGES[4];
  if (total >= 20)  return PCS_STAGES[3];
  if (total >= 10)  return PCS_STAGES[2];
  if (total >= 3)   return PCS_STAGES[1];
  return PCS_STAGES[0];
}

export async function GET(request: NextRequest) {
  const personaId = request.nextUrl.searchParams.get('personaId');
  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Run all queries in parallel — individual failures are caught and defaulted
  const [journeyResult, signalResult, balanceResult, nbeResult, featuredResult] =
    await Promise.allSettled([
      // Journey state
      db
        .from('journey_states')
        .select('stage, depth, current_experience_id, active_at')
        .eq('persona_id', personaId)
        .order('active_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Signal counts grouped by type
      db
        .from('knyt_signals')
        .select('signal_type')
        .eq('persona_id', personaId),

      // $KNYT balance — knyt_reward_grants.persona_id is UUID, attempt cast
      db
        .from('knyt_reward_grants')
        .select('amount_knyt')
        .eq('persona_id', personaId),

      // Active NBE plan
      db
        .from('nbe_plans')
        .select('id, disposition, next_experience_depth, rationale, expires_at')
        .eq('persona_id', personaId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Latest featured editorial moment
      db
        .from('knyt_editorial_featured')
        .select('content_id, title, summary, featured_at')
        .order('featured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Journey
  const journey =
    journeyResult.status === 'fulfilled' ? journeyResult.value.data : null;
  const stage = journey?.stage ?? 'prospect';
  const depth = journey?.depth ?? 'pill';

  // Signal counts
  const signals =
    signalResult.status === 'fulfilled' ? (signalResult.value.data ?? []) : [];
  const likeCount   = signals.filter((s) => s.signal_type === 'like').length;
  const sparkCount  = signals.filter((s) => s.signal_type === 'spark').length;
  const curateCount = signals.filter((s) => s.signal_type === 'curate').length;
  const totalSignals = likeCount + sparkCount + curateCount;

  // $KNYT balance
  const grants =
    balanceResult.status === 'fulfilled' ? (balanceResult.value.data ?? []) : [];
  const knytBalance = grants.reduce(
    (sum, g) => sum + parseFloat(String(g.amount_knyt ?? 0)),
    0
  );

  // NBE
  const nbe = nbeResult.status === 'fulfilled' ? nbeResult.value.data : null;

  // Featured moment
  const featured =
    featuredResult.status === 'fulfilled' ? featuredResult.value.data : null;

  return NextResponse.json({
    persona_id: personaId,
    world_header: WORLD_HEADER[stage] ?? WORLD_HEADER.prospect,
    status_rail: {
      patronage: {
        stage: patronageStageFromJourneyStage(stage),
        journey_stage: stage,
      },
      pcs: {
        stage: pcsStageFromSignalCount(totalSignals),
        signal_count: totalSignals,
      },
      depth,
    },
    signal_counts: {
      like: likeCount,
      spark: sparkCount,
      curate: curateCount,
      total: totalSignals,
    },
    knyt_balance: parseFloat(knytBalance.toFixed(8)),
    nbe: nbe ?? null,
    featured_moment: featured ?? null,
    journey: journey
      ? { stage, depth, current_experience_id: journey.current_experience_id }
      : null,
  });
}
