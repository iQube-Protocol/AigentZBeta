/**
 * POST /api/ops/research/bootstrap-exp-p1-observer-round
 *
 * EXP-P1 go-live bootstrap (operator instruction, 2026-08-09): closes the
 * manual operational trap where an agent had to shuttle Austin/Avi's opaque
 * T2 persona references around by hand to assign the Observer Review round.
 * The operator already made the constitutional decision when granting
 * `research-lab` / `reviewer` / `allowed_experiments ⊇ EXP-P1` — this route
 * derives the round's reviewer cohort from THAT server-side state and calls
 * the EXISTING assignment implementation (`assignObserverRound`, also used
 * by `POST /api/research/observer-review/[experimentId]`). No new review
 * semantics: this is an ops/admin WRAPPER around one existing mechanism, not
 * a second one.
 *
 * Auth: admin persona OR CRON_TRIGGER_TOKEN (services/ops/opsAuth.ts — the
 * same dual-path convention every other /api/ops/** mutation route uses).
 *
 * Idempotent: re-running after the cohort/round already matches is a no-op
 * at the package-hash level (`assignObserverRound`'s own guarantee) — safe
 * to call repeatedly, including from the invitation-claim regression guard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOpsAuth } from '@/services/ops/opsAuth';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { listActiveReviewerPersonaIds } from '@/services/passport/participationAccess';
import { pinnedObserverRoundPolicy } from '@/services/research/crystalObserverReview';
import { assignObserverRound } from '@/services/research/observerRoundAssignment';

const EXPERIMENT_ID = 'EXP-P1';
const REQUIRED_REVIEWER_COUNT = 2;

export async function POST(req: NextRequest) {
  const auth = await requireOpsAuth(req);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Store unavailable' }, { status: 503 });

  // 1. Resolve the two reviewers server-side, from the grants the operator
  // already issued — never a manually-supplied ref list.
  const personaIds = await listActiveReviewerPersonaIds(admin, EXPERIMENT_ID);
  if (personaIds.length !== REQUIRED_REVIEWER_COUNT) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Expected exactly ${REQUIRED_REVIEWER_COUNT} active research-lab 'reviewer' grant(s) scoped to ${EXPERIMENT_ID}, ` +
          `found ${personaIds.length}. Not assigning — this route requires exactly ${REQUIRED_REVIEWER_COUNT} distinct reviewers.`,
        activeReviewerCount: personaIds.length,
      },
      { status: 409 },
    );
  }
  const observerRefs = personaIds.map((id) => personaPublicRef(id));

  // 2. Assign against the current frozen crystal, through the EXISTING
  // assignment implementation — pinned policy honoured, never overridden.
  const persona = await getActivePersona(req).catch(() => null);
  const result = await assignObserverRound(admin, {
    experimentId: EXPERIMENT_ID,
    observerRefs,
    requestedRoundPolicy: pinnedObserverRoundPolicy(EXPERIMENT_ID) ?? 'all-assigned',
    actorPersonaId: persona?.personaId ?? null,
    createdAt: new Date().toISOString(),
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

  return NextResponse.json({
    ok: true,
    roundId: result.round.roundId,
    packageHash: result.round.package?.packageHash ?? null,
    roundPolicy: result.round.roundPolicy,
    assignedObserverCount: result.round.assignedObserverRefs.length,
    created: result.created,
  });
}
