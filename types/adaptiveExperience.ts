/**
 * Adaptive Experience Engine — core contracts (SPEC-AEE-001 Phase A, §24).
 *
 * Governing separation (do not violate — enforced by types + the postflight
 * validator in services/adaptive/projectionValidator.ts, never by convention
 * alone):
 *
 *   metaMe / Constitutional Computing owns truth, capability, authorization,
 *   canonical topology, authoritative objects and evidence.
 *   Journey Spine owns progression.
 *   Experience Guide / ExQube informs experience.
 *   Adaptive Experience Engine optimizes projection.
 *   Differ is a reference renderer/host provider, never an authority layer.
 *
 * Canonical rule (SPEC-AEE-001 §3):
 *   "Adaptive projection can change experience; it cannot change
 *    constitutional truth."
 *
 * This file defines the provider-neutral core only. It intentionally does
 * NOT import anything Differ-specific — see services/adaptive/providers/
 * differAdapter.ts for the (currently unverified/disabled) Differ seam.
 *
 * Modeled on the existing rendering-provider seam precedent
 * (types/experienceRenderer.ts, CFS-007 Law VI: "Separate Architecture from
 * Rendering") and the existing swappable-provider precedent
 * (services/constitutional/agreementProviders.ts, CFS-018: "primitives are
 * invariant; providers are replaceable") — this is a sibling seam, not a
 * parallel invention. Reuses types/journey.ts's `AuthorityProjection`,
 * `DelegationProjection`, `ExperienceIntentProjection` verbatim rather than
 * redeclaring them.
 */

import type {
  AuthorityProjection,
  DelegationProjection,
  ExperienceIntentProjection,
} from './journey';

// ---------------------------------------------------------------------------
// Part III — Inputs (SPEC-AEE-001 §4-7)
// ---------------------------------------------------------------------------

/**
 * Provider boundary classes (SPEC-AEE-001 §15). Mirrors the Identity & Access
 * Spine's T0/T1/T2 tiers (CLAUDE.md) rather than inventing a fourth
 * vocabulary: T0 -> PROHIBITED_EXTERNAL, T1 -> PROVIDER_SAFE,
 * T2 -> PROVIDER_SAFE or PROVIDER_SAFE_REDACTED depending on field.
 */
export type ProviderBoundaryClass =
  | 'LOCAL_ONLY'
  | 'PROVIDER_SAFE'
  | 'PROVIDER_SAFE_REDACTED'
  | 'PROHIBITED_EXTERNAL';

export interface ProjectionDisclosurePolicy {
  /** Per-field boundary classification, keyed by field name in this context. */
  fieldClassification: Record<string, ProviderBoundaryClass>;
  /** True once the disclosure policy has been enforced server-side (preflight). */
  enforced: boolean;
}

export interface ProjectionConstraint {
  id: string;
  description: string;
  /** True = this constraint MUST hold; a projection violating it is rejected, never warned-and-passed. */
  hard: boolean;
}

/**
 * A capability's safe projection descriptor (SPEC-AEE-001 §7). The provider
 * selects among declared capabilities; it never generates callable
 * authority-bearing endpoints. surfaceTypes/hostRefs mirror
 * types/journey.ts's JourneySurfaceMode vocabulary rather than inventing a
 * second one.
 */
export interface CapabilityProjectionRef {
  capabilityId: string;
  label: string;
  description?: string;
  surfaceTypes: Array<'component' | 'modal' | 'route' | 'cartridge-tab' | 'embed' | 'companion-action'>;
  hostRefs: Record<string, string>;
  actor?: string;
  requiredState?: string[];
  presentationPolicy?: string[];
  /** True = this capability's execution surface must never render through a non-native provider. */
  sensitive?: boolean;
}

/**
 * Journey-scoped Operate destination projection (Financial Services / AEE
 * closeout, 2026-08-24) — where this journey's Operate-equivalent stage
 * lands inside the metaMe Catalogue, when one is registered
 * (services/journey/catalogueDestinationHelper.ts). AEE reads this to
 * reason over / recommend around the operator's destination context; it
 * never owns or derives it — the catalogue item and its tabs remain
 * data/activation-catalog.ts + data/codex-configs.ts's truth.
 */
export interface JourneyOperateDestinationProjection {
  /** data/activation-catalog.ts ACTIVATION_CATALOG id. */
  catalogueItemId: string;
  /** metame-codex tab slug the catalogue item defaults to. */
  defaultTab: string;
  /** Sub-modes reachable from the default tab — context only, never a default-into hint. */
  availableModes?: string[];
}

export interface JourneyProjectionContext {
  journeyId: string;
  journeyVersion: string;
  currentStageId: string;
  targetStageId?: string;
  completedStageIds: string[];
  readyStageIds: string[];
  optionalStageIds: string[];
  waitingStageIds: string[];
  blockedStageIds: string[];
  futureStageIds?: string[];
  /** Immutable dependencies that presentation must not obscure (SPEC-AEE-001 §5). */
  immutableDependencyNotes?: string[];
  /** Present only when this journeyId has a registered Operate destination. */
  operateDestination?: JourneyOperateDestinationProjection;
}

export interface CompanionProjectionContext {
  currentPhase?: string;
  explanation?: string;
  nextSteps?: string[];
}

