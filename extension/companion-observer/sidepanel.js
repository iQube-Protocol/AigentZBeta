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

window.addEventListener('message', (event) => {
  if (event.source !== companionFrame.contentWindow) return;
  if (event.origin !== COMPANION_APP_ORIGIN) return;
  if (event.data?.type !== REOBSERVE_REQUEST) return;

  chrome.runtime.sendMessage({ type: 'REQUEST_ACTIVE_TAB_REOBSERVE' }, (result) => {
    // Always answer, even on failure — the panel waits on this and must not
    // hang when there is no observable active tab (e.g. a chrome:// page).
    const ok = Boolean(result?.ok) && !chrome.runtime.lastError;
    companionFrame.contentWindow?.postMessage(
      { type: REOBSERVE_DONE, ok },
      COMPANION_APP_ORIGIN,
    );
  });
});
