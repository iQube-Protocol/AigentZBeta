import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { bestReceiptStatus } from '@/services/journey/consequenceForkProjection';
import type { ReceiptStatus } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';
// See app/api/ops/journey/agent-forensics/route.ts's own comment —
// mitigates the default serverless timeout against a slow
// agents_invoked containment query.
export const maxDuration = 60;

/**
 * GET /api/ops/dvn/agent-receipts?agentRuntimeId=aigent-nakamoto&actionTypes=standing_accrued,pnl_service_registered,pnl_service_verified
 *
 * Read-only diagnostic — "establish live truth first" (Final Horizen
 * Projection Reconciliation, operator directive, 2026-08-09, part 1).
 *
 * Queries `activity_receipts` directly by (`agents_invoked` contains
 * agentRuntimeId) AND (`action_type` IN actionTypes), same predicate shape
 * as `findAgentReceiptRefs` (services/receipts/activityReceiptService.ts),
 * but WITHOUT that function's single global row limit — every matching row
 * for the requested action types is returned, so this route can itself be
 * used to verify whether the 100-row scan omitted anything (part 5).
 *
 * Returns every match with id/created_at/receipt_status/dvn_receipt_id/
 * dvn_status/action_input, grouped by action_type, plus the STRONGEST
 * achieved receipt_status per type (never merely the newest) — the same
 * ranking `bestReceiptStatus` already uses for the consequence fork, reused
 * here rather than reimplemented.
 *
 * Column-probes first, same discipline as /api/ops/dvn/receipt-status —
 * `dvn_status` is known to be absent on some deployments (Horizen Pilot
 * Closure part B3, 2026-08-09) and this diagnostic must report that rather
 * than fail outright or silently omit it.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/dvn/*
 * infra routes.
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

  const agentRuntimeId = request.nextUrl.searchParams.get('agentRuntimeId') || 'aigent-nakamoto';
  const actionTypesParam = request.nextUrl.searchParams.get('actionTypes');
  const actionTypes = (actionTypesParam
    ? actionTypesParam.split(',')
    : ['standing_accrued', 'pnl_service_registered', 'pnl_service_verified']
  )
    .map((s) => s.trim())
    .filter(Boolean);

  if (actionTypes.length === 0) {
    return NextResponse.json({ error: 'actionTypes resolved to an empty list' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  const candidateColumns = ['id', 'action_type', 'created_at', 'receipt_status', 'dvn_receipt_id', 'dvn_status', 'action_input', 'agents_invoked'];
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
    .in('action_type', actionTypes)
    .contains('agents_invoked', [agentRuntimeId])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, presentColumns, missingColumns }, { status: 500 });
  }

  const rows = (data ?? []) as any[];
  const byType: Record<string, any[]> = {};
  for (const row of rows) {
    (byType[row.action_type] ??= []).push(row);
  }

  const summary: Record<string, { count: number; strongestReceiptStatus: ReceiptStatus | null; strongestReceiptId: string | null }> = {};
  for (const actionType of actionTypes) {
    const typeRows = byType[actionType] ?? [];
    const strongest = bestReceiptStatus(typeRows.map((r) => (r.receipt_status ?? 'local') as ReceiptStatus));
    const strongestRow = strongest ? typeRows.find((r) => (r.receipt_status ?? 'local') === strongest) ?? null : null;
    summary[actionType] = {
      count: typeRows.length,
      strongestReceiptStatus: strongest,
      strongestReceiptId: strongestRow?.id ?? null,
    };
  }

  return NextResponse.json(
    {
      agentRuntimeId,
      actionTypes,
      schema: { presentColumns, missingColumns },
      summary,
      receiptsByType: byType,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
