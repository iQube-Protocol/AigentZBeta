/**
 * metaMe Companion — Observer capability grants + Context Engine canary
 * (PRD-MMC-IMPL-001 Increment 5).
 *
 * Mirrors `tests/companion-runtime.test.ts`'s exact shape and rigor:
 * pure-shape checks, no live network, no live Supabase. Locks the contracts
 * Increments 1-4 exist to keep:
 *
 *  1. TIER LAW — `types/companionObserver.ts` (a browser-serialisable
 *     module) declares NO forbidden T0 field (personaId / authProfileId /
 *     rootDid / kybeAttestation / cross-persona fioHandle) as a property.
 *
 *  2. CONSENT STATE MACHINE (Increment 1) — `grantCapability` is idempotent,
 *     `revokeCapability` preserves history (never deletes), and grants are
 *     scope/site isolated.
 *
 *  3. PARITY CANARY (Increment 1) — `OBSERVER_CAPABILITIES` has exactly the
 *     seven PRD §4.1 capabilities, and only `current-tab` / `page-document`
 *     support `'site'` scope — locks the PRD table against silent drift
 *     (`inv.engineering.036`/`037`).
 *
 *  4. CONTEXT ENGINE (Increment 3) — `toGroundingContext` never emits a key
 *     outside the real `GroundingContext` field set; `assertObservationRespectsGrants`
 *     throws on any populated-but-ungranted field and passes when granted;
 *     `buildObserverIntentText` is "observed, never asserted" — it never
 *     synthesizes a usable intent from passive observation alone.
 *
 *  5. API ROUTES (Increment 2) fail CLOSED on a null `getActivePersona` —
 *     401, no Supabase read/write attempted — and their response bodies
 *     carry no T0 field.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  OBSERVER_CAPABILITIES,
  SCOPE_SUPPORT,
  emptyObserverGrantState,
  type BrowserContextObservation,
} from '@/types/companionObserver';
import {
  grantCapability,
  revokeCapability,
  isCapabilityGranted,
} from '@/services/companion/observerConsent';
import {
  assertObservationRespectsGrants,
  toGroundingContext,
  buildObserverIntentText,
} from '@/services/companion/observerContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

const FORBIDDEN_T0_FIELDS = [
  'personaId',
  'authProfileId',
  'rootDid',
  'kybeAttestation',
] as const;

/**
 * Collect every key present anywhere in a JSON-serialisable value.
 *
 * Duplicated (not imported) from `tests/companion-runtime.test.ts` — that
 * file does not export this helper, and per this increment's own
 * instructions, copying a ~10-line pure test utility across two test files
 * is acceptable in this codebase (small test utilities are not treated as a
 * "one authoritative location" concern the way production code is).
 */
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

// ─── 1. Contract source declares no T0 field ────────────────────────────────

describe('types/companionObserver.ts — no T0 field declarations', () => {
  const source = readFileSync(
    join(process.cwd(), 'types', 'companionObserver.ts'),
    'utf8',
  );

  for (const field of [...FORBIDDEN_T0_FIELDS, 'fioHandle']) {
    it(`does not declare a "${field}" property`, () => {
      // Property-declaration position only — mentions in comments (the
      // tier-law documentation this file's own header carries) are
      // expected and fine.
      const decl = new RegExp(`^\\s*(readonly\\s+)?${field}\\??\\s*:`, 'm');
      expect(decl.test(source)).toBe(false);
    });
  }
});

// ─── 2. Consent state machine — Increment 1 ─────────────────────────────────

