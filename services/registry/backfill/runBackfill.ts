/**
 * iqube_id_map backfill driver.
 *
 * Stage 2 C10. PRD v1.1 §B.3 per-surface backfill gate: no read-path
 * flip to resolveIQube() until the relevant source has an idempotent
 * iqube_id_map backfill complete AND a dedupe report with zero
 * unresolved collisions.
 *
 * This driver is:
 *   - Idempotent — re-runnable. Existing iqube_id_map rows are skipped
 *     via UNIQUE (source, source_id).
 *   - Per-surface scoped — caller picks which source to backfill.
 *   - Report-emitting — every run returns { processed, inserted,
 *     skipped, errors } per source.
 *   - Non-destructive — never deletes or modifies existing rows.
 *
 * Run from a Next.js route handler (admin-gated) or from a one-off
 * Node script:
 *
 *   import { backfillAll, backfillSource } from '@/services/registry/backfill/runBackfill';
 *
 *   const report = await backfillAll();
 *   // or:
 *   const report = await backfillSource('triad_meta');
 *
 * The driver respects the canonical authority matrix — it never decides
 * access, never decides ownership, never writes receipts. It writes
 * iqube_id_map rows only.
 */

import { createClient } from '@supabase/supabase-js';

import type { IQubeIdMapSource, IQubePrimitiveType } from '@/types/registry-canonical';
import { syntheticIQubeId } from '../adapters';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ── Report shape ─────────────────────────────────────────────────────────

export interface BackfillSourceReport {
  source: IQubeIdMapSource;
  processed: number;
  inserted: number;
  skipped: number;
  errors: Array<{ source_id: string; error: string }>;
  duration_ms: number;
}

export interface BackfillReport {
  started_at: string;
  finished_at: string;
  per_source: BackfillSourceReport[];
  total_inserted: number;
  total_skipped: number;
  total_errors: number;
}

// ── Per-source backfill helpers ───────────────────────────────────────────

interface SourceRow {
  source_id: string;
  primitive_type: IQubePrimitiveType;
  synthetic: boolean;
  iqube_id?: string;          // For UUID-already sources (content_qubes, iq_meta_qubes)
  legacy_primitive_type?: string;
  notes?: string;
}

type SourceLoader = () => Promise<SourceRow[]>;

async function loadTrinityMetaRows(): Promise<SourceRow[]> {
  const sb = client();
  // Identify orphan metas (Stage 0 Finding F — flagged as test fixtures)
  // and tag them with notes='legacy_test_fixture'.
  const { data: metas } = await sb
    .from('iq_meta_qubes')
    .select('id, slug, qube_type');
  if (!metas) return [];

  // Determine which metas have an owning row in master_content_qubes
  // or codex_media_assets.
  const { data: masters } = await sb
    .from('master_content_qubes')
    .select('meta_qube_id');
  const { data: media } = await sb
    .from('codex_media_assets')
    .select('meta_qube_id');
  const owned = new Set<string>([
    ...(masters?.map((r) => (r as any).meta_qube_id).filter(Boolean) ?? []),
    ...(media?.map((r) => (r as any).meta_qube_id).filter(Boolean) ?? []),
  ]);

  return metas.map((m) => {
    const row = m as any;
    const isOrphan = !owned.has(row.id);
    // Best-effort primitive_type inference from qube_type column. Stage 0
    // audit showed 'cluster' (→ ClusterQube), 'master_content' (→ ContentQube),
    // 'media_asset' (→ ContentQube). Default ContentQube for unknown.
    let primitive: IQubePrimitiveType = 'ContentQube';
    if (typeof row.qube_type === 'string') {
      const qt = row.qube_type.toLowerCase();
      if (qt === 'cluster') primitive = 'ClusterQube';
    }
    return {
      source_id: row.id,
      primitive_type: primitive,
      synthetic: false,
      iqube_id: row.id,  // Reuse UUID
      notes: isOrphan ? 'legacy_test_fixture' : undefined,
    };
  });
}

async function loadContentQubeRows(): Promise<SourceRow[]> {
  const sb = client();
  const { data } = await sb
    .from('content_qubes')
    .select('id');
  if (!data) return [];
  return data.map((r) => ({
    source_id: (r as any).id,
    primitive_type: 'ContentQube' as IQubePrimitiveType,
    synthetic: false,
    iqube_id: (r as any).id,
  }));
}

