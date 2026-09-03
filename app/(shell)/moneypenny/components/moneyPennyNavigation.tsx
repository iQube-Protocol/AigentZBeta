'use client';

/**
 * MoneyPenny internal navigation context (experience-coherence correction,
 * 2026-09-03). Replaces routing panel switches through the generic
 * cross-cartridge `tryOpenInMountedCartridge` seam.
 *
 * Why this exists: consolidating `MONEYPENNY_CARTRIDGE` down to ONE
 * registered codex tab (so `CodexPanelDynamic`'s own documented
 * `singleTabMode` suppresses its competing outer nav — see
 * `MoneyPennyPanelTab.tsx`'s header) means there is no longer a second,
 * third, fourth... codex tab for `tryOpenInMountedCartridge({tab: <panel>})`
 * to switch TO. `MoneyPennyAreaNav`/`MoneyPennyOverviewPanel`'s clicks used
 * to work by asking `CodexPanelDynamic` to activate a DIFFERENT tab, whose
 * static `config.props.panel` happened to differ — a chain of tabs
 * simulating in-app navigation via cross-cartridge tab-switching. With one
 * tab, that mechanism has nothing left to switch to.
 *
 * The fix mirrors Agent Me's OWN pattern (`AigentMeWelcomeSplitTab.tsx`'s
 * `activeCapsuleId`/`activeLayoutId`, per the operator's explicit design
 * reference): MoneyPenny now owns its active panel as REAL internal React
 * state (`MoneyPennyPanelTab.tsx`), navigated by calling `navigate()`
 * directly — never a synthetic cross-cartridge tab-switch for what is, in
 * truth, a same-page state change.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { MoneyPennyPanelKey } from '@/app/triad/components/codex/tabs/MoneyPennyPanelTab';

export interface MoneyPennyNavigationContextValue {
  activePanel: MoneyPennyPanelKey;
  navigate: (panel: MoneyPennyPanelKey) => void;
}

const MoneyPennyNavigationContext = createContext<MoneyPennyNavigationContextValue | null>(null);

export function MoneyPennyNavigationProvider({
  value,
  children,
}: {
  value: MoneyPennyNavigationContextValue;
  children: ReactNode;
}) {
  return <MoneyPennyNavigationContext.Provider value={value}>{children}</MoneyPennyNavigationContext.Provider>;
}

/** Throws outside the provider — every MoneyPenny panel/nav component is
 *  always mounted under MoneyPennyPanelTab, so an absent provider is a real
 *  wiring bug, never a legitimate optional case to silently degrade from. */
export function useMoneyPennyNavigation(): MoneyPennyNavigationContextValue {
  const ctx = useContext(MoneyPennyNavigationContext);
  if (!ctx) {
    throw new Error('useMoneyPennyNavigation() called outside MoneyPennyNavigationProvider');
  }
  return ctx;
}
