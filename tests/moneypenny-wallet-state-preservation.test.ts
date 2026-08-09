/**
 * MoneyPenny wallet — Architect/Runtime state survives expand/collapse
 * (operator report, 2026-08-06: "when the full screen is activated or
 * collapsed it's losing state — it needs to retain the state of the
 * session/query").
 *
 * Root cause: `{moneyPennyExpanded ? <ArchitectPanel /> : <MoneyPennyWalletArchitect ... />}`
 * unmounted whichever component wasn't currently shown, wiping its
 * intent/result useState every time the Expand/Collapse button was clicked.
 * Fix mirrors this file's own established discipline for the four mode
 * viewports (moneypenny-wallet-reconstitution.test.ts): both components stay
 * mounted, toggled by class only.
 *
 * Also covers the two other pieces of that feedback round: the shared
 * MarkdownLite "copilot formatting" renderer, and the avatar cache-busted
 * script src that fixes the blank-on-return report.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import fs from 'fs';
import path from 'path';

const WALLET_DRAWER_PATH = 'app/components/content/SmartWalletDrawer.tsx';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('MoneyPenny wallet: Architect/Runtime expand-collapse never unmounts either surface', () => {
  const code = () => stripComments(readSource(WALLET_DRAWER_PATH));

  it('both ArchitectPanel and MoneyPennyWalletArchitect are mounted together, class-toggled — no `moneyPennyExpanded ? <X/> : <Y/>` component swap', () => {
    const c = code();
    expect(c).not.toMatch(/moneyPennyExpanded \? \(\s*<ArchitectPanel/);
    // 2026-08-06: both surfaces now take a `sharedState={architectDraft}` prop
    // (one conversation, not two independently-preserved copies) — no longer
    // a bare self-closing tag, so match the opening tag only.
    expect(c).toMatch(/moneyPennyExpanded \? '' : 'hidden'[\s\S]{0,60}<ArchitectPanel /);
    expect(c).toMatch(/moneyPennyExpanded \? 'hidden' : ''[\s\S]{0,100}<MoneyPennyWalletArchitect/);
    expect(c).toMatch(/<ArchitectPanel sharedState=\{architectDraft\}/);
    expect(c).toMatch(/<MoneyPennyWalletArchitect personaIdHint=\{effectivePersonaId\} sharedState=\{architectDraft\}/);
  });

  it('both RuntimePanel and MoneyPennyWalletRuntime are mounted together, class-toggled — no component swap', () => {
    const c = code();
    expect(c).not.toMatch(/moneyPennyExpanded \? \(\s*<RuntimePanel/);
    expect(c).toMatch(/moneyPennyExpanded \? '' : 'hidden'[\s\S]{0,40}<RuntimePanel \/>/);
    expect(c).toMatch(/moneyPennyExpanded \? 'hidden' : ''[\s\S]{0,80}<MoneyPennyWalletRuntime/);
  });

  it('the outer mode-vs-hidden class discipline for Architect/Runtime is unchanged (still ternary-hidden, never `&&`-unmounted)', () => {
    const c = code();
    expect(c).not.toMatch(/\{moneyPennyMode === 'architect' && \(/);
    expect(c).not.toMatch(/\{moneyPennyMode === 'runtime' && \(/);
    expect(c).toMatch(/moneyPennyMode === 'architect' \? \(moneyPennyExpanded[^)]*\) : 'hidden'/);
    expect(c).toMatch(/moneyPennyMode === 'runtime' \? \(moneyPennyExpanded[^)]*\) : 'hidden'/);
  });
});

describe('MoneyPenny wallet: copilot formatting stylesheet is one shared renderer', () => {
  it('MarkdownLite exists and is imported by both the Copilot chat and ArchitectPanel', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'components/ui/markdown-lite.tsx'))).toBe(true);
    const drawer = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(drawer).toMatch(/import \{ MarkdownLite \} from ["']@\/components\/ui\/markdown-lite["']/);
    const architect = stripComments(read('app/(shell)/moneypenny/components/ArchitectPanel.tsx'));
    expect(architect).toMatch(/import \{ MarkdownLite \} from ["']@\/components\/ui\/markdown-lite["']/);
    expect(architect).toContain('<MarkdownLite');
  });

  it('assistant messages render through MarkdownLite; user messages stay plain text', () => {
    const drawer = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(drawer).toMatch(/msg\.role === 'assistant' \? \(\s*<MarkdownLite/);
  });

  it('MarkdownLite never uses dangerouslySetInnerHTML — output is built from React elements only', () => {
    const code = stripComments(fs.readFileSync(path.join(__dirname, '..', 'components/ui/markdown-lite.tsx'), 'utf8'));
    expect(code).not.toContain('dangerouslySetInnerHTML');
  });
});

describe('MoneyPenny Architect: cited invariants carry a tooltip', () => {
  it('each invariant pill is wrapped in Tooltip/TooltipTrigger/TooltipContent, not a bare span', () => {
    const code = stripComments(read('app/(shell)/moneypenny/components/ArchitectPanel.tsx'));
    expect(code).toContain('<Tooltip');
    expect(code).toContain('<TooltipTrigger');
    expect(code).toContain('<TooltipContent');
  });

  it('fetches statements through the EXISTING /api/invariants/[id] route — no parallel description list', () => {
    // The fetch itself lives in the shared useArchitectDraft hook (extracted
    // 2026-08-06, also used by MoneyPennyWalletArchitect) — ArchitectPanel
    // consumes it rather than duplicating the fetch.
    const code = stripComments(read('hooks/useArchitectDraft.ts'));
    expect(code).toMatch(/\/api\/invariants\//);
  });
});

describe('MoneyPenny Architect: the design output viewport is vertically resizable', () => {
  it('uses resize-y with an explicit starting height, not a flex-1 fixed pane', () => {
    const code = stripComments(read('app/(shell)/moneypenny/components/ArchitectPanel.tsx'));
    expect(code).toMatch(/resize-y[^"]*overflow-y-auto/);
  });
});

describe('metaAvatar: the D-ID script is cache-busted on every (re)mount', () => {
  it('script.src includes a per-init cache-busting query param, so a remount actually re-evaluates the module', () => {
    const code = fs.readFileSync(
      path.join(__dirname, '..', 'app/components/metaVatar/MetaAvatar.tsx'),
      'utf8',
    );
    expect(code).toMatch(/script\.src = `https:\/\/agent\.d-id\.com\/v2\/index\.js\?[^`]+`/);
  });

  it('reloads on tab-visibility-return, not just React remount (operator report, 2026-08-06: "still blank screen on returning after changing tabs")', () => {
    const code = fs.readFileSync(
      path.join(__dirname, '..', 'app/components/metaVatar/MetaAvatar.tsx'),
      'utf8',
    );
    expect(code).toContain("document.addEventListener('visibilitychange'");
    expect(code).toMatch(/document\.visibilityState === 'visible'/);
  });
});

describe('MoneyPenny Architect: compact and expanded views share ONE conversation (operator follow-up, 2026-08-06: "the full screen modal is not getting the active inference and conversation injected into it")', () => {
  it('useArchitectDraft is the single shared hook, extracted rather than hand-copied in either component', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'hooks/useArchitectDraft.ts'))).toBe(true);
    const architect = stripComments(read('app/(shell)/moneypenny/components/ArchitectPanel.tsx'));
    const walletArchitect = stripComments(read('app/components/wallet/MoneyPennyWalletArchitect.tsx'));
    expect(architect).toMatch(/import \{ useArchitectDraft, type ArchitectDraftState \} from ["']@\/hooks\/useArchitectDraft["']/);
    expect(walletArchitect).toMatch(/import \{ useArchitectDraft, type ArchitectDraftState \} from ["']@\/hooks\/useArchitectDraft["']/);
  });

  it('both components accept an optional sharedState prop and fall back to their own hook instance when it is absent', () => {
    const architect = stripComments(read('app/(shell)/moneypenny/components/ArchitectPanel.tsx'));
    const walletArchitect = stripComments(read('app/components/wallet/MoneyPennyWalletArchitect.tsx'));
    expect(architect).toMatch(/sharedState\?:\s*ArchitectDraftState/);
    expect(architect).toMatch(/sharedState \?\? ownState/);
    expect(walletArchitect).toMatch(/sharedState\?:\s*ArchitectDraftState/);
    expect(walletArchitect).toMatch(/sharedState \?\? ownState/);
  });

  it('SmartWalletDrawer calls useArchitectDraft exactly ONCE and hands the SAME instance to both surfaces', () => {
    const drawer = stripComments(readSource(WALLET_DRAWER_PATH));
    const hookCalls = drawer.match(/=\s*useArchitectDraft\(/g) ?? [];
    expect(hookCalls).toHaveLength(1);
    expect(drawer).toMatch(/<ArchitectPanel sharedState=\{architectDraft\}/);
    expect(drawer).toMatch(/<MoneyPennyWalletArchitect personaIdHint=\{effectivePersonaId\} sharedState=\{architectDraft\}/);
  });
});
