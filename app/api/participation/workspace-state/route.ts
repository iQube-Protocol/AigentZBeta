/**
 * GET /api/participation/workspace-state?workspaceId=...
 *
 * The ONE canonical (principal + selectedWorkspaceId) state route (2026-09-08
 * — see services/research/selectedWorkspaceState.ts's own header for the full
 * design rationale). Every Workspace surface — Overview, Experiments,
 * Pipeline, Review, Working Materials — reads THIS route; none of them
 * independently infers state or queries a second, divergent source.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveSelectedWorkspaceState } from '@/services/research/selectedWorkspaceState';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: 'workspaceId is required' }, { status: 400 });
  }

  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const origin = resolveRequestOrigin(req);
  const result = await resolveSelectedWorkspaceState(admin, { personaId: persona.personaId, isAdmin }, workspaceId, origin);

  if (!result.ok) {
    if (result.reason === 'not-found') {
      return NextResponse.json({ ok: false, error: 'Unknown workspace' }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: 'Not authorized to read this workspace.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, state: result.state });
}
