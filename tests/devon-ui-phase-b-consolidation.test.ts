/**
 * DevOn UI Refinement, Phase B canaries.
 *
 * Protects the specific defect Phase A found and fixed (a second,
 * independently-hand-maintained stage array silently drifting from
 * `STAGE_ORDER`) and the Stage/View separation the whole phase depends on.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { STAGE_ORDER } from '@/services/devCommandCenter/devLoop';
import { STAGES, getStageIndex } from '@/components/devcommandcenter/stageMeta';

const TAB_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/triad/components/codex/tabs/DevCommandCenterTab.tsx'),
  'utf-8',
);
const OVERVIEW_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ProjectOverviewLayout.tsx'),
  'utf-8',
);

describe('one lifecycle, one canonical stage order, one stage metadata source', () => {
  it('stageMeta.STAGES covers every STAGE_ORDER member, in the same order, with none dropped', () => {
    expect(STAGES.map((s) => s.id)).toEqual([...STAGE_ORDER]);
  });

  it('getStageIndex agrees with array position for every stage (the exact class of bug fixed)', () => {
    STAGE_ORDER.forEach((stage, i) => {
      expect(getStageIndex(stage)).toBe(i);
    });
  });

  it('DevCommandCenterTab.tsx does not define its own STAGES array — it imports the shared one', () => {
    expect(TAB_SOURCE).toMatch(/import \{ STAGES, getStageIndex \} from ["']@\/components\/devcommandcenter\/stageMeta["']/);
    expect(TAB_SOURCE).not.toMatch(/const STAGES\s*:/);
    expect(TAB_SOURCE).not.toMatch(/function getStageIndex/);
  });

  it('ProjectOverviewLayout.tsx does not define its own STAGES array — it imports the shared one (the fixed defect)', () => {
    expect(OVERVIEW_SOURCE).toMatch(/import \{ STAGES, getStageIndex \} from ["']@\/components\/devcommandcenter\/stageMeta["']/);
    expect(OVERVIEW_SOURCE).not.toMatch(/const STAGES\s*:/);
    expect(OVERVIEW_SOURCE).not.toMatch(/function getStageIndex/);
    // The original defect: an independent 7-entry array silently missing 3
    // stages. Assert the three previously-missing stages are NOT hand-listed
    // anywhere in this file as a local stage array would have listed them.
    expect(OVERVIEW_SOURCE).not.toMatch(/\{\s*id:\s*["']constitutional_decision["']/);
    expect(OVERVIEW_SOURCE).not.toMatch(/\{\s*id:\s*["']remediation["']/);
    expect(OVERVIEW_SOURCE).not.toMatch(/\{\s*id:\s*["']deployment_authorization["']/);
  });
});

describe('Stage vs View — navigating a view never advances or mutates the lifecycle stage', () => {
  it('the Views (CapabilityChipRow) click handler only calls view-routing functions, never advanceStage', () => {
    const chipClickBlock = TAB_SOURCE.match(/onChipClick=\{\(id\) => \{[\s\S]*?\n\s*\}\}/)?.[0];
    expect(chipClickBlock, 'could not locate the Views row onChipClick handler').toBeTruthy();
    expect(chipClickBlock).toMatch(/returnToStack|engageCapsuleAndMount/);
    expect(chipClickBlock).not.toMatch(/advanceStage/);
    expect(chipClickBlock).not.toMatch(/setSession\([^)]*stage:/);
  });

  it('StageStrip renders isCurrent/isPast purely from the `stage` prop, never from activeCapsuleId', () => {
    const stageStripBlock = TAB_SOURCE.match(/function StageStrip\([\s\S]*?\n\}/)?.[0];
    expect(stageStripBlock, 'could not locate StageStrip').toBeTruthy();
    expect(stageStripBlock).not.toMatch(/activeCapsuleId/);
  });

  it('CapabilityChipRow highlights isActive purely from activeCapsuleId, never from session.stage', () => {
    const start = TAB_SOURCE.indexOf('function CapabilityChipRow(');
    expect(start, 'could not locate CapabilityChipRow').toBeGreaterThan(-1);
    const chipRowBlock = TAB_SOURCE.slice(start, start + 2000);
    expect(chipRowBlock).toMatch(/activeCapsuleId === cap\.id/);
  });
});

describe('the removed duplicate lifecycle representations do not silently return', () => {
  // Both phrases legitimately appear in explanatory doc comments describing
  // what was removed and where its content went — the canary checks for
  // RENDERED reintroduction (an AccordionSection title, a JSX heading), not
  // the phrase's mere presence in prose.
  it('no "Experience Model" accordion (removed — pure duplicate of STAGES/StageStrip)', () => {
    expect(TAB_SOURCE).not.toMatch(/title="Experience Model"/);
  });

  it('no "Development Loop" diagram (removed — its steps relocated to their correct existing homes)', () => {
    expect(TAB_SOURCE).not.toMatch(/>Development Loop</);
  });

  it('no always-expanded 10-card capability matrix in the default stack (replaced by Current Work + Active Artifact)', () => {
    // The removed matrix rendered every CAPABILITIES entry unconditionally in
    // a grid; Current Work/Active Artifact render at most ONE stage's data.
    expect(TAB_SOURCE).not.toMatch(/grid grid-cols-1 md:grid-cols-2 gap-2/);
  });
});

describe('Current Work is a compact orientation card, not a fourth stage-list representation', () => {
  it('currentArtifactSummary returns exactly one stage worth of data, never the full STAGES/CAPABILITIES set', () => {
    expect(TAB_SOURCE).toMatch(/function currentArtifactSummary/);
    const fnBlock = TAB_SOURCE.match(/function currentArtifactSummary\([\s\S]*?\n\}/)?.[0] ?? '';
    expect(fnBlock).not.toMatch(/CAPABILITIES\.map/);
    expect(fnBlock).not.toMatch(/STAGES\.map/);
  });
});
