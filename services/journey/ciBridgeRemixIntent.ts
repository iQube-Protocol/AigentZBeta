/**
 * ciBridgeRemixIntent — the hand-off between CI Bridge's Crossings tab
 * (View stage) and its myCanvas surface (Personify stage) for a "Remix"
 * click that must never leave the Bridge shell (2026-08-11, final
 * interaction pass: "No window.open, _blank, external navigation, or new
 * top-level page for this flow").
 *
 * Crossings renders KnytCommunityContentTab directly in the page tree (not
 * an iframe), so its RemixCrossingButton can no longer navigate at all when
 * mounted here — it calls an `onRemixIntent` callback instead (see
 * KnytCommunityContentTab.tsx). That callback switches the spine to
 * `personify` (journey:select-stage) and stashes the payload here;
 * ConstitutionalInternetBridgePersonifyMyCanvas reads it once on mount and
 * forwards it as a `remix=` query param on its existing myCanvas iframe
 * `src` — the SAME param shape MyCanvasTab's own remix-seeding effect
 * already reads for every other Remix entry point (KNYTS Bridge's
 * `/bridge/knyts?remix=`, the generic `/codex/viewer?...&remix=`).
 *
 * sessionStorage, not a module-level variable: the spine switch (a React
 * state update) and the Personify component's mount are not guaranteed to
 * happen in an order a plain in-memory variable could rely on being read
 * correctly across renders/StrictMode double-invocation. sessionStorage is
 * synchronous and survives regardless of remount order within the tab.
 */

const STORAGE_KEY = 'ci-bridge-remix-intent';

export interface CiBridgeRemixIntent {
  source: 'community-content';
  title: string;
  summary: string;
  campaign: string | null;
  skill: 'article' | 'story';
}

export function stashCiBridgeRemixIntent(payload: CiBridgeRemixIntent): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage unavailable (SSR, privacy mode) — Remix simply won't pre-fill */
  }
}

/** Reads and clears in one call — a stashed intent is consumed exactly once. */
export function takeCiBridgeRemixIntent(): CiBridgeRemixIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as CiBridgeRemixIntent;
  } catch {
    return null;
  }
}
