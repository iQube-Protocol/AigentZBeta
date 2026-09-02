/**
 * Entry continuity verification (2026-09-02): direct MoneyPenny entry,
 * Agent Me entry, and intermediary Operate must reach the same workspace
 * and financial profile, with one copilot and preserved task/environment
 * context — plus return navigation.
 *
 * Findings, verified by direct code reading before any change:
 *  - Direct entry and Operate BOTH already resolve through the ONE
 *    dispatcher (MoneyPennyPanelTab.tsx -> MoneyPennyCopilotWorkspace).
 *    Since the financial-profile fetch is persona-scoped
 *    (/api/moneypenny/financial-profile), any entry reaching the same
 *    persona reaches the SAME profile by construction — verified, not
 *    duplicated.
 *  - Agent Me has NO wired entry point into this workspace.
 *    `MoneyPennyFocusLayout.tsx` (components/metame/welcome/layouts/) is
 *    an unrelated Guided Journey Runtime ceremony capsule — it records a
 *    disposition about whether MoneyPenny is a "focus," never navigates
 *    into the real cartridge. `AigentMeWelcomeSplitTab.tsx` contains zero
 *    buildCodexUrl('moneypenny', ...) calls. Not built this pass — see
 *    the reconciliation doc for why (file-risk, not scope refusal).
 *  - The current "Prepare" stage (FinancialSovereigntyPrepareCrossStage.tsx)
 *    does not link to MoneyPenny at all — expected: it is the PRE-Bridge-spec
 *    agent-candidate-selection step the Bridge spec (B-08) explicitly
 *    critiques and has not yet been rebuilt as the new Prepare stage. Not a
 *    regression; a known, out-of-scope, not-yet-started phase (Bridge B2).
 *  - Return navigation did not exist anywhere in MoneyPenny. This pass adds
 *    a generic mechanism (slug breadcrumb when `from` is a real codex slug;
 *    browser-history fallback otherwise) rather than fabricating a "from"
 *    value for Operate, which is a Journey Spine stage with no real codex
 *    slug to offer.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('Direct entry and Operate both resolve through the ONE dispatcher — verified, not assumed', () => {
  it('MoneyPennyPanelTab.tsx (every moneypenny-codex tab) wraps every panel in MoneyPennyCopilotWorkspace', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
    expect(src).toMatch(/import \{ MoneyPennyCopilotWorkspace \} from "@\/app\/\(shell\)\/moneypenny\/components\/MoneyPennyCopilotWorkspace"/);
  });

  it('FinancialSovereigntyOperateStage.tsx (intermediary Operate) still opens MoneyPenny through buildCodexUrl(\'moneypenny\', ...) — the SAME codex, SAME dispatcher', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));
    expect(src).toMatch(/buildCodexUrl\('moneypenny', \{ personaId: personaId \?\? undefined, tab: 'overview' \}\)/);
  });

  it('the financial-profile ground fetch is persona-scoped, not entry-point-scoped — any entry reaching the same persona reaches the same profile', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));
    expect(src).toMatch(/personaFetch\('\/api\/moneypenny\/financial-profile'/);
  });
});

describe('Agent Me entry — verified absent, not silently assumed present', () => {
  it('MoneyPennyFocusLayout.tsx never navigates into the real MoneyPenny cartridge (no buildCodexUrl, no tryOpenInMountedCartridge)', () => {
    const src = stripComments(readSource('components/metame/welcome/layouts/MoneyPennyFocusLayout.tsx'));
    expect(src).not.toMatch(/buildCodexUrl/);
    expect(src).not.toMatch(/tryOpenInMountedCartridge/);
  });

  it('AigentMeWelcomeSplitTab.tsx contains no buildCodexUrl(\'moneypenny\', ...) call — confirmed gap, not fixed this pass', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx'));
    expect(src).not.toMatch(/buildCodexUrl\(['"]moneypenny['"]/);
  });
});

describe('The current Prepare stage does not link to MoneyPenny — expected pre-Bridge-spec state, not a regression', () => {
  it('FinancialSovereigntyPrepareCrossStage.tsx has no MoneyPenny reference', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));
    expect(src).not.toMatch(/buildCodexUrl\(['"]moneypenny['"]/);
    expect(src).not.toMatch(/MoneyPenny/);
  });
});

describe('Return navigation — generic mechanism, no fabricated "from" values', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('reads from/fromTab from the URL via useSearchParams — the platform\'s existing breadcrumb-link params', () => {
    expect(src).toMatch(/import \{ useSearchParams \} from 'next\/navigation'/);
    expect(src).toMatch(/searchParams\.get\('from'\)/);
    expect(src).toMatch(/searchParams\.get\('fromTab'\)/);
  });

  it('a real from= slug gets a proper buildCodexUrl breadcrumb link', () => {
    const handlerBody = src.match(/const navigateBack = useCallback\(\(\) => \{([\s\S]*?)\}, \[fromSlug, fromTab, personaId\]\);/)?.[1] ?? '';
    expect(handlerBody).toMatch(/if \(fromSlug\) \{/);
    expect(handlerBody).toMatch(/buildCodexUrl\(fromSlug, \{ tab: fromTab \?\? undefined, personaId \}\)/);
  });

  it('falls back to window.history.back() when there is no real slug — never fabricates one for Operate', () => {
    const handlerBody = src.match(/const navigateBack = useCallback\(\(\) => \{([\s\S]*?)\}, \[fromSlug, fromTab, personaId\]\);/)?.[1] ?? '';
    expect(handlerBody).toMatch(/window\.history\.back\(\)/);
  });

  it('FinancialSovereigntyOperateStage.tsx does NOT set a fabricated from= value — it has no real codex slug to offer', () => {
    const operateSrc = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));
    expect(operateSrc).not.toMatch(/from:\s*['"]/);
  });

  it('the back-link is hidden during the full-screen takeover — the takeover bar owns that space instead', () => {
    expect(src).toMatch(/\{!isFullScreen && canNavigateBack && \(/);
  });
});
