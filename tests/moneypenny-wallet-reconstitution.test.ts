/**
 * MoneyPenny Wallet Service Reconstitution (2026-08-06).
 *
 * Chat, Copilot, Architect, Runtime and metaAvatar used to be presented as
 * overlapping/competing surfaces: a two-level copilotMode('chat'|'avatar')
 * + moneyPennyMode('chat'|'architect'|'runtime') split, a SECOND rendering
 * of the same chat under the "metaVatar" tab, an avatar overlay that could
 * black out the chat beneath it, and a Runtime "open full runtime" link
 * that navigated away to a standalone page. This canary pins the
 * reconstitution: one mode selector, one canonical chat mount, state that
 * survives switching modes, and no navigation anywhere in the
 * expand/full-runtime path.
 *
 * Source-scan style, matching this repo's existing convention for this
 * exact file (no React rendering harness is set up) — see
 * tests/moneypenny-runtime-authority-boundary.test.ts's own header for the
 * same rationale.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import fs from 'fs';
import path from 'path';

const WALLET_DRAWER_PATH = 'app/components/content/SmartWalletDrawer.tsx';
const RUNTIME_PANEL_PATH = 'app/(shell)/moneypenny/components/RuntimePanel.tsx';
const ARCHITECT_PANEL_PATH = 'app/(shell)/moneypenny/components/ArchitectPanel.tsx';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('MoneyPenny wallet: one canonical chat mount', () => {
  it('mounts the copilotMessages chat list exactly once — the former metaVatar-tab duplicate is gone', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    const matches = code.match(/copilotMessages\.map\(\(msg, i\)/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('mounts the copilotPrompt input exactly once', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    const matches = code.match(/value=\{copilotPrompt\}/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('the old two-level copilotMode(\'chat\'|\'avatar\') state no longer exists alongside the new unified selector', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).not.toMatch(/const \[copilotMode, setCopilotMode\]/);
    expect(code).not.toContain('setCopilotMode(');
  });

  it('the standalone Show/Hide Avatar toggle and avatarRequested state are gone — selecting the metaAvatar tab IS the request', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).not.toMatch(/const \[avatarRequested, setAvatarRequested\]/);
    expect(code).not.toContain('Show Avatar');
    expect(code).not.toContain('Hide Avatar');
  });
});

describe('MoneyPenny wallet: mode switching preserves state (all four modes stay mounted)', () => {
  const code = () => stripComments(readSource(WALLET_DRAWER_PATH));

  it('the Chat card is hidden via a ternary class toggle, never conditionally unmounted with &&', () => {
    expect(code()).toMatch(/moneyPennyMode === 'chat' \? '' : 'hidden'/);
  });

  it('MoneyPennyWalletArchitect / ArchitectPanel sit inside a ternary-hidden div, never `{moneyPennyMode === \'architect\' && (`', () => {
    const c = code();
    expect(c).not.toMatch(/\{moneyPennyMode === 'architect' && \(/);
    expect(c).toMatch(/moneyPennyMode === 'architect' \? \(moneyPennyExpanded[^)]*\) : 'hidden'/);
  });

  it('MoneyPennyWalletRuntime / RuntimePanel sit inside a ternary-hidden div, never `{moneyPennyMode === \'runtime\' && (`', () => {
    const c = code();
    expect(c).not.toMatch(/\{moneyPennyMode === 'runtime' && \(/);
    expect(c).toMatch(/moneyPennyMode === 'runtime' \? \(moneyPennyExpanded[^)]*\) : 'hidden'/);
  });

  it('the metaAvatar viewport is hidden via ternary, never unmounted with &&', () => {
    expect(code()).toMatch(/moneyPennyMode === 'avatar' \? 'h-\[290px\] flex flex-col' : 'hidden'/);
  });
});

describe('MoneyPenny wallet: expand never navigates — full Runtime/Architect stay in the current host shell', () => {
  it('SmartWalletDrawer no longer links out to the standalone /moneypenny page', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).not.toMatch(/<Link\s+href="\/moneypenny"/);
    expect(code).not.toContain('Open full Runtime');
  });

  it('RuntimePanel (the expanded Runtime + Agreement lifecycle view) never calls window.open or navigates', () => {
    const code = stripComments(read(RUNTIME_PANEL_PATH));
    expect(code).not.toContain('window.open');
    expect(code).not.toMatch(/target=["']_blank["']/);
    expect(code).not.toMatch(/<Link\s/);
    expect(code).not.toContain('router.push');
  });

  it('ArchitectPanel (the expanded Architect view) never calls window.open or navigates', () => {
    const code = stripComments(read(ARCHITECT_PANEL_PATH));
    expect(code).not.toContain('window.open');
    expect(code).not.toMatch(/target=["']_blank["']/);
    expect(code).not.toMatch(/<Link\s/);
    expect(code).not.toContain('router.push');
  });

  it('SmartWalletDrawer imports ArchitectPanel/RuntimePanel directly (composition) rather than navigating to them', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).toMatch(/import \{ ArchitectPanel \} from ["']@\/app\/\(shell\)\/moneypenny\/components\/ArchitectPanel["']/);
    expect(code).toMatch(/import \{ RuntimePanel \} from ["']@\/app\/\(shell\)\/moneypenny\/components\/RuntimePanel["']/);
    // ArchitectPanel takes a `sharedState` prop as of 2026-08-06 (one
    // Architect conversation shared with the compact wallet view); RuntimePanel
    // is unchanged.
    expect(code).toMatch(/<ArchitectPanel sharedState=\{architectDraft\} \/>/);
    expect(code).toContain('<RuntimePanel />');
  });
});

describe('MoneyPenny wallet: mode rail is horizontally scrollable and never wraps', () => {
  it('the mode rail uses overflow-x-auto + flex-nowrap, not flex-wrap', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    const match = code.match(/role="tablist"[\s\S]{0,400}/);
    expect(match, 'the mode rail (role="tablist") must exist').not.toBeNull();
    const rail = match![0];
    expect(rail).toContain('overflow-x-auto');
    expect(rail).toContain('flex-nowrap');
    expect(rail).not.toContain('flex-wrap');
  });

  it('exposes exactly the four required modes as tabs: Chat, Architect, Runtime, metaAvatar', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    const match = code.match(/role="tablist"[\s\S]*?<\/div>\s*<\/div>/);
    expect(match, 'the mode rail block must exist').not.toBeNull();
    const rail = match![0];
    for (const label of ['Chat', 'Architect', 'Runtime', 'metaAvatar']) {
      expect(rail, `mode rail must contain a "${label}" tab`).toContain(label);
    }
    // "Copilot" as a mode label is retired — the mode formerly called
    // Copilot is now named Chat.
    expect(rail).not.toContain('>Copilot<');
  });
});

describe('MoneyPenny wallet: avatar mode never renders simultaneously over another mode', () => {
  it('requestAvatar is gated on moneyPennyMode === \'avatar\' alone — no other mode can also hold the avatar overlay', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).toMatch(/if \(open && copilotOpen && moneyPennyMode === 'avatar'\) \{\s*\n\s*requestAvatar\('copilot', 'aigent-moneypenny'\);/);
  });

  it('the four mode viewports share one mutually-exclusive class expression per container (never two `?  : \'hidden\'` conditions both true)', () => {
    // Structural guarantee: each viewport's hidden/shown class is driven by a
    // single `moneyPennyMode === '<mode>'` comparison against ONE state
    // variable, so at most one of the four can be non-'hidden' at a time.
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    const singleModeGuards = code.match(/moneyPennyMode === '(chat|architect|runtime|avatar)'/g) ?? [];
    expect(singleModeGuards.length).toBeGreaterThanOrEqual(4);
    // No second, independent visibility state (e.g. a lingering copilotMode)
    // could make two viewports visible together.
    expect(code).not.toMatch(/copilotMode/);
  });
});

describe('MoneyPenny wallet: identity legibility', () => {
  it('the MoneyPenny badge is present and distinct from the mode rail', () => {
    const code = stripComments(readSource(WALLET_DRAWER_PATH));
    expect(code).toMatch(/MoneyPenny — the Wallet Copilot's native Financial Services agent/);
  });
});
