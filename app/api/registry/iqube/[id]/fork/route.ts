/**
 * POST /api/registry/iqube/[id]/fork — fork an existing canonical iQube.
 *
 * Phase B B2 of the legacy /registry → canonical SoT integration.
 *
 * Creates a new draft iQube derived from the parent. The new record:
 *   - Carries `parentTemplateId` + `forkOriginIqubeId` in
 *     metadata.legacyTemplateExtras (template lineage)
 *   - Auto-increments `provenance` (parent.provenance + 1; defaults to 1
 *     if parent has no prior provenance)
 *   - Copies parent's tags, description, business_model, blakqube_labels,
 *     identity hints into the new draft's metadata
 *   - Copies parent's score block as operator overrides on the fork
 *     (so forked iQubes inherit scores rather than starting unscored;
 *     operator can edit them in the detail modal)
 *   - Emits orchestration_events row with event_type='iqube_forked'
 *     for the audit trail (T2 attribution from active persona)
 *
 * Auth: spine-gated, admin OR partner.
 *
 * Body (optional overrides):
 *   { name?: string, description?: string }
 *   Defaults to parent's name + " (fork)".
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createMetaQube, getMetaQube } from '@/server/services/iqRegistryService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveIQube } from '@/services/registry/resolver';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import type { CanonicalIQubeInternalRecord } from '@/types/registry-canonical';

interface ForkRequest {
  name?: string;
  description?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  // 1. Auth
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin && !persona.cartridgeFlags?.isPartner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 2. Resolve parent — internal projection gives meta_qube_id + lineage
  const params = await Promise.resolve(context.params);
  const parentId = params.id;
  if (!parentId || typeof parentId !== 'string' || parentId.length < 4) {
    return NextResponse.json({ error: 'invalid_iqube_id' }, { status: 400 });
  }

  const parent = (await resolveIQube(parentId, {
    persona,
    projection: 'internal',
    allowPrivate: true,
  })) as CanonicalIQubeInternalRecord | null;

  if (!parent) {
    return NextResponse.json({ error: 'parent_not_found' }, { status: 404 });
  }

  if (!parent.meta_qube_id) {
    return NextResponse.json(
      { error: 'parent_has_no_meta_qube', detail: 'fork requires a trinity-backed parent' },
      { status: 422 },
    );
  }

  const parentMeta = await getMetaQube(parent.meta_qube_id);
  if (!parentMeta) {
    return NextResponse.json(
      { error: 'parent_meta_not_found' },
      { status: 404 },
    );
  }

  // 3. Body overrides (optional)
  let body: ForkRequest = {};
  try {
    body = (await request.json()) as ForkRequest;
  } catch {
    // Body is optional — empty is fine
  }

  const baseName = (parentMeta.name || 'Untitled').replace(/(\s*\(fork\)\s*)+$/i, '');
  const newName = (typeof body.name === 'string' && body.name.trim().length > 0)
    ? body.name.trim()
    : `${baseName} (fork)`;
  const newDescription = (typeof body.description === 'string')
    ? body.description
    : (parentMeta.description ?? '');

  // 4. Compute new provenance + carry-over legacy extras
  const parentMetadata = (parentMeta.metadata ?? {}) as Record<string, unknown>;
  const parentExtras = (parentMetadata.legacyTemplateExtras as Record<string, unknown> | undefined) ?? {};
  const parentProvenance = Number(parentExtras.provenance ?? 0);
  const newProvenance = Number.isFinite(parentProvenance) ? parentProvenance + 1 : 1;

  const forkExtras: Record<string, unknown> = {
    ...parentExtras,
    parentTemplateId: parentId,
    forkOriginIqubeId: parentExtras.forkOriginIqubeId ?? parentId,
    provenance: newProvenance,
    forkedAt: new Date().toISOString(),
  };

  const slug = newName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);

  // 5. Create the fork draft
  let metaQubeId: string;
  try {
    metaQubeId = await createMetaQube({
      name: newName,
      slug,
      qubeType: parent.primitive_type,
      tags: parentMeta.tags,
      description: newDescription,
      previewUrl: parentMeta.preview_url ?? undefined,
      metadata: {
        ...parentMetadata,
        legacyTemplateExtras: forkExtras,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'fork_create_failed', detail: (err as Error).message },
      { status: 500 },
    );
  }

  // 6. Insert canonical id_map row
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  const { data, error: mapErr } = await supabase
    .from('iqube_id_map')
    .insert({
      source: 'triad_meta',
      source_id: metaQubeId,
      primitive_type: parent.primitive_type,
      synthetic: false,
      notes: `forked from ${parentId} (provenance ${newProvenance})`,
    })
    .select('iqube_id')
    .single();

  if (mapErr || !data) {
    return NextResponse.json(
      { error: 'id_map_insert_failed', detail: mapErr?.message },
      { status: 500 },
    );
  }

  const newIqubeId = (data as { iqube_id: string }).iqube_id;

  // 7. Copy parent's score block as operator overrides (best-effort).
  //    Re-fetch from iqube_scores rather than relying on the internal
  //    projection (which doesn't carry scores).
  try {
    const { data: parentScores } = await supabase
      .from('iqube_scores')
      .select('*')
      .eq('iqube_id', parentId)
      .maybeSingle();
    if (parentScores) {
      const s = parentScores as Record<string, unknown>;
      await supabase.from('iqube_scores').upsert(
        {
          iqube_id: newIqubeId,
          sensitivity: s.sensitivity ?? null,
          accuracy: s.accuracy ?? null,
          verifiability: s.verifiability ?? null,
          risk: s.risk ?? null,
          derived_reliability: s.derived_reliability ?? null,
          derived_trust: s.derived_trust ?? null,
          sensitivity_source: 'operator_override',
          accuracy_source: 'operator_override',
          verifiability_source: 'operator_override',
          risk_source: 'operator_override',
          derivation_strategy: 'fork_inherit_v1',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'iqube_id' },
      );
    }
  } catch {
    // Non-fatal — fork is real; operator can re-derive from Health tab.
  }

  // 8. Audit trail
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'iqube_forked',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'legacy_registry_fork',
    journey_stage: 'prospect',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: false,
    timestamp: new Date().toISOString(),
    metadata: {
      iqube_id: newIqubeId,
      parent_iqube_id: parentId,
      provenance: newProvenance,
      actor_cohort_id: persona.cohortMemberships?.[0] ?? null,
    },
  });

  return NextResponse.json({
    iqube_id: newIqubeId,
    meta_qube_id: metaQubeId,
    parent_iqube_id: parentId,
    primitive_type: parent.primitive_type,
    name: newName,
    slug,
    provenance: newProvenance,
    internal_lifecycle: 'draft',
    surface_lifecycle: 'draft',
    mint_status: 'unminted',
    created_at: new Date().toISOString(),
  });
}
