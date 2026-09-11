/**
 * /api/qubetalk/publications/[publicationId] — one publication + its
 * projections + engagement counts, the read Runtime's Publishing tab and
 * aigentMe's compact publishing surface both consume (same route, same
 * service layer — no separate aigentMe-only projection).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedPublication, listProjections } from '@/services/qubetalk/publications';
import { listEngagementsForProjection } from '@/services/qubetalk/engagement';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ publicationId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { publicationId } = await ctx.params;
  const publication = await getOwnedPublication(persona.personaId, publicationId);
  if (!publication.ok) return NextResponse.json({ error: publication.error }, { status: publication.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const projections = await listProjections(publicationId);
  if (!projections.ok) return NextResponse.json({ error: projections.error }, { status: 500, headers: NO_STORE });

  const engagementCounts = await Promise.all(
    projections.value.map(async (p) => {
      const engagements = await listEngagementsForProjection(p.id);
      return { projectionId: p.id, count: engagements.ok ? engagements.value.length : 0 };
    }),
  );

  return NextResponse.json(
    { ok: true, publication: publication.value, projections: projections.value, engagementCounts },
    { headers: NO_STORE },
  );
}