export interface HostContext {
  hostId: string;
  surfaceTypesSupported: Array<'component' | 'modal' | 'route' | 'cartridge-tab' | 'embed' | 'companion-action'>;
}

/**
 * The bounded context the engine consumes — assembled from authoritative
 * owners, never a raw application dump (SPEC-AEE-001 §4).
 */
export interface AdaptiveInteractionContext {
  contextId: string;
  /** Tiered/pseudonymous ref only — never a raw T0 identifier (SPEC-AEE-001 §14). */
  participantRef: string;
  journey?: JourneyProjectionContext;
  targetState?: string;
  capabilityRefs: CapabilityProjectionRef[];
  authorityContext?: AuthorityProjection;
  delegationContext?: DelegationProjection;
  experienceIntent?: ExperienceIntentProjection;
  companion?: CompanionProjectionContext;
  host: HostContext;
  environmentalContext?: Record<string, unknown>;
  disclosurePolicy: ProjectionDisclosurePolicy;
  constitutionalConstraints: ProjectionConstraint[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Part IV — Output: Experience Projection (SPEC-AEE-001 §8-9)
// ---------------------------------------------------------------------------

export type ProjectionLevel = 0 | 1 | 2 | 3;

export interface ProjectionActionRef {
  capabilityId: string;
  label: string;
  surfaceRef?: string;
}

export interface ProjectionRationale {
  summary: string;
  signalsUsed?: string[];
}

export interface ProjectedSurface {
  capabilityId: string;
  surfaceType: 'component' | 'modal' | 'route' | 'cartridge-tab' | 'embed' | 'companion-action';
  hostRef?: string;
  emphasis?: 'primary' | 'secondary' | 'suppressed';
}

export interface ProjectionLayout {
  mode: 'linear' | 'dag' | 'graph';
  density: 'compact' | 'normal' | 'detailed';
}

export interface CompanionCue {
  message: string;
  /** Never a sovereign act — mirrors types/journey.ts's CompanionJourneyIntent,
   *  which has no sovereign-act code path either. */
  intent: 'EXPLAIN_STAGE' | 'OPEN_SURFACE' | 'SHOW_EVIDENCE' | 'SHOW_REFUSAL';
}

export interface ExperienceSignalRef {
  signalId: string;
  provenance: 'declared' | 'observed' | 'inferred';
}

/**
 * Host-neutral output. Not rendered HTML, not executable application code
 * (SPEC-AEE-001 §8).
 */
export interface ExperienceProjection {
  projectionId: string;
  contextId: string;
  provider: string;
  providerVersion?: string;
  journeyRef?: string;
  rationale?: ProjectionRationale;
  primaryAction?: ProjectionActionRef;
  secondaryActions?: ProjectionActionRef[];
  layout: ProjectionLayout;
  surfaces: ProjectedSurface[];
  companionCue?: CompanionCue;
  experienceSignalsUsed?: ExperienceSignalRef[];
  constraintsApplied: string[];
  confidence?: number;
  /** True when this projection is the deterministic fallback, not a provider's own output. */
  fallback?: boolean;
  expiresAt?: string;
  level: ProjectionLevel;
}

// ---------------------------------------------------------------------------
// Part V — Provider architecture (SPEC-AEE-001 §10-11)
// ---------------------------------------------------------------------------

export interface ProviderProjectionRequest {
  context: AdaptiveInteractionContext;
  requestedLevel?: ProjectionLevel;
}

export interface ProviderProjectionResponse {
  projection: ExperienceProjection;
}

export interface ProviderHealth {
  available: boolean;
  reason?: string;
}

/**
 * Provider-safe capability manifest (SPEC-AEE-001A §3). Every field defaults
 * to false/[]/unknown — a provider must EARN a true value through verified
 * capability, never receive one by assumption. See
 * services/adaptive/providers/differAdapter.ts for why every field there is
 * false today.
 */
export interface ProviderCapabilityManifest {
  providerId: string;
  canRender: boolean;
  canHost: boolean;
  canComposeComponents: boolean;
  canResolveRoutes: boolean;
  canPersistPresentationState: boolean;
  supportedProjectionLevels: ProjectionLevel[];
  supportedSurfaceTypes: string[];
  dataBoundary: 'projection-only' | 'provider-stateful';
  /** Honesty field — set true only when real API/SDK access has been verified. */
  verified: boolean;
  /** Non-empty only when verified is false, explaining exactly what is missing. */
  unavailableReason?: string;
}

/**
 * The provider interface (SPEC-AEE-001 §10). Modeled directly on
 * types/experienceRenderer.ts's ExperienceRenderer<TOutput> shape — a sibling
 * seam, not a duplicate mechanism.
 */
export interface AdaptiveExperienceProvider {
  readonly id: string;
  capabilities(): Promise<ProviderCapabilityManifest>;
  project(input: ProviderProjectionRequest): Promise<ProviderProjectionResponse>;
  health?(): Promise<ProviderHealth>;
}

// ---------------------------------------------------------------------------
// Part VIII — Projection validation (SPEC-AEE-001 §17)
// ---------------------------------------------------------------------------

export interface ProjectionValidationResult {
  valid: boolean;
  /** Non-empty only when valid is false. Each reason names exactly which
   *  Part VIII check failed. */
  violations: string[];
}
