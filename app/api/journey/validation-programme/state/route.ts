/**
 * GET /api/journey/validation-programme/state
 *
 * Assembles the AuthoritativePlatformState for the Validation Programme
 * Guided Journey (services/journey/validationProgrammeJourney.ts) from real
 * reads, then resolves it via resolveJourneyState() — same shape as
 * /api/journey/moneypenny-horizen/state.
 *
 * `collaborationAgreementAuthorized` (Submit Review) is now REAL (operator
 * ruling, 2026-08-02). It was previously left deliberately absent because no
 * route attributed a signed agreement to "this reviewer, for this programme";
 * `services/research/reviewerAgreement.ts` is now that attribution, and this
 * route derives the stage from its durable authorization row — matching
 * principal, experiment, agreement id+version, current terms hash and package
 * scope — never from a visit or a UI boolean.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import {
  diagnoseExperimentReviewAccess,
  type ExperimentReviewAccessDiagnosis,
} from '@/services/passport/participationAccess';
import { getArtifact } from '@/services/research/artifacts';
import { observerRoundId, getObserverRound } from '@/services/research/observerReviewStore';
import { isReviewerAgreementAuthorized } from '@/services/research/reviewerAgreement';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { VALIDATION_PROGRAMME_JOURNEY, VALIDATION_PROGRAMME_EXPERIMENT_ID } from '@/services/journey/validationProgrammeJourney';

export const dynamic = 'force-dynamic';

/*
 * EVERY EXIT IS A NAMED ANSWER (operator, 2026-08-03, on the third report of
 * `Unexpected end of JSON input`).
 *
 * An unanticipated throw here — a Supabase client error, a partner socket
 * dropped, an import that fails at runtime — left the platform to answer, and
 * what it sends is not guaranteed to be JSON and can be nothing at all. A
 * thrown error is still information; discarding it and returning silence is
 * the defect. Enforced across every journey route by
 * tests/journey-response-honesty.test.ts.
 */
export async function GET(req: NextRequest) {
  try {
    return await getImpl(req);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function getImpl(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const admin = getSupabaseServer();
  const isAdmin = !!persona.cartridgeFlags?.isAdmin;

  // Stage 1 — Overview: does this caller reach EXP-P1's review at all? An
  // admin previewing the programme also counts (matches the crystal route's
  // own admin-or-scoped-reviewer rule).
  //
  // The DIAGNOSIS (not just the boolean) rides along in the response so the
  // journey surface can render a true, actionable status — "your grant is
  // research-participant, which cannot read reviews" is a different situation
  // from "you have not claimed your invitation yet" and from "we could not
  // check". Collapsing all three into one red banner is what produced the
  // simultaneous green "Access granted" / red "unauthorized" contradiction
  // (operator ruling, 2026-08-02).
  let accessDiagnosis: ExperimentReviewAccessDiagnosis;
  if (isAdmin) {
    accessDiagnosis = { mayRead: true, reason: 'granted', heldRoles: ['platform-admin'], reachableExperiments: 'all' };
  } else if (admin) {
    accessDiagnosis = await diagnoseExperimentReviewAccess(
      admin,
      persona.personaId,
      VALIDATION_PROGRAMME_EXPERIMENT_ID,
    );
  } else {
    // No store at all — UNKNOWN, never "denied".
    accessDiagnosis = { mayRead: false, reason: 'unavailable', heldRoles: [], reachableExperiments: [] };
  }
  const reviewerAccessConfirmed = accessDiagnosis.mayRead;

  /*
   * Stage 2 — Crystal Review: has THIS caller submitted their OWN Post-Freeze
   * Observer Decision (Post-Freeze Observer Review Closure, point 5) against
   * the current Observer Review round?
   *
   * PRIOR DEFECT, FIXED HERE (2026-08-09): this used to check the caller's
   * ref against `r1Decisions`/`r2Decisions` — the AUTOMATED dual-model
   * pipeline's reviewer slots, which belong to a completely different
   * mechanism (services/research/review/adjudication.ts) than an external
   * human observer's own decision on a FROZEN crystal. A caller could never
   * genuinely satisfy that check by doing the thing this stage actually asks
   * of them, and a caller who somehow matched an R1/R2 ref would have this
   * stage read COMPLETE for a decision they never made. Reads the real
   * Observer Review round instead (services/research/observerReviewStore.ts) —
   * no round or no artifact yet correctly stays evidence-incomplete.
   */
  let observerDecisionSubmitted = false;
  if (admin) {
    try {
      const callerRef = personaPublicRef(persona.personaId);
      const artifact = await getArtifact(VALIDATION_PROGRAMME_EXPERIMENT_ID, 'crystal-version');
      if (artifact) {
        const round = await getObserverRound(admin, observerRoundId(VALIDATION_PROGRAMME_EXPERIMENT_ID, artifact.id));
        observerDecisionSubmitted = Boolean(round?.decisions.some((d) => d.observerRef === callerRef));
      }
    } catch {
      // Soft-fail — observer round store unavailable; stage stays evidence-incomplete.
    }
  }

  // Stage 3 — Submit Review: is the caller's Independent Reviewer Agreement
  // authorization ACTIVE for EXP-P1, at the current agreement version and
  // terms hash? Derived from the durable authorization row
  // (`reviewer_agreement_authorizations`), never from a visit, a button click
  // or a mutable UI boolean — the ruling's explicit requirement. A historical
  // authorization for another experiment, or for a materially changed
  // (re-hashed) version, does not satisfy it.
  let collaborationAgreementAuthorized = false;
  if (admin) {
    try {
      collaborationAgreementAuthorized = await isReviewerAgreementAuthorized(
        admin,
        persona.personaId,
        VALIDATION_PROGRAMME_EXPERIMENT_ID,
      );
    } catch {
      // Soft-fail — stage stays evidence-incomplete, never fabricated complete.
    }
  }

  const platformState: AuthoritativePlatformState = {
    stages: {
      overview: { reviewerAccessConfirmed },
      'crystal-review': { observerDecisionSubmitted },
      'submit-review': { collaborationAgreementAuthorized },
      'experiment-progress': {},
    },
  };

  const runtimeState = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, platformState);

  return NextResponse.json({ ok: true, state: runtimeState, access: accessDiagnosis });
}
