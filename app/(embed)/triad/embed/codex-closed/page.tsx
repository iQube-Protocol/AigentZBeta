/**
 * /triad/embed/codex-closed
 *
 * Empty embed route used as the navigation target when the thin-client
 * shell sends a `metame:cartridge-closed` to the iframe. Renders nothing
 * visible (just a transparent placeholder so the iframe stays alive but
 * shows no cartridge content) and re-broadcasts the close event so the
 * shell sees an unambiguous "iframe acknowledged the close" signal.
 *
 * The shell can additionally remove the iframe from its DOM if it wants
 * a hard teardown — this route is purely the soft "show nothing" state
 * so the user sees the cartridge close even if the shell forgets to
 * unmount.
 */

"use client";

import { useEffect } from "react";
import { METAME_EVENTS } from "@/types/metameWindow";

export default function CodexClosedPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cartridgeId = new URLSearchParams(window.location.search).get('cartridgeId') || undefined;
    const payload = {
      type: METAME_EVENTS.CARTRIDGE_CLOSED,
      schemaVersion: 1,
      ...(cartridgeId ? { cartridgeId } : {}),
    };
    try { window.postMessage(payload, window.location.origin); } catch { /* noop */ }
    if (window.parent !== window) {
      try { window.parent.postMessage(payload, '*'); } catch { /* CSP / cross-origin */ }
    }
  }, []);

  return (
    <div className="h-full w-full bg-transparent" aria-hidden />
  );
}
