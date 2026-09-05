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
import type { MoneyPennyAreaId, MoneyPennySpecialistId } from './moneypennyCapabilities';

/**
 * FALLBACK ONLY (2026-09-05 Home cross-area nav regression fix). Cross-area
 * navigation now goes through `CodexHostNavigationContext` — the mounted
 * host's OWN `setActiveTab`, exposed directly by `CodexPanelDynamic` — which
 * works correctly regardless of what cartridge id that host actually
 * registered itself as. This constant, and the `tryOpenInMountedCartridge`
 * lookup keyed on it, remain ONLY as a defensive fallback for the
 * (currently hypothetical) case of a `MoneyPennyPanelTab` mount outside any
 * `CodexPanelDynamic` tree. See `CodexHostNavigationContext.tsx`'s own
 * header for the full defect this replaced as the PRIMARY path: this exact
 * id lookup silently failed whenever MoneyPenny was hosted as a nested tab
 * group inside a DIFFERENT top-level codex (metaMe's `metame-codex`, the FS
 * Bridge) rather than standalone, because the registered cartridge id is
 * always the OUTER mounted codex's own id, never this hardcoded string.
 */
export const MONEYPENNY_CODEX_ID = 'moneypenny-codex';

/**
 * Bounded, T1-safe active-case snapshot (Candidate Intake workspace upgrade,
 * 2026-09-05, requirement 3: "left- and right-pane interactions resolve to
 * the same caseId"). CandidateIntakePanel (the right-pane child under this
 * same provider) is the one writer, via setActiveCase — set whenever it
 * creates/opens/refreshes a Factor case. MoneyPennyCopilotWorkspace (the
 * left-pane sibling under the SAME provider — see MoneyPennyPanelTab.tsx,
 * both mounted inside one MoneyPennyNavigationProvider) reads it read-only
 * to fold a bounded case summary into the copilot's groundContext. Never a
 * second case store: this is a snapshot mirror of whatever
 * CandidateIntakePanel already fetched from the real Factor/Aegis REST
 * routes, not an independent source of truth.
 */
export interface MoneyPennyActiveCase {
  caseId: string;
  candidateDisplayName: string;
  state: string;
  currentAegisDecision: string | null;
}

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

const PENDING_SPECIALIST_STORAGE_KEY = 'moneypenny.pending-specialist';

/** Same one-shot sessionStorage idiom as writePendingPanel/readAndClear
 *  PendingPanel above, for the specialist a Home specialist card selected
 *  (requirement 2, 2026-09-05) — a cross-area jump to candidate-intake or
 *  service-orchestration remounts/re-renders that area's own
 *  MoneyPennyPanelTab instance, so the destination panel (CandidateIntake
 *  Panel, ServiceOrchestrationPanel) reads this once on its own mount to
 *  learn which specialist to pre-select, then clears it — never a prop,
 *  since PANELS renders every panel component with none. */
export function writePendingSpecialist(specialistId: MoneyPennySpecialistId): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_SPECIALIST_STORAGE_KEY, specialistId);
  } catch {
    /* non-fatal — the destination panel simply opens on its own default specialist */
  }
}

/** Read WITHOUT clearing — for a reader that only cares about a SUBSET of
 *  possible values (ServiceOrchestrationPanel only ever wants
 *  'nakamoto'/'kn0w1') and must never consume/discard a value meant for a
 *  different reader (CandidateIntakePanel's 'factor'/'aegis') just because
 *  it happened to check first. */
export function peekPendingSpecialist(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(PENDING_SPECIALIST_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingSpecialist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_SPECIALIST_STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

export function readAndClearPendingSpecialist(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_SPECIALIST_STORAGE_KEY);
    if (value !== null) window.sessionStorage.removeItem(PENDING_SPECIALIST_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * Typed navigation intent (requirement 2, 2026-09-05): a Home specialist
 * card navigates to a panel AND names which specialist that destination
 * should pre-select. `navigate()` still accepts a bare `MoneyPennyPanelKey`
 * (every existing call site — MoneyPennyOverviewPanel's other cards,
 * MoneyPennyCapabilityCarousel, the copilot's suggested-layout banner) —
 * this is an ADDITIVE union member, not a breaking signature change.
 *
 * `activeCaseId` is carried for a future caller that already knows the
 * target case (e.g. a deep-link back into a specific case from elsewhere)
 * — never populated by today's Home specialist cards, which have no active
 * case yet by construction. Never put into the URL: this is a one-shot,
 * same-tab handoff, not shareable state — same rule writePendingPanel's own
 * header already states for panel targets.
 */
export interface MoneyPennyNavigationIntent {
  panel: MoneyPennyPanelKey;
  specialistId?: MoneyPennySpecialistId;
  activeCaseId?: string;
}

export type MoneyPennyNavigationTarget = MoneyPennyPanelKey | MoneyPennyNavigationIntent;

export interface MoneyPennyNavigationContextValue {
  activePanel: MoneyPennyPanelKey;
  /** The area THIS native tab mount represents — null for a mount outside
   *  the five-area system (e.g. the metame-codex orchestration mirror,
   *  which pins one explicit panel via a fixed `panel` prop). */
  area: MoneyPennyAreaId | null;
  navigate: (target: MoneyPennyNavigationTarget) => void;
  /** Set when a cross-area navigate() attempt could not switch the host's
   *  tab (neither CodexHostNavigationContext nor the tryOpenInMountedCartridge
   *  fallback succeeded) — a failed navigation must never be a silent
   *  no-op. Cleared by clearNavigationError, or by the next successful
   *  navigate() call. */
  navigationError: string | null;
  clearNavigationError: () => void;
  /** See MoneyPennyActiveCase's own comment above. */
  activeCase: MoneyPennyActiveCase | null;
  setActiveCase: (activeCase: MoneyPennyActiveCase | null) => void;
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
