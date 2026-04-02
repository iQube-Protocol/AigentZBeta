/**
 * POST /api/runtime/experience/seed/nakamoto
 *
 * Seeds journey_states from personas.order_tier for the nakamoto tenant.
 *
 * Strategy:
 *   1. Resolve 'nakamoto' slug → tenant UUID (personas.tenant_id is a UUID)
 *   2. Page through all personas for that UUID tenant
 *   3. Fetch existing journey_states (keyed by persona_id) to apply never-regress rule
 *   4. Delete all stale nakamoto journey_states whose persona_id is no longer
 *      in the personas table (cleanup of old crm_personas-sourced records)
 *   5. Bulk INSERT new records in chunks of 200
 *      Uses INSERT not upsert — avoids depending on a UNIQUE constraint existing.
 *
 * Stage mapping (personas.order_tier ENUM):
 *   SAT   → zero   (highest tier, fully committed investor)
 *   ZERO  → zero
 *   FIRST → first
 *   KEJI  → keji
 *   KETA  → keta
 *   NONE  → prospect
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
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // ── 0. Resolve nakamoto slug → tenant UUID ────────────────────────────────
    const { data: tenantRow, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .or('id.eq.nakamoto,slug.eq.nakamoto')
      .maybeSingle();

    if (tenantErr) {
      return NextResponse.json(
        { error: `Tenant lookup failed: ${tenantErr.message}` },
        { status: 500 }
      );
    }

    const nakamotoTenantUUID: string = tenantRow?.id ?? 'nakamoto';

    // ── 1. Fetch ALL personas for nakamoto (by UUID) ──────────────────────────
    const allPersonas: { id: string; order_tier: string | null }[] = [];
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: batch, error: pErr } = await supabase
          .from('personas')
          .select('id, order_tier')
          .eq('tenant_id', nakamotoTenantUUID)
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
        error: `No personas found for tenant UUID '${nakamotoTenantUUID}' (resolved from slug 'nakamoto'). Check that personas.tenant_id matches this UUID.`,
        tenant_uuid: nakamotoTenantUUID,
      }, { status: 404 });
    }

    // ── 2. Fetch existing journey_states for this tenant ─────────────────────
    const existingMap: Record<string, { stage: string; depth: string }> = {};
    {
      let offset = 0;
      const PAGE = 1000;
      // Try filtering by tenant_id; if column doesn't exist we fall through
      while (true) {
        const { data: existing, error: eErr } = await supabase
          .from('journey_states')
          .select('persona_id, stage, depth')
          .eq('tenant_id', 'nakamoto')
          .range(offset, offset + PAGE - 1);

        if (eErr) {
          // tenant_id column may not exist yet — skip existing check
          break;
        }
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

    const personaIdSet = new Set(allPersonas.map((p) => p.id));

    for (const persona of allPersonas) {
      const derivedStage = orderTierToStage(persona.order_tier);
      tierCounts[derivedStage] = (tierCounts[derivedStage] ?? 0) + 1;

      const existing = existingMap[persona.id];

      // Never regress: if existing stage is higher, preserve it
      if (existing && stageRank(existing.stage) > stageRank(derivedStage)) {
        skipped.push(persona.id);
        continue;
      }

      toInsert.push({
        persona_id:  persona.id,
        tenant_id:   'nakamoto',
        stage:       derivedStage,
        depth:       existing ? existing.depth : STAGE_DEPTH[derivedStage],
        active_at:   now,
        updated_at:  now,
        created_at:  now,
      });
    }

    const stageSummary = toInsert.reduce((acc: Record<string, number>, u) => {
      const stage = u.stage as string;
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {});

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        tenant_uuid: nakamotoTenantUUID,
        total_personas: allPersonas.length,
        would_insert: toInsert.length,
        would_skip: skipped.length,
        stage_distribution: stageSummary,
        source_tier_counts: tierCounts,
      });
    }

    // ── 4. Delete stale records (old crm_personas-sourced rows) ───────────────
    // Any journey_state for nakamoto whose persona_id is NOT in the current
    // personas table is stale (from the old seed that used crm_personas.id).
    let deleted = 0;
    {
      // Fetch all persona_ids currently in journey_states for this tenant
      const { data: existing } = await supabase
        .from('journey_states')
        .select('persona_id')
        .eq('tenant_id', 'nakamoto');

      const staleIds = (existing ?? [])
        .map((r: any) => r.persona_id as string)
        .filter((pid) => !personaIdSet.has(pid));

      if (staleIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < staleIds.length; i += CHUNK) {
          await supabase
            .from('journey_states')
            .delete()
            .in('persona_id', staleIds.slice(i, i + CHUNK))
            .eq('tenant_id', 'nakamoto');
          deleted += Math.min(CHUNK, staleIds.length - i);
        }
      }
    }

    // ── 5. Delete existing valid records so we can re-INSERT cleanly ──────────
    // (avoids needing an onConflict unique constraint)
    const toInsertIds = toInsert.map((u) => u.persona_id as string);
    {
      const CHUNK = 200;
      for (let i = 0; i < toInsertIds.length; i += CHUNK) {
        await supabase
          .from('journey_states')
          .delete()
          .in('persona_id', toInsertIds.slice(i, i + CHUNK))
          .eq('tenant_id', 'nakamoto');
      }
    }

    // ── 6. Bulk INSERT in chunks ───────────────────────────────────────────────
    let seeded = 0;
    const insertErrors: string[] = [];
    const CHUNK = 200;

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error: insertErr } = await supabase
        .from('journey_states')
        .insert(chunk as any);

      if (insertErr) {
        console.error('[seed/nakamoto] insert error at chunk', i, insertErr.message);
        insertErrors.push(insertErr.message);
      } else {
        seeded += chunk.length;
      }
    }

    const response: Record<string, unknown> = {
      success: insertErrors.length === 0,
      tenant_uuid: nakamotoTenantUUID,
      total_personas: allPersonas.length,
      seeded,
      skipped: skipped.length,
      deleted_stale: deleted,
      stage_distribution: stageSummary,
      source_tier_counts: tierCounts,
    };

    if (insertErrors.length > 0) {
      response.errors = insertErrors;
      response.hint = 'Run migration 20260402020000_journey_states_tenant_id.sql in Supabase to add the tenant_id column and unique constraint.';
    }

    return NextResponse.json(response, {
      status: insertErrors.length > 0 ? 207 : 200,
    });

  } catch (error: any) {
    console.error('[seed/nakamoto] error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
