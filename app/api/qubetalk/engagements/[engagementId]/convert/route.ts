/**
 * POST /api/qubetalk/engagements/[engagementId]/convert
 *
 * "Publishing becomes conversation" (§9/§14): converts one engagement into
 * a real ConversationQube, preserving provenance both directions —
 * qubetalk_engagements.converted_conversation_id points forward,
 * qubetalk_conversations.origin_engagement_id points back. A reply INTO
 * that conversation is an ordinary QubeTalk send through the SAME
 * sendMessageThroughTransport egress path everything else uses (so the
 * disclosure gate applies identically — no separate, weaker send path for a
 * post-engagement conversation).
 *
 * Body: { topology? } — defaults to 'public_thread' (engagement.ts's own
 * default).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getOwnedEngagement, convertEngagementToConversation, setEngagementState } from '@/services/qubetalk/engagement';
import type { QubeTalkConversationTopology, QubeTalkEngagementState } from '@/types/qubetalk';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ engagementId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { engagementId } = await ctx.params;
  const owned = await getOwnedEngagement(persona.personaId, engagementId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { topology?: string };
  const topology = typeof body.topology === 'string' ? (body.topology as QubeTalkConversationTopology) : undefined;

  const result = await convertEngagementToConversation(engagementId, topology);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, engagement: result.value.engagement, conversationId: result.value.conversationId }, { headers: NO_STORE });
}

/** PATCH — triage state transitions (§10: new -> triaged -> agent_manageable/needs_user -> responded/dismissed). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ engagementId: string }> }): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const { engagementId } = await ctx.params;
  const owned = await getOwnedEngagement(persona.personaId, engagementId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.code === 'not_found' ? 404 : 500, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { state?: string };
  if (typeof body.state !== 'string') return NextResponse.json({ error: 'state is required' }, { status: 400, headers: NO_STORE });

  const result = await setEngagementState(engagementId, body.state as QubeTalkEngagementState);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true, engagement: result.value }, { headers: NO_STORE });
}
