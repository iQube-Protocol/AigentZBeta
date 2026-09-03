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

  it('fs-operate\'s label is bare "Operate" (corrected 2026-09-02 after live review — the qualified label read poorly truncated in the stage stepper; the distinct stage id already prevents collision, so sharing the label with the advanced stage is fine)', () => {
    const operate = journey.stages.find((s) => s.id === 'fs-operate')!;
    expect(operate.label).toBe('Operate');
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

describe('FinancialSovereigntyOperateStage.tsx — embeds the real MoneyPenny cartridge IN PLACE, never a second/forked workspace (2026-09-03 experience-coherence correction)', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));

  it('uses MoneyPennyBridgeEmbed — the shared in-frame mount, not a hand-built iframe or a fork of MoneyPenny\'s own workspace component', () => {
    expect(src).toMatch(/import \{ MoneyPennyBridgeEmbed \} from '@\/components\/journey\/MoneyPennyBridgeEmbed'/);
    expect(src).toMatch(/<MoneyPennyBridgeEmbed[\s\S]{0,80}tab="home"/);
    expect(src).toMatch(/<MoneyPennyBridgeEmbed[\s\S]{0,120}personaId=\{personaId\}/);
    // Never a second, forked implementation of MoneyPenny's own workspace
    // internals — MoneyPennyBridgeEmbed is the ONE composition seam.
    expect(src).not.toMatch(/SmartWalletDrawer|SmartTriadCopilotLayer|MoneyPennyPanelTab|MoneyPennyCopilotWorkspace/);
  });

  it('reuses BridgeMediaStage — the same generic shell every other fs-* stage uses, never a bespoke layout', () => {
    expect(src).toMatch(/import \{ BridgeMediaStage/);
  });

  it('never navigates away — no window.location.assign, no window.open/_blank (corrected 2026-09-03: same-tab window.location.assign is not an embedding fix)', () => {
    expect(src).not.toMatch(/window\.open/);
    expect(src).not.toMatch(/window\.location\.assign/);
  });

  it('opening MoneyPenny is a local state toggle — never a page navigation', () => {
    expect(src).toMatch(/const \[embedOpen, setEmbedOpen\] = useState\(false\);/);
  });

  // Navigation/viewport correction follow-up (2026-09-03, operator directive:
  // "They should both have the exact same expand-to-metaMe-shell affordance
  // as Horizen bridge. They do not need the continue button... as the user
  // can use the stepper to progress.") — supersedes the prior hand-built
  // "← Close MoneyPenny workspace" / "Continue" header this describe block
  // used to pin. MoneyPennyBridgeEmbed's own `expandable` toolbar (shared
  // with Horizen's Operate stage) replaces both.
  it('the embed-open state passes expandable to MoneyPennyBridgeEmbed and renders no local Close/Continue header', () => {
    expect(src).toMatch(/<MoneyPennyBridgeEmbed[\s\S]{0,160}expandable/);
    expect(src).not.toMatch(/← Close MoneyPenny workspace/);
    expect(src).not.toMatch(/>\s*Continue\s*<\/button>/);
    expect(src).not.toMatch(/handleCloseMoneyPenny/);
  });

  it('the intro (pre-open) BridgeMediaStage keeps its own Continue as the primary stage-advance CTA — only the embed-open header lost its redundant one', () => {
    expect(src).toMatch(/primaryCtaLabel="Continue"/);
    expect(src).toMatch(/onPrimaryCta=\{handleContinue\}/);
  });
});

describe('MoneyPennyBridgeEmbed.tsx — expandable mode reuses Horizen\'s exact descriptor, never a second focus/expand mechanism (2026-09-03)', () => {
  const src = stripComments(readSource('components/journey/MoneyPennyBridgeEmbed.tsx'));

  it('imports the shared registry descriptor + src-builder Horizen\'s own Operate override uses', () => {
    expect(src).toMatch(/import \{ JOURNEY_SURFACES, buildEmbedSurfaceSrc \} from '@\/services\/journey\/journeySurfaceRegistry'/);
    expect(src).toMatch(/JOURNEY_SURFACES\['moneypenny-orchestration-focused'\]/);
  });

  it('the expandable branch targets metame-codex (via the shared descriptor), never the standalone moneypenny-codex cartridge', () => {
    const at = src.indexOf('if (expandable)');
    expect(at).toBeGreaterThan(-1);
    const branch = src.slice(at, at + 1200);
    expect(branch).toMatch(/buildEmbedSurfaceSrc\(/);
    expect(branch).not.toMatch(/buildCodexUrl\('moneypenny'/);
  });

  it('renders a Focus/Full toggle button using the descriptor\'s own openLabel/breadcrumb — the same affordance JourneyRunSurface renders for kind: \'embed\' descriptors', () => {
    const at = src.indexOf('if (expandable)');
    const branch = src.slice(at, at + 1200);
    expect(branch).toMatch(/descriptor\.breadcrumb/);
    expect(branch).toMatch(/isExpanded \? 'Focus view' : \(descriptor\.openLabel/);
  });

  it('expandable defaults to false — Prepare\'s existing fixed-focused embed of the standalone cartridge is unaffected', () => {
    expect(src).toMatch(/expandable = false/);
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
