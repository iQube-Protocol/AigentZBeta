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
    expect(src).toMatch(/<MoneyPennyShell activePanel=\{activePanel\}[^>]*>\{children\}<\/MoneyPennyShell>/);
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

  it('both the known-panel and unknown-panel branches render through MoneyPennyCopilotWorkspace — no bypass path (2026-09-03: unified into ONE mount with the known/unknown choice as its children, an even stronger guarantee than two parallel mounts)', () => {
    const mounts = src.match(/<MoneyPennyCopilotWorkspace activePanel=\{activePanel\}[^>]*>/g) ?? [];
    expect(mounts.length).toBe(1);
    expect(src).toMatch(/\{Panel \? <Panel \/> : <div[^>]*>Unknown MoneyPenny panel: \{activePanel\}<\/div>\}/);
  });

  it('every existing panel key still maps in PANELS — compatibility for current entry points, none dropped ("chat" deliberately excluded: retired 2026-09-03, the duplicate right-pane chat UI it dispatched to is gone, and a legacy ?tab=chat deep link now falls through to overview/Home, where the canonical copilot already is)', () => {
    for (const key of ['overview', 'hft-console', 'portfolio', 'strategies', 'x402', 'identity', 'smarttriad', 'crm', 'architect', 'runtime', 'service-orchestration', 'financial-profile', 'risk-envelope']) {
      expect(src, `panel key '${key}' missing from PANELS`).toMatch(new RegExp(`"?${key}"?:`));
    }
    expect(src, "'chat' must no longer be a PANELS key — the duplicate right-pane chat UI is retired").not.toMatch(/\bchat:\s*MoneyPennyChat/);
  });
});

