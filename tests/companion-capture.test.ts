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
    expect(source).toMatch(/import\s*\{\s*createIntentQube\s*\}\s*from\s*'@\/services\/iqube\/intentQube'/);
    expect(source).toMatch(/import\s*\{\s*createVentureQube\s*\}\s*from\s*'@\/services\/venture\/ventureQubeService'/);
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
    expect(source).not.toContain('authedFetchHeaders');
  });

  it('never renders personaIdHint as a JSX text node', () => {
    // The prop is only ever passed through to personaFetch calls -- it
    // should never appear directly between JSX tags as visible text.
    expect(source).not.toMatch(/>\s*\{personaIdHint\}\s*</);
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

  it('background.js runs the client-side consent pre-check before any POST', () => {
    const fnBody = background.slice(background.indexOf('async function performCapture'));
    const gateIdx = fnBody.indexOf('assertCaptureRespectsGrants(');
    const postIdx = fnBody.indexOf('postCapture(fresh.session.accessToken)');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(gateIdx);
  });
});
