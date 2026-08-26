/**
 * track2DeepLinkIntent.ts — the client-side "consume once" relay for a Track
 * 2 deep-link (operator directive, 2026-08-26, "Research Copilot → Track 2
 * handoff").
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
 * This is transport plumbing only. The canonical deep-link CONTRACT itself —
 * programme/experiment/stage/surface — is `Track2DeepLink`
 * (services/research/track2Programme.ts), constructed once, server-side, and
 * carried through this mailbox unmodified. Nothing here reconstructs or
 * guesses a destination.
 */

import type { Track2StageId } from '@/services/research/track2Programme';

export interface PendingTrack2StageIntent {
  experimentId: string;
  stageId: Track2StageId;
}

let pending: PendingTrack2StageIntent | null = null;

/** Called by the sender (e.g. Research Copilot's CTA) synchronously, before
 *  or alongside dispatching the `codex:navigate-tab` event. */
export function setPendingTrack2Stage(experimentId: string, stageId: Track2StageId): void {
  pending = { experimentId, stageId };
}

/** Called by the receiver (`InvariantExperimentLab`'s mount effect) exactly
 *  once per intended navigation. Clears the mailbox on read, so a later,
 *  unrelated mount of the same component never replays a stale deep-link. */
export function consumePendingTrack2Stage(): PendingTrack2StageIntent | null {
  const value = pending;
  pending = null;
  return value;
}
