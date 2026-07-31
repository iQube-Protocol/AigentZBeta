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
  companion: { before: string; during?: string; complete: string; refused?: string };
  nextStageId?: string;
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
