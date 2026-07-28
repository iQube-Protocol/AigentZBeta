/**
 * GET /api/venture/workspace/[workspaceId] — the ExperimentWorkspace spine,
 * resolved for one caller (Horizen Phase 3). Spine-authenticated.
 *
 * This route is where the Phase 2 discipline becomes visible: nothing it
 * returns is stored on the workspace. Participants, agents, actions, decisions
 * and invariants are all resolved from the capabilities that own them, and
 * milestones/blockers — the only workspace-local state — come from
 * `experiment_workspace_items`.
 *
 * TIER BOUNDARY, ENFORCED SERVER-SIDE (audit §B.3). The `tier2` block is the
 * shared programme record: any caller holding an active `venture-lab`
 * participation grant may read it, WITHOUT being a platform admin — that is
 * the whole point of the split. The `tier0` block is the internal programme
 * space (integrity findings, blockers, decision detail) and is returned to
 * admins only. The client tab gate decides what RENDERS; this decides what is
 * PERMITTED, and the two are deliberately not the same check.
 *
 * T0 discipline: no persona identifier is serialised. The caller's own persona
 * is used to project their actions and is never echoed back.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getExperimentWorkspace,
  workspaceReferenceIssues,
  resolveWorkspaceInvariants,
  projectWorkspaceActions,
  projectWorkspaceDecisions,
} from '@/services/experiments/experimentWorkspace';
import { listWorkspaceItems } from '@/services/experiments/workspaceTracking';
import { listAccessGrants } from '@/services/passport/participationAccess';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';
import { satisfiesWorkspaceScope, type ParticipationGrantSignal } from '@/services/passport/participationTabGate';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const ws = getExperimentWorkspace(workspaceId);
  if (!ws) return NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const isAdmin = persona.cartridgeFlags?.isAdmin === true;

  // Membership: the caller's OWN active grant in the workspace's participation
  // domain. This is the Tier 2 authorisation — deliberately not an admin check.
  //
  // Resolved through `resolveParticipationSelfView`, the same implementation
  // /api/participation/my-access uses, so the tab gate and this route can never
  // disagree about whether the caller is a member (CS-001 discipline: read the
  // resolver, do not re-derive it). `listAccessGrants` is the STEWARD view and
  // is T2-safe by construction — it carries `holderRef`, not a persona id, so
  // it cannot answer "is this caller a member" and is used here only for the
  // membership COUNT.
  const [selfView, domainGrants] = await Promise.all([
    resolveParticipationSelfView(req, admin, {
      personaId: persona.personaId,
      authProfileId: persona.authProfileId,
    }).catch(() => ({ grants: [], passportIssued: false, delegationActive: false })),
    listAccessGrants(admin, ws.participation.domain).catch(() => []),
  ]);
  // TWO checks, not one (Amendment G / 2026-07-28 cohort-isolation ruling):
  // domain membership ("are you in venture-lab at all") is necessary but no
  // longer sufficient — the caller's grant must also be SCOPED to this
  // specific workspace/pilot id. A generic venture-lab grant with no scope
  // denies every workspace by default; see satisfiesWorkspaceScope's header.
  const grants: ParticipationGrantSignal[] = selfView.grants.map((g) => ({
    accessDomain: g.accessDomain,
    role: g.role,
    allowedScopes: g.allowedScopes,
  }));
  const isMember = satisfiesWorkspaceScope({ loaded: true, grants }, ws.participation.domain, ws.id, isAdmin);
  if (!isMember) {
    return NextResponse.json(
      { ok: false, error: 'Workspace membership required — your access grant is not scoped to this pilot' },
      { status: 403 },
    );
  }

  const [invariants, actions, decisions, milestones, blockers] = await Promise.all([
    resolveWorkspaceInvariants(ws).catch(() => null),
    projectWorkspaceActions(ws, persona.personaId).catch(() => []),
    projectWorkspaceDecisions(ws).catch(() => []),
    listWorkspaceItems(ws.id, 'milestone'),
    listWorkspaceItems(ws.id, 'blocker'),
  ]);

  const tier2 = {
    id: ws.id,
    label: ws.label,
    domain: ws.domain,
    experimentClass: ws.experimentClass,
    objectives: ws.objectives,
    // Membership is reported as SHAPE, never as a roster of identifiers.
    participation: {
      domain: ws.participation.domain,
      roles: ws.participation.roles,
      // Scoped to THIS workspace, not the whole domain (cohort isolation,
      // Amendment G) — an unscoped grant no longer counts toward any one
      // pilot's membership, matching the read-time gate above.
      memberCount: domainGrants.filter(
        (g) => g.status === 'active' && g.allowedExperiments && g.allowedExperiments.includes(ws.id),
      ).length,
    },
    agentIds: ws.agents.agentIds,
    workingGroups: ws.workingGroups.map((g) => ({
      id: g.id,
      label: g.label,
      layers: g.layers,
      channelCount: g.channelIds.length,
    })),
    evidence: ws.evidence,
    invariants,
    milestones,
    actions,
  };

  return NextResponse.json(
    {
      ok: true,
      viewerTier: isAdmin ? 'tier0' : 'tier2',
      workspace: tier2,
      // Internal programme space — admins only.
      tier0: isAdmin
        ? {
            referenceIssues: workspaceReferenceIssues(ws),
            blockers,
            decisions,
          }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
