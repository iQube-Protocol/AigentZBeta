import { NextRequest, NextResponse } from 'next/server';
import { finalizeReadyActivityReceipts } from '@/services/dvn/activityReceiptDvnPipeline';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/dvn/finalize-activity-receipts
 *
 * Infra-scheduled counterpart to the admin-only
 * /api/admin/activity-receipts/finalize route. Calls the SAME
 * finalizeReadyActivityReceipts() — no new finalization logic, no second
 * implementation of the dvn_pending -> dvn_recorded transition.
 *
 * Exists because that function had exactly one caller repo-wide (a manual
 * admin-dashboard button): with nobody clicking it, DVN-minted evidence for
 * activity_receipts — the receipts the Horizen journey and
 * ActivityReceiptCard read — sat at dvn_pending indefinitely (see
 * codexes/packs/polity-core/items/commentary/constitutional-internet/
 * BOOK_DISCREPANCY_REGISTER.md, finding O-2). Same defect class, and same
 * fix, as the one already closed for the PoS/anchor tick by
 * .github/workflows/dvn-reconciler.yml — observability must not be the thing
 * providing liveness.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention and same secret as
 * /api/ops/sync/cron-tick — this route is infra-driven; the persona spine
 * doesn't apply.
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
        'Infra-scheduled finalizer for activity_receipts (dvn_pending -> dvn_recorded). ' +
        'Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
