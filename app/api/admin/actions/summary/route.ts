/**
 * Admin API — Admin Action Centre aggregate summary.
 *
 * GET /api/admin/actions/summary
 *
 * Feeds the Command-Centre-equivalent seam (BriefCard.pendingApprovalsCount
 * — components/metame/cards/BriefCard.tsx; wired via
 * services/orchestration/briefBuilder.ts). Aggregate count + top
 * exceptions only — never the full list (operator brief §13: "do not
 * duplicate existing work queues").
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import { getAdminActionSummary } from '@/services/adminActions/adminActionService';

export async function GET(req: NextRequest) {
  const gate = await requireCartridgeAdmin(req, 'polity-passport-bureau');
  if (gate instanceof NextResponse) return gate;

  const summary = await getAdminActionSummary(['passport']);
  return NextResponse.json({ ok: true, ...summary }, { headers: { 'Cache-Control': 'no-store' } });
}
