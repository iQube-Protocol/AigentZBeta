/**
 * Adaptive Experience Engine — Phase A core contracts canary
 * (SPEC-AEE-001, codexes/packs/agentiq/updates/
 * 2026-08-24_aee-differ-phase0-audit-financial-services.md).
 *
 * Pins the PURE surface: native provider Level 1 selection, the postflight
 * validator's constitutional checks, the honest Differ adapter (unavailable
 * by construction — no fabricated capability), the engine's fail-closed
 * fallback loop, and the Journey Spine adapter's context assembly. No
 * network, no database — every fixture is constructed in-memory.
 */

import { describe, it, expect } from 'vitest';
import type { AdaptiveInteractionContext, ExperienceProjection } from '@/types/adaptiveExperience';
import type { InteractionContext, JourneyDefinition, JourneyRuntimeState } from '@/types/journey';
import { ActorRole } from '@/types/journey';
import { nativeProvider, buildNativeProjection, buildLevel0Fallback } from '@/services/adaptive/nativeProvider';
import { differAdapter, DifferUnavailableError } from '@/services/adaptive/providers/differAdapter';
import { validateProjection } from '@/services/adaptive/projectionValidator';
import { produceExperienceProjection } from '@/services/adaptive/adaptiveExperienceEngine';
import {
  buildAdaptiveInteractionContext,
  buildCapabilityRefsFromJourney,
  CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
} from '@/services/adaptive/journeySpineAdapter';
import {
  FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
  EXTERNAL_RENDER_ALLOWED_STAGE_IDS,
} from '@/services/adaptive/applicationProjectionManifest';

