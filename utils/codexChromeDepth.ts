/**
 * Resolves which cartridge chrome tiers CodexPanelDynamic should render,
 * given the focused-surface depth contract (CodexNavOptions.focusedNavDepth
 * / CodexPanelDynamic's focusedNavDepth prop) and the legacy
 * suppressPrimaryChrome flag it extends.
 *
 * Two independently suppressible tiers:
 *   - topLevelNav    — the cartridge's own brand/tab-group bar
 *     (e.g. KNYT | Codex | Store | Terra | Order | 21 Sats | Admin | Docs)
 *   - groupSubHeader — the active group's own sibling-tab strip
 *     (e.g. Store's Episodes | KNYT Cards | Bundles | Investor KNYT)
 *
 * Depth 0 hides both (content surface only). Depth >= 1 hides only the
 * top-level bar, keeping the destination's own group nav so it stays
 * navigable. `focusedNavDepth` undefined falls back to the legacy
 * suppressPrimaryChrome flag for BOTH tiers, preserving the pre-depth
 * behaviour of any caller that hasn't adopted depth (suppressPrimaryChrome
 * alone always hid both tiers together).
 */
export function resolveCodexChromeVisibility(params: {
  focusedNavDepth?: number;
  suppressPrimaryChrome?: boolean;
  singleTabMode: boolean;
}): { hideTopLevelNav: boolean; hideGroupSubHeader: boolean } {
  const { focusedNavDepth, suppressPrimaryChrome, singleTabMode } = params;
  const isFocusedMode = focusedNavDepth !== undefined || !!suppressPrimaryChrome;
  const hideTopLevelNav = singleTabMode || isFocusedMode;
  const hideGroupSubHeader =
    singleTabMode || (focusedNavDepth !== undefined ? focusedNavDepth === 0 : !!suppressPrimaryChrome);
  return { hideTopLevelNav, hideGroupSubHeader };
}
