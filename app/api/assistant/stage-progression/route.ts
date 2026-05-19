/**
 * GET  /api/assistant/stage-progression — evaluate readiness to advance
 * POST /api/assistant/stage-progression — advance one stage if eligible
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  advanceStage,
  evaluateStageProgression,
  setAutoProgress,
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
  // Optional body: `{ autoProgress: boolean }` toggles the opt-in instead
  // of advancing. Empty / non-object body falls through to the advance path.
  let raw: unknown = null;
  try { raw = await request.json(); } catch { /* no body — fall through to advance */ }
  if (raw && typeof raw === 'object' && 'autoProgress' in (raw as Record<string, unknown>)) {
    const value = !!(raw as { autoProgress?: unknown }).autoProgress;
    const ok = await setAutoProgress(context.personaId, value);
    return NextResponse.json(
      { ok, autoProgress: value },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    // The split tab's NBE short-circuit posts here with `{ trigger: 'nbe' }`
    // — mark the transition accordingly so the ledger differentiates an NBE
    // action from a manual click on the Strategy tab's Advance button.
    const trigger = (raw && typeof raw === 'object' && (raw as { trigger?: unknown }).trigger === 'nbe')
      ? 'nbe' as const
      : 'manual' as const;
    const result = await advanceStage(context.personaId, { trigger });
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
