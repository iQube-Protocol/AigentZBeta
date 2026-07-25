/**
 * metaMe Companion — Observer extension content script
 * (PRD-MMC-IMPL-001 §7 Increment 6).
 *
 * Runs in every http(s) page (per manifest.json's `content_scripts` match
 * pattern) but reads NOTHING beyond a console-visible injection marker until
 * it has asked the background service worker — the single source of truth
 * for grant state (`background.js`) — whether each capability it wants to
 * populate is actually granted for this page. This script NEVER maintains
 * its own notion of "granted"; every check is a `CHECK_GRANT` message
 * round-trip.
 *
 * `constants.js` is loaded ahead of this file (manifest.json's
 * `content_scripts[0].js` array) so `PAGE_DOCUMENT_EXCERPT_MAX_CHARS` is
 * already in scope here.
 */

console.log('[metaMe Observer] content script injected on', location.href);

// Presence marker for background.js's `healObserverInOpenTabs` probe. Set in
// the ISOLATED world (where both this script and the probe's `func` run), so
// healing can tell "this tab already has an observer" from "this tab lost its
// observer to an extension reload" and skip the former. Without it, healing
// re-injects over a live script and the top-level `const` declarations below
// throw a redeclaration SyntaxError — harmless (the existing script keeps
// running) but noisy in every page console on browser startup.
window.__metameObserverLoaded = true;

/** Wraps `chrome.runtime.sendMessage` in a Promise for async/await use. */
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
  });
}

async function checkGrant(capability) {
  const response = await sendMessage({
    type: 'CHECK_GRANT',
    capability,
    siteDomain: location.hostname,
  });
  return Boolean(response && response.granted);
}

/**
 * Builds a `BrowserContextObservation`-shaped object (mirrors
 * `types/companionObserver.ts`'s interface field-for-field — kept in sync by
 * hand, same known-risk duplication flagged in `constants.js`), populating
 * ONLY fields whose capability the background worker confirms is granted.
 */
/**
 * Grant-refresh throttle. `buildObservation` refreshes the background
 * worker's grant cache from the SERVER on every call (see the comment inside
 * it for why that refresh exists at all). Once re-observation runs on every
 * tab switch rather than once per page load, an un-throttled refresh means a
 * network round-trip per flick between tabs.
 *
 * 15s is chosen against what the refresh is FOR: catching a capability the
 * operator just granted in the Companion panel. That's a deliberate human
 * action followed by looking at the Overlay — comfortably more than 15s of
 * wall-clock. So the staleness bug the refresh fixes stays fixed, and the
 * per-switch cost goes away. Page load always refreshes (lastGrantRefreshAt
 * starts at 0).
 */
const GRANT_REFRESH_MIN_INTERVAL_MS = 15_000;
let lastGrantRefreshAt = 0;

/** Trailing debounce for visibility-driven re-observation: rapid A→B→A tab
 *  flicking collapses to ONE observation instead of three. */
const OBSERVE_DEBOUNCE_MS = 400;
let observeTimer = null;

/** The last payload actually POSTed, minus its timestamp. An observation
 *  identical to it carries no new information, so sending it would cost a
 *  write and a row update to say nothing. */
let lastSentSignature = null;

async function buildObservation() {
  // Refresh the background worker's grant cache from the server FIRST. The
  // worker's `grantStateCache` is only populated at Connect time or on an
  // explicit REFRESH_GRANTS message (background.js) -- granting/revoking a
  // capability through the Companion web panel writes straight to the
  // server and never touches this cache on its own. Without this refresh,
  // every checkGrant() below silently answers against stale, pre-grant
  // state -- the real reason Overlay kept showing "no observation" even
  // after granting Current-tab and reloading the tab (2026-07-23). Failure
  // here (no connection, network error) is non-fatal -- checkGrant() below
  // just falls back to whatever the cache already had, same as before this
  // refresh existed.
  const now = Date.now();
  if (now - lastGrantRefreshAt >= GRANT_REFRESH_MIN_INTERVAL_MS) {
    lastGrantRefreshAt = now;
    await sendMessage({ type: 'REFRESH_GRANTS' });
  }

  const grantedCapabilities = [];
  const observation = { grantedCapabilities, observedAt: new Date().toISOString() };

  if (await checkGrant('current-tab')) {
    grantedCapabilities.push('current-tab');
    observation.currentTabDomain = location.hostname;
    observation.currentTabTitle = document.title;
  }

  if (await checkGrant('selection')) {
    const text = window.getSelection ? String(window.getSelection()) : '';
    if (text) {
      grantedCapabilities.push('selection');
      observation.selectionText = text;
    }
  }

  if (await checkGrant('page-document')) {
    grantedCapabilities.push('page-document');
    const bodyText = document.body ? document.body.innerText : '';
    observation.pageDocumentExcerpt = bodyText.slice(0, PAGE_DOCUMENT_EXCERPT_MAX_CHARS);
  }

  return observation;
}

