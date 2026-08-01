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
  'These prohibitions hold unless and until a platform admin explicitly authorizes a broader grant — nothing in this package itself expands them.',
];

export async function GET(req: NextRequest) {
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
  const journeyUrl = `${origin}/triad/embed/codex/irl-os?tab=irl-os-validation-programme`;

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
        'Comments, recommendations, and contested-finding flags against the Crystal Readiness Report, Crystal Statistics, and Freeze Recommendation served at crystalReviewEndpoint — deliberated via the QubeTalk channel and, where useful, a supporting document uploaded to the Locker. There is no separate structured reviewer-decision API today: the automated dual-review pipeline (POST /api/research/review, admin-only) is a distinct mechanism from this external-reviewer channel.',
      submissionMechanism:
        'Peer Exchange (QubeTalk) for deliberation, Upload to Locker for supporting documents, and the Invitation section\'s claim mechanics for the collaboration/review agreement and acknowledgement — all inside the Submit Review stage\'s LockerTab render. No separate submission form exists or should be built.',
      prohibitions: PROHIBITIONS,
    },
  });
}
