/**
 * POST /api/qubetalk/publications/[publicationId]/publish
 *
 * Execute every pending projection for this publication and aggregate the
 * publication's own status (published / partially_published / failed) —
 * the ONE publish-execution path (services/qubetalk/publications.ts's
 * publishAllProjections). Never a second, UI-side "mark as published"
 * shortcut.
 *
 * Body: { actingAgentRootDid? } — present only when an Agent, not the
 * principal directly, is publishing; gated by the SAME BOUNDED-grant check
 * every QubeTalk send path uses (§10/P9/P10), before any transport is ever
 * touched.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedPublication, publishAllProjections } from '@/services/qubetalk/publications';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ publicationId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { publicationId } = await ctx.params;
  const owned = await getOwnedPublication(persona.personaId, publicationId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { actingAgentRootDid?: string };
  const result = await publishAllProjections(
    persona.personaId,
    publicationId,
    typeof body.actingAgentRootDid === 'string' ? body.actingAgentRootDid : null,
  );
  if (!result.ok) {
    const status = result.code === 'agent_not_authorized' ? 403 : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, ...result.value }, { headers: NO_STORE });
}
