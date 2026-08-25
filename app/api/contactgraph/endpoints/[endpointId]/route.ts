/**
 * PATCH /api/contactgraph/endpoints/[endpointId] — the single mutation
 * surface for an existing CommunicationEndpoint's lifecycle (§6/§12):
 * confirm, reject, reassign to a different ContactPersona, or mark
 * preferred. One route with an `action` discriminator rather than four
 * near-identical routes — each action maps straight to the one service
 * function that already implements it
 * (services/contactGraph/contactEndpoints.ts), so this route is a thin
 * translation layer, never a second place the mutation logic lives.
 *
 * Every action is a deliberate, named operator act — never inferred (C6/
 * NC2). `actorPersonaId` is always the SPINE-resolved caller, never a value
 * from the request body, so a client cannot attribute an action to anyone
 * but the authenticated persona actually making the call.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import {
  reassignContactEndpoint,
  confirmContactEndpoint,
  rejectContactEndpoint,
  setPreferredContactEndpoint,
} from '@/services/contactGraph/contactEndpoints';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ endpointId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  const { endpointId } = await params;

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action : '';

  const owner = await resolveOwnerAuthProfileId(persona.personaId);
  if (!owner.ok) return NextResponse.json({ ok: false, error: owner.error }, { status: 500, headers: NO_STORE });

  const result = await (async () => {
    switch (action) {
      case 'confirm':
        return confirmContactEndpoint(owner.value, endpointId, persona.personaId);
      case 'reject':
        return rejectContactEndpoint(
          owner.value,
          endpointId,
          persona.personaId,
          typeof body?.reason === 'string' ? body.reason : undefined,
        );
      case 'reassign': {
        const toContactPersonaId = typeof body?.toContactPersonaId === 'string' ? body.toContactPersonaId : '';
        if (!toContactPersonaId) return { ok: false as const, error: 'toContactPersonaId is required' };
        return reassignContactEndpoint(
          owner.value,
          endpointId,
          toContactPersonaId,
          persona.personaId,
          typeof body?.reason === 'string' ? body.reason : undefined,
        );
      }
      case 'setPreferred':
        return setPreferredContactEndpoint(owner.value, endpointId);
      default:
        return { ok: false as const, error: "action must be one of 'confirm' | 'reject' | 'reassign' | 'setPreferred'" };
    }
  })();

  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, endpoint: result.value }, { headers: NO_STORE });
}
