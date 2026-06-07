/**
 * POST /api/intent-chains/[chain_id]/complete-step — user-driven advance
 * for compose / approve steps.
 *
 * Called from the AigentMeWelcomeSplitTab seam (commit 7) when:
 *   - the user has just successfully created a brief artifact (compose
 *     step) → body carries { artifact_id, title }
 *   - the user has confirmed an approve step → body carries
 *     { decision: 'confirm', ...optional payload }
 *   - the user has rejected an approve step → body carries
 *     { decision: 'reject', ...optional payload }
 *
 * The advancer correlates the body's outcome metadata to the chain's
 * current step (must be compose or approve kind), merges into chain
 * context, evaluates branches (e.g. reject → on_reject_next), and
 * transitions to the next step.
 *
 * Auth: spine — owner only.
 *
 * NOTE: this endpoint is NOT the same as the internal advance hook for
 * RPC outcomes. RPC outcomes flow through orchestration_events ←→
 * advanceChainIfNeeded automatically. This route is for the cases
 * where the user IS the actor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { completeUserStep } from '@/services/intentChains/advancer';
import type { IntentChainRow } from '@/types/intentChains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CompleteStepBody {
  artifact_id?: string;
  title?: string;
  decision?: 'confirm' | 'reject';
  [k: string]: unknown;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ chain_id: string }> | { chain_id: string } },
) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const params = await Promise.resolve(context.params);
  const chain_id = params.chain_id;
  if (!chain_id) return NextResponse.json({ error: 'invalid_chain_id' }, { status: 400 });

  let body: CompleteStepBody;
  try {
    body = (await request.json()) as CompleteStepBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  // Ownership + status precheck before calling the advancer (advancer is
  // best-effort and won't surface a useful error to the caller).
  const { data } = await sb
    .from('intent_chains')
    .select('initiated_by_persona_id, status, current_step_id, current_step_kind')
    .eq('chain_id', chain_id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const row = data as Pick<IntentChainRow, 'initiated_by_persona_id' | 'status' | 'current_step_id' | 'current_step_kind'>;
  if (row.initiated_by_persona_id !== persona.personaId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (row.status !== 'active' && row.status !== 'waiting') {
    return NextResponse.json(
      { error: 'chain_not_active', current_status: row.status },
      { status: 409 },
    );
  }
  if (row.current_step_kind !== 'compose' && row.current_step_kind !== 'approve') {
    return NextResponse.json(
      { error: 'step_not_user_facing', current_step_kind: row.current_step_kind },
      { status: 409 },
    );
  }

  await completeUserStep(chain_id, body as Record<string, unknown>);

  // Re-read to surface the new state to the caller (the advancer has
  // already updated current_step_*).
  const { data: updated } = await sb
    .from('intent_chains')
    .select('chain_id, status, current_step_id, current_step_kind, terminated_at, termination_outcome')
    .eq('chain_id', chain_id)
    .maybeSingle();

  return NextResponse.json({ chain: updated });
}
