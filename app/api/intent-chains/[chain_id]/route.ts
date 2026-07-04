/**
 * GET /api/intent-chains/[chain_id] — chain detail + step history.
 *
 * Returns the chain row (T1-safe projection — initiated_by_persona_id
 * stripped) plus the reconstructed step event history queried from
 * orchestration_events.metadata.chain_id.
 *
 * Auth: spine. The chain owner sees their own; admins see any chain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { IntentChainRow } from '@/types/intentChains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<Promise<{ chain_id: string }> | { chain_id: string }> },
) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const params = await Promise.resolve((await context.params));
  const chain_id = params.chain_id;
  if (!chain_id || chain_id.length < 4) {
    return NextResponse.json({ error: 'invalid_chain_id' }, { status: 400 });
  }

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  const { data, error } = await sb
    .from('intent_chains')
    .select('*')
    .eq('chain_id', chain_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = data as IntentChainRow;
  const isOwner = row.initiated_by_persona_id === persona.personaId;
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  if (!isOwner && !isAdmin) {
    // Don't leak existence — 404 not 403
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // T1-safe projection — strip the T0 persona id
  const { initiated_by_persona_id: _strippedPersonaId, ...view } = row;
  void _strippedPersonaId;

  // Reconstructed step history from orchestration_events
  let history: Array<Record<string, unknown>> = [];
  try {
    const { data: events } = await sb
      .from('orchestration_events')
      .select('event_id, event_type, created_at, metadata, receipt_eligible')
      .filter('metadata->>chain_id', 'eq', chain_id)
      .order('created_at', { ascending: true })
      .limit(500);
    history = (events ?? []) as Array<Record<string, unknown>>;
  } catch (err) {
    console.warn('[chain detail] history query failed:', (err as Error).message);
  }

  // Feedback (1 row per persona per chain)
  let feedback: Record<string, unknown> | null = null;
  try {
    const { data: fb } = await sb
      .from('intent_chain_feedback')
      .select('feedback_id, rating, comment, rated_at, receipt_event_id')
      .eq('chain_id', chain_id)
      .eq('rated_by_persona_id', persona.personaId)
      .maybeSingle();
    feedback = (fb as Record<string, unknown> | null) ?? null;
  } catch {
    // best-effort
  }

  return NextResponse.json({ chain: view, history, feedback });
}
