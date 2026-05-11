/**
 * GET  /api/cron/herald-aggregation
 * POST /api/cron/herald-aggregation
 *
 * Runs heraldAggregationService.runHeraldAggregation(). Authentication:
 *
 *   1. Admin persona (via getActivePersona + cartridgeFlags.isAdmin) —
 *      lets the operator trigger a run from the admin Tasks & Rewards
 *      tab.
 *   2. Cron secret header `x-cron-secret: <CRON_SECRET>` — lets a
 *      scheduled trigger (Amplify cron, GitHub Actions, pg_cron HTTP
 *      extension, …) run it without a persona session.
 *
 * Either is sufficient. No public access. Privacy: the response carries
 * aggregate counts + per-grant detail rows. The detail rows include
 * personaIds (T0) since the route is admin-only — but the privacy
 * canary suite forbids any T0 from /api/wallet/* and /api/admin/knyt/*
 * routes, so this is a cron-only path, NOT routed through the wallet UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { runHeraldAggregation } from '@/services/rewards/heraldAggregationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(request: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  // Cron-secret path — for scheduled callers without a persona session.
  const headerSecret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (expected && headerSecret && headerSecret === expected) {
    return { ok: true };
  }

  // Admin-persona path — for operator-triggered runs from the admin tab.
  const persona = await getActivePersona(request);
  if (persona && persona.cartridgeFlags?.isAdmin) {
    return { ok: true };
  }

  return { ok: false, status: 403, error: 'admin or x-cron-secret required' };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const summary = await runHeraldAggregation();
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[cron/herald-aggregation] failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
