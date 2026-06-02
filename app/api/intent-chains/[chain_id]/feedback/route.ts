/**
 * /api/intent-chains/[chain_id]/feedback — efficacy loop (spec §6.7).
 *
 *   GET  — read this caller's feedback for the chain (or null)
 *   PUT  — upsert feedback. Body: { rating: 'like'|'dislike', comment?: string }
 *
 * Auth: spine — only the chain's owner. PUT semantics: re-rating
 * overwrites the prior row + emits a fresh DVN receipt
 * (intent_chain_feedback_recorded).
 *
 * T0/T1/T2 discipline: comment text stays in DB (T1 — training corpus).
 * The DVN receipt carries `comment_present` bool only — comment text
 * never lands in cross-chain receipts. Enforced by sanitizeReceiptMetadata.
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

const MAX_COMMENT = 2000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chain_id: string }> | { chain_id: string } },
) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const params = await Promise.resolve(context.params);
  const chain_id = params.chain_id;
  if (!chain_id) return NextResponse.json({ error: 'invalid_chain_id' }, { status: 400 });

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  // Verify ownership
  const { data: chain } = await sb
    .from('intent_chains')
    .select('initiated_by_persona_id, template_id, template_version, cartridge')
    .eq('chain_id', chain_id)
    .maybeSingle();
  if (!chain) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if ((chain as Pick<IntentChainRow, 'initiated_by_persona_id'>).initiated_by_persona_id !== persona.personaId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data } = await sb
    .from('intent_chain_feedback')
    .select('feedback_id, rating, comment, rated_at, receipt_event_id')
    .eq('chain_id', chain_id)
    .eq('rated_by_persona_id', persona.personaId)
    .maybeSingle();

  return NextResponse.json({ feedback: (data as Record<string, unknown> | null) ?? null });
}

interface PutBody {
  rating: 'like' | 'dislike';
  comment?: string;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ chain_id: string }> | { chain_id: string } },
) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const params = await Promise.resolve(context.params);
  const chain_id = params.chain_id;
  if (!chain_id) return NextResponse.json({ error: 'invalid_chain_id' }, { status: 400 });

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.rating !== 'like' && body.rating !== 'dislike') {
    return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
  }
  const comment =
    typeof body.comment === 'string' && body.comment.trim().length > 0
      ? body.comment.slice(0, MAX_COMMENT)
      : null;

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  const { data: chain } = await sb
    .from('intent_chains')
    .select('initiated_by_persona_id, initiated_by_alias_commitment, template_id, template_version, cartridge, status')
    .eq('chain_id', chain_id)
    .maybeSingle();
  if (!chain) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = chain as Pick<IntentChainRow,
    'initiated_by_persona_id' | 'initiated_by_alias_commitment' | 'template_id' | 'template_version' | 'cartridge' | 'status'>;
  if (row.initiated_by_persona_id !== persona.personaId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const feedback_id = randomUUID();
  const receipt_event_id = randomUUID();
  const now = new Date().toISOString();

  const { data: upserted, error } = await sb
    .from('intent_chain_feedback')
    .upsert(
      {
        feedback_id,
        chain_id,
        rated_by_persona_id: persona.personaId,
        rated_by_alias_commitment: persona.cohortMemberships?.[0] ?? null,
        rating: body.rating,
        comment,
        rated_at: now,
        receipt_event_id,
      },
      { onConflict: 'chain_id,rated_by_persona_id' },
    )
    .select('feedback_id, rating, comment, rated_at, receipt_event_id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'persist_failed', detail: error.message }, { status: 500 });
  }

  // Receipt — sanitizer maps comment → comment_present bool, never text
  void emitOrchestrationEvent({
    event_id: receipt_event_id,
    event_type: 'intent_chain_feedback_recorded',
    from_role: 'aigent-c',
    to_role: 'aigent-z',
    reason: 'chain_feedback',
    journey_stage: 'prospect',
    active_cartridge: row.cartridge,
    active_codex: null,
    receipt_eligible: true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id,
      template_id: row.template_id,
      template_version: row.template_version,
      actor_alias_commitment: persona.cohortMemberships?.[0],
      extra: {
        rating: body.rating,
        comment, // sanitizer transforms → comment_present bool
        feedback_id,
        chain_terminal_status: row.status,
      },
    }),
  });

  return NextResponse.json({ feedback: upserted });
}
