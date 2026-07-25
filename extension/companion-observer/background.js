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
// The ACTIVE persona id, extracted from the page's own localStorage at the
// same moment as the auth session (extractSupabaseSessionFromPage). Without
// this, every server call this worker makes carries a valid Bearer token but
// no persona hint at all, and getActivePersona's resolver falls through to
// its step-4 fallback ("first owned persona, sorted") -- silently the WRONG
// persona for any account with more than one (2026-07-24, operator-reported:
// grants showed "Shared" in the Companion panel for the active persona, but
// this worker's own refreshed cache stayed permanently empty for every
// capability -- traced to exactly this missing hint).
const STORAGE_KEY_ACTIVE_PERSONA_ID = 'metamePersonaId';
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

function persistActivePersonaId(personaId) {
  return chrome.storage.local.set({ [STORAGE_KEY_ACTIVE_PERSONA_ID]: personaId });
}

async function getStoredPersonaId() {
  const { [STORAGE_KEY_ACTIVE_PERSONA_ID]: personaId } = await chrome.storage.local.get([
    STORAGE_KEY_ACTIVE_PERSONA_ID,
  ]);
  return personaId || null;
}

/**
 * Mirrors `personaFetch`'s own `x-persona-id` attach (`utils/personaSpine.tsx`)
 * — the same header, the same convention `getActivePersona`'s resolver
 * already honours (priority 2, "existing platform convention"). Every
 * server-bound call this worker makes must go through this, or it silently
 * resolves against the wrong persona for any multi-persona account.
 *
 * ALSO stamps the CompanionSurfaceKind this call originated from
 * (`x-companion-surface`, SPEC-MMC-003 §3.6 — runtime registration). Purely
 * additive: a server that does not read the header behaves exactly as it did
 * before this argument existed, and every caller passes an explicit surface
 * so the value is never guessed from context.
 */
