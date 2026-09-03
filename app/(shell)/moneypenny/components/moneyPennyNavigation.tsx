'use client';

/**
 * MoneyPenny internal navigation context (experience-coherence correction,
 * 2026-09-03; revised same day for the native-hierarchy correction).
 *
 * Home/My Money/Plan/Markets/Activity are now REAL native `CodexTab`
 * entries (group: 'moneypenny' in `MONEYPENNY_CARTRIDGE`, data/codex-
 * configs.ts) — restoring the platform's own two-tier tab-group chrome
 * (`CodexPanelDynamic`'s top-level "MoneyPenny · Admin" bar + the group's
 * own sibling-tab sub-header) instead of an internally-rendered pill row
 * competing for space inside the right pane.
 *
 * That reintroduces a real constraint the PREVIOUS single-tab collapse
 * didn't have to solve: `CodexPanelDynamic` mounts exactly one native
 * tab's content at a time (`TabRenderer`), so switching between
 * Home/My Money/Plan/Markets/Activity UNMOUNTS the previous area's whole
 * subtree — including `MoneyPennyCopilotWorkspace`'s embedded
 * `SmartTriadCopilotLayer` — and mounts a fresh one for the target area.
 *
 * Two things make this invisible to the operator as "losing the
 * conversation":
 *
 * 1. `SmartTriadCopilotLayer` ALREADY persists its message history to
 *    `sessionStorage` keyed only by `personaId` (see that file's own
 *    `persistKey`) — not by cartridge, tab, or area. Every MoneyPenny area
 *    mount passes the SAME `personaId`, so the freshly-mounted copilot on
 *    the target area rehydrates the EXACT same conversation the operator
 *    was just having, one render later. This is EXISTING, already-proven
 *    infrastructure (the exact mechanism a persona returning to any
 *    SmartTriad-copiloted surface already relies on) — nothing new was
 *    built to "solve" persistence; this file only needs to get the
 *    operator to the right AREA.
 * 2. `MoneyPennyPanelTab.tsx` (mounted once per area, since each area is
 *    now its own native tab) applies the SAME sessionStorage idiom for
 *    exactly ONE value: which PANEL inside the target area to open. Native
 *    tab switches are plain in-page React state (`CodexPanelDynamic`'s
 *    `setActiveTabSlug` — confirmed by reading it: no URL change), so a
 *    cross-area jump like Home's "Explore investing" card (panel
 *    'hft-console', area 'markets') cannot pass its exact target panel via
 *    props or a route param the new mount could read. `writePendingPanel`/
 *    `readAndClearPendingPanel` below are that one-shot signal — written
 *    immediately before the native tab switch, read (and cleared) exactly
 *    once by the new mount's lazy initial state.
 *
 * `navigate(panel)` is there fore two different things depending on
 * whether the target panel belongs to THIS mount's own area:
 *   - same area  -> plain internal state change (setActivePanel) — the
 *     fast, common case (switching capsules inside Activity's carousel).
 *   - different area -> `writePendingPanel` + `tryOpenInMountedCartridge`
 *     to the target area's native tab slug (a `MoneyPennyAreaId` IS its
 *     tab slug — see moneypennyCapabilities.ts) — the SAME cross-cartridge
 *     tab-switch seam every other inter-tab jump in this codebase already
 *     uses, now genuinely applicable again because there is more than one
 *     real tab to switch to.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { MoneyPennyPanelKey } from '@/app/triad/components/codex/tabs/MoneyPennyPanelTab';
import type { MoneyPennyAreaId } from './moneypennyCapabilities';

/** The one cartridge id every MoneyPenny cross-tab navigation targets. */
export const MONEYPENNY_CODEX_ID = 'moneypenny-codex';

const PENDING_PANEL_STORAGE_KEY = 'moneypenny.pending-panel';

/** Written immediately before a cross-area native tab switch — see this
 *  file's own header for why a sessionStorage signal (not a prop/URL) is
 *  the correct carrier here. */
export function writePendingPanel(panel: MoneyPennyPanelKey): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_PANEL_STORAGE_KEY, panel);
  } catch {
    /* non-fatal — the target area simply opens on its own default panel */
  }
}

/** Read-once-then-clear — a value left here must never affect a LATER,
 *  unrelated mount of the same area (e.g. the operator leaves and comes
 *  back to My Money later; that visit must show My Money's own default,
 *  not a stale cross-area target from hours ago). */
export function readAndClearPendingPanel(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_PANEL_STORAGE_KEY);
    if (value !== null) window.sessionStorage.removeItem(PENDING_PANEL_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

export interface MoneyPennyNavigationContextValue {
  activePanel: MoneyPennyPanelKey;
  /** The area THIS native tab mount represents — null for a mount outside
   *  the five-area system (e.g. the metame-codex orchestration mirror,
   *  which pins one explicit panel via a fixed `panel` prop). */
  area: MoneyPennyAreaId | null;
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
