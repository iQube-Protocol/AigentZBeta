/**
 * /api/registry/invariant-qube/[id] — fetch a published InvariantQube's
 * composition manifest (CFS-004 §3). Spine-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getInvariantQube } from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const invariantQube = await getInvariantQube(context.params.id);
    if (!invariantQube) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, invariantQube });
  } catch (error) {
    console.error('[api/registry/invariant-qube/[id]] read failed', error);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}
