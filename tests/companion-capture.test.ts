/**
 * metaMe Companion — Capture canary (PRD-MMC-IMPL-003 Increments 1-2).
 *
 * Mirrors `tests/companion-observer.test.ts`'s exact shape and rigor. Locks
 * the contracts Increments 1-2 exist to keep:
 *
 *  1. TIER LAW — `types/companionCapture.ts` (a browser-serialisable module)
 *     declares NO forbidden T0 field.
 *
 *  2. SOURCE_KIND_TO_CAPABILITY parity canary — exactly the 4
 *     `CaptureSourceKind` values, each mapped to a real `ObserverCapability`.
 *
 *  3. CONSENT GATE — `assertCaptureRespectsGrants` throws when the mapped
 *     capability is not granted (per source kind) and passes when it is,
 *     including site-scope isolation for the two site-scoped capabilities.
 *
 *  4. API ROUTES (Increment 2) fail CLOSED on a null `getActivePersona` —
 *     401, no Supabase read/write attempted.
 *
 *  5. ASSIGN ROUTE COMPOSITION — the assign route imports the REAL
 *     `createIntentQube`/`createVentureQube` constructors by name (a
 *     structural canary that fails loudly if a future edit swaps in a
 *     parallel insert instead, `inv.engineering.037` style), and only
 *     supports `'intent'`/`'venture'` destinations.
 *
 * Increments 3-4 (Workspace inbox UI, extension) are not built yet — their
 * canaries land with those increments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CAPTURE_SOURCE_KINDS,
  SOURCE_KIND_TO_CAPABILITY,
  CAPTURED_CONTENT_MAX_CHARS,
} from '@/types/companionCapture';
import { OBSERVER_CAPABILITIES, emptyObserverGrantState } from '@/types/companionObserver';
import { grantCapability } from '@/services/companion/observerConsent';
import { assertCaptureRespectsGrants } from '@/services/companion/captureConsent';

// ─── 1. Contract source declares no T0 field ────────────────────────────────

describe('types/companionCapture.ts — no T0 field declarations', () => {
  const source = readFileSync(join(process.cwd(), 'types', 'companionCapture.ts'), 'utf8');

  for (const field of ['personaId', 'authProfileId', 'rootDid', 'kybeAttestation', 'fioHandle']) {
    it(`does not declare a "${field}" property`, () => {
      const decl = new RegExp(`^\\s*(readonly\\s+)?${field}\\??\\s*:`, 'm');
      expect(decl.test(source)).toBe(false);
    });
  }
});

// ─── 2. SOURCE_KIND_TO_CAPABILITY parity canary ─────────────────────────────

describe('CAPTURE_SOURCE_KINDS / SOURCE_KIND_TO_CAPABILITY — parity canary', () => {
  it('has exactly the 4 source kinds this pass supports', () => {
    expect(CAPTURE_SOURCE_KINDS).toHaveLength(4);
    expect([...CAPTURE_SOURCE_KINDS]).toEqual(['webpage', 'selection', 'pdf', 'image']);
  });

  it('every source kind maps to a real ObserverCapability', () => {
    for (const kind of CAPTURE_SOURCE_KINDS) {
      expect(OBSERVER_CAPABILITIES).toContain(SOURCE_KIND_TO_CAPABILITY[kind]);
    }
  });

  it('has no mapping entries outside CAPTURE_SOURCE_KINDS', () => {
    expect(new Set(Object.keys(SOURCE_KIND_TO_CAPABILITY))).toEqual(new Set(CAPTURE_SOURCE_KINDS));
  });

  it('pdf maps to the previously-unused downloads capability (PRD-MMC-IMPL-003 §0.4)', () => {
    expect(SOURCE_KIND_TO_CAPABILITY.pdf).toBe('downloads');
  });

  it('content ceiling is larger than the Observer excerpt cap but still bounded', () => {
    expect(CAPTURED_CONTENT_MAX_CHARS).toBeGreaterThan(2000);
    expect(CAPTURED_CONTENT_MAX_CHARS).toBeLessThan(1_000_000);
  });
});

// ─── 3. assertCaptureRespectsGrants — the consent-enforcement choke point ──

describe('assertCaptureRespectsGrants', () => {
  it('throws for every source kind when nothing is granted', () => {
    const state = emptyObserverGrantState();
    for (const sourceKind of CAPTURE_SOURCE_KINDS) {
      expect(() => assertCaptureRespectsGrants({ sourceKind }, state)).toThrow();
    }
  });

  it('passes for every source kind once its mapped capability is granted', () => {
    let state = emptyObserverGrantState();
    for (const kind of CAPTURE_SOURCE_KINDS) {
      state = grantCapability(state, SOURCE_KIND_TO_CAPABILITY[kind], 'global');
    }
    for (const sourceKind of CAPTURE_SOURCE_KINDS) {
      expect(() => assertCaptureRespectsGrants({ sourceKind }, state)).not.toThrow();
    }
  });

  it('does not conflate two source kinds mapped to different capabilities', () => {
    // Only 'selection' granted -- 'webpage'/'image' (page-document) and
    // 'pdf' (downloads) must still throw.
    const state = grantCapability(emptyObserverGrantState(), 'selection', 'global');
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'selection' }, state)).not.toThrow();
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'webpage' }, state)).toThrow();
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'image' }, state)).toThrow();
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'pdf' }, state)).toThrow();
  });

  it('respects site-scoped grants for webpage/image (page-document) against the capture\'s own site', () => {
    const state = grantCapability(emptyObserverGrantState(), 'page-document', 'site', 'granted.com');
    expect(() =>
      assertCaptureRespectsGrants({ sourceKind: 'webpage' }, state, 'granted.com'),
    ).not.toThrow();
    expect(() =>
      assertCaptureRespectsGrants({ sourceKind: 'webpage' }, state, 'other.com'),
    ).toThrow();
  });
});

// ─── 4. API routes — fail closed, no T0 in response body (Increment 2) ─────

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: vi.fn(),
}));
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: vi.fn(),
}));

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const mockedGetActivePersona = getActivePersona as unknown as ReturnType<typeof vi.fn>;
const mockedGetSupabaseServer = getSupabaseServer as unknown as ReturnType<typeof vi.fn>;

const FORBIDDEN_T0_FIELDS = ['personaId', 'authProfileId', 'rootDid', 'kybeAttestation'] as const;

function collectKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as import('next/server').NextRequest;
}

describe('GET/POST /api/companion/capture — fail closed', () => {
  beforeEach(() => {
    mockedGetActivePersona.mockReset();
    mockedGetSupabaseServer.mockReset();
  });

  it('GET returns 401 with no Supabase call attempted when getActivePersona resolves null', async () => {
    mockedGetActivePersona.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/companion/capture/route');

    const res = await GET(makeRequest('http://localhost:3000/api/companion/capture'));
    expect(res.status).toBe(401);
    expect(mockedGetSupabaseServer).not.toHaveBeenCalled();

    const body = await res.json();
    const keys = collectKeys(body);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it('POST returns 401 with no Supabase call attempted when getActivePersona resolves null', async () => {
    mockedGetActivePersona.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/companion/capture/route');

    const res = await POST(
      makeRequest('http://localhost:3000/api/companion/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKind: 'webpage', contentText: 'hello', capturedAt: '2026-07-23T00:00:00Z' }),
      }),
    );
    expect(res.status).toBe(401);
    expect(mockedGetSupabaseServer).not.toHaveBeenCalled();

    const body = await res.json();
    const keys = collectKeys(body);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
});

describe('POST /api/companion/capture/[captureId]/assign — fail closed + composition canary', () => {
  beforeEach(() => {
    mockedGetActivePersona.mockReset();
    mockedGetSupabaseServer.mockReset();
  });

  it('returns 401 with no Supabase call attempted when getActivePersona resolves null', async () => {
    mockedGetActivePersona.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/companion/capture/[captureId]/assign/route');

    const res = await POST(
      makeRequest('http://localhost:3000/api/companion/capture/abc/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: 'intent' }),
      }),
      { params: Promise.resolve({ captureId: 'abc' }) },
    );
    expect(res.status).toBe(401);
    expect(mockedGetSupabaseServer).not.toHaveBeenCalled();
  });

  it('imports the REAL createIntentQube/createVentureQube constructors (never a parallel insert)', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'api', 'companion', 'capture', '[captureId]', 'assign', 'route.ts'),
      'utf8',
    );
    // Tolerant of ADDITIONAL named imports from the same module (the route
    // also pulls in `getIntentQube`/`getVentureQube`) — what this canary
    // locks is that the constructor comes from the REAL service module, not
    // that it is the only symbol imported from it. The stricter
    // exactly-one-symbol form failed the moment a sibling getter was added,
    // which is drift in the assertion, not in the route (2026-07-25).
    expect(source).toMatch(/import\s*\{[^}]*\bcreateIntentQube\b[^}]*\}\s*from\s*'@\/services\/iqube\/intentQube'/);
    expect(source).toMatch(/import\s*\{[^}]*\bcreateVentureQube\b[^}]*\}\s*from\s*'@\/services\/venture\/ventureQubeService'/);
  });

  it('only supports intent/venture destinations — everything else is a named 400, never a silent no-op', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'api', 'companion', 'capture', '[captureId]', 'assign', 'route.ts'),
      'utf8',
    );
    expect(source).toContain("SUPPORTED_DESTINATIONS: CaptureAssignDestination[] = ['intent', 'venture']");
    expect(source).toContain('destination-not-yet-supported');
  });
});

// ─── 5. CaptureInboxPanel — client-side spine discipline (Increment 3) ─────

describe('CaptureInboxPanel.tsx — personaFetch-only discipline', () => {
  const source = readFileSync(
    join(process.cwd(), 'components', 'companion', 'CaptureInboxPanel.tsx'),
    'utf8',
  );

  it('uses personaFetch, never raw fetch or authedFetchHeaders', () => {
    expect(source).toContain('personaFetch(');
    expect(source).not.toMatch(/[^A-Za-z]fetch\(/);
    // A CALL to authedFetchHeaders, not a mention of it: the file's own
    // header comment states the rule ("never `authedFetchHeaders`"), and a
    // bare substring check flagged that comment as the violation it
    // describes (2026-07-25). The forbidden thing is the invocation.
    expect(source).not.toMatch(/authedFetchHeaders\s*\(/);
  });

  it('never renders personaIdHint as a JSX text node', () => {
    // The prop is only ever passed through to personaFetch calls -- it
    // should never appear directly between JSX tags as visible text.
    expect(source).not.toMatch(/>\s*\{personaIdHint\}\s*</);
  });
});

// ─── 5b. Companion embed page — Workspace (the fifth extension surface) ───
//
// Operator correction, 2026-07-24: the Constitutional Flow's Capture UI
// belongs INSIDE the extension itself (the companion embed page BOTH the
// docked side panel and the popup window load), not only in the full app's
// myCluster nav. This pins that the embed page mounts the SAME
// CaptureInboxPanel as a fifth "Workspace" segmented-control surface,
// alongside Wallet/Companion/Search/Overlay. Named "Workspace" (not
// "Workbench" -- an initial mis-naming, corrected same day) to match
// SPEC-MMC-001's own terminology throughout.

describe('Companion embed page (/triad/embed/companion) — Workspace surface', () => {
  const source = readFileSync(
    join(process.cwd(), 'app', '(embed)', 'triad', 'embed', 'companion', 'page.tsx'),
    'utf8',
  );

  it('imports and mounts CaptureInboxPanel', () => {
    expect(source).toContain('import { CaptureInboxPanel }');
    expect(source).toContain('<CaptureInboxPanel personaIdHint={personaId} />');
  });

  /**
   * NAMING CONFLICT — RESOLVED BACK TO **Workspace** (operator, D-10,
   * 2026-07-26), and the history is kept because it explains why this
   * prohibition is worth having.
   *
   *  • PRD-MMC-IMPL-003 (2026-07-24) named this surface **Workspace**, a
   *    same-day correction away from an invented label, and this file
   *    asserted `.not.toContain('workbench')` to stop it returning.
   *  • SCOPE-MMC-004 §4.3's first draft said **Workbench**, and it shipped
   *    that way for exactly one commit.
   *  • The operator ruled **Workspace**. The prohibition is therefore
   *    REINSTATED, not retired — the label drifted twice now, which is the
   *    case for keeping a canary rather than trusting review.
   */
  it('never reintroduces the "workbench" mis-naming', () => {
    expect(source.toLowerCase()).not.toContain('workbench');
  });

  it('exposes the capture surface through the ratified nav vocabulary', () => {
    expect(source).toContain('COMPANION_NAV_ITEMS');
    // Structure, not a hand-copied union: the surface set derives from
    // services/companion/companionNavigation.ts (inv.engineering.036).
    expect(source).not.toMatch(/useState<"wallet" \| "companion"/);
  });

  it('gates the capture mount on resolved identity, same as Search/Overlay', () => {
    const idx = source.indexOf('activeSurface === "workspace" ? (');
    expect(idx).toBeGreaterThan(-1);
    const section = source.slice(idx, idx + 1400);
    expect(section).toContain('identity && personaId');
    expect(section).toContain('<CaptureInboxPanel personaIdHint={personaId} />');
  });
});

