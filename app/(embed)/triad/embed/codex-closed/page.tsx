/**
 * /triad/embed/codex-closed
 *
 * Navigation target when a cartridge closes via:
 *   - The shell sending `metame:cartridge-closed` (CartridgePresenceRegistry contract), or
 *   - The user clicking the cartridge's X button when no inline onClose handler exists
 *     (e.g. wallet task chips that URL-nav'd into the cartridge).
 *
 * Responsibilities:
 *   1. Broadcast the canonical `metame:cartridge-closed` event so the
 *      shell (Lovable / runtime host) sees an unambiguous teardown
 *      confirmation.
 *   2. Return the iframe to wherever the user CAME FROM, so closing a
 *      wallet-launched cartridge doesn't leave them on a blank screen.
 *      Three fallback layers (best to worst):
 *        a. `?returnTo=<url>` query param — explicit caller intent
 *        b. document.referrer (same-origin only) — browser-provided
 *        c. window.history.back() — last-resort browser back
 *      If all three fail (no history depth, no referrer), we render a
 *      minimal "Cartridge closed" message with a "Go home" link so the
 *      user is never trapped on a true blank screen.
 */

"use client";

import { useEffect, useState } from "react";
import { METAME_EVENTS } from "@/types/metameWindow";

function isSafeReturnUrl(candidate: string | null): candidate is string {
  if (!candidate) return false;
  // Only allow same-origin or relative URLs. Absolute cross-origin
  // returns could be redirect-abused; reject them.
  try {
    if (candidate.startsWith('/')) return true;
    const url = new URL(candidate);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function CodexClosedPage() {
  const [stranded, setStranded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cartridgeId = params.get('cartridgeId') || undefined;
    const returnTo = params.get('returnTo');

    // 1. Broadcast the close event (canonical + same-frame + parent).
    const payload = {
      type: METAME_EVENTS.CARTRIDGE_CLOSED,
      schemaVersion: 1,
      ...(cartridgeId ? { cartridgeId } : {}),
    };
    try { window.postMessage(payload, window.location.origin); } catch { /* noop */ }
    if (window.parent !== window) {
      try { window.parent.postMessage(payload, '*'); } catch { /* CSP / cross-origin */ }
    }

    // 2. Return to where the user came from.
    //
    // 2a. Explicit returnTo query param wins. Wallet navigation will
    //     pass `returnTo=<current pathname+search>` so closing the
    //     cartridge lands the user back on their previous view.
    if (isSafeReturnUrl(returnTo)) {
      window.location.replace(returnTo);
      return;
    }

    // 2b. document.referrer fallback (same-origin only). Catches the
    //     case where a caller didn't explicitly set returnTo but the
    //     browser knows where they came from.
    try {
      const ref = document.referrer;
      if (ref) {
        const refUrl = new URL(ref);
        if (refUrl.origin === window.location.origin &&
            !refUrl.pathname.startsWith('/triad/embed/codex-closed') &&
            !refUrl.pathname.startsWith('/triad/embed/codex/')) {
          window.location.replace(ref);
          return;
        }
      }
    } catch { /* ignore */ }

    // 2c. history.back() last resort. If history depth allows, this
    //     pops one entry — typically the URL the wallet redirected
    //     away from.
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    // 3. No way back — render a minimal stranded-state UI rather than
    //    leaving a blank screen.
    setStranded(true);
  }, []);

  if (!stranded) {
    return <div className="h-full w-full bg-transparent" aria-hidden />;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-slate-300">
      <h2 className="text-base font-medium text-slate-200">Cartridge closed</h2>
      <p className="text-sm text-slate-400">
        Nowhere to go back to — pick a destination below.
      </p>
      <div className="mt-2 flex gap-2">
        <a
          href="/"
          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
        >
          Home
        </a>
        <a
          href="/triad/embed/codex/knyt"
          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20"
        >
          KNYT Codex
        </a>
      </div>
    </div>
  );
}
