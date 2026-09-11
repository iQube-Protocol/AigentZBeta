/**
 * POST /api/access/finalize-receipts
 *
 * Phase 3.4 — operator/cron-triggered batcher endpoint. Submits pending
 * access-decision receipts to the cross_chain_service DVN canister.
 *
 * Auth: requires ADMIN_OPS_TOKEN bearer to prevent unauthorised triggering
 * (the canister submission has cycle costs).
 *
 * Cadence (operator decision): 15-minute async-batched. Run from a cron
 * job, Lambda scheduled task, or manually.
 *
 *   curl -X POST -H "Authorization: Bearer $ADMIN_OPS_TOKEN" \
 *     https://dev-beta.aigentz.me/api/access/finalize-receipts
 *
 * Response shape:
 *   { ok, pendingCount, submitted, failed, errors? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitPendingAccessReceipts } from '@/services/dvn/accessReceiptBatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Give the canister submission loop as much headroom as possible.
// API Gateway hard limit is 29 s; the batcher's own deadline fires at 20 s.
export const maxDuration = 28;

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_OPS_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_OPS_TOKEN not configured on server' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = url.searchParams.get('limit');
  const minAgeSeconds = url.searchParams.get('minAgeSeconds');

  const result = await submitPendingAccessReceipts({
    limit: limit ? parseInt(limit, 10) : undefined,
    minAgeSeconds: minAgeSeconds ? parseInt(minAgeSeconds, 10) : undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  // Convenience GET for browser-triggered runs during testing.
  // Same auth.
  return POST(req);
}
