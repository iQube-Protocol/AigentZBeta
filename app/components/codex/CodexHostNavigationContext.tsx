"use client";

/**
 * CodexHostNavigationContext — the mounted host's OWN native tab-switch
 * function, exposed to descendants as a React context (2026-09-05,
 * MoneyPenny Home cross-area navigation regression fix).
 *
 * Root cause this closes: `MoneyPennyPanelTab.tsx`'s cross-area `navigate()`
 * called `tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, ... })`
 * — a lookup by a HARDCODED cartridge id ('moneypenny-codex') in the global
 * `CartridgePresenceRegistry`. That registry is keyed by whatever `codexId`
 * the ANCESTOR `CodexPanelDynamic` instance registered itself as
 * (`useCartridgePresence({ cartridgeId: codexId, ... })` — see that file).
 * For the standalone `/triad/embed/codex/moneypenny` mount, `codexId` really
 * is `'moneypenny-codex'`, so the lookup happened to succeed. For EVERY
 * other host — `metame-codex` (aigentMe's MoneyPenny group, reached via the
 * FS Bridge/`/bridge/fs`) foremost among them — the registered id is the
 * OUTER cartridge's own id, never `'moneypenny-codex'`, so the lookup always
 * missed, `tryOpenInMountedCartridge` returned `false`, and every cross-area
 * Home card silently did nothing. Confirmed by a real render+click test
 * before this fix (`tests/moneypenny-cross-area-integration-diagnostic.
 * test.tsx`): the exact same click reliably switches tabs when the
 * registered id is `'moneypenny-codex'` and reliably does NOT when it is
 * `'metame-codex'` — the id-lookup mechanism itself, not anything about
 * MoneyPennyOverviewPanel's buttons (proven separately, and passing, in
 * `tests/moneypenny-home-nav-diagnostic.test.tsx`).
 *
 * The fix: `CodexPanelDynamic` — the ONE component that owns
 * `activeTabSlug`/`setActiveTabSlug` for whichever codex is actually
 * mounted — provides ITS OWN tab-switch function directly, with no id to
 * get wrong. A descendant that wants "switch MY host's active tab" no
 * longer needs to know or guess what cartridge id it's nested under; it
 * just calls `useCodexHostNavigation()?.setActiveTab(slug)`. This works
 * identically for the standalone cartridge and for every embedding host
 * (metaMe, the FS Bridge, any future one) by construction — there is no
 * per-host branch to maintain.
 *
 * The value is provided directly during `CodexPanelDynamic`'s own render
 * (not inside a `useEffect`), so — unlike the `CartridgePresenceRegistry`
 * registration this replaces for in-tree callers — it is available to a
 * descendant on ITS very first render. No child-before-parent effect-commit
 * ordering race, and no `setTimeout(0)` deferral is needed to consume it.
 *
 * Never a second navigation system: this context does not replace
 * `CartridgePresenceRegistry`/`tryOpenInMountedCartridge` (the cross-FRAME,
 * cross-cartridge seam other surfaces — the wallet, inter-cartridge back-
 * links — still rely on, and still need for a call site OUTSIDE the target
 * cartridge's own render tree). It only gives an in-tree descendant a
 * direct, always-correct path to "the CodexPanelDynamic instance I am
 * mounted inside," which is the specific case the id-lookup kept getting
 * wrong.
 */

import { createContext, useContext, type ReactNode } from "react";

export interface CodexHostNavigationValue {
  /** The codex id this CodexPanelDynamic instance is actually mounted as
   *  (e.g. 'moneypenny-codex' standalone, 'metame-codex' when embedded) —
   *  exposed for diagnostics/logging, never for a descendant to re-derive
   *  a cartridge-id lookup from. */
  codexId: string;
  /** Switches THIS host's active top-level tab slug. Same effect as
   *  clicking that tab directly — a plain in-page state update, never a
   *  full page navigation/reload. */
  setActiveTab: (tabSlug: string) => void;
}

const CodexHostNavigationContext = createContext<CodexHostNavigationValue | null>(null);

export function CodexHostNavigationProvider({
  value,
  children,
}: {
  value: CodexHostNavigationValue;
  children: ReactNode;
}) {
  return (
    <CodexHostNavigationContext.Provider value={value}>{children}</CodexHostNavigationContext.Provider>
  );
}

/** Null outside a CodexPanelDynamic mount (e.g. the untouched standalone
 *  `/moneypenny` route, `MoneyPennyCartridge.tsx`, which never renders
 *  through CodexPanelDynamic at all) — callers MUST handle the null case,
 *  never assume this hook is always inside the provider. */
export function useCodexHostNavigation(): CodexHostNavigationValue | null {
  return useContext(CodexHostNavigationContext);
}
