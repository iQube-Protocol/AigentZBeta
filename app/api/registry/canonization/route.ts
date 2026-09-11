/**
 * /api/registry/canonization
 *
 * Stage 3 C17. PRD v1.1 §A.7 canonization approval queue.
 *
 *   GET    /api/registry/canonization?status=pending       — list requests
 *   POST   /api/registry/canonization                      — submit request
 *                                                            (creator or partner)
 *   PATCH  /api/registry/canonization/[id] (sibling route) — approve / reject
 *                                                            (operator/admin)
 *
 * Approval triggers the published → canonized lifecycle transition per
 * services/registry/lifecycle.ts. The transition's per-rule requirements
 * (sync canonize receipt + chain_interaction true) are enforced; chain
 * action is deferred to Stage 5 mint saga — this handler emits the
 * receipt + state update only.
 *
 * Authority rule (PRD v1.0 §3): handler delegates to lifecycle.ts for
 * the decision; never reimplements transition validity. DVN receipt is
 * emitted via orchestrationEvents.emitDecisionReceipt (Stage 6 — for now
 * we mark the placeholder write and Stage 6 plumbing wires it).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { decideTransition } from '@/services/registry/lifecycle';
import type { IQubeInternalLifecycleState } from '@/types/registry-canonical';

const VALID_STATUS = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
type RequestStatus = (typeof VALID_STATUS)[number];

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') ?? 'pending') as RequestStatus;
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json(
      { error: 'invalid_status', allowed: VALID_STATUS },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('iqube_canonization_requests')
    .select('request_id, iqube_id, requested_at, status, decided_at, decision_notes, payment_authority_proposed, receipt_id')
    .eq('status', status)
    .order('requested_at', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }

  // Note: requester_persona_id and decided_by_persona_id are T0 fields
  // and intentionally OMITTED from the select list above. The list view
  // doesn't need them; the queue surface filters by iqube_id instead.
  return NextResponse.json({ requests: data ?? [], total: (data ?? []).length });
}

// ── POST — submit a canonization request ──────────────────────────────────

interface SubmitRequestBody {
  iqube_id: string;
  notes?: string;
  payment_authority_proposed?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Creator or partner can submit; admin auto-approval handled by PATCH path
  const canSubmit =
    persona.cartridgeFlags?.isAdmin ||
    persona.cartridgeFlags?.isPartner ||
    Boolean(persona.personaId);
  if (!canSubmit) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: SubmitRequestBody;
  try {
    body = (await request.json()) as SubmitRequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body?.iqube_id || typeof body.iqube_id !== 'string') {
    return NextResponse.json({ error: 'iqube_id is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  // Confirm the iQube exists in the canonical map.
  const { data: mapped } = await supabase
    .from('iqube_id_map')
    .select('iqube_id, primitive_type')
    .eq('iqube_id', body.iqube_id)
    .maybeSingle();

  if (!mapped) {
    return NextResponse.json({ error: 'iqube_not_found' }, { status: 404 });
  }

  // Single in-flight request per iqube: reject if there's already a pending row.
  const { data: existing } = await supabase
    .from('iqube_canonization_requests')
    .select('request_id')
    .eq('iqube_id', body.iqube_id)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'pending_request_exists', request_id: (existing as { request_id: string }).request_id },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('iqube_canonization_requests')
    .insert({
      iqube_id: body.iqube_id,
      requester_persona_id: persona.personaId,
      status: 'pending',
      decision_notes: body.notes ?? null,
      payment_authority_proposed: body.payment_authority_proposed ?? null,
    })
    .select('request_id, iqube_id, status, requested_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'insert_failed', detail: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
