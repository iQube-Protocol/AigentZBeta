/**
 * services/adaptive/experiencePrescriptionAssembly.ts — the first bridge
 * between CFS-007's renderer-neutral ExperiencePrescription seam and
 * SPEC-AEE-001's live AEE loop (AEE-XP-001 §11, XP-2 convergence,
 * 2026-09-01). Proves the acceptance criteria from the operator directive
 * closing AEE XP-1 (commit c330c32ab) and opening this slice:
 *
 *   1. identical Journey/authority state + different experience context
 *      can produce different ExperiencePrescriptions
 *   2. those prescriptions differ in depth/form, not constitutional
 *      permission
 *   5. unreadable matrix/guide state is explicit and does not masquerade
 *      as beginner status
 *   6. renderer does not independently interpret Journey or authority
 *   8. fallback remains deterministic and useful
 *   9. no new parallel NBE engine (targetStageId is read verbatim from the
 *      already-computed JourneyAeeOutcome, never recomputed)
 */
import { describe, it, expect } from 'vitest';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { assembleExperiencePrescription } from '@/services/adaptive/experiencePrescriptionAssembly';
import type { PersonaMatrixCalibration } from '@/services/strategy/experienceMatrixDeriver';
import type { JourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';
import { liquidExperienceRenderer } from '@/app/triad/components/codex/liquidTemplates/liquidExperienceRenderer';
import { A2UI_SURFACE_PLAN } from '@/services/a2ui/a2uiExperienceRenderer';

/** Minimal fixture — only the fields assembleExperiencePrescription reads
 *  (`nbe.targetStageId`, `nbe.disposition`, `crossingRecommended`) are real;
 *  the rest of JourneyAeeOutcome is irrelevant to this module and stubbed. */
function fakeAeeOutcome(overrides: Partial<JourneyAeeOutcome['nbe']> = {}, crossingRecommended = false): JourneyAeeOutcome {
  return {
    nbe: { targetStageId: 'fs-discover', disposition: 'act', rationale: 'test', source: 'aee', ...overrides },
    crossingRecommended,
  } as unknown as JourneyAeeOutcome;
}

function calibration(overrides: Partial<PersonaMatrixCalibration> = {}): PersonaMatrixCalibration {
  return {
    source: 'default',
    growth: { yMaturity: 1, xCommercialization: 1, zone: 'formation', label: 'Ideation' },
    experience: { engagement: 'Recipient', sovereignty: 'Visitor' },
    ventures: [],
    reason: 'test',
    hasExperienceModel: false,
    uncertain: false,
    ...overrides,
  };
}

describe('assembleExperiencePrescription', () => {
  it('acceptance 1+2: same Journey/AEE outcome, different experience context → different depth, SAME journeyId/stageId/disposition (constitutional permission unchanged)', () => {
    const aee = fakeAeeOutcome();

    const personA = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ experience: { engagement: 'Recipient', sovereignty: 'Visitor' } }),
      surfaceTemplate: 'liquidui:fs-discover-v1',
    });
    const personB = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({
        source: 'venture_qube',
        experience: { engagement: 'Steward', sovereignty: 'Architect' },
      }),
      surfaceTemplate: 'liquidui:fs-discover-v1',
    });

    expect(personA).not.toBeNull();
    expect(personB).not.toBeNull();
    // Depth/form differs (the whole point of this slice).
    expect(personA!.depth).toBe('pill');
    expect(personB!.depth).toBe('mini_runtime');
    expect(personA!.depth).not.toBe(personB!.depth);
    // Everything Journey/authority-derived is byte-identical.
    expect(personA!.props?.journeyId).toBe(personB!.props?.journeyId);
    expect(personA!.props?.stageId).toBe(personB!.props?.stageId);
    expect(personA!.props?.disposition).toBe(personB!.props?.disposition);
    expect(personA!.ctaAction).toBe(personB!.ctaAction);
    expect(personA!.label).toBe(personB!.label);
  });

  it('LEARN stage: same pattern — stage stays LEARN for both, only depth/form varies', () => {
    const aee = fakeAeeOutcome({ targetStageId: 'fs-learn' });
    const novice = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ experience: { engagement: 'Selector', sovereignty: 'Initiate' } }),
      surfaceTemplate: 'liquidui:fs-learn-v1',
    });
    const experienced = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ experience: { engagement: 'Producer', sovereignty: 'Composer' } }),
      surfaceTemplate: 'liquidui:fs-learn-v1',
    });
    expect(novice!.props?.stageId).toBe('fs-learn');
    expect(experienced!.props?.stageId).toBe('fs-learn');
    expect(novice!.depth).toBe('pill');
    expect(experienced!.depth).toBe('capsule');
  });

  it('EXPLORE stage: MoneyPenny-context prescription — novice gets Advisor-depth pill, stronger context gets richer capsule/mini_runtime, runtime authority untouched', () => {
    const aee = fakeAeeOutcome({ targetStageId: 'fs-explore' });
    const novice = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ experience: { engagement: 'Recipient', sovereignty: 'Visitor' } }),
      surfaceTemplate: 'liquidui:fs-explore-v1',
    });
    const architect = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({
        source: 'venture_qube',
        experience: { engagement: 'Builder', sovereignty: 'Architect' },
      }),
      surfaceTemplate: 'liquidui:fs-explore-v1',
    });
    expect(novice!.depth).toBe('pill');
    expect(architect!.depth).toBe('mini_runtime');
    // Experience context never changes WHICH stage/action is recommended —
    // that stays exactly what AEE (Journey-authoritative) already decided.
    expect(novice!.ctaAction).toBe(architect!.ctaAction);
  });

  it('acceptance 5: unreadable matrix state is explicit — never masquerades as a confirmed beginner position', () => {
    const aee = fakeAeeOutcome();
    const confirmedBeginner = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ uncertain: false, experience: { engagement: 'Recipient', sovereignty: 'Visitor' } }),
      surfaceTemplate: 'liquidui:fs-discover-v1',
    });
    const unreadable = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({
        uncertain: true,
        unreadableSources: ['experience_qubes', 'venture_qubes'],
        reason: 'Unable to read experience_qubes, venture_qubes — position is a best-effort default.',
      }),
      surfaceTemplate: 'liquidui:fs-discover-v1',
    });
    // Both fall back to the same safe depth (deterministic + useful, acceptance 8) ...
    expect(confirmedBeginner!.depth).toBe('pill');
    expect(unreadable!.depth).toBe('pill');
    // ... but only the unreadable one is marked as such — never silently
    // indistinguishable from a real confirmed-beginner read.
    expect(confirmedBeginner!.props?.matrixUncertain).toBe(false);
    expect(unreadable!.props?.matrixUncertain).toBe(true);
    expect(unreadable!.props?.matrixUnreadableSources).toEqual(['experience_qubes', 'venture_qubes']);
  });

  it('acceptance 8: no persona/no calibration at all still produces a deterministic, useful pill fallback', () => {
    const aee = fakeAeeOutcome();
    const result = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: null,
      surfaceTemplate: 'liquidui:fs-discover-v1',
    });
    expect(result).not.toBeNull();
    expect(result!.depth).toBe('pill');
    expect(result!.surface).toBe('liquidui:fs-discover-v1');
  });

  it('acceptance 9: never invents reachability — AEE recommending nothing yields no prescription, not a fabricated one', () => {
    const aee = fakeAeeOutcome({ targetStageId: null });
    const result = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ experience: { engagement: 'Steward', sovereignty: 'Architect' } }),
      surfaceTemplate: 'liquidui:fs-discover-v1',
    });
    expect(result).toBeNull();
  });

  it('host-constraint substitution: a host that cannot render "pill" (liquidExperienceRenderer, depths=[capsule,mini_runtime,codex]) gets the closest supported depth, never a dropped prescription', () => {
    const aee = fakeAeeOutcome();
    const result = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration({ experience: { engagement: 'Recipient', sovereignty: 'Visitor' } }),
      surfaceTemplate: 'liquidui:fs-discover-v1',
      supportedDepths: liquidExperienceRenderer.capabilities().depths,
    });
    expect(result).not.toBeNull();
    expect(result!.depth).toBe('capsule');
  });

  it('acceptance 6: the prescription carries no Journey/authority object for a renderer to independently interpret — only the renderer-neutral seam fields', () => {
    const aee = fakeAeeOutcome();
    const result = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration: calibration(),
      surfaceTemplate: A2UI_SURFACE_PLAN,
    });
    expect(result).not.toBeNull();
    const allowedKeys = new Set([
      'surface', 'depth', 'matrixCellKey', 'label', 'ctaLabel', 'ctaAction', 'nextDepth', 'invariantSeedIds', 'props',
    ]);
    for (const key of Object.keys(result!)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
    // journeyId/stageId are opaque string identifiers inside `props`, not a
    // JourneyDefinition/AuthoritativePlatformState object the renderer could
    // introspect and re-derive gating decisions from.
    expect(typeof result!.props?.journeyId).toBe('string');
    expect(result!.props).not.toHaveProperty('journeyDefinition');
    expect(result!.props).not.toHaveProperty('authorityContext');
  });
});
