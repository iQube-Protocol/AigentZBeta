/**
 * POST /api/assistant/move-forward
 *
 * Aigent Me Phase 3 — Move This Cartridge Forward.
 * Per PRD v0.2 §12 (Move cartridge forward) and §8 Golden Path 3.
 *
 * Body:
 *   {
 *     cartridge: 'metame'|'knyt'|'qriptopian'|'marketa'|'avl'
 *   }
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.cartridge || !VALID_CARTRIDGES.includes(body.cartridge)) {
    return NextResponse.json(
      {
        error: 'invalid-cartridge',
        detail: `cartridge must be one of: ${VALID_CARTRIDGES.join(', ')}`,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const result = await buildMoveForward({
      personaId: context.personaId,
      cartridge: body.cartridge,
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
