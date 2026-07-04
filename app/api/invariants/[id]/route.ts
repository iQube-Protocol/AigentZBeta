/**
 * /api/invariants/[id] — single-invariant detail (CFS-001, for the Invariant
 * Registry browsing UI).
 *
 * GET — the invariant record + its contexts + its immediate edges (both
 * directions). One call for the detail view instead of three round trips.
 * Spine-gated; any authenticated persona may read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getInvariantById,
  listContexts,
  listEdgesForInvariants,
} from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const invariant = await getInvariantById(context.params.id);
    if (!invariant) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const [contexts, edges] = await Promise.all([
      listContexts(invariant.id),
      listEdgesForInvariants([invariant.id], 'both'),
    ]);

    return NextResponse.json({ ok: true, invariant, contexts, edges });
  } catch (error) {
    console.error('[api/invariants/[id]] read failed', error);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}
