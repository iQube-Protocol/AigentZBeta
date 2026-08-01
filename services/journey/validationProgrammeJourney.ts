/**
 * The Validation Programme journey — the external reviewer's guided path
 * through EXP-P1 review (operator spec, 2026-08-01: "a single, guided
 * experience that allows an independent reviewer... to complete the review
 * process without needing to understand the internal platform architecture").
 *
 * NOTHING NEW UNDERNEATH — every stage composes an EXISTING, ALREADY-REAL
 * surface (Surface Reuse Principle, PRD-GJR-001 §5.2):
 *
 *   Overview        → the Research Workspace's own 'overview' view
 *                     (services/research/researchWorkspaceViews.ts),
 *                     rendered bare via PartnerProgrammesTab, locked to the
 *                     'autonomi-review-exp-p1' workspace
 *                     (services/research/researchWorkspace.ts) — the exact
 *                     workspace SPEC-IRL-WORKSPACE-001 already names for this
 *                     use case.
 *   Crystal Review  → the real Independent Review / Crystal capability
 *                     (services/research/crystalReadiness.ts,
 *                     crystalStatistics.ts, crystalFreezeRecommendation.ts,
 *                     rendered by IndependentReviewPanel inside
 *                     InvariantExperimentLab), reached via the IRL OS
 *                     Laboratory's Experiments tab. Read access for a scoped
 *                     'reviewer' grant was added 2026-08-01
 *                     (services/passport/participationAccess.ts's
 *                     callerMayReadExperimentReview) — governance actions
 *                     (freeze-preview, accept/revise/defer/reject) remain
 *                     admin/steward-only, unchanged.
 *   Submit Review   → the SAME workspace's 'locker' (agreement/receipt
 *                     artefacts) and 'qubetalk' (scoped discussion, already
 *                     mounts the real QubeTalkInboxTab) views, bare.
 *   Experiment      → the SAME workspace's 'pipeline' (lifecycle stage) and
 *   Progress          'evidence' (Activity/DVN receipts) views, bare.
 *
 * The one genuinely new plumbing is `lockedWorkspaceId` on PartnerProgrammesTab
 * (rendering ONE workspace bare instead of the multi-workspace picker) and
 * this journey's own state resolution — everything a reviewer SEES was
 * already built for SPEC-IRL-WORKSPACE-001's "External Reviewer" role.
 *
 * HONESTY OVER COMPLETENESS (CLAUDE.md "No Guessing"): the Submit Review
 * stage's `collaborationAgreementAuthorized` evidence is declared but not yet
 * computed by the state route — no route today attributes a signed
 * agreement to "this reviewer, for this programme" — so that stage correctly
 * resolves NOT_STARTED/READY, never fabricated as complete, until that
 * wiring lands. Same discipline the Horizen journey's own incremental build
 * used throughout.
 */

import type { JourneyDefinition } from '@/types/journey';

/** The workspace this whole journey is locked to — SPEC-IRL-WORKSPACE-001 §1 use 1. */
export const VALIDATION_PROGRAMME_WORKSPACE_ID = 'autonomi-review-exp-p1';

/** The experiment this journey's reviewer-scoping checks against. */
export const VALIDATION_PROGRAMME_EXPERIMENT_ID = 'EXP-P1';

