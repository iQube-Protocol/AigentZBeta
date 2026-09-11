/**
 * customerMatrix — the GENERALIZED customer-progress matrix feed.
 *
 * The Studio's customer matrix (ComposerStudio) renders a generic Engagement ×
 * Sovereignty-Journey grid, but its LIVE data feed (dashboard view=matrix) is
 * hardwired to nakamoto_knyt_personas (KNYT-only). This is the tenant-agnostic
 * replacement: it reads the generic `journey_states` substrate (already used by
 * the dashboard's franchise/cohort/individual views) and emits cell counts in
 * the exact `Engagement:Sovereignty` key vocabulary the Studio grid consumes —
 * so it is drop-in compatible and works for ANY venture/tenant, not just KNYT.
 *
 * Axes (locked to the Studio vocabulary):
 *   Y = Engagement:  Recipient < Selector < Modifier < Producer < Builder < Steward
 *   X = Sovereignty: Disheartened(-1) < Visitor < Initiate < Participant <
 *                    Curator < Composer < Operator < Architect
 *
 * Mapping v1 (explicit, tunable design decision — NOT KNYT-specific): journey
 * stage -> Sovereignty X, experience depth -> Engagement Y. Documented below.
 * Best-effort: soft-fails to an empty matrix if journey_states is unavailable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const ENGAGEMENT_LEVELS = [
  'Recipient',
  'Selector',
  'Modifier',
  'Producer',
  'Builder',
  'Steward',
] as const;

export const SOVEREIGNTY_STAGES = [
  'Disheartened',
  'Visitor',
  'Initiate',
  'Participant',
  'Curator',
  'Composer',
  'Operator',
  'Architect',
] as const;

// journey_states.stage -> Sovereignty Journey (X). v1 mapping.
const STAGE_TO_SOVEREIGNTY: Record<string, string> = {
  prospect: 'Visitor',
  acolyte: 'Initiate',
  keta: 'Participant',
  keji: 'Curator',
  first: 'Composer',
  zero: 'Operator',
  creator_contributor: 'Composer',
  collector_only: 'Participant',
  investor_reactivation_candidate: 'Disheartened',
};

// journey_states.depth -> Engagement (Y). v1 mapping.
const DEPTH_TO_ENGAGEMENT: Record<string, string> = {
  pill: 'Recipient',
  capsule: 'Selector',
  mini_runtime: 'Producer',
  codex: 'Builder',
};

export interface CustomerMatrixResult {
  /** Cell counts keyed "Engagement:Sovereignty" (e.g. "Recipient:Visitor"). */
  cells: Record<string, number>;
  total: number;
  engagementLevels: string[];
  sovereigntyStages: string[];
  /** Echoes the scope used (tenant id or 'platform'). */
  scope: string;
  /** True when no journey data was found for the scope. */
  empty: boolean;
}

export async function getCustomerMatrix(
  admin: SupabaseClient,
  opts: { tenantId?: string | null } = {},
): Promise<CustomerMatrixResult> {
  const tenantId = opts.tenantId ?? null;
  const cells: Record<string, number> = {};
  let total = 0;

  try {
    let offset = 0;
    const PAGE = 1000;
    // Paginate — PostgREST caps at 1000 rows/request.
    for (;;) {
      let q = admin
        .from('journey_states')
        .select('stage, depth')
        .range(offset, offset + PAGE - 1);
      if (tenantId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = (q as any).eq('tenant_id', tenantId);
      }
      const { data, error } = await q;
      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const stage = String((row as { stage?: string }).stage ?? '');
        const depth = String((row as { depth?: string }).depth ?? '');
        const x = STAGE_TO_SOVEREIGNTY[stage] ?? 'Visitor';
        const y = DEPTH_TO_ENGAGEMENT[depth] ?? 'Recipient';
        const key = `${y}:${x}`;
        cells[key] = (cells[key] ?? 0) + 1;
        total += 1;
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  } catch {
    /* journey_states unavailable — return empty matrix */
  }

  return {
    cells,
    total,
    engagementLevels: [...ENGAGEMENT_LEVELS],
    sovereigntyStages: [...SOVEREIGNTY_STAGES],
    scope: tenantId ?? 'platform',
    empty: total === 0,
  };
}
