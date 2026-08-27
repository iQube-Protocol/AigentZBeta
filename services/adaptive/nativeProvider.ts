/**
 * Native Adaptive Experience Provider — the deterministic platform fallback
 * / reference baseline (SPEC-AEE-001 §9 Level 0, §24 Phase A).
 *
 * Always available. Never calls out to any external provider. This is the
 * provider every projection falls back to when Differ is unavailable, slow,
 * invalid, or fails validation (SPEC-AEE-001 Part VII §16: "fail-closed /
 * fail-useful" — provider failure MUST NOT break the journey).
 *
 * Level 1 (selection): chooses the best existing approved surface from the
 * capability refs supplied in the context, in the order they were assembled
 * (readyStageIds first — see journeySpineAdapter.ts). This is a real,
 * working Level 1 provider, not a stub — it is just deliberately
 * unambitious: no generation, no composition beyond ordering, no external
 * call. That is the correct Phase A scope (SPEC-AEE-001 §24: "No external
 * provider dependency required").
 */

import { createHash } from 'crypto';
import type {
  AdaptiveExperienceProvider,
  ExperienceProjection,
  ProviderCapabilityManifest,
  ProviderHealth,
  ProviderProjectionRequest,
  ProviderProjectionResponse,
} from '@/types/adaptiveExperience';

export const NATIVE_PROVIDER_ID = 'native';
export const NATIVE_PROVIDER_VERSION = '0.1.0';

function projectionId(contextId: string, seed: string): string {
  return createHash('sha256').update(`native-projection:${contextId}:${seed}`).digest('hex').slice(0, 16);
}

/** PURE — no I/O, no clock reliance beyond the caller-supplied context.generatedAt. */
export function buildNativeProjection(input: ProviderProjectionRequest): ExperienceProjection {
  const { context } = input;
  const capabilityRefs = context.capabilityRefs ?? [];

  // Level 1 selection: prefer capabilities the journey marks ready, then any
  // remaining non-sensitive capability, in declared order. Never reorders
  // past what the caller already classified as ready/blocked/etc — Journey
  // Spine's readiness computation is authoritative and is not re-derived
  // here (SPEC-AEE-001 §5: "Journey Spine remains authoritative").
  //
  // BLOCKED capabilities are never presented as primary/secondary (executable)
  // — Part VIII §17 check 2 forbids a blocked action from being presented as
  // executable. They are still shown as 'suppressed' surfaces (visible but
  // inert), never dropped silently.
  const readyIds = new Set(context.journey?.readyStageIds ?? []);
  const blockedIds = new Set(context.journey?.blockedStageIds ?? []);

  const actionable = capabilityRefs.filter((ref) => !blockedIds.has(ref.capabilityId));
  const blocked = capabilityRefs.filter((ref) => blockedIds.has(ref.capabilityId));

  const orderedActionable = [...actionable].sort((a, b) => {
    const aReady = readyIds.has(a.capabilityId) ? 0 : 1;
    const bReady = readyIds.has(b.capabilityId) ? 0 : 1;
    return aReady - bReady;
  });

  const primary = orderedActionable[0];
  const secondary = orderedActionable.slice(1);

  // `handoffOffered` mirrors each capability's own
  // `disposition.nativeHandoffAllowed` (operator ruling, 2026-08-27) —
  // marking a surface/action as handoff-offered whenever its disposition
  // permits one, regardless of whether direct render is ALSO allowed (e.g.
  // Architect's preview: render:true AND a handoff to the full artifact are
  // both legitimate at once). projectionValidator.ts's checks 6-7 are the
  // enforcement point that actually requires this for a NATIVE_ONLY
  // capability to be offerable at all — but those checks are scoped to
  // non-native provider output (see that file's header), so this native
  // provider setting the flag is about DOWNSTREAM handoff-issuance callers
  // (services/adaptive/nativeHandoff.ts::isCapabilityHandoffEligible)
  // reading it correctly, not about passing validation itself.
  const surfaces = [
    ...orderedActionable.map((ref) => ({
      capabilityId: ref.capabilityId,
      surfaceType: ref.surfaceTypes[0] ?? ('component' as const),
      hostRef: ref.hostRefs?.native,
      emphasis:
        ref.capabilityId === primary?.capabilityId
          ? ('primary' as const)
          : ('secondary' as const),
      handoffOffered: ref.disposition.nativeHandoffAllowed,
    })),
    ...blocked.map((ref) => ({
      capabilityId: ref.capabilityId,
      surfaceType: ref.surfaceTypes[0] ?? ('component' as const),
      hostRef: ref.hostRefs?.native,
      emphasis: 'suppressed' as const,
      handoffOffered: ref.disposition.nativeHandoffAllowed,
    })),
  ];

  const projection: ExperienceProjection = {
    projectionId: projectionId(context.contextId, primary?.capabilityId ?? 'none'),
    contextId: context.contextId,
    provider: NATIVE_PROVIDER_ID,
    providerVersion: NATIVE_PROVIDER_VERSION,
    journeyRef: context.journey?.journeyId,
    rationale: primary
      ? { summary: `Selected "${primary.label}" as the primary ready action.`, signalsUsed: [] }
      : { summary: 'No ready capability found; presenting available options in declared order.', signalsUsed: [] },
    primaryAction: primary
      ? {
          capabilityId: primary.capabilityId,
          label: primary.label,
          surfaceRef: primary.hostRefs?.native,
          handoffOffered: primary.disposition.nativeHandoffAllowed,
        }
      : undefined,
    secondaryActions: secondary.map((ref) => ({
      capabilityId: ref.capabilityId,
      label: ref.label,
      surfaceRef: ref.hostRefs?.native,
      handoffOffered: ref.disposition.nativeHandoffAllowed,
    })),
    layout: { mode: 'linear', density: 'normal' },
    surfaces,
    experienceSignalsUsed: [],
    constraintsApplied: context.constitutionalConstraints.map((c) => c.id),
    confidence: primary ? 1 : 0,
    fallback: false,
    level: 1,
  };

  return projection;
}

export const nativeProvider: AdaptiveExperienceProvider = {
  id: NATIVE_PROVIDER_ID,

  async capabilities(): Promise<ProviderCapabilityManifest> {
    return {
      providerId: NATIVE_PROVIDER_ID,
      canRender: false, // native does not render UI itself — it produces a projection the platform's own components render
      canHost: true, // the platform IS the host for native
      canComposeComponents: true,
      canResolveRoutes: false,
      canPersistPresentationState: false,
      supportedProjectionLevels: [0, 1],
      supportedSurfaceTypes: ['component', 'modal', 'route', 'cartridge-tab', 'embed', 'companion-action'],
      dataBoundary: 'projection-only',
      verified: true, // this is our own code, in-process — trivially verified
    };
  },

  async project(input: ProviderProjectionRequest): Promise<ProviderProjectionResponse> {
    return { projection: buildNativeProjection(input) };
  },

  async health(): Promise<ProviderHealth> {
    return { available: true };
  },
};

/** Level 0 — the absolute deterministic fallback when even Level 1 selection
 *  cannot run (e.g. malformed context). Always available, always valid. */
export function buildLevel0Fallback(contextId: string): ExperienceProjection {
  return {
    projectionId: projectionId(contextId, 'level0'),
    contextId,
    provider: NATIVE_PROVIDER_ID,
    providerVersion: NATIVE_PROVIDER_VERSION,
    layout: { mode: 'linear', density: 'normal' },
    surfaces: [],
    constraintsApplied: [],
    fallback: true,
    level: 0,
  };
}
