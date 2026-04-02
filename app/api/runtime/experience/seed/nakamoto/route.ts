/**
 * POST /api/runtime/experience/seed/nakamoto
 *
 * Seeds journey_states from the Nakamoto CRM segment membership data.
 * Reads all 3,748 crm_personas for the nakamoto tenant, resolves each
 * persona's highest Order of Metaiye tier from crm_segment_members, and
 * upserts journey_states with tenant_id='nakamoto'.
 *
 * Source of truth: crm_segments + crm_segment_members (not nakamoto_knyt_personas
 * which only covers the 196 personas who have activated their account).
 *
 * Stage mapping (Order of Metaiye segments):
 *   "Order of Metaiye: SAT"   → zero   (highest tier)
 *   "Order of Metaiye: ZERO"  → zero
 *   "Order of Metaiye: FIRST" → first
 *   "Order of Metaiye: KEJI"  → keji
 *   "Order of Metaiye: KETA"  → keta
 *   Not in any tier segment   → prospect
 *
 * Fallback: Reputation Tier segments (R0_KETA … R4_SAT) used when
 * Order of Metaiye segments are absent.
 *
 * Never regresses: if a persona already has a higher stage in journey_states
 * it is skipped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const STAGE_ORDER = ['prospect', 'acolyte', 'keta', 'keji', 'first', 'zero'];

const STAGE_DEPTH: Record<string, string> = {
  prospect: 'pill',
  acolyte:  'pill',
  keta:     'capsule',
  keji:     'capsule',
  first:    'mini_runtime',
  zero:     'codex',
};

/** Maps CRM segment name → KNYT stage */
function segmentNameToStage(name: string): string | null {
  const n = name.toLowerCase();
  // Order of Metaiye segments
  if (n.includes('order of metaiye')) {
    if (n.includes('sat'))   return 'zero';
    if (n.includes('zero'))  return 'zero';
    if (n.includes('first')) return 'first';
    if (n.includes('keji'))  return 'keji';
    if (n.includes('keta'))  return 'keta';
  }
  // Reputation Tier segments (fallback)
  if (n.includes('reputation tier') || n.includes('r0_keta')) {
    if (n.includes('r4_sat')  || n.includes('sat'))   return 'zero';
    if (n.includes('r3_zero') || n.includes('zero'))  return 'zero';
    if (n.includes('r2_first')|| n.includes('first')) return 'first';
    if (n.includes('r1_keji') || n.includes('keji'))  return 'keji';
    if (n.includes('r0_keta') || n.includes('keta'))  return 'keta';
  }
  return null; // segment not relevant to KNYT ladder
}

