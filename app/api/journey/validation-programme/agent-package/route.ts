/**
 * GET /api/journey/validation-programme/agent-package
 *
 * The JSON Agent Package for the Validation Programme (operator instruction
 * 2026-08-01, Phase 2) — a machine-readable onboarding manifest for an
 * invited external reviewer's OWN delegated agent, distinct from the "Download
 * JSON for Agent" button on the Crystal Review stage (which downloads one
 * crystal domain's report; this route describes the whole programme). Every
 * field below is EITHER a real, already-reachable endpoint/resource, OR an
 * honest statement that no such endpoint exists yet (CLAUDE.md "No
 * Guessing") — nothing here is fabricated to look more complete than the
 * platform actually is.
 *
 * Same gate as the journey's own state route and the Crystal Review endpoint
 * it points to: admin, OR a persona holding a research-lab grant in a role
 * the Review workspace view admits, scoped to EXP-P1
 * (`callerMayReadExperimentReview`). This route reads only — it never writes,
 * freezes, ratifies, or executes anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { callerMayReadExperimentReview, resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { RESEARCH_WORKSPACE_ROLE_AUTHORITY, type ResearchWorkspaceRoleId } from '@/services/research/researchWorkspaceRoles';
import { getResearchWorkspace, researchWorkspaceParent, researchWorkspaceExperiment, researchWorkspaceLabel } from '@/services/research/researchWorkspace';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import { reviewerAgreementStatus, CONSENT_BINDS_EXACT_TERMS } from '@/services/research/reviewerAgreement';
import { getArtifact } from '@/services/research/artifacts';
import { observerRoundId, getObserverRound } from '@/services/research/observerReviewStore';
import { resolveObserverRound, OBSERVER_DECISION_KINDS } from '@/services/research/crystalObserverReview';
import {
  VALIDATION_PROGRAMME_JOURNEY,
  VALIDATION_PROGRAMME_WORKSPACE_ID,
  VALIDATION_PROGRAMME_EXPERIMENT_ID,
  isExpP1Path,
} from '@/services/journey/validationProgrammeJourney';

export const dynamic = 'force-dynamic';

/** Reads col_experiments from the real collections.json and returns EXP-P1's own items — never a hand-copied list. */
async function resolveExpP1DocumentResources(origin: string): Promise<Array<{ path: string; url: string }>> {
  try {
    const raw = await corpusReadPackFile('irl', 'collections.json');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { collections?: Array<{ id: string; items?: string[] }> };
    const collection = parsed.collections?.find((c) => c.id === 'col_experiments');
    const items = (collection?.items ?? []).filter(isExpP1Path);
    return items.map((p) => ({ path: p, url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(p)}` }));
  } catch {
    return [];
  }
}

const PROHIBITIONS = [
  'No governance actions: this reviewer and their agent may not freeze, ratify, or perform any accept/revise/defer/reject resolution on a review record.',
  'No corpus mutation: the invariant canon, CFS corpus, and source assets under review may not be edited by this reviewer or their agent.',
  'No standing changes: Standing is granted only through the platform\'s own verified-contribution pipeline, never by an act of authority this role holds.',
  'No experiment execution: EXP-P1 may not be run, re-run, or have its parameters changed by this reviewer or their agent.',
  'No additional observer vote: a delegated agent may analyse the frozen crystal and submit attributable evidence alongside a decision (submittedByAgentRef), but the decision is recorded under the human reviewer\'s own persona alone — an agent never creates a second vote, and only a research-steward or principal-investigator may resolve a change proposal.',
  'These prohibitions hold unless and until a platform admin explicitly authorizes a broader grant — nothing in this package itself expands them.',
];

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
  const reviewerAccessConfirmed =
    isAdmin || (admin ? await callerMayReadExperimentReview(admin, persona.personaId, VALIDATION_PROGRAMME_EXPERIMENT_ID) : false);

  if (!reviewerAccessConfirmed) {
    return NextResponse.json({ ok: false, error: 'Not authorized to read this programme' }, { status: 403 });
  }

  const grant = admin ? await resolveExperimentReviewGrant(admin, persona.personaId, VALIDATION_PROGRAMME_EXPERIMENT_ID) : null;
  // The caller's own agreement standing — one projection, shared with the
  // human panel, so the package and the UI never disagree.
  const agreementStatus = admin
    ? await reviewerAgreementStatus(admin, {
        personaId: persona.personaId,
        experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID,
      })
    : null;
  const authority =
    grant && grant.role in RESEARCH_WORKSPACE_ROLE_AUTHORITY
      ? RESEARCH_WORKSPACE_ROLE_AUTHORITY[grant.role as ResearchWorkspaceRoleId]
      : null;

  const origin = resolveRequestOrigin(req);
  const experimentWorkspace = getResearchWorkspace(VALIDATION_PROGRAMME_WORKSPACE_ID);
  const programmeWorkspace = experimentWorkspace ? researchWorkspaceParent(experimentWorkspace) : null;
  const experiment = experimentWorkspace ? researchWorkspaceExperiment(experimentWorkspace) : null;

  const documentResources = await resolveExpP1DocumentResources(origin);

  // No personaId query param here (unlike an in-app buildCodexUrl link, which
  // is fine for the OWNER's own browser tab navigation): this manifest is a
  // machine-readable document that may be cached, logged, or handed to a
  // delegated agent — the T0 "never serialise personaId to JSON" boundary
  // this route otherwise honours (personaRef below) applies to it too. The
  // reviewer's own session resolves their identity when they open this link.
  /*
   * Read the crystal's own readiness to decide whether it is a review SUBJECT.
   * Failure here must not fabricate reviewability — an unreadable crystal is
   * reported as unknown, and unknown is not "ready to review".
   */
  let crystalSubject: {
    reviewable: boolean;
    milestone: string;
    statement: string;
    guidance: string;
  };
  try {
    const { runCrystalFreezeRecommendation } = await import('@/services/research/crystalFreezeRecommendation');
    const { crystalMilestone, isReviewableScientificObject, EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT } = await import(
      '@/services/research/crystalDomains'
    );
    const rec = await runCrystalFreezeRecommendation({ experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID });
    const invariantCount = rec.readiness?.invariantCount ?? 0;
    const milestone = crystalMilestone({ invariantCount });
    const reviewable = isReviewableScientificObject({ invariantCount });
    crystalSubject = {
      reviewable,
      milestone: milestone.label,
      statement: milestone.statement,
      guidance: reviewable
        ? 'The crystal holds invariants and is a reviewable scientific object. Assess it.'
        : EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT,
    };
  } catch (e) {
    crystalSubject = {
      reviewable: false,
      milestone: 'Unknown',
      statement: `The crystal's readiness could not be read (${e instanceof Error ? e.message : String(e)}).`,
      guidance:
        'Could not determine whether there is anything to review. This is not a statement that the crystal is ' +
        'empty, and it is not permission to proceed as though it were populated. Re-read before assessing.',
    };
  }

  const journeyUrl = `${origin}/triad/embed/codex/irl-os?tab=irl-os-validation-programme`;

  /*
   * THE OBSERVER REVIEW PACKAGE, HASH-BOUND TO WHAT WAS ACTUALLY FROZEN
   * (Post-Freeze Observer Review Closure, point 9, 2026-08-09).
   *
   * Extends this package with the exact frozen artifact/package hash, the
   * decision schema, and the submission endpoint — SEPARATE from the
   * automated dual-model R1/R2 pipeline `expectedReviewOutput` below still
   * (correctly) says nothing structured exists for. This block is null,
   * honestly, until the crystal is frozen and a round has been assigned; a
   * delegated agent reading this before then must not be told a package
   * exists that does not.
   */
  let observerReview: {
    packageHash: string;
    roundPolicy: string;
    assignedObserverRefs: string[];
    resolution: ReturnType<typeof resolveObserverRound> | null;
    decisionSubmissionEndpoint: string;
    decisionSchema: Record<string, unknown>;
    changeProposalEndpoint: string;
  } | null = null;
  try {
    const artifact = await getArtifact(VALIDATION_PROGRAMME_EXPERIMENT_ID, 'crystal-version');
    if (artifact?.lifecycle === 'frozen' && admin) {
      const round = await getObserverRound(admin, observerRoundId(VALIDATION_PROGRAMME_EXPERIMENT_ID, artifact.id));
      if (round?.package) {
        observerReview = {
          packageHash: round.package.packageHash,
          roundPolicy: round.package.roundPolicy,
          assignedObserverRefs: [...round.package.assignedObserverRefs],
          resolution: resolveObserverRound({ pkg: round.package, decisions: round.decisions }),
          decisionSubmissionEndpoint: `${origin}/api/research/observer-review/${VALIDATION_PROGRAMME_EXPERIMENT_ID}/decision`,
          decisionSchema: {
            decision: OBSERVER_DECISION_KINDS,
            rationale: 'string, required',
            evidenceRefs: 'string[], optional',
            submittedByAgentRef:
              'string, optional — records that a delegated agent assisted; the decision is still attributed to ' +
              'the calling persona alone and never creates an additional vote',
            proposedChange: "string, required only when decision === 'changes_requested'",
          },
          changeProposalEndpoint: `${origin}/api/research/observer-review/${VALIDATION_PROGRAMME_EXPERIMENT_ID}/change-proposal`,
        };
      }
    }
  } catch {
    observerReview = null;
  }

  return NextResponse.json({
    ok: true,
    package: {
      programme: {
        id: programmeWorkspace?.id ?? null,
        title: programmeWorkspace?.title ?? null,
        description: programmeWorkspace?.description ?? null,
        institutionRefs: programmeWorkspace?.institutionRefs ?? [],
      },
      experiment: {
        id: VALIDATION_PROGRAMME_EXPERIMENT_ID,
        workspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID,
        label: experimentWorkspace ? researchWorkspaceLabel(experimentWorkspace) : VALIDATION_PROGRAMME_EXPERIMENT_ID,
        family: experiment?.family ?? null,
        hypothesis: experiment?.hypothesis ?? null,
        currentStage: experimentWorkspace?.currentStage ?? null,
      },
      reviewer: {
        // T2-safe commitment reference — the caller's raw personaId never
        // leaves this route (same discipline as every DVN/chain-bound
        // identifier in this codebase).
        personaRef: personaPublicRef(persona.personaId),
        role: grant?.role ?? (isAdmin ? 'admin-preview' : null),
        allowedExperiments: grant?.allowedExperiments ?? (isAdmin ? 'all' : []),
        note: isAdmin && !grant
          ? 'Admin preview — this caller holds platform admin rights, not a scoped research-lab grant. An invited reviewer\'s real grant will show a role from access_grants instead.'
          : null,
      },
      // The reviewer substrate role's authority ceiling (services/research/
      // researchWorkspaceRoles.ts) — the SAME table every workspace surface
      // is gated against server-side, never a second hand-typed summary of it.
      // null only for an admin-preview caller with no scoped grant to project.
      permittedAuthority: authority,
      stages: VALIDATION_PROGRAMME_JOURNEY.stages.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        permittedActions: s.permittedActions,
        completionEvidence: s.completionEvidence,
      })),
      // One journey URL — stage selection is an in-app stepper
      // (components/journey/JourneyRunSurface.tsx), not a per-stage deep
      // link, so this package reports that honestly rather than inventing
      // four URLs that would not actually navigate anywhere on load.
      journeyUrl,
      documentResources,
      crystalReviewEndpoint: `${origin}/api/research/crystal/${VALIDATION_PROGRAMME_EXPERIMENT_ID}`,
      /*
       * IS THERE ANYTHING TO REVIEW? (operator ruling, 2026-08-02)
       *
       *   > "I would not include the current empty readiness package in the
       *   >  material sent to Austin except as historical provenance … It is
       *   >  honest, but it is not yet a reviewable scientific object."
       *
       * The endpoint above is real and will answer. What it currently answers
       * ABOUT is an unpopulated domain — a truthful pre-Track-2 baseline, and
       * not something an external reviewer can produce a finding on. An agent
       * that fetched it without this field would set to work assessing an
       * empty set, which is our unfinished work spending their attention.
       *
       * Derived, never asserted: the moment Track 2 populates the domain this
       * flips on its own, with nothing here to update.
       */
      crystalSubject,
      reviewQueueEndpoint: `${origin}/api/research/review`,
      /*
       * The reviewer's OWN agreement standing (operator ruling, 2026-08-02).
       *
       * Built from `reviewerAgreementStatus`, the same projection the human
       * panel renders and the same gate that admits or refuses a submission —
       * so an agent reading this JSON and a human reading the panel cannot
       * reach different conclusions about whether the reviewer may submit.
       *
       * `canonicalHash` vs `authorizedHash` is the load-bearing pair: consent
       * authorizes exact terms, so a reviewer whose stored hash no longer
       * matches the current one has NOT consented to what is in front of them
       * now, however recently they authorized.
       */
      agreement: agreementStatus
        ? {
            id: agreementStatus.agreementId,
            version: agreementStatus.version,
            canonicalHash: agreementStatus.canonicalHash,
            authorizationStatus: agreementStatus.authorizationStatus,
            authorizedHash: agreementStatus.authorizedHash,
            hashMatch: agreementStatus.hashMatch,
            requiresReauthorization: agreementStatus.requiresReauthorization,
            authorizedAt: agreementStatus.authorizedAt,
            conflictDeclared: agreementStatus.conflictDeclared,
            message: agreementStatus.message,
            // The reviewer authorizes a canonical agreement VERSION; the
            // stored row is the auditable evidence of that act, not its
            // object. Stated so no agent describes it the other way round.
            consentModel: CONSENT_BINDS_EXACT_TERMS,
            authorizeEndpoint: `${origin}/api/research/reviewer-agreement`,
          }
        : {
            authorizationStatus: 'unavailable',
            message:
              'Agreement status could not be read on this request. This does not affect any authorization already given.',
          },
      agreementAndAcknowledgement: {
        mechanism:
          'Programme ACCESS is claimed through the Locker\'s x409/access-invitation claim (LockerTab, Invitation section). The Independent Reviewer AGREEMENT is a separate, canonical, experiment-scoped act with its own endpoint and its own durable record — see the `agreement` block above. The two are distinct: claiming an invitation admits you to the programme; authorizing the agreement is what permits a review SUBMISSION.',
        claimAccessInvitationEndpoint: `${origin}/api/participation/claim`,
        reviewerAgreementEndpoint: `${origin}/api/research/reviewer-agreement`,
        claimAgreementEndpoint: `${origin}/api/polity-passport/locker/claim-agreement`,
        lockerReadEndpoint: `${origin}/api/polity-passport/locker`,
      },
      qubetalk: {
        channelsEndpoint: `${origin}/api/qubetalk/passport-channels`,
        note:
          'Persona-scoped citizen ↔ delegated-agent channels — populated once the reviewer has claimed their invitation and a delegation exists. No workspace-wide channel id exists separately from this.',
      },
      expectedReviewOutput:
        'Pre-freeze: comments, recommendations, and contested-finding flags against the Crystal Readiness Report, ' +
        'Crystal Statistics, and Freeze Recommendation served at crystalReviewEndpoint — deliberated via the ' +
        'QubeTalk channel and, where useful, a supporting document uploaded to the Locker. Post-freeze: a ' +
        'structured Observer Decision against the frozen crystal — see the `observerReview` block below. The ' +
        'automated dual-review pipeline (POST /api/research/review, admin-only) remains a distinct mechanism ' +
        'from both of these.',
      submissionMechanism:
        'Pre-freeze deliberation: Peer Exchange (QubeTalk) and Upload to Locker, inside the Submit Review ' +
        'stage\'s LockerTab render. Post-freeze structured decision (Post-Freeze Observer Review Closure, ' +
        '2026-08-09): POST to `observerReview.decisionSubmissionEndpoint` — see the `observerReview` block below ' +
        'for the exact schema. The collaboration/review agreement and acknowledgement remain the Invitation ' +
        'section\'s claim mechanics.',
      /*
       * SPEC point 9 — the exact frozen artifact/package hash, decision
       * schema, and submission endpoint. `null` until the crystal is frozen
       * and a round has been assigned — never fabricated.
       */
      observerReview,
      prohibitions: PROHIBITIONS,
    },
  });
}
