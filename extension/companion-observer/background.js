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
 *   6. Register the "Pull Across → metaMe" context-menu item (SPEC-MMC-001
 *      §3 Movement I / §9; PRD-MMC-IMPL-003 Increment 4) and, on click,
 *      build a `CapturedObject` payload, run the client-side consent
 *      pre-check, and POST it to `/api/companion/capture` — reusing the
 *      SAME auth/refresh machinery item 5 already built.
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
 * Forwards a locally consent-checked observation to the new
 * `POST /api/companion/observer/observation` endpoint (PRD-MMC-IMPL-002
 * Increment 2, Step 1) — closes the gap this file's `OBSERVATION` handler
 * previously flagged: "No live, authenticated Companion API session exists
 * to forward this to." Uses the SAME `fetchWithTimeout` helper (10s timeout)
 * and the SAME cached auth session token as `refreshGrantsFromServer()`.
 *
 * Fails silently/gracefully on network error — mirrors this file's existing
 * fail-closed style: a failed forward never throws back into the message
 * handler that already told the content script "ok: true" for the local
 * consent check. The server independently re-validates consent against its
 * own stored grant state regardless of what this worker's local cache says
 * (defense in depth, PRD-MMC-IMPL-002 §3 Increment 2 Step 1) — so a forward
 * failure here only means "the Overlay has stale/no context," never a
 * consent-safety gap.
 */