async function withCompanionHeaders(headers, surface) {
  const personaId = await getStoredPersonaId();
  if (personaId) headers['x-persona-id'] = personaId;
  if (surface) headers[COMPANION_SURFACE_HEADER] = surface;
  return headers;
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

  const postObservation = async (token) =>
    fetchWithTimeout(`${COMPANION_OBSERVER_API_BASE}/observation`, {
      method: 'POST',
      // extension-overlay: an observation always originates in the page the
      // content script runs in, and is what the Constitutional Overlay reads
      // — never the side panel's own chrome (SPEC-MMC-003 §3.6).
      headers: await withCompanionHeaders(
        { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        COMPANION_SURFACE_OVERLAY,
      ),
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
async function refreshGrantsFromServer(surface = COMPANION_SURFACE_SIDEBAR) {
  const fresh = await ensureFreshToken();
  if (!fresh.ok) return { ok: false, reason: fresh.reason };

  const callGrants = async (token) =>
    fetchWithTimeout(`${COMPANION_OBSERVER_API_BASE}/grants`, {
      // Surface defaults to the side panel (the popup's Connect/Verify paths
      // are its only unparameterised callers); the content script's
      // REFRESH_GRANTS relay and the context-menu capture both pass
      // extension-overlay explicitly (SPEC-MMC-003 §3.6).
      headers: await withCompanionHeaders({ Authorization: `Bearer ${token}` }, surface),
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
 *  the refresh_token is what makes proactive refresh possible at all.
 *
 *  ALSO extracts the ACTIVE persona id, mirroring personaFetch's own
 *  fallback (utils/personaSpine.tsx: `localStorage.getItem('currentPersonaId')
 *  || sessionStorage.getItem('currentPersonaId')`). Without this, every
 *  future call this worker makes carries a valid token but no persona hint,
 *  and getActivePersona silently resolves to "first owned persona" server-
 *  side instead of the one actually active in this tab. */
function extractSupabaseSessionFromPage() {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    const session = parsed?.currentSession ?? parsed;
    if (!session?.access_token) return null;
    const personaId =
      localStorage.getItem('currentPersonaId') || sessionStorage.getItem('currentPersonaId') || null;
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token ?? null,
      expiresAt: typeof session.expires_at === 'number' ? session.expires_at : null,
      personaId,
    };
  } catch {
    return null;
  }
}

/**
 * Runs INSIDE the active tab (same serialized-injection pattern as
 * `extractSupabaseSessionFromPage`, so it cannot close over anything here).
 *
 * DELIBERATELY TOKEN-FREE: this is the pre-Connect probe that answers only
 * "is someone signed in here, and which persona is active?" — it returns a
 * boolean for the session and the persona id, never the access/refresh
 * tokens themselves. The popup renders this result, so nothing that reaches
 * the popup should be a bearer credential. The token-bearing extraction
 * stays in `extractSupabaseSessionFromPage`, called only by the Connect path
 * whose result never leaves the service worker.
 */
function extractPersonaHintFromPage() {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  let hasAuthSession = false;
  if (key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      const session = parsed?.currentSession ?? parsed;
      hasAuthSession = Boolean(session?.access_token);
    } catch {
      hasAuthSession = false;
    }
  }
  const personaId =
    localStorage.getItem('currentPersonaId') || sessionStorage.getItem('currentPersonaId') || null;
  return { hasAuthSession, personaId };
}

/**
 * Guard for BOTH the probe and the Connect extraction: only ever inject into
 * a tab that is actually on the Companion app's own origin.
 *
 * Without this, `chrome.scripting.executeScript` (which `activeTab` permits
 * against WHATEVER tab happens to be active) would run the localStorage scan
 * on an unrelated site — scanning that site's storage for any key containing
 * "auth-token" and, on a hit, persisting a foreign site's bearer token as
 * this extension's metaMe session. Found and fixed 2026-07-25 while building
 * SPEC-MMC-003 §3.3's pairing gate; the origin check is the fix.
 *
 * UPDATE (2026-07-25, same day): `manifest.json`'s `host_permissions`
 * WIDENED from a single `dev-beta.aigentz.me` entry to all-http/https
 * wildcards (matching `content_scripts.matches`), so that
 * `healObserverInOpenTabs` below can re-inject the observer into ALREADY-OPEN
 * tabs on ANY site, not just the Companion app's own origin (a real bug: the
 * heal silently failed on every non-dev-beta tab, permission-denied and
 * swallowed by that function's own catch block — the operator's Gmail/
 * claude.ai tabs never healed after a reload). THIS FUNCTION is now the
 * ONLY thing standing between that broader permission grant and the
 * auth-extraction code below running against an arbitrary site — there is
 * no longer an incidental narrow-host_permissions backstop. Do not weaken
 * or bypass it.
 */
function isCompanionAppUrl(url) {
  return typeof url === 'string' && url.startsWith(`${COMPANION_APP_ORIGIN}/`);
}

/**
 * Resolve the active tab, refusing anything that is not the Companion app's
 * own origin. Shared by the probe and the Connect extraction so there is one
 * origin rule, not two.
 */
async function getCompanionAppTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return { ok: false, reason: 'no-active-tab' };
  if (!isCompanionAppUrl(activeTab.url)) return { ok: false, reason: 'active-tab-not-metame' };
  return { ok: true, tab: activeTab };
}

/**
 * SPEC-MMC-003 §3.3 — the persona confirmation that must happen BEFORE
 * "Connect" is available at all.
 *
 * §0.4 records the real 2026-07-24 incident this closes: pairing could
 * complete with a valid bearer token but NO persona hint, after which every
 * server call resolved through `getActivePersona`'s step-4 fallback ("first
 * owned persona, sorted") — silently the wrong persona for any account with
 * more than one. The shipped code surfaced that only AFTER the fact, as a
 * `personaFound: false` warning string. This probe moves the check ahead of
 * the action: the popup shows which persona is about to be paired and only
 * then enables Connect, so the ambiguous case cannot be paired past by
 * construction rather than warned about afterwards.
 */
async function probeActivePersona() {
  const tabResult = await getCompanionAppTab();
  if (!tabResult.ok) return { ok: false, reason: tabResult.reason };

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tabResult.tab.id },
      func: extractPersonaHintFromPage,
    });
  } catch (err) {
    return { ok: false, reason: `executeScript-failed: ${String(err)}` };
  }

  const hint = results?.[0]?.result;
  if (!hint) return { ok: false, reason: 'probe-returned-nothing' };
  if (!hint.hasAuthSession) return { ok: false, reason: 'not-signed-in' };
  if (!hint.personaId) return { ok: false, reason: 'no-active-persona' };

  return { ok: true, personaId: hint.personaId };
}