function baseContext(overrides: Partial<AdaptiveInteractionContext> = {}): AdaptiveInteractionContext {
  return {
    contextId: 'ctx-test-0001',
    participantRef: 'persona-ref-abc',
    journey: {
      journeyId: 'test-journey',
      journeyVersion: '1.0.0',
      currentStageId: 'a',
      completedStageIds: [],
      readyStageIds: ['a'],
      optionalStageIds: [],
      waitingStageIds: [],
      blockedStageIds: ['b'],
    },
    capabilityRefs: [
      { capabilityId: 'a', label: 'Stage A', surfaceTypes: ['component'], hostRefs: { native: 'a-panel' } },
      { capabilityId: 'b', label: 'Stage B', surfaceTypes: ['component'], hostRefs: { native: 'b-panel' } },
    ],
    host: { hostId: 'metame-native', surfaceTypesSupported: ['component'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
    generatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('nativeProvider — Level 1 selection (SPEC-AEE-001 §9)', () => {
  it('selects the ready capability as primaryAction, never the blocked one', () => {
    const context = baseContext();
    const projection = buildNativeProjection({ context });
    expect(projection.primaryAction?.capabilityId).toBe('a');
    expect(projection.level).toBe(1);
    expect(projection.fallback).toBe(false);
  });

  it('is deterministic — same context produces the same projectionId', () => {
    const context = baseContext();
    const p1 = buildNativeProjection({ context });
    const p2 = buildNativeProjection({ context });
    expect(p1.projectionId).toBe(p2.projectionId);
  });

  it('capabilities() reports verified:true — this is our own in-process code', async () => {
    const manifest = await nativeProvider.capabilities();
    expect(manifest.verified).toBe(true);
    expect(manifest.supportedProjectionLevels).toEqual([0, 1]);
  });

  it('buildLevel0Fallback always returns an empty, valid, fallback-flagged projection', () => {
    const fb = buildLevel0Fallback('ctx-x');
    expect(fb.level).toBe(0);
    expect(fb.fallback).toBe(true);
    expect(fb.surfaces).toEqual([]);
  });
});

describe('differAdapter — honest unavailability, never a fabricated capability', () => {
  it('capabilities() reports verified:false with every capability flag false', async () => {
    const manifest = await differAdapter.capabilities();
    expect(manifest.verified).toBe(false);
    expect(manifest.canRender).toBe(false);
    expect(manifest.canHost).toBe(false);
    expect(manifest.canComposeComponents).toBe(false);
    expect(manifest.canResolveRoutes).toBe(false);
    expect(manifest.supportedProjectionLevels).toEqual([]);
    expect(manifest.unavailableReason).toBeTruthy();
  });

  it('project() throws DifferUnavailableError rather than returning a fabricated projection', async () => {
    await expect(differAdapter.project({ context: baseContext() })).rejects.toBeInstanceOf(DifferUnavailableError);
  });

  it('health() reports unavailable', async () => {
    const health = await differAdapter.health!();
    expect(health.available).toBe(false);
  });
});

describe('projectionValidator — Part VIII constitutional checks', () => {
  it('rejects a projection whose primaryAction is a BLOCKED capability', () => {
    const context = baseContext();
    const badProjection: ExperienceProjection = {
      projectionId: 'p1',
      contextId: context.contextId,
      provider: 'test',
      primaryAction: { capabilityId: 'b', label: 'Stage B' },
      layout: { mode: 'linear', density: 'normal' },
      surfaces: [{ capabilityId: 'b', surfaceType: 'component', emphasis: 'primary' }],
      constraintsApplied: [],
      level: 1,
    };
    const result = validateProjection(badProjection, context);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('BLOCKED'))).toBe(true);
  });

  it('rejects a projection referencing an unknown capabilityId', () => {
    const context = baseContext();
    const badProjection: ExperienceProjection = {
      projectionId: 'p2',
      contextId: context.contextId,
      provider: 'test',
      layout: { mode: 'linear', density: 'normal' },
      surfaces: [{ capabilityId: 'nonexistent', surfaceType: 'component', emphasis: 'primary' }],
      constraintsApplied: [],
      level: 1,
    };
    const result = validateProjection(badProjection, context);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('unknown capabilityId'))).toBe(true);
  });

  it('rejects a projection whose contextId does not match the requesting context', () => {
    const context = baseContext();
    const badProjection: ExperienceProjection = {
      projectionId: 'p3',
      contextId: 'wrong-context-id',
      provider: 'test',
      layout: { mode: 'linear', density: 'normal' },
      surfaces: [],
      constraintsApplied: [],
      level: 1,
    };
    const result = validateProjection(badProjection, context);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('does not match'))).toBe(true);
  });

  it('accepts a valid native projection', () => {
    const context = baseContext();
    const projection = buildNativeProjection({ context });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe('adaptiveExperienceEngine — fail-closed to native (SPEC-AEE-001 §16)', () => {
  it('falls back to native when the Differ adapter is requested (Differ is unverified)', async () => {
    const context = baseContext();
    const outcome = await produceExperienceProjection(context, differAdapter);
    expect(outcome.providerAttempted).toBe('differ');
    expect(outcome.providerUsed).toBe('native');
    expect(outcome.fellBackToNative).toBe(true);
    expect(outcome.fallbackReason).toBeTruthy();
    // The action remains available through the platform — native still
    // produces a real, valid projection, never an empty failure.
    expect(outcome.projection.primaryAction?.capabilityId).toBe('a');
  });

  it('uses native directly when native is requested (no fallback needed)', async () => {
    const context = baseContext();
    const outcome = await produceExperienceProjection(context, nativeProvider);
    expect(outcome.fellBackToNative).toBe(false);
    expect(outcome.providerUsed).toBe('native');
  });
});

describe('journeySpineAdapter — reshapes Journey Spine truth, never re-derives it', () => {
  const journeyDefinition: JourneyDefinition = {
    id: 'fixture-journey',
    version: '1.0.0',
    label: 'Fixture Journey',
    subjectRef: 'fixture',
    stages: [
      {
        id: 'principal-stage',
        label: 'Principal Stage',
        description: 'A principal-only stage',
        actor: 'operator',
        subjectRef: 'fixture',
        surfaces: [{ mode: 'component', ref: 'principal-panel' }],
        prerequisites: [],
        permittedActions: [],
        completionEvidence: ['x'],
        receiptTypes: [],
        companion: { before: '', complete: '' },
        actorRole: ActorRole.PRINCIPAL,
      },
      {
        id: 'safe-stage',
        label: 'Safe Stage',
        description: 'A non-sensitive read-only stage',
        actor: 'system',
        subjectRef: 'fixture',
        surfaces: [{ mode: 'component', ref: 'safe-panel' }],
        prerequisites: [],
        permittedActions: [],
        completionEvidence: [],
        receiptTypes: [],
        companion: { before: '', complete: '' },
        actorRole: ActorRole.SYSTEM,
      },
    ],
  };

  it('marks a PRINCIPAL-actorRole stage sensitive by default', () => {
    const refs = buildCapabilityRefsFromJourney(journeyDefinition, new Set());
    const principalRef = refs.find((r) => r.capabilityId === 'principal-stage');
    expect(principalRef?.sensitive).toBe(true);
  });

  it('does not mark a system-actor stage sensitive by default', () => {
    const refs = buildCapabilityRefsFromJourney(journeyDefinition, new Set());
    const safeRef = refs.find((r) => r.capabilityId === 'safe-stage');
    expect(safeRef?.sensitive).toBe(false);
  });

  it('respects an explicit nonSensitiveStageIds override', () => {
    const refs = buildCapabilityRefsFromJourney(journeyDefinition, new Set(['principal-stage']));
    const principalRef = refs.find((r) => r.capabilityId === 'principal-stage');
    expect(principalRef?.sensitive).toBe(false);
  });

  it('builds a full AdaptiveInteractionContext from Journey Spine state without altering it', () => {
    const journeyState: JourneyRuntimeState = {
      journeyId: 'fixture-journey',
      journeyVersion: '1.0.0',
      subjectRef: 'fixture',
      currentStageId: 'safe-stage',
      stages: [],
      complete: false,
    };
    const interactionContext: InteractionContext = {
      participantRef: 'persona-ref-xyz',
      journeyId: 'fixture-journey',
      journeyVersion: '1.0.0',
      currentStageId: 'safe-stage',
      readyStageIds: ['safe-stage'],
      completedStageIds: [],
      waitingStageIds: [],
      blockedStageIds: ['principal-stage'],
      optionalStageIds: [],
      availableCapabilities: [],
      requiredConditions: [],
    };

    const context = buildAdaptiveInteractionContext({
      journeyDefinition,
      journeyState,
      interactionContext,
      hostId: 'metame-native',
      nonSensitiveStageIds: ['safe-stage'],
      generatedAt: '2026-08-24T00:00:00.000Z',
    });

    expect(context.journey?.journeyId).toBe('fixture-journey');
    expect(context.journey?.blockedStageIds).toEqual(['principal-stage']);
    expect(context.capabilityRefs).toHaveLength(2);
    expect(context.participantRef).toBe('persona-ref-xyz');
    // Authority is never manufactured here — it passes through verbatim (or absent).
    expect(context.authorityContext).toBeUndefined();
  });
});

describe('Application Projection Manifest v0.1 — Financial Services slice', () => {
  it('never assigns a differ hostRef anywhere (no verified Differ host exists)', () => {
    for (const route of FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST.routes) {
      expect((route.hostRefs as Record<string, unknown>).differ).toBeUndefined();
    }
    expect(FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST.hostPolicy.nativeOnly).toBe(true);
  });

  it('classifies every consequential MoneyPenny Runtime service as NATIVE_ONLY', () => {
    const runtimeServices = FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST.moneyPennyServices.filter(
      (s) => s.providerMode === 'RUNTIME',
    );
    expect(runtimeServices.length).toBeGreaterThan(0);
    for (const svc of runtimeServices) {
      expect(svc.residency).toBe('NATIVE_ONLY');
    }
  });

  it('never classifies passport or delegate stages as externally renderable', () => {
    for (const stageId of ['passport', 'delegate', 'register', 'claim']) {
      expect(EXTERNAL_RENDER_ALLOWED_STAGE_IDS).not.toContain(stageId);
    }
  });
});
