/**
 * POST /api/qubetalk/projection — the real, callable surface-independent
 * capability seam (services/qubetalk/projection.ts). Any surface (metaMe
 * Runtime, Companion, a cartridge) requests a bounded projection of the
 * caller's own QubeTalk graph through THIS one route — never by reading
 * qubetalk_participants/relationship_state/groups/conversations directly.
 *
 * Auth: spine (getActivePersona) — the resolved caller IS the principal
 * whose owned scope bounds every grant; a request cannot claim to be
 * someone else's principal via the body.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { requestProjection } from '@/services/qubetalk/projection';
import { QUBETALK_PROJECTION_PROFILES } from '@/types/qubetalk';
import type { QubeTalkProjectionRequest } from '@/types/qubetalk';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function isProjectionProfile(value: unknown): value is QubeTalkProjectionRequest['projection'] {
  return typeof value === 'string' && (QUBETALK_PROJECTION_PROFILES as readonly string[]).includes(value);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400, headers: NO_STORE });
  }
  if (body.capability !== 'qubetalk') {
    return NextResponse.json({ ok: false, error: "capability must be 'qubetalk'" }, { status: 400, headers: NO_STORE });
  }
  if (!isProjectionProfile(body.projection)) {
    return NextResponse.json({ ok: false, error: 'invalid projection profile' }, { status: 400, headers: NO_STORE });
  }
  const requestingSurface = typeof body.requestingSurface === 'string' && body.requestingSurface.trim() ? body.requestingSurface.trim() : 'unknown';

  const request: QubeTalkProjectionRequest = {
    capability: 'qubetalk',
    projection: body.projection,
    scope: {
      relationshipChannelIds: body.scope?.relationshipChannelIds,
      groupIds: body.scope?.groupIds,
      publishing: Boolean(body.scope?.publishing),
      engagement: Boolean(body.scope?.engagement),
    },
    requestingSurface,
    actingAgentRootDid: typeof body.actingAgentRootDid === 'string' ? body.actingAgentRootDid : null,
  };

  const result = await requestProjection(persona.personaId, request);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, projection: result.value }, { headers: NO_STORE });
}
