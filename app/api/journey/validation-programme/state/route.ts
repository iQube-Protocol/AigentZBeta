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
import { listReviews } from '@/services/research/independentReviewStore';
import { isReviewerAgreementAuthorized } from '@/services/research/reviewerAgreement';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { VALIDATION_PROGRAMME_JOURNEY, VALIDATION_PROGRAMME_EXPERIMENT_ID } from '@/services/journey/validationProgrammeJourney';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

  // Stage 2 — Crystal Review: has THIS caller's own review decision already
  // been recorded against an EXP-P1 review? Real read, no fabrication — a
  // caller who has only READ the evidence (not yet decided) correctly stays
  // IN_PROGRESS/READY, not COMPLETE.
  let reviewDecisionSubmitted = false;
  if (admin) {
    try {
      const callerRef = personaPublicRef(persona.personaId);
      const reviews = await listReviews(admin, 50);
      reviewDecisionSubmitted = reviews.some(
        (r) =>
          r.request.experimentId === VALIDATION_PROGRAMME_EXPERIMENT_ID &&
          [...r.r1Decisions, ...r.r2Decisions].some((d) => d.reviewerRef === callerRef),
      );
    } catch {
      // Soft-fail — review store unavailable; stage stays evidence-incomplete.
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
      'crystal-review': { reviewDecisionSubmitted },
      'submit-review': { collaborationAgreementAuthorized },
      'experiment-progress': {},
    },
  };

  const runtimeState = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, platformState);

  return NextResponse.json({ ok: true, state: runtimeState, access: accessDiagnosis });
}
