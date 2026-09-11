/**
 * Persisted shadow observations (CFS-035 Observatory amendment).
 *
 * The engine's shadow runners record each Invariant Decision Node's projection
 * vs the incumbent heuristic. In-memory storage is per-instance; this store adds
 * durable history so the Constitutional Observatory's Platform Health reads a
 * real time series (projection accuracy over time), not a per-instance snapshot.
 *
 * Discipline:
 *  - WRITES are best-effort + fire-and-forget from the hot path — `persistObservation`
 *    never throws and never blocks the surface (observe-only, CFS-035 §11). In a
 *    serverless container a post-response write may not always flush; that is
 *    acceptable for a statistical history (documented), and a durable flush queue
 *    is a follow-on.
 *  - READS are T1-safe: node id + score meta only, never a personaId.
 *  - The table may not exist yet (migration 20260718000000). Every call is guarded
 *    so the engine degrades to in-memory-only until the migration is applied.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const TABLE = 'invariant_shadow_observations';

interface RankObservation {
  nodeId: string;
  rankAgreement: number;
  topAgreement: boolean;
  itemCount?: number;
  citedIds?: string[];
}
interface ValueObservation {
  nodeId: string;
  delta: number;
  citedIds?: string[];
}
type AnyObservation = RankObservation | ValueObservation;

function isRank(o: AnyObservation): o is RankObservation {
  return 'rankAgreement' in o;
}

/**
 * Persist one shadow observation. Fire-and-forget: callers do `void persist…`.
 * Never throws — a persistence failure must never degrade the observed surface.
 */
export async function persistObservation(o: AnyObservation): Promise<void> {
  try {
    const client = getSupabaseServer();
    if (!client) return;
    const row = isRank(o)
      ? {
          node_id: o.nodeId,
          kind: 'rank',
          rank_agreement: o.rankAgreement,
          top_agreement: o.topAgreement,
          item_count: o.itemCount ?? null,
          cited_ids: o.citedIds ?? [],
        }
      : {
          node_id: o.nodeId,
          kind: 'value',
          value_delta: o.delta,
          cited_ids: o.citedIds ?? [],
        };
    await client.from(TABLE).insert(row);
  } catch {
    /* table absent / transient — history is best-effort, never fatal */
  }
}

export interface NodeObservationRollup {
  nodeId: string;
  kind: 'rank' | 'value';
  count: number;
  /** rank nodes: mean agreement in [0,1] (1 = faithful). null for value nodes. */
  meanRankAgreement: number | null;
  /** value nodes: mean |delta| (0 = faithful). null for rank nodes. */
  meanAbsValueDelta: number | null;
  lastObservedAt: string | null;
}

export interface ObservationHistory {
  /** Total persisted observations across all nodes (in the sampled window). */
  total: number;
  byNode: NodeObservationRollup[];
  /** Whether the persistence table is reachable (false ⇒ in-memory only). */
  persistenceAvailable: boolean;
}

/**
 * Roll up recent persisted observations per node. Samples the most recent
 * `sampleLimit` rows (default 2000) — bounded so Health stays cheap. Returns
 * `persistenceAvailable: false` (and empty rollup) when the table is absent.
 */
export async function getObservationHistory(sampleLimit = 2000): Promise<ObservationHistory> {
  try {
    const client = getSupabaseServer();
    if (!client) return { total: 0, byNode: [], persistenceAvailable: false };
    const { data, error } = await client
      .from(TABLE)
      .select('node_id,kind,rank_agreement,value_delta,observed_at')
      .order('observed_at', { ascending: false })
      .limit(sampleLimit);
    if (error || !data) return { total: 0, byNode: [], persistenceAvailable: false };

    const acc = new Map<
      string,
      { kind: 'rank' | 'value'; count: number; raSum: number; raN: number; dSum: number; dN: number; last: string | null }
    >();
    for (const r of data as Array<Record<string, unknown>>) {
      const nodeId = String(r.node_id);
      const kind = (r.kind === 'value' ? 'value' : 'rank') as 'rank' | 'value';
      let a = acc.get(nodeId);
      if (!a) {
        a = { kind, count: 0, raSum: 0, raN: 0, dSum: 0, dN: 0, last: null };
        acc.set(nodeId, a);
      }
      a.count += 1;
      if (typeof r.rank_agreement === 'number') {
        a.raSum += r.rank_agreement;
        a.raN += 1;
      }
      if (typeof r.value_delta === 'number') {
        a.dSum += Math.abs(r.value_delta);
        a.dN += 1;
      }
      const at = r.observed_at ? String(r.observed_at) : null;
      if (at && (!a.last || at > a.last)) a.last = at;
    }

    const byNode: NodeObservationRollup[] = [...acc.entries()].map(([nodeId, a]) => ({
      nodeId,
      kind: a.kind,
      count: a.count,
      meanRankAgreement: a.raN > 0 ? Math.round((a.raSum / a.raN) * 1000) / 1000 : null,
      meanAbsValueDelta: a.dN > 0 ? Math.round((a.dSum / a.dN) * 1000) / 1000 : null,
      lastObservedAt: a.last,
    }));

    return { total: data.length, byNode, persistenceAvailable: true };
  } catch {
    return { total: 0, byNode: [], persistenceAvailable: false };
  }
}
