/**
 * CFS-008 measurement rollup (Chrysalis Foundation, Phase 5).
 *
 * The production readout of the compression metrics CFS-008 §2 defines:
 *
 *   - Reuse count      — adoption accumulators (times_used / times_referenced,
 *                        the Reach inputs) per invariant + per namespace, plus
 *                        the receipt-spine view (receipts whose invariants_used
 *                        names the invariant) when the instrumentation column
 *                        is applied.
 *   - Consequence      — confirmed vs contradicted evolution outcomes
 *     accuracy           (times_validated / times_contradicted — the Standing
 *                        inputs), aggregated per namespace.
 *
 * Read-only aggregates over T1-safe records — no T0, no statements' private
 * payloads, safe to serialise. Law XII discipline: validation-class and
 * adoption-class figures are reported as SEPARATE axes, never combined into a
 * single score.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listInvariants } from './store';
import type { InvariantNamespace } from '@/types/invariants';

export interface NamespaceMeasurement {
  namespace: InvariantNamespace;
  invariants: number;
  /** Validation axis (Standing inputs — Law XII). */
  timesValidated: number;
  timesContradicted: number;
  /** confirmed / (confirmed + contradicted); null when no outcomes observed. */
  consequenceAccuracy: number | null;
  /** Adoption axis (Reach inputs — Law XII). */
  timesReferenced: number;
  timesUsed: number;
  avgStanding: number;
  avgReach: number;
}

export interface TopReusedInvariant {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: InvariantNamespace;
  timesUsed: number;
  timesReferenced: number;
  standing: number;
  reach: number;
}

export interface MeasurementRollup {
  totalInvariants: number;
  byNamespace: NamespaceMeasurement[];
  /** Adoption leaders (reuse) — never presented as authority (Law XII). */
  topReused: TopReusedInvariant[];
  /**
   * Receipt-spine reuse view: receipts carrying a non-empty invariants_used.
   * Null when the 20260704100000 instrumentation column isn't applied yet —
   * reported honestly as unmeasured, not as zero.
   */
  groundedReceiptCount: number | null;
}

export async function computeMeasurementRollup(): Promise<MeasurementRollup> {
  const invariants = await listInvariants({ limit: 500 });

  const byNs = new Map<InvariantNamespace, NamespaceMeasurement>();
  for (const inv of invariants) {
    let m = byNs.get(inv.namespace);
    if (!m) {
      m = {
        namespace: inv.namespace,
        invariants: 0,
        timesValidated: 0,
        timesContradicted: 0,
        consequenceAccuracy: null,
        timesReferenced: 0,
        timesUsed: 0,
        avgStanding: 0,
        avgReach: 0,
      };
      byNs.set(inv.namespace, m);
    }
    m.invariants += 1;
    m.timesValidated += inv.timesValidated;
    m.timesContradicted += inv.timesContradicted;
    m.timesReferenced += inv.timesReferenced;
    m.timesUsed += inv.timesUsed;
    m.avgStanding += inv.standing;
    m.avgReach += inv.reach;
  }
  for (const m of byNs.values()) {
    const outcomes = m.timesValidated + m.timesContradicted;
    m.consequenceAccuracy = outcomes > 0 ? Math.round((m.timesValidated / outcomes) * 1000) / 1000 : null;
    m.avgStanding = Math.round((m.avgStanding / m.invariants) * 10) / 10;
    m.avgReach = Math.round((m.avgReach / m.invariants) * 10) / 10;
  }

  const topReused = [...invariants]
    .filter((inv) => inv.timesUsed > 0 || inv.timesReferenced > 0)
    .sort((a, b) => (b.timesUsed + b.timesReferenced) - (a.timesUsed + a.timesReferenced))
    .slice(0, 10)
    .map((inv) => ({
      id: inv.id,
      seedId: inv.seedId,
      statement: inv.statement,
      namespace: inv.namespace,
      timesUsed: inv.timesUsed,
      timesReferenced: inv.timesReferenced,
      standing: inv.standing,
      reach: inv.reach,
    }));

  // Receipt-spine view — best-effort; null (unmeasured) when the column or
  // table isn't there yet, never a fake zero.
  let groundedReceiptCount: number | null = null;
  try {
    const client = getSupabaseServer();
    if (client) {
      const { count, error } = await client
        .from('activity_receipts')
        .select('id', { count: 'exact', head: true })
        .neq('invariants_used', '{}');
      if (!error && typeof count === 'number') groundedReceiptCount = count;
    }
  } catch {
    /* column/table absent — stays null */
  }

  return {
    totalInvariants: invariants.length,
    byNamespace: [...byNs.values()].sort((a, b) => b.invariants - a.invariants),
    topReused,
    groundedReceiptCount,
  };
}
