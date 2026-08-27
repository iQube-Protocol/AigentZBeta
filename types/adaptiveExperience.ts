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
 * The three independent permissions a capability carries across the provider
 * boundary (operator ruling, 2026-08-27, correcting the Differ FS pilot
 * reconciliation): *"`NATIVE_ONLY` must not mean 'not handoff-eligible.' A
 * native handoff is precisely how an externally presented experience reaches
 * a `NATIVE_ONLY` capability without rendering or executing it externally."*
 *
 * These are DELIBERATELY independent — no combination is derived from
 * another:
 *   - `externalRenderAllowed: false, nativeHandoffAllowed: true` is the
 *     NORMAL shape for a `NATIVE_ONLY` capability (e.g. Architect's full
 *     artifact, or in principle Runtime execution under the general AEE
 *     model) — never presented externally, always reachable through a
 *     single-use handoff into native custody.
 *   - `externalExecuteAllowed` is near-always false in Phase A/2A/2B (AEE
 *     never executes anything itself — see ExperienceProjection's own "not
 *     executable application code" rule); it exists as a distinct field so a
 *     future phase that DOES let a provider trigger a bounded, non-
 *     consequential act (if one is ever ratified) has somewhere to declare
 *     it, without overloading `externalRenderAllowed`.
 *   - Whether a PARTICULAR external integration (e.g. this pilot's Differ
 *     registration) may actually REACH a nativeHandoffAllowed capability is a
 *     SEPARATE, narrower decision — the integration's own
 *     `allowedCapabilities` allowlist (services/adaptive/
 *     externalIntegrationRegistry.ts). A capability being
 *     `nativeHandoffAllowed: true` in the manifest is necessary but never
 *     sufficient; the integration allowlist is what actually excludes
 *     Runtime from THIS pilot, not a manifest-level universal ban.
 */
export interface AdaptiveCapabilityDisposition {
  externalRenderAllowed: boolean;
  externalExecuteAllowed: boolean;
  nativeHandoffAllowed: boolean;
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
  /** True = this capability's execution surface must never render through a non-native provider.
   *  Governs postflight check 3 (must not silently vanish from a non-empty
   *  projection) — a DIFFERENT concern from `disposition`, which governs
   *  whether it may render/execute/handoff at all (checks 6-7). */
  sensitive?: boolean;
  /** The three-permission disposition above. Required — a capability with no
   *  declared disposition fails closed (see projectionValidator.ts's
   *  `capabilityDisposition` helper) rather than silently defaulting to
   *  permissive. */
  disposition: AdaptiveCapabilityDisposition;
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
  /** True = this action is offered as a NATIVE HANDOFF destination, not a
   *  direct external render/execute — the provider presents "do this," the
   *  user is then routed into native custody for it. Only valid when the
   *  referenced capability's `disposition.nativeHandoffAllowed` is true
   *  (enforced by projectionValidator.ts's check 7). */
  handoffOffered?: boolean;
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
  /** See ProjectionActionRef.handoffOffered — same meaning, surface form. */
  handoffOffered?: boolean;
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
