/**
 * Adaptive Experience Engine — runtime loop (SPEC-AEE-001 Part VI §12,
 * Part VII §16 fail-closed/fail-useful, Part VIII §17 postflight validation).
 *
 *   requested provider -> project() -> validate() -> valid? use it
 *                                                    : fall back to native
 *
 * "Differ failure -> native deterministic projection." The action remains
 * available through the platform where authorized (SPEC-AEE-001 §16). This
 * function never throws for a provider failure — a provider error or an
 * invalid projection both resolve to the native projection, with the
 * failure reason recorded on the result for telemetry (SPEC-AEE-001 Part X),
 * never silently swallowed.
 */

import type {
  AdaptiveExperienceProvider,
  AdaptiveInteractionContext,
  ExperienceProjection,
} from '@/types/adaptiveExperience';
import { nativeProvider, buildLevel0Fallback } from './nativeProvider';
import { validateProjection } from './projectionValidator';

export interface AdaptiveProjectionOutcome {
  projection: ExperienceProjection;
  providerAttempted: string;
  providerUsed: string;
  fellBackToNative: boolean;
  fallbackReason?: string;
}

export async function produceExperienceProjection(
  context: AdaptiveInteractionContext,
  provider: AdaptiveExperienceProvider = nativeProvider,
): Promise<AdaptiveProjectionOutcome> {
  let attemptedProjection: ExperienceProjection | undefined;
  let fallbackReason: string | undefined;

  try {
    const response = await provider.project({ context });
    attemptedProjection = response.projection;
  } catch (err) {
    fallbackReason = err instanceof Error ? err.message : String(err);
  }

  if (attemptedProjection) {
    const result = validateProjection(attemptedProjection, context);
    if (result.valid) {
      return {
        projection: attemptedProjection,
        providerAttempted: provider.id,
        providerUsed: provider.id,
        fellBackToNative: false,
      };
    }
    fallbackReason = `projection rejected by postflight validator: ${result.violations.join('; ')}`;
  }

  // Fall back to native. If the requested provider WAS native and it
  // somehow failed/was rejected, fall all the way to the Level 0 fallback
  // rather than recursing.
  if (provider.id === 'native') {
    return {
      projection: buildLevel0Fallback(context.contextId),
      providerAttempted: provider.id,
      providerUsed: 'native',
      fellBackToNative: true,
      fallbackReason,
    };
  }

  const nativeResponse = await nativeProvider.project({ context });
  const nativeValidation = validateProjection(nativeResponse.projection, context);
  const finalProjection = nativeValidation.valid
    ? nativeResponse.projection
    : buildLevel0Fallback(context.contextId);

  return {
    projection: finalProjection,
    providerAttempted: provider.id,
    providerUsed: 'native',
    fellBackToNative: true,
    fallbackReason,
  };
}
