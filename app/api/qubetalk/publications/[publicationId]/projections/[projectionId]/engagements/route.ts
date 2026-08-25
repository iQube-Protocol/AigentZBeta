/**
 * POST /api/qubetalk/publications/[publicationId]/projections/[projectionId]/engagements
 *
 * Manually record one engagement (comment/reply/mention/reaction/etc.) on a
 * projection. This is the ONLY intake path today — no live inbound
 * webhook/poll adapter exists for any transport (the same honest boundary
 * QubeTalk's own Discord work drew for inbound messages: real outbound is
 * live, inbound is deliberately deferred, not fabricated). A future webhook
 * receiver would call the SAME recordEngagement function, never a second
 * ingestion path.
 *
 * Idempotent on externalEngagementId (recordEngagement upserts) — safe to
 * call twice with the same id without duplicating the row.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedPublication } from '@/services/qubetalk/publications';
import { recordEngagement } from '@/services/qubetalk/engagement';
import type { QubeTalkEndpointPlatform, QubeTalkEngagementType } from '@/types/qubetalk';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ publicationId: string; projectionId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { publicationId, projectionId } = await ctx.params;
  const owned = await getOwnedPublication(persona.personaId, publicationId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as {
    engagementType?: string;
    externalEngagementId?: string;
    authorPlatform?: string;
    authorHandle?: string;
    authorDisplayName?: string;
    body?: string;
  };
  const engagementType = typeof body.engagementType === 'string' ? (body.engagementType as QubeTalkEngagementType) : null;
  const authorPlatform = typeof body.authorPlatform === 'string' ? (body.authorPlatform as QubeTalkEndpointPlatform) : null;
  const authorHandle = typeof body.authorHandle === 'string' ? body.authorHandle.trim() : '';
  if (!engagementType || !authorPlatform || !authorHandle) {
    return NextResponse.json({ error: 'engagementType, authorPlatform, and authorHandle are required' }, { status: 400, headers: NO_STORE });
  }

  const result = await recordEngagement(persona.personaId, projectionId, {
    engagementType,
    externalEngagementId: typeof body.externalEngagementId === 'string' ? body.externalEngagementId : null,
    authorPlatform,
    authorHandle,
    authorDisplayName: typeof body.authorDisplayName === 'string' ? body.authorDisplayName : authorHandle,
    body: typeof body.body === 'string' ? body.body : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, engagement: result.value }, { headers: NO_STORE });
}