describe('fs-operate\'s "Open MoneyPenny" embeds through the SAME dispatcher — no separate wiring needed', () => {
  it('FinancialSovereigntyOperateStage.tsx embeds via MoneyPennyBridgeEmbed, which itself resolves through MoneyPennyPanelTab.tsx like every other entry point (2026-09-03: replaces the retired buildCodexUrl navigate-away)', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));
    expect(src).toMatch(/import \{ MoneyPennyBridgeEmbed \} from '@\/components\/journey\/MoneyPennyBridgeEmbed'/);
    const embedSrc = stripComments(readSource('components/journey/MoneyPennyBridgeEmbed.tsx'));
    expect(embedSrc).toMatch(/buildCodexUrl\('moneypenny',/);
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

  it('navigates through MoneyPennyNavigationContext — MoneyPennyPanelTab\'s own internal state, the one owner of "which panel is active" (MS-2) since the 2026-09-03 single-tab collapse retired the cross-cartridge tryOpenInMountedCartridge seam for this purpose', () => {
    expect(src).toMatch(/import \{ useMoneyPennyNavigation \} from '\.\/moneyPennyNavigation'/);
    expect(src).toMatch(/navigateToPanel\(suggestedPanel\)/);
  });

  it('derives suggestable panel labels from the SAME capability-group source of truth the rail uses — no hand-duplicated label list', () => {
    expect(src).toMatch(/import \{ MONEYPENNY_CAPABILITY_GROUPS[^}]*\} from '\.\/moneypennyCapabilities'/);
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

describe('C-03 five-area navigation retires the 14-item capability rail (2026-09-02; areas promoted to real native tabs 2026-09-03, second pass)', () => {
  it('MoneyPennyCapabilityRail.tsx no longer exists', () => {
    expect(() => readSource('app/(shell)/moneypenny/components/MoneyPennyCapabilityRail.tsx')).toThrow();
  });

  it('MoneyPennyAreaNav.tsx no longer exists — the five areas are real native CodexTabs now (data/codex-configs.ts), not an internally-rendered menu', () => {
    expect(() => readSource('app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx')).toThrow();
  });

  it('MoneyPennyShell.tsx renders MoneyPennyCapabilityCarousel instead — same activePanel prop, plus the area this native tab represents', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyShell.tsx'));
    expect(src).toMatch(/import \{ MoneyPennyCapabilityCarousel \} from "\.\/MoneyPennyCapabilityCarousel"/);
    expect(src).toMatch(/<MoneyPennyCapabilityCarousel[\s\S]*?activePanel=\{activePanel\}[\s\S]*?area=\{area\}/);
    expect(src).not.toMatch(/MoneyPennyCapabilityRail|MoneyPennyAreaNav/);
    // The panel content itself (children) is untouched — same components, same dispatcher.
    expect(src).toMatch(/\{children\}/);
  });

  it('MoneyPennyCapabilityCarousel navigates through MoneyPennyNavigationContext — same-area clicks set internal state, cross-area clicks hand off to the real native tab (moneyPennyNavigation.tsx)', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCapabilityCarousel.tsx'));
    expect(src).toMatch(/import \{ useMoneyPennyNavigation \} from '\.\/moneyPennyNavigation'/);
    expect(src).toMatch(/navigate\(item\.panel\)/);
  });

  it('all five areas from the Cartridge spec are present as real native tab slugs, Home included', () => {
    const src = stripComments(readSource('data/codex-configs.ts'));
    for (const area of ['home', 'my-money', 'plan', 'markets', 'activity']) {
      expect(src, `area '${area}' missing as a native MONEYPENNY_CARTRIDGE tab slug`).toMatch(new RegExp(`slug: '${area}'`));
    }
  });

  it('every real MoneyPennyPanelKey is reachable from exactly one area — none dropped ("chat" excluded: retired 2026-09-03, no longer a MoneyPennyPanelKey at all)', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
    const panels = ['overview', 'hft-console', 'portfolio', 'strategies', 'x402', 'identity', 'smarttriad', 'architect', 'runtime', 'service-orchestration', 'financial-profile', 'risk-envelope'];
    for (const panel of panels) {
      expect(src, `panel '${panel}' missing from MONEYPENNY_AREA_FOR_PANEL`).toMatch(new RegExp(`(^|\\s)${panel === 'x402' ? panel : `"?${panel}"?`}:\\s*"`, 'm'));
    }
    expect(src, "'chat' must not appear in MONEYPENNY_AREA_FOR_PANEL — it is no longer a MoneyPennyPanelKey").not.toMatch(/(^|\s)chat:\s*"/m);
    // crm moved into Activity (2026-09-03 experience-coherence correction,
    // superseding the earlier "utility item outside the five areas"
    // placement) — it now has a real area mapping, not a separately-pinned
    // button.
    expect(src).toMatch(/crm: "activity"/);
    expect(src).toMatch(/panel: "crm"/);
  });

  it('mode badges (Advisor/Architect/Runtime) are carried through unchanged, never redefined by area — C-10 keeps mode independent of navigation', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCapabilityCarousel.tsx'));
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

describe('MoneyPennyPanelTab — activePanel resets on a native area switch even though React never remounts it (live-discovered regression, 2026-09-03)', () => {
  // All five native area tabs (data/codex-configs.ts's MONEYPENNY_CARTRIDGE)
  // share `config.component: 'MoneyPennyPanelTab'`, so TabRenderer.tsx looks
  // up the SAME component reference at the SAME tree position for every one
  // of them. React therefore treats a Home->Activity click as a props-only
  // update on the existing instance, never an unmount/remount. A `useState`
  // lazy initializer only runs on true first mount, so without an explicit
  // effect keyed on `area`, activePanel silently keeps showing whichever
  // area happened to mount first — confirmed live via Playwright against
  // the running dev server (Activity's own carousel rendered correctly, but
  // the panel content below it kept showing Home's overview until this fix).
  const src = stripComments(readSource(DISPATCHER_SRC));

  it('imports useRef alongside the other hooks this file already used', () => {
    expect(src).toMatch(/import \{[^}]*\buseRef\b[^}]*\} from "react";/);
  });

  it('tracks the last-seen area in a ref, seeded from the initial area (no redundant re-resolution on first mount)', () => {
    expect(src).toMatch(/const lastAreaRef = useRef\(area\);/);
  });

  it('has an effect keyed on [area, explicitPanel] that re-resolves activePanel only when area has genuinely changed since last render', () => {
    const effect = src.match(/const lastAreaRef = useRef\(area\);\s*useEffect\(\(\) => \{([\s\S]*?)\}, \[area, explicitPanel\]\);/)?.[1] ?? '';
    expect(effect, 'area-change effect body not found').not.toBe('');
    // Bails for the explicit-panel mirror (metame-codex), which has no area-switching concept at all.
    expect(effect).toMatch(/if \(explicitPanel\) return;/);
    // Bails when area hasn't actually changed — this is what stops the effect
    // from re-firing redundantly on every unrelated re-render, and from ever
    // clobbering an in-app navigate() the operator just did on the SAME area.
    expect(effect).toMatch(/if \(area === lastAreaRef\.current\) return;/);
    expect(effect).toMatch(/lastAreaRef\.current = area;/);
    // A cross-area pending-panel signal (set by navigate() or the legacy-link
    // self-heal effect) still wins over the area's own bare default — the
    // exact-panel-targeting guarantee (e.g. Home's "Explore investing" card
    // landing on Markets' hft-console, not Markets' own default strategies).
    expect(effect).toMatch(/readAndClearPendingPanel\(\)/);
    expect(effect).toMatch(/setActivePanel\(pending\);/);
    // Falls back to the area's own derived default when there is no pending signal.
    expect(effect).toMatch(/setActivePanel\(area \? defaultPanelForArea\(area\) : DEFAULT_PANEL\);/);
  });

  it('the area-change effect and the lazy initializer resolve identically — same three-step precedence (pending signal, else area default, else DEFAULT_PANEL) so a first-mount vs. later-area-change resolution can never diverge', () => {
    const initializer = src.match(/const \[activePanel, setActivePanel\] = useState<MoneyPennyPanelKey>\(\(\) => \{([\s\S]*?)\}\);/)?.[1] ?? '';
    const effect = src.match(/const lastAreaRef = useRef\(area\);\s*useEffect\(\(\) => \{([\s\S]*?)\}, \[area, explicitPanel\]\);/)?.[1] ?? '';
    expect(initializer).toMatch(/area \? defaultPanelForArea\(area\) : DEFAULT_PANEL/);
    expect(effect).toMatch(/area \? defaultPanelForArea\(area\) : DEFAULT_PANEL/);
  });
});

describe('MoneyPennyPanelTab — legacy-deep-link self-heal defers past the first-mount registration race (live-discovered regression, 2026-09-03)', () => {
  // Live Playwright test against a fresh page load at
  // /triad/embed/codex/moneypenny?tab=service-orchestration (the exact URL
  // Horizen's own `moneypenny-orchestration-focused.expandedTab` produces)
  // stayed on Home instead of self-healing to Activity. Root cause: this
  // effect and CodexPanelDynamic's ANCESTOR `useCartridgePresence`
  // registration effect commit in the same React flush, child-before-
  // parent — so on true first mount, this effect ran BEFORE
  // 'moneypenny-codex' was registered in the CartridgePresenceRegistry,
  // and tryOpenInMountedCartridge silently returned false (cartridge "not
  // mounted yet"). Deferring the call past the synchronous effect-commit
  // flush (setTimeout 0) fixed it — confirmed live, re-tested after the fix.
  const src = stripComments(readSource(DISPATCHER_SRC));

  // stripComments() removes the doc comment above this effect, so anchor on
  // its actual code — the `if (explicitPanel || !area) return;` guard is
  // unique to the self-heal effect (the area-change effect above guards on
  // `if (explicitPanel) return;` alone), and both are `useEffect(..., [])`.
  const selfHealEffect =
    src.match(/if \(explicitPanel \|\| !area\) return;([\s\S]*?)\}, \[\]\);/)?.[1] ?? '';

  it('the self-heal effect body is found (guards against the anchor pattern silently drifting)', () => {
    expect(selfHealEffect).not.toBe('');
  });

  it('defers its tryOpenInMountedCartridge call past the current commit via setTimeout, not a direct synchronous call', () => {
    expect(selfHealEffect).toMatch(/setTimeout\(\(\) => \{\s*tryOpenInMountedCartridge\(\{ cartridgeId: MONEYPENNY_CODEX_ID, tab: targetArea \}\);\s*\}, 0\);/);
  });

  it('clears the deferred timer on unmount — a fast unmount must never fire a stale redirect on a since-torn-down mount', () => {
    expect(selfHealEffect).toMatch(/const timer = setTimeout/);
    expect(selfHealEffect).toMatch(/return \(\) => clearTimeout\(timer\);/);
  });

  it('still writes the pending-panel signal synchronously (before the deferred redirect attempt), so the target mount can consume it the instant it registers', () => {
    const writeIdx = selfHealEffect.indexOf('writePendingPanel(raw);');
    const timerIdx = selfHealEffect.indexOf('const timer = setTimeout');
    expect(writeIdx).toBeGreaterThan(-1);
    expect(timerIdx).toBeGreaterThan(-1);
    expect(writeIdx).toBeLessThan(timerIdx);
  });
});