describe('grantCapability / revokeCapability / isCapabilityGranted', () => {
  it('grantCapability is idempotent — granting an already-active grant returns unchanged state', () => {
    const state = emptyObserverGrantState();
    const once = grantCapability(state, 'clipboard', 'global', undefined, '2026-07-23T00:00:00Z');
    expect(once).not.toBe(state);
    expect(once.clipboard).toHaveLength(1);

    const twice = grantCapability(once, 'clipboard', 'global', undefined, '2026-07-23T01:00:00Z');
    // Same reference back — no duplicate row, no state churn.
    expect(twice).toBe(once);
    expect(twice.clipboard).toHaveLength(1);
    expect(twice.clipboard[0].grantedAt).toBe('2026-07-23T00:00:00Z');
  });

  it('revoke preserves history — the revoked grant stays in the array with revokedAt set, never deleted', () => {
    const granted = grantCapability(
      emptyObserverGrantState(),
      'downloads',
      'global',
      undefined,
      '2026-07-23T00:00:00Z',
    );
    const revoked = revokeCapability(granted, 'downloads', 'global', undefined, '2026-07-23T02:00:00Z');

    expect(revoked).not.toBe(granted);
    expect(revoked.downloads).toHaveLength(1); // still present, not removed
    expect(revoked.downloads[0].revokedAt).toBe('2026-07-23T02:00:00Z');
    expect(revoked.downloads[0].grantedAt).toBe('2026-07-23T00:00:00Z');
    expect(isCapabilityGranted(revoked, 'downloads')).toBe(false);
  });

  it('revoke is a no-op (unchanged state) when no matching active grant exists', () => {
    const state = emptyObserverGrantState();
    const result = revokeCapability(state, 'history', 'global');
    expect(result).toBe(state);
  });

  it('site-scope isolation — a site-scoped grant for one domain does not grant another domain', () => {
    const state = grantCapability(
      emptyObserverGrantState(),
      'current-tab',
      'site',
      'example.com',
    );
    expect(isCapabilityGranted(state, 'current-tab', 'example.com')).toBe(true);
    expect(isCapabilityGranted(state, 'current-tab', 'other.com')).toBe(false);
    // No siteDomain passed — checking "any active grant" for a capability
    // whose only grant is site-scoped for a different site must not match.
    expect(isCapabilityGranted(state, 'current-tab')).toBe(false);
  });

  it('site-scope isolation — granting the same capability for two different sites keeps both independently active', () => {
    let state = grantCapability(emptyObserverGrantState(), 'page-document', 'site', 'a.com');
    state = grantCapability(state, 'page-document', 'site', 'b.com');
    expect(state['page-document']).toHaveLength(2);
    expect(isCapabilityGranted(state, 'page-document', 'a.com')).toBe(true);
    expect(isCapabilityGranted(state, 'page-document', 'b.com')).toBe(true);

    const revokedA = revokeCapability(state, 'page-document', 'site', 'a.com');
    expect(isCapabilityGranted(revokedA, 'page-document', 'a.com')).toBe(false);
    // Revoking one site's grant must not touch the other site's grant.
    expect(isCapabilityGranted(revokedA, 'page-document', 'b.com')).toBe(true);
  });
});

// ─── 3. SCOPE_SUPPORT / OBSERVER_CAPABILITIES parity canary ─────────────────

describe('OBSERVER_CAPABILITIES / SCOPE_SUPPORT — PRD §4.1 parity canary', () => {
  it('has exactly the seven PRD §4.1 capabilities', () => {
    expect(OBSERVER_CAPABILITIES).toHaveLength(7);
    expect([...OBSERVER_CAPABILITIES]).toEqual([
      'current-tab',
      'selection',
      'page-document',
      'downloads',
      'clipboard',
      'notifications',
      'history',
    ]);
  });

  it('only current-tab and page-document support the "site" scope', () => {
    const siteScoped = OBSERVER_CAPABILITIES.filter((cap) =>
      SCOPE_SUPPORT[cap].includes('site'),
    );
    expect(new Set(siteScoped)).toEqual(new Set(['current-tab', 'page-document']));
  });

  it('every capability supports "global" scope', () => {
    for (const cap of OBSERVER_CAPABILITIES) {
      expect(SCOPE_SUPPORT[cap]).toContain('global');
    }
  });

  it('SCOPE_SUPPORT has no entries for capabilities outside OBSERVER_CAPABILITIES', () => {
    expect(new Set(Object.keys(SCOPE_SUPPORT))).toEqual(new Set(OBSERVER_CAPABILITIES));
  });
});

// ─── 4. Context Engine — Increment 3 ────────────────────────────────────────

const GROUNDING_CONTEXT_FIELDS = new Set([
  'domains',
  'ontologyClassIds',
  'namespaces',
  'statuses',
  'limit',
]);

function baseObservation(overrides: Partial<BrowserContextObservation> = {}): BrowserContextObservation {
  return {
    grantedCapabilities: [],
    observedAt: '2026-07-23T00:00:00Z',
    ...overrides,
  };
}

describe('toGroundingContext', () => {
  it('emits only keys within the real GroundingContext field set', () => {
    const ctx = toGroundingContext(
      baseObservation({ currentTabDomain: 'example.com', grantedCapabilities: ['current-tab'] }),
    );
    for (const key of Object.keys(ctx)) {
      expect(GROUNDING_CONTEXT_FIELDS.has(key)).toBe(true);
    }
    expect(ctx).toEqual({ domains: ['example.com'] });
  });

  it('returns {} when there is no domain signal — never invents a field for selection/page-document', () => {
    const ctx = toGroundingContext(
      baseObservation({
        selectionText: 'some selected text',
        pageDocumentExcerpt: 'a page excerpt',
        grantedCapabilities: ['selection', 'page-document'],
      }),
    );
    expect(ctx).toEqual({});
    for (const key of Object.keys(ctx)) {
      expect(GROUNDING_CONTEXT_FIELDS.has(key)).toBe(true);
    }
  });
});