async function loadRegistryAssetRows(): Promise<SourceRow[]> {
  const sb = client();
  const { data } = await sb
    .from('registry_assets')
    .select('asset_id, primitive_type, tool_subtype');
  if (!data) return [];
  return data.map((r) => {
    const row = r as any;
    return {
      source_id: row.asset_id,
      primitive_type: (row.primitive_type ?? 'ToolQube') as IQubePrimitiveType,
      synthetic: false,
    };
  });
}

async function loadAigentQubeCodeRows(): Promise<SourceRow[]> {
  const { listAigentQubeSources } = await import('@/services/iqube/legibility/sources/aigentQubeSource');
  const srcs = listAigentQubeSources();
  return srcs.map((src) => ({
    source_id: src.iqube_id,
    primitive_type: 'AigentQube' as IQubePrimitiveType,
    synthetic: true,
    iqube_id: syntheticIQubeId('code:aigentQubeSource', src.iqube_id),
  }));
}

async function loadToolQubeCodeRows(): Promise<SourceRow[]> {
  const { listToolQubeSources } = await import('@/services/iqube/legibility/sources/toolQubeSource');
  const srcs = listToolQubeSources();
  return srcs.map((src) => ({
    source_id: src.iqube_id,
    primitive_type: 'ToolQube' as IQubePrimitiveType,
    synthetic: true,
    iqube_id: syntheticIQubeId('code:toolQubeSource', src.iqube_id),
  }));
}

async function loadChainTemplateRows(): Promise<SourceRow[]> {
  // Factory Ingestion stub for intent chain templates (spec §6.6).
  // Each template in services/intentChains/templates/*.json registers
  // as a synthetic ToolQube primitive so it appears in the registry
  // plane (Browse, Score Coverage). Full canonization (meta + blak +
  // token + governance) is deferred follow-on work.
  try {
    const { listTemplates } = await import('@/services/intentChains/registry');
    return listTemplates().map((t) => ({
      source_id: t.id,
      primitive_type: 'ToolQube' as IQubePrimitiveType,
      synthetic: true,
      iqube_id: syntheticIQubeId('code:chainTemplate', t.id),
      legacy_primitive_type: 'WorkflowQube',
      notes: `intent chain template v=${t.version} cost_qc=${t.cost_qc}`,
    }));
  } catch (err) {
    console.warn('[chain template loader] failed:', (err as Error).message);
    return [];
  }
}

async function loadLiquidUiTemplateRows(): Promise<SourceRow[]> {
  const { getStore } = await import('@/app/api/registry/templates/store');
  return getStore()
    .filter((t) =>
      (t.metaExtras ?? []).some((x) => x?.k === 'category' && x?.v === 'ui_template_archetype'),
    )
    .map((t) => ({
      source_id: t.id,
      primitive_type: 'DataQube' as IQubePrimitiveType,
      synthetic: true,
      iqube_id: syntheticIQubeId('code:liquidui-template', t.id),
      legacy_primitive_type: 'LiquidUITemplateArchetypeQube',
    }));
}

const SOURCE_LOADERS: Record<IQubeIdMapSource, SourceLoader | null> = {
  triad_meta: loadTrinityMetaRows,
  triad_blak: null,            // Implied via triad_meta; not separately backfilled
  triad_token: null,           // Implied via triad_meta; not separately backfilled
  content_qube: loadContentQubeRows,
  registry_asset: loadRegistryAssetRows,
  master_content_qube: null,   // Legacy bridge — accessed via content_qube path
  codex_media_asset: null,     // Legacy bridge — accessed via content_qube path
  identity_iqube: null,        // Stage 3+ — needs the identity_iqube column on personas
  memory_iqube: null,          // Stage 3+ — needs the memory_iqubes table loader
  'code:aigentQubeSource': loadAigentQubeCodeRows,
  'code:toolQubeSource': loadToolQubeCodeRows,
  'code:liquidui-template': loadLiquidUiTemplateRows,
  'code:chainTemplate': loadChainTemplateRows,
};

// ── Backfill execution ────────────────────────────────────────────────────

