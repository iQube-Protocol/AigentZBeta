/**
 * ClusterQube score derivation (v1).
 *
 * Backlog rules:
 *   - Aggregate from cluster.member_iqubes:
 *     mean of each axis across members
 *   - Risk is weighted toward max member risk (cluster risk = worst-case)
 *
 * Today there are 0 ClusterQubes in iqube_id_map (one orphan trinity meta
 * is qube_type='cluster' per Stage 0 Finding F but it isn't yet
 * promoted to a ClusterQube record). This deriver returns empty until
 * cluster records land. The aggregation logic is in place so
 * promotion can re-run the backfill and immediately get scores.
 *
 * Cluster member iqube_ids are stored on the canonical record's
 * cluster.member_iqubes block (Stage 1 C5). Once a real ClusterQube is
 * created, this deriver reads its members + averages their scores.
 */

import { createClient } from '@supabase/supabase-js';
import type { DerivationResult } from './types';
import { clampAxis } from './types';

const STRATEGY = 'cluster_qube_v1';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function deriveClusterQubeScores(): Promise<DerivationResult[]> {
  const sb = client();

  const { data: clusters } = await sb
    .from('iqube_id_map')
    .select('iqube_id, source_id')
    .eq('primitive_type', 'ClusterQube');
  if (!clusters || clusters.length === 0) return [];

  // For each cluster, read its members (Stage 1 C5 carries member_iqubes
  // on the canonical record; for the backfill we'd query the canonical
  // resolver here — but there's no DB column for cluster composition
  // yet, so today we return placeholder scores per cluster).
  return clusters.map((c) => {
    const e = c as { iqube_id: string; source_id: string };
    // Placeholder — real implementation reads member scores when the
    // cluster composition surface lands
    return {
      iqube_id: e.iqube_id,
      strategy: STRATEGY,
      scores: { sensitivity: 5, accuracy: 5, verifiability: 5, risk: 5 },
      notes: 'placeholder — recompute after cluster member surface lands',
    };
  });
}

/**
 * Aggregate scores from a set of member iQube scores. Public for tests
 * + future re-aggregation when cluster compositions change.
 *
 * Strategy:
 *   - sensitivity / accuracy / verifiability — mean across members
 *   - risk — 70% weighted toward max (worst-case bias)
 */
export function aggregateClusterScores(
  memberScores: Array<{ sensitivity: number; accuracy: number; verifiability: number; risk: number }>,
): { sensitivity: number; accuracy: number; verifiability: number; risk: number } | null {
  if (memberScores.length === 0) return null;
  const n = memberScores.length;
  const mean = (k: keyof typeof memberScores[0]) =>
    memberScores.reduce((sum, m) => sum + m[k], 0) / n;
  const maxRisk = memberScores.reduce((max, m) => Math.max(max, m.risk), 0);
  const meanRisk = mean('risk');
  return {
    sensitivity: clampAxis(mean('sensitivity')),
    accuracy: clampAxis(mean('accuracy')),
    verifiability: clampAxis(mean('verifiability')),
    risk: clampAxis(maxRisk * 0.7 + meanRisk * 0.3),
  };
}
