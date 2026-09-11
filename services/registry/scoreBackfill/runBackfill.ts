/**
 * iQube score data backfill — driver.
 *
 * Iterates per-primitive derivers, writes results to iqube_scores
 * (preserving any operator overrides), computes derived_reliability +
 * derived_trust on write.
 *
 * Idempotent. Re-running:
 *   - Updates rows where source='derived' (re-derivation may have changed)
 *   - Preserves rows where source='operator_override' on a per-axis basis
 *   - Inserts rows that don't exist yet
 *
 * Authority compliance: driver never decides access. Reads source-of-
 * truth tables + writes scores aggregate data only. T0 fields never
 * read or written here.
 */

import { createClient } from '@supabase/supabase-js';

import { deriveContentQubeScores } from './contentQubeScores';
import { deriveToolQubeScores } from './toolQubeScores';
import { deriveAigentQubeScores } from './aigentQubeScores';
import { deriveDataQubeScores } from './dataQubeScores';
import { deriveClusterQubeScores } from './clusterQubeScores';

import type {
  BackfillReport,
  BackfillSourceReport,
  DerivationResult,
  RawScores,
  ScoreAxis,
  ScoreRow,
  ScoreSource,
} from './types';
import { computeDerivedScores } from './types';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type PrimitiveSource =
  | 'ContentQube'
  | 'ToolQube'
  | 'AigentQube'
  | 'DataQube'
  | 'ClusterQube';

const DERIVER_BY_PRIMITIVE: Record<PrimitiveSource, () => Promise<DerivationResult[]>> = {
  ContentQube: deriveContentQubeScores,
  ToolQube: deriveToolQubeScores,
  AigentQube: deriveAigentQubeScores,
  DataQube: deriveDataQubeScores,
  ClusterQube: deriveClusterQubeScores,
};

/**
 * Apply derivation results to the iqube_scores table.
 *
 * Per-axis precedence rules (operator overrides are sacred):
 *   - If iqube_scores has the row + axis source = 'operator_override':
 *     preserve. Re-derivation skips.
 *   - If iqube_scores has the row + axis source = 'derived':
 *     update with new derived value. Set updated_at, populated_at, strategy.
 *   - If no iqube_scores row: INSERT with all derived axes.
 *
 * Operator override of an individual axis happens via a separate
 * PATCH /api/admin/registry/scores/[iqube_id] route (not in this file);
 * the deriver simply respects the source flag.
 */
async function applyResults(
  results: DerivationResult[],
  primitive_type: string,
): Promise<BackfillSourceReport> {
  const start = Date.now();
  const sb = client();
  const report: BackfillSourceReport = {
    primitive_type,
    processed: results.length,
    populated: 0,
    preserved_overrides: 0,
    skipped: 0,
    errors: [],
    duration_ms: 0,
  };

  if (results.length === 0) {
    report.duration_ms = Date.now() - start;
    return report;
  }

  // Bulk-load existing rows for these iqube_ids to know which axes carry
  // operator overrides.
  const ids = results.map((r) => r.iqube_id);
  const { data: existing } = await sb
    .from('iqube_scores')
    .select('iqube_id, sensitivity_source, accuracy_source, verifiability_source, risk_source')
    .in('iqube_id', ids);
  const existingByIqube = new Map<string, Record<string, ScoreSource>>();
  for (const row of existing ?? []) {
    const r = row as {
      iqube_id: string;
      sensitivity_source: ScoreSource;
      accuracy_source: ScoreSource;
      verifiability_source: ScoreSource;
      risk_source: ScoreSource;
    };
    existingByIqube.set(r.iqube_id, {
      sensitivity: r.sensitivity_source,
      accuracy: r.accuracy_source,
      verifiability: r.verifiability_source,
      risk: r.risk_source,
    });
  }

  for (const result of results) {
    try {
      const existing = existingByIqube.get(result.iqube_id);
      // Build update payload — only include axes whose existing source
      // is 'derived' (or no row exists).
      const upsert: Partial<ScoreRow> & { iqube_id: string } = {
        iqube_id: result.iqube_id,
        derivation_strategy: result.strategy,
        updated_at: new Date().toISOString(),
      };

      let preservedAny = false;
      const axes: ScoreAxis[] = ['sensitivity', 'accuracy', 'verifiability', 'risk'];
      const derivedAxes: Partial<RawScores> = {};

      for (const axis of axes) {
        const derivedValue = result.scores[axis];
        if (derivedValue === undefined) {
          // Deriver had no signal for this axis — leave whatever exists
          continue;
        }
        const currentSource = existing?.[axis];
        if (currentSource === 'operator_override') {
          // Preserve operator value; skip writing this axis.
          preservedAny = true;
          continue;
        }
        // Either no row exists or existing source is 'derived' — apply.
        (upsert as Record<string, unknown>)[axis] = derivedValue;
        derivedAxes[axis] = derivedValue;
        (upsert as Record<string, unknown>)[`${axis}_source`] = 'derived' as ScoreSource;
      }

      if (preservedAny) report.preserved_overrides++;

      // Compute derived_reliability + derived_trust if all 4 axes are
      // present in derivedAxes; otherwise read existing values and combine.
      const allFour =
        derivedAxes.sensitivity !== undefined &&
        derivedAxes.accuracy !== undefined &&
        derivedAxes.verifiability !== undefined &&
        derivedAxes.risk !== undefined;

      if (allFour) {
        const d = computeDerivedScores(derivedAxes as RawScores);
        (upsert as Record<string, unknown>).derived_reliability = d.reliability;
        (upsert as Record<string, unknown>).derived_trust = d.trust;
      }

      // Upsert. If no row exists, populated_at is set by DEFAULT now().
      const { error } = await sb
        .from('iqube_scores')
        .upsert(upsert as Record<string, unknown>, { onConflict: 'iqube_id' });

      if (error) {
        report.errors.push({ iqube_id: result.iqube_id, error: error.message });
      } else {
        report.populated++;
      }
    } catch (err) {
      report.errors.push({ iqube_id: result.iqube_id, error: (err as Error).message });
    }
  }

  report.duration_ms = Date.now() - start;
  return report;
}