/**
 * Pairing. STRICT as of SPEC-MMC-003 §3.3: the caller MUST pass the
 * `confirmedPersonaId` the operator was actually shown by `probeActivePersona`
 * (see the popup's confirm step). Three refusals, all fail-closed, replacing
 * the previous "pair anyway, warn afterwards" behaviour:
 *
 *   - `persona-confirmation-required` — no confirmed persona was supplied at
 *     all (a caller that skipped the confirm step).
 *   - `no-active-persona` — the page no longer reports an active persona.
 *   - `persona-changed-since-confirmation` — the operator switched persona
 *     between confirming and clicking Connect; pairing to the NEW one would
 *     be pairing to a persona they never confirmed, so refuse and re-probe.
 *
 * Nothing is persisted on any refusal — no half-paired state, no session
 * stored without its matching persona hint.
 */
async function connectToMetaMe(confirmedPersonaId) {
  if (!confirmedPersonaId) return { ok: false, reason: 'persona-confirmation-required' };

  // Requires the connect action to be a user gesture (popup button click)
  // with the metaMe tab active. NOTE (2026-07-25): `host_permissions` is now
  // broad (`http://*/*` + `https://*/*`, widened so the observer-healing
  // sweep can reach already-open tabs anywhere), so this path NO LONGER
  // relies on a narrow host grant to keep it off other origins — the origin
  // check inside `getCompanionAppTab` is the ONLY thing refusing to run the
  // auth-material scan against a non-Companion tab. Keep it.
  const tabResult = await getCompanionAppTab();
  if (!tabResult.ok) return { ok: false, reason: tabResult.reason };

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tabResult.tab.id },
      func: extractSupabaseSessionFromPage,
    });
  } catch (err) {
    return { ok: false, reason: `executeScript-failed: ${String(err)}` };
  }

  const session = results?.[0]?.result;
  if (!session?.accessToken) return { ok: false, reason: 'no-token-found-in-page' };
  if (!session.personaId) return { ok: false, reason: 'no-active-persona' };
  if (session.personaId !== confirmedPersonaId) {
    return { ok: false, reason: 'persona-changed-since-confirmation' };
  }

  await persistAuthSession(session);
  // Persist the ACTIVE persona id extracted at the same time — without
  // this, every subsequent server call this worker makes resolves through
  // getActivePersona's "first owned persona" fallback instead of the one
  // actually active in the tab (see extractSupabaseSessionFromPage's own
  // comment for the full explanation). Guaranteed non-null by the checks
  // above: pairing now either has the confirmed persona or does not happen.
  await persistActivePersonaId(session.personaId);
  const refreshResult = await refreshGrantsFromServer(COMPANION_SURFACE_SIDEBAR);
  return { ok: true, refreshed: refreshResult, personaId: session.personaId };
}

