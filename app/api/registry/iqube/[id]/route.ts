/**
 * GET /api/registry/iqube/[id] — resolve a canonical iQube.
 *
 * Delegates to services/registry/resolver.ts. Caller controls the
 * projection shape via the ?projection= query param (default
 * 'cartridge'). 'admin' requires cartridgeFlags.isAdmin. 'public'
 * returns 404 for non-public records (does not leak existence per
 * PRD §8.2 default).
 *
 * Distinct from /api/iqubes/[id]/card (legibility surface) — that
 * endpoint serves the agent-facing IQubeCard; this endpoint serves
 * the in-app cartridge / Studio / runtime projection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveIQube, type ResolverProjection } from '@/services/registry/resolver';
import { getMetaQube, updateMetaQube } from '@/server/services/iqRegistryService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import type { CanonicalIQubeInternalRecord } from '@/types/registry-canonical';

function isValidProjection(value: string | null): value is ResolverProjection {
  return value === 'admin' || value === 'cartridge' || value === 'public' || value === 'internal';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Promise<{ id: string }> | { id: string }> },
) {
  const params = await Promise.resolve((await context.params));
  const iqubeId = params.id;

  if (!iqubeId || typeof iqubeId !== 'string' || iqubeId.length < 4) {
    return NextResponse.json({ error: 'invalid_iqube_id' }, { status: 400 });
  }

  const url = new URL(request.url);
  const projectionParam = url.searchParams.get('projection');
  const projection: ResolverProjection = isValidProjection(projectionParam)
    ? projectionParam
    : 'cartridge';

  // Auth — required for admin / internal, optional for cartridge / public
  const persona = await getActivePersona(request);

  if (projection === 'admin' || projection === 'internal') {
    if (!persona) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (!persona.cartridgeFlags?.isAdmin) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const allowPrivate = projection === 'admin' || projection === 'internal';

  const result = await resolveIQube(iqubeId, {
    persona: persona ?? undefined,
    projection,
    allowPrivate,
  });

  if (!result) {
    // 404 (not 403) — never leak existence per PRD §8.2 convention
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(result);
}

// ── PATCH ────────────────────────────────────────────────────────────────

interface PatchScoreAxes {
  sensitivity?: number;
  accuracy?: number;
  verifiability?: number;
  risk?: number;
}

interface PatchRequest {
  name?: string;
  description?: string;
  tags?: string[];
  preview_url?: string;
  business_model?: string;
  price?: number;
  score_axes?: PatchScoreAxes;
  blakqube_labels?: unknown;
  meta_extras?: Array<{ k: string; v: string }>;
  identity_state?: string;
  min_reputation_bucket?: number;
  require_human_proof?: boolean;
  require_agent_declare?: boolean;
}

function clampAxis(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

/**
 * PATCH /api/registry/iqube/[id] — edit canonical iQube fields.
 *
 * Phase B B3. Updates the same field set B1 accepts on POST (business
 * model, scores, blakqube labels, identity hints, etc.) on an existing
 * record. Lifecycle transitions are explicitly NOT in scope here — they
 * go through the canonization queue (Stage 3) and the mint saga
 * (Stage 5), neither of which PATCH triggers.
 *
 * Score axes provided on PATCH upsert into iqube_scores with
 * derivation_strategy='operator_override_v1' and per-axis
 * *_source='operator_override' — preserving the score backfill's
 * operator-override-is-sacred contract.
 *
 * Auth: spine-gated, admin OR partner. Emits an orchestration_events
 * row with event_type='iqube_edited' for the audit trail.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Promise<{ id: string }> | { id: string }> },
) {
  // 1. Auth
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin && !persona.cartridgeFlags?.isPartner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 2. Resolve target
  const params = await Promise.resolve((await context.params));
  const iqubeId = params.id;
  if (!iqubeId || typeof iqubeId !== 'string' || iqubeId.length < 4) {
    return NextResponse.json({ error: 'invalid_iqube_id' }, { status: 400 });
  }

  const target = (await resolveIQube(iqubeId, {
    persona,
    projection: 'internal',
    allowPrivate: true,
  })) as CanonicalIQubeInternalRecord | null;

  if (!target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!target.meta_qube_id) {
    return NextResponse.json(
      { error: 'no_meta_qube', detail: 'cannot patch a record without a trinity meta row' },
      { status: 422 },
    );
  }

  // 3. Body
  let body: PatchRequest;
  try {
    body = (await request.json()) as PatchRequest;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // 4. Merge legacy extras onto existing metadata
  const meta = await getMetaQube(target.meta_qube_id);
  const existingMetadata = (meta?.metadata ?? {}) as Record<string, unknown>;
  const existingExtras = (existingMetadata.legacyTemplateExtras as Record<string, unknown> | undefined) ?? {};

  const extras = { ...existingExtras };
  if (body.business_model !== undefined) extras.businessModel = body.business_model;
  if (body.price !== undefined) extras.price = body.price;
  if (body.blakqube_labels !== undefined) extras.blakqubeLabels = body.blakqube_labels;
  if (body.meta_extras !== undefined) extras.metaExtras = body.meta_extras;
  if (body.identity_state !== undefined) extras.identityState = body.identity_state;
  if (body.min_reputation_bucket !== undefined) extras.minReputationBucket = body.min_reputation_bucket;
  if (body.require_human_proof !== undefined) extras.requireHumanProof = body.require_human_proof;
  if (body.require_agent_declare !== undefined) extras.requireAgentDeclare = body.require_agent_declare;

  const metadataUpdate: Record<string, unknown> = {
    ...existingMetadata,
    legacyTemplateExtras: extras,
  };

  const updates: Record<string, unknown> = { metadata: metadataUpdate };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.preview_url !== undefined) updates.previewUrl = body.preview_url;

  try {
    await updateMetaQube(target.meta_qube_id, updates as Parameters<typeof updateMetaQube>[1]);
  } catch (err) {
    return NextResponse.json(
      { error: 'patch_failed', detail: (err as Error).message },
      { status: 500 },
    );
  }

  // 5. Score axes — upsert as operator override
  const fieldsTouched: string[] = Object.keys(body).filter((k) => k !== 'score_axes');
  let scoresOverridden: string[] = [];
  if (body.score_axes && typeof body.score_axes === 'object') {
    const supabase = getSupabaseServer();
    if (supabase) {
      const axes = body.score_axes;
      const sensitivity = axes.sensitivity !== undefined ? clampAxis(axes.sensitivity) : null;
      const accuracy = axes.accuracy !== undefined ? clampAxis(axes.accuracy) : null;
      const verifiability = axes.verifiability !== undefined ? clampAxis(axes.verifiability) : null;
      const risk = axes.risk !== undefined ? clampAxis(axes.risk) : null;

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
        scoresOverridden.push('sensitivity');
      }
      if (accuracy !== null) {
        row.accuracy = accuracy;
        row.accuracy_source = 'operator_override';
        scoresOverridden.push('accuracy');
      }
      if (verifiability !== null) {
        row.verifiability = verifiability;
        row.verifiability_source = 'operator_override';
        scoresOverridden.push('verifiability');
      }
      if (risk !== null) {
        row.risk = risk;
        row.risk_source = 'operator_override';
        scoresOverridden.push('risk');
      }
      if (reliability !== null) row.derived_reliability = reliability;
      if (trust !== null) row.derived_trust = trust;

      try {
        await supabase.from('iqube_scores').upsert(row, { onConflict: 'iqube_id' });
      } catch {
        // Non-fatal — PATCH succeeded; operator can re-derive.
      }
    }
  }

  // 6. Audit trail
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'iqube_edited',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'legacy_registry_edit',
    journey_stage: 'prospect',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: false,
    timestamp: new Date().toISOString(),
    metadata: {
      iqube_id: iqubeId,
      fields_touched: fieldsTouched,
      scores_overridden: scoresOverridden,
      actor_cohort_id: persona.cohortMemberships?.[0] ?? null,
    },
  });

  return NextResponse.json({
    iqube_id: iqubeId,
    fields_touched: fieldsTouched,
    scores_overridden: scoresOverridden,
    updated_at: new Date().toISOString(),
  });
}
