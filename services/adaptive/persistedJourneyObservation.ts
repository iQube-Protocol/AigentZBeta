/**
 * persistedJourneyObservation.ts — the genuinely new piece of the Differ FS
 * pilot, absorbed into AEE proper (operator ruling, 2026-08-27, reconciling
 * `review/differ-fs-pilot` against SPEC-AEE-001/001A).
 *
 * `services/adaptive/journeySpineAdapter.ts` only RESHAPES an
 * already-computed `JourneyRuntimeState`/`InteractionContext` — it has no
 * path that reads a journey's PERSISTED RATCHET directly. Every existing AEE
 * consumer therefore assumes a caller already ran the full, WRITE-CAPABLE
 * `resolveJourneyState` (services/journey/resolveJourneyState.ts) upstream.
 * That is wrong for an external, side-effect-free observation: this module
 * reads ONLY the already-persisted stage ratchet
 * (`services/journey/stageResolution.ts::readJourneyResolution` — a single
 * SELECT) and derives stage status from it plus the STATIC journey
 * definition graph. It never calls `resolveJourneyState` /
 * `recordJourneyResolution` / `settleFact` (all WRITE), and it never
 * reconciles, repairs, or infers beyond what the ratchet already recorded —
 * a stage this module cannot honestly place from the ratchet is `unknown`,
 * never guessed into `ready`/`blocked`.
 *
 * Topology (which capabilities exist, their labels, hostRefs, and — as of
 * this reconciliation — their `AdaptiveCapabilityDisposition`) is NEVER
 * restated here. It comes from `journeySpineAdapter.ts::buildCapabilityRefsFromJourney`
 * over the journey's own static definition, the same function every other
 * AEE consumer uses (inv.engineering.036).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JourneyDefinition } from '@/types/journey';
import type { AdaptiveInteractionContext, JourneyProjectionContext } from '@/types/adaptiveExperience';
import { readJourneyResolution } from '@/services/journey/stageResolution';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import { buildCapabilityRefsFromJourney, CONSTITUTIONAL_PROJECTION_CONSTRAINTS } from './journeySpineAdapter';

export interface PersistedRatchetStageStatus {
  currentStageId: string;
  completedStageIds: string[];
  readyStageIds: string[];
  blockedStageIds: string[];
  /** True only when a persisted ratchet row was actually found — `false`
   *  means every stage below is honestly `unknown` (no ratchet yet), never
   *  a guessed `blocked`. */
  observed: boolean;
}

/**
 * Pure derivation over (a) the static journey definition's stage graph
 * (id/prerequisites — no I/O) and (b) an already-fetched set of canonical
 * (complete) stage ids from the persisted ratchet. A stage is `ready` when
 * every prerequisite is in `canonicalStages`, `blocked` otherwise — the same
 * two-state classification the pilot's own `projectStages` used, now
 * generalized off `FinancialServicesProjectionStage`.
 */
export function deriveStageStatusFromRatchet(
  journeyDefinition: JourneyDefinition,
  canonicalStages: ReadonlySet<string> | null,
): PersistedRatchetStageStatus {
  if (!canonicalStages) {
    return {
      currentStageId: journeyDefinition.stages[0]?.id ?? '',
      completedStageIds: [],
      readyStageIds: [],
      blockedStageIds: journeyDefinition.stages.map((s) => s.id),
      observed: false,
    };
  }
  const completedStageIds: string[] = [];
  const readyStageIds: string[] = [];
  const blockedStageIds: string[] = [];
  for (const stage of journeyDefinition.stages) {
    if (canonicalStages.has(stage.id)) {
      completedStageIds.push(stage.id);
      continue;
    }
    const prerequisitesMet = stage.prerequisites.every((p) => canonicalStages.has(p));
    if (prerequisitesMet) readyStageIds.push(stage.id);
    else blockedStageIds.push(stage.id);
  }
  const currentStageId = journeyDefinition.stages.find((s) => !canonicalStages.has(s.id))?.id
    ?? journeyDefinition.stages[journeyDefinition.stages.length - 1]?.id
    ?? '';
  return { currentStageId, completedStageIds, readyStageIds, blockedStageIds, observed: true };
}

