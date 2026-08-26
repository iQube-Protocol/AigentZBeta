/**
 * track2DeepLinkIntent.ts — the client-side "consume once" relay for a Track
 * 2 deep-link (operator directive, 2026-08-26, "Research Copilot → Track 2
 * handoff"; corrected 2026-08-27 per review: the relay now carries the
 * COMPLETE `Track2DeepLink`, not a hand-picked subset of its fields).
 *
 * WHY THIS EXISTS: navigating from the Research Copilot to the Experiment
 * Lab is a CARTRIDGE-TAB switch (`window.dispatchEvent(new CustomEvent(
 * 'codex:navigate-tab', ...))`, the existing seam every cartridge already
 * uses) that unmounts the Copilot's tab and mounts `InvariantExperimentLab`
 * fresh. A React listener `InvariantExperimentLab` registers in its OWN
 * mount effect necessarily runs AFTER that mount — i.e. after the very
 * dispatch that caused the mount — so it can never observe that dispatch's
 * event. This module is a tiny, synchronous, module-level "mailbox" instead:
 * the sender writes the intent SYNCHRONOUSLY, in the same call that
 * dispatches the navigation event (so it is set before the mount that reads
 * it), and the receiver consumes (reads + clears) it once on mount.
 *
 * Deliberately NOT sessionStorage/localStorage: this is a one-shot, same-tab,
 * same-session navigation intent, not durable state — persisting it would
 * risk a STALE deep-link firing on a later, unrelated visit to the same tab.
 * `consumePendingTrack2Stage` clears it on read for exactly that reason.
 *
 * THE FULL CONTRACT, END TO END (2026-08-27 fix): this mailbox previously
 * carried only `{experimentId, stageId}`, which meant every consumer had to
 * RECONSTRUCT what it needed from those two fields — `InvariantExperimentLab`
 * hardcoded `experimentId="EXP-P1"` on the panel instead of reading the
 * deep-link's own `experimentId`, and `Track2ProgrammePanel` rebuilt the DOM
 * anchor as `track2-stage-${stageId}` instead of using the deep-link's own
 * `surfaceRef.anchorId` — both silent reconstructions of exactly the kind
 * the canonical-deep-link contract exists to forbid ("do not reconstruct a
 * generic destination client-side"). This mailbox now carries the ENTIRE
 * `Track2DeepLink` verbatim; every consumer reads its fields directly and
 * reconstructs nothing.
 */

import type { Track2DeepLink } from '@/services/research/track2Programme';

let pending: Track2DeepLink | null = null;

/** Called by the sender (e.g. Research Copilot's CTA) synchronously, before
 *  or alongside dispatching the `codex:navigate-tab` event. Stores the
 *  COMPLETE deep-link — never a subset a consumer would have to rebuild. */
export function setPendingTrack2Stage(deepLink: Track2DeepLink): void {
  pending = deepLink;
}

/** Called by the receiver (`InvariantExperimentLab`'s mount effect) exactly
 *  once per intended navigation. Clears the mailbox on read, so a later,
 *  unrelated mount of the same component never replays a stale deep-link. */
export function consumePendingTrack2Stage(): Track2DeepLink | null {
  const value = pending;
  pending = null;
  return value;
}
