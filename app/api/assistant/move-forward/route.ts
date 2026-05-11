/**
 * POST /api/assistant/move-forward
 *
 * Aigent Me Phase 3 — Move This Cartridge Forward.
 * Per PRD v0.2 §12 (Move cartridge forward) and §8 Golden Path 3.
 *
 * Body (all optional):
 *   {
 *     cartridge?: 'metame'|'knyt'|'qriptopian'|'marketa'|'avl'
 *   }
 *
 * - Body omitted → builder picks the strongest NBE across the user's active
 *   cartridges. This is Aigent Me's default move ("KNYT is the highest-
 *   leverage move today, here's the hero action").
 * - Body with `cartridge` → scope to that cartridge for steering.
 *
 * Response: MoveForwardShape (services/orchestration/briefBuilder.ts).
 *
 * Privacy mirrors /api/assistant/brief — personaId from the spine, no
 * BlakQube values, iQube disclosure included in the response.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildMoveForward } from '@/services/orchestration/briefBuilder';
import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

export const dynamic = 'force-dynamic';

const VALID_CARTRIDGES: ActiveCartridgeSlug[] = [
  'metame',
  'knyt',
  'qriptopian',
  'marketa',
  'avl',
];

interface PostBody {
  cartridge?: ActiveCartridgeSlug;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Body is optional. Empty / missing body → auto-pick top NBE across
  // active cartridges. Explicit `cartridge` → scope to one for steering.
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    /* no body — auto-pick mode */
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const scoped: ActiveCartridgeSlug | undefined =
    body.cartridge && VALID_CARTRIDGES.includes(body.cartridge)
      ? body.cartridge
      : undefined;

  try {
    const result = await buildMoveForward({
      personaId: context.personaId,
      ...(scoped ? { cartridge: scoped } : {}),
    });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/move-forward] build failed: ${msg}`);
    return NextResponse.json(
      { error: 'move-forward-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