export async function backfillPrimitive(
  primitive: PrimitiveSource,
): Promise<BackfillSourceReport> {
  const deriver = DERIVER_BY_PRIMITIVE[primitive];
  if (!deriver) {
    return {
      primitive_type: primitive,
      processed: 0,
      populated: 0,
      preserved_overrides: 0,
      skipped: 0,
      errors: [{ iqube_id: '(meta)', error: `No deriver for primitive ${primitive}` }],
      duration_ms: 0,
    };
  }
  let results: DerivationResult[];
  try {
    results = await deriver();
  } catch (err) {
    return {
      primitive_type: primitive,
      processed: 0,
      populated: 0,
      preserved_overrides: 0,
      skipped: 0,
      errors: [{ iqube_id: '(deriver)', error: (err as Error).message }],
      duration_ms: 0,
    };
  }
  return applyResults(results, primitive);
}

export async function backfillAllPrimitives(): Promise<BackfillReport> {
  const started_at = new Date().toISOString();
  const primitives: PrimitiveSource[] = [
    'ContentQube',
    'ToolQube',
    'AigentQube',
    'DataQube',
    'ClusterQube',
  ];
  const per_primitive: BackfillSourceReport[] = [];
  for (const p of primitives) {
    per_primitive.push(await backfillPrimitive(p));
  }
  return {
    started_at,
    finished_at: new Date().toISOString(),
    per_primitive,
    total_populated: per_primitive.reduce((n, r) => n + r.populated, 0),
    total_preserved_overrides: per_primitive.reduce((n, r) => n + r.preserved_overrides, 0),
    total_errors: per_primitive.reduce((n, r) => n + r.errors.length, 0),
  };
}

/**
 * Coverage status for the Health tab — how many iqube_id_map entries
 * have iqube_scores rows, per primitive.
 */
export interface PrimitiveCoverage {
  primitive_type: string;
  total_iqubes: number;
  scored_iqubes: number;
  coverage_pct: number;
  with_overrides: number;
}

export async function getCoverageStatus(): Promise<PrimitiveCoverage[]> {
  const sb = client();
  const primitives: string[] = ['ContentQube', 'ToolQube', 'AigentQube', 'DataQube', 'ClusterQube'];
  const out: PrimitiveCoverage[] = [];

  for (const p of primitives) {
    const { data: mapRows } = await sb
      .from('iqube_id_map')
      .select('iqube_id')
      .eq('primitive_type', p);
    const ids = (mapRows ?? []).map((r) => (r as { iqube_id: string }).iqube_id);
    const { count: scored } = await sb
      .from('iqube_scores')
      .select('iqube_id', { count: 'exact', head: true })
      .in('iqube_id', ids.length > 0 ? ids : ['__none__']);
    const { count: withOverrides } = await sb
      .from('iqube_scores')
      .select('iqube_id', { count: 'exact', head: true })
      .in('iqube_id', ids.length > 0 ? ids : ['__none__'])
      .or('sensitivity_source.eq.operator_override,accuracy_source.eq.operator_override,verifiability_source.eq.operator_override,risk_source.eq.operator_override');
    const total = ids.length;
    out.push({
      primitive_type: p,
      total_iqubes: total,
      scored_iqubes: scored ?? 0,
      coverage_pct: total === 0 ? 0 : Math.round(((scored ?? 0) / total) * 100),
      with_overrides: withOverrides ?? 0,
    });
  }
  return out;
}