export interface ObservePersistedJourneyContextInput {
  journeyDefinition: JourneyDefinition;
  /** The AigentQube/subject the persisted ratchet is scoped to. */
  aigentQubeId: string;
  /** T2-safe participant reference (e.g. personaPublicRef) — never a raw T0 id. */
  participantRef: string;
  /** Threshold/context signal the ratchet read alone cannot supply — read by
   *  the CALLER via its own pure select, passed in rather than re-read here,
   *  so this module stays a single-purpose ratchet reader. Shaped to match
   *  `resolveJourneyOperatorDestination`'s own `participantState` parameter
   *  exactly (that function's type is the source of truth; not widened
   *  here). */
  participantState: { citizenPassportUsable: boolean };
  hostId: string;
  /** Stage ids the caller has verified are safe for external render despite
   *  journeySpineAdapter's conservative sensitive-by-default rule — see that
   *  module's own doc comment. Pass `[]` to accept the conservative default
   *  everywhere. */
  nonSensitiveStageIds?: string[];
  generatedAt: string;
}

export interface PersistedJourneyObservation {
  context: AdaptiveInteractionContext;
  /** Whether a persisted ratchet was actually found — surfaced separately so
   *  a caller can distinguish "genuinely nothing done yet" from "the read
   *  itself came back empty/unreadable," without inferring it from stage
   *  statuses alone. */
  ratchetObserved: boolean;
  /** The catalogue/journey Operate destination resolution, read via the same
   *  pure helper journeySpineAdapter already threads through
   *  JourneyProjectionContext.operateDestination — surfaced again here at
   *  the top level because callers building a handoff need the FULL
   *  resolution (activationMode, tabSlug), not just the projection's
   *  narrower `{catalogueItemId, defaultTab}` shape. */
  destination: ReturnType<typeof resolveJourneyOperatorDestination>;
}

/**
 * The side-effect-free journey read: persisted ratchet + static topology,
 * composed into the SAME `AdaptiveInteractionContext` shape every other AEE
 * consumer produces. No reconciliation, no write, no second opinion about
 * what the ratchet "should" say.
 */
export async function observePersistedJourneyContext(
  admin: SupabaseClient,
  input: ObservePersistedJourneyContextInput,
): Promise<PersistedJourneyObservation> {
  let canonicalStages: Set<string> | null = null;
  let ratchetObserved = false;
  try {
    const resolution = await readJourneyResolution(admin, input.aigentQubeId, input.journeyDefinition.id);
    if (resolution) {
      canonicalStages = new Set(resolution.canonicalStages);
      ratchetObserved = true;
    }
  } catch {
    canonicalStages = null;
  }

  const stageStatus = deriveStageStatusFromRatchet(input.journeyDefinition, canonicalStages);

  let destination: ReturnType<typeof resolveJourneyOperatorDestination>;
  try {
    destination = resolveJourneyOperatorDestination({
      journeyId: input.journeyDefinition.id,
      participantState: input.participantState,
    });
  } catch {
    destination = {
      valid: false,
      journeyId: input.journeyDefinition.id,
      failedLookup: 'journey-not-registered',
      reason: 'destination resolution threw',
    };
  }

  const journeyProjection: JourneyProjectionContext = {
    journeyId: input.journeyDefinition.id,
    journeyVersion: input.journeyDefinition.version,
    currentStageId: stageStatus.currentStageId,
    completedStageIds: stageStatus.completedStageIds,
    readyStageIds: stageStatus.readyStageIds,
    optionalStageIds: [],
    waitingStageIds: [],
    blockedStageIds: stageStatus.blockedStageIds,
    ...(destination.valid
      ? {
          operateDestination: {
            catalogueItemId: destination.operatorDestination.catalogueItemId,
            defaultTab: destination.operatorDestination.tabSlug,
          },
        }
      : {}),
  };

  const nonSensitive = new Set(input.nonSensitiveStageIds ?? []);
  const context: AdaptiveInteractionContext = {
    contextId: `aee-observed:${input.journeyDefinition.id}:${input.participantRef}:${input.generatedAt}`,
    participantRef: input.participantRef,
    journey: journeyProjection,
    capabilityRefs: buildCapabilityRefsFromJourney(input.journeyDefinition, nonSensitive),
    host: { hostId: input.hostId, surfaceTypesSupported: ['component', 'modal', 'route', 'cartridge-tab', 'embed', 'companion-action'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
    generatedAt: input.generatedAt,
  };

  return { context, ratchetObserved, destination };
}
