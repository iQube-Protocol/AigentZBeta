/**
 * KPI type contract — Phase 2 B.1.
 *
 * Each KPI lives on `experience_qube.blak.activeKpis` as a record
 * keyed by KPI id. Backward compat: the editor used to store
 * `{ [name]: target_string }` — the reader below coerces those rows
 * into the rich shape on read so existing personas don't break.
 *
 * Source taxonomy is **Activations-bound** (per the operator's
 * direction): KPIs draw their `current` value from the persona's
 * ACTIVE activations (declared in the Activations tab). The
 * Activations tab is the source of truth for "what's plugged in" —
 * a KPI sourced from a non-activated cartridge resolves as
 * `unresolved` until the persona activates it.
 *
 * Three source kinds:
 *   - manual                                  — operator edits in app
 *   - activation:<activationId>:<metric>      — value pulled from the
 *                                                metric the active
 *                                                activation exposes
 *   - receipts:<eventType>                    — count of matching DVN
 *                                                receipt rows (global
 *                                                fallback, not gated
 *                                                by activations)
 */

export type KpiSourceKind = 'manual' | 'activation' | 'receipts';

export interface KpiSource {
  kind: KpiSourceKind;
  /** For 'activation': the activationId from spineActivations. */
  activationId?: string;
  /** For 'activation': metric key registered for that activation. */
  metric?: string;
  /** For 'receipts': the DVN event_type to count. */
  eventType?: string;
}

export type KpiTrend = 'up' | 'down' | 'flat' | 'unknown';

/** Why a KPI's `current` couldn't be resolved (when present). */
export type KpiUnresolvedReason =
  | 'source-inactive'      // activation isn't in 'active' state for this persona
  | 'metric-unknown'       // metric key doesn't exist in the activation's registry
  | 'data-source-error'    // query failed; stored value kept
  | null;

export interface KpiRecord {
  id: string;
  name: string;
  /** Free-form target description (e.g. "500 weekly actives by Q3"). */
  target: string;
  /** Current resolved value. null = not yet resolved. */
  current: number | null;
  /** Unit label rendered next to current (e.g. "users/wk"). Optional. */
  unit?: string;
  trend: KpiTrend;
  lastUpdatedAt: string | null;
  source: KpiSource;
  /**
   * Set when the resolver couldn't bind `current` to a live source.
   * The chip renders muted with a "reconnect / activate" hint.
   */
  unresolvedReason?: KpiUnresolvedReason;
}

/**
 * Coerce the legacy `Record<string, target_string>` shape into the
 * rich `Record<id, KpiRecord>` shape. Idempotent — already-rich rows
 * pass through unchanged.
 *
 * Used by every reader so old personas keep working without a DB
 * migration. New writes always use the rich shape.
 */
export function coerceKpisToRichShape(
  raw: Record<string, unknown> | null | undefined,
): Record<string, KpiRecord> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, KpiRecord> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'name' in value &&
      'source' in value
    ) {
      const v = value as Partial<KpiRecord>;
      const id = String(v.id ?? key);
      out[id] = {
        id,
        name: String(v.name ?? key),
        target: String(v.target ?? ''),
        current: typeof v.current === 'number' ? v.current : null,
        unit: typeof v.unit === 'string' ? v.unit : undefined,
        trend: (v.trend as KpiTrend) ?? 'unknown',
        lastUpdatedAt: typeof v.lastUpdatedAt === 'string' ? v.lastUpdatedAt : null,
        source: (v.source as KpiSource) ?? { kind: 'manual' },
        unresolvedReason: (v.unresolvedReason as KpiUnresolvedReason) ?? null,
      };
      continue;
    }
    const id = legacyIdFromName(key);
    out[id] = {
      id,
      name: key,
      target: typeof value === 'string' ? value : '',
      current: null,
      trend: 'unknown',
      lastUpdatedAt: null,
      source: { kind: 'manual' },
      unresolvedReason: null,
    };
  }
  return out;
}

export function legacyIdFromName(name: string): string {
  return `kpi_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'unnamed'}`;
}

// ── Activation metric registry ────────────────────────────────────────
//
// The metric registry lives on the activation catalog itself
// (`data/activation-catalog.ts`). Each entry declares its own
// `metrics: ActivationMetric[]`. The KPI editor + resolver read from
// there, filtered to the persona's `active` activations.
//
// Re-exported here for backward compatibility with callers that
// imported from `kpiTypes` during B.1's first draft.

export type {
  ActivationMetric,
  ActivationMetricQuery,
} from '@/data/activation-catalog';

export {
  findActivationMetric,
  metricsForActiveActivations,
} from '@/data/activation-catalog';
