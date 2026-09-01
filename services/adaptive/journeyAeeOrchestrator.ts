/**
 * journeyAeeOrchestrator — the ONE canonical loop (AEE-XP-001 §6, XP-1
 * Experience Control Plane convergence, 2026-09-01):
 *
 *   authoritative state -> AdaptiveInteractionContext -> AEE/NBE
 *     -> ExperienceProjection -> surface -> evidence/state change
 *     -> re-evaluation
 *
 * This is the FIRST live caller of `services/adaptive/*` (Phase 0 audit
 * found zero outside its own test). It BINDS existing correct pieces —
 * `resolveJourneyState` (Journey Spine truth), `assembleInteractionContext`
 * (bounded mutual-awareness projection), `buildAdaptiveInteractionContext`
 * (journeySpineAdapter.ts), `produceExperienceProjection`
 * (adaptiveExperienceEngine.ts) — it reimplements none of them.
 *
 * WHO OWNS WHAT (unchanged by this file's existence):
 *   Journey Spine (resolveJourneyState) owns progression truth — current
 *     stage, satisfaction, reachability. This module reads it; it NEVER
 *     computes or infers a stage's completion. AEE recommending a stage
 *     never marks it satisfied — only real evidence flowing back through
 *     `resolveJourneyState` does that, on the NEXT resolution.
 *   AEE (this module + services/adaptive/*) determines the Next Best
 *     Experience — which reachable stage to recommend, and how to project
 *     it — but decides nothing about whether the visitor MAY act (that
 *     stays with the owning capability's own authority checks, never this
 *     module).
 *   The legacy DB-backed NBE (app/api/runtime/nbe/route.ts) is a
 *     candidate/fallback/compatibility source, never an independent
 *     decision authority — `legacyCandidateStageId` below is its one
 *     integration seam into ranking, deliberately unused by the Financial
 *     Sovereignty call site (its KNYT depth-ladder vocabulary has nothing
 *     to contribute to Journey Spine stage ids yet).
 *
 * PURE READ, NEVER A WRITER: this module never touches AuthoritativePlatformState,
 * never calls a mutation/persistence function, and accepts no Supabase client.
 * It cannot mark anything complete — structurally, not by convention (see
 * tests/adaptive-fs-branch-acceptance.test.ts's import-authority canary).
 */

import type { JourneyDefinition, JourneyRuntimeState, InteractionContext } from '@/types/journey';
import type { AuthorityProjection, DelegationProjection, ExperienceIntentProjection } from '@/types/journey';
import { assembleInteractionContext } from '@/services/journey/interactionContextAssembly';
import {
  buildJourneyProjectionContext,
  buildCapabilityRefsFromJourney,
  CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
} from '@/services/adaptive/journeySpineAdapter';
import { produceExperienceProjection, type AdaptiveProjectionOutcome } from '@/services/adaptive/adaptiveExperienceEngine';
import { nativeProvider } from '@/services/adaptive/nativeProvider';
import type {
  AdaptiveExperienceProvider,
  AdaptiveInteractionContext,
  CapabilityProjectionRef,
} from '@/types/adaptiveExperience';

export interface JourneyAeeInput {
  journeyDefinition: JourneyDefinition;
  /** Already-resolved runtime state — the caller owns calling
   *  `resolveJourneyState` with whatever `activatedBranches` a real client
   *  gesture declared. This module never resolves state itself. */
  runtimeState: JourneyRuntimeState;
  hostId: string;
  /** Tiered/pseudonymous ref only (SPEC-AEE-001 §14) — never a raw T0 identifier. */
  participantRef: string;
  generatedAt: string;
  authority?: AuthorityProjection;
  delegation?: DelegationProjection;
  experience?: ExperienceIntentProjection;
  nonSensitiveStageIds?: string[];
  /** Provider override for tests/future Differ wiring — defaults to native. */
  provider?: AdaptiveExperienceProvider;
  /**
   * Legacy NBE candidate contribution seam (AEE-XP-001 §6 requirement 3:
   * "existing NBE catalogue/ranking may contribute candidates"). A stage id
   * the legacy DB-backed NBE (app/api/runtime/nbe/route.ts) recommends, IF
   * it maps onto a real stage in `journeyDefinition` — never invented, never
   * authoritative. When present and reachable, it is folded into the
   * candidate pool the native provider ranks over; when absent (the
   * default — no live journey has this integration built yet), ranking is
   * exactly `reachableStageIds` in declared order, unchanged.
   */
  legacyCandidateStageId?: string;
}

export interface JourneyNbeResult {
  /** The stage AEE recommends next, or null if nothing is reachable. */
  targetStageId: string | null;
  disposition: 'act' | 'ask' | 'wait';
  rationale: string;
  /** Always 'aee' for this loop — the legacy route's own 'cached'/'computed'
   *  vocabulary (app/api/runtime/nbe/route.ts) is a different system this
   *  field deliberately does not merge with (see this module's own header). */
  source: 'aee';
}

export interface JourneyAeeOutcome {
  nbe: JourneyNbeResult;
  projection: AdaptiveProjectionOutcome;
  adaptiveContext: AdaptiveInteractionContext;
  interactionContext: InteractionContext;
  /**
   * True when the recommended stage is a crossing boundary — any stage
   * whose `permittedActions` includes an action matching `/^cross-to-/`
   * (the FS branch's existing 'fs-cross' declares
   * `cross-to-financial-services`; this reads that EXISTING signal rather
   * than inventing a second "is this CROSS" marker). This module never
   * constructs the real ExperienceHandoff itself — that still requires
   * client-held context (the selected agent candidate) this module has no
   * access to; it only flags that the moment has arrived, per AEE-XP-001
   * §4's existing client-side CROSS handler contract.
   */
  crossingRecommended: boolean;
}

