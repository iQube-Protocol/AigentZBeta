/**
 * GET /api/qubetalk/publications/[publicationId]/engagements
 *
 * Every engagement across every projection of this publication — the
 * Runtime Engagement tab's read.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedPublication } from '@/services/qubetalk/publications';
import { listEngagementsForPublication } from '@/services/qubetalk/engagement';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ publicationId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { publicationId } = await ctx.params;
  const owned = await getOwnedPublication(persona.personaId, publicationId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const result = await listEngagementsForPublication(publicationId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, engagements: result.value }, { headers: NO_STORE });
}
