/**
 * publicReads — the shared, persona-free READ cores behind the IRL Dashboard's
 * two public-safe data sources (extracted 2026-07-17 so the spine-gated routes
 * and the public IRL OS routes call ONE implementation — Extend-Don't-Duplicate).
 *
 * Neither function resolves a persona or writes anything. Both return the
 * PUBLISHED constitutional record — hash-committed experiment results and the
 * derived research-object lifecycle overview — which is T2-safe (no personaId)
 * and already public in the corpus. The persona GATE stays in the gated routes;
 * the public routes call these with no gate.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { overviewWithPersistedLifecycle } from '@/services/research/lifecycle';
import { listArtifactRecords } from '@/services/artifact/artifactRecordStore';
import { PUBLICATION_REGISTER } from '@/services/artifact/publicationRegistry';
import { SERIES_REGISTRY, EXPERIMENT_LIFECYCLE } from '@/types/research';

export interface PublishedResult {
  id: unknown;
  experiment: unknown;
  provider: unknown;
  model: unknown;
  aggregates: unknown;
  resultsJson: unknown;
  contentHash: unknown;
  receiptId: unknown;
  receiptStatus: string | null;
  dvnReceiptId: string | null;
  createdAt: unknown;
}

export type PublishedResultsOutcome =
  | { ok: true; results: PublishedResult[] }
  | { ok: false; error: string; status: number };

/** The published experiment-results table + DVN status join. Read-only. */
export async function listPublishedExperimentResults(): Promise<PublishedResultsOutcome> {
  const client = getSupabaseServer();
  if (!client) return { ok: false, error: 'storage unavailable', status: 500 };

  const cols = 'id, experiment, provider, model, aggregates, results_json, content_hash, receipt_id, created_at';
  // Only steward-approved (or admin-published) results join the public canon —
  // participant private/pending submissions must never leak here. Pre-migration
  // installs lack the `visibility` column, so fall back to the unfiltered read
  // (there are no participant submits before the column exists).
  let { data, error } = await client
    .from('experiment_results')
    .select(cols)
    .eq('visibility', 'published')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error && /visibility/i.test(error.message)) {
    ({ data, error } = await client
      .from('experiment_results')
      .select(cols)
      .order('created_at', { ascending: false })
      .limit(100));
  }
  if (error) {
    const message = /does not exist/i.test(error.message)
      ? 'experiment_results table missing — apply supabase/migrations/20260704120000_experiment_results.sql'
      : error.message;
    return { ok: false, error: message, status: 500 };
  }

  const receiptIds = (data ?? []).map((r) => r.receipt_id).filter(Boolean) as string[];
  const statusByReceipt = new Map<string, { receiptStatus: string; dvnReceiptId: string | null }>();
  if (receiptIds.length > 0) {
    const { data: receipts } = await client
      .from('activity_receipts')
      .select('id, receipt_status, dvn_receipt_id')
      .in('id', receiptIds);
    for (const r of receipts ?? []) {
      statusByReceipt.set(String(r.id), {
        receiptStatus: String(r.receipt_status ?? 'local'),
        dvnReceiptId: (r.dvn_receipt_id as string) ?? null,
      });
    }
  }

  const results: PublishedResult[] = (data ?? []).map((r) => ({
    id: r.id,
    experiment: r.experiment,
    provider: r.provider,
    model: r.model,
    aggregates: r.aggregates,
    resultsJson: r.results_json,
    contentHash: r.content_hash,
    receiptId: r.receipt_id,
    receiptStatus: r.receipt_id
      ? statusByReceipt.get(String(r.receipt_id))?.receiptStatus ?? 'local'
      : null,
    dvnReceiptId: r.receipt_id
      ? statusByReceipt.get(String(r.receipt_id))?.dvnReceiptId ?? null
      : null,
    createdAt: r.created_at,
  }));
  return { ok: true, results };
}

/** The IRL object-model overview (registry + derived lifecycle + artifact
 *  production observation). Read-only, T2-safe. `stampedAt` is passed in so
 *  the function stays pure of the clock. */
export async function buildResearchOverview(stampedAt: string): Promise<Record<string, unknown>> {
  const overview = await overviewWithPersistedLifecycle();
  const records = await listArtifactRecords({ limit: 8 }).catch(() => []);
  const artifactProduction = {
    recentRecords: records.map((r) => ({
      artifactId: r.artifact_id,
      profile: r.profile,
      consequenceClass: r.consequence_class,
      delegate: r.delegate,
      title: r.title.slice(0, 80),
      contentHashPrefix: r.content_hash.slice(0, 12),
      receiptId: r.receipt_id,
      groundedInvariants: Array.isArray(r.cited_invariant_ids) ? r.cited_invariant_ids.length : 0,
      createdAt: r.created_at,
    })),
    publications: PUBLICATION_REGISTER.map((p) => ({ number: p.number, title: p.title, state: p.state })),
  };
  return {
    ok: true,
    lifecycleOrder: EXPERIMENT_LIFECYCLE,
    series: SERIES_REGISTRY,
    experiments: overview,
    artifactProduction,
    computedAt: stampedAt,
  };
}