export const VALIDATION_PROGRAMME_JOURNEY: JourneyDefinition = {
  id: 'validation-programme-exp-p1',
  version: '1.0.0',
  label: 'Validation Programme',
  partner: 'autonomi',
  destination: 'experiment-progress',
  subjectRef: 'external-reviewer',
  stages: [
    {
      id: 'overview',
      label: 'Overview',
      description:
        'What programme this is, why you were invited, EXP-P1’s objective, where the programme stands, and what you are expected to review.',
      actor: 'reviewer',
      subjectRef: 'external-reviewer',
      surfaces: [
        {
          mode: 'component',
          ref: 'validation-programme-overview',
          props: { workspaceDomain: 'research', lockedWorkspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID, initialSurface: 'overview' },
          note:
            "The Research Workspace's own Overview view (researchWorkspaceViews.ts) — purpose, phase, " +
            'institutions, active roles, next action, blockers, decisions, milestones, recent receipts — ' +
            'locked to the autonomi-review-exp-p1 workspace, never a second summary.',
        },
      ],
      prerequisites: [],
      permittedActions: ['view-overview'],
      completionEvidence: ['reviewerAccessConfirmed'],
      receiptTypes: [],
      companion: {
        before:
          'You have been invited to review EXP-P1 for the Autonomi Independent Review Programme. This overview is your starting point.',
        complete:
          'Your reviewer access is confirmed. Continue to Crystal Review when you are ready to inspect the evidence.',
      },
      nextStageId: 'crystal-review',
    },
    {
      id: 'crystal-review',
      label: 'Crystal Review',
      description:
        'Inspect the Crystal Readiness Report, Crystal Statistics, Freeze Recommendation, and review findings. Inspect, analyse, comment, recommend and contest — governance actions remain the operator’s.',
      actor: 'reviewer',
      subjectRef: 'external-reviewer',
      surfaces: [
        {
          mode: 'embed',
          ref: 'validation-programme-crystal-review',
          note:
            'The real IRL OS Laboratory Experiments surface (InvariantExperimentLab, houses ' +
            'IndependentReviewPanel and its Crystal vP1 view) — never a second, reviewer-only fork of ' +
            'the same reports. Freeze/ratify/approve-governance/modify-corpus/change-lifecycle controls ' +
            'do not exist on this surface at all (no route calls freezeArtifact); what a reviewer sees ' +
            'here is exactly what an operator sees, minus nothing to remove.',
        },
      ],
      prerequisites: ['overview'],
      permittedActions: ['comment', 'recommend-change', 'contest-finding'],
      completionEvidence: ['reviewDecisionSubmitted'],
      receiptTypes: [],
      companion: {
        before:
          'The Crystal Readiness Report, Crystal Statistics, and Freeze Recommendation are ready for your review.',
        complete: 'Your review decision is recorded. Continue to Submit Review to complete participation.',
      },
      nextStageId: 'submit-review',
    },
    {
      id: 'submit-review',
      label: 'Submit Review',
      description:
        'Review instructions, the collaboration agreement, and the scoped discussion thread — everything required to complete participation. You sign the participation, review-acknowledgement, and collaboration agreements; the operator performs constitutional governance.',
      actor: 'reviewer',
      subjectRef: 'external-reviewer',
      surfaces: [
        {
          mode: 'component',
          ref: 'validation-programme-locker',
          props: { workspaceDomain: 'research', lockedWorkspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID, initialSurface: 'locker' },
          note:
            "The workspace's own Locker view — frozen, signed, ratified or authoritative artefacts, " +
            'including the collaboration/X409 agreement acceptance already built in LockerTab. Never a ' +
            'second signing UI.',
        },
        {
          mode: 'component',
          ref: 'validation-programme-qubetalk',
          props: { workspaceDomain: 'research', lockedWorkspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID, initialSurface: 'qubetalk' },
          note:
            'The workspace’s own QubeTalk view — mounts the real QubeTalkInboxTab, scoped to this ' +
            'workspace’s channels. Never a rebuilt chat surface.',
        },
      ],
      prerequisites: ['crystal-review'],
      permittedActions: ['accept-participation-agreement', 'accept-review-acknowledgement', 'accept-collaboration-agreement'],
      completionEvidence: ['collaborationAgreementAuthorized'],
      receiptTypes: [],
      companion: {
        before: 'Sign the participation and collaboration agreements to complete your review submission.',
        complete: 'Your review is submitted. The operator will perform any constitutional governance from here.',
      },
      nextStageId: 'experiment-progress',
    },
    {
      id: 'experiment-progress',
      label: 'Experiment Progress',
      description:
        'Programme tracking: crystal frozen, experiment preparing, experiment running, results available, replication status.',
      actor: 'reviewer',
      subjectRef: 'external-reviewer',
      surfaces: [
        {
          mode: 'component',
          ref: 'validation-programme-pipeline',
          props: { workspaceDomain: 'research', lockedWorkspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID, initialSurface: 'pipeline' },
          note: "The workspace's own Pipeline view — the lifecycle template's stages, current stage marked.",
        },
        {
          mode: 'component',
          ref: 'validation-programme-activity',
          props: { workspaceDomain: 'research', lockedWorkspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID, initialSurface: 'evidence' },
          note: "The workspace's own Activity view — consequential events and DVN receipts.",
        },
      ],
      prerequisites: ['submit-review'],
      permittedActions: ['view-progress'],
      // No completion state for a trailing, informational stage — there is
      // nothing further for the reviewer to DO here; it only ever tracks.
      completionEvidence: [],
      receiptTypes: [],
      companion: {
        before: 'Track EXP-P1’s progress here — crystal freeze, experiment run, results, and replication.',
        complete: 'EXP-P1 has completed. Your reviewer package and the published results are available here.',
      },
    },
  ],
};
