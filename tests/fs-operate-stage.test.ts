/**
 * fs-operate — the intermediary "Operate with MoneyPenny" stage (B1,
 * 2026-09-02). Proves the naming decision holds structurally: a distinct
 * stage identity from the advanced Horizen aigentme stage (which also
 * carries the visible label "Operate"), never the same id, and the new
 * component links into the real MoneyPenny cartridge rather than
 * fabricating a second workspace.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

describe.each([
  ['KNYTS Bridge', KNYTS_BRIDGE_CROSSING_JOURNEY],
  ['Constitutional Internet Bridge', CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY],
])('%s — fs-operate naming and identity', (_label, journey) => {
  it('fs-operate is a distinct stage id from the advanced Horizen aigentme stage', () => {
    const operate = journey.stages.find((s) => s.id === 'fs-operate');
    expect(operate).toBeTruthy();
    expect(operate!.id).not.toBe('aigentme');
    const aigentme = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'aigentme');
    expect(aigentme, 'advanced aigentme stage should still exist, untouched').toBeTruthy();
    expect(aigentme!.label).toBe('Operate');
  });

  it('fs-operate\'s label is qualified ("Operate with MoneyPenny"), never the bare "Operate" the advanced stage uses', () => {
    const operate = journey.stages.find((s) => s.id === 'fs-operate')!;
    expect(operate.label).not.toBe('Operate');
    expect(operate.label).toMatch(/Operate/);
  });

  it('fs-operate has empty completionEvidence — deliberately, never fabricated to fill the array', () => {
    const operate = journey.stages.find((s) => s.id === 'fs-operate')!;
    expect(operate.completionEvidence).toEqual([]);
  });

  it('fs-prepare -> fs-operate -> fs-cross chain is intact', () => {
    const byId = new Map(journey.stages.map((s) => [s.id, s]));
    expect(byId.get('fs-prepare')?.nextStageId).toBe('fs-operate');
    expect(byId.get('fs-operate')?.nextStageId).toBe('fs-cross');
  });
});

describe('FinancialSovereigntyOperateStage.tsx — links to the real MoneyPenny cartridge, never a second workspace', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));

  it('uses the canonical buildCodexUrl inter-cartridge navigation helper, never a hand-built URL', () => {
    expect(src).toMatch(/import \{ buildCodexUrl \} from '@\/utils\/codex-nav'/);
    expect(src).toMatch(/buildCodexUrl\('moneypenny',/);
  });

  it('never embeds a second MoneyPenny split-pane workspace inline (no SmartWalletDrawer/SmartTriadCopilotLayer import)', () => {
    expect(src).not.toMatch(/SmartWalletDrawer|SmartTriadCopilotLayer|MoneyPennyPanelTab/);
  });

  it('reuses BridgeMediaStage — the same generic shell every other fs-* stage uses, never a bespoke layout', () => {
    expect(src).toMatch(/import \{ BridgeMediaStage/);
  });
});

describe('journeySurfaceRegistry — fs-operate refs map to the new component for both bridges', () => {
  const src = stripComments(readSource('services/journey/journeySurfaceRegistry.ts'));

  it('knyts-bridge-fs-operate and ci-bridge-fs-operate both map to FinancialSovereigntyOperateStage', () => {
    for (const ref of ['knyts-bridge-fs-operate', 'ci-bridge-fs-operate']) {
      const at = src.indexOf(`'${ref}':`);
      expect(at, `${ref} missing from journeySurfaceRegistry`).toBeGreaterThan(-1);
      const section = src.slice(at, at + 200);
      expect(section).toMatch(/component: 'FinancialSovereigntyOperateStage'/);
    }
  });
});

describe('bridge pages wire fs-operate into their component map and resolveSurfaceProps', () => {
  it('app/bridge/knyts/page.tsx registers FinancialSovereigntyOperateStage and resolves its props', () => {
    const src = stripComments(readSource('app/bridge/knyts/page.tsx'));
    expect(src).toMatch(/FinancialSovereigntyOperateStage: FinancialSovereigntyOperateStage/);
    expect(src).toMatch(/surfaceRef\.ref === 'knyts-bridge-fs-operate'/);
  });

  it('app/bridge/ci/page.tsx registers FinancialSovereigntyOperateStage and resolves its props', () => {
    const src = stripComments(readSource('app/bridge/ci/page.tsx'));
    expect(src).toMatch(/FinancialSovereigntyOperateStage: FinancialSovereigntyOperateStage/);
    expect(src).toMatch(/surfaceRef\.ref === 'ci-bridge-fs-operate'/);
  });
});
