/**
 * GET /api/participation/workspace-tracking?workspaceId=...
 *
 * Real "Next Milestone" / "Technical Blockers" data for the Workspace Command
 * Center (2026-09-08) — `services/experiments/workspaceTracking.ts` already
 * has a working, queryable backing store (`experiment_workspace_items`) that
 * `PartnerProgrammesTab.tsx` never called; its two metric cards rendered an
 * unconditional `NotYetWired` regardless of whether tracked items existed.
 * This route is the read projection those cards now consume.
 *
 * `Health` and `Last Sync` are NOT included here — deliberately: no canonical
 * data model exists anywhere in the codebase for either (confirmed by
 * inventory, 2026-09-08). Fabricating one would violate the Command Center's
 * own "honesty rule" (`PartnerProgrammesTab.tsx`'s header comment); those two
 * cards stay `NotYetWired` in the UI, unchanged.
 *
 * Entitlement: reuses the same server-side workspace-visibility check as
 * `/api/participation/my-experiments` (`getParticipantResearchWorkspaceAccess`)
 * — a caller who cannot see this workspace at all gets a 403, never a
 * silent empty list that could be mistaken for "no blockers".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getParticipantResearchWorkspaceAccess } from '@/services/passport/participationAccess';
import { listWorkspaceItems, type WorkspaceTrackedItem } from '@/services/experiments/workspaceTracking';

export const dynamic = 'force-dynamic';

function isOpen(item: WorkspaceTrackedItem): boolean {
  return item.status === 'open' || item.status === 'in_progress';
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: 'workspaceId is required' }, { status: 400 });
  }

  const isAdmin = Boolean(persona?.cartridgeFlags?.isAdmin);
  const entries = await getParticipantResearchWorkspaceAccess(admin, persona?.personaId ?? null, isAdmin);
  if (!entries.some((e) => e.workspaceId === workspaceId)) {
    return NextResponse.json({ ok: false, error: 'Not authorized to read this workspace.' }, { status: 403 });
  }

  const [milestones, blockers] = await Promise.all([
    listWorkspaceItems(workspaceId, 'milestone'),
    listWorkspaceItems(workspaceId, 'blocker'),
  ]);

  const openMilestones = milestones.filter(isOpen).sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const openBlockers = blockers.filter(isOpen);

  return NextResponse.json({
    ok: true,
    workspaceId,
    nextMilestone: openMilestones[0]
      ? { id: openMilestones[0].id, title: openMilestones[0].title, dueDate: openMilestones[0].dueDate }
      : null,
    openBlockers: openBlockers.map((b) => ({ id: b.id, title: b.title, detail: b.detail })),
  });
}
