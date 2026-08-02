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
import {
  crystalReviewStageStatus,
  crystalDomainForExperiment,
  crystalMilestone,
  isReviewableScientificObject,
  crystalLifecycleStage,
} from '@/services/research/crystalDomains';

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

  // ── RESPONSE SHAPE CORRECTIONS (operator ruling, 2026-08-02) ────────────
  //
  // 1. `ok: true` meant "the HTTP request succeeded" and was read as "the
  //    crystal is okay" — while every substantive component underneath
  //    reported `ok: false`. A reader (human or agent) cannot be expected to
  //    resolve that contradiction, so the field is renamed to say only what
  //    it actually means, and a SEPARATE field answers the question that was
  //    being mistakenly read off it.
  //
  // 2. `readiness` and `statistics` were emitted at the top level AND again
  //    nested inside `recommendation` — the same failures repeated across
  //    `checks`, `rationale`, `remainingRisks` and the nested copy. Two
  //    copies of one fact is two things to diverge, so `recommendation` now
  //    REFERENCES the canonical objects instead of embedding them.
  //
  // 3. `statistics.frozenHash` is a content commitment over the corpus as it
  //    stands right now — NOT evidence of a constitutional freeze. Emitting
  //    that word beside "NOT_READY" invited exactly the wrong inference, so
  //    it is surfaced as `candidateContentHash` until a real freeze receipt
  //    exists. (The service's own field keeps its name; this is the wire
  //    contract, where the confusion happened.)
  const { readiness, statistics, ...recommendationWithoutCopies } = recommendation;
  const statisticsForWire = statistics
    ? (() => {
        const { frozenHash, ...restOfStatistics } = statistics as typeof statistics & { frozenHash?: string };
        return { ...restOfStatistics, candidateContentHash: frozenHash };
      })()
    : statistics;

  // The one question a reviewer actually needs answered: is there something
  // here worth reviewing? Never inferred from transport success.
  const reviewPackageReady = Boolean(readiness?.ok && statistics?.ok && recommendation?.ok);

  return NextResponse.json(
    {
      requestSucceeded: true,
      reviewPackageReady,
      crystalStatus: 'candidate',
      /*
       * ASSESSED vs DOMAIN_UNPOPULATED, hoisted to the top of the payload
       * (operator report, 2026-08-02).
       *
       * Nine failing checks over an empty domain read as nine defects in the
       * crystal. They are not: they are the checks correctly declining to
       * certify a set with nothing in it. A reader — human or agent — who
       * meets the failures before the reason draws the wrong conclusion, and
       * an external reviewer is precisely the reader we cannot afford to
       * mislead about whether the work is broken or merely not yet done.
       */
      assessability: recommendation.assessability,
      /*
       * The milestone, hoisted beside assessability (operator, 2026-08-02).
       *
       * Zero counts over a ratified-but-unpopulated boundary read as a broken
       * crystal to anyone who meets the numbers before the reason. Three of
       * four things are done; the fourth has not been attempted. The statement
       * says which, and `advancedBy` says what moves it — never a code change.
       */
      milestone: crystalMilestone({ invariantCount: readiness?.invariantCount ?? 0 }),
      /*
       * THE LIFECYCLE STAGE, not a readiness verdict (operator, 2026-08-02).
       *
       *   > "The UI currently says: Not Ready. What it should really say is:
       *   >  Candidate Crystal not yet constituted … The current wording makes
       *   >  you think you've done something wrong."
       *
       * NOT_READY is a verdict about an object that exists. Over an empty
       * domain it answers a question nobody asked, in the register of failure —
       * and it hid that the outstanding work is SCIENTIFIC (corpus
       * construction) while the surface was offering a GOVERNANCE act (freeze).
       * `remainingWorkKind` is what a surface reads before offering a
       * ratification affordance.
       *
       * `frozen`/`canonical` are not inferred from readiness: passing checks
       * is not a freeze, and treating it as one is the exact conflation the
       * lifecycle separation exists to prevent. They default false until a
       * real freeze receipt is threaded through.
       */
      lifecycle: crystalLifecycleStage({
        domainRatified: crystalDomainForExperiment(experimentId)?.ratification === 'ratified',
        invariantCount: readiness?.invariantCount ?? 0,
        readinessOk: Boolean(readiness?.ok),
      }),
      /*
       * Honest and reviewable are different properties. An empty package is a
       * truthful baseline and belongs in the research bundle as provenance; it
       * is not something an external reviewer can produce a finding about.
       */
      reviewableScientificObject: isReviewableScientificObject({
        invariantCount: readiness?.invariantCount ?? 0,
      }),
      /*
       * Which milestone this actually is (operator ruling, 2026-08-02, revised).
       *
       *   > "I would declare the current milestone as: Internal Readiness. Not
       *   > External Review."
       *
       * The originating team completes its own work before independent review
       * begins. So the Crystal Review stage stays PREPARING_CANDIDATE until a
       * NON-EMPTY candidate has passed intrinsic readiness — and no reviewer is
       * asked to assess or recommend a freeze before then. `reviewRequestOpen`
       * is the flag any invitation path must consult; it is derived, never set.
       */
      reviewStage: crystalReviewStageStatus({
        invariantCount: readiness?.invariantCount ?? 0,
        readinessOk: Boolean(readiness?.ok),
      }),
      crystalDomainDeclaration: crystalDomainForExperiment(experimentId),
      ...(recommendation.unpopulatedProvenance
        ? { unpopulatedProvenance: recommendation.unpopulatedProvenance }
        : {}),
      experimentId,
      crystalDomain: recommendation.crystalDomain,
      readiness,
      statistics: statisticsForWire,
      // No nested readiness/statistics — see note 2 above.
      recommendation: recommendationWithoutCopies,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