const CROSS_ACTION_PATTERN = /^cross-to-/;

/**
 * Re-evaluation trigger contract (AEE-XP-001 §6 requirement 6) — the
 * CONTRACT for this slice, deliberately not a new observation database.
 * Any of these facts changing invalidates a previously-computed
 * `JourneyAeeOutcome`; the correct response is simply to call
 * `computeJourneyAeeOutcome` again with fresh inputs — there is no cached
 * projection to invalidate in-place because this module holds no state of
 * its own. Consequential OBSERVATION (recording that a trigger fired, for
 * copilot narration) remains DCIR-owned (services/dcir/*) — this type only
 * names what a DCIR-observed change should cause a caller to do.
 */
export type JourneyReEvaluationTrigger =
  | 'journey-state-change'
  | 'branch-intent-change'
  | 'stage-satisfaction-evidence-change'
  | 'exqube-experience-evidence-change'
  | 'authority-standing-change';

/** Every trigger in the contract warrants recomputation — no trigger is
 *  ever debounced/ignored here. Named as a function (not a boolean
 *  constant) so a future trigger-specific policy has one call site to
 *  extend, without callers needing to know the current answer is trivial. */
export function shouldReEvaluateAeeProjection(_trigger: JourneyReEvaluationTrigger): boolean {
  return true;
}

function dispositionFor(targetStageId: string | null, journey: JourneyDefinition): 'act' | 'ask' | 'wait' {
  if (!targetStageId) return 'wait';
  const stage = journey.stages.find((s) => s.id === targetStageId);
  // Mirrors the legacy route's own ask/act split (app/api/runtime/nbe/route.ts
  // dispositionForStage) at the ONE place it is real today — a
  // principal-only actor stage is 'ask' (guardian/self approval implied by
  // the surface itself), everything reachable is otherwise 'act'.
  return stage?.actorRole === 'principal' ? 'ask' : 'act';
}

export async function computeJourneyAeeOutcome(input: JourneyAeeInput): Promise<JourneyAeeOutcome> {
  const {
    journeyDefinition,
    runtimeState,
    hostId,
    participantRef,
    generatedAt,
    authority,
    delegation,
    experience,
    nonSensitiveStageIds,
    provider = nativeProvider,
    legacyCandidateStageId,
  } = input;

  const interactionContext = assembleInteractionContext(journeyDefinition, runtimeState, authority, delegation, experience);
  const journeyProjectionContext = buildJourneyProjectionContext(runtimeState, interactionContext);

  // Legacy NBE candidate seam — folded into readyStageIds ONLY when it
  // names a stage that is genuinely reachable right now; never invents
  // reachability the resolver itself didn't establish.
  const reachableSet = new Set(journeyProjectionContext.readyStageIds);
  if (legacyCandidateStageId && reachableSet.has(legacyCandidateStageId)) {
    journeyProjectionContext.readyStageIds = [
      legacyCandidateStageId,
      ...journeyProjectionContext.readyStageIds.filter((id) => id !== legacyCandidateStageId),
    ];
  }

  const nonSensitive = new Set(nonSensitiveStageIds ?? []);
  const capabilityRefs: CapabilityProjectionRef[] = buildCapabilityRefsFromJourney(journeyDefinition, nonSensitive);

  const contextId = `aee-fs:${journeyDefinition.id}:${participantRef}:${generatedAt}`;
  const adaptiveContext: AdaptiveInteractionContext = {
    contextId,
    participantRef,
    journey: journeyProjectionContext,
    targetState: runtimeState.targetStageId,
    capabilityRefs,
    authorityContext: interactionContext.authorityContext,
    delegationContext: interactionContext.delegationContext,
    experienceIntent: interactionContext.experienceIntent,
    companion: interactionContext.companionGuidance
      ? {
          currentPhase: interactionContext.companionGuidance.currentPhase,
          explanation: interactionContext.companionGuidance.explanation,
          nextSteps: interactionContext.companionGuidance.nextSteps,
        }
      : undefined,
    host: { hostId, surfaceTypesSupported: ['component', 'modal', 'route', 'cartridge-tab', 'embed', 'companion-action'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
    generatedAt,
  };

  return computeOutcomeFromContext(journeyDefinition, adaptiveContext, interactionContext, provider);
}

async function computeOutcomeFromContext(
  journeyDefinition: JourneyDefinition,
  adaptiveContext: AdaptiveInteractionContext,
  interactionContext: InteractionContext,
  provider: AdaptiveExperienceProvider,
): Promise<JourneyAeeOutcome> {
  const projection = await produceExperienceProjection(adaptiveContext, provider);

  // §5 requirement E: no valid projection -> fall back to whatever the
  // engine itself produced as fallback (native or Level 0 — already handled
  // inside produceExperienceProjection; this module adds no second fallback
  // path). "Existing deterministic native Journey behavior continues" reads
  // as: the primary action is still whatever native's own Level 1 selection
  // would choose, which is exactly what `fellBackToNative` guarantees.
  const targetStageId = projection.projection.primaryAction?.capabilityId ?? null;
  const disposition = dispositionFor(targetStageId, journeyDefinition);
  const rationale =
    projection.projection.rationale?.summary ??
    (targetStageId ? `AEE recommends "${targetStageId}" next.` : 'AEE has no reachable stage to recommend.');

  const targetStage = targetStageId ? journeyDefinition.stages.find((s) => s.id === targetStageId) : undefined;
  const crossingRecommended = !!targetStage?.permittedActions.some((a) => CROSS_ACTION_PATTERN.test(a));

  return {
    nbe: { targetStageId, disposition, rationale, source: 'aee' },
    projection,
    adaptiveContext,
    interactionContext,
    crossingRecommended,
  };
}
