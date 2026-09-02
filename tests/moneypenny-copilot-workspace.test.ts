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

  it('uses the C-01 specified pane ratio (35-40% copilot / 60-65% workspace), not an even 50/50 split', () => {
    expect(src).toMatch(/lg:w-\[38%\]/);
    expect(src).toMatch(/lg:w-\[62%\]/);
  });

  it('groundContext carries a financialProfile snapshot when the active panel is financial-profile', () => {
    expect(src).toMatch(/activePanel === 'financial-profile' && financialProfileGround \? \{ financialProfile: financialProfileGround \} : \{\}/);
  });

  it('refetches the financial-profile ground snapshot via the shared fetchFinancialProfileSummary() module (extracted 2026-09-02 for SC-03 "one canonical profile" — reused by the B2 Prepare stage too) — no second read path', () => {
    expect(src).toMatch(/import \{ fetchFinancialProfileSummary, type FinancialProfileSummary \} from '@\/services\/moneypenny\/financialProfileSummary'/);
    expect(src).not.toMatch(/personaFetch\('\/api\/moneypenny\/financial-profile'/);
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
    expect(src).toMatch(/import \{ tryOpenInMountedCartridge, getCartridge \} from '@\/services\/cartridge\/CartridgePresenceRegistry'/);
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

describe('C-01 narrow-width Conversation/Workspace toggle — preserves conversation and task state (2026-09-02)', () => {
  const src = stripComments(readSource(WORKSPACE_SRC));

  it('has an explicit narrowView state driving which pane is visible below lg', () => {
    expect(src).toMatch(/const \[narrowView, setNarrowView\] = useState<'conversation' \| 'workspace'>\('conversation'\);/);
  });

  it('the toggle control is hidden at lg+ (lg:hidden) — desktop keeps both panes visible unconditionally', () => {
    expect(src).toMatch(/border-b border-slate-800 bg-slate-900\/60 p-1 lg:hidden/);
  });

  it('both panes stay in the JSX tree at every width — visibility (hidden/flex/block) toggles, panes are never conditionally unmounted', () => {
    // Neither pane's mount is gated by `narrowView &&` / `narrowView ===` ternary-with-null —
    // only className strings reference narrowView, proving state (conversation
    // history, task/panel state) survives switching views.
    expect(src).not.toMatch(/\{narrowView === '(conversation|workspace)' && </);
    expect(src).not.toMatch(/\{narrowView === '(conversation|workspace)' \? <.*> : null\}/);
    expect(src).toMatch(/narrowView === 'conversation' \? 'flex' : 'hidden'/);
    expect(src).toMatch(/narrowView === 'workspace' \? 'block' : 'hidden'/);
  });

  it('lg:flex / lg:block unconditionally restore both panes at the lg breakpoint, overriding the narrow-only hidden state', () => {
    expect(src).toMatch(/lg:flex lg:w-\[38%\]/);
    expect(src).toMatch(/lg:block lg:w-\[62%\]/);
  });
});

describe('C-03 five-area navigation retires the 14-item capability rail (2026-09-02)', () => {
  it('MoneyPennyCapabilityRail.tsx no longer exists', () => {
    expect(() => readSource('app/(shell)/moneypenny/components/MoneyPennyCapabilityRail.tsx')).toThrow();
  });

  it('MoneyPennyShell.tsx renders MoneyPennyAreaNav instead — same activePanel prop, same underlying panel components', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyShell.tsx'));
    expect(src).toMatch(/import \{ MoneyPennyAreaNav \} from "\.\/MoneyPennyAreaNav"/);
    expect(src).toMatch(/<MoneyPennyAreaNav activePanel=\{activePanel\} \/>/);
    expect(src).not.toMatch(/MoneyPennyCapabilityRail/);
    // The panel content itself (children) is untouched — same components, same dispatcher.
    expect(src).toMatch(/\{children\}/);
  });

  it('MoneyPennyAreaNav navigates through the SAME tryOpenInMountedCartridge seam the retired rail used — deep links unchanged', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx'));
    expect(src).toMatch(/import \{ tryOpenInMountedCartridge \} from "@\/services\/cartridge\/CartridgePresenceRegistry"/);
    expect(src).toMatch(/tryOpenInMountedCartridge\(\{ cartridgeId: MONEYPENNY_CODEX_ID, tab: /);
  });

  it('all five areas from the Cartridge spec are present, Home included', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
    for (const area of ['home', 'my-money', 'plan', 'markets', 'activity']) {
      expect(src, `area '${area}' missing from MONEYPENNY_AREAS`).toMatch(new RegExp(`id: "${area}"`));
    }
  });

  it('every real MoneyPennyPanelKey is reachable from exactly one area or the utility item — none dropped', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
    const panels = ['overview', 'hft-console', 'chat', 'portfolio', 'strategies', 'x402', 'identity', 'smarttriad', 'architect', 'runtime', 'service-orchestration', 'financial-profile', 'risk-envelope'];
    for (const panel of panels) {
      expect(src, `panel '${panel}' missing from MONEYPENNY_AREA_FOR_PANEL`).toMatch(new RegExp(`(^|\\s)${panel === 'chat' || panel === 'x402' ? panel : `"?${panel}"?`}:\\s*"`, 'm'));
    }
    // crm is the deliberate utility-tier exception, not dropped — it has its own item.
    expect(src).toMatch(/MONEYPENNY_UTILITY_ITEM/);
    expect(src).toMatch(/panel: "crm"/);
  });

  it('mode badges (Advisor/Architect/Runtime) are carried through unchanged, never redefined by area — C-10 keeps mode independent of navigation', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx'));
    expect(src).toMatch(/MODE_BADGE_STYLE/);
    expect(src).toMatch(/item\.mode/);
    // No area-specific mode override logic — mode always comes from the item itself.
    expect(src).not.toMatch(/area\.mode|areaId === .*mode/);
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
