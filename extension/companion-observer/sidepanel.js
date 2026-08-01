/**
 * metaMe Companion — side panel host page script.
 * (PRD-MMC-IMPL-001 §7 follow-up: docked overlay instead of a new tab.)
 *
 * Points the iframe at the real Companion embed page. Identity resolution
 * happens the SAME way it already does for any other tab on this origin —
 * the iframe shares dev-beta.aigentz.me's own localStorage/cookies with any
 * other tab the operator has open on that origin (iframes are not a separate
 * storage partition from same-origin top-level tabs), so
 * `useCodexEmbedAuthBridge`'s existing localStorage fallback picks up the
 * active persona without this script needing to pass anything extra.
 *
 * RUNTIME REGISTRATION (SPEC-MMC-003 §3.6, 2026-07-25): the one thing this
 * script DOES pass is which Companion surface is hosting the embed. Without
 * it the page hardcoded `surface: 'web-embed'` into `resolveCompanionContext`
 * even when it was mounted inside the extension's docked side panel, so the
 * runtime could not distinguish the two — the exact gap §0.5 named
 * ('extension-sidebar' reserved in `types/companion.ts`, never used). The
 * param is validated by the receiving page against the canonical
 * `COMPANION_SURFACE_KINDS` list (`parseCompanionSurfaceKind`); an absent or
 * unknown value falls back to 'web-embed' exactly as before.
 */
const companionFrame = document.getElementById('companionFrame');
companionFrame.src = `${COMPANION_EMBED_URL}?surface=${encodeURIComponent(COMPANION_SURFACE_SIDEBAR)}`;

/**
 * REFRESH BRIDGE (2026-07-25) — iframe ⇄ extension.
 *
 * THE GAP THIS CLOSES: the Overlay panel's Refresh button lives in the
 * Companion page, which is a WEB PAGE inside this iframe. It has no chrome.*
 * access, so it could only ever re-fetch `/api/companion/overlay` — re-reading
 * the STORED observation without being able to ask the active tab for a fresh
 * one. Whenever that stored row was wrong or stale, Refresh looked broken and
 * genuinely was, from the operator's point of view (reported three times,
 * 2026-07-25). This page IS an extension document, so it can do the one hop
 * the web page cannot.
 *
 * SECURITY: the inbound origin check is strict and non-negotiable — this
 * relay reaches `chrome.tabs`, so anything it accepts must be provably from
 * the Companion app itself. `event.source !== companionFrame.contentWindow`
 * rejects messages from any other frame; `event.origin !== COMPANION_APP_ORIGIN`
 * rejects any other origin even if it somehow got a handle. The message
 * carries NO data — it is a bare instruction, and the only action it can
 * trigger is a re-observation that applies the content script's own
 * visibility guard and live grant checks (background.js's
 * `reObserveActiveTab`). It cannot read anything, and it cannot cause an
 * observation a page load wouldn't already produce.
 */
const REOBSERVE_REQUEST = 'metame-companion:request-reobserve';
const REOBSERVE_DONE = 'metame-companion:reobserve-done';

/**
 * OPEN-TAB BRIDGE (bug fix, 2026-08-01) — iframe ⇄ extension, same shape as
 * the REFRESH BRIDGE above.
 *
 * THE GAP THIS CLOSES: Quick Links (`openQuickLink` in the Companion embed)
 * and the Passport connect handoff (`PassportConnectPanel.tsx`,
 * `world === "companion"`) both used to call plain `window.open(url, "_blank",
 * ...)` from inside `companionFrame` — a browsing context nested under this
 * side panel, not a tab. Chromium has no tab strip to attach a nested
 * iframe's `window.open` to, so it opens a new top-level browser WINDOW
 * instead of a tab in the window this side panel is docked to, and that
 * window is not guaranteed to share the calling window's profile —
 * operator-reported 2026-08-01: Quick Links opened in a separate, regular
 * (non-incognito) browser window while testing from an incognito one. The
 * same defect explained why "Pull Across" kept failing even after the
 * Companion reported a successful connect: the handoff tab that is supposed
 * to complete the crossing landed somewhere `background.js`'s
 * `chrome.tabs.query({ active: true, currentWindow: true })` (in
 * `getCompanionAppTab`) could never find.
 *
 * `sidepanel.js` IS an extension document, correctly bound to the window it
 * is docked to (`chrome.sidePanel.open({ windowId })`), so it can call
 * `chrome.tabs.create({ url })` directly — that creates a real tab in the
 * SAME window/profile, unlike `window.open` from the nested iframe.
 *
 * SECURITY: identical discipline to the REFRESH BRIDGE — `event.source`/
 * `event.origin` must be the Companion iframe, and `url` must itself resolve
 * to the Companion app's own origin (`COMPANION_APP_ORIGIN`). This relay
 * grants no new capability beyond "open a tab", and it will only ever open a
 * tab pointed at the app that already runs inside this side panel.
 */
const OPEN_TAB_REQUEST = 'metame-companion:open-tab';
const OPEN_TAB_DONE = 'metame-companion:open-tab-done';

function isCompanionAppOriginUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url).origin === COMPANION_APP_ORIGIN;
  } catch {
    return false;
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== companionFrame.contentWindow) return;
  if (event.origin !== COMPANION_APP_ORIGIN) return;

  if (event.data?.type === REOBSERVE_REQUEST) {
    // ALWAYS answers exactly once. The panel awaits this reply, so a silent
    // drop would leave it waiting on its own timeout every cycle. Same MV3
    // hazard as content.js's sendMessage: the background worker can be torn
    // down mid-call and the callback then never fires at all.
    let answered = false;
    const answer = (ok) => {
      if (answered) return;
      answered = true;
      clearTimeout(timer);
      companionFrame.contentWindow?.postMessage({ type: REOBSERVE_DONE, ok }, COMPANION_APP_ORIGIN);
    };
    const timer = setTimeout(() => answer(false), 3000);

    try {
      chrome.runtime.sendMessage({ type: 'REQUEST_ACTIVE_TAB_REOBSERVE' }, (result) => {
        // Reading lastError is required; it also suppresses the "Unchecked
        // runtime.lastError" console noise on every failed call.
        const failed = Boolean(chrome.runtime.lastError);
        answer(!failed && Boolean(result?.ok));
      });
    } catch (err) {
      console.warn('[metaMe Companion] re-observe relay failed:', err?.message ?? err);
      answer(false);
    }
    return;
  }

  if (event.data?.type === OPEN_TAB_REQUEST) {
    const url = event.data?.url;
    const answer = (ok) => {
      companionFrame.contentWindow?.postMessage({ type: OPEN_TAB_DONE, ok }, COMPANION_APP_ORIGIN);
    };

    if (!isCompanionAppOriginUrl(url)) {
      // Refuse to open anything off the Companion app's own origin from this
      // privileged relay — same discipline as `background.js`'s
      // `isCompanionAppUrl` guard on the auth-extraction path. Every real
      // caller (Quick Links, the passport handoff) only ever asks for a
      // COMPANION_APP_ORIGIN destination.
      answer(false);
      return;
    }

    try {
      // No `windowId` — defaults to the window this side panel document is
      // itself associated with, which is the whole point: the SAME window
      // the citizen is looking at, not wherever `window.open` from the
      // nested iframe happened to land.
      chrome.tabs.create({ url });
      answer(true);
    } catch (err) {
      console.warn('[metaMe Companion] open-tab relay failed:', err?.message ?? err);
      answer(false);
    }
  }
});
