/**
 * reportComposition — the Findings Report as a PRODUCED constitutional artifact
 * (CFS-025 research profile applied to the report; CFS-019 · CFS-026).
 *
 * The report must not APPEND new experiments to a frozen narrative — it must
 * REGENERATE the whole narrative from the collective canonical findings to date
 * (so EXP-004's sovereignty results are woven into the introduction and
 * conclusions, not stapled on). Each regeneration is saved as a CANONICAL,
 * VERSIONED, DVN-receipted report: the next regeneration resets the narrative
 * from the comprehensive record (or a scoped area), and every prior version is
 * verifiable via its content hash + `artifact_published` receipt.
 *
 * Composition is DETERMINISTIC — `composeCanonicalReport` builds the markdown via
 * the shared `composeFindingsReport` (the SAME composer the live-draft tab uses),
 * grounded STRICTLY on the canonical `experiment_results` record. It never calls a
 * model (the prior sovereign-LLM regeneration exceeded the ~30s gateway envelope
 * and 504'd with an empty body, so no version was persisted) and never invents
 * results. `gatherFindings` / `buildFindingsGrounding` remain as the honest
 * findings manifest (consumed by canaries + diagnostics).
 *
 * T2 discipline: content + content_hash + grounded_on (result hashes) are T2-safe.
 */

import { createHash } from 'crypto';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { deriveOverview } from '@/services/research/lifecycle';
import { composeFindingsReport, type ReportRun } from '@/services/research/findingsReportComposer';
import { EXPERIMENT_REGISTRY } from '@/types/research';

export interface ExperimentFindings {
  id: string;
  family: string;
  hypothesis: string;
  lifecycle: string;
  publishedRuns: number;
  distinctProviders: number;
  /** Each canonical run's headline: provider/model + aggregates + hash. */
  runs: Array<{ provider: string; model: string; aggregates: unknown; contentHash: string; at: string | null }>;
}

export interface FindingsManifest {
  scope: string;
  experiments: ExperimentFindings[];
  /**
   * In-scope registry members with NO canonical runs yet, in canonical order.
   * Surfaced so the narrative can place them in sequence as "publication
   * pending" (never a silently-missing gap, e.g. EXP-005 between EXP-004 and
   * EXP-006) — the model is told NOT to invent results for these.
   */
  pending: Array<{ id: string; family: string; seriesId: string }>;
  /** All canonical result content hashes the narrative is grounded on. */
  groundedOn: string[];
}

/**
 * Gather the collective canonical findings to date. `scope` = 'all' | a series id
 * | an experiment id. Reads the honest overview + the canonical result rows.
 */
export async function gatherFindings(scope = 'all'): Promise<FindingsManifest> {
  const overview = await deriveOverview().catch(() => []);
  const admin = getSupabaseServer();
  const runsByExp: Record<string, ExperimentFindings['runs']> = {};
  if (admin) {
    const { data } = await admin
      .from('experiment_results')
      .select('experiment, provider, model, aggregates, content_hash, created_at')
      .order('created_at', { ascending: true });
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const exp = String(r.experiment);
      (runsByExp[exp] ??= []).push({
        provider: String(r.provider ?? ''),
        model: String(r.model ?? ''),
        aggregates: r.aggregates ?? {},
        contentHash: String(r.content_hash ?? ''),
        at: (r.created_at as string | null) ?? null,
      });
    }
  }

  const inScope = (id: string) =>
    scope === 'all' || id === scope || EXPERIMENT_REGISTRY.find((e) => e.id === id)?.seriesId === scope;

  // Registry order is canonical — preserve it (the narrative is sequenced by it).
  const inScopeMembers = EXPERIMENT_REGISTRY.filter((e) => inScope(e.id));
  const allFindings: ExperimentFindings[] = inScopeMembers.map((e) => {
    const entry = overview.find((o) => o.experiment.id === e.id);
    const runs = runsByExp[e.id] ?? [];
    return {
      id: e.id,
      family: e.family,
      hypothesis: e.hypothesis,
      lifecycle: entry?.lifecycle ?? 'designed',
      publishedRuns: entry?.publishedRuns ?? runs.length,
      distinctProviders: entry?.distinctProviders ?? new Set(runs.map((r) => r.provider)).size,
      runs,
    };
  });

  // Experiments with real evidence carry the findings; the rest are surfaced as
  // "pending" (in canonical order) so the narrative can place them in sequence
  // without inventing results — never a silently-missing gap.
  const experiments = allFindings.filter((e) => e.publishedRuns > 0);
  const pending = inScopeMembers
    .filter((e) => (allFindings.find((f) => f.id === e.id)?.publishedRuns ?? 0) === 0)
    .map((e) => ({ id: e.id, family: e.family, seriesId: e.seriesId }));

  const groundedOn = experiments.flatMap((e) => e.runs.map((r) => r.contentHash)).filter(Boolean);
  return { scope, experiments, pending, groundedOn };
}

