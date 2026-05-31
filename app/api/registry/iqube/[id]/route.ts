/**
 * GET /api/registry/iqube/[id] — resolve a canonical iQube.
 *
 * Delegates to services/registry/resolver.ts. Caller controls the
 * projection shape via the ?projection= query param (default
 * 'cartridge'). 'admin' requires cartridgeFlags.isAdmin. 'public'
 * returns 404 for non-public records (does not leak existence per
 * PRD §8.2 default).
 *
 * Distinct from /api/iqubes/[id]/card (legibility surface) — that
 * endpoint serves the agent-facing IQubeCard; this endpoint serves
 * the in-app cartridge / Studio / runtime projection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveIQube, type ResolverProjection } from '@/services/registry/resolver';

function isValidProjection(value: string | null): value is ResolverProjection {
  return value === 'admin' || value === 'cartridge' || value === 'public' || value === 'internal';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const iqubeId = params.id;

  if (!iqubeId || typeof iqubeId !== 'string' || iqubeId.length < 4) {
    return NextResponse.json({ error: 'invalid_iqube_id' }, { status: 400 });
  }

  const url = new URL(request.url);
  const projectionParam = url.searchParams.get('projection');
  const projection: ResolverProjection = isValidProjection(projectionParam)
    ? projectionParam
    : 'cartridge';

  // Auth — required for admin / internal, optional for cartridge / public
  const persona = await getActivePersona(request);

  if (projection === 'admin' || projection === 'internal') {
    if (!persona) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (!persona.cartridgeFlags?.isAdmin) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const allowPrivate = projection === 'admin' || projection === 'internal';

  const result = await resolveIQube(iqubeId, {
    persona: persona ?? undefined,
    projection,
    allowPrivate,
  });

  if (!result) {
    // 404 (not 403) — never leak existence per PRD §8.2 convention
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(result);
}
