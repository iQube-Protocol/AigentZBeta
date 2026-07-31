/**
 * /api/identity/persona-assignments — per-persona agent ASSIGNMENTS (CFS-024 Ph3).
 *
 * The persona-first Delegation tab operates on a SELECTED persona (which may
 * differ from the spine-active one), so these take an explicit `personaId` the
 * caller must OWN. Ownership + bound-roster validity are enforced here through
 * the spine — never client-trusted.
 *
 *   GET    ?personaId=…                      → list the persona's assignments
 *   POST   { personaId, agentRootId, role }  → assign / set role (one aigentMe)
 *   DELETE ?personaId=…&agentRootId=…        → unassign
 *
 * personaId + agentRootId row-ids follow the same T1 handling the existing
 * delegation route uses in this tab. Client callers MUST use personaFetch.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listOwnedPersonaRows } from '@/services/identity/constitutionalContext';
import {
  listAssignments,
  assignAgent,
  unassignAgent,
  type AssignmentRole,
} from '@/services/identity/personaAssignmentStore';

export const dynamic = 'force-dynamic';

async function resolveOwnedPersonaIds(
  req: NextRequest,
): Promise<{ ownedIds: string[]; ok: true } | { ok: false; status: number; error: string }> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { ok: false, status: 401, error: 'Not authenticated' };
  const owned = await listOwnedPersonaRows(persona.authProfileId);
  const ownedIds = Array.from(new Set([persona.personaId, ...owned.map((r) => r.id)]));
  return { ok: true, ownedIds };
}

export async function GET(req: NextRequest) {
  try {
    const personaId = new URL(req.url).searchParams.get('personaId')?.trim();
    if (!personaId) return NextResponse.json({ ok: false, error: 'personaId is required' }, { status: 400 });
    const owned = await resolveOwnedPersonaIds(req);
    if (!owned.ok) return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    if (!owned.ownedIds.includes(personaId)) {
      return NextResponse.json({ ok: false, error: 'You do not own this persona' }, { status: 403 });
    }
    const rows = await listAssignments(personaId);
    return NextResponse.json(
      {
        ok: true,
        assignments: rows.map((r) => ({ agentRootId: r.agent_root_id, role: r.role, active: r.active })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'List failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      personaId?: string;
      agentRootId?: string;
      role?: string;
    };
    const personaId = body.personaId?.trim();
    const agentRootId = body.agentRootId?.trim();
    const role: AssignmentRole = body.role === 'aigentMe' ? 'aigentMe' : 'delegate';
    if (!personaId || !agentRootId) {
      return NextResponse.json({ ok: false, error: 'personaId and agentRootId are required' }, { status: 400 });
    }
    const owned = await resolveOwnedPersonaIds(req);
    if (!owned.ok) return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    if (!owned.ownedIds.includes(personaId)) {
      return NextResponse.json({ ok: false, error: 'You do not own this persona' }, { status: 403 });
    }
    const result = await assignAgent({ personaId, agentRootId, role, ownedPersonaIds: owned.ownedIds });
    if (!result.ok) {
      const status = result.code === 'not_bound' ? 403 : result.code === 'migration_pending' ? 503 : 500;
      return NextResponse.json({ ok: false, code: result.code, error: result.error }, { status });
    }
    return NextResponse.json({
      ok: true,
      assignment: { agentRootId: result.assignment.agent_root_id, role: result.assignment.role },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Assign failed' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const personaId = url.searchParams.get('personaId')?.trim();
    const agentRootId = url.searchParams.get('agentRootId')?.trim();
    if (!personaId || !agentRootId) {
      return NextResponse.json({ ok: false, error: 'personaId and agentRootId are required' }, { status: 400 });
    }
    const owned = await resolveOwnedPersonaIds(req);
    if (!owned.ok) return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    if (!owned.ownedIds.includes(personaId)) {
      return NextResponse.json({ ok: false, error: 'You do not own this persona' }, { status: 403 });
    }
    const result = await unassignAgent(personaId, agentRootId);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unassign failed' },
      { status: 500 },
    );
  }
}
