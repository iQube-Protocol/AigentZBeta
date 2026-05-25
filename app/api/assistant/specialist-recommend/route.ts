/**
 * POST /api/assistant/specialist-recommend
 *
 * Returns the recommended specialist for the active persona — the data
 * the SpecialistsLayout renders in its top "aigentMe suggests …" card.
 *
 * Body (all optional):
 *   {
 *     query?: string;     // free-form question the operator just typed
 *     cartridge?: string; // scope hint, defaults to persona's active set
 *   }
 *
 * Response:
 *   {
 *     topSpecialistId, reason, alternates, roster, llmApplied,
 *     preflightContext?:  // when CAPABILITY_GATEWAY_PREFLIGHT is on
 *       { workOrderId, summary, policyHash }
 *   }
 *
 * Privacy: persona resolved from the spine; T0 ids never leave the
 * server. Roster + reason are T1-safe (specialist labels, cartridge
 * slugs, short reason strings only).
 */
import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { recommendSpecialist } from '@/services/orchestration/specialistRecommender';
import { runPreflightGather } from '@/services/capabilities/preflight';

export const dynamic = 'force-dynamic';

interface PostBody {
  query?: string;
  cartridge?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 600) : '';
  const cartridge = typeof body.cartridge === 'string' ? body.cartridge.trim() : '';

  try {
    // Capability Gateway pre-flight — surface id is 'specialists' so
    // the env allowlist can target this independently. No-op when the
    // flag is off; on a stub return the result still threads into the
    // LLM rerank context inside the recommender.
    const preflight = await runPreflightGather({
      persona: context,
      surfaceId: 'specialists',
      query: query
        ? `specialist recommendation: ${query}`
        : 'specialist recommendation for current cartridge mix',
      cartridge: cartridge || 'metame',
    });

    const recommendation = await recommendSpecialist({
      personaId: context.personaId,
      query: query || null,
      liveContext: preflight?.summary ?? null,
    });

    return NextResponse.json(
      preflight ? { ...recommendation, preflightContext: preflight } : recommendation,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/specialist-recommend] failed: ${msg}`);
    return NextResponse.json(
      { error: 'specialist-recommend-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