async function observeAndSend() {
  // Hard guard, not just at the call sites: a hidden tab must never write an
  // observation claiming to be the current tab, no matter which path called
  // this. Callers check too (see main()), but this is the choke point that
  // makes the rule impossible to bypass by adding a new caller later.
  if (document.visibilityState !== 'visible') {
    console.log('[metaMe Observer] observe skipped — tab is not visible');
    return;
  }

  const observation = await buildObservation();
  console.log('[metaMe Observer] observation built (fields gated by live grant check):', observation);

  // Identical-payload suppression. `observedAt` is excluded because it
  // changes on every build by definition — including it would defeat the
  // check entirely. Everything the server actually stores or renders IS
  // compared, so a genuinely changed observation (new domain, new title, a
  // selection made or cleared, page text changed) always sends.
  const { observedAt: _observedAt, ...material } = observation;
  const signature = JSON.stringify(material);
  if (signature === lastSentSignature) {
    console.log('[metaMe Observer] observation unchanged since last send — skipped');
    return;
  }

  const result = await sendMessage({ type: 'OBSERVATION', observation });
  console.log('[metaMe Observer] background observation handling result:', result);
  // Only record the signature once the consent choke point ACCEPTED it. A
  // rejected observation must not suppress the next attempt.
  if (result && result.ok) lastSentSignature = signature;
}

/** Debounced entry point for every event-driven re-observation. */
function scheduleObserve() {
  if (observeTimer) clearTimeout(observeTimer);
  observeTimer = setTimeout(() => {
    observeTimer = null;
    void observeAndSend();
  }, OBSERVE_DEBOUNCE_MS);
}

async function main() {
  // Message-passing smoke check — a plain ping/pong proving the content
  // script and background service worker can talk to each other, entirely
  // independent of any real grant/API state.
  const pong = await sendMessage({ type: 'PING' });
  console.log('[metaMe Observer] ping/pong result:', pong);

  // ONLY OBSERVE IF THIS TAB IS ACTUALLY THE ONE BEING LOOKED AT.
  //
  // `currentTabDomain` means "the tab the operator is on" — a HIDDEN tab
  // asserting that is simply false, whatever else is true. The
  // `visibilitychange` listener below is what observes when this tab
  // genuinely becomes the visible one; a background tab has nothing
  // legitimate to say here and stays silent until then.
  //
  // THE BUG THIS FIXES (operator-reported 2026-07-25, third round on this
  // surface: "still seems to be showing previous page and refresh still not
  // working"). `healObserverInOpenTabs` (background.js) injects this script
  // into EVERY open tab at once after an extension reload. With an
  // unconditional observe here, all of those tabs raced to write into
  // `companion_observation_latest` — one row per persona — and whichever
  // finished LAST won. The operator was on dev-beta.aigentz.me and the
  // Overlay showed "REPOSITORY — GITHUB.COM": not a stale row at all, but a
  // FRESH row written by a background github.com tab microseconds later.
  // Refresh looked broken for the same reason it did in the two earlier
  // rounds — it faithfully re-read a row whose content was wrong.
  //
  // Page-load observation still happens normally for the foreground tab
  // (a tab you navigate is visible by definition), so nothing regresses.
  if (document.visibilityState === 'visible') {
    await observeAndSend();
  } else {
    console.log('[metaMe Observer] tab is hidden at injection — not claiming to be the current tab');
  }
}

main();

// Re-observe whenever this tab regains focus/visibility, not just once at
// page load. Without this, granting a capability (e.g. "Current tab") while
// a tab is already open has no effect until the operator reloads that tab —
// the stored observation stays the stale pre-grant one, gated fields never
// appear, and the Overlay looks broken even though the grant is correct.
//
// Debounced + identical-payload-suppressed (2026-07-25) so that "re-observe
// whenever the tab is looked at" does not become a network write per tab
// flick. Switching away and back with nothing changed now costs zero
// requests; switching to a genuinely different page always sends.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    scheduleObserve();
  }
});

// Background-initiated re-observation. Sent by `healObserverInOpenTabs`
// (background.js) to the ACTIVE tab as the last step of a healing sweep, so
// the stored observation deterministically describes the tab the operator is
// looking at rather than whichever injected content script happened to
// finish last. Still routed through `observeAndSend`, so the visibility
// guard and every live grant check apply identically — this message cannot
// make a hidden tab observe, and grants nothing a page load wouldn't.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'RE_OBSERVE') void observeAndSend();
  // No response needed; returning false keeps the channel synchronous.
  return false;
});
