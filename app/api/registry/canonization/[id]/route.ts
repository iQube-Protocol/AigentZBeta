/**
 * PATCH /api/registry/canonization/[id]
 *
 * Stage 3 C17. Approve or reject a canonization request.
 *
 *   PATCH /api/registry/canonization/<request_id>
 *     body: { decision: 'approve' | 'reject', notes?: string }
 *
 * On approve:
 *   - Mark request approved + record operator persona + timestamp
 *   - (Stage 5 saga executes the chain side; this handler updates the
 *     lifecycle column on the underlying source row to trigger the
 *     transition. For ContentQubes, that means content_qubes.lifecycle_state
 *     advances to 'canonized'.)
 *   - DVN receipt emission stub (Stage 6 wires real orchestration_events
 *     emission; this handler stamps receipt_id placeholder).
 *
 * On reject:
 *   - Mark request rejected + record reason
 *   - No lifecycle transition; underlying source row stays at published
 *     (or wherever it was when the request was filed). Stage 4 / Stage 7
 *     handle resubmission flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { decideTransition } from '@/services/registry/lifecycle';

interface PatchBody {
  decision: 'approve' | 'reject';
  notes?: string;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const requestId = params.id;
  if (!requestId) {
    return NextResponse.json({ error: 'request_id required' }, { status: 400 });
  }

  // Auth + admin gate
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body?.decision !== 'approve' && body?.decision !== 'reject') {
    return NextResponse.json(
      { error: "decision must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  // Load the request + its iqube_id + primitive_type
  const { data: req } = await supabase
    .from('iqube_canonization_requests')
    .select('request_id, iqube_id, status, payment_authority_proposed')
    .eq('request_id', requestId)
    .maybeSingle();
  if (!req) {
    return NextResponse.json({ error: 'request_not_found' }, { status: 404 });
  }
  const r = req as {
    request_id: string;
    iqube_id: string;
    status: string;
    payment_authority_proposed: Record<string, unknown> | null;
  };
  if (r.status !== 'pending') {
    return NextResponse.json(
      { error: 'request_already_decided', current_status: r.status },
      { status: 409 },
    );
  }

  const decisionTimestamp = new Date().toISOString();

  if (body.decision === 'reject') {
    const { error } = await supabase
      .from('iqube_canonization_requests')
      .update({
        status: 'rejected',
        decided_by_persona_id: persona.personaId,
        decided_at: decisionTimestamp,
        decision_notes: body.notes ?? null,
      })
      .eq('request_id', requestId);
    if (error) {
      return NextResponse.json(
        { error: 'update_failed', detail: error.message },
        { status: 500 },
      );
    }
    // Stage 6: emit orchestrationEvents.emitDecisionReceipt({
    //   action: 'policy-escalation', mode: 'sync', iqube_id, ... })
    return NextResponse.json({
      request_id: requestId,
      iqube_id: r.iqube_id,
      decision: 'rejected',
      decided_at: decisionTimestamp,
    });
  }

  // APPROVE path
  // Validate the lifecycle transition for the iQube. The current internal
  // state is needed; ContentQube source rows carry lifecycle_state which
  // we map. Non-ContentQube primitives: lifecycle column on registry_assets
  // or other source — Stage 4 wires those readers.
  const { data: mapEntry } = await supabase
    .from('iqube_id_map')
    .select('iqube_id, source, source_id, primitive_type')
    .eq('iqube_id', r.iqube_id)
    .maybeSingle();
  if (!mapEntry) {
    return NextResponse.json({ error: 'iqube_id_map_missing' }, { status: 500 });
  }

  // For ContentQubes, read content_qubes.lifecycle_state, map → universal,
  // then validate published → canonized. For other primitives the transition
  // validation is permissive at this stage; Stage 4/7 tighten.
  const m = mapEntry as { iqube_id: string; source: string; source_id: string; primitive_type: string };

  if (m.source === 'content_qube') {
    const { mapContentQubeInternalToUniversal } = await import('@/services/registry/lifecycle');
    const { data: cq } = await supabase
      .from('content_qubes')
      .select('lifecycle_state')
      .eq('id', m.source_id)
      .maybeSingle();
    if (cq) {
      const current = mapContentQubeInternalToUniversal((cq as { lifecycle_state: string }).lifecycle_state);
      const decision = decideTransition(current, 'canonized');
      if (!decision.allowed) {
        return NextResponse.json(
          {
            error: 'transition_invalid',
            from: current,
            to: 'canonized',
            reason: decision.reason,
          },
          { status: 409 },
        );
      }

      // Apply the transition on the source row. content_qubes uses its
      // own enum; canonized in universal maps to 'canonized' on the CQ
      // column. Stage 5 saga handles chain_minted promotion.
      await supabase
        .from('content_qubes')
        .update({
          lifecycle_state: 'canonized',
          internal_lifecycle: 'canonized',
          surface_lifecycle: decision.surface_after,
          updated_at: decisionTimestamp,
        })
        .eq('id', m.source_id);
    }
  }

  // Mark request approved
  const { error: approveErr } = await supabase
    .from('iqube_canonization_requests')
    .update({
      status: 'approved',
      decided_by_persona_id: persona.personaId,
      decided_at: decisionTimestamp,
      decision_notes: body.notes ?? null,
    })
    .eq('request_id', requestId);
  if (approveErr) {
    return NextResponse.json(
      { error: 'update_failed', detail: approveErr.message },
      { status: 500 },
    );
  }

  // Stage 6: emit orchestrationEvents.emitDecisionReceipt({
  //   action: 'canonize', mode: 'sync', iqube_id, actor_alias_commitment, ... })
  // Stage 5 mint saga subscribes to this receipt and triggers the chain action.

  // Stage 6: emit a canonization DVN receipt before kicking off the saga.
  // The receipt is the auditable "operator approved" record; the saga is
  // the follow-on chain action. Best-effort — receipt failure doesn't
  // block the approval response.
  try {
    const { emitOrchestrationEvent } = await import('@/services/orchestration/orchestrationEvents');
    await emitOrchestrationEvent({
      event_id: `canonize:${requestId}`,
      event_type: 'iqube_canonized',
      from_role: 'aigent_z',
      to_role: 'aigent_z',
      reason: 'canonization_approved',
      journey_stage: 'canonize',
      active_cartridge: null,
      active_codex: null,
      receipt_eligible: true,
      timestamp: decisionTimestamp,
      metadata: {
        iqube_id: r.iqube_id,
        request_id: requestId,
        receipt_mode: 'sync',
      },
    } as any);
  } catch (err) {
    console.warn('[canonization] receipt emission failed:', (err as Error).message);
  }

  // Stage 5 C21: kick off the mint saga in the background. Fire-and-
  // forget — the saga is idempotent so the canonization response doesn't
  // block on chain action.
  let sagaId: string | undefined;
  try {
    const { startSaga } = await import('@/services/registry/mintSaga');
    const snap = await startSaga({
      iqube_id: r.iqube_id,
      initiated_by_persona_id: persona.personaId,
    });
    sagaId = snap.saga_id;
    // Drive in the background; don't await
    void import('@/services/registry/mintSaga').then(({ driveSagaToCompletion }) =>
      driveSagaToCompletion(snap.saga_id).catch((err) => {
        console.error('[canonization] saga drive failed for', snap.saga_id, err);
      }),
    );
  } catch (err) {
    // Saga kickoff failure is non-fatal — operator can re-trigger via
    // POST /api/registry/iqube/[id]/mint
    console.warn('[canonization] saga kickoff failed:', (err as Error).message);
  }

  return NextResponse.json({
    request_id: requestId,
    iqube_id: r.iqube_id,
    decision: 'approved',
    decided_at: decisionTimestamp,
    chain_interaction_pending: true,
    payment_authority_approved: r.payment_authority_proposed ? true : false,
    saga_id: sagaId,
  });
}
