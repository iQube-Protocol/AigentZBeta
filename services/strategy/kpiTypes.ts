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
// Each activation that wants to expose KPIs declares its metrics here.
// The KPI editor's source picker only shows metrics from activations
// the persona currently has in 'active' status. Adding a new metric
// is a one-row append; no schema migration required.
//
// `query` describes how the resolver pulls the value. Today we ship
// two query kinds:
//   - { kind: 'receipts'; eventType }      — DVN receipt count for persona
//   - { kind: 'sql'; table; where? }       — server-side row count from a
//                                            cartridge-specific table
//
// Both run inside `kpiResolver.ts`. Adding richer query shapes (HTTP
// fetch against a cartridge metric endpoint, time-bucketed aggregation,
// etc.) is a follow-on — the registry shape supports it via a new
// discriminant.

export type ActivationMetricQuery =
  | { kind: 'receipts'; eventType: string }
  | { kind: 'sql'; table: string; where?: Record<string, string> };

export interface ActivationMetric {
  /** Metric key — globally unique per activationId (`weekly_actives`). */
  metric: string;
  /** Display label for the source picker. */
  label: string;
  /** Optional default unit (overridable on the KPI record). */
  defaultUnit?: string;
  query: ActivationMetricQuery;
}

export interface ActivationMetricCatalogEntry {
  /** activationId from services/activations/spineActivations. */
  activationId: string;
  cartridge: string;
  metrics: ActivationMetric[];
}

export const ACTIVATION_METRIC_CATALOG: ActivationMetricCatalogEntry[] = [
  {
    activationId: 'knyt-codex',
    cartridge: 'knyt',
    metrics: [
      { metric: 'episodes_unlocked', label: 'Episodes unlocked', defaultUnit: 'episodes', query: { kind: 'receipts', eventType: 'knyt.episode.unlocked' } },
      { metric: 'cards_purchased',   label: 'Cards purchased',   defaultUnit: 'cards',    query: { kind: 'receipts', eventType: 'knyt.card.purchased' } },
      { metric: 'rewards_earned',    label: 'KNYT rewards earned', defaultUnit: '$KNYT',  query: { kind: 'receipts', eventType: 'reward.granted' } },
    ],
  },
  {
    activationId: 'marketa-console',
    cartridge: 'marketa',
    metrics: [
      { metric: 'campaigns_active',  label: 'Active campaigns',  defaultUnit: 'campaigns', query: { kind: 'sql', table: 'crm_campaigns', where: { status: 'active' } } },
      { metric: 'emails_sent',       label: 'Emails sent',       defaultUnit: 'emails',    query: { kind: 'receipts', eventType: 'marketa.email.sent' } },
      { metric: 'partners_declared', label: 'Priority partners', defaultUnit: 'partners',  query: { kind: 'sql', table: 'crm_investors', where: { status: 'active' } } },
    ],
  },
  {
    activationId: 'agentiq-os',
    cartridge: 'agentiq',
    metrics: [
      { metric: 'intents_queued',    label: 'Intents queued',    defaultUnit: 'intents', query: { kind: 'receipts', eventType: 'intent.created' } },
      { metric: 'artifacts_created', label: 'Artifacts created', defaultUnit: 'artifacts', query: { kind: 'receipts', eventType: 'artifact.created' } },
    ],
  },
  {
    activationId: 'alpha-knyt',
    cartridge: 'avl',
    metrics: [
      { metric: 'workstreams_in_progress', label: 'Workstreams in progress', defaultUnit: 'workstreams', query: { kind: 'receipts', eventType: 'workstream.advanced' } },
    ],
  },
];

export function getActivationMetrics(activationId: string): ActivationMetric[] {
  return ACTIVATION_METRIC_CATALOG.find((e) => e.activationId === activationId)?.metrics ?? [];
}

export function findActivationMetric(activationId: string, metric: string): ActivationMetric | null {
  return getActivationMetrics(activationId).find((m) => m.metric === metric) ?? null;
}
