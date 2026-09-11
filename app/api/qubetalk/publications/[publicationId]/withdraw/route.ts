/**
 * POST /api/qubetalk/publications/[publicationId]/withdraw
 *
 * Sets the publication's status to 'withdrawn' — fires the
 * qubetalk_publication_withdrawn receipt via setPublicationStatus. Does not
 * itself retract already-published external projections (Discord/etc. have
 * no delete/edit capability wired — see transportRegistry.ts's
 * post.edit/post.delete, both 'unsupported' for every transport today);
 * this only marks the canonical publishing act as withdrawn.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedPublication, setPublicationStatus } from '@/services/qubetalk/publications';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ publicationId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { publicationId } = await ctx.params;
  const owned = await getOwnedPublication(persona.personaId, publicationId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const result = await setPublicationStatus(publicationId, 'withdrawn', persona.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, publication: result.value }, { headers: NO_STORE });
}