describe('assertObservationRespectsGrants', () => {
  it('throws when a populated field corresponds to an ungranted capability', () => {
    const state = emptyObserverGrantState(); // nothing granted
    const observation = baseObservation({
      currentTabDomain: 'example.com',
      grantedCapabilities: ['current-tab'],
    });
    expect(() => assertObservationRespectsGrants(observation, state)).toThrow();
  });

  it('does not throw when every populated field is currently granted', () => {
    let state = emptyObserverGrantState();
    state = grantCapability(state, 'current-tab', 'global');
    state = grantCapability(state, 'selection', 'global');
    const observation = baseObservation({
      currentTabDomain: 'example.com',
      currentTabTitle: 'Example Domain',
      selectionText: 'hello',
      grantedCapabilities: ['current-tab', 'selection'],
    });
    expect(() => assertObservationRespectsGrants(observation, state)).not.toThrow();
  });

  it('checks a site-scoped grant against the observation\'s own currentTabDomain', () => {
    let state = emptyObserverGrantState();
    // Grant current-tab globally so the currentTabDomain field itself (which
    // this test populates on every observation, since it doubles as the
    // siteDomain assertObservationRespectsGrants reads) is always permitted
    // regardless of domain — isolating the assertion to page-document's own
    // site-scoped grant, the thing this test actually exercises.
    state = grantCapability(state, 'current-tab', 'global');
    state = grantCapability(state, 'page-document', 'site', 'granted.com');

    const forGrantedSite = baseObservation({
      currentTabDomain: 'granted.com',
      pageDocumentExcerpt: 'excerpt',
      grantedCapabilities: ['current-tab', 'page-document'],
    });
    expect(() => assertObservationRespectsGrants(forGrantedSite, state)).not.toThrow();

    const forOtherSite = baseObservation({
      currentTabDomain: 'other.com',
      pageDocumentExcerpt: 'excerpt',
      grantedCapabilities: ['current-tab', 'page-document'],
    });
    expect(() => assertObservationRespectsGrants(forOtherSite, state)).toThrow();
  });

  it('an observation with no populated fields never throws, regardless of grant state', () => {
    const state = emptyObserverGrantState();
    const observation = baseObservation();
    expect(() => assertObservationRespectsGrants(observation, state)).not.toThrow();
  });
});

describe('buildObserverIntentText — "observed, never asserted"', () => {
  it('returns the user-typed intent when present', () => {
    const observation = baseObservation({
      currentTabTitle: 'Some Page',
      selectionText: 'some selection',
    });
    expect(buildObserverIntentText(observation, 'help me with this')).toBe('help me with this');
  });

  it('never synthesizes a usable intent from currentTabTitle/selectionText alone', () => {
    const observation = baseObservation({
      currentTabDomain: 'example.com',
      currentTabTitle: 'A very compelling page title',
      selectionText: 'a highly actionable text selection',
    });
    expect(buildObserverIntentText(observation)).toBe('');
    expect(buildObserverIntentText(observation, undefined)).toBe('');
    expect(buildObserverIntentText(observation, '')).toBe('');
    expect(buildObserverIntentText(observation, '   ')).toBe('');
  });
});

// ─── 5. API routes — fail closed, no T0 in response body ───────────────────

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

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as import('next/server').NextRequest;
}

describe('POST/GET /api/companion/observer/grants — fail closed', () => {
  beforeEach(() => {
    mockedGetActivePersona.mockReset();
    mockedGetSupabaseServer.mockReset();
  });

  it('GET returns 401 with no Supabase call attempted when getActivePersona resolves null', async () => {
    mockedGetActivePersona.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/companion/observer/grants/route');

    const res = await GET(makeRequest('http://localhost:3000/api/companion/observer/grants'));
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
    const { POST } = await import('@/app/api/companion/observer/grants/route');

    const res = await POST(
      makeRequest('http://localhost:3000/api/companion/observer/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability: 'clipboard', scope: 'global' }),
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

describe('DELETE /api/companion/observer/grants/[capability] — fail closed', () => {
  beforeEach(() => {
    mockedGetActivePersona.mockReset();
    mockedGetSupabaseServer.mockReset();
  });

  it('returns 401 with no Supabase call attempted when getActivePersona resolves null', async () => {
    mockedGetActivePersona.mockResolvedValueOnce(null);
    const { DELETE } = await import('@/app/api/companion/observer/grants/[capability]/route');

    const res = await DELETE(
      makeRequest('http://localhost:3000/api/companion/observer/grants/clipboard', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ capability: 'clipboard' }) },
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
