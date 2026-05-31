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
import type { IQubePrimitiveType } from '@/types/iqube/legibility';

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
}

function isPrimitiveType(value: unknown): value is IQubePrimitiveType {
  return (
    typeof value === 'string' &&
    ['DataQube', 'ContentQube', 'ToolQube', 'ModelQube', 'AigentQube', 'ClusterQube'].includes(value)
  );
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
      metadata: body.metadata as Record<string, unknown> | undefined,
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
  });
}
