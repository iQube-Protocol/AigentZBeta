/**
 * POST   /api/locker/rooms/[id]/members — invite a member (person/group/agent).
 * PATCH  /api/locker/rooms/[id]/members — { memberId, role } change role.
 * DELETE /api/locker/rooms/[id]/members?memberId=... — remove/expire a member.
 *
 * Person invites accept EITHER `invitedPersonaId` (T0, legacy/internal) or
 * `invitedHandle` (T1 — @handle / name@fio-domain / did:iq:<id> / 0x
 * address / persona UUID), resolved server-side so persona_id never
 * travels in browser-bound JSON. Mirrors the exact resolution strategy in
 * app/api/mycanvas/entries/[id]/invite/route.ts (kept local/compact here
 * rather than importing that route's unexported helper — see the Phase 1
 * closeout for why a shared ContactGraph-backed resolver is Phase 2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { inviteRoomQubeMember, updateRoomQubeMemberRole, removeRoomQubeMember } from '@/services/locker/roomQube';
import type { RoomMemberRole, RoomMemberSubjectType } from '@/types/locker';

export const dynamic = 'force-dynamic';

const ROLES = new Set<RoomMemberRole>(['owner', 'administrator', 'contributor', 'reviewer', 'viewer', 'guest']);

async function resolveHandleToPersonaId(rawHandle: string): Promise<string | null> {
  const q = rawHandle.trim();
  if (!q) return null;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const sb = createClient(supabaseUrl, serviceKey);
  const normalised = q.startsWith('@') ? q.slice(1) : q;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalised)) {
    const { data } = await sb.from('personas').select('id').eq('id', normalised).maybeSingle();
    if (data) return (data as { id: string }).id;
  }
  const { data } = await sb.from('personas').select('id').ilike('fio_handle', normalised).limit(1).maybeSingle();
  if (data) return (data as { id: string }).id;
  return null;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  let body: { subjectType?: unknown; invitedPersonaId?: unknown; invitedHandle?: unknown; subjectGroupRef?: unknown; role?: unknown; expiresAt?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const role = typeof body.role === 'string' && ROLES.has(body.role as RoomMemberRole) ? (body.role as RoomMemberRole) : 'viewer';
  const subjectType: RoomMemberSubjectType = body.subjectType === 'group' || body.subjectType === 'agent' ? body.subjectType : 'person';

  if (subjectType === 'person') {
    let invitedPersonaId = typeof body.invitedPersonaId === 'string' ? body.invitedPersonaId.trim() : '';
    if (!invitedPersonaId && typeof body.invitedHandle === 'string') {
      const resolved = await resolveHandleToPersonaId(body.invitedHandle);
      if (!resolved) {
        return NextResponse.json({ error: `couldn't resolve "${body.invitedHandle}" to a persona` }, { status: 404 });
      }
      invitedPersonaId = resolved;
    }
    if (!invitedPersonaId) return NextResponse.json({ error: 'invitedHandle or invitedPersonaId required' }, { status: 400 });

    const result = await inviteRoomQubeMember({
      roomQubeId: id,
      callerPersonaId: context.personaId,
      subjectType: 'person',
      subjectPersonaId: invitedPersonaId,
      role,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400 });
    return NextResponse.json({ member: result.value });
  }

  if (typeof body.subjectGroupRef !== 'string' || !body.subjectGroupRef) {
    return NextResponse.json({ error: 'subjectGroupRef required for group/agent members' }, { status: 400 });
  }
  const result = await inviteRoomQubeMember({
    roomQubeId: id,
    callerPersonaId: context.personaId,
    subjectType,
    subjectGroupRef: body.subjectGroupRef,
    role,
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400 });
  return NextResponse.json({ member: result.value });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: { memberId?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (typeof body.memberId !== 'string' || !body.memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });
  if (typeof body.role !== 'string' || !ROLES.has(body.role as RoomMemberRole)) return NextResponse.json({ error: 'valid role required' }, { status: 400 });

  const result = await updateRoomQubeMemberRole(body.memberId, context.personaId, body.role as RoomMemberRole);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({ member: result.value });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const memberId = new URL(request.url).searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ error: 'memberId query param required' }, { status: 400 });

  const result = await removeRoomQubeMember(memberId, context.personaId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  return NextResponse.json({ removed: true });
}
