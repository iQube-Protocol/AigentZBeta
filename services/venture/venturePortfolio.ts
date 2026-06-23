/**
 * venturePortfolio — the cross-venture layer over a citizen's own VentureQubes.
 *
 * The ventures themselves live in venture_qubes (per-persona, 13-layer). This
 * service derives the cross-venture intelligence (shared capabilities, stage
 * spread, aggregate confidence) and reads/saves the operator's portfolio-level
 * thesis + priority ordering from venture_portfolios.
 *
 * Reuse, not rebuild: ventures come from listVentureQubes; positions come from
 * the same matrix model the rest of the platform uses.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listVentureQubes, type VentureQubeRecord } from './ventureQubeService';
import type { VentureOperatingModel } from '@/types/ventureQube';

export interface PortfolioVentureSummary {
  id: string;
  name: string;
  slug: string;
  stage: string;
  ventureConfidence: number | null;
  requiredCapabilities: string[];
}

export interface VenturePortfolio {
  thesis: string | null;
  notes: string | null;
  /** Operator-ordered venture ids; ventures not listed fall to the end. */
  priorities: string[];
  ventures: PortfolioVentureSummary[];
  /** Cross-venture intelligence (derived). */
  sharedCapabilities: string[];
  stageSpread: Record<string, number>;
  ventureCount: number;
  /**
   * The OPTIONAL operating-artifact layer (Pro/Portfolio only) — the living
   * operational brief aigentMe executes against as Chief of Staff. Stored in
   * the portfolio row's `payload` jsonb (no schema change); null when the
   * operator hasn't authored one.
   */
  operatingModel: VentureOperatingModel | null;
}

function summarise(v: VentureQubeRecord): PortfolioVentureSummary {
  return {
    id: v.id,
    name: v.name,
    slug: v.slug,
    stage: v.stage,
    ventureConfidence: v.ventureConfidence,
    requiredCapabilities: v.layers?.capability?.requiredCapabilities ?? [],
  };
}

/** Capabilities required by 2+ ventures — the portfolio's shared spine. */
function deriveSharedCapabilities(ventures: PortfolioVentureSummary[]): string[] {
  const counts = new Map<string, number>();
  for (const v of ventures) {
    for (const c of new Set(v.requiredCapabilities.map((s) => s.trim()).filter(Boolean))) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([c]) => c);
}

export async function getVenturePortfolio(
  admin: SupabaseClient,
  personaId: string,
): Promise<VenturePortfolio> {
  const records = await listVentureQubes(personaId);
  const ventures = records.map(summarise);

  const { data: row } = await admin
    .from('venture_portfolios')
    .select('thesis, notes, priorities, payload')
    .eq('owner_persona_id', personaId)
    .maybeSingle();

  const priorities: string[] = Array.isArray(row?.priorities) ? (row!.priorities as string[]) : [];

  // Order ventures by the saved priority list, then the rest by confidence.
  const byId = new Map(ventures.map((v) => [v.id, v]));
  const ordered: PortfolioVentureSummary[] = [];
  for (const id of priorities) {
    const v = byId.get(id);
    if (v) { ordered.push(v); byId.delete(id); }
  }
  for (const v of [...byId.values()].sort((a, b) => (b.ventureConfidence ?? 0) - (a.ventureConfidence ?? 0))) {
    ordered.push(v);
  }

  const stageSpread: Record<string, number> = {};
  for (const v of ventures) stageSpread[v.stage] = (stageSpread[v.stage] ?? 0) + 1;

  const payload = (row?.payload ?? {}) as Record<string, unknown>;
  const operatingModel =
    payload.operatingModel && typeof payload.operatingModel === 'object'
      ? (payload.operatingModel as VentureOperatingModel)
      : null;

  return {
    thesis: (row?.thesis as string | null) ?? null,
    notes: (row?.notes as string | null) ?? null,
    priorities,
    ventures: ordered,
    sharedCapabilities: deriveSharedCapabilities(ventures),
    stageSpread,
    ventureCount: ventures.length,
    operatingModel,
  };
}

export async function saveVenturePortfolio(
  admin: SupabaseClient,
  personaId: string,
  input: {
    thesis?: string | null;
    notes?: string | null;
    priorities?: string[];
    /** Pro/Portfolio-only operating-artifact layer; merged into payload. */
    operatingModel?: VentureOperatingModel | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {
    owner_persona_id: personaId,
    thesis: input.thesis ?? null,
    notes: input.notes ?? null,
    priorities: input.priorities ?? [],
    updated_at: new Date().toISOString(),
  };

  // Only touch payload when an operatingModel is supplied — read-merge so we
  // never clobber other (future) payload keys.
  if (input.operatingModel !== undefined) {
    const { data: existing } = await admin
      .from('venture_portfolios')
      .select('payload')
      .eq('owner_persona_id', personaId)
      .maybeSingle();
    const payload = (existing?.payload ?? {}) as Record<string, unknown>;
    if (input.operatingModel === null) delete payload.operatingModel;
    else payload.operatingModel = input.operatingModel;
    row.payload = payload;
  }

  const { error } = await admin
    .from('venture_portfolios')
    .upsert(row, { onConflict: 'owner_persona_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
