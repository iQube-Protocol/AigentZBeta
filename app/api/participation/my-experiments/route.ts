/**
 * GET /api/participation/my-experiments — the canonical participant research
 * workspace projection (IRL OS — Experiment Membership & Artifact Workspace
 * Restoration, operator spec 2026-09-02, item 14: "Build/reuse ONE
 * server-side projection … Both Workspace and Participation should consume
 * this projection").
 *
 * Composes `services/passport/participationAccess.ts`'s
 * `getParticipantResearchWorkspaceAccess` — itself a thin composition of the
 * PRE-EXISTING `getBoundaryResearchReadableExperiments` grant-reach resolver
 * and the PRE-EXISTING `ResearchWorkspace.visibility` field — with
 * `services/research/researchWorkspace.ts`'s workspace registry to project a
 * human-readable summary per entitled/public workspace. No new persistence,
 * no parallel authorization system (CLAUDE.md "Core Principle: Extend, Don't
 * Duplicate").
 *
 * DEFAULT DENY: an unauthenticated caller (`persona === null`) receives only
 * workspaces explicitly declared `visibility: 'public'` (none today — see
 * `WORKSPACE_VISIBILITIES`'s own "Nothing becomes public by default"
 * comment). A caller's own private entitlements require a resolved persona
 * and are drawn EXCLUSIVELY from their own `access_grants` rows — this route
 * never accepts a personaId from the client (getActivePersona only).
 *
 * This is a READ PROJECTION, not an authorization token: the artifact/
 * exchange routes this projection links to (e.g.
 * `/api/research/exchanges/[exchangeId]`) independently re-check entitlement
 * server-side on every request, exactly as before this route existed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getParticipantResearchWorkspaceAccess } from '@/services/passport/participationAccess';
import {
  listResearchWorkspaces,
  researchWorkspaceLabel,
  researchWorkspaceInstitutions,
} from '@/services/research/researchWorkspace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const isAdmin = Boolean(persona?.cartridgeFlags?.isAdmin);
  const entries = await getParticipantResearchWorkspaceAccess(admin, persona?.personaId ?? null, isAdmin);
  const basisById = new Map(entries.map((e) => [e.workspaceId, e.accessBasis]));

  const experiments = listResearchWorkspaces()
    .filter((ws) => basisById.has(ws.id))
    .map((ws) => ({
      id: ws.id,
      title: researchWorkspaceLabel(ws),
      accessBasis: basisById.get(ws.id)!,
      workspaceType: ws.workspaceType,
      currentStage: ws.currentStage ?? null,
      navSection: ws.navSection ?? null,
      institutions: researchWorkspaceInstitutions(ws),
      experimentId: ws.experimentId ?? null,
      parentId: ws.parentId ?? null,
    }));

  return NextResponse.json(
    { ok: true, authenticated: Boolean(persona?.personaId), isAdmin, experiments },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
