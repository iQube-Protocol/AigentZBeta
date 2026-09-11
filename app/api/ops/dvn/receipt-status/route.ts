import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/dvn/receipt-status?ids=<uuid,uuid,...>
 *
 * Read-only diagnostic for the DVN lifecycle of a specific, caller-supplied
 * set of activity_receipts rows (Horizen Pilot Closure, part B3, 2026-08-09).
 * Reads only the columns already public in the ActivityReceiptRecord shape
 * (services/receipts/activityReceiptService.ts) — no new query, no new
 * finalization or submission logic, no persona/content fields. Exists
 * because neither the journey /state endpoint nor the finalizer/reconciler
 * responses expose per-receipt DVN lifecycle state, which is required to
 * classify why a specific receipt is still pending (READY_AND_MINTED /
 * WAITING_FOR_ATTESTATIONS / MESSAGE_NOT_FOUND / TARGET_READ_FAILED /
 * OTHER_EXPLICIT_CAUSE) rather than guessing.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/dvn/*
 * infra routes — this is an ops diagnostic, not a persona-spine surface.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids query param required (comma-separated uuids)' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  // Column-by-column probe FIRST — Horizen Pilot Closure, part B3 (2026-08-09)
  // discovered live that `dvn_status` (added by
  // supabase/migrations/20260808010000_activity_receipt_dual_leg_anchoring.sql)
  // does not exist on the deployed table, even though the DVN submission path
  // writes it in the SAME UPDATE statement as receipt_status/dvn_receipt_id —
  // a missing column fails that whole UPDATE, silently, so this route must
  // never assume any dual-leg column is actually present. Report exactly
  // which ones are, rather than fail outright or guess.
  const candidateColumns = [
    'id',
    'action_type',
    'receipt_status',
    'dvn_receipt_id',
    'created_at',
    'commitment_hash',
    'dvn_status',
    'pos_status',
    'pos_receipt_id',
    'btc_anchor_txid',
    'btc_batch_root',
  ];
  const missingColumns: string[] = [];
  const presentColumns: string[] = [];
  for (const col of candidateColumns) {
    const probe = await admin.from('activity_receipts').select(col).limit(1);
    if (probe.error && /does not exist/i.test(probe.error.message)) {
      missingColumns.push(col);
    } else {
      presentColumns.push(col);
    }
  }

  const { data, error } = await admin
    .from('activity_receipts')
    .select(presentColumns.join(', '))
    .in('id', ids);

  if (error) {
    return NextResponse.json({ error: error.message, presentColumns, missingColumns }, { status: 500 });
  }

  const found = new Map((data ?? []).map((r: any) => [r.id, r]));
  const receipts = ids.map((id) => found.get(id) ?? { id, notFound: true });

  return NextResponse.json(
    { receipts, schema: { presentColumns, missingColumns } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