/** A text grounding of the whole canonical record — what the narrative regenerates FROM. Pure. */
export function buildFindingsGrounding(manifest: FindingsManifest): string {
  const lines = manifest.experiments.map((e) => {
    const runLines = e.runs
      .map((r, i) => `    run ${i + 1} · ${r.provider}/${r.model} · ${JSON.stringify(r.aggregates)} · ${r.contentHash.slice(0, 16)}… · ${r.at ?? '—'}`)
      .join('\n');
    return `${e.id} — ${e.family}\n  hypothesis: ${e.hypothesis}\n  lifecycle: ${e.lifecycle} · publishedRuns: ${e.publishedRuns} · distinctProviders: ${e.distinctProviders}\n${runLines}`;
  });
  const pendingBlock =
    manifest.pending.length > 0
      ? `\n\nPENDING (in-scope, canonical order — run complete or designed, NO canonical runs yet; place these in sequence as "publication pending" and DO NOT invent any result for them):\n${manifest.pending
          .map((p) => `  ${p.id} — ${p.family} (series ${p.seriesId})`)
          .join('\n')}`
      : '';
  return `CANONICAL FINDINGS TO DATE (scope: ${manifest.scope}) — ${manifest.experiments.length} experiment(s) with published runs, listed in CANONICAL SEQUENCE (report MUST preserve this order):\n\n${lines.join('\n\n')}${pendingBlock}`;
}

export interface ComposedReport {
  markdown: string;
  contentHash: string;
  groundedOn: string[];
  sovereignty: { provider: string; model: string; degraded: boolean; sovereignFloor: boolean; stage: string; governingInvariants: string[] };
}

/**
 * Gather every in-scope canonical run grouped by experiment id — the input to
 * the deterministic composer. Reads the SAME `experiment_results` rows as
 * `gatherFindings`, but keeps ALL rows (including experiment ids outside the
 * pinned registry, which the composer surfaces under "Further experiments").
 * Per-row DVN status defaults to 'local' in the snapshot; the report version
 * itself carries the DVN-anchorable publication receipt.
 */
async function gatherRunsByExp(scope: string): Promise<{ runsByExp: Record<string, ReportRun[]>; groundedOn: string[] }> {
  const admin = getSupabaseServer();
  const runsByExp: Record<string, ReportRun[]> = {};
  const groundedOn: string[] = [];
  if (!admin) return { runsByExp, groundedOn };
  const inScope = (id: string) =>
    scope === 'all' || id === scope || EXPERIMENT_REGISTRY.find((e) => e.id === id)?.seriesId === scope;
  const { data } = await admin
    .from('experiment_results')
    .select('experiment, provider, model, aggregates, content_hash, created_at')
    .order('created_at', { ascending: true });
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const exp = String(r.experiment);
    if (!inScope(exp)) continue;
    const hash = String(r.content_hash ?? '');
    (runsByExp[exp] ??= []).push({
      provider: String(r.provider ?? ''),
      model: String(r.model ?? ''),
      aggregates: (r.aggregates ?? {}) as Record<string, unknown>,
      contentHash: hash,
      receiptStatus: null,
      createdAt: (r.created_at as string) ?? new Date().toISOString(),
    });
    if (hash) groundedOn.push(hash);
  }
  return { runsByExp, groundedOn };
}

/**
 * Regenerate the canonical report DETERMINISTICALLY from the collective findings
 * — the SAME composer the live-draft tab uses (`composeFindingsReport`). No LLM
 * call: the prior sovereign-model regeneration exceeded the ~30s gateway
 * envelope and returned an empty-body 504, so no new version was ever persisted.
 * Deterministic composition is instant, byte-reproducible for a given record,
 * and already fully coherent (sequential, series-grouped, single ordered
 * document). The `sovereignty` descriptor records that this artifact is a
 * deterministic composition, not a model generation.
 */
export async function composeCanonicalReport(scope = 'all'): Promise<ComposedReport> {
  const { runsByExp, groundedOn } = await gatherRunsByExp(scope);
  const markdown = composeFindingsReport({ runsByExp, now: new Date() });
  const contentHash = createHash('sha256').update(markdown).digest('hex');
  return {
    markdown,
    contentHash,
    groundedOn,
    sovereignty: {
      provider: 'deterministic',
      model: 'findings-report-composer',
      degraded: false,
      sovereignFloor: true,
      stage: 'composition',
      governingInvariants: [],
    },
  };
}

