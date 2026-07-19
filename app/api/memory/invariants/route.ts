/**
 * /api/memory/invariants — owner self-view over the CFS-045 constitutional
 * memory substrate. Spine-authenticated; the caller sees and manages ONLY
 * their own compiled memory ("memory of a sovereign operator is itself
 * sovereign: inspectable and erasable by its subject" — charter §v1.4).
 *
 * GET    → list own memory invariants (statements + row ids; no persona
 *          identifier of any tier is serialised).
 * DELETE → ?id=<memory row id> — erase one's own memory invariant.
 *
 * Client calls MUST use personaFetch (spine Bearer rule).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listMemoryInvariants, deleteMemoryInvariant } from '@/services/memory/memoryCompilation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const items = await listMemoryInvariants(persona.personaId);
    return NextResponse.json(
      {
        ok: true,
        items: items.map((m) => ({
          id: m.id,
          cartridgeId: m.cartridgeId,
          statement: m.statement,
          status: m.status,
          confidence: m.confidence,
          supportCount: m.supportCount,
          refuteCount: m.refuteCount,
          updatedAt: m.updatedAt,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Pre-migration (table absent) → clean empty state, not an error page.
    return NextResponse.json({ ok: true, items: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const deleted = await deleteMemoryInvariant(persona.personaId, id);
  return NextResponse.json(deleted ? { ok: true } : { ok: false, error: 'Not found' }, {
    status: deleted ? 200 : 404,
  });
}
