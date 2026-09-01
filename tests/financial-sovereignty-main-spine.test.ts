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

  it('every FS stage is gate-less (empty prerequisites + completionEvidence) — an honest informational/handoff segment, never fabricated evidence', () => {
    for (const id of FS_STAGE_IDS) {
      const stage = journey.stages.find((s) => s.id === id)!;
      expect(stage.prerequisites).toEqual([]);
      expect(stage.completionEvidence).toEqual([]);
    }
  });

  it('the CHOOSE stage still exists, after the FS segment', () => {
    const chooseIndex = stageIndex(journey, 'choose');
    expect(chooseIndex).toBeGreaterThan(stageIndex(journey, 'fs-cross'));
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
    expect(handoffCallBody).toMatch(/intent:\s*'financial-services-registration'/);
    expect(handoffCallBody).toMatch(/returnJourneyId:\s*sourceJourneyId/);
    expect(handoffCallBody).toMatch(/returnStageId:\s*returnStageId/);
  });
});
