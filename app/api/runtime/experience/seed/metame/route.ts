/**
 * POST /api/runtime/experience/seed/metame
 *
 * Seeds journey_states from personas for the metaMe tenant.
 *
 * Stage mapping (personas.order_tier or status):
 *   Maps canonical metaMe sovereignty stages:
 *   visitor → initiate → participant → curator → composer → operator → architect
 *
 * For alpha: seeds all personas with tenant_id='metame' into journey_states
 * starting at 'visitor' (or higher if order_tier provides a signal).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const STAGE_ORDER = ['visitor', 'initiate', 'participant', 'curator', 'composer', 'operator', 'architect'];

const STAGE_DEPTH: Record<string, string> = {
  visitor:     'pill',
  initiate:    'pill',
  participant: 'capsule',
  curator:     'capsule',
  composer:    'mini_runtime',
  operator:    'codex',
  architect:   'codex',
};

function orderTierToStage(tier: string | null): string {
  switch ((tier ?? '').toUpperCase()) {
    case 'ARCHITECT': return 'architect';
    case 'OPERATOR':  return 'operator';
    case 'COMPOSER':  return 'composer';
    case 'CURATOR':   return 'curator';
    case 'PARTICIPANT': return 'participant';
    case 'INITIATE':  return 'initiate';
    default:          return 'visitor';
  }
}

function stageRank(s: string): number {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // ── 0. Resolve metame slug → tenant UUID ──────────────────────────────────
    const { data: tenantRow, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', 'metame')
      .maybeSingle();

    if (tenantErr) {
      return NextResponse.json(
        { error: `Tenant lookup failed: ${tenantErr.message}` },
        { status: 500 }
      );
    }

    const metameTenantUUID: string = tenantRow?.id ?? 'metame';

    // ── 1. Fetch ALL personas for metaMe ──────────────────────────────────────
    const allPersonas: { id: string; order_tier: string | null }[] = [];
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: batch, error: pErr } = await supabase
          .from('personas')
          .select('id, order_tier')
          .eq('tenant_id', metameTenantUUID)
          .range(offset, offset + PAGE - 1);

        if (pErr) {
          return NextResponse.json(
            { error: `Persona fetch failed at offset ${offset}: ${pErr.message}` },
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

    if (allPersonas.length === 0) {
      return NextResponse.json({
        seeded: 0,
        skipped: 0,
        message: `No personas found for metaMe tenant (UUID: ${metameTenantUUID}). Personas will be seeded as users onboard.`,
        tenant_uuid: metameTenantUUID,
      });
    }

    // ── 2. Fetch existing journey_states for metaMe ───────────────────────────
    const existingMap: Record<string, { stage: string; depth: string }> = {};
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: existing, error: eErr } = await supabase
          .from('journey_states')
          .select('persona_id, stage, depth')
          .eq('tenant_id', 'metame')
          .range(offset, offset + PAGE - 1);

        if (eErr) break;
        if (!existing || existing.length === 0) break;
        for (const e of existing) {
          existingMap[e.persona_id as string] = { stage: e.stage as string, depth: e.depth as string };
        }
        if (existing.length < PAGE) break;
        offset += PAGE;
      }
    }

    // ── 3. Build insert list (never regress) ──────────────────────────────────
    const now = new Date().toISOString();
    const toInsert: Record<string, unknown>[] = [];
    const skipped: string[] = [];
    const tierCounts: Record<string, number> = {};

    for (const persona of allPersonas) {
      const derivedStage = orderTierToStage(persona.order_tier);
      tierCounts[derivedStage] = (tierCounts[derivedStage] ?? 0) + 1;

      const existing = existingMap[persona.id];

      if (existing && stageRank(existing.stage) > stageRank(derivedStage)) {
        skipped.push(persona.id);
        continue;
      }

      toInsert.push({
        persona_id:  persona.id,
        tenant_id:   'metame',
        stage:       derivedStage,
        depth:       existing ? existing.depth : STAGE_DEPTH[derivedStage],
        active_at:   now,
        updated_at:  now,
        created_at:  now,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        tenant_uuid: metameTenantUUID,
        total_personas: allPersonas.length,
        would_insert: toInsert.length,
        would_skip: skipped.length,
        stage_distribution: toInsert.reduce((acc: Record<string, number>, u) => {
          const stage = u.stage as string;
          acc[stage] = (acc[stage] ?? 0) + 1;
          return acc;
        }, {}),
      });
    }

    // ── 4. Insert in chunks ────────────────────────────────────────────────────
    const CHUNK = 200;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error: insErr } = await supabase
        .from('journey_states')
        .insert(toInsert.slice(i, i + CHUNK));
      if (insErr) {
        errors.push(`Chunk ${i}–${i + CHUNK}: ${insErr.message}`);
      } else {
        inserted += Math.min(CHUNK, toInsert.length - i);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ seeded: inserted, skipped: skipped.length, errors }, { status: 207 });
    }

    return NextResponse.json({
      seeded: inserted,
      skipped: skipped.length,
      tenant: 'metame',
      tenant_uuid: metameTenantUUID,
      stage_distribution: toInsert.reduce((acc: Record<string, number>, u) => {
        const stage = u.stage as string;
        acc[stage] = (acc[stage] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
