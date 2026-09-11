/**
 * POST /api/memory/invariants/compact — CFS-045 compaction: memory's
 * self-compression (merge near-duplicates, retire stale/refuted entries).
 * Operator-triggered in v1 (surfaced as a SmartTriad operation chip).
 *
 * Spine-authenticated and OWNER-SCOPED: compaction runs over the caller's
 * own substrate only. Body: { cartridgeId: string }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { compactMemory } from '@/services/memory/memoryCompilation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const cartridgeId = typeof body?.cartridgeId === 'string' ? body.cartridgeId : '';
  if (!cartridgeId) return NextResponse.json({ ok: false, error: 'cartridgeId required' }, { status: 400 });

  const result = await compactMemory(persona.personaId, cartridgeId);
  if (!result) return NextResponse.json({ ok: false, error: 'Compaction failed' }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
