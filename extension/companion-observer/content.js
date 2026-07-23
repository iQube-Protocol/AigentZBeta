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
async function buildObservation() {
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
  const observation = await buildObservation();
  console.log('[metaMe Observer] observation built (fields gated by live grant check):', observation);

  const result = await sendMessage({ type: 'OBSERVATION', observation });
  console.log('[metaMe Observer] background observation handling result:', result);
}

async function main() {
  // Message-passing smoke check — a plain ping/pong proving the content
  // script and background service worker can talk to each other, entirely
  // independent of any real grant/API state.
  const pong = await sendMessage({ type: 'PING' });
  console.log('[metaMe Observer] ping/pong result:', pong);

  await observeAndSend();
}

main();

// Re-observe whenever this tab regains focus/visibility, not just once at
// page load. Without this, granting a capability (e.g. "Current tab") while
// a tab is already open has no effect until the operator reloads that tab —
// the stored observation stays the stale pre-grant one, gated fields never
// appear, and the Overlay looks broken even though the grant is correct.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void observeAndSend();
  }
});
