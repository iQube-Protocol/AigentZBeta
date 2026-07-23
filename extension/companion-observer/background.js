/**
 * metaMe Companion — Observer extension background service worker
 * (PRD-MMC-IMPL-001 §7 Increment 6).
 *
 * Responsibilities:
 *   1. Hold the single, authoritative in-memory + `chrome.storage.local`
 *      cache of the current persona's `ObserverGrantState` inside the
 *      extension. The content script NEVER maintains its own notion of
 *      "granted" — it always asks this worker via a `CHECK_GRANT` message
 *      (see `content.js`).
 *   2. Refresh that cache from the real Companion API
 *      (`GET /api/companion/observer/grants`, Increment 2) when an auth
 *      token is present.
 *   3. Run `assertObservationRespectsGrants` (mirrored in
 *      `observerConsentExt.js`) before using any observation the content
 *      script sends up.
 *   4. Implement the "Connect to metaMe" auth flow: extract the Supabase
 *      access token from the metaMe web app's `localStorage` (the exact
 *      pattern CLAUDE.md's own "Debugging from DevTools" section documents
 *      as the sanctioned manual extraction — relocated here into a scripted
 *      extraction), cache it, and attach it as `Authorization: Bearer
 *      <token>` on future API calls — mirroring `personaFetch`'s mechanism
 *      relocated into the extension.
 *
 * NOT SOLVED IN THIS PASS (explicitly, per PRD-MMC-IMPL-001 §7): token
 * refresh / expiry. Once a token is cached it is used until an API call
 * rejects it; nothing here proactively refreshes or detects imminent expiry.
 * Flagged as an open question for a future pass, not silently glossed over.
 */

importScripts('constants.js', 'observerConsentExt.js');

const STORAGE_KEY_GRANT_STATE = 'observerGrantState';
const STORAGE_KEY_AUTH_TOKEN = 'metameAuthToken';

/** @type {Record<string, Array<{capability:string,scope:string,siteDomain?:string,grantedAt:string,revokedAt?:string}>>} */
let grantStateCache = emptyGrantState();

// ─── Hydrate the cache from chrome.storage.local on worker start ──────────

chrome.storage.local.get([STORAGE_KEY_GRANT_STATE], (result) => {
  if (result && result[STORAGE_KEY_GRANT_STATE]) {
    grantStateCache = result[STORAGE_KEY_GRANT_STATE];
  }
});

// Keep the in-memory cache in sync with chrome.storage.local regardless of
// what wrote to it (this worker's own `persistGrantState`, a future
// non-background write path, or a test harness seeding state directly) —
// `grantStateCache` is always a live reflection of storage, never a value
// that can only be updated through this file's own functions.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY_GRANT_STATE]) {
    grantStateCache = changes[STORAGE_KEY_GRANT_STATE].newValue || emptyGrantState();
  }
});

function persistGrantState(state) {
  grantStateCache = state;
  chrome.storage.local.set({ [STORAGE_KEY_GRANT_STATE]: state });
}

/**
 * Converts Increment 2's `GET /api/companion/observer/grants` response
 * (`{ grants: ObserverCapabilityGrant[] }`, a flat array of ACTIVE grants
 * only) into the `ObserverGrantState` map shape this worker caches.
 * Mirrors the grouping `types/companionObserver.ts`'s `ObserverGrantState`
 * type expects — one array per capability.
 */
function grantsArrayToState(grants) {
  const state = emptyGrantState();
  for (const g of grants) {
    if (!state[g.capability]) state[g.capability] = [];
    state[g.capability].push(g);
  }
  return state;
}

/**
 * Refreshes `grantStateCache` from the real Companion API. Fails CLOSED: any
 * error (no token, network failure, non-2xx) leaves the existing cache
 * untouched rather than clearing it to "everything granted" — the safe
 * failure direction for a consent system.
 */
async function refreshGrantsFromServer() {
  const { [STORAGE_KEY_AUTH_TOKEN]: token } = await chrome.storage.local.get([
    STORAGE_KEY_AUTH_TOKEN,
  ]);
  if (!token) return { ok: false, reason: 'no-auth-token' };

  try {
    const res = await fetch(`${COMPANION_OBSERVER_API_BASE}/grants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const body = await res.json();
    const grants = Array.isArray(body?.grants) ? body.grants : [];
    persistGrantState(grantsArrayToState(grants));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

// ─── "Connect to metaMe" — extract the Supabase token from the web app's
// localStorage while a metaMe tab is open, mirroring CLAUDE.md's own
// sanctioned DevTools snippet:
//   Object.keys(localStorage).find(k => k.includes('auth-token'))
// ────────────────────────────────────────────────────────────────────────

/** Runs INSIDE the metaMe tab (via chrome.scripting.executeScript) — this
 *  function is serialized and executed in the page's own context, so it
 *  cannot close over any variable from this file. */
function extractSupabaseTokenFromPage() {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
  } catch {
    return null;
  }
}

async function connectToMetaMe() {
  // activeTab: this only works when the user invokes the connect action
  // (popup button click, a user gesture) while the metaMe tab is the active
  // tab in the current window — the least-privileged way to get one-shot
  // scripting access to that tab without a broad host_permissions grant.
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return { ok: false, reason: 'no-active-tab' };

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: extractSupabaseTokenFromPage,
    });
  } catch (err) {
    return { ok: false, reason: `executeScript-failed: ${String(err)}` };
  }

  const token = results?.[0]?.result;
  if (!token) return { ok: false, reason: 'no-token-found-in-page' };

  await chrome.storage.local.set({ [STORAGE_KEY_AUTH_TOKEN]: token });
  const refreshResult = await refreshGrantsFromServer();
  return { ok: true, refreshed: refreshResult };
}

// ─── Message relay — the content script's only path to grant state ────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  switch (message.type) {
    case 'PING': {
      sendResponse({ type: 'PONG', ts: Date.now() });
      return false; // synchronous response
    }

    case 'CHECK_GRANT': {
      const { capability, siteDomain } = message;
      sendResponse({ granted: isCapabilityGranted(grantStateCache, capability, siteDomain) });
      return false;
    }

    case 'OBSERVATION': {
      // Consent-enforcement choke point — mirrors
      // services/companion/observerContext.ts's assertObservationRespectsGrants.
      // Runs before this observation is used for anything (forwarded,
      // cached, or logged beyond this handler's own error path).
      try {
        assertObservationRespectsGrants(message.observation, grantStateCache);
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
        return false;
      }
      // No live, authenticated Companion API session exists to forward this
      // to in this pass (§7's own honest limit) — the observation is simply
      // acknowledged as consent-valid. A future pass POSTs it to an
      // observation-ingest endpoint (not yet defined by Increments 1-5).
      sendResponse({ ok: true });
      return false;
    }

    case 'CONNECT_METAME': {
      connectToMetaMe().then(sendResponse);
      return true; // async response
    }

    case 'REFRESH_GRANTS': {
      refreshGrantsFromServer().then(sendResponse);
      return true; // async response
    }

    default:
      return false;
  }
});
