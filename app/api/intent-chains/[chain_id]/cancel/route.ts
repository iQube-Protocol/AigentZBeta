/**
 * POST /api/intent-chains/[chain_id]/cancel — operator-cancel a chain.
 *
 * Spec §11 #2 (locked): cancellation is total. status=`cancelled`
 * short-circuits cron advance for scheduled/wait steps; in-flight RPCs
 * are not interrupted (the next outcome they emit will land on a
 * cancelled chain and be ignored by the advancer's status guard).
 *
 * Auth: spine — owner only (v1). Admin cancel-on-behalf is a follow-up.
 *
 * Body (optional): { reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { buildChainReceiptMetadata } from '@/services/orchestration/sanitizeReceiptMetadata';
import type { IntentChainRow } from '@/types/intentChains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CancelBody {
  reason?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Promise<{ chain_id: string }> | { chain_id: string }> },
) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const params = await Promise.resolve((await context.params));
  const chain_id = params.chain_id;
  if (!chain_id) return NextResponse.json({ error: 'invalid_chain_id' }, { status: 400 });

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  let body: CancelBody = {};
  try {
    body = (await request.json()) as CancelBody;
  } catch {
    // optional body
  }

  const { data } = await sb.from('intent_chains').select('*').eq('chain_id', chain_id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = data as IntentChainRow;
  if (row.initiated_by_persona_id !== persona.personaId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled') {
    return NextResponse.json(
      { error: 'already_terminated', current_status: row.status },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await sb
    .from('intent_chains')
    .update({
      status: 'cancelled',
      current_step_id: null,
      current_step_kind: null,
      scheduled_advance_at: null,
      wait_timeout_at: null,
      terminated_at: now,
      termination_outcome: 'cancelled',
    })
    .eq('chain_id', chain_id);
  if (updateErr) {
    return NextResponse.json({ error: 'cancel_failed', detail: updateErr.message }, { status: 500 });
  }

  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_cancelled',
    from_role: 'aigent-c',
    to_role: 'aigent-z',
    reason: body.reason ? `user_cancel: ${body.reason.slice(0, 100)}` : 'user_cancel',
    journey_stage: 'prospect',
    active_cartridge: row.cartridge,
    active_codex: null,
    receipt_eligible: true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id,
      template_id: row.template_id,
      template_version: row.template_version,
      actor_alias_commitment: row.initiated_by_alias_commitment ?? undefined,
      extra: {
        cancelled_at_step_id: row.current_step_id ?? undefined,
        reason: body.reason ?? undefined,
      },
    }),
  });

  return NextResponse.json({ chain_id, status: 'cancelled', terminated_at: now });
}
