/**
 * POST /api/registry/iqube/[id]/revoke — request canonical revocation.
 *
 * Phase B B6 of the legacy /registry → canonical SoT integration.
 *
 * The legacy /registry "Delete" button used to call
 *   DELETE /api/registry/templates/[id]
 * which removed the record outright. Per the integration plan §6,
 * revocation now flows through the canonization queue (Stage 3 C17)
 * as a `revoke` decision instead — preserves audit trail, requires
 * platform-admin approval, and never hard-deletes the canonical row.
 *
 * This route is a thin wrapper that submits a revocation request to
 * the canonization queue. The actual state transition (`canonized` →
 * `revoked`) happens via the PATCH /api/registry/canonization/[id]
 * approval flow gated to platform-admins (Stage 3 contract).
 *
 * Auth: any persona may REQUEST revocation (operator or creator);
 * approval is platform-admin only.
 *
 * Body (optional):
 *   { reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

interface RevokeBody {
  reason?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Promise<{ id: string }> | { id: string }> },
) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const params = await Promise.resolve((await context.params));
  const iqubeId = params.id;
  if (!iqubeId || typeof iqubeId !== 'string' || iqubeId.length < 4) {
    return NextResponse.json({ error: 'invalid_iqube_id' }, { status: 400 });
  }

  let body: RevokeBody = {};
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    // Empty body is fine — reason is optional
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  // Confirm canonical existence
  const { data: mapped } = await supabase
    .from('iqube_id_map')
    .select('iqube_id, primitive_type')
    .eq('iqube_id', iqubeId)
    .maybeSingle();
  if (!mapped) {
    return NextResponse.json({ error: 'iqube_not_found' }, { status: 404 });
  }

  // Single in-flight revocation per iqube
  const { data: existing } = await supabase
    .from('iqube_canonization_requests')
    .select('request_id, decision_notes')
    .eq('iqube_id', iqubeId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error: 'pending_request_exists',
        request_id: (existing as { request_id: string }).request_id,
        detail: 'an in-flight canonization/revocation request already exists for this iqube',
      },
      { status: 409 },
    );
  }

  // Mark the request as a revocation by prefixing decision_notes with a
  // structured tag the canonization queue PATCH path recognises. This
  // sidesteps a schema migration; Phase C will add a dedicated
  // `action` column to iqube_canonization_requests if revocation
  // volume warrants.
  const noteTag = '[REVOKE]';
  const decisionNotes = body.reason
    ? `${noteTag} ${body.reason}`
    : `${noteTag} legacy /registry delete-button submission`;

  const { data, error } = await supabase
    .from('iqube_canonization_requests')
    .insert({
      iqube_id: iqubeId,
      requester_persona_id: persona.personaId,
      status: 'pending',
      decision_notes: decisionNotes,
    })
    .select('request_id, iqube_id, status, requested_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'insert_failed', detail: error?.message },
      { status: 500 },
    );
  }

  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'iqube_revoke_requested',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'legacy_registry_delete_button',
    journey_stage: 'prospect',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: false,
    timestamp: new Date().toISOString(),
    metadata: {
      iqube_id: iqubeId,
      request_id: (data as { request_id: string }).request_id,
      actor_cohort_id: persona.cohortMemberships?.[0] ?? null,
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json(
    {
      request_id: (data as { request_id: string }).request_id,
      iqube_id: iqubeId,
      status: 'pending',
      action: 'revoke',
      message: 'Revocation requested. Awaiting platform-admin approval.',
    },
    { status: 201 },
  );
}
