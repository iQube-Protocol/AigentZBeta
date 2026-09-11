import { NextRequest, NextResponse } from 'next/server';
import { reconcileLocalReceiptsToDvn } from '@/services/dvn/activityReceiptDvnPipeline';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/dvn/reconcile-local-receipts
 *
 * Infra-scheduled durability layer beneath `finalize-activity-receipts`
 * (Horizen Pilot Closure, "close the DVN lifecycle completely", 2026-08-09).
 * Calls the SAME `reconcileLocalReceiptsToDvn()` — no new submission logic,
 * no second `submit_dvn_message` implementation.
 *
 * Exists because `createActivityReceipt()`'s hot-path DVN submission is an
 * un-awaited background promise: latency-friendly, but not durable in a
 * request/serverless environment. A receipt whose request ended before that
 * background work ran is stranded at `receipt_status: 'local'` with nothing
 * left checking on it — the same "observability must not be the thing
 * providing liveness" defect class as `finalize-activity-receipts` closes
 * one hop later in the lifecycle (dvn_pending -> dvn_recorded).
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention and same secret as every other
 * /api/ops/* route — this route is infra-driven; the persona spine doesn't
 * apply.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await reconcileLocalReceiptsToDvn();
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
        'Infra-scheduled recovery for stranded activity_receipts (local -> dvn_pending, via the existing ' +
        'enqueueReceiptLeg primitive). Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
