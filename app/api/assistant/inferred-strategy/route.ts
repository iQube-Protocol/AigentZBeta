/**
 * GET  /api/assistant/inferred-strategy   — read (cached or recompute)
 * POST /api/assistant/inferred-strategy   — force-refresh
 *
 * Aigent Me Phase 3.b — surfaces the InferredStrategy synthesis built from
 * the persona's ExperienceQube + PersonalGuide. T1-safe response.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { inferStrategy, refreshInferredStrategy } from '@/services/strategy/strategyInference';

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
    const strategy = await inferStrategy(context.personaId);
    return NextResponse.json(
      { configured: !!strategy, strategy },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/inferred-strategy] read failed: ${msg}`);
    return NextResponse.json(
      { error: 'inferred-strategy-failed', detail: msg },
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
    const strategy = await refreshInferredStrategy(context.personaId);
    return NextResponse.json(
      { configured: !!strategy, strategy },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/inferred-strategy] refresh failed: ${msg}`);
    return NextResponse.json(
      { error: 'inferred-strategy-refresh-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
