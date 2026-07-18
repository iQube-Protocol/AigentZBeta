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
 * Composes existing organs — `deriveOverview` (the honest lifecycle), the
 * canonical `experiment_results` record, `callSovereign` (native, sovereignty-
 * receipted composition) — and never forks them. Grounded STRICTLY on the
 * manifest: the model regenerates prose, never invents results.
 *
 * T2 discipline: content + content_hash + grounded_on (result hashes) are T2-safe.
 */

import { createHash } from 'crypto';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { deriveOverview } from '@/services/research/lifecycle';
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

  const experiments: ExperimentFindings[] = EXPERIMENT_REGISTRY.filter((e) => inScope(e.id))
    .map((e) => {
      const entry = overview.find((o) => o.experiment.id === e.id);
      const runs = runsByExp[e.id] ?? [];
      // Only surface experiments that actually have canonical runs OR a known
      // lifecycle beyond 'designed' — the report speaks to real evidence.
      return {
        id: e.id,
        family: e.family,
        hypothesis: e.hypothesis,
        lifecycle: entry?.lifecycle ?? 'designed',
        publishedRuns: entry?.publishedRuns ?? runs.length,
        distinctProviders: entry?.distinctProviders ?? new Set(runs.map((r) => r.provider)).size,
        runs,
      };
    })
    .filter((e) => e.publishedRuns > 0);

  const groundedOn = experiments.flatMap((e) => e.runs.map((r) => r.contentHash)).filter(Boolean);
  return { scope, experiments, groundedOn };
}

/** A text grounding of the whole canonical record — what the narrative regenerates FROM. Pure. */
export function buildFindingsGrounding(manifest: FindingsManifest): string {
  const lines = manifest.experiments.map((e) => {
    const runLines = e.runs
      .map((r, i) => `    run ${i + 1} · ${r.provider}/${r.model} · ${JSON.stringify(r.aggregates)} · ${r.contentHash.slice(0, 16)}… · ${r.at ?? '—'}`)
      .join('\n');
    return `${e.id} — ${e.family}\n  hypothesis: ${e.hypothesis}\n  lifecycle: ${e.lifecycle} · publishedRuns: ${e.publishedRuns} · distinctProviders: ${e.distinctProviders}\n${runLines}`;
  });
  return `CANONICAL FINDINGS TO DATE (scope: ${manifest.scope}) — ${manifest.experiments.length} experiment(s) with published runs:\n\n${lines.join('\n\n')}`;
}

const REPORT_SYSTEM = [
  'You are composing the CANONICAL Findings Report of the metaMe Invariant Research Lab (Foundational Research Series).',
  'REGENERATE THE ENTIRE REPORT as a coherent whole from the canonical findings manifest — the introduction, the framing of which experiments exist and what they COLLECTIVELY establish, a section per experiment, and cross-cutting conclusions must ALL reflect EVERY experiment present. Never describe the series as "three experiments" if the manifest lists more; the narrative must stay coherent with the collective record.',
  'Ground STRICTLY on the manifest: never invent a result, a number, an experiment, or a claim not present. Where a run is single-model or a formal pass is open, say so. Include a short trust-model note (each run stores exact results JSON + a sha256 content commitment, DVN-anchorable).',
  'Follow the CPS editorial arc (Problem → Opportunity → Constitutional Principle → Architecture/Findings → Implications) in standards-body register (W3C / IEEE / NIST / IBM Research), not marketing. Output Markdown.',
].join('\n\n');

export interface ComposedReport {
  markdown: string;
  contentHash: string;
  groundedOn: string[];
  sovereignty: { provider: string; model: string; degraded: boolean; sovereignFloor: boolean; stage: string; governingInvariants: string[] };
}

/** Compose (regenerate) the canonical report narrative from the collective findings. Impure. */
export async function composeCanonicalReport(scope = 'all', maxTokens = 3500): Promise<ComposedReport> {
  const manifest = await gatherFindings(scope);
  const grounding = buildFindingsGrounding(manifest);
  const result = await callSovereign('reasoning', REPORT_SYSTEM, grounding, maxTokens);
  const markdown = result.text;
  const contentHash = createHash('sha256').update(markdown).digest('hex');
  return {
    markdown,
    contentHash,
    groundedOn: manifest.groundedOn,
    sovereignty: {
      provider: result.provider,
      model: result.model,
      degraded: result.degraded,
      sovereignFloor: result.sovereignFloor,
      stage: result.stage,
      governingInvariants: result.governingInvariants,
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