export async function backfillSource(source: IQubeIdMapSource): Promise<BackfillSourceReport> {
  const start = Date.now();
  const loader = SOURCE_LOADERS[source];
  if (!loader) {
    return {
      source,
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [{ source_id: '(meta)', error: `No loader defined for source='${source}'` }],
      duration_ms: Date.now() - start,
    };
  }

  let rows: SourceRow[];
  try {
    rows = await loader();
  } catch (err) {
    return {
      source,
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [{ source_id: '(loader)', error: (err as Error).message }],
      duration_ms: Date.now() - start,
    };
  }

  const sb = client();
  const report: BackfillSourceReport = {
    source,
    processed: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
    duration_ms: 0,
  };

  for (const row of rows) {
    const insertRow: Record<string, unknown> = {
      source,
      source_id: row.source_id,
      primitive_type: row.primitive_type,
      synthetic: row.synthetic,
    };
    if (row.iqube_id) insertRow.iqube_id = row.iqube_id;
    if (row.legacy_primitive_type) insertRow.legacy_primitive_type = row.legacy_primitive_type;
    if (row.notes) insertRow.notes = row.notes;

    const { error } = await sb
      .from('iqube_id_map')
      .insert(insertRow)
      .select('iqube_id')
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique violation — row already exists. Idempotent skip.
        report.skipped++;
      } else {
        report.errors.push({ source_id: row.source_id, error: error.message });
      }
    } else {
      report.inserted++;
    }
  }

  report.duration_ms = Date.now() - start;
  return report;
}

/**
 * Backfill every supported source in dependency order.
 *
 * Order (per Stage 0 audit Cross-cutting Finding D):
 *   1. triad_meta              (no deps; many records reference via FK)
 *   2. content_qube            (independent; UUID already)
 *   3. registry_asset          (depends on Stage 1 C4 asset_class migration)
 *   4. code:aigentQubeSource   (synthetic; independent)
 *   5. code:toolQubeSource     (synthetic; independent)
 *   6. code:liquidui-template  (synthetic; independent)
 */
export async function backfillAll(): Promise<BackfillReport> {
  const started = new Date().toISOString();
  const order: IQubeIdMapSource[] = [
    'triad_meta',
    'content_qube',
    'registry_asset',
    'code:aigentQubeSource',
    'code:toolQubeSource',
    'code:liquidui-template',
  ];

  const perSource: BackfillSourceReport[] = [];
  for (const src of order) {
    perSource.push(await backfillSource(src));
  }

  return {
    started_at: started,
    finished_at: new Date().toISOString(),
    per_source: perSource,
    total_inserted: perSource.reduce((n, r) => n + r.inserted, 0),
    total_skipped: perSource.reduce((n, r) => n + r.skipped, 0),
    total_errors: perSource.reduce((n, r) => n + r.errors.length, 0),
  };
}

// ── Per-surface verification (the gate per PRD v1.1 §B.3) ─────────────────

export interface BackfillVerifyResult {
  source: IQubeIdMapSource;
  source_row_count: number;
  map_row_count: number;
  ready: boolean;
  detail: string;
}

export async function verifyBackfill(source: IQubeIdMapSource): Promise<BackfillVerifyResult> {
  const sb = client();
  const { count: mapCount, error: mapErr } = await sb
    .from('iqube_id_map')
    .select('*', { count: 'exact', head: true })
    .eq('source', source);

  if (mapErr) {
    return {
      source,
      source_row_count: -1,
      map_row_count: -1,
      ready: false,
      detail: `iqube_id_map count failed: ${mapErr.message}`,
    };
  }

  // Approximate source-row count via the loader. For Phase-1 simplicity
  // we re-load and count; future optimisation does a SELECT COUNT only.
  const loader = SOURCE_LOADERS[source];
  if (!loader) {
    return {
      source,
      source_row_count: 0,
      map_row_count: mapCount ?? 0,
      ready: false,
      detail: `No loader for source='${source}' — cannot verify`,
    };
  }
  const rows = await loader();

  const ready = (mapCount ?? 0) >= rows.length && rows.length > 0;
  return {
    source,
    source_row_count: rows.length,
    map_row_count: mapCount ?? 0,
    ready,
    detail: ready
      ? 'gate green'
      : `gate red: source=${rows.length} vs map=${mapCount ?? 0}`,
  };
}
