/**
 * GET  /api/crm/campaign/followup-queue
 *   Returns the current ranked follow-up queue (investors + partners).
 *   ?entityType=investor|partner  — filter to one type
 *   ?limit=N                      — max rows (default 100)
 *
 * POST /api/crm/campaign/followup-queue
 *   Body: { action: 'compute' }
 *   Recomputes priority scores from live CRM signals and writes to DB.
 *   Run after each Make.com write-back batch or on demand from the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFollowupQueue,
  computeFollowupQueue,
} from '@/services/campaign/knytTrackingService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get('entityType');
  const entityType = rawType === 'investor' || rawType === 'partner' ? rawType : undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const queue = await getFollowupQueue({ entityType, limit });

  return NextResponse.json({
    data:         queue,
    total:        queue.length,
    entity_type:  entityType ?? 'all',
    as_of:        new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* no body — fine */ }

  if (body.action !== 'compute' && body.action !== undefined) {
    return NextResponse.json({ error: 'Unknown action — use { action: "compute" }' }, { status: 400 });
  }

  const result = await computeFollowupQueue();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    written: result.written,
    computed_at: new Date().toISOString(),
  });
}
