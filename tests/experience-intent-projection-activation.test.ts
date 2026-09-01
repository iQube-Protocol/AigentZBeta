/**
 * ExperienceIntentProjection activation, end-to-end (AEE-XP-001 §6 XP-1
 * follow-up, 2026-09-01). `ExperienceIntentProjection` and
 * `JourneyAeeInput.experience` already existed; this proves the live
 * KNYTS/CI callers now populate them, and that the native provider
 * consumes the result for PRESENTATION only — never reachability,
 * completion, or authority.
 *
 * declared/observed sources exercised here are the REAL live ones:
 *   declared — runtimeState.activatedBranches (already relayed server-side
 *     via the existing ?activatedBranches=branch:intent param — no new
 *     relay was needed).
 *   observed — experience_interaction_observed receipts, read via
 *     listObservedExperienceInteractions (services/journey/
 *     experienceObservationPromotion.ts), mocked here at the Supabase
 *     boundary (services/receipts/activityReceiptService.ts) the same way
 *     other service-layer tests in this suite do.
 *   inferred — deliberately never populated this pass (no legitimate
 *     inference source identified).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdaptiveInteractionContext } from '@/types/adaptiveExperience';
import { CONSTITUTIONAL_PROJECTION_CONSTRAINTS } from '@/services/adaptive/journeySpineAdapter';
import { buildNativeProjection } from '@/services/adaptive/nativeProvider';
import { readSource, stripComments } from './_lib/sourceAuthority';

let mockReceipts: Array<{ actionInput: Record<string, unknown>; createdAt: string }> = [];

vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: async () => mockReceipts,
  createActivityReceipt: vi.fn(),
}));

// Imported AFTER the mock so the module under test picks up the mocked dep.
const { assembleExperienceIntentProjection } = await import('@/services/adaptive/experienceIntentAssembly');
import type { JourneyRuntimeState } from '@/types/journey';

function runtimeStateWith(overrides: Partial<JourneyRuntimeState> = {}): JourneyRuntimeState {
  return {
    journeyId: 'knyts-bridge-crossing',
    journeyVersion: '1.0.0',
    subjectRef: 'visitor',
    currentStageId: 'choose',
    stages: [],
    complete: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockReceipts = [];
});

describe('assembleExperienceIntentProjection — declared preferences (acceptance 2, 3)', () => {
  it('no declared branch and no observed receipts -> returns undefined (acceptance 1 precondition: nothing to project)', async () => {
    const result = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith(),
    });
    expect(result).toBeUndefined();
  });

  it('LEARN_FINANCIAL_SERVICES arrives in declaredPreferences.branchIntents, provenance.declared is populated, observedBehavior/inferredPreferences stay absent', async () => {
    const result = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith({ activatedBranches: { 'financial-services': 'LEARN_FINANCIAL_SERVICES' } }),
    });
    expect(result).toBeDefined();
    expect((result!.declaredPreferences as any).branchIntents).toEqual({ 'financial-services': 'LEARN_FINANCIAL_SERVICES' });
    expect(result!.provenance.declared).toContain('journey:activatedBranches');
    expect(result!.observedBehavior).toBeUndefined();
    expect(result!.inferredPreferences).toBeUndefined();
  });

  it('JOIN_FINANCIAL_SERVICES is distinguishable from LEARN_FINANCIAL_SERVICES — never collapsed into a single "engaged" flag', async () => {
    const learn = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith({ activatedBranches: { 'financial-services': 'LEARN_FINANCIAL_SERVICES' } }),
    });
    const join = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith({ activatedBranches: { 'financial-services': 'JOIN_FINANCIAL_SERVICES' } }),
    });
    expect((learn!.declaredPreferences as any).branchIntents['financial-services']).toBe('LEARN_FINANCIAL_SERVICES');
    expect((join!.declaredPreferences as any).branchIntents['financial-services']).toBe('JOIN_FINANCIAL_SERVICES');
    expect((learn!.declaredPreferences as any).branchIntents['financial-services']).not.toBe(
      (join!.declaredPreferences as any).branchIntents['financial-services'],
    );
  });
});

describe('assembleExperienceIntentProjection — observed behavior (acceptance 4, 5)', () => {
  it('real experience_interaction_observed receipts for this journey appear under observedBehavior.interactions', async () => {
    mockReceipts = [
      {
        actionInput: {
          experienceRef: 'knyts-bridge-crossing:fs-learn',
          interactionKind: 'learn-concept-acknowledged',
          capabilityId: 'advisor',
        },
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ];
    const result = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith(),
    });
    expect(result).toBeDefined();
    expect((result!.observedBehavior as any).interactions).toEqual([
      { stageId: 'fs-learn', interactionKind: 'learn-concept-acknowledged', capabilityId: 'advisor' },
    ]);
    expect(result!.provenance.observed).toContain('experience_interaction_observed');
  });

  it('a receipt from a DIFFERENT journey is excluded — never leaks cross-journey observed evidence', async () => {
    mockReceipts = [
      {
        actionInput: { experienceRef: 'constitutional-internet-bridge:fs-explore', interactionKind: 'moneypenny-capability-interacted', capabilityId: 'moneypenny.advisor' },
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ];
    const result = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith(),
    });
    expect(result).toBeUndefined();
  });

  it('observed behavior never silently appears under declaredPreferences — the two stay structurally separate top-level fields', async () => {
    mockReceipts = [
      { actionInput: { experienceRef: 'knyts-bridge-crossing:fs-discover', interactionKind: null, capabilityId: null }, createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const result = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith(),
    });
    expect(result!.declaredPreferences).toBeUndefined();
    expect(result!.observedBehavior).toBeDefined();
    expect(result!.provenance.declared).toEqual([]);
  });
});

describe('assembleExperienceIntentProjection — inferred preferences (acceptance 6)', () => {
  it('inferredPreferences is always undefined this pass — no invented inference source, even with both declared and observed present', async () => {
    mockReceipts = [
      { actionInput: { experienceRef: 'knyts-bridge-crossing:fs-discover', interactionKind: null, capabilityId: null }, createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const result = await assembleExperienceIntentProjection({
      personaId: 'persona-1',
      journeyId: 'knyts-bridge-crossing',
      runtimeState: runtimeStateWith({ activatedBranches: { 'financial-services': 'JOIN_FINANCIAL_SERVICES' } }),
    });
    expect(result!.inferredPreferences).toBeUndefined();
    expect(result!.provenance.inferred).toEqual([]);
  });

  it('is a pure read: never imports a mutation/persistence function', () => {
    const src = stripComments(readSource('services/adaptive/experienceIntentAssembly.ts'));
    expect(src).not.toMatch(/createActivityReceipt|resolveJourneyState/);
  });
});

function baseNativeContext(overrides: Partial<AdaptiveInteractionContext> = {}): AdaptiveInteractionContext {
  return {
    contextId: 'ctx-exp-test-0001',
    participantRef: 'persona-ref-abc',
    journey: {
      journeyId: 'test-journey',
      journeyVersion: '1.0.0',
      currentStageId: 'a',
      completedStageIds: [],
      readyStageIds: ['a', 'c'],
      optionalStageIds: [],
      waitingStageIds: [],
      blockedStageIds: ['b'],
    },
    capabilityRefs: [
      { capabilityId: 'a', label: 'Stage A', surfaceTypes: ['component'], hostRefs: { native: 'a-panel' } },
      { capabilityId: 'b', label: 'Stage B', surfaceTypes: ['component'], hostRefs: { native: 'b-panel' } },
      { capabilityId: 'c', label: 'Stage C', surfaceTypes: ['component'], hostRefs: { native: 'c-panel' } },
    ],
    host: { hostId: 'metame-native', surfaceTypesSupported: ['component'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: CONSTITUTIONAL_PROJECTION_CONSTRAINTS,
    generatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('nativeProvider — experience-aware presentation (acceptance 1, 7, 8, and never-authority guarantees)', () => {
  it('no experienceIntent -> byte-identical to pre-activation behavior: empty experienceSignalsUsed, density "normal", ordering unchanged', () => {
    const projection = buildNativeProjection({ context: baseNativeContext() });
    expect(projection.experienceSignalsUsed).toEqual([]);
    expect(projection.layout.density).toBe('normal');
    expect(projection.primaryAction?.capabilityId).toBe('a');
    expect(projection.rationale?.summary).toBe('Selected "Stage A" as the primary ready action.');
  });

  it('a declared branch intent is reported in experienceSignalsUsed with provenance "declared", and mentioned in the rationale', () => {
    const context = baseNativeContext({
      experienceIntent: {
        declaredPreferences: { branchIntents: { 'financial-services': 'JOIN_FINANCIAL_SERVICES' } } as any,
        provenance: { declared: ['journey:activatedBranches'], observed: [], inferred: [] },
      },
    });
    const projection = buildNativeProjection({ context });
    expect(projection.experienceSignalsUsed).toEqual([
      { signalId: 'declared:financial-services=JOIN_FINANCIAL_SERVICES', provenance: 'declared' },
    ]);
    expect(projection.rationale?.summary).toContain('informed by 1 experience signal(s)');
  });

  it('an observed interaction on a capability NOT present in this projection is never counted — no signal, no engagement, no reordering', () => {
    const context = baseNativeContext({
      experienceIntent: {
        observedBehavior: { interactions: [{ stageId: 'not-in-this-projection', interactionKind: 'x', capabilityId: null }] } as any,
        provenance: { declared: [], observed: ['experience_interaction_observed'], inferred: [] },
      },
    });
    const projection = buildNativeProjection({ context });
    expect(projection.experienceSignalsUsed).toEqual([]);
    expect(projection.layout.density).toBe('normal');
  });

  it('acceptance 8: the SAME journey/capabilityRefs with DIFFERENT experience context yields a different presentation (ordering + density) while reachability (readyStageIds/blockedStageIds) is identical', () => {
    const withoutExperience = baseNativeContext();
    const withExperience = baseNativeContext({
      experienceIntent: {
        observedBehavior: { interactions: [{ stageId: 'c', interactionKind: 'engaged', capabilityId: null }] } as any,
        provenance: { declared: [], observed: ['experience_interaction_observed'], inferred: [] },
      },
    });
    // Reachability is identical between the two contexts — same fixture.
    expect(withExperience.journey?.readyStageIds).toEqual(withoutExperience.journey?.readyStageIds);
    expect(withExperience.journey?.blockedStageIds).toEqual(withoutExperience.journey?.blockedStageIds);

    const p1 = buildNativeProjection({ context: withoutExperience });
    const p2 = buildNativeProjection({ context: withExperience });

    // 'a' and 'c' are equally ready; without experience, declared order wins
    // (a first). With observed engagement on 'c', c is promoted ahead of a
    // among the equally-ready set — a genuinely different presentation.
    expect(p1.primaryAction?.capabilityId).toBe('a');
    expect(p2.primaryAction?.capabilityId).toBe('c');
    expect(p1.layout.density).toBe('normal');
    expect(p2.layout.density).toBe('compact');

    // But the SET of what is actionable vs blocked/suppressed is unchanged —
    // experience never altered reachability.
    const actionableIds1 = p1.surfaces.filter((s) => s.emphasis !== 'suppressed').map((s) => s.capabilityId).sort();
    const actionableIds2 = p2.surfaces.filter((s) => s.emphasis !== 'suppressed').map((s) => s.capabilityId).sort();
    expect(actionableIds1).toEqual(actionableIds2);
    expect(actionableIds1).toEqual(['a', 'c']);
  });

  it('never makes a BLOCKED capability actionable, even with strong observed engagement on it', () => {
    const context = baseNativeContext({
      experienceIntent: {
        observedBehavior: { interactions: [{ stageId: 'b', interactionKind: 'engaged', capabilityId: null }] } as any,
        provenance: { declared: [], observed: ['experience_interaction_observed'], inferred: [] },
      },
    });
    const projection = buildNativeProjection({ context });
    // 'b' is blocked in the fixture — must stay suppressed regardless of engagement.
    const bSurface = projection.surfaces.find((s) => s.capabilityId === 'b');
    expect(bSurface?.emphasis).toBe('suppressed');
    expect(projection.primaryAction?.capabilityId).not.toBe('b');
    expect(projection.secondaryActions?.some((a) => a.capabilityId === 'b')).toBe(false);
  });

  it('never marks anything complete or mutates the input context — structurally a pure function (no resolveJourneyState/mutation import)', () => {
    const src = stripComments(readSource('services/adaptive/nativeProvider.ts'));
    expect(src).not.toMatch(/resolveJourneyState|createActivityReceipt|JourneyStageStatus\.COMPLETE/);
  });

  it('experience preference never becomes authority: constraintsApplied is derived only from context.constitutionalConstraints, untouched by experienceIntent', () => {
    const context = baseNativeContext({
      experienceIntent: {
        declaredPreferences: { branchIntents: { x: 'JOIN_FINANCIAL_SERVICES' } } as any,
        provenance: { declared: ['journey:activatedBranches'], observed: [], inferred: [] },
      },
    });
    const projection = buildNativeProjection({ context });
    expect(projection.constraintsApplied).toEqual(CONSTITUTIONAL_PROJECTION_CONSTRAINTS.map((c) => c.id));
  });
});

describe('CI and KNYTS state routes use exactly the same experience-assembly path (acceptance 10)', () => {
  it('both import assembleExperienceIntentProjection from the SAME shared module — no Bridge-specific experience model', () => {
    for (const routePath of [
      'app/api/journey/knyts-bridge/state/route.ts',
      'app/api/journey/constitutional-internet-bridge/state/route.ts',
    ]) {
      const src = stripComments(readSource(routePath));
      expect(src, `${routePath} missing the shared assembler import`).toMatch(
        /import \{ assembleExperienceIntentProjection \} from '@\/services\/adaptive\/experienceIntentAssembly'/,
      );
      expect(src, `${routePath} does not call the assembler`).toMatch(
        /const experience = await assembleExperienceIntentProjection\(\{/,
      );
      expect(src, `${routePath} does not thread experience into computeJourneyAeeOutcome`).toMatch(/experience,/);
    }
  });

  it('neither route defines a second/local assembly function — only the shared import is used', () => {
    for (const routePath of [
      'app/api/journey/knyts-bridge/state/route.ts',
      'app/api/journey/constitutional-internet-bridge/state/route.ts',
    ]) {
      const src = stripComments(readSource(routePath));
      expect(src).not.toMatch(/function assembleExperienceIntentProjection/);
    }
  });
});