// ─── 6. Extension — structural canary (Increment 4) ────────────────────────
//
// extension/companion-observer/*.js is plain JS run in a service-worker/
// content-script context (chrome.*, importScripts()) that vitest cannot
// execute -- same constraint PRD-MMC-IMPL-001 §7 already documented. These
// are structural regression checks only; the actual behavioral verification
// (a real Manifest V3 extension loaded into a live Chromium under xvfb,
// exercising the consent gate + POST body shape + PDF/image branches) is
// recorded in PRD-MMC-IMPL-003 §2 Increment 4, mirroring PRD-MMC-IMPL-001
// §7.1's own "verified for real, not asserted" acceptance record.

describe('extension/companion-observer — Capture structural canary', () => {
  const manifest = readFileSync(join(process.cwd(), 'extension', 'companion-observer', 'manifest.json'), 'utf8');
  const constants = readFileSync(join(process.cwd(), 'extension', 'companion-observer', 'constants.js'), 'utf8');
  const consentExt = readFileSync(join(process.cwd(), 'extension', 'companion-observer', 'observerConsentExt.js'), 'utf8');
  const background = readFileSync(join(process.cwd(), 'extension', 'companion-observer', 'background.js'), 'utf8');

  it('manifest declares the contextMenus permission', () => {
    expect(JSON.parse(manifest).permissions).toContain('contextMenus');
  });

  it('constants.js mirrors CAPTURE_SOURCE_KINDS/SOURCE_KIND_TO_CAPABILITY', () => {
    expect(constants).toContain("const CAPTURE_SOURCE_KINDS = ['webpage', 'selection', 'pdf', 'image'];");
    expect(constants).toContain('pdf: \'downloads\'');
  });

  it('observerConsentExt.js mirrors assertCaptureRespectsGrants', () => {
    expect(consentExt).toContain('function assertCaptureRespectsGrants(capture, state, siteDomain)');
  });

  it('background.js registers the Pull Across context menu and wires onClicked to performCapture', () => {
    expect(background).toContain("chrome.contextMenus.create({");
    expect(background).toContain('id: PULL_ACROSS_MENU_ID');
    expect(background).toContain('chrome.contextMenus.onClicked.addListener');
    expect(background).toContain('void performCapture(info, tab)');
  });

  it('background.js PDF branch never extracts contentText client-side', () => {
    // buildCapture's pdf branch must return before any contentText
    // assignment -- the server derives it via pdfExtractionService.
    const pdfBranch = background.slice(background.indexOf('if (isPdfUrl(sourceUrl))'), background.indexOf('const pageText ='));
    expect(pdfBranch).not.toMatch(/contentText:/);
  });

  it('background.js refreshes grantStateCache from the server BEFORE the consent pre-check (2026-07-24 fix)', () => {
    // Reproduces, in performCapture, the exact fix content.js's
    // buildObservation() already carries for Observation/Overlay
    // (2026-07-23): grantStateCache is only populated at Connect time or on
    // an explicit REFRESH_GRANTS message, so a capability granted through
    // the Companion web panel is invisible to a stale local cache until
    // this refresh runs. Missing it here reproduced the exact same bug for
    // Capture (2026-07-24, operator-reported: every capability showed
    // "Shared" in the panel, capture still refused).
    const fnBody = background.slice(
      background.indexOf('async function performCapture'),
      background.indexOf('const PULL_ACROSS_MENU_ID'),
    );
    // `refreshGrantsFromServer(` (open paren, no closing) — the call now
    // carries an explicit CompanionSurfaceKind argument (SPEC-MMC-003 §3.6);
    // the ORDERING this canary exists to lock is unchanged.
    const refreshIdx = fnBody.indexOf('refreshGrantsFromServer(');
    const gateIdx = fnBody.indexOf('assertCaptureRespectsGrants(');
    expect(refreshIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(refreshIdx);
  });

  it('background.js attaches x-persona-id on every server-bound call (2026-07-24 persona-mismatch fix)', () => {
    // getActivePersona's resolver falls through to "first owned persona"
    // when no hint is supplied at all -- a Bearer token alone is not enough
    // for any account with more than one persona. Fixed by extracting the
    // active persona id alongside the auth session at Connect time and
    // attaching it via the shared header helper on every call this worker
    // makes (grants refresh, observation forward, capture POST). Renamed
    // withPersonaHeader -> withCompanionHeaders in the SPEC-MMC-003 §3.6
    // pass, which added the surface tag to the SAME helper rather than
    // introducing a second one — the persona guarantee below is unchanged.
    expect(background).toContain('function withCompanionHeaders(headers, surface)');
    expect(background).toContain("headers['x-persona-id'] = personaId");
    const headerHelperCallCount = (background.match(/await withCompanionHeaders\(/g) || []).length;
    expect(headerHelperCallCount).toBe(3); // callGrants, postObservation, postCapture
  });

  it('background.js stamps the CompanionSurfaceKind on every server-bound call (SPEC-MMC-003 §3.6)', () => {
    // Runtime registration: types/companion.ts already RESERVED
    // 'extension-sidebar'/'extension-overlay'; nothing stamped a call with
    // either, so the platform could not tell an extension-originated call
    // from a web-embed one. Additive by construction — the header rides the
    // same helper as x-persona-id and every call site passes an explicit
    // surface rather than letting one be inferred.
    expect(background).toContain('headers[COMPANION_SURFACE_HEADER] = surface');
    // In-page origins (content-script observation, "Pull Across" capture)
    // are the overlay surface, never the side panel.
    expect(background).toMatch(/const postObservation[\s\S]{0,700}COMPANION_SURFACE_OVERLAY/);
    expect(background).toMatch(/const postCapture[\s\S]{0,700}COMPANION_SURFACE_OVERLAY/);
  });

  it('background.js extracts personaId in the same in-page function as the auth session', () => {
    const fnBody = background.slice(
      background.indexOf('function extractSupabaseSessionFromPage'),
      background.indexOf('async function connectToMetaMe'),
    );
    expect(fnBody).toContain("localStorage.getItem('currentPersonaId')");
    expect(fnBody).toContain('personaId,');
  });

  it('connectToMetaMe persists the extracted persona id', () => {
    const fnBody = background.slice(
      background.indexOf('async function connectToMetaMe'),
      background.indexOf('async function verifyCompanion'),
    );
    // No longer `?? null`: pairing cannot complete without a persona at all
    // (see the confirmation-gate canary below), so the stored value is
    // always the confirmed persona, never a null placeholder.
    expect(fnBody).toContain('persistActivePersonaId(session.personaId)');
  });

  it('connectToMetaMe refuses to pair without a CONFIRMED persona (SPEC-MMC-003 §3.3)', () => {
    // The 2026-07-24 incident this closes by construction: pairing could
    // complete with a valid Bearer token and NO persona hint, after which
    // every server call resolved through getActivePersona's "first owned
    // persona, sorted" fallback — silently the wrong persona for any
    // multi-persona account. The old code warned about this AFTER storing
    // the session (`personaFound: false`); the gate below means there is
    // nothing to warn about, because nothing is stored.
    const fnBody = background.slice(
      background.indexOf('async function connectToMetaMe'),
      background.indexOf('async function verifyCompanion'),
    );
    expect(fnBody).toContain('async function connectToMetaMe(confirmedPersonaId)');
    expect(fnBody).toContain("return { ok: false, reason: 'persona-confirmation-required' }");
    expect(fnBody).toContain("return { ok: false, reason: 'no-active-persona' }");
    expect(fnBody).toContain("reason: 'persona-changed-since-confirmation'");
    // Every refusal must come BEFORE anything is persisted — no half-paired
    // state, ever.
    const persistIdx = fnBody.indexOf('persistAuthSession(session)');
    expect(persistIdx).toBeGreaterThan(fnBody.indexOf("'persona-changed-since-confirmation'"));
  });

  it('the extension only injects into the Companion app origin (2026-07-25 hardening)', () => {
    // chrome.scripting.executeScript under `activeTab` runs against WHATEVER
    // tab is active, independent of manifest host_permissions. Without an
    // origin check, clicking Connect on an unrelated site scanned THAT
    // site's localStorage for any key containing "auth-token" and, on a hit,
    // persisted a foreign bearer token as the metaMe session. Both injection
    // paths (the persona probe and the session extraction) must route
    // through the shared origin guard.
    expect(background).toContain('function isCompanionAppUrl(url)');
    expect(background).toContain('url.startsWith(`${COMPANION_APP_ORIGIN}/`)');
    expect(background).toContain("return { ok: false, reason: 'active-tab-not-metame' }");
    const guardCallCount = (background.match(/await getCompanionAppTab\(\)/g) || []).length;
    expect(guardCallCount).toBe(2); // probeActivePersona, connectToMetaMe
  });

  it('the popup gates Connect on an explicit persona confirmation (SPEC-MMC-003 §3.3)', () => {
    const popup = readFileSync(
      join(process.cwd(), 'extension', 'companion-observer', 'popup.js'),
      'utf8',
    );
    const popupHtml = readFileSync(
      join(process.cwd(), 'extension', 'companion-observer', 'popup.html'),
      'utf8',
    );
    // Disabled in the markup — the button is never clickable before the
    // probe answers, not merely re-disabled by script after first paint.
    expect(popupHtml).toContain('<button id="connectBtn" disabled>');
    expect(popup).toContain("type: 'PROBE_ACTIVE_PERSONA'");
    expect(popup).toContain("{ type: 'CONNECT_METAME', confirmedPersonaId }");
    // Only a persona the operator was SHOWN may be sent as confirmed.
    expect(popup).toContain('confirmedPersonaId = response.personaId');
    // The raw persona UUID is the owner's private root identifier — masked.
    expect(popup).toContain('function maskPersonaId(personaId)');
  });

  it('post-install verification is ONE tri-state check, not three strings (SPEC-MMC-003 §3.7)', () => {
    // The three signals already existed (ensureFreshToken / stored persona /
    // grants fetch) but were reported separately at different moments. This
    // locks them into a single handler with exactly three states, and locks
    // out the old session-only GET_CONNECTION_STATUS path that reported
    // "Connected." for a session that could not reach the server.
    expect(background).toContain('async function verifyCompanion()');
    expect(background).toContain("state: 'connected'");
    expect(background).toContain("state: 'attention'");
    expect(background).toContain("state: 'not-connected'");
    // No live handler for the old session-only status message — the only
    // remaining mention is the comment recording why it was replaced.
    expect(background).not.toContain("case 'GET_CONNECTION_STATUS'");
    const popup = readFileSync(
      join(process.cwd(), 'extension', 'companion-observer', 'popup.js'),
      'utf8',
    );
    expect(popup).toContain("type: 'VERIFY_COMPANION'");
    expect(popup).not.toContain('GET_CONNECTION_STATUS');
  });

  it('background.js runs the client-side consent pre-check before any POST', () => {
    const fnBody = background.slice(background.indexOf('async function performCapture'));
    const gateIdx = fnBody.indexOf('assertCaptureRespectsGrants(');
    const postIdx = fnBody.indexOf('postCapture(fresh.session.accessToken)');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(gateIdx);
  });
});
