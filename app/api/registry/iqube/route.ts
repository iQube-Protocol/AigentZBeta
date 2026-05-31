/**
 * POST /api/registry/iqube — create a draft canonical iQube.
 *
 * Replaces the mock that returned a fake registryId. PRD v1.0 §11.2 +
 * Stage 1 close report. The draft is created in two surfaces:
 *   1. iq_meta_qubes (triad meta) via server/services/iqRegistryService
 *   2. iqube_id_map (canonical id join) via direct insert
 *
 * The triad blak + token are NOT created here — those land via the
 * mint saga when the iQube moves through the mint pipeline. A draft
 * iQube has meta + iqube_id_map only; mint_status='unminted',
 * internal_lifecycle='draft'.
 *
 * Auth: gated by the access spine — caller must have an active persona
 * with cartridgeFlags.isAdmin OR isPartner. Spine refuses on missing
 * Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createMetaQube } from '@/server/services/iqRegistryService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listIQubes, resolveIQube } from '@/services/registry/resolver';
import type { IQubePrimitiveType } from '@/types/iqube/legibility';
import type { IQubeIdMapSource } from '@/types/registry-canonical';

interface ScoreAxes {
  sensitivity?: number;
  accuracy?: number;
  verifiability?: number;
  risk?: number;
}

interface CreateDraftRequest {
  name: string;
  slug?: string;
  primitive_type: IQubePrimitiveType;
  description?: string;
  series?: string;
  episode_number?: number;
  tags?: string[];
  preview_url?: string;
  metadata?: Record<string, unknown>;

  // Phase B B1 — legacy template field surface. These are stashed under
  // `metadata.legacyTemplateExtras` on the canonical record so the legacy
  // resolver/list path can round-trip them without a schema migration.
  // Score axes additionally upsert into `iqube_scores` with the operator-
  // override source flag (sacred per the backfill close report).
  business_model?: string;
  price?: number;
  score_axes?: ScoreAxes;
  blakqube_labels?: unknown;
  meta_extras?: Array<{ k: string; v: string }>;
  parent_template_id?: string;
  identity_state?: string;
  min_reputation_bucket?: number;
  require_human_proof?: boolean;
  require_agent_declare?: boolean;
  instance_type?: 'template' | 'instance';
  visibility_state?: 'public' | 'unlisted' | 'private' | 'public_meta_private_payload';
}

function pickLegacyExtras(body: CreateDraftRequest): Record<string, unknown> | undefined {
  const extras: Record<string, unknown> = {};
  if (body.business_model !== undefined) extras.businessModel = body.business_model;
  if (body.price !== undefined) extras.price = body.price;
  if (body.blakqube_labels !== undefined) extras.blakqubeLabels = body.blakqube_labels;
  if (body.meta_extras !== undefined) extras.metaExtras = body.meta_extras;
  if (body.parent_template_id !== undefined) extras.parentTemplateId = body.parent_template_id;
  if (body.identity_state !== undefined) extras.identityState = body.identity_state;
  if (body.min_reputation_bucket !== undefined) extras.minReputationBucket = body.min_reputation_bucket;
  if (body.require_human_proof !== undefined) extras.requireHumanProof = body.require_human_proof;
  if (body.require_agent_declare !== undefined) extras.requireAgentDeclare = body.require_agent_declare;
  if (body.instance_type !== undefined) extras.instanceType = body.instance_type;
  if (body.visibility_state !== undefined) extras.visibilityState = body.visibility_state;
  return Object.keys(extras).length > 0 ? extras : undefined;
}

function clampScoreAxis(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

async function upsertOperatorOverrideScores(
  iqubeId: string,
  axes: ScoreAxes,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<void> {
  if (!supabase) return;
  const sensitivity = axes.sensitivity !== undefined ? clampScoreAxis(axes.sensitivity) : null;
  const accuracy = axes.accuracy !== undefined ? clampScoreAxis(axes.accuracy) : null;
  const verifiability = axes.verifiability !== undefined ? clampScoreAxis(axes.verifiability) : null;
  const risk = axes.risk !== undefined ? clampScoreAxis(axes.risk) : null;

  // Reliability = accuracy*0.6 + verifiability*0.4
  // Trust = 10 - (sensitivity*0.4 + risk*0.6)
  // Derived axes only meaningful when both raw inputs present.
  const reliability =
    accuracy !== null && verifiability !== null
      ? Number((accuracy * 0.6 + verifiability * 0.4).toFixed(1))
      : null;
  const trust =
    sensitivity !== null && risk !== null
      ? Number((10 - (sensitivity * 0.4 + risk * 0.6)).toFixed(1))
      : null;

  const row: Record<string, unknown> = {
    iqube_id: iqubeId,
    derivation_strategy: 'operator_override_v1',
    updated_at: new Date().toISOString(),
  };
  if (sensitivity !== null) {
    row.sensitivity = sensitivity;
    row.sensitivity_source = 'operator_override';
  }
  if (accuracy !== null) {
    row.accuracy = accuracy;
    row.accuracy_source = 'operator_override';
  }
  if (verifiability !== null) {
    row.verifiability = verifiability;
    row.verifiability_source = 'operator_override';
  }
  if (risk !== null) {
    row.risk = risk;
    row.risk_source = 'operator_override';
  }
  if (reliability !== null) row.derived_reliability = reliability;
  if (trust !== null) row.derived_trust = trust;

  await supabase.from('iqube_scores').upsert(row, { onConflict: 'iqube_id' });
}

function isPrimitiveType(value: unknown): value is IQubePrimitiveType {
  return (
    typeof value === 'string' &&
    ['DataQube', 'ContentQube', 'ToolQube', 'ModelQube', 'AigentQube', 'ClusterQube'].includes(value)
  );
}

/**
 * GET /api/registry/iqube — list canonical iQubes (Browse tab data source).
 *
 * Query params:
 *   ?primitive_type=ContentQube   filter by primitive
 *   ?source=triad_meta            filter by iqube_id_map.source
 *   ?cartridge=knyt-codex         filter by cartridge binding membership
 *   ?limit=200                    cap (default 200)
 *   ?expand=cartridge|public      hydrate each entry through the resolver
 *                                 with the chosen projection. Omit for the
 *                                 lightweight (iqube_id_map only) response.
 *
 * The lightweight response (no expand) is fast — single iqube_id_map
 * SELECT. The expanded response hydrates each entry through the per-
 * primitive adapter; use only when the caller needs display data.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const primitiveParam = url.searchParams.get('primitive_type');
  const sourceParam = url.searchParams.get('source');
  const cartridge = url.searchParams.get('cartridge') ?? undefined;
  const expand = url.searchParams.get('expand');
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '200', 10);

  const persona = await getActivePersona(request);

  const filter = {
    primitive_type: primitiveParam ?? undefined,
    source: (sourceParam as IQubeIdMapSource) ?? undefined,
    cartridge,
    limit: Number.isFinite(limit) && limit > 0 && limit <= 500 ? limit : 200,
  };

  const result = await listIQubes(filter);

  if (!expand) {
    // Lightweight response — id-map entries only.
    return NextResponse.json({ entries: result.entries, total: result.entries.length });
  }

  // Expanded: hydrate each entry through the resolver. The projection
  // shape depends on the request; default to 'cartridge'.
  const projection = expand === 'public' ? 'public' : 'cartridge';
  const allowPrivate = false;

  const expanded = await Promise.all(
    result.entries.map((entry) =>
      resolveIQube(entry.iqube_id, {
        persona: persona ?? undefined,
        projection,
        allowPrivate,
      }).catch(() => null),
    ),
  );

  return NextResponse.json({
    entries: expanded.filter((v) => v !== null),
    total: expanded.filter((v) => v !== null).length,
    skipped: expanded.filter((v) => v === null).length,
  });
}

export async function POST(request: NextRequest) {
  // 1. Auth — spine-gated
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin && !persona.cartridgeFlags?.isPartner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 2. Body validation
  let body: CreateDraftRequest;
  try {
    body = (await request.json()) as CreateDraftRequest;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json(
      { error: 'name is required (string)' },
      { status: 400 },
    );
  }
  if (!isPrimitiveType(body.primitive_type)) {
    return NextResponse.json(
      {
        error:
          "primitive_type is required and must be one of: DataQube, ContentQube, ToolQube, ModelQube, AigentQube, ClusterQube",
      },
      { status: 400 },
    );
  }

  // 3. Generate slug if not provided
  const slug =
    body.slug ??
    body.name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

  // 4. Create the meta qube (triad spine)
  //    Phase B B1: legacy template extras (business model, identity hints,
  //    blakqube labels, fork lineage, etc.) are folded into the JSONB
  //    metadata column under `legacyTemplateExtras`. The resolver/adapter
  //    surface them back as legacy IQubeTemplate fields on read.
  const legacyExtras = pickLegacyExtras(body);
  const mergedMetadata: Record<string, unknown> = {
    ...(body.metadata as Record<string, unknown> | undefined ?? {}),
    ...(legacyExtras ? { legacyTemplateExtras: legacyExtras } : {}),
  };

  let metaQubeId: string;
  try {
    metaQubeId = await createMetaQube({
      name: body.name,
      slug,
      qubeType: body.primitive_type,
      series: body.series,
      episodeNumber: body.episode_number,
      tags: body.tags,
      description: body.description,
      previewUrl: body.preview_url,
      metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'meta_create_failed', detail: (err as Error).message },
      { status: 500 },
    );
  }

  // 5. Insert the canonical iqube_id_map row
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: 'storage_unavailable' },
      { status: 503 },
    );
  }

  const { data, error: mapErr } = await supabase
    .from('iqube_id_map')
    .insert({
      source: 'triad_meta',
      source_id: metaQubeId,
      primitive_type: body.primitive_type,
      synthetic: false,
      notes: `created via /api/registry/iqube by persona alias commitment=${persona.cohortMemberships?.[0]?.aliasCommitment ?? 'unknown'}`,
    })
    .select('iqube_id')
    .single();

  if (mapErr || !data) {
    return NextResponse.json(
      { error: 'id_map_insert_failed', detail: mapErr?.message },
      { status: 500 },
    );
  }

  const iqubeId = (data as { iqube_id: string }).iqube_id;

  // 6. Phase B B1: if the caller supplied score axes, write them as
  //    operator-override into iqube_scores. Best-effort — failure here
  //    doesn't fail the create (the draft is real; backfill will derive
  //    later if overrides are missing).
  if (body.score_axes && typeof body.score_axes === 'object') {
    try {
      await upsertOperatorOverrideScores(iqubeId, body.score_axes, supabase);
    } catch {
      // Non-fatal — operator can re-derive from the Health tab.
    }
  }

  return NextResponse.json({
    iqube_id: iqubeId,
    meta_qube_id: metaQubeId,
    primitive_type: body.primitive_type,
    name: body.name,
    slug,
    internal_lifecycle: 'draft',
    surface_lifecycle: 'draft',
    mint_status: 'unminted',
    card_url: `/api/iqubes/${iqubeId}/card`,
    created_at: new Date().toISOString(),
    extras_persisted: legacyExtras ? Object.keys(legacyExtras) : [],
    scores_overridden: body.score_axes ? Object.keys(body.score_axes) : [],
  });
}
