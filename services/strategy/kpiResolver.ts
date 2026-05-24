/**
 * KPI source resolver — Phase 2 B.1.
 *
 * Given a persona's KPI records (rich shape from `kpiTypes.coerceKpisToRichShape`),
 * resolve each KPI's `current` value from its source. Activation-bound
 * KPIs are gated on the persona's Activations state — only KPIs whose
 * source activation is currently 'active' get resolved. Inactive
 * activations leave the KPI marked `unresolvedReason: 'source-inactive'`
 * so the chip can render a "reconnect / activate" hint.
 *
 * Pure server-side; called by `/api/assistant/venture-progress` so the
 * cockpit always renders fresh numbers without the client doing
 * per-source lookups. Never throws — failures collapse to the stored
 * value with `unresolvedReason: 'data-source-error'`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type KpiRecord,
  type KpiTrend,
  type KpiUnresolvedReason,
} from './kpiTypes';
import {
  findActivationMetric,
  type ActivationMetricQuery,
} from '@/data/activation-catalog';
import { getActiveActivationIds } from '@/services/activations/spineActivations';

export interface ResolveKpisInput {
  personaId: string;
  kpis: Record<string, KpiRecord>;
  windowDays?: number;
  prevWindowDays?: number;
}

export async function resolveKpis(
  supabase: SupabaseClient,
  input: ResolveKpisInput,
): Promise<Record<string, KpiRecord>> {
  const { personaId, kpis } = input;
  const windowDays = input.windowDays ?? 30;
  const prevWindowDays = input.prevWindowDays ?? windowDays;

  // Pull the persona's active activations once — every activation-bound
  // KPI checks against this set before its source is resolved. Inactive
  // activations don't get their queries run at all.
  const activeActivationIds = await getActiveActivationIds(personaId).catch(
    () => new Set<string>(),
  );

  const out: Record<string, KpiRecord> = {};
  for (const [id, kpi] of Object.entries(kpis)) {
    try {
      out[id] = await resolveSingle(
        supabase,
        personaId,
        kpi,
        activeActivationIds,
        windowDays,
        prevWindowDays,
      );
    } catch {
      out[id] = { ...kpi, unresolvedReason: 'data-source-error' };
    }
  }
  return out;
}

async function resolveSingle(
  supabase: SupabaseClient,
  personaId: string,
  kpi: KpiRecord,
  activeActivationIds: Set<string>,
  windowDays: number,
  prevWindowDays: number,
): Promise<KpiRecord> {
  switch (kpi.source.kind) {
    case 'manual':
      // Stored value is canonical. Trend stays whatever the operator
      // (or a future snapshot history) set it to; default 'unknown'.
      return { ...kpi, trend: kpi.trend ?? 'unknown', unresolvedReason: null };

    case 'activation': {
      const activationId = kpi.source.activationId;
      const metricKey = kpi.source.metric;
      if (!activationId || !metricKey) {
        return { ...kpi, unresolvedReason: 'metric-unknown' };
      }
      if (!activeActivationIds.has(activationId)) {
        // The persona hasn't activated this cartridge. Keep the stored
        // value (might be from before deactivation) and mark muted.
        return { ...kpi, unresolvedReason: 'source-inactive' };
      }
      const metric = findActivationMetric(activationId, metricKey);
      if (!metric) {
        return { ...kpi, unresolvedReason: 'metric-unknown' };
      }
      const { current, previous } = await runQuery(
        supabase,
        personaId,
        metric.query,
        windowDays,
        prevWindowDays,
      );
      return {
        ...kpi,
        current,
        unit: kpi.unit ?? metric.defaultUnit,
        // Carry the metric class from the catalog onto the resolved
        // record so the UI can render outcomes vs activity with the
        // right emphasis without re-resolving the catalog entry.
        class: metric.class ?? 'activity',
        trend: trendFromDelta(current, previous),
        lastUpdatedAt: new Date().toISOString(),
        unresolvedReason: null,
      };
    }

    case 'receipts': {
      const eventType = kpi.source.eventType?.trim();
      if (!eventType) return { ...kpi, unresolvedReason: 'metric-unknown' };
      const { current, previous } = await runQuery(
        supabase,
        personaId,
        { kind: 'receipts', eventType },
        windowDays,
        prevWindowDays,
      );
      return {
        ...kpi,
        current,
        trend: trendFromDelta(current, previous),
        lastUpdatedAt: new Date().toISOString(),
        unresolvedReason: null,
      };
    }

    default:
      return kpi;
  }
}

async function runQuery(
  supabase: SupabaseClient,
  personaId: string,
  query: ActivationMetricQuery,
  windowDays: number,
  prevWindowDays: number,
): Promise<{ current: number; previous: number }> {
  const nowMs = Date.now();
  const currentStart = new Date(nowMs - windowDays * 86_400_000).toISOString();
  const prevStart = new Date(nowMs - (windowDays + prevWindowDays) * 86_400_000).toISOString();
  const prevEnd = currentStart;

  if (query.kind === 'receipts') {
    const [currentRes, previousRes] = await Promise.all([
      supabase
        .from('dvn_receipt_events')
        .select('id', { count: 'exact', head: true })
        .eq('actor_persona_id', personaId)
        .eq('event_type', query.eventType)
        .gte('created_at', currentStart),
      supabase
        .from('dvn_receipt_events')
        .select('id', { count: 'exact', head: true })
        .eq('actor_persona_id', personaId)
        .eq('event_type', query.eventType)
        .gte('created_at', prevStart)
        .lt('created_at', prevEnd),
    ]);
    return {
      current: typeof currentRes.count === 'number' ? currentRes.count : 0,
      previous: typeof previousRes.count === 'number' ? previousRes.count : 0,
    };
  }

  // kind === 'sql' — generic count from a cartridge-specific table.
  let cur = supabase.from(query.table).select('*', { count: 'exact', head: true });
  let prev = supabase.from(query.table).select('*', { count: 'exact', head: true });
  if (query.where) {
    for (const [k, v] of Object.entries(query.where)) {
      cur = cur.eq(k, v);
      prev = prev.eq(k, v);
    }
  }
  // SQL queries are persona-scoped only if the table has an
  // actor_persona_id / persona_id column. Best-effort filter.
  cur = cur.eq('persona_id', personaId).gte('created_at', currentStart);
  prev = prev
    .eq('persona_id', personaId)
    .gte('created_at', prevStart)
    .lt('created_at', prevEnd);
  const [currentRes, previousRes] = await Promise.all([cur, prev]);
  return {
    current: typeof currentRes.count === 'number' ? currentRes.count : 0,
    previous: typeof previousRes.count === 'number' ? previousRes.count : 0,
  };
}

function trendFromDelta(current: number, previous: number): KpiTrend {
  if (previous === 0 && current === 0) return 'flat';
  if (previous === 0) return current > 0 ? 'up' : 'flat';
  const delta = (current - previous) / previous;
  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'flat';
}

/** Convenience guard the editor uses when filtering its source picker. */
export function isUnresolved(kpi: KpiRecord): boolean {
  return !!kpi.unresolvedReason || kpi.current === null;
}

export type { KpiUnresolvedReason };