export interface ReportVersionRow {
  id: string;
  version: number;
  scope: string;
  title: string;
  content: string;
  content_hash: string;
  receipt_id: string | null;
  sovereignty: unknown;
  grounded_on: unknown;
  created_at: string;
  /** Stage 3 of the lifecycle: set = publicly visible in Publications → Reports. */
  published_at?: string | null;
}

const MISSING = 'research_report_versions';

/** Persist a regenerated report as the next canonical version for its scope. */
export async function persistReportVersion(input: {
  scope: string;
  title: string;
  content: string;
  contentHash: string;
  receiptId: string | null;
  sovereignty: unknown;
  groundedOn: string[];
}): Promise<{ ok: true; version: number; id: string } | { ok: false; error: string; code?: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };
  try {
    const { data: last } = await admin
      .from('research_report_versions')
      .select('version')
      .eq('scope', input.scope)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (last?.version ?? 0) + 1;
    const { data, error } = await admin
      .from('research_report_versions')
      .insert({
        version,
        scope: input.scope,
        title: input.title,
        content: input.content,
        content_hash: input.contentHash,
        receipt_id: input.receiptId,
        sovereignty: input.sovereignty,
        grounded_on: input.groundedOn,
      })
      .select('id, version')
      .single();
    if (error) {
      if (error.message.includes(MISSING)) return { ok: false, code: 'migration_pending', error: 'research_report_versions table not provisioned — apply 20260711000000.' };
      return { ok: false, error: error.message };
    }
    return { ok: true, version: data.version as number, id: String(data.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** List a scope's canonical report versions (newest first). */
export async function listReportVersions(scope = 'all'): Promise<ReportVersionRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const { data, error } = await admin
    .from('research_report_versions')
    .select('*')
    .eq('scope', scope)
    .order('version', { ascending: false });
  if (error) return [];
  return (data ?? []) as ReportVersionRow[];
}

/**
 * Stage 3 — publish (or unpublish) a canonical version. Publishing requires
 * the version to be canonical in full: minted (receipt_id set), because the
 * public surface presents published reports as receipt-anchored records.
 */
export async function setReportVersionPublished(
  scope: string,
  version: number,
  publish: boolean,
): Promise<{ ok: true; publishedAt: string | null } | { ok: false; error: string; code?: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };
  const { data: row, error: readErr } = await admin
    .from('research_report_versions')
    .select('id, receipt_id, published_at')
    .eq('scope', scope)
    .eq('version', version)
    .maybeSingle();
  if (readErr) {
    if (readErr.message.includes('published_at')) {
      return { ok: false, code: 'migration_pending', error: 'published_at column not provisioned — apply 20260723000000.' };
    }
    return { ok: false, error: readErr.message };
  }
  if (!row) return { ok: false, error: `No canonical version v${version} for scope '${scope}'` };
  if (publish && !row.receipt_id) {
    return { ok: false, error: 'Version has no DVN receipt yet — regenerate (mint) before publishing' };
  }
  const publishedAt = publish ? new Date().toISOString() : null;
  const { error } = await admin
    .from('research_report_versions')
    .update({ published_at: publishedAt })
    .eq('id', row.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, publishedAt };
}

/**
 * Attach a receipt id to a canonical version that was persisted without one
 * (e.g. the receipt write failed at regeneration time). Idempotent-ish: refuses
 * to overwrite an existing receipt. Lets the operator mint the missing anchor
 * and publish an existing version without a full (hash-changing) regenerate.
 */
export async function attachReportReceipt(
  scope: string,
  version: number,
  receiptId: string,
): Promise<{ ok: true; receiptId: string } | { ok: false; error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };
  const { data: row, error: readErr } = await admin
    .from('research_report_versions')
    .select('id, receipt_id')
    .eq('scope', scope)
    .eq('version', version)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: `No canonical version v${version} for scope '${scope}'` };
  if (row.receipt_id) return { ok: true, receiptId: String(row.receipt_id) };
  const { error } = await admin
    .from('research_report_versions')
    .update({ receipt_id: receiptId })
    .eq('id', row.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, receiptId };
}

/** All published report versions across scopes (public surface), newest first. */
export async function listPublishedReports(): Promise<ReportVersionRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const { data, error } = await admin
    .from('research_report_versions')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as ReportVersionRow[];
}
