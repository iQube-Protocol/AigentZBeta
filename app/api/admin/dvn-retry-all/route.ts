/**
 * POST /api/admin/dvn-retry-all
 *
 * Admin-only bulk retry for all activity receipts stuck in `dvn_failed`.
 * Loads every dvn_failed row (up to `limit`, default 100), re-submits
 * each to the DVN canister sequentially, and flips successful rows to
 * `dvn_pending`. Returns a summary of successes, failures, and errors.
 *
 * Sequential (not parallel) to avoid hammering the canister with
 * concurrent update calls — each call is ~2-3s so 100 receipts takes
 * ~4-5 minutes worst case.
 *
 * Body (optional): { limit?: number, dryRun?: boolean }
 *   - limit: max receipts to process (1-500, default 100)
 *   - dryRun: if true, loads and counts but doesn't submit (for previewing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { submitActivityReceiptToDvn } from '@/services/dvn/activityReceiptDvnPipeline';
import type { ActivityReceiptRecord, ReceiptStatus } from '@/services/receipts/activityReceiptService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DbRow {
  id: string;
  persona_id: string;
  session_id: string | null;
  intent_id: string | null;
  active_cartridge: string;
  action_type: string;
  summary: string;
  agents_invoked: string[];
  tools_used: string[];
  iqubes_used: string[];
  context_shared: string[];
  artifacts_created: string[];
  approvals_granted: string[];
  policy_envelope_id: string | null;
  receipt_status: ReceiptStatus;
  dvn_receipt_id: string | null;
  specialist_response: string | null;
  action_connector_id: string | null;
  action_connector_label: string | null;
  action_input: string | null;
  created_at: string;
}

function rowToRecord(row: DbRow): ActivityReceiptRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    intentId: row.intent_id,
    activeCartridge: row.active_cartridge,
    actionType: row.action_type as ActivityReceiptRecord['actionType'],
    summary: row.summary,
    agentsInvoked: row.agents_invoked ?? [],
    toolsUsed: row.tools_used ?? [],
    iqubesUsed: row.iqubes_used ?? [],
    contextShared: row.context_shared ?? [],
    artifactsCreated: row.artifacts_created ?? [],
    approvalsGranted: row.approvals_granted ?? [],
    policyEnvelopeId: row.policy_envelope_id,
    receiptStatus: row.receipt_status,
    dvnReceiptId: row.dvn_receipt_id,
    specialistResponse: row.specialist_response,
    actionConnectorId: row.action_connector_id,
    actionConnectorLabel: row.action_connector_label,
    actionInput: row.action_input,
    createdAt: row.created_at,
  };
}

interface RetryResult {
  receiptId: string;
  personaId: string;
  actionType: string;
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!context.cartridgeFlags?.isAdmin) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'Admin-only endpoint.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let limit = 100;
  let dryRun = false;
  try {
    const body = await request.json();
    if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(500, Math.round(body.limit)));
    }
    if (body.dryRun === true) dryRun = true;
  } catch {
    // No body or invalid JSON — use defaults
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: 'supabase_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { data: rows, error: queryErr } = await supabase
    .from('activity_receipts')
    .select('*')
    .eq('receipt_status', 'dvn_failed')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (queryErr) {
    return NextResponse.json(
      { error: 'query_failed', detail: queryErr.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const failedReceipts = (rows ?? []) as DbRow[];

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      total: failedReceipts.length,
      receipts: failedReceipts.map((r) => ({
        id: r.id,
        actionType: r.action_type,
        personaId: r.persona_id,
        createdAt: r.created_at,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (failedReceipts.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      message: 'No dvn_failed receipts found.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const results: RetryResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const row of failedReceipts) {
    const record = rowToRecord(row);
    try {
      const result = await submitActivityReceiptToDvn(record, row.persona_id);

      if (result.ok && result.messageId) {
        await supabase
          .from('activity_receipts')
          .update({
            receipt_status: 'dvn_pending',
            dvn_receipt_id: result.messageId,
          })
          .eq('id', row.id);

        results.push({
          receiptId: row.id,
          personaId: row.persona_id,
          actionType: row.action_type,
          ok: true,
          messageId: result.messageId,
        });
        succeeded++;
      } else {
        results.push({
          receiptId: row.id,
          personaId: row.persona_id,
          actionType: row.action_type,
          ok: false,
          error: result.error ?? 'no messageId returned',
        });
        failed++;
      }
    } catch (err) {
      results.push({
        receiptId: row.id,
        personaId: row.persona_id,
        actionType: row.action_type,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  console.log(
    `[DVN bulk retry] Processed ${failedReceipts.length} receipts: ${succeeded} succeeded, ${failed} failed`,
  );

  return NextResponse.json({
    ok: failed === 0,
    total: failedReceipts.length,
    succeeded,
    failed,
    results,
  }, {
    status: failed === failedReceipts.length ? 502 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
