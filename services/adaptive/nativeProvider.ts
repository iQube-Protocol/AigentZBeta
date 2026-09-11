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
 *
 * Experience-aware presentation (AEE-XP-001 §6 XP-1 follow-up, 2026-09-01):
 * `context.experienceIntent` (assembled by
 * services/adaptive/experienceIntentAssembly.ts) may now influence
 * PRESENTATION — density and ordering among surfaces the Journey Spine has
 * ALREADY approved — never reachability. This function still never reads
 * `context.experienceIntent` to decide what is ready/blocked; that stays
 * exactly `context.journey.readyStageIds`/`blockedStageIds`, untouched.
 * Declared branch intent and observed interactions are read, but only
 * signals relevant to a capability actually present in THIS projection are
 * recorded as "used" — this stays a pure, deterministic function of its
 * input context (no I/O, no clock, no randomness), exactly as before.
 */

import { createHash } from 'crypto';
import type {
  AdaptiveExperienceProvider,
  ExperienceProjection,
  ExperienceSignalRef,
  ProviderCapabilityManifest,
  ProviderHealth,
  ProviderProjectionRequest,
  ProviderProjectionResponse,
} from '@/types/adaptiveExperience';
import type {
  DeclaredPreferencesShape,
  ObservedBehaviorShape,
} from '@/services/adaptive/experienceIntentAssembly';

export const NATIVE_PROVIDER_ID = 'native';
export const NATIVE_PROVIDER_VERSION = '0.1.0';

function projectionId(contextId: string, seed: string): string {
  return createHash('sha256').update(`native-projection:${contextId}:${seed}`).digest('hex').slice(0, 16);
}

/**
 * Reads `context.experienceIntent` for signals RELEVANT to a capability
 * actually present in this projection (`relevantCapabilityIds`) — never the
 * whole raw projection, so a signal about a stage this projection doesn't
 * even offer is never reported as "used". Returns the exact signal strings
 * to record in `experienceSignalsUsed`/`rationale.signalsUsed`, plus the
 * subset of capabilityIds with observed engagement (used for ordering/
 * density below — presentation only, never authority).
 *
 * PURE — reads only its arguments, no I/O.
 */
function extractRelevantExperienceSignals(
  experienceIntent: ProviderProjectionRequest['context']['experienceIntent'],
  relevantCapabilityIds: ReadonlySet<string>,
): { experienceSignalsUsed: ExperienceSignalRef[]; engagedCapabilityIds: Set<string> } {
  const experienceSignalsUsed: ExperienceSignalRef[] = [];
  const engagedCapabilityIds = new Set<string>();
  if (!experienceIntent) return { experienceSignalsUsed, engagedCapabilityIds };

  const declared = experienceIntent.declaredPreferences as DeclaredPreferencesShape | undefined;
  if (declared?.branchIntents) {
    for (const [branch, intent] of Object.entries(declared.branchIntents)) {
      experienceSignalsUsed.push({ signalId: `declared:${branch}=${intent}`, provenance: 'declared' });
    }
  }

  const observed = experienceIntent.observedBehavior as ObservedBehaviorShape | undefined;
  if (observed?.interactions) {
    for (const interaction of observed.interactions) {
      if (!relevantCapabilityIds.has(interaction.stageId)) continue;
      engagedCapabilityIds.add(interaction.stageId);
      experienceSignalsUsed.push({
        signalId: `observed:${interaction.stageId}:${interaction.interactionKind ?? 'engaged'}`,
        provenance: 'observed',
      });
    }
  }

  return { experienceSignalsUsed, engagedCapabilityIds };
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

  // Experience-aware signal extraction — scoped to capabilities THIS
  // projection actually offers (actionable, whether ready or not; blocked
  // capabilities are excluded since they can never be reordered/emphasized
  // regardless of engagement — see the header note above).
  const { experienceSignalsUsed, engagedCapabilityIds } = extractRelevantExperienceSignals(
    context.experienceIntent,
    new Set(actionable.map((ref) => ref.capabilityId)),
  );

  const orderedActionable = [...actionable].sort((a, b) => {
    const aReady = readyIds.has(a.capabilityId) ? 0 : 1;
    const bReady = readyIds.has(b.capabilityId) ? 0 : 1;
    if (aReady !== bReady) return aReady - bReady;
    // Tiebreaker ONLY among equally-reachable capabilities (same readiness):
    // prefer one the visitor has real observed engagement with. Never
    // promotes a not-ready capability ahead of a ready one — the primary
    // sort key above always wins first.
    const aEngaged = engagedCapabilityIds.has(a.capabilityId) ? 0 : 1;
    const bEngaged = engagedCapabilityIds.has(b.capabilityId) ? 0 : 1;
    return aEngaged - bEngaged;
  });

  const primary = orderedActionable[0];
  const secondary = orderedActionable.slice(1);

  // Presentation-only density adaptation: real observed engagement with an
  // offered capability warrants less onboarding verbosity. Never influences
  // which capabilities are offered or their reachability — layout.density
  // is purely a rendering hint the surface may use for spacing/copy length.
  const density: 'compact' | 'normal' = engagedCapabilityIds.size > 0 ? 'compact' : 'normal';

  const surfaces = [
    ...orderedActionable.map((ref) => ({
      capabilityId: ref.capabilityId,
      surfaceType: ref.surfaceTypes[0] ?? ('component' as const),
      hostRef: ref.hostRefs?.native,
      emphasis:
        ref.capabilityId === primary?.capabilityId
          ? ('primary' as const)
          : ('secondary' as const),
    })),
    ...blocked.map((ref) => ({
      capabilityId: ref.capabilityId,
      surfaceType: ref.surfaceTypes[0] ?? ('component' as const),
      hostRef: ref.hostRefs?.native,
      emphasis: 'suppressed' as const,
    })),
  ];

  const projection: ExperienceProjection = {
    projectionId: projectionId(context.contextId, primary?.capabilityId ?? 'none'),
    contextId: context.contextId,
    provider: NATIVE_PROVIDER_ID,
    providerVersion: NATIVE_PROVIDER_VERSION,
    journeyRef: context.journey?.journeyId,
    rationale: primary
      ? {
          summary:
            experienceSignalsUsed.length > 0
              ? `Selected "${primary.label}" as the primary ready action, informed by ${experienceSignalsUsed.length} experience signal(s).`
              : `Selected "${primary.label}" as the primary ready action.`,
          signalsUsed: experienceSignalsUsed.map((s) => s.signalId),
        }
      : {
          summary: 'No ready capability found; presenting available options in declared order.',
          signalsUsed: experienceSignalsUsed.map((s) => s.signalId),
        },
    primaryAction: primary
      ? { capabilityId: primary.capabilityId, label: primary.label, surfaceRef: primary.hostRefs?.native }
      : undefined,
    secondaryActions: secondary.map((ref) => ({
      capabilityId: ref.capabilityId,
      label: ref.label,
      surfaceRef: ref.hostRefs?.native,
    })),
    layout: { mode: 'linear', density },
    surfaces,
    experienceSignalsUsed,
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
