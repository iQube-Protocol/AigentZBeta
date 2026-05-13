/**
 * POST /api/admin/activity-receipts/finalize
 *
 * Aigent Me Phase 6.b Part 4 — DVN finalizer for activity receipts.
 *
 * Polls the cross_chain_service canister's get_ready_messages() and flips
 * matching activity_receipts rows from dvn_pending → dvn_recorded. Safe
 * to call repeatedly — only rows whose dvn_receipt_id is in the ready
 * set AND whose status is still dvn_pending get updated.
 *
 * Intended for an external scheduler (cron, Amplify event) or one-shot
 * operator runs from the admin surface. Auth gate: requires the active
 * persona to carry cartridgeFlags.isAdmin. No body required.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { finalizeReadyActivityReceipts } from '@/services/dvn/activityReceiptDvnPipeline';

export const dynamic = 'force-dynamic';

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
      { error: 'forbidden', detail: 'Admin-only route.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const result = await finalizeReadyActivityReceipts();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** GET shows the last invocation's shape — handy for cron validation. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Finalises activity_receipts whose DVN message is ready. Admin-only. ' +
        'No body required.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
