/**
 * GET /api/research/crystal/[experimentId] — Crystal Readiness Report +
 * Crystal Statistics Report + Freeze Recommendation for one crystal domain
 * (CFS-054 / PRD-EPI-001 §3.1 Workstreams 2–4). Read-only.
 *
 * Admits a platform admin (unchanged), OR (added for the Validation
 * Programme's reviewer-facing Crystal Review stage, SPEC-IRL-WORKSPACE-001
 * §8/§12) a persona holding an active research-lab grant, in a role the
 * Review workspace view admits, scoped to THIS experimentId
 * (`callerMayReadExperimentReview` — services/passport/participationAccess.ts,
 * the one place that check lives). This route still NEVER writes anything and
 * NEVER freezes anything — three read-only reports composed into one payload.
 * `freeze-preview` (the sibling route) is deliberately NOT extended the same
 * way: previewing a freeze ceremony package is governance rehearsal, which
 * the reviewer role's authority table (researchWorkspaceRoles.ts) withholds
 * (`mayFreeze: false`) even though reading readiness evidence is permitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callerMayReadExperimentReview } from '@/services/passport/participationAccess';
import { runCrystalFreezeRecommendation } from '@/services/research/crystalFreezeRecommendation';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { experimentId } = await params;

  if (!persona.cartridgeFlags?.isAdmin) {
    const admin = getSupabaseServer();
    const scoped = admin ? await callerMayReadExperimentReview(admin, persona.personaId, experimentId) : false;
    if (!scoped) {
      return NextResponse.json({ ok: false, error: 'Steward or assigned-reviewer access required' }, { status: 403 });
    }
  }
  const crystalDomain = req.nextUrl.searchParams.get('domain') ?? undefined;

  const recommendation = await runCrystalFreezeRecommendation({ experimentId, crystalDomain });

  return NextResponse.json(
    {
      ok: true,
      experimentId,
      crystalDomain: recommendation.crystalDomain,
      readiness: recommendation.readiness,
      statistics: recommendation.statistics,
      recommendation,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
