/**
 * POST /api/runtime/experience/seed/nakamoto
 *
 * Seeds journey_states from the Nakamoto CRM (nakamoto_knyt_personas).
 * Maps OM-Tier-Status → KNYT stage so the Experience Dashboard is populated
 * with real investor cohort data without migrating or duplicating the CRM.
 *
 * Upserts — safe to re-run; existing journey states for Nakamoto personas are
 * refreshed but their stage/depth are only advanced, never regressed.
 *
 * Stage mapping:
 *   ZERO / Zero / SAT  → zero
 *   FIRST / First      → first
 *   KEJI / Keji        → keji
 *   KETA / Keta        → keta
 *   OM member (no tier)→ acolyte
 *   (empty / unknown)  → prospect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const STAGE_ORDER = ['prospect', 'acolyte', 'keta', 'keji', 'first', 'zero'];

// Depth is the deepest experience type unlocked at each stage.
// Set conservatively — actual depth is advanced as experiences are completed.
const STAGE_DEPTH: Record<string, string> = {
  prospect: 'pill',
  acolyte: 'pill',
  keta: 'capsule',
  keji: 'capsule',
  first: 'mini_runtime',
  zero: 'codex',
};

function mapTierToStage(tier: string | null | undefined): string {
  const t = (tier ?? '').toLowerCase().trim();
  if (t === 'zero' || t === 'sat') return 'zero';
  if (t === 'first') return 'first';
  if (t === 'keji') return 'keji';
  if (t === 'keta') return 'keta';
  if (t) return 'acolyte'; // Has a value but unknown tier — treat as engaged
  return 'prospect';
}

function isHigherStage(a: string, b: string): boolean {
  return STAGE_ORDER.indexOf(a) > STAGE_ORDER.indexOf(b);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Fetch all Nakamoto KNYT personas
    const { data: personas, error: fetchError } = await supabase
      .from('nakamoto_knyt_personas')
      .select('"id", "user_id", "KNYT-ID", "Email", "First-Name", "Last-Name", "OM-Tier-Status", "OM-Member-Since"');

    if (fetchError) {
      return NextResponse.json({ error: `Failed to fetch Nakamoto personas: ${fetchError.message}` }, { status: 500 });
    }

    if (!personas || personas.length === 0) {
      return NextResponse.json({ message: 'No Nakamoto personas found', seeded: 0 });
    }

    // Fetch existing journey_states for nakamoto tenant to avoid regressions
    const personaIdStrings = personas.map((p) => p.user_id?.toString()).filter(Boolean);
    const { data: existingStates } = await supabase
      .from('journey_states')
      .select('id, persona_id, stage, depth')
      .eq('tenant_id', 'nakamoto')
      .in('persona_id', personaIdStrings);

    const existingByPersona: Record<string, { id: string; stage: string; depth: string }> = {};
    for (const s of existingStates ?? []) {
      existingByPersona[s.persona_id] = s;
    }

    const now = new Date().toISOString();
    const upserts: object[] = [];
    const skipped: string[] = [];

    for (const p of personas) {
      const personaId = p.user_id?.toString();
      if (!personaId) continue;

      const derivedStage = mapTierToStage(p['OM-Tier-Status']);
      const derivedDepth = STAGE_DEPTH[derivedStage];
      const existing = existingByPersona[personaId];

      // Never regress a persona's stage
      if (existing && isHigherStage(existing.stage, derivedStage)) {
        skipped.push(personaId);
        continue;
      }

      upserts.push({
        persona_id: personaId,
        tenant_id: 'nakamoto',
        stage: derivedStage,
        depth: existing ? existing.depth : derivedDepth,
        active_at: now,
        updated_at: now,
        ...(existing ? {} : { created_at: now }),
      });
    }

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        total_personas: personas.length,
        would_upsert: upserts.length,
        would_skip: skipped.length,
        stage_preview: upserts.reduce((acc: Record<string, number>, u: any) => {
          acc[u.stage] = (acc[u.stage] ?? 0) + 1;
          return acc;
        }, {}),
      });
    }

    // Batch upsert in chunks of 100
    let seeded = 0;
    const CHUNK = 100;
    for (let i = 0; i < upserts.length; i += CHUNK) {
      const chunk = upserts.slice(i, i + CHUNK);
      const { error: upsertError } = await supabase
        .from('journey_states')
        .upsert(chunk as any, { onConflict: 'persona_id,tenant_id' });

      if (upsertError) {
        console.error('[seed/nakamoto] upsert error:', upsertError);
        // Continue with remaining chunks; report partial success
      } else {
        seeded += chunk.length;
      }
    }

    // Build stage distribution summary
    const stageSummary = upserts.reduce((acc: Record<string, number>, u: any) => {
      acc[u.stage] = (acc[u.stage] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      total_personas: personas.length,
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
