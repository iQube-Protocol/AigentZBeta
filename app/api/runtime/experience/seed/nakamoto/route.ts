/**
 * POST /api/runtime/experience/seed/nakamoto
 *
 * Seeds journey_states from personas.order_tier for the nakamoto tenant.
 * Reads all personas with tenant_id='nakamoto' from the `personas` table,
 * maps the order_tier column → KNYT stage, and upserts journey_states.
 *
 * Stage mapping (personas.order_tier ENUM):
 *   SAT   → zero   (highest tier)
 *   ZERO  → zero
 *   FIRST → first
 *   KEJI  → keji
 *   KETA  → keta
 *   NONE  → prospect
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

function orderTierToStage(tier: string | null): string {
  switch ((tier ?? '').toUpperCase()) {
    case 'SAT':   return 'zero';
    case 'ZERO':  return 'zero';
    case 'FIRST': return 'first';
    case 'KEJI':  return 'keji';
    case 'KETA':  return 'keta';
    default:      return 'prospect';
  }
}

function stageRank(s: string): number {
  return STAGE_ORDER.indexOf(s);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // ── 1. Fetch ALL personas for nakamoto from the `personas` table ─────────
    // personas.order_tier is the authoritative source for KNYT tier data
    const allPersonas: { id: string; order_tier: string | null }[] = [];
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: batch, error: pErr } = await supabase
          .from('personas')
          .select('id, order_tier')
          .eq('tenant_id', 'nakamoto')
          .range(offset, offset + PAGE - 1);

        if (pErr) {
          return NextResponse.json(
            { error: `Persona fetch failed: ${pErr.message}` },
            { status: 500 }
          );
        }
        if (!batch || batch.length === 0) break;
        for (const p of batch) {
          allPersonas.push({ id: p.id as string, order_tier: p.order_tier as string | null });
        }
        if (batch.length < PAGE) break;
        offset += PAGE;
      }
    }

    // ── 2. Fetch existing journey_states to avoid regressions ────────────────
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
        for (const e of existing) {
          existingMap[e.persona_id as string] = e as { id: string; stage: string; depth: string };
        }
        if (existing.length < PAGE) break;
        offset += PAGE;
      }
    }

    // ── 3. Build upsert list ─────────────────────────────────────────────────
    const now = new Date().toISOString();
    const upserts: object[] = [];
    const skipped: string[] = [];

    // Track stage distribution for the seed result
    const tierCounts: Record<string, number> = {};

    for (const persona of allPersonas) {
      const derivedStage = orderTierToStage(persona.order_tier);
      tierCounts[derivedStage] = (tierCounts[derivedStage] ?? 0) + 1;

      const existing = existingMap[persona.id];

      // Never regress
      if (existing && stageRank(existing.stage) > stageRank(derivedStage)) {
        skipped.push(persona.id);
        continue;
      }

      upserts.push({
        persona_id:  persona.id,
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
        total_personas: allPersonas.length,
        would_upsert: upserts.length,
        would_skip: skipped.length,
        stage_distribution: stageSummary,
        source_tier_counts: tierCounts,
      });
    }

    // ── 4. Batch upsert ──────────────────────────────────────────────────────
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
      total_personas: allPersonas.length,
      seeded,
      skipped: skipped.length,
      stage_distribution: stageSummary,
      source_tier_counts: tierCounts,
      tenant_id: 'nakamoto',
    });
  } catch (error: any) {
    console.error('[seed/nakamoto] error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