async function forwardObservationToServer(observation) {
  const fresh = await ensureFreshToken();
  if (!fresh.ok) return { ok: false, reason: fresh.reason };

  const postObservation = (token) =>
    fetchWithTimeout(`${COMPANION_OBSERVER_API_BASE}/observation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(observation),
      cache: 'no-store',
    });

  try {
    let res = await postObservation(fresh.session.accessToken);

    if (res.status === 401 && fresh.session.refreshToken) {
      const forced = await ensureFreshToken({ force: true });
      if (!forced.ok) return { ok: false, reason: forced.reason };
      res = await postObservation(forced.session.accessToken);
    }

    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
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

// ─── Capture — "Pull Across" (SPEC-MMC-001 §3 Movement I / §9; ────────────
// PRD-MMC-IMPL-003 Increment 4). The context-menu trigger that recognizes
// something on the Legacy Internet ("this matters") and hands it to the
// runtime to constitutionalize (POST /api/companion/capture) — the
// extension identifies and hands off, it never constitutionalizes anything
// itself (PRD-MMC-IMPL-003 §0.8's governing invariant).
//
// Implementation note vs. the plan's original sketch: `chrome.contextMenus`
// only exists in the background service worker, so `onClicked` calls
// `performCapture` directly rather than round-tripping through a
// `CAPTURE_REQUEST` runtime message to itself — simpler, same outcome, no
// content-script involvement needed for the primary paths below.
// ────────────────────────────────────────────────────────────────────────

/** Runs INSIDE the target tab via chrome.scripting.executeScript (same
 *  isolated-serialized-function pattern as extractSupabaseSessionFromPage) —
 *  cannot close over any variable from this file. */
function extractPageTextFromPage() {
  return document.body ? document.body.innerText : '';
}

async function extractPageText(tabId) {
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageTextFromPage });
    return (results && results[0] && results[0].result) || '';
  } catch (err) {
    return '';
  }
}

function isPdfUrl(url) {
  return typeof url === 'string' && /\.pdf(\?|#|$)/i.test(url);
}

function siteDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Builds a `CapturedObject`-shaped payload (mirrors `types/companionCapture.ts`
 * field-for-field — hand-synced, same known-risk duplication flagged in
 * constants.js) from a context-menu click. Branches on what Chrome's
 * `contextMenus` API actually gave us, cheapest/most-specific signal first:
 * an explicit text selection, then an image, then a PDF URL (server derives
 * `contentText` for these — PRD-MMC-IMPL-003 §0.5), else the whole page's
 * visible text via `chrome.scripting.executeScript` (the SAME `activeTab`
 * user-gesture grant the context-menu click itself just provided).
 */
async function buildCapture(info, tab) {
  const sourceUrl = tab && tab.url ? tab.url : undefined;
  const title = tab && tab.title ? tab.title : undefined;
  const capturedAt = new Date().toISOString();

  if (info.selectionText) {
    return { sourceKind: 'selection', sourceUrl, title, contentText: info.selectionText.slice(0, CAPTURED_CONTENT_MAX_CHARS), capturedAt };
  }
  if (info.mediaType === 'image' && info.srcUrl) {
    const label = info.altText || title || 'Captured image';
    return { sourceKind: 'image', sourceUrl: info.srcUrl, title: label, contentText: label, capturedAt };
  }
  if (isPdfUrl(sourceUrl)) {
    // No contentText -- the server extracts it from sourceUrl via
    // services/content/pdfExtractionService.ts. The extension only
    // identifies and hands off.
    return { sourceKind: 'pdf', sourceUrl, title, capturedAt };
  }
  const pageText = tab && tab.id ? await extractPageText(tab.id) : '';
  return { sourceKind: 'webpage', sourceUrl, title, contentText: pageText.slice(0, CAPTURED_CONTENT_MAX_CHARS), capturedAt };
}

/** Transient badge feedback on the extension icon — no new permission
 *  needed (the `action` API is already available via manifest.json's
 *  `action` key). Best-effort UX signal only; never gates anything. */
function setCaptureBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2500);
  } catch (err) {
    /* badge is cosmetic only -- never block capture on this failing */
  }
}

/**
 * The full capture flow: build the payload, run the CLIENT-SIDE consent
 * pre-check (`assertCaptureRespectsGrants`, mirrored in
 * observerConsentExt.js — the server independently re-validates against its
 * own stored grant state regardless, defense in depth, same discipline as
 * `forwardObservationToServer`), then POST to
 * `/api/companion/capture` using the SAME `ensureFreshToken`/Bearer-token
 * mechanism the Observer calls already use.
 *
 * Refreshes `grantStateCache` from the server FIRST — the same fix
 * `buildObservation()` (content.js) already carries and explains in its own
 * comment: `grantStateCache` is only populated at Connect time or on an
 * explicit REFRESH_GRANTS message; granting a capability through the
 * Companion web panel writes straight to the server and never touches this
 * cache on its own. Missing this refresh here (Capture) reproduced the exact
 * same bug already fixed for Observation/Overlay on 2026-07-23 — capture
 * refusing with a stale "not granted" verdict even though the panel showed
 * every capability as Shared (2026-07-24, operator-reported). Best-effort:
 * failure here is non-fatal, `assertCaptureRespectsGrants` below just falls
 * back to whatever the cache already had, same as before this call existed.
 */
async function performCapture(info, tab) {
  await refreshGrantsFromServer();

  const capture = await buildCapture(info, tab);
  const siteDomain = siteDomainFromUrl(capture.sourceUrl);

  try {
    assertCaptureRespectsGrants(capture, grantStateCache, siteDomain);
  } catch (err) {
    console.warn('[metaMe Companion] capture refused:', err && err.message ? err.message : err);
    setCaptureBadge('✗', '#dc2626');
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }

  const fresh = await ensureFreshToken();
  if (!fresh.ok) {
    console.warn('[metaMe Companion] capture failed -- no auth session:', fresh.reason);
    setCaptureBadge('✗', '#dc2626');
    return { ok: false, reason: fresh.reason };
  }

  const postCapture = (token) =>
    fetchWithTimeout(COMPANION_CAPTURE_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(capture),
      cache: 'no-store',
    });

  try {
    let res = await postCapture(fresh.session.accessToken);

    if (res.status === 401 && fresh.session.refreshToken) {
      const forced = await ensureFreshToken({ force: true });
      if (!forced.ok) {
        setCaptureBadge('✗', '#dc2626');
        return { ok: false, reason: forced.reason };
      }
      res = await postCapture(forced.session.accessToken);
    }

    if (!res.ok) {
      console.warn('[metaMe Companion] capture rejected by server:', res.status);
      setCaptureBadge('✗', '#dc2626');
      return { ok: false, reason: `http-${res.status}` };
    }

    setCaptureBadge('✓', '#16a34a');
    return { ok: true };
  } catch (err) {
    console.warn('[metaMe Companion] capture network error:', err);
    setCaptureBadge('✗', '#dc2626');
    return { ok: false, reason: String(err) };
  }
}

const PULL_ACROSS_MENU_ID = 'metame-pull-across';

// Registered on install/update only (not on every worker wake) -- avoids
// "duplicate id" errors chrome.contextMenus.create throws if called more
// than once for the same id within a worker's lifetime.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: PULL_ACROSS_MENU_ID,
    title: 'Pull Across → metaMe',
    contexts: ['page', 'selection', 'image'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== PULL_ACROSS_MENU_ID) return;
  void performCapture(info, tab);
});

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
      // PRD-MMC-IMPL-002 Increment 2, Step 1: forward the locally-checked
      // observation to the real Companion API. The server independently
      // re-validates consent against its OWN stored grant state (defense in
      // depth) — this local check is not the only gate. Async: the content
      // script gets its "ok: true" ack immediately from the local check
      // above; the forward happens best-effort in the background and its
      // own failure is logged, never surfaced as a rejection of the local
      // consent decision.
      forwardObservationToServer(message.observation).then((result) => {
        if (!result.ok) {
          console.warn('[metaMe Companion] observation forward failed:', result.reason);
        }
      });
      sendResponse({ ok: true });
      return false;
    }

    case 'CONNECT_METAME': {
      connectToMetaMe().then(sendResponse);
      return true; // async response
    }

    case 'GET_CONNECTION_STATUS': {
      // Popup-load check — reuses ensureFreshToken (not a new auth path) so
      // a session persisted in chrome.storage.local from an earlier connect
      // is reflected as "Connected" immediately, and proactively refreshed
      // if it's expiring soon, instead of the popup always defaulting to
      // "Not connected" until the operator clicks Connect again.
      ensureFreshToken().then((result) => sendResponse({ connected: result.ok, reason: result.ok ? undefined : result.reason }));
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
