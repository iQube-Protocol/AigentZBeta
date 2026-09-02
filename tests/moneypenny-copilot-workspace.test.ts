/**
 * C1 — MoneyPenny shared copilot-left/chips-right shell (2026-09-02,
 * operator directive). Proves: the REAL shared DevOn/Agent Me split-pane
 * component (`SmartTriadCopilotLayer`) is reused, never a fork or the
 * unrelated `CodexCopilotLayer` floating bubble; every existing
 * MoneyPenny panel/entry-point still resolves through the SAME
 * dispatcher (compatibility, zero broken links); financial-profile
 * preparation and the fs-operate "Open MoneyPenny" link both land in this
 * one workspace by construction (both route through
 * MoneyPennyPanelTab.tsx); and groundContext carries a financial-profile
 * snapshot back to the copilot when that capsule is active.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const WORKSPACE_SRC = 'app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx';
const DISPATCHER_SRC = 'app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx';

describe('MoneyPennyCopilotWorkspace — reuses the REAL DevOn/Agent Me copilot, never a fork', () => {
  const src = stripComments(readSource(WORKSPACE_SRC));

  it('imports SmartTriadCopilotLayer from its one canonical location', () => {
    expect(src).toMatch(/import \{ SmartTriadCopilotLayer[^}]*\} from '@\/components\/smarttriad\/copilot\/SmartTriadCopilotLayer'/);
  });

  it('never imports or mounts CodexCopilotLayer — that is the unrelated cartridge-wide floating bubble, not the split-pane pattern', () => {
    expect(src).not.toMatch(/CodexCopilotLayer/);
  });

  it('mounts SmartTriadCopilotLayer with variant="panel" (embedded, not floating) — the same variant DevOn/Agent Me use', () => {
    expect(src).toMatch(/variant="panel"/);
  });

  it('reuses the EXISTING MoneyPennyShell as the right pane — never a new capsule/layout-registry system', () => {
    expect(src).toMatch(/import \{ MoneyPennyShell \} from '\.\/MoneyPennyShell'/);
    expect(src).toMatch(/<MoneyPennyShell activePanel=\{activePanel\}>\{children\}<\/MoneyPennyShell>/);
  });

  it('uses the same lg:w-1/2 / lg:w-1/2 split shell shape as DevCommandCenterTab/AigentMeWelcomeSplitTab', () => {
    expect(src).toMatch(/lg:w-1\/2 w-full h-full min-h-0 flex flex-col/);
  });

  it('groundContext carries a financialProfile snapshot when the active panel is financial-profile', () => {
    expect(src).toMatch(/activePanel === 'financial-profile' && financialProfileGround \? \{ financialProfile: financialProfileGround \} : \{\}/);
  });

  it('refetches the financial-profile ground snapshot via the SAME GET route FinancialProfilePanel.tsx itself reads — no second read path', () => {
    expect(src).toMatch(/personaFetch\('\/api\/moneypenny\/financial-profile'/);
  });
});

describe('MoneyPennyPanelTab — the one dispatcher every entry point already uses now wraps in the new workspace', () => {
  const src = stripComments(readSource(DISPATCHER_SRC));

  it('imports MoneyPennyCopilotWorkspace, no longer renders bare MoneyPennyShell directly', () => {
    expect(src).toMatch(/import \{ MoneyPennyCopilotWorkspace \} from "@\/app\/\(shell\)\/moneypenny\/components\/MoneyPennyCopilotWorkspace"/);
    expect(src).not.toMatch(/<MoneyPennyShell/);
  });

  it('both the known-panel and unknown-panel branches render through MoneyPennyCopilotWorkspace — no bypass path', () => {
    const mounts = src.match(/<MoneyPennyCopilotWorkspace activePanel=\{panel\}>/g) ?? [];
    expect(mounts.length).toBe(2);
  });

  it('every existing panel key still maps in PANELS — compatibility for current entry points, none dropped', () => {
    for (const key of ['overview', 'hft-console', 'chat', 'portfolio', 'strategies', 'x402', 'identity', 'smarttriad', 'crm', 'architect', 'runtime', 'service-orchestration', 'financial-profile', 'risk-envelope']) {
      expect(src, `panel key '${key}' missing from PANELS`).toMatch(new RegExp(`"?${key}"?:`));
    }
  });
});

describe('fs-operate\'s "Open MoneyPenny" link routes through the SAME dispatcher — no separate wiring needed', () => {
  it('FinancialSovereigntyOperateStage.tsx still uses buildCodexUrl(\'moneypenny\', ...) — unchanged, resolves through MoneyPennyPanelTab.tsx like every other entry point', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));
    expect(src).toMatch(/buildCodexUrl\('moneypenny',/);
  });
});

describe('The standalone /moneypenny route stays untouched (out of scope for this codex-tab-only slice)', () => {
  it('MoneyPennyCartridge.tsx does not import MoneyPennyCopilotWorkspace', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCartridge.tsx'));
    expect(src).not.toMatch(/MoneyPennyCopilotWorkspace/);
  });
});

describe('C-02 copilot-to-capsule loop (Cartridge spec reconciliation, 2026-09-02) — chip suggests, operator clicks, tab framework navigates', () => {
  const src = stripComments(readSource(WORKSPACE_SRC));

  it('wires onSuggestedLayouts and quickPrompts onto the SAME registered suggestion system DevOn/Agent Me use — no parallel proposal channel', () => {
    expect(src).toMatch(/onSuggestedLayouts=\{handleSuggestedLayouts\}/);
    expect(src).toMatch(/quickPrompts=\{MONEYPENNY_QUICK_PROMPTS\}/);
  });

  it('does NOT auto-navigate on a suggested layout — Companion Menu invariant MS-5, a deliberate act outranks an ambient observation', () => {
    // The handler only sets state; the actual navigation call must live in a
    // separate, explicitly-invoked callback (never inside handleSuggestedLayouts).
    const handlerBody = src.match(/const handleSuggestedLayouts = useCallback\(\(hints: SuggestedLayoutHint\[\]\) => \{([\s\S]*?)\}, \[activePanel\]\);/)?.[1] ?? '';
    expect(handlerBody).not.toMatch(/tryOpenInMountedCartridge/);
  });

  it('navigates through the SAME tryOpenInMountedCartridge seam the capability rail already uses — one owner of "which panel is active" (MS-2)', () => {
    expect(src).toMatch(/import \{ tryOpenInMountedCartridge \} from '@\/services\/cartridge\/CartridgePresenceRegistry'/);
    expect(src).toMatch(/tryOpenInMountedCartridge\(\{ cartridgeId: MONEYPENNY_CODEX_ID, tab: suggestedPanel \}\)/);
  });

  it('derives suggestable panel labels from the SAME capability-group source of truth the rail uses — no hand-duplicated label list', () => {
    expect(src).toMatch(/import \{ MONEYPENNY_CAPABILITY_GROUPS \} from '\.\/moneypennyCapabilities'/);
    expect(src).toMatch(/MONEYPENNY_CAPABILITY_GROUPS\.flatMap/);
  });

  it('clears a stale suggestion once the operator has actually navigated there', () => {
    expect(src).toMatch(/setSuggestedPanel\(\(prev\) => \(prev === activePanel \? null : prev\)\)/);
  });
});

describe('C-02 server-side registered layout identifiers (app/api/codex/chat/route.ts) — financial ids extend, never fork, the existing typed suggestion system', () => {
  const src = stripComments(readSource('app/api/codex/chat/route.ts'));
  const FINANCIAL_IDS = [
    'financial-profile', 'risk-envelope', 'hft-console', 'strategies',
    'architect', 'runtime', 'smarttriad', 'service-orchestration', 'portfolio',
  ];

  it('every financial id is a member of ChipTargetId', () => {
    const unionBlock = src.match(/export type ChipTargetId =([\s\S]*?);/)?.[1] ?? '';
    for (const id of FINANCIAL_IDS) {
      expect(unionBlock, `ChipTargetId missing '${id}'`).toMatch(new RegExp(`'${id}'`));
    }
  });

  it('every financial id is registered in LAYOUT_TAG_IDS (so an LLM [layout:id] tag is honored)', () => {
    const tagIdsBlock = src.match(/const LAYOUT_TAG_IDS: ReadonlyArray<ChipTargetId> = \[([\s\S]*?)\];/)?.[1] ?? '';
    for (const id of FINANCIAL_IDS) {
      expect(tagIdsBlock, `LAYOUT_TAG_IDS missing '${id}'`).toMatch(new RegExp(`'${id}'`));
    }
  });

  it('every financial id has a keyword-sweep entry in LAYOUT_KEYWORDS (works even without an LLM tag)', () => {
    const keywordsBlock = src.match(/const LAYOUT_KEYWORDS: Array<\{ id: ChipTargetId; pattern: RegExp; reason: string \}> = \[([\s\S]*?)\];/)?.[1] ?? '';
    for (const id of FINANCIAL_IDS) {
      expect(keywordsBlock, `LAYOUT_KEYWORDS missing '${id}'`).toMatch(new RegExp(`id: '${id}'`));
    }
  });

  it('aigent-moneypenny gets its own layout-tag control block — mirrors the aigent-me/aigent-z pattern, never silently empty', () => {
    expect(src).toMatch(/surfaceId === 'aigent-moneypenny'/);
  });

  it('the moneypenny control block never authorizes an action by itself — SC-02 (navigation/suggestion never grants authority)', () => {
    const block = src.match(/surfaceId === 'aigent-moneypenny'\s*\n\s*\? `([\s\S]*?)`\s*\n\s*: '';/)?.[1] ?? '';
    expect(block).toMatch(/never authorizes any action by itself/);
  });
});
