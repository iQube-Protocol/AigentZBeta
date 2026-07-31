/**
 * GET  /api/cron/plan-renewal-sweep
 * POST /api/cron/plan-renewal-sweep
 *
 * Monthly renewal sweep — debits the house wallet (Q¢) for every paid plan whose
 * current_period_end has passed, extends the period on success, or flips the
 * plan to past_due on insufficient balance.
 *
 * Authentication: same dual-mode as the other cron routes —
 *   1. `x-cron-secret: <CRON_SECRET>` header for scheduled callers, OR
 *   2. Admin persona via getActivePersona (for manual runs from a tab).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { renewDuePlans } from '@/services/billing/planRenewal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const headerSecret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (expected && headerSecret && headerSecret === expected) return { ok: true };
  const persona = await getActivePersona(request);
  if (persona && persona.cartridgeFlags?.isAdmin) return { ok: true };
  return { ok: false, status: 403, error: 'admin or x-cron-secret required' };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const summary = await renewDuePlans();
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[cron/plan-renewal-sweep] failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
