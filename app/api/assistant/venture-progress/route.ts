/**
 * POST /api/assistant/venture-progress
 *
 * Aigent Me Phase 4 — Review Venture Progress.
 * Per PRD v0.2 §12 (Review venture progress) and §8 Golden Path 4.
 *
 * Body (all optional):
 *   {
 *     cartridge?: 'metame'|'knyt'|'qriptopian'|'marketa'|'mvl';
 *     recentLimit?: number;  // default 5, capped at 20
 *   }
 *
 * Response: VentureProgressShape.
 *
 * Privacy mirrors the brief / move-forward endpoints:
 *   - personaId from the spine; never read from body
 *   - BlakQube content not surfaced (counts only)
 *   - iQube disclosure included in the response
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildVentureProgress, sweepSupersededIntents } from '@/services/orchestration/ventureProgressBuilder';
import { runPreflightGather } from '@/services/capabilities/preflight';
import { refreshCapabilityStandingFromActivity } from '@/services/crm/standingAccrualService';
import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

export const dynamic = 'force-dynamic';

const VALID_CARTRIDGES: ActiveCartridgeSlug[] = [
  'metame',
  'knyt',
  'qriptopian',
  'marketa',
  'mvl',
];

interface PostBody {
  cartridge?: ActiveCartridgeSlug;
  recentLimit?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Body is optional. Empty / missing body → full venture review.
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    /* no body — defaults */
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const cartridge =
    body.cartridge && VALID_CARTRIDGES.includes(body.cartridge)
      ? body.cartridge
      : undefined;
  const recentLimit =
    typeof body.recentLimit === 'number' && body.recentLimit > 0
      ? Math.min(body.recentLimit, 20)
      : undefined;

  try {
    // Capability Gateway — Pattern A pre-flight gather. Surface id is
    // 'venture-progress' so the env allowlist can target this
    // independently of the other two aigentMe experience-model
    // progression surfaces.
    const preflight = await runPreflightGather({
      persona: context,
      surfaceId: 'venture-progress',
      query: `venture progress review${cartridge ? ` for ${cartridge} cartridge` : ''}`,
      cartridge: cartridge ?? 'metame',
    });

    // Refresh Capability Standing from live VentureQube signals on each engagement.
    void refreshCapabilityStandingFromActivity(context.personaId);

    // Intent hygiene (operator request 2026-07-14): cancel superseded live
    // duplicates + 14-day-stale live singletons BEFORE the build so the
    // cockpit's Active Work reflects the swept record in THIS response.
    // Best-effort + capped inside the sweep; a failure never blocks the build.
    const swept = await sweepSupersededIntents(context.personaId);
    if (swept.cancelledSuperseded > 0 || swept.cancelledStale > 0) {
      console.log(
        `[assistant/venture-progress] intent sweep: ${swept.cancelledSuperseded} superseded + ${swept.cancelledStale} stale intent(s) cancelled`,
      );
    }

    const result = await buildVentureProgress({
      personaId: context.personaId,
      ...(cartridge ? { cartridge } : {}),
      ...(recentLimit ? { recentLimit } : {}),
    });
    return NextResponse.json(
      preflight ? { ...result, preflightContext: preflight } : result,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/venture-progress] build failed: ${msg}`);
    return NextResponse.json(
      { error: 'venture-progress-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
