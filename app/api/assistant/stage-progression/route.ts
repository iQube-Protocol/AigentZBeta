/**
 * GET  /api/assistant/stage-progression — evaluate readiness to advance
 * POST /api/assistant/stage-progression — advance one stage if eligible
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  advanceStage,
  evaluateStageProgression,
} from '@/services/strategy/stageProgression';

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
    const evaluation = await evaluateStageProgression(context.personaId);
    return NextResponse.json(
      { configured: !!evaluation, evaluation },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/stage-progression] eval failed: ${msg}`);
    return NextResponse.json(
      { error: 'stage-progression-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const result = await advanceStage(context.personaId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/stage-progression] advance failed: ${msg}`);
    return NextResponse.json(
      { error: 'stage-progression-advance-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
