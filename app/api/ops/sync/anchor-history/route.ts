/**
 * GET /api/ops/sync/anchor-history — recent anchor cycle history.
 *
 * Admin-gated. Returns the last N anchor_history rows (default 50, max
 * 500) ordered by created_at desc. Powers the calibration panel's mini
 * activity feed + the drift-trend visualisation.
 *
 *   ?limit=50           cap
 *   ?action=anchored    filter by cycle_action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACTIONS = new Set(['anchored', 'deferred', 'skipped', 'failed']);

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '50', 10), 1), 500);
  const action = url.searchParams.get('action') ?? '';

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ entries: [], total: 0 });

  let q = sb
    .from('anchor_history')
    .select('id, batch_id, anchor_txid, receipt_count, cycle_action, decision_reason, drift_before, drift_after, duration_ms, error, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (action && VALID_ACTIONS.has(action)) {
    q = q.eq('cycle_action', action);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [], total: (data ?? []).length });
}
