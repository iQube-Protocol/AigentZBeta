/**
 * /api/invariants/[id] — single-invariant detail (CFS-001, for the Invariant
 * Registry browsing UI).
 *
 * GET — the invariant record + its contexts + its immediate edges (both
 * directions) + a summary (id/statement/namespace) of every neighbor those
 * edges point at, so the detail view can render readable edges instead of
 * raw UUIDs in one round trip. Spine-gated; any authenticated persona may
 * read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getInvariantById,
  getInvariantsByIds,
  listContexts,
  listEdgesForInvariants,
} from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const invariant = await getInvariantById((await context.params).id);
    if (!invariant) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const [contexts, edges] = await Promise.all([
      listContexts(invariant.id),
      listEdgesForInvariants([invariant.id], 'both'),
    ]);

    const neighborIds = [
      ...new Set(
        edges.flatMap((e) => [e.fromInvariantId, e.toInvariantId]).filter((id) => id !== invariant.id),
      ),
    ];
    const neighbors = neighborIds.length
      ? (await getInvariantsByIds(neighborIds)).map((n) => ({
          id: n.id,
          statement: n.statement,
          namespace: n.namespace,
          status: n.status,
        }))
      : [];

    return NextResponse.json({ ok: true, invariant, contexts, edges, neighbors });
  } catch (error) {
    console.error('[api/invariants/[id]] read failed', error);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}
