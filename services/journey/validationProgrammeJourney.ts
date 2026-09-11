/**
 * The Validation Programme journey — the external reviewer's guided path
 * through EXP-P1 review (operator spec, 2026-08-01: "a single, guided
 * experience that allows an independent reviewer... to complete the review
 * process without needing to understand the internal platform architecture").
 *
 * NOTHING NEW UNDERNEATH — every stage composes an EXISTING, ALREADY-REAL
 * surface (Surface Reuse Principle, PRD-GJR-001 §5.2):
 *
 *   Overview        → the real Protocols & Articles surface (the IRL OS
 *                     Laboratory's own irl-os-protocols tab: AgentiqCartridgeTab
 *                     over packId 'irl', collectionId 'col_experiments'),
 *                     rendered bare and filtered via pathFilter to EXP-P1's own
 *                     documents only (operator instruction 2026-08-01, point 3)
 *                     — never a rebuilt document viewer or a second summary.
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
 *   Submit Review   → the real LockerTab, rendered directly with visibleSections
 *                     limited to Peer Exchange, Upload to Locker, and
 *                     Invitation (operator instruction 2026-08-01, point 5) —
 *                     never a second signing UI; the Invitation section's
 *                     existing x409/access-invitation claim mechanics ARE the
 *                     collaboration/review agreement signing surface.
 *   Experiment      → the SAME workspace's 'pipeline' (lifecycle stage) and
 *   Progress          'evidence' (Activity/DVN receipts) views, bare.
 *
 * The one genuinely new plumbing is `lockedWorkspaceId` on PartnerProgrammesTab
 * (rendering ONE workspace bare instead of the multi-workspace picker, still
 * used by Experiment Progress) and this journey's own state resolution —
 * everything a reviewer SEES was already built for SPEC-IRL-WORKSPACE-001's
 * "External Reviewer" role.
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

/**
 * The col_experiments path segment every EXP-P1 document lives under. Exported
 * so both the Overview stage's pathFilter (below) and the JSON Agent Package
 * route (app/api/journey/validation-programme/agent-package/route.ts) list
 * the SAME document set from ONE source, never two hand-maintained filters.
 */
export const EXP_P1_PATH_SEGMENT = 'exp-p1-representation-runtime-gauntlet';

/** EXP-P1's own documents only, nothing else in col_experiments. */
export const isExpP1Path = (path: string): boolean => path.includes(EXP_P1_PATH_SEGMENT);

export const VALIDATION_PROGRAMME_JOURNEY: JourneyDefinition = {
  id: 'validation-programme-exp-p1',
  version: '1.0.0',
  label: 'Validation Programme',
  partner: 'autonomi',
  destination: 'experiment-progress',
  subjectRef: 'external-reviewer',
  // Journey Runtime copilot invariant (item 1, 2026-08-25) — resolves to
  // the existing IRL OS Guide (data/codex-configs.ts's
  // IRL_CARTRIDGE.copilot: aigent-researcher / "IRL Guide" / violet), the
  // same cartridge this journey's own Reviewer/Records surfaces already
  // embed into.
  copilot: { cartridgeSlug: 'irl-cartridge' },
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
          props: {
            packId: 'irl',
            collectionId: 'col_experiments',
            defaultPath: `foundation/experiments/${EXP_P1_PATH_SEGMENT}/README.md`,
            pathFilter: isExpP1Path,
          },
          note:
            "The real Protocols & Articles surface (irl-os-protocols tab's own AgentiqCartridgeTab " +
            'instance, packId/collectionId unchanged) filtered to EXP-P1’s own documents — README, ' +
            'STAGE-0 handoff, Crystal enlargement plan, Crystal canon charter — never a second summary ' +
            'or a rebuilt viewer.',
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
          mode: 'component',
          ref: 'validation-programme-crystal-review',
          props: { experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID },
          note:
            'CrystalObserverReviewPanel — the ONE canonical Workspace Review flow for this workspace ' +
            '(Post-Freeze Observer Review Closure, 2026-08-09, points 2/10). Composes the existing ' +
            'read-only Crystal vP1 projection with the new self-service Observer Decision submission. ' +
            'Replaces the prior direct IndependentReviewPanel(reviewerMode) mount, which had no ' +
            'structured decision mechanism of its own.',
        },
      ],
      prerequisites: ['overview'],
      permittedActions: ['comment', 'recommend-change', 'contest-finding', 'submit-observer-decision'],
      completionEvidence: ['observerDecisionSubmitted'],
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
        'Review instructions, the Independent Reviewer Agreement, and the scoped discussion thread — everything required to complete participation. You sign the participation, review-acknowledgement, and Independent Reviewer Agreement; the operator performs constitutional governance.',
      actor: 'reviewer',
      subjectRef: 'external-reviewer',
      surfaces: [
        {
          mode: 'component',
          ref: 'validation-programme-reviewer-agreement',
          props: { experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID },
          note:
            'Panels 1 and 2 — Review mandate, then the canonical experiment-scoped ' +
            'Independent Reviewer Agreement (agreement.exp-p1.independent-review.v1) with its ' +
            'explicit acknowledgement + conflict declaration. Rendering it authorizes nothing; ' +
            'completion is derived server-side from the durable authorization row.',
        },
        {
          mode: 'component',
          ref: 'validation-programme-locker',
          props: { visibleSections: ['peerExchange', 'uploadToLocker'] },
          note:
            'Panel 3 — Submit review: Peer Exchange (QubeTalk) and Upload to Locker. ' +
            'INVITATION IS DELIBERATELY ABSENT (operator ruling, 2026-08-02): invitation ' +
            'acceptance is an ACCESSION act performed before programme entry, on the invitation ' +
            'page itself — not a panel inside the final stage. Capability visibility here is no ' +
            'broader than the reviewer mandate: never the whole Locker.',
        },
      ],
      prerequisites: ['crystal-review'],
      permittedActions: ['accept-participation-agreement', 'accept-review-acknowledgement', 'accept-collaboration-agreement'],
      completionEvidence: ['collaborationAgreementAuthorized'],
      receiptTypes: [],
      companion: {
        before: 'Sign the participation agreement and the Independent Reviewer Agreement to complete your review submission.',
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
          props: {
            workspaceDomain: 'research',
            lockedWorkspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID,
            initialSurface: 'evidence',
            hiddenLinkIds: ['irl-records'],
          },
          note:
            "The workspace's own Activity view — consequential events and DVN receipts — with the " +
            'Records & Findings link hidden for this rendering only (operator instruction 2026-08-01, ' +
            'point 6). The workspace’s own link list is untouched; every other mount still shows it.',
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
