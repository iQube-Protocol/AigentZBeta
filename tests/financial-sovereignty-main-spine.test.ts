/**
 * AEE-XP-001 §4.2/§15 Phase 1 — the Financial Sovereignty DISCOVER/LEARN/
 * EXPLORE/PREPARE/CROSS segment added to both KNYTS Bridge and the
 * Constitutional Internet Bridge (2026-09-01). Structural canary: pins the
 * stage grammar, chain order, and the "no fabricated evidence" gate-less
 * discipline this file's own journeys already use for HOME/VIEW/ORIENT/CHOOSE
 * — never a hidden completionEvidence key resolveJourneyState can't satisfy.
 */
import { describe, it, expect } from 'vitest';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import type { JourneyDefinition } from '@/types/journey';
import { readSource, stripComments } from './_lib/sourceAuthority';

const FS_STAGE_IDS = ['fs-discover', 'fs-learn', 'fs-explore', 'fs-prepare', 'fs-cross'];

function stageIndex(journey: JourneyDefinition, id: string) {
  return journey.stages.findIndex((s) => s.id === id);
}

describe.each([
  ['KNYTS Bridge', KNYTS_BRIDGE_CROSSING_JOURNEY],
  ['Constitutional Internet Bridge', CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY],
])('%s — Financial Sovereignty segment', (_label, journey) => {
  it('declares all five stages, in DISCOVER->LEARN->EXPLORE->PREPARE->CROSS order', () => {
    const indices = FS_STAGE_IDS.map((id) => stageIndex(journey, id));
    expect(indices.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('chains nextStageId through the segment, ending at fs-cross with no nextStageId', () => {
    const byId = new Map(journey.stages.map((s) => [s.id, s]));
    expect(byId.get('fs-discover')?.nextStageId).toBe('fs-learn');
    expect(byId.get('fs-learn')?.nextStageId).toBe('fs-explore');
    expect(byId.get('fs-explore')?.nextStageId).toBe('fs-prepare');
    expect(byId.get('fs-prepare')?.nextStageId).toBe('fs-cross');
    expect(byId.get('fs-cross')?.nextStageId).toBeUndefined();
  });

  it('every FS stage has empty prerequisites; fs-discover/fs-learn/fs-explore each carry real, distinct completionEvidence; fs-prepare/fs-cross remain gate-less this pass', () => {
    // AEE-XP-001 §10/XP-6 (2026-09-01) + follow-up: fs-discover/fs-learn/
    // fs-explore are the live proof of the generic experience-evidence loop
    // (services/journey/experienceObservationPromotion.ts +
    // financialSovereigntyEvidence.ts) — each stage's completionEvidence is
    // real, sourced from an actual observed (and, for LEARN/EXPLORE,
    // kind-discriminated) interaction, never fabricated. fs-prepare/fs-cross
    // remain gate-less this pass — not yet wired.
    const EXPECTED: Record<string, string[]> = {
      'fs-discover': ['discoverExperienceObserved'],
      'fs-learn': ['learnExperienceQualified'],
      'fs-explore': ['exploreCapabilityInteracted'],
    };
    for (const id of FS_STAGE_IDS) {
      const stage = journey.stages.find((s) => s.id === id)!;
      expect(stage.prerequisites).toEqual([]);
      expect(stage.completionEvidence).toEqual(EXPECTED[id] ?? []);
    }
  });

  it('the FS segment is a branch AFTER CHOOSE, not before it (AEE-XP-001 §4, Main Spine 2026-09-01 correction: canonical order CHOOSE → DISCOVER → LEARN → EXPLORE → PREPARE → CROSS)', () => {
    const chooseIndex = stageIndex(journey, 'choose');
    expect(chooseIndex).toBeLessThan(stageIndex(journey, 'fs-discover'));
  });

  it('every FS stage carries activationBranch — dormant until the branch is activated, never permanently visible in the stepper', () => {
    for (const id of FS_STAGE_IDS) {
      const stage = journey.stages.find((s) => s.id === id)!;
      expect(stage.activationBranch).toBe('financial-services');
    }
  });

  it('no stage id is duplicated by adding the FS segment', () => {
    const ids = journey.stages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('FinancialSovereigntyPrepareCrossStage — CROSS handoff field population (AEE-XP-001 §5)', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));
  const handoffCallStart = src.indexOf('createExperienceHandoff({');
  const handoffCallBody = src.slice(handoffCallStart, src.indexOf('});', handoffCallStart));

  it('populates recommendedExperienceAltitude with the canonical depth-ladder "codex" tier — the FS Bridge is a full persistent, copilot-enabled journey', () => {
    expect(handoffCallStart).toBeGreaterThan(-1);
    expect(handoffCallBody).toMatch(/recommendedExperienceAltitude:\s*'codex'/);
  });

  it('does NOT fabricate experienceEvidenceRefs — every fs-* stage has empty completionEvidence, so there is nothing real to reference', () => {
    expect(handoffCallBody).not.toMatch(/experienceEvidenceRefs\s*:/);
  });

  it('still preserves source journey, source stage, financial intent, and return/resume context (AEE-XP-001 §5 preservation requirement)', () => {
    expect(handoffCallBody).toMatch(/sourceJourneyId/);
    expect(handoffCallBody).toMatch(/sourceStageId/);
    // intent carries the ACTUAL declared branch-activation intent
    // (LEARN_FINANCIAL_SERVICES / JOIN_FINANCIAL_SERVICES), read from
    // getJourneyBranchIntent — never a fixed generic label.
    expect(handoffCallBody).toMatch(/intent:\s*\n?\s*getJourneyBranchIntent\(sourceJourneyId, FINANCIAL_SERVICES_BRANCH\)/);
    expect(handoffCallBody).toMatch(/returnJourneyId:\s*sourceJourneyId/);
    expect(handoffCallBody).toMatch(/returnStageId:\s*returnStageId/);
  });

  it('falls back to JOIN_FINANCIAL_SERVICES only when no intent was ever declared (a direct deep link that skipped the Choose trigger) — never fabricates a different declared intent', () => {
    expect(src).toMatch(/getJourneyBranchIntent\(sourceJourneyId, FINANCIAL_SERVICES_BRANCH\) \?\? DEFAULT_FINANCIAL_SERVICES_INTENT/);
    expect(src).toMatch(/DEFAULT_FINANCIAL_SERVICES_INTENT = 'JOIN_FINANCIAL_SERVICES'/);
  });
});

describe('JourneyRunSurface — dormant-branch stepper filtering (AEE-XP-001 §4, Main Spine 2026-09-01 correction)', () => {
  const src = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));

  it('imports isJourneyBranchActivated and gates BOTH spineStages and forkStages through it', () => {
    expect(src).toMatch(/from '@\/services\/journey\/journeyBranchActivation'/);
    expect(src).toMatch(/isJourneyBranchActivated\(journey\.id, s\.activationBranch\)/);
    const spineLine = src.match(/const spineStages = journey\.stages\.filter\([^;]+;/)?.[0] ?? '';
    const forkLine = src.match(/const forkStages = journey\.stages\.filter\([^;]+;/)?.[0] ?? '';
    expect(spineLine).toMatch(/isStageVisible/);
    expect(forkLine).toMatch(/isStageVisible/);
  });

  it('a stage with no activationBranch is always visible — the filter is purely additive', () => {
    expect(src).toMatch(/!s\.activationBranch \|\| isJourneyBranchActivated/);
  });
});

describe('ConstitutionalInternetBridgeChooseSurface — new Financial Services branch trigger (CI had none before)', () => {
  const src = stripComments(readSource('components/journey/ConstitutionalInternetBridgeChooseSurface.tsx'));

  it('has a "Join Financial Services" card that activates the financial-services branch at fs-discover', () => {
    const idx = src.indexOf('label="Join Financial Services"');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('activateJourneyBranch(');
    expect(block).toContain('CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.id');
    expect(block).toContain("'financial-services'");
    expect(block).toContain("'JOIN_FINANCIAL_SERVICES'");
    expect(block).toContain("'fs-discover'");
  });
});
