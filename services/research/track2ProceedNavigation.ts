/**
 * track2ProceedNavigation.ts — the AUTHORITATIVE Research Copilot → Track 2
 * "Proceed" sequence (2026-08-27 continuation, "Crystal freeze-gating
 * continuation" review pass).
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 *
 * The Copilot's pending-decision CTA (`ObjectiveCard`'s violet "Open
 * {stageLabel}" button) navigated using `decision.deepLink` — data captured
 * EITHER by the mount-time preview fetch (`refresh()`, run once on mount) OR
 * by a PRIOR run's POST /advance response — without ever re-verifying it was
 * still current at the moment of the click. Two concrete ways that data goes
 * stale before the click:
 *
 *   1. The Copilot tab is a plain registry-mapped tab like any other
 *      (`app/triad/components/codex/TabRenderer.tsx`'s `componentRegistry`
 *      lookup) — it mounts once and its `refresh()` runs once
 *      (`useEffect(() => { void refresh(); }, [])`). Real Track 2 progress
 *      made through `Track2ProgrammePanel` directly (e.g. the Stage 9
 *      duplicate-pair queue) never touches the Copilot's own state, so a
 *      Copilot instance that has been sitting open shows an increasingly
 *      stale `pendingDecisionPreview` — an OLD stage name, an OLD remedy
 *      list — until the operator manually clicks the Copilot's own Refresh.
 *   2. `codex:navigate-tab` is a no-op when the destination is ALREADY the
 *      active cartridge tab (`CodexPanelDynamic.tsx`'s listener guards
 *      `target !== activeTabSlug`) — so a click that fires while Experiment
 *      Lab is already open writes a deep-link intent into the mailbox
 *      (`track2DeepLinkIntent.ts`) that is NEVER consumed: its one consumer,
 *      `InvariantExperimentLab`'s `useState(() => consumePendingTrack2Stage())`
 *      lazy initializer, runs exactly once, on that component's FIRST mount,
 *      and a no-op tab switch never remounts it. The already-mounted
 *      `Track2ProgrammePanel` keeps showing whatever it last loaded, and the
 *      newly-written intent is silently dropped.
 *
 * Both are instances of the same root cause: navigating using data that was
 * true when it was READ, asserted as true at the moment of the CLICK, with no
 * re-verification in between. The fix is not a smarter cache invalidation —
 * it is to stop trusting stored decision data at click time at all.
 *
 * ── THE FIX, IN FULL ─────────────────────────────────────────────────────────
 *
 *   1. AWAIT the canonical `/advance` call — let the orchestrator do
 *      everything it safely can before the operator looks at the result.
 *   2. AWAIT the authoritative Track 2 GET/read AFTER `/advance` resolves —
 *      never the pre-click cached projection.
 *   3. Take the pending-decision deep link from THAT fresh read alone — never
 *      the one that was already sitting in the button's own closure.
 *   4. Navigate (and scroll) only once 1–3 have all completed. A failure at
 *      step 1 or 2 returns an explicit outcome and never reaches this step —
 *      no stale navigation, ever.
 *
 * Pure orchestration, no React import, no fetch of its own — every IO step is
 * caller-injected (mirrors `track2DuplicateQueueSettle.ts`'s house style
 * exactly), so the exact call order is unit-testable without rendering any
 * DOM and without a network. Deliberately reuses the EXISTING navigation
 * primitives (`goToTrack2Stage` for a named deep-link, `goToExperimentLab`
 * for the generic fallback when nothing is pending) as the `navigate`/
 * `navigateGeneric` dependencies — this module adds NO second navigation
 * mechanism, it only defers the EXISTING one until the state backing it is
 * verified fresh (`inv.engineering.036`/`037`).
 */

import type { Track2DeepLink } from '@/services/research/track2Programme';

export interface Track2ProceedDeps {
  /** POSTs the canonical `/advance` orchestrator route. Rejects on failure —
   *  the sequence stops there and `readPendingDeepLink`/`navigate` are never
   *  called. Never a second progression mechanism. */
  advance: () => Promise<void>;
  /** Re-reads the SAME authoritative Track 2 GET the whole panel already
   *  uses, AFTER `advance` resolves, and returns the pending decision's own
   *  deep link from THAT read — `null` when the fresh read genuinely has no
   *  pending decision (e.g. every human-gated stage is already resolved),
   *  `undefined` when the read itself failed (distinct from "nothing
   *  pending" — the caller must not treat a failed read as "nothing to do"). */
  readPendingDeepLink: () => Promise<Track2DeepLink | null | undefined>;
  /** Navigates to the EXACT stage the fresh read named — wire this to the
   *  existing `goToTrack2Stage`, never a second implementation of it. */
  navigate: (deepLink: Track2DeepLink) => void;
  /** Navigates generically (no specific stage to point to) — wire this to
   *  the existing `goToExperimentLab`. Called only when the fresh read
   *  confirms there is genuinely no pending decision; never used to paper
   *  over a failed read. */
  navigateGeneric: () => void;
}

export type Track2ProceedOutcome =
  | { kind: 'advance-failed'; error: string }
  | { kind: 'refresh-failed' }
  | { kind: 'navigated'; deepLink: Track2DeepLink }
  | { kind: 'navigated-generic' };

export async function proceedToTrack2Stage(deps: Track2ProceedDeps): Promise<Track2ProceedOutcome> {
  try {
    await deps.advance();
  } catch (e) {
    return { kind: 'advance-failed', error: e instanceof Error ? e.message : 'advance failed' };
  }

  const deepLink = await deps.readPendingDeepLink().catch(() => undefined);
  if (deepLink === undefined) return { kind: 'refresh-failed' };

  if (deepLink === null) {
    deps.navigateGeneric();
    return { kind: 'navigated-generic' };
  }

  deps.navigate(deepLink);
  return { kind: 'navigated', deepLink };
}
