/**
 * externalExperienceProjection.ts — the provider-neutral composition seam
 * (operator ruling, 2026-08-27, Differ FS pilot reconciliation):
 *
 *   persisted observation + ApplicationProjectionManifest + adaptive context
 *   + projection validator = ExperienceProjection
 *
 * This module owns none of its inputs' logic — it composes four EXISTING
 * pieces, each already responsible for one concern, and returns whatever
 * `produceExperienceProjection` (adaptiveExperienceEngine.ts) decides:
 *
 *   observation   services/adaptive/persistedJourneyObservation.ts — the
 *                 side-effect-free ratchet read, never re-derived here.
 *   manifest      services/adaptive/applicationProjectionManifest.ts — the
 *                 audited topology/disposition source; this module reads it
 *                 through the manifest's OWN composition helpers
 *                 (overrideDispositionsFromManifest, moneyPennyServiceCapabilityRefs)
 *                 rather than re-deriving a disposition or route decision.
 *   engine        services/adaptive/adaptiveExperienceEngine.ts — provider
 *                 selection + postflight validation + native fallback,
 *                 unmodified.
 *   allowlist     the HTTP-level explicit-field serializer stays SEPARATE
 *                 (this module returns the full internal ExperienceProjection;
 *                 an external-facing route is responsible for its own
 *                 allowlisted JSON shape — see this file's own header note
 *                 on why the two are deliberately not merged).
 *
 * Deliberately NOT in this module: any Differ-specific authentication,
 * transport, or integration-key logic. Which INTEGRATION may call this at
 * all is a question for services/adaptive/externalIntegrationRegistry.ts,
 * enforced by the HTTP route that calls this function — never by this
 * function itself, which has no caller-identity concept.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JourneyDefinition } from '@/types/journey';
import type { AdaptiveExperienceProvider, AdaptiveInteractionContext, ExperienceProjection } from '@/types/adaptiveExperience';
import { observePersistedJourneyContext } from './persistedJourneyObservation';
import {
  moneyPennyServiceCapabilityRefs,
  overrideDispositionsFromManifest,
  type ApplicationProjectionManifestV01,
} from './applicationProjectionManifest';
import { produceExperienceProjection, type AdaptiveProjectionOutcome } from './adaptiveExperienceEngine';
import { nativeProvider } from './nativeProvider';

export interface BuildExternalExperienceProjectionInput {
  journeyDefinition: JourneyDefinition;
  aigentQubeId: string;
  participantRef: string;
  participantState: { citizenPassportUsable: boolean };
  manifest: ApplicationProjectionManifestV01;
  hostId: string;
  generatedAt: string;
  nonSensitiveStageIds?: string[];
  /** Defaults to the native provider — the only one that never throws. A
   *  future genuinely verified Differ provider is passed here explicitly by
   *  its caller, never assumed by this module. */
  provider?: AdaptiveExperienceProvider;
}

export interface ExternalExperienceProjectionResult {
  outcome: AdaptiveProjectionOutcome;
  projection: ExperienceProjection;
  /** The FULL merged context the projection was built over (manifest
   *  dispositions + MoneyPenny service capabilities included) — returned so
   *  a caller can run `isCapabilityHandoffEligible(context, projection, id)`
   *  without rebuilding the observation a second time. */
  context: AdaptiveInteractionContext;
  /** Whether a persisted ratchet was actually found for this journey/subject. */
  ratchetObserved: boolean;
}

export async function buildExternalExperienceProjection(
  admin: SupabaseClient,
  input: BuildExternalExperienceProjectionInput,
): Promise<ExternalExperienceProjectionResult> {
  const observation = await observePersistedJourneyContext(admin, {
    journeyDefinition: input.journeyDefinition,
    aigentQubeId: input.aigentQubeId,
    participantRef: input.participantRef,
    participantState: input.participantState,
    hostId: input.hostId,
    nonSensitiveStageIds: input.nonSensitiveStageIds,
    generatedAt: input.generatedAt,
  });

  const nativeSurfaceRef = observation.destination.valid ? observation.destination.operatorDestination.tabSlug : null;

  const capabilityRefs = [
    ...overrideDispositionsFromManifest(observation.context.capabilityRefs, input.manifest),
    ...moneyPennyServiceCapabilityRefs(input.manifest, nativeSurfaceRef),
  ];

  const context = { ...observation.context, capabilityRefs };

  const outcome = await produceExperienceProjection(context, input.provider ?? nativeProvider);

  return { outcome, projection: outcome.projection, context, ratchetObserved: observation.ratchetObserved };
}
