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
 *      session (access token + refresh token + expiry) from the metaMe web
 *      app's `localStorage` (the same pattern CLAUDE.md's own "Debugging
 *      from DevTools" section documents as the sanctioned manual
 *      extraction — relocated here into a scripted extraction), cache it,
 *      and attach the access token as `Authorization: Bearer <token>` on
 *      future API calls — mirroring `personaFetch`'s mechanism relocated
 *      into the extension.
 *   5. Proactively refresh an expiring-soon access token via
 *      `POST /api/companion/observer/refresh-session` (server-side proxy
 *      to Supabase's own `auth.refreshSession` — the extension never holds
 *      the Supabase project URL/anon key), and retry exactly once on a
 *      401 that slips past that check (clock skew, server-side session
 *      revocation). This closes the gap this file's header previously
 *      flagged as "NOT SOLVED" for token refresh/expiry.
 */

importScripts('constants.js', 'observerConsentExt.js');

const STORAGE_KEY_GRANT_STATE = 'observerGrantState';
const STORAGE_KEY_AUTH_SESSION = 'metameAuthSession'; // { accessToken, refreshToken, expiresAt }
const EXPIRY_SAFETY_MARGIN_SECONDS = 60;

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

function persistAuthSession(session) {
  return chrome.storage.local.set({ [STORAGE_KEY_AUTH_SESSION]: session });
}

const API_FETCH_TIMEOUT_MS = 10000;

/**
 * `fetch` with a hard timeout — every network call this worker makes to the
 * Companion API goes through this. Without it, a slow or hung server
 * response leaves the calling promise (and therefore the popup's "Connecting…"
 * state) pending forever with no way out. Mirrors the same discipline
 * `app/api/_lib/supabaseServer.ts`'s `getTimedFetch` already applies
 * server-side — this is that same guarantee on the extension's side of the
 * same API calls.
 */
function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS) });
}

/**
 * Calls the server-side refresh proxy (`POST /api/companion/observer/
 * refresh-session`, added alongside this pass) with the cached
 * refresh_token and persists the new token trio it returns. The extension
 * never talks to Supabase's own `/auth/v1/token` endpoint directly and
 * never holds the Supabase project URL/anon key — same minimum-disclosure
 * shape as every other Companion API call this worker makes.
 */
async function performRefresh(session) {
  try {
    const res = await fetchWithTimeout(`${COMPANION_OBSERVER_API_BASE}/refresh-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, reason: `refresh-http-${res.status}` };
    const body = await res.json();
    if (!body?.accessToken) return { ok: false, reason: 'refresh-response-missing-access-token' };
    const nextSession = {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken ?? session.refreshToken,
      expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : null,
    };
    await persistAuthSession(nextSession);
    return { ok: true, session: nextSession };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

/**
 * Returns a session whose access_token is safe to use right now. Proactively
 * refreshes when `expiresAt` is within `EXPIRY_SAFETY_MARGIN_SECONDS`, or
 * always when `force` is set (used for the retry-once-on-401 path below). If
 * there is no `refreshToken` to refresh with, falls through with whatever
 * access_token is cached — the caller's own 401 handling is the backstop.
 */
async function ensureFreshToken({ force = false } = {}) {
  const { [STORAGE_KEY_AUTH_SESSION]: session } = await chrome.storage.local.get([
    STORAGE_KEY_AUTH_SESSION,
  ]);
  if (!session?.accessToken) return { ok: false, reason: 'no-auth-session' };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isExpiringSoon =
    typeof session.expiresAt === 'number' && session.expiresAt - nowSeconds <= EXPIRY_SAFETY_MARGIN_SECONDS;

  if (!force && !isExpiringSoon) return { ok: true, session };
  if (!session.refreshToken) return { ok: true, session };

  return performRefresh(session);
}

/**
 * Refreshes `grantStateCache` from the real Companion API. Fails CLOSED: any
 * error (no session, network failure, non-2xx) leaves the existing cache
 * untouched rather than clearing it to "everything granted" — the safe
 * failure direction for a consent system.
 */
async function refreshGrantsFromServer() {
  const fresh = await ensureFreshToken();
  if (!fresh.ok) return { ok: false, reason: fresh.reason };

  const callGrants = (token) =>
    fetchWithTimeout(`${COMPANION_OBSERVER_API_BASE}/grants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

  try {
    let res = await callGrants(fresh.session.accessToken);

    if (res.status === 401 && fresh.session.refreshToken) {
      // The access token was rejected despite passing our own expiry check
      // (clock skew, session revoked server-side, etc.) — force exactly one
      // refresh-and-retry before giving up.
      const forced = await ensureFreshToken({ force: true });
      if (!forced.ok) return { ok: false, reason: forced.reason };
      res = await callGrants(forced.session.accessToken);
    }

    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const body = await res.json();
    const grants = Array.isArray(body?.grants) ? body.grants : [];
    persistGrantState(grantsArrayToState(grants));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

// ─── "Connect to metaMe" — extract the Supabase session from the web app's
// localStorage while a metaMe tab is open, mirroring CLAUDE.md's own
// sanctioned DevTools snippet:
//   Object.keys(localStorage).find(k => k.includes('auth-token'))
// ────────────────────────────────────────────────────────────────────────

/** Runs INSIDE the metaMe tab (via chrome.scripting.executeScript) — this
 *  function is serialized and executed in the page's own context, so it
 *  cannot close over any variable from this file. Returns the full session
 *  (access_token + refresh_token + expires_at), not just the access token —
 *  the refresh_token is what makes proactive refresh possible at all. */
function extractSupabaseSessionFromPage() {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    const session = parsed?.currentSession ?? parsed;
    if (!session?.access_token) return null;
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token ?? null,
      expiresAt: typeof session.expires_at === 'number' ? session.expires_at : null,
    };
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
      func: extractSupabaseSessionFromPage,
    });
  } catch (err) {
    return { ok: false, reason: `executeScript-failed: ${String(err)}` };
  }

  const session = results?.[0]?.result;
  if (!session?.accessToken) return { ok: false, reason: 'no-token-found-in-page' };

  await persistAuthSession(session);
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
