/**
 * resolveCodexChromeVisibility (utils/codexChromeDepth.ts) — the pure
 * depth-tier resolver extracted from CodexPanelDynamic's chrome-suppression
 * logic (2026-08-11 fix). See tests/journey-focused-depth-chrome.test.ts for
 * the paired URL-generation boundary fix.
 *
 * Acceptance invariant this file enforces:
 *   Focused -> honor the surface's configured focusedNavDepth.
 *   Full    -> ignore focusedNavDepth, render complete canonical chrome.
 * Specifically: BUY Focused = depth 1 (top-level nav hidden, group
 * sub-header shown), BUY Full = full, VIEW Focused = depth 0 (both hidden),
 * VIEW Full = full.
 */

import { describe, it, expect } from 'vitest';
import { resolveCodexChromeVisibility } from '@/utils/codexChromeDepth';

describe('resolveCodexChromeVisibility — depth-aware tiers', () => {
  it('BUY Focused (depth 1): hides the top-level cartridge bar, KEEPS the group sub-header', () => {
    const { hideTopLevelNav, hideGroupSubHeader } = resolveCodexChromeVisibility({
      focusedNavDepth: 1,
      suppressPrimaryChrome: true,
      singleTabMode: false,
    });
    expect(hideTopLevelNav).toBe(true);
    expect(hideGroupSubHeader).toBe(false);
  });

  it('BUY Full (no depth, no suppression): shows both tiers — complete canonical chrome', () => {
    const { hideTopLevelNav, hideGroupSubHeader } = resolveCodexChromeVisibility({
      focusedNavDepth: undefined,
      suppressPrimaryChrome: undefined,
      singleTabMode: false,
    });
    expect(hideTopLevelNav).toBe(false);
    expect(hideGroupSubHeader).toBe(false);
  });

  it('VIEW Focused (depth 0): hides BOTH tiers — content surface only', () => {
    const { hideTopLevelNav, hideGroupSubHeader } = resolveCodexChromeVisibility({
      focusedNavDepth: 0,
      suppressPrimaryChrome: true,
      singleTabMode: false,
    });
    expect(hideTopLevelNav).toBe(true);
    expect(hideGroupSubHeader).toBe(true);
  });

  it('VIEW Full (no depth, no suppression): shows both tiers — complete canonical chrome', () => {
    const { hideTopLevelNav, hideGroupSubHeader } = resolveCodexChromeVisibility({
      focusedNavDepth: undefined,
      suppressPrimaryChrome: undefined,
      singleTabMode: false,
    });
    expect(hideTopLevelNav).toBe(false);
    expect(hideGroupSubHeader).toBe(false);
  });

  it('legacy suppressPrimaryChrome with no depth info hides BOTH tiers (pre-depth backward compatibility)', () => {
    const { hideTopLevelNav, hideGroupSubHeader } = resolveCodexChromeVisibility({
      focusedNavDepth: undefined,
      suppressPrimaryChrome: true,
      singleTabMode: false,
    });
    expect(hideTopLevelNav).toBe(true);
    expect(hideGroupSubHeader).toBe(true);
  });

  it('singleTabMode hides both tiers regardless of depth/suppression', () => {
    const { hideTopLevelNav, hideGroupSubHeader } = resolveCodexChromeVisibility({
      focusedNavDepth: 1,
      suppressPrimaryChrome: true,
      singleTabMode: true,
    });
    expect(hideTopLevelNav).toBe(true);
    expect(hideGroupSubHeader).toBe(true);
  });
});
