/**
 * POST /api/assistant/receipts/[receiptId]/retry-dvn
 *
 * Operator-driven DVN retry for a single activity receipt that landed in
 * `dvn_failed`. Looks up the receipt scoped to the caller persona,
 * re-runs submitActivityReceiptToDvn synchronously, and flips the row to
 * dvn_pending on success (the existing finalizer will roll it forward to
 * dvn_recorded). Leaves the row as dvn_failed when the canister call
 * still errors so the operator can see the latest failure reason.
 *
 * Auth: spine — caller must own the receipt. No admin gate; the receipt
 * already belongs to the persona by construction.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { submitActivityReceiptToDvn } from '@/services/dvn/activityReceiptDvnPipeline';
import type { ActivityReceiptRecord, ReceiptStatus } from '@/services/receipts/activityReceiptService';

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
    specialistResponse: null,
    actionConnectorId: null,
    actionConnectorLabel: null,
    actionInput: null,
    createdAt: row.created_at,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { receiptId } = await params;
  if (!receiptId) {
    return NextResponse.json(
      { error: 'receiptId required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Scope lookup to the caller's personaId — operators can only retry
  // receipts they own. RLS would also enforce this but the persona_id
  // filter makes the contract explicit.
  const { data, error } = await supabase
    .from('activity_receipts')
    .select('*')
    .eq('id', receiptId)
    .eq('persona_id', context.personaId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'not_found', detail: 'Receipt not found or not owned by caller.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const record = rowToRecord(data as DbRow);
  if (record.receiptStatus !== 'dvn_failed') {
    return NextResponse.json(
      {
        error: 'invalid_state',
        detail: `Only dvn_failed receipts can be retried (current: ${record.receiptStatus}).`,
        currentStatus: record.receiptStatus,
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await submitActivityReceiptToDvn(record, context.personaId);

  if (result.ok && result.messageId) {
    const { error: updateErr } = await supabase
      .from('activity_receipts')
      .update({
        receipt_status: 'dvn_pending',
        dvn_receipt_id: result.messageId,
      })
      .eq('id', receiptId);
    if (updateErr) {
      return NextResponse.json(
        { error: 'update_failed', detail: updateErr.message },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { ok: true, receiptStatus: 'dvn_pending', dvnReceiptId: result.messageId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Submission still failed — leave row as dvn_failed, surface the
  // error to the operator so they can decide whether to retry again.
  console.warn(
    `[DVN retry] Receipt ${receiptId} retry failed: ${result.error ?? 'unknown'}`,
  );
  return NextResponse.json(
    {
      ok: false,
      receiptStatus: 'dvn_failed',
      error: 'dvn_submission_failed',
      detail: result.error ?? 'submit_dvn_message returned no messageId',
    },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}
