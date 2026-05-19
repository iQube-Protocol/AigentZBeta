/**
 * GET  /api/cron/stage-progression-sweep
 * POST /api/cron/stage-progression-sweep
 *
 * Daily auto-advance sweep — iterates every persona with `auto_progress = true`
 * and advances those that have hit every transition criterion since the last
 * read.
 *
 * Authentication: same dual-mode as other cron routes —
 *   1. `x-cron-secret: <CRON_SECRET>` header for scheduled callers, OR
 *   2. Admin persona via `getActivePersona` (for manual runs from a tab).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { runStageProgressionSweep } from '@/services/strategy/stageProgression';

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
    const summary = await runStageProgressionSweep();
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[cron/stage-progression-sweep] failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
