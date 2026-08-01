/**
 * Companion → extension side panel bridge: "open this URL as a real browser
 * tab in the CORRECT window" (regression fix, 2026-08-01).
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * The Companion embed (`app/(embed)/triad/embed/companion/page.tsx`) is a
 * normal web page loaded inside an `<iframe>` (`sidepanel.html`'s
 * `companionFrame`) that is itself a Chrome EXTENSION SIDE PANEL document —
 * not a browser tab. `sidepanel.js` docks that panel to a specific browser
 * window via `chrome.sidePanel.open({ windowId })`.
 *
 * Two call sites in this surface used to call plain `window.open(url, "_blank",
 * ...)` from INSIDE that nested iframe: Quick Links (this page's
 * `openQuickLink`) and the Passport connect handoff
 * (`components/companion/PassportConnectPanel.tsx`, `world === "companion"`).
 * `window.open` from a browsing context nested under an extension side panel
 * does not reliably open a TAB in the side panel's own host window — Chromium
 * has no tab strip to attach to from a side-panel-hosted document, so it opens
 * a new top-level browser window instead, and that window is not guaranteed to
 * share the calling window's profile. Operator-reported 2026-08-01, testing in
 * a private/incognito window: Quick Links opened their destination as a
 * separate popup window landing in the citizen's REGULAR (non-incognito)
 * browser — not even the same window, let alone the same profile. The exact
 * same code shape in `PassportConnectPanel`'s handoff explains why "Pull
 * Across" kept failing even after a Companion sign-in reported "Connected":
 * `extension/companion-observer/background.js`'s `getCompanionAppTab()` looks
 * for the metaMe application tab via
 * `chrome.tabs.query({ active: true, currentWindow: true })` — a handoff tab
 * that opened in the WRONG window is invisible to that query, so pairing
 * (`connectToMetaMe`) keeps failing with `active-tab-not-metame` /
 * `no-active-persona`, and the extension's own grant cache — which every
 * `checkGrant()` in `content.js` reads before writing an Overlay observation —
 * never learns the persona whose grants the citizen just set from inside the
 * Companion, so the Overlay panel and Quick Links context both keep reading
 * as if nothing had ever been granted.
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────
 *
 * `sidepanel.js` IS an extension document, correctly bound to the window it
 * is docked to. It can call `chrome.tabs.create({ url })` directly — that API
 * (unlike `window.open` from a nested iframe) creates a real tab in the
 * SAME window/profile the side panel itself is attached to, exactly like the
 * already-shipped `REQUEST_ACTIVE_TAB_REOBSERVE` bridge
 * `CompanionOverlayPanel.tsx` uses for its Refresh button. This module is the
 * SAME postMessage-request/ack shape, generalised to "open this tab" instead
 * of "re-observe the active tab" — one bridge pattern, not two.
 *
 * Degrades cleanly outside the extension (plain web embed with no parent, or
 * an older extension build without the `OPEN_TAB_REQUEST` handler): the
 * promise resolves `false` and the caller falls back to its own prior
 * `window.open` behaviour, unchanged from before this fix.
 */

export const OPEN_TAB_REQUEST = "metame-companion:open-tab";
export const OPEN_TAB_DONE = "metame-companion:open-tab-done";

/** How long to wait for `sidepanel.js` to acknowledge before giving up and
 *  letting the caller fall back to `window.open`. A same-process postMessage
 *  round trip is sub-millisecond in practice; this is a generous ceiling, not
 *  a expected wait. */
const BRIDGE_TIMEOUT_MS = 400;

/**
 * Ask the extension side panel hosting this iframe to open `url` as a real
 * tab in its own (correctly windowed/profiled) browser window.
 *
 * `url` may be relative (e.g. `buildCodexUrl`'s output) — resolved against
 * `window.location.origin` before it is sent, since the RECEIVING document
 * (`sidepanel.js`) is a `chrome-extension://` page and would otherwise
 * resolve a relative URL against its OWN origin instead of the Companion
 * app's.
 *
 * Resolves `true` only once `sidepanel.js` has acknowledged it called
 * `chrome.tabs.create`. Resolves `false` — never rejects — when there is no
 * parent to ask (not hosted inside the extension) or nothing answers in time,
 * so every caller can treat this as "did the bridge handle it?" and fall back
 * to `window.open` exactly as it did before this bridge existed.
 */
export function openInSidePanelHostWindow(url: string): Promise<boolean> {
  if (typeof window === "undefined" || window.parent === window) {
    return Promise.resolve(false);
  }

  const absoluteUrl = (() => {
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  })();

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(ok);
    };
    const onMessage = (event: MessageEvent) => {
      // The reply comes from the extension page hosting this iframe — we
      // cannot hardcode its chrome-extension:// origin, so verify it is our
      // own parent and carries the expected marker, mirroring
      // `CompanionOverlayPanel.tsx`'s identical `requestFreshObservation`
      // verification.
      if (event.source !== window.parent) return;
      if ((event.data as { type?: string; ok?: boolean } | null)?.type !== OPEN_TAB_DONE) return;
      finish(Boolean((event.data as { ok?: boolean }).ok));
    };
    const timer = setTimeout(() => finish(false), BRIDGE_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: OPEN_TAB_REQUEST, url: absoluteUrl }, "*");
  });
}