/**
 * SPEC-MMC-003 §3.7 — post-install verification as ONE honest tri-state
 * check instead of three independently-worded status strings the operator
 * had to piece together (a valid session, a grants fetch that succeeded, and
 * a persona that was actually found were all reported separately, at
 * different moments, in different places).
 *
 * Runs the three EXISTING signals in sequence — no new check is invented,
 * and no new server route is called:
 *   1. `ensureFreshToken()`      — is there a valid, non-expired session?
 *   2. `getStoredPersonaId()`    — did pairing capture an active persona?
 *   3. `refreshGrantsFromServer()` — does the server actually answer this
 *      session (the only check that proves the pairing works end-to-end)?
 *
 * Returns exactly one of three states, with the SPECIFIC failing check named
 * rather than a generic error:
 *   'connected'     — all three passed.
 *   'attention'     — session valid, but persona or grants failed.
 *   'not-connected' — no session at all.
 */
async function verifyCompanion() {
  const fresh = await ensureFreshToken();
  if (!fresh.ok) {
    return {
      state: 'not-connected',
      checks: { session: false, persona: false, grants: false },
      failing: 'session',
      reason: fresh.reason,
    };
  }

  const personaId = await getStoredPersonaId();
  const grants = await refreshGrantsFromServer(COMPANION_SURFACE_SIDEBAR);

  const checks = { session: true, persona: Boolean(personaId), grants: Boolean(grants.ok) };
  if (checks.persona && checks.grants) {
    return { state: 'connected', checks };
  }
  return {
    state: 'attention',
    checks,
    failing: !checks.persona ? 'persona' : 'grants',
    reason: !checks.persona ? 'no-active-persona-stored' : grants.reason,
  };
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
  await refreshGrantsFromServer(COMPANION_SURFACE_OVERLAY);

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

  const postCapture = async (token) =>
    fetchWithTimeout(COMPANION_CAPTURE_API_URL, {
      method: 'POST',
      // extension-overlay: "Pull Across" fires from the page's own context
      // menu, not the extension's side panel (SPEC-MMC-003 §3.6).
      headers: await withCompanionHeaders(
        { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        COMPANION_SURFACE_OVERLAY,
      ),
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

// ─── Content-script healing for already-open tabs ──────────────────────────
//
// THE BUG THIS FIXES (operator-reported 2026-07-25, "the overlay is a bit
// intermittent and the refresh button does not seem to work"):
//
// Manifest V3 does NOT inject `content_scripts` into tabs that were already
// open when the extension is installed, updated, or reloaded — injection
// happens on navigation only. So after every `chrome://extensions` reload,
// EVERY open tab silently loses its observer: no content script means no
// page-load observation AND no `visibilitychange` re-observation
// (content.js). Switching to such a tab writes nothing, so
// `/api/companion/overlay` keeps serving whichever tab DID still have a live
// content script — the operator saw "venice.ai" in the Overlay while looking
// at github.com, and Refresh (which only re-reads that same stored row)
// correctly showed no change. Reloading the page fixed it, which is exactly
// the signature of this class of bug.
//
// The fix is the standard MV3 remedy: on install/update/startup, inject the
// SAME files the manifest already declares into the tabs that missed it.
//
// NOT A PRIVILEGE EXPANSION RELATIVE TO WHAT'S ALREADY DECLARED.
// `manifest.json` already declares these two files as `content_scripts`
// matching `http://*/*` + `https://*/*`, so this injects exactly what Chrome
// would have injected on the next navigation — only sooner.
//
// SAME-DAY FOLLOW-UP FIX (2026-07-25): the healing loop below initially
// still failed silently on every non-`dev-beta.aigentz.me` tab (Gmail,
// claude.ai, ...) because `chrome.scripting.executeScript` -- unlike
// declarative `content_scripts` injection -- separately requires the
// TARGET tab's origin to be covered by `host_permissions`, which at the
// time only listed the Companion app's own origin (needed for the UNRELATED
// auth-extraction guard below). The operator hit this directly: a claude.ai
// tab open across an extension reload never healed, and Refresh correctly
// kept showing the same stale stored observation. Fixed by widening
// `manifest.json`'s `host_permissions` to match `content_scripts.matches`
// exactly -- the content script was already declared to run everywhere;
// this just lets the RE-injection path reach everywhere it already runs.
//
// This is deliberately UNRELATED to `isCompanionAppUrl` /
// `getCompanionAppTab`, which guard a different act: reading auth material
// OUT of a page (see that guard's own note). Reading nothing and injecting
// the declared observer is not that act, and conflating the two would break
// the observer on every non-metaMe page, which is most of them.
const HEALED_CONTENT_SCRIPT_FILES = ['constants.js', 'content.js'];

/** http(s) only — `chrome://`, `about:`, the Web Store, and other privileged
 *  origins reject injection, and the manifest never matched them anyway. */
function isInjectableUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * Best-effort, never-throws. A tab that refuses injection (privileged origin,
 * closed mid-flight, or a page that already HAS the script) is skipped
 * silently — one uninjectable tab must not stop the rest from healing.
 */
async function healObserverInOpenTabs(trigger) {
  let tabs;
  try {
    tabs = await chrome.tabs.query({});
  } catch (err) {
    console.warn('[metaMe Companion] tab query failed while healing observer:', err);
    return;
  }

  let healed = 0;
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !isInjectableUrl(tab.url)) return;
      try {
        // Skip tabs that already have a live observer (see content.js's
        // marker). Both this probe and the content script run in the same
        // ISOLATED world, so the flag is visible here.
        const [probe] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => Boolean(window.__metameObserverLoaded),
        });
        if (probe?.result) return;

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: HEALED_CONTENT_SCRIPT_FILES,
        });
        healed += 1;
      } catch {
        // Expected for privileged origins and races — not an error.
      }
    }),
  );
  console.log(`[metaMe Companion] observer healed in ${healed} open tab(s) (${trigger})`);

  // DETERMINISTIC LAST WORD. Content scripts only observe when their tab is
  // visible (content.js), so the heal above can no longer let a background
  // tab overwrite the current one. But "which tab wrote last" should not
  // depend on injection ORDER at all: after the sweep, explicitly ask the
  // genuinely-active tab to re-observe, so the stored observation ends up
  // describing the tab the operator is actually looking at, every time.
  //
  // Best-effort and last: a failure here (no active tab, privileged origin,
  // no content script) leaves whatever the visible tab already wrote, which
  // is still correct — this only removes the dependence on timing.
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && isInjectableUrl(activeTab.url)) {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'RE_OBSERVE' });
    }
  } catch {
    // No receiver / privileged origin / tab closed — nothing to correct.
  }
}

