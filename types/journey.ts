/**
 * Guided Journey Runtime — type contract (PRD-GJR-001).
 *
 * A journey carries a person, agent or partner through a live sequence of
 * platform actions using: a compact interactive journey bar; existing
 * authoritative platform surfaces; a context-aware Companion; real platform
 * state and receipts; a defined destination. This is orchestration, not a
 * new identity/wallet/delegation/admission system — every mechanism a stage
 * references already exists (see services/journey/journeySurfaceRegistry.ts).
 *
 * Journey Guidance Principle (§5.1): button clicked != stage complete.
 * authoritative state + required receipt = stage complete. Client navigation
 * may select a stage; it never sets completion (services/journey/resolveJourneyState.ts).
 *
 * See codexes/packs/agentiq/updates/2026-07-30_prd-gjr-001-guided-journey-runtime.md
 * for the full spec this file implements (§8, §11.1).
 */

export type JourneyStageState =
  | 'NOT_STARTED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REFUSED'
  | 'COMPLETE'
  | 'QUARANTINED';

/**
 * 'external-url' (Composable Overlay Principle, §5.9) — the browser itself is
 * a valid surface, including for a partner's own live environment (e.g.
 * Horizen's real registry page for a registered agent). Never a metaMe-
 * internal route.
 */
export type JourneySurfaceMode =
  | 'iframe'
  | 'component'
  | 'modal'
  | 'drawer'
  | 'receipt-view'
  | 'external-url';

export interface JourneySurfaceRef {
  mode: JourneySurfaceMode;
  /** Key into JOURNEY_SURFACES (services/journey/journeySurfaceRegistry.ts). */
  ref: string;
  route?: string;
  /** Required when mode is 'external-url' — the real external page to open. */
  url?: string;
  entityRef?: string;
  props?: Record<string, unknown>;
  /** Human-readable note on what this surface is, for build traceability. */
  note?: string;
}

/**
 * The MONOTONIC constitutional ladder (operator ruling, 2026-08-03):
 *
 *   REGISTERED → VERIFIED | VERIFIED_WITH_EXCEPTION → CLAIMED
 *              → PASSPORT_ISSUED → DELEGATED
 *
 * Distinct from `JourneyStageState`, and deliberately so. A stage STATE is a
 * rendering of one stage right now and may legitimately be READY, BLOCKED or
 * IN_PROGRESS. A MILESTONE is a constitutional fact about the subject that,
 * once reached, is never un-reached by a later stage's failure.
 *
 * Four of the five rungs correspond exactly to a `SettledPredicate`
 * (services/journey/settledFacts.ts): REGISTERED ← `is_registered`,
 * CLAIMED ← `control_is_proven`, PASSPORT_ISSUED ← `passport_is_issued`,
 * DELEGATED ← `delegation_is_granted`. VERIFIED has NO predicate, and that
 * absence is the point: verification enriches an agent's observable state, it
 * does not establish a constitutional fact about her (PRD-GJR-001 §3.7,
 * "transparency is a gateway, never a grant").
 */
export type JourneyMilestone =
  | 'REGISTERED'
  | 'VERIFIED'
  | 'VERIFIED_WITH_EXCEPTION'
  | 'CLAIMED'
  | 'PASSPORT_ISSUED'
  | 'DELEGATED';

