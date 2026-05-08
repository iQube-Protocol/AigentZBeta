/**
 * Admin Investor Capital Events API.
 *
 * POST /api/admin/investor-events
 *   body: { personaId, eventType, amountUsd?, amountShares?, amountKnyt?, vehicle?, occurredAt, notes? }
 *   → inserts a row in investor_capital_events. Returns the inserted row.
 *
 * Plan: codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md § 4.5
 *
 * Auth: requireAdmin (header-based stub — IAM will replace).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireAdmin } from '@/app/api/_lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_EVENT_TYPES = new Set([
  'investment',
  'share_grant',
  'token_grant',
  'vesting_milestone',
  'distribution',
]);

interface PostBody {
  personaId?: string;
  eventType?: string;
  amountUsd?: number;
  amountShares?: number;
  amountKnyt?: number;
  vehicle?: string;
  occurredAt?: string;
  notes?: string;
  createdBy?: string;
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const { personaId, eventType, amountUsd, amountShares, amountKnyt, vehicle, occurredAt, notes, createdBy } = body;

  if (!personaId || !eventType || !occurredAt) {
    return NextResponse.json({ error: 'personaId, eventType, and occurredAt are required' }, { status: 400 });
  }
  if (!VALID_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: `Invalid eventType. Must be one of: ${Array.from(VALID_EVENT_TYPES).join(', ')}` }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('investor_capital_events')
    .insert({
      persona_id: personaId,
      event_type: eventType,
      amount_usd: amountUsd ?? null,
      amount_shares: amountShares ?? null,
      amount_knyt: amountKnyt ?? null,
      vehicle: vehicle ?? null,
      occurred_at: occurredAt,
      notes: notes ?? null,
      created_by: createdBy ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
