import { NextRequest, NextResponse } from 'next/server';
import { findReceiptsByIds } from '@/services/receipts/activityReceiptService';
import { enqueueReceiptLeg, shouldAnchorActionType } from '@/services/dvn/activityReceiptDvnPipeline';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/dvn/submit-specific-receipts
 *
 * Targeted, bounded counterpart to /api/ops/dvn/reconcile-local-receipts
 * (Horizen Pilot Closure, part B3, 2026-08-09). The general reconciler scans
 * the WHOLE `local` backlog oldest-first, which may take many bounded runs to
 * reach a specific known-stranded receipt if an unrelated historical backlog
 * sits in front of it. This route instead takes an EXPLICIT list of receipt
 * ids and calls the SAME `enqueueReceiptLeg` primitive on exactly those —
 * never a second submission implementation, never a status/backlog scan.
 *
 * Duplicate-submission safety: `enqueueReceiptLeg` itself re-reads
 * `dvn_receipt_id` before ever calling the canister and refuses to resubmit
 * if one is already on file — the SAME guard the general reconciler relies
 * on. This route adds no additional guard because none is needed; it is a
 * thinner caller of the identical safe primitive. Body: `{ "ids": string[] }`
 * (max 20 per call — this is for surgical recovery, not bulk draining).
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/dvn/*
 * infra routes.
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

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'body.ids must be a non-empty string array' }, { status: 400 });
  }
  if (ids.length > 20) {
    return NextResponse.json({ error: 'max 20 ids per call — this route is for surgical recovery, not bulk draining' }, { status: 400 });
  }

  let found: Awaited<ReturnType<typeof findReceiptsByIds>>;
  try {
    found = await findReceiptsByIds(ids);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
  const foundIds = new Set(found.map((f) => f.record.id));
  const notFound = ids.filter((id) => !foundIds.has(id));

  const results: Array<{ id: string; actionType: string; receiptStatusBefore: string; result: unknown }> = [];
  for (const { record, personaId } of found) {
    if (!shouldAnchorActionType(record.actionType)) {
      results.push({ id: record.id, actionType: record.actionType, receiptStatusBefore: record.receiptStatus, result: { skippedNonAnchorable: true } });
      continue;
    }
    try {
      const outcome = await enqueueReceiptLeg(record, personaId, 'dvn');
      results.push({ id: record.id, actionType: record.actionType, receiptStatusBefore: record.receiptStatus, result: outcome });
    } catch (err) {
      results.push({
        id: record.id,
        actionType: record.actionType,
        receiptStatusBefore: record.receiptStatus,
        result: { ok: false, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return NextResponse.json({ ok: true, results, notFound }, { headers: { 'Cache-Control': 'no-store' } });
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      body: '{ "ids": string[] } — max 20',
      description:
        'Submits an EXPLICIT list of local activity_receipts to DVN via the existing enqueueReceiptLeg primitive — ' +
        'never a backlog scan. Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