chrome.runtime.onInstalled.addListener(() => void healObserverInOpenTabs('install/update'));
chrome.runtime.onStartup.addListener(() => void healObserverInOpenTabs('browser-startup'));

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

    case 'PROBE_ACTIVE_PERSONA': {
      // SPEC-MMC-003 §3.3 — the persona confirmation step that gates
      // CONNECT_METAME below. Returns a persona id only (no tokens).
      probeActivePersona().then(sendResponse);
      return true; // async response
    }

    case 'CONNECT_METAME': {
      // `confirmedPersonaId` is REQUIRED — connectToMetaMe refuses without
      // it, so a caller that skips PROBE_ACTIVE_PERSONA cannot pair.
      connectToMetaMe(message.confirmedPersonaId).then(sendResponse);
      return true; // async response
    }

    case 'VERIFY_COMPANION': {
      // SPEC-MMC-003 §3.7 — the single tri-state check. Replaces the former
      // GET_CONNECTION_STATUS handler (session-only, which reported
      // "Connected." for a session that could not actually reach the server
      // and had no persona hint); the popup is its only consumer, so there
      // is one status path here, not two.
      verifyCompanion().then(sendResponse);
      return true; // async response
    }

    case 'REFRESH_GRANTS': {
      // Relayed by content.js from the page context — tag it as the overlay
      // surface, not the side panel (SPEC-MMC-003 §3.6).
      refreshGrantsFromServer(COMPANION_SURFACE_OVERLAY).then(sendResponse);
      return true; // async response
    }

    default:
      return false;
  }
});
