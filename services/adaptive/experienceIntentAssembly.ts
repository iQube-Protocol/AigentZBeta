/**
 * experienceIntentAssembly — AEE-XP-001 §6 XP-1 follow-up: activating
 * `ExperienceIntentProjection` end-to-end (2026-09-01).
 *
 * `JourneyAeeInput.experience` (journeyAeeOrchestrator.ts) and
 * `AdaptiveInteractionContext.experienceIntent` already existed; nothing
 * populated them. This is the ONE generic, read-only assembler both KNYTS
 * and CI state routes call — no Bridge-specific experience model, no second
 * assembly path.
 *
 * Provenance discipline (declared ≠ observed ≠ inferred, never conflated):
 *
 *   declared — the real declared branch intent already relayed server-side
 *     via the EXISTING `?activatedBranches=branch:intent` param
 *     (journeyBranchActivation.ts's `parseActivatedBranchesParam` /
 *     `serializeActivatedBranchesForJourney` — both already live; no NEW
 *     client→server relay was needed, this was already server-readable via
 *     `runtimeState.activatedBranches`). LEARN_FINANCIAL_SERVICES and
 *     JOIN_FINANCIAL_SERVICES are read back exactly as declared — never
 *     collapsed into each other, never inferred from "branch active" alone.
 *
 *   observed — real `experience_interaction_observed` receipts, read via
 *     `listObservedExperienceInteractions` (experienceObservationPromotion.ts)
 *     — the SAME generic evidence substrate DISCOVER/LEARN/EXPLORE already
 *     write to. Never re-derived from page state, never promoted to
 *     declared.
 *
 *   inferred — deliberately left undefined. No existing canonical inference
 *     source was identified for this pass (operator instruction: "empty is
 *     preferable to invented inference"). A future pass that adds a real
 *     inference source populates this field; this module never fabricates
 *     one to fill it.
 *
 * PURE READ: this module writes nothing, calls no mutation function, and
 * returns `undefined` when there is genuinely no declared or observed
 * signal — so a caller with nothing to project passes `undefined` through
 * to `computeJourneyAeeOutcome`, and the native provider's existing
 * unchanged code path runs exactly as before this file existed (acceptance
 * criterion 1: no experience evidence/intent → deterministic native
 * behavior continues, byte-identical).
 */

import type { ExperienceIntentProjection, JourneyRuntimeState } from '@/types/journey';
import { listObservedExperienceInteractions } from '@/services/journey/experienceObservationPromotion';

export interface AssembleExperienceIntentProjectionInput {
  personaId: string | null | undefined;
  journeyId: string;
  /** Already-resolved runtime state — read for `activatedBranches` only;
   *  this function does not resolve state itself (same discipline as
   *  journeyAeeOrchestrator.ts's own `runtimeState` input). */
  runtimeState: JourneyRuntimeState;
}

/**
 * The declared-preferences shape this module writes and the native
 * provider reads. Deliberately narrow (one field) rather than a generic
 * bag — `ExperienceIntentProjection.declaredPreferences` is typed
 * `Record<string, unknown>` for forward compatibility, but THIS assembler
 * only ever populates `branchIntents` from a real declared source.
 */
export interface DeclaredPreferencesShape {
  /** `{ [branch]: declaredIntent }` — verbatim from `runtimeState.activatedBranches`. */
  branchIntents: Record<string, string>;
}

export interface ObservedBehaviorShape {
  interactions: Array<{ stageId: string; interactionKind: string | null; capabilityId: string | null }>;
}

export async function assembleExperienceIntentProjection(
  input: AssembleExperienceIntentProjectionInput,
): Promise<ExperienceIntentProjection | undefined> {
  const declaredEntries = Object.entries(input.runtimeState.activatedBranches ?? {});
  const observed = await listObservedExperienceInteractions(input.personaId, input.journeyId);

  if (declaredEntries.length === 0 && observed.length === 0) return undefined;

  const declaredPreferences: DeclaredPreferencesShape | undefined =
    declaredEntries.length > 0 ? { branchIntents: Object.fromEntries(declaredEntries) } : undefined;

  const observedBehavior: ObservedBehaviorShape | undefined =
    observed.length > 0
      ? {
          interactions: observed.map((o) => ({
            stageId: o.stageId,
            interactionKind: o.interactionKind,
            capabilityId: o.capabilityId,
          })),
        }
      : undefined;

  return {
    declaredPreferences: declaredPreferences as unknown as Record<string, unknown> | undefined,
    observedBehavior: observedBehavior as unknown as Record<string, unknown> | undefined,
    // Deliberately absent — see header comment. Never invented to fill the shape.
    inferredPreferences: undefined,
    provenance: {
      declared: declaredEntries.length > 0 ? ['journey:activatedBranches'] : [],
      observed: observed.length > 0 ? ['experience_interaction_observed'] : [],
      inferred: [],
    },
  };
}