function stageRank(s: string): number {
  return STAGE_ORDER.indexOf(s);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // ── 1. Fetch all nakamoto CRM segments ──────────────────────────────────
    const { data: segments, error: segErr } = await supabase
      .from('crm_segments')
      .select('id, name')
      .eq('tenant_id', 'nakamoto');

    if (segErr) {
      return NextResponse.json({ error: `Segment fetch failed: ${segErr.message}` }, { status: 500 });
    }

    // Only keep segments that map to a KNYT stage
    const relevantSegments = (segments ?? [])
      .map((s) => ({ id: s.id as string, stage: segmentNameToStage(s.name) }))
      .filter((s): s is { id: string; stage: string } => s.stage !== null);

    // ── 2. Fetch segment members for all relevant segments ───────────────────
    const segmentIds = relevantSegments.map((s) => s.id);

    // Build stage lookup: segment_id → stage
    const segmentStageMap: Record<string, string> = {};
    for (const s of relevantSegments) segmentStageMap[s.id] = s.stage;

    // Highest stage per persona_id (UUID string)
    const personaStageMap: Record<string, string> = {};

    if (segmentIds.length > 0) {
      // Paginate through members in batches of 1000
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: members, error: memErr } = await supabase
          .from('crm_segment_members')
          .select('segment_id, persona_id')
          .in('segment_id', segmentIds)
          .range(offset, offset + PAGE - 1);

        if (memErr) {
          return NextResponse.json({ error: `Member fetch failed: ${memErr.message}` }, { status: 500 });
        }
        if (!members || members.length === 0) break;

        for (const m of members) {
          const stage = segmentStageMap[m.segment_id as string];
          if (!stage) continue;
          const pid = m.persona_id as string;
          if (!personaStageMap[pid] || stageRank(stage) > stageRank(personaStageMap[pid])) {
            personaStageMap[pid] = stage;
          }
        }

        if (members.length < PAGE) break;
        offset += PAGE;
      }
    }

    // ── 3. Fetch ALL crm_personas for nakamoto ───────────────────────────────
    const allPersonaIds: string[] = [];
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: personas, error: pErr } = await supabase
          .from('crm_personas')
          .select('id')
          .eq('tenant_id', 'nakamoto')
          .range(offset, offset + PAGE - 1);

        if (pErr) {
          return NextResponse.json({ error: `Persona fetch failed: ${pErr.message}` }, { status: 500 });
        }
        if (!personas || personas.length === 0) break;
        for (const p of personas) allPersonaIds.push(p.id as string);
        if (personas.length < PAGE) break;
        offset += PAGE;
      }
    }

    // ── 4. Fetch existing journey_states for nakamoto to avoid regressions ───
    const existingMap: Record<string, { id: string; stage: string; depth: string }> = {};
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: existing } = await supabase
          .from('journey_states')
          .select('id, persona_id, stage, depth')
          .eq('tenant_id', 'nakamoto')
          .range(offset, offset + PAGE - 1);

        if (!existing || existing.length === 0) break;
        for (const e of existing) existingMap[e.persona_id as string] = e as { id: string; stage: string; depth: string };
        if (existing.length < PAGE) break;
        offset += PAGE;
      }
    }

    // ── 5. Build upsert list ─────────────────────────────────────────────────
    const now = new Date().toISOString();
    const upserts: object[] = [];
    const skipped: string[] = [];

    for (const personaId of allPersonaIds) {
      const derivedStage = personaStageMap[personaId] ?? 'prospect';
      const existing = existingMap[personaId];

      // Never regress
      if (existing && stageRank(existing.stage) > stageRank(derivedStage)) {
        skipped.push(personaId);
        continue;
      }

      upserts.push({
        persona_id:  personaId,
        tenant_id:   'nakamoto',
        stage:       derivedStage,
        depth:       existing ? existing.depth : STAGE_DEPTH[derivedStage],
        active_at:   now,
        updated_at:  now,
        ...(existing ? {} : { created_at: now }),
      });
    }

    const stageSummary = upserts.reduce((acc: Record<string, number>, u: any) => {
      acc[u.stage] = (acc[u.stage] ?? 0) + 1;
      return acc;
    }, {});

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        total_personas: allPersonaIds.length,
        would_upsert: upserts.length,
        would_skip: skipped.length,
        stage_distribution: stageSummary,
      });
    }

    // ── 6. Batch upsert ──────────────────────────────────────────────────────
    let seeded = 0;
    const CHUNK = 200;
    for (let i = 0; i < upserts.length; i += CHUNK) {
      const chunk = upserts.slice(i, i + CHUNK);
      const { error: upsertErr } = await supabase
        .from('journey_states')
        .upsert(chunk as any, { onConflict: 'persona_id,tenant_id' });

      if (upsertErr) {
        console.error('[seed/nakamoto] upsert error at chunk', i, upsertErr.message);
      } else {
        seeded += chunk.length;
      }
    }

    return NextResponse.json({
      success: true,
      total_personas: allPersonaIds.length,
      seeded,
      skipped: skipped.length,
      stage_distribution: stageSummary,
      tenant_id: 'nakamoto',
    });
  } catch (error: any) {
    console.error('[seed/nakamoto] error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