export interface JourneyStageDefinition {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  actor: string;
  subjectRef: string;
  /**
   * One or more real, live surfaces composed together for this stage (§5.9 —
   * composition, never forking). The Companion/journey narration is always an
   * overlay on top of these — never counted as a "surface" itself.
   */
  surfaces: JourneySurfaceRef[];
  prerequisites: string[];
  permittedActions: string[];
  completionEvidence: string[];
  receiptTypes: string[];
  /**
   * Suppress the stage-level Evidence Receipts drawer (operator direction,
   * 2026-08-02). Set ONLY where the stage's own surface already surfaces its
   * receipts natively — Delegate, Deploy and aigentMe each render receipts in
   * their own modals, so the drawer beneath them is a second, redundant
   * rendering of the same evidence.
   *
   * This does NOT blank `receiptTypes`: which receipts a stage emits is a
   * fact about the stage and stays declared (the journey definition is read
   * by more than the drawer). Only the duplicate RENDERING is suppressed.
   */
  receiptsSurfacedNatively?: boolean;
  /**
   * Every action type in `receiptTypes` names the SUBJECT AGENT (never an
   * orchestrator) in `agentsInvoked` — set ONLY where this has been verified
   * true for every type in the list (operator directive, 2026-08-08:
   * "A registration receipt can satisfy an agent's Register stage iff the
   * receipt subject is that exact runtime agent").
   *
   * When true, the stage's Evidence Receipts drawer (StageReceiptsDrawer,
   * via JourneyRunSurface) additionally scopes its query to the currently
   * selected agent, so a persona that has acted on multiple agents (e.g. the
   * operator registering both Nakamoto and MoneyPenny) never sees one
   * agent's receipts while viewing another's stage — the defect that
   * surfaced on Register: MoneyPenny's `pending_registration` stage
   * displaying Aigent Nakamoto's `HORIZEN_AGENT_REGISTERED` receipt, because
   * `/api/assistant/receipts` filtered only by actionType and the ACTING
   * persona (the operator), never by the receipt's subject.
   *
   * Left `undefined`/`false` for stages whose receipt types are NOT
   * uniformly subject-tagged — e.g. Verify's `agreement_formed`/
   * `agreement_authorized` carry only `agentsInvoked: ['aigent-z']` (the
   * orchestrator), never the subject agent (constitutionalAgreement.ts).
   * Applying the filter there would silently hide those receipts for every
   * agent rather than fix the underlying gap, so it stays unset until that
   * write-side is separately corrected.
   */
  receiptsScopedToSubjectAgent?: boolean;
  /**
   * Which rung of the monotonic ladder this stage establishes, when it
   * establishes one. Stages that carry no constitutional milestone (Deploy,
   * Standing, aigentMe) leave it undefined rather than inventing a rung — the
   * ladder is the operator's five, not one-per-stage.
   */
  milestone?: JourneyMilestone;
  companion: { before: string; during?: string; complete: string; refused?: string };
  /**
   * The top-row rotating narrator (Threshold Guide header compaction,
   * 2026-08-10) — two terse phrases, alternated by `RotatingStatusLine`:
   * what is currently happening, and the constitutional consequence that
   * act has (or will have). Deliberately distinct from `companion` above,
   * which is longer-form prose for a different surface (the companion
   * chat/narration overlay) — this is a one-line label, not a sentence.
   * Optional: a journey that omits it (e.g. Validation Programme) falls
   * back to rendering the stage's own `description` instead, unchanged.
   */
  narrator?: { active: string; consequence: string };
  /**
   * A POST-ACTIVATION BRANCH, not a step on the admission line (operator
   * ruling, 2026-08-03).
   *
   * The admission spine — Register -> Claim -> Passport -> Delegate ->
   * aigentMe — establishes the agent and its bounded authority, and is
   * linear. After it, two INDEPENDENT branches run in parallel and neither
   * gates the other:
   *
   *   'factory'    — ingestion into the agent factory / iQube Registry.
   *                  Establishes PARTICIPATION and Standing ELIGIBILITY.
   *   'capability' — Pulse / P&L verification. Establishes eligibility for
   *                  the financial-services runtime and other specialists.
   *
   * These are distinct state AXES, deliberately not collapsed into one
   * blocking sequence. Verify sat at position 2 of the spine and, because a
   * local table was missing, immobilised Claim, Passport, delegation and
   * activation — an optional partner enrichment holding personhood hostage.
   *
   * A branch stage carries no `nextStageId`: nothing waits on it.
   */
  branch?: 'factory' | 'capability';
  nextStageId?: string;
  /**
   * Consequence Fork rendering hint (Threshold Journey — Orient + Consequence
   * Fork, 2026-08-09) — presentation-only, never a completion/gating input.
   *
   * Purely additive: undefined for every stage on the linear admission spine
   * and for any journey that has not opted in. `JourneyRunSurface` renders
   * the spine exactly as before for those stages; only stages that declare a
   * position are grouped into a three-pronged fork after the spine ends.
   * Which stages actually branch, and what (if anything) gates them, is
   * still entirely `prerequisites`/`completionEvidence` — this field decides
   * WHERE a stage's node is drawn, never whether it is reachable or
   * complete. A stage may carry `branch` (a state-axis grouping, see above)
   * and `forkPosition` (a rendering position) independently — neither
   * implies the other.
   */
  forkPosition?: 'upper' | 'middle' | 'lower';
}

export interface JourneyDefinition {
  id: string;
  version: string;
  label: string;
  partner?: string;
  destination?: string;
  subjectRef: string;
  stages: JourneyStageDefinition[];
}

export interface JourneyStageRuntimeState {
  stageId: string;
  state: JourneyStageState;
  evidencePresent: string[];
  evidenceMissing: string[];
  receiptRefs: string[];
  refusalReason?: string;
}

export interface JourneyRuntimeState {
  journeyId: string;
  journeyVersion: string;
  subjectRef: string;
  currentStageId: string;
  stages: JourneyStageRuntimeState[];
  complete: boolean;
}

export interface CompanionJourneyContext {
  journeyId: string;
  journeyVersion: string;
  stageId: string;
  stageState: JourneyStageState;
  subjectRef: string;
  actorRef: string;
  partner?: string;
  destination?: string;
  authoritySummary: {
    control: 'unverified' | 'verified';
    authority: 'none' | 'pending' | 'bounded';
    mandate: 'none' | 'pending' | 'active' | 'expired';
  };
  missingRequirements: string[];
  availableActions: string[];
  receiptRefs: string[];
}

/**
 * Bounded Companion intents (§11.1) — the Guided Sovereignty Principle (§5.4)
 * enforced in the type, not merely by convention. Sovereign acts (accepting a
 * passport, claiming an agent, granting delegation, approving a mandate) have
 * NO code path here — they are structurally absent, not merely forbidden.
 * REQUEST_SOVEREIGN_ACTION only ever surfaces the act for the human operator
 * to perform through the real surface underneath; it never performs it.
 */
export type CompanionJourneyIntent =
  | 'EXPLAIN_STAGE'
  | 'OPEN_SURFACE'
  | 'PREPARE_ACTION'
  | 'SHOW_EVIDENCE'
  | 'SHOW_REFUSAL'
  | 'REQUEST_SOVEREIGN_ACTION';
