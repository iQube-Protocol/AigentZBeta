/**
 * GET /api/assistant/stage-transitions
 *
 * Returns the persona's stage advance history, newest first.
 * T1-safe — `from_stage`, `to_stage`, `trigger`, `reason`, `created_at`.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listStageTransitions } from '@/services/strategy/stageProgression';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const transitions = await listStageTransitions(context.personaId, 25);
    return NextResponse.json(
      { transitions },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/stage-transitions] failed: ${msg}`);
    return NextResponse.json(
      { error: 'stage-transitions-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
