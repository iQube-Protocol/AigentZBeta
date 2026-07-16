/**
 * GET /api/runtime/nbe?personaId=<id>[&experienceId=<id>]
 *
 * Returns the active NBEPlan for a persona. If a valid (non-expired) plan
 * already exists it is returned as-is. Otherwise one is computed from the
 * persona's current journey_state + experience_matrices and persisted.
 *
 * Emits a 'nbe_recommendation' telemetry event on every computed plan.
 *
 * Phase 1 — KNYT Sprint 1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitJourneyTelemetry } from '@/services/orchestration/journeyTelemetry';
import { runValueShadow } from '@/services/invariants/engine';
import { DEPTH_LADDER, journeyProgressionProjector } from '@/services/invariants/nodes/journeyProgression';
import type { JourneyStage } from '@/types/orchestration';

export const dynamic = 'force-dynamic';

// Depth ladder for KNYT (L0 → L3 maps to pill → codex in experience_matrices)
const DEPTH_LADDER = ['pill', 'capsule', 'mini_runtime', 'codex'] as const;
type Depth = typeof DEPTH_LADDER[number];

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function nextDepth(current: string): Depth {
  const idx = DEPTH_LADDER.indexOf(current as Depth);
  return idx >= 0 && idx < DEPTH_LADDER.length - 1
    ? DEPTH_LADDER[idx + 1]
    : (current as Depth) ?? 'pill';
}

function dispositionForStage(stage: string): string {
  // Sovereign / escalation stages require guardian approval
  if (stage === 'zero' || stage === 'investor_reactivation_candidate') return 'ask';
  return 'act';
}

function rationaleForStage(stage: string, depth: string, nextDep: string): string {
  const stageLabels: Record<string, string> = {
    prospect: 'new prospect',
    acolyte: 'acolyte',
    keta: 'keta initiate',
    keji: 'keji adept',
    first: 'first-stage participant',
    zero: 'zero-stage sovereign',
    investor_reactivation_candidate: 'investor reactivation candidate',
    collector_only: 'collector',
    creator_contributor: 'creator/contributor',
  };
  const label = stageLabels[stage] ?? stage;
  return `${label} at ${depth} depth — next recommended experience: ${nextDep}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const personaId = searchParams.get('personaId');
  const experienceId = searchParams.get('experienceId');

  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // 1. Return cached non-expired plan if available
  let planQuery = db
    .from('nbe_plans')
    .select('*')
    .eq('persona_id', personaId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (experienceId) planQuery = planQuery.eq('experience_id', experienceId);

  const { data: cached } = await planQuery.maybeSingle();
  if (cached) {
    return NextResponse.json({ nbe: cached, source: 'cached' });
  }

  // 2. Fetch current journey state
  const { data: journey } = await db
    .from('journey_states')
    .select('stage, depth, current_experience_id')
    .eq('persona_id', personaId)
    .order('active_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const stage = journey?.stage ?? 'prospect';
  const depth = journey?.depth ?? 'pill';
  const resolvedExperienceId = experienceId ?? journey?.current_experience_id ?? null;

  // 3. Check experience_matrices for a depth_ladder entry at this stage
  const { data: matrix } = await db
    .from('experience_matrices')
    .select('depth_ladder')
    .eq('stage', stage)
    .limit(1)
    .maybeSingle();

  // Use matrix-prescribed next depth if available, else derive from ladder
  let recDepth: string = nextDepth(depth);
  if (matrix?.depth_ladder && Array.isArray(matrix.depth_ladder)) {
    const matrixLadder = matrix.depth_ladder as string[];
    const currentIdx = matrixLadder.indexOf(depth);
    if (currentIdx >= 0 && currentIdx < matrixLadder.length - 1) {
      recDepth = matrixLadder[currentIdx + 1];
    }
  }

  const disposition = dispositionForStage(stage);
  const rationale = rationaleForStage(stage, depth, recDepth);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h TTL

  // CFS-035 — the journey-progression Invariant Decision Node runs in SHADOW on
  // the universal ExperienceStage axis: it re-expresses the next-depth decision
  // as a transparent value projection and emits the delta vs the incumbent
  // (matrix-or-ladder) depth. Observe-only — `recDepth`/`disposition` are served
  // unchanged. runValueShadow never throws.
  runValueShadow(
    DEPTH_LADDER.indexOf(recDepth as (typeof DEPTH_LADDER)[number]),
    journeyProgressionProjector({ journeyStage: stage as JourneyStage, currentDepth: depth }),
  );

  // 4. Persist computed plan
  const { data: nbe, error } = await db
    .from('nbe_plans')
    .insert({
      persona_id: personaId,
      experience_id: resolvedExperienceId,
      disposition,
      next_experience_depth: recDepth,
      rationale,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 5. Emit telemetry (fire-and-forget)
  void emitJourneyTelemetry({
    event: 'nbe_recommendation',
    persona_id: personaId,
    from_stage: stage,
    to_stage: stage,
    from_depth: depth,
    to_depth: recDepth,
    disposition,
    rationale,
    experience_id: resolvedExperienceId ?? undefined,
  });

  return NextResponse.json({ nbe, source: 'computed' });
}
