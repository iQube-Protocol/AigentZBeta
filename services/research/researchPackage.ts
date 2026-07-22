/**
 * Research Package exporter — PRD-EPI-001 §4 (CFS-033 §3, built now).
 *
 * One exporter serves BOTH use cases CFS-033 §3 names: "publish this" and
 * "let an external reviewer verify this" (Austin's-agent's Reviewer Package).
 * Do not build a second exporter for either surface — the read-only API
 * route below is the only consumer this task adds, and it calls this same
 * function.
 *
 * Assembles, for one experiment: its ResearchExperiment record (pinned
 * registry), all FrozenArtifact rows (services/research/artifacts.ts), its
 * published `experiment_results` rows, and its derived lifecycle overview
 * entry (services/research/lifecycle.ts), filtered to this experiment.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listArtifacts } from '@/services/research/artifacts';
import { deriveOverview } from '@/services/research/lifecycle';
import { EXPERIMENT_REGISTRY, type FrozenArtifact, type ResearchExperiment, type ResearchOverviewEntry } from '@/types/research';

/** One published `experiment_results` row, shaped per
 * services/experiments/publishResult.ts's insert — the execution receipts /
 * raw outputs this package carries today. There is no separate raw-output
 * store beyond `results_json` on this row; if/when one exists, extend this
 * shape rather than forking a second exporter. */
export interface PublishedExperimentRun {
  id: string;
  provider: string;
  model: string;
  aggregates: Record<string, unknown>;
  resultsJson: string;
  contentHash: string;
  visibility: string;
  receiptId: string | null;
  createdAt: string;
}

export interface ResearchPackage {
  experimentId: string;
  hypothesis: string;
  protocol: ResearchExperiment;
  frozenArtifacts: FrozenArtifact[];
  /** Published runs — serve as both "execution receipts" and "raw outputs"
   * per §4: `resultsJson` on each row IS the raw output; there is no
   * separate raw-output store in the current schema. */
  executionReceipts: PublishedExperimentRun[];
  rawOutputs: PublishedExperimentRun[];
  /** The frozen `interpretation-table` artifact's payload, if one exists for
   * this experiment yet (PRD-EPI-001 §6) — null when not yet frozen/present,
   * never fabricated. */
  interpretationTable: FrozenArtifact | null;
  /** This experiment's derived lifecycle overview entry
   * (services/research/lifecycle.ts::deriveOverview), filtered to this id. */
  replicationStatus: ResearchOverviewEntry | null;
}

export interface BuildResearchPackageResult {
  ok: boolean;
  error?: string;
  package?: ResearchPackage;
}

/**
 * Build the Research Package for one experiment id. Returns a clear error
 * (never throws) for an unknown experiment id — the registry is the source
 * of truth for what experiments exist.
 */
export async function buildResearchPackage(experimentId: string): Promise<BuildResearchPackageResult> {
  const protocol = EXPERIMENT_REGISTRY.find((e) => e.id === experimentId);
  if (!protocol) {
    return { ok: false, error: `unknown experiment '${experimentId}' — not present in EXPERIMENT_REGISTRY` };
  }

  const [frozenArtifacts, overview, runs] = await Promise.all([
    listArtifacts(experimentId),
    deriveOverview(),
    listPublishedRuns(experimentId),
  ]);

  const interpretationTable = frozenArtifacts.find((a) => a.kind === 'interpretation-table') ?? null;
  const replicationStatus = overview.find((entry) => entry.experiment.id === experimentId) ?? null;

  return {
    ok: true,
    package: {
      experimentId,
      hypothesis: protocol.hypothesis,
      protocol,
      frozenArtifacts,
      executionReceipts: runs,
      rawOutputs: runs,
      interpretationTable,
      replicationStatus,
    },
  };
}

async function listPublishedRuns(experimentId: string): Promise<PublishedExperimentRun[]> {
  const client = getSupabaseServer();
  if (!client) return [];
  const { data, error } = await client
    .from('experiment_results')
    .select('id, provider, model, aggregates, results_json, content_hash, visibility, receipt_id, created_at')
    .eq('experiment', experimentId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    provider: String(row.provider),
    model: String(row.model),
    aggregates: (row.aggregates ?? {}) as Record<string, unknown>,
    resultsJson: String(row.results_json ?? ''),
    contentHash: String(row.content_hash ?? ''),
    visibility: String(row.visibility ?? ''),
    receiptId: row.receipt_id ? String(row.receipt_id) : null,
    createdAt: String(row.created_at ?? ''),
  }));
}
