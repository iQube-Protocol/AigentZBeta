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
import vm from 'node:vm';

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

/**
 * CAPABILITY ROUTE PARITY (2026-07-25).
 *
 * `CAPABILITY_ROUTES` (services/companion/overlayMapping.ts) is a
 * hand-declared projection of two other sources of truth: the Constitutional
 * Capability Registry's ids and `data/codex-configs.ts`'s codex/tab slugs.
 * Nothing derives it, so per CLAUDE.md's source-of-truth parity rule
 * (`inv.engineering.036`/`037`) it needs a canary or it silently rots into a
 * dead link the moment a tab is renamed, disabled, or moved.
 *
 * Registered in tests/source-of-truth-parity.test.ts's index of parity
 * canaries living elsewhere.
 */
describe('Companion Overlay — capability route parity', () => {
  /**
   * Mirrors the EXACT resolution logic in
   * app/(embed)/triad/embed/codex/[codexSlug]/page.tsx: append `-codex`
   * unless the string already carries a known suffix, then resolve legacy
   * aliases. This is deliberately duplicated rather than imported because
   * the page inlines it — but this canary is what makes that inline logic a
   * source of truth this table must track, instead of a route that "looks
   * right" (matches `.slug`) while actually 404ing in production.
   *
   * THE BUG THIS SHAPE OF TEST WOULD HAVE CAUGHT (2026-07-25): the original
   * version of this canary checked `route.slug` against `CodexConfig.slug`
   * and passed, because the table's value and the assertion were both
   * `'venture-lab'` — internally consistent, and wrong, since the embed
   * route resolves by `.id` (`'alpha-knyt-codex'`), not `.slug`. Both
   * capability deep-links 404'd as "Codex not found" in the live browser
   * despite this canary being green. Asserting against the REAL resolution
   * function closes that gap.
   */
  function resolveEmbedCodexId(rawSlug: string, legacyAliases: Record<string, string>): string {
    const hasKnownSuffix = rawSlug.endsWith('-codex') || rawSlug.endsWith('-cartridge');
    const suffixed = hasKnownSuffix ? rawSlug : `${rawSlug}-codex`;
    return legacyAliases[suffixed] ?? suffixed;
  }

  it('every declared route resolves via the REAL embed-route id lookup, to a real, enabled tab', async () => {
    const { CAPABILITY_ROUTES } = await import('@/services/companion/overlayMapping');
    const { CODEX_DEFINITIONS, LEGACY_CODEX_SLUGS } = await import('@/data/codex-configs');

    const entries = Object.entries(CAPABILITY_ROUTES);
    expect(entries.length).toBeGreaterThan(0);

    for (const [capabilityId, route] of entries) {
      const resolvedId = resolveEmbedCodexId(route.slug, LEGACY_CODEX_SLUGS);
      const codex = CODEX_DEFINITIONS.find((c) => c.id === resolvedId);
      expect(
        codex,
        `${capabilityId}: route.slug "${route.slug}" resolves to codex id "${resolvedId}", which does not exist. ` +
          `CAPABILITY_ROUTES.slug must be the codex's real .id (already carrying its -codex/-cartridge suffix), ` +
          `not its .slug — the embed route matches by id.`,
      ).toBeTruthy();

      const tab = codex!.tabs.find((t) => t.slug === route.tab);
      expect(tab, `${capabilityId}: codex "${resolvedId}" has no tab "${route.tab}"`).toBeTruthy();
      // A disabled tab is a dead link even though the slug resolves.
      expect(tab!.enabled, `${capabilityId}: tab "${route.tab}" is disabled`).toBe(true);
      expect(route.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('routes carry no identifier — they are static, loggable metadata', async () => {
    const { CAPABILITY_ROUTES } = await import('@/services/companion/overlayMapping');
    // The persona is attached at render time by the panel, never stored here.
    // A UUID appearing in this table would mean an identifier had been baked
    // into a static constant — the exact T0/T1 leak the tier rules forbid.
    const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(UUID_RE.test(JSON.stringify(CAPABILITY_ROUTES))).toBe(false);
    for (const route of Object.values(CAPABILITY_ROUTES)) {
      expect(Object.keys(route).sort()).toEqual(['label', 'slug', 'tab']);
    }
  });
});

/**
 * UNMAPPED-DOMAIN GENERIC CARD (operator-directed, 2026-07-25 — "1 and 2 for
 * unmapped pages + 3 as you suggest"). Locks the no-fabrication contract for
 * `composeGenericOverlayCard` and the route's four-way reason split.
 */
describe('Companion Overlay — generic (unmapped-domain) card', () => {
  beforeEach(() => {
    mockedGetSupabaseServer.mockReset();
  });

  it('degrades honestly to no standing signal when Supabase is unavailable, and no title yields no matches', async () => {
    mockedGetSupabaseServer.mockReturnValue(null);
    const { composeGenericOverlayCard } = await import('@/services/companion/overlayComposition');

    const persona = {
      personaId: 'persona-1',
      identifiability: 'semi_anonymous',
      cartridgeFlags: { isAdmin: false, isPartner: false },
    } as unknown as import('@/types/access').ActivePersonaContext;

    const card = await composeGenericOverlayCard(persona, undefined, 'example.com');

    expect(card.shape).toBe('generic');
    expect(card.domain).toBe('example.com');
    expect(card.standing.hasStandingSignal).toBe(false);
    // No page title -> no query -> no fabricated matches, not an error.
    expect(card.relatedMatches).toEqual([]);
    // Persona-level fields pass through unchanged -- this is item 3 of the
    // operator's ask: these were never page-specific, so nothing is derived
    // or narrowed for the unmapped case.
    expect(card.identifiability).toBe('semi_anonymous');
    expect(card.cartridgeFlags).toEqual({ isAdmin: false, isPartner: false });
  });

  /**
   * DOMAIN SEARCH HINT (found 2026-07-25, live-verifying Gmail). Gmail's tab
   * title is the inbox content ("Inbox (72,138)"), never the word "Gmail",
   * so title-only search silently missed the real, already-registered Gmail
   * connector assets. Locks the fix: `domainSearchHint` for the small,
   * explicit Google Workspace host table, and `buildRegistrySearchCandidates`
   * (the pure core `composeGenericOverlayCard`'s I/O shell delegates to) —
   * both directly testable without any Supabase/search-federation I/O.
   */
  describe('domain search hint (Gmail under-coverage fix)', () => {
    it('domainSearchHint returns the product name for known Google Workspace hosts, null otherwise', async () => {
      const { domainSearchHint } = await import('@/services/companion/overlayMapping');
      expect(domainSearchHint('mail.google.com')).toBe('Gmail');
      expect(domainSearchHint('drive.google.com')).toBe('Google Drive');
      expect(domainSearchHint('docs.google.com')).toBe('Google Docs');
      expect(domainSearchHint('calendar.google.com')).toBe('Google Calendar');
      expect(domainSearchHint('tasks.google.com')).toBe('Google Tasks');
      // Case/whitespace-insensitive, like shapeForDomain.
      expect(domainSearchHint('  MAIL.GOOGLE.COM  ')).toBe('Gmail');
      // Not in the table -> null, falls back to title-only search.
      expect(domainSearchHint('www.google.com')).toBeNull();
      expect(domainSearchHint('example.com')).toBeNull();
      expect(domainSearchHint(null)).toBeNull();
      expect(domainSearchHint(undefined)).toBeNull();
    });

    it('buildRegistrySearchCandidates puts the domain hint first when present, and still falls back to title alone', async () => {
      const { buildRegistrySearchCandidates } = await import('@/services/companion/overlayComposition');

      // THE EXACT REPORTED CASE: Gmail's title alone would have produced [],
      // silently missing the real Gmail connector assets. The hint fixes it.
      expect(buildRegistrySearchCandidates('mail.google.com', 'Inbox (72,138)')).toEqual([
        'Gmail',
        'Inbox (72,138)',
      ]);

      // No hint for this domain -> title-only, unchanged from before the fix.
      expect(buildRegistrySearchCandidates('example.com', 'Some Page Title')).toEqual(['Some Page Title']);

      // No title -> hint alone, not an empty candidate list.
      expect(buildRegistrySearchCandidates('mail.google.com', undefined)).toEqual(['Gmail']);

      // Neither -> genuinely nothing to search, not a fabricated candidate.
      expect(buildRegistrySearchCandidates('example.com', undefined)).toEqual([]);
      expect(buildRegistrySearchCandidates(null, null)).toEqual([]);

      // Hint and title happen to collide (case-insensitively) -> deduped to one.
      expect(buildRegistrySearchCandidates('mail.google.com', 'gmail')).toEqual(['Gmail']);
    });
  });

  // A route-level integration test (mocking loadLatestObservation/
  // loadGrantState/isCapabilityGranted) is deliberately NOT added here: this
  // file already imports the REAL `isCapabilityGranted` for its own direct
  // unit tests above (grantCapability/revokeCapability describe block), and
  // module-mocking it mid-file risks destabilizing those. The route's
  // four-way reason branch (app/api/companion/overlay/route.ts) is simple
  // enough to verify by inspection: `composeGenericOverlayCard` is called
  // if and only if `reason === 'domain-unmapped' && domain` — the exact
  // condition under which `shape` is falsy but a real, currently-granted
  // domain exists. The composition-level contract above is what actually
  // needs a canary (the no-fabrication guarantee); the branch condition
  // itself is a one-line `if` with no logic worth a parallel mock harness.
});

/**
 * GENERALISATION CANARY (operator-directed, 2026-07-25 — "would this apply
 * generally or just github?" → generally).
 *
 * `resolveRelatedMatches` is now the common floor under EVERY overlay shape:
 * before this, only the generic unmapped-domain card searched the registry at
 * all, and the financial-context card had no registry lookup whatsoever. Locks that the
 * generalisation stays general — a new shape that forgets `relatedMatches`,
 * or a card type that quietly drops it, fails here rather than silently
 * regressing to the old per-shape asymmetry.
 */
describe('Companion Overlay — related-matches generalisation', () => {
  it('every overlay card type declares relatedMatches', async () => {
    const source = readFileSync(
      join(process.cwd(), 'services', 'companion', 'overlayComposition.ts'),
      'utf8',
    );

    // Each card interface must carry the field. Asserted against the source
    // because these are compile-time types with no runtime representation to
    // introspect.
    for (const iface of [
      'GithubRepoOverlayCard',
      'FinancialContextOverlayCard',
      'GenericOverlayCard',
    ]) {
      const block = source.slice(
        source.indexOf(`export interface ${iface} {`),
        source.indexOf('}', source.indexOf(`export interface ${iface} {`)),
      );
      expect(block.length, `${iface} not found`).toBeGreaterThan(0);
      expect(block, `${iface} is missing relatedMatches`).toContain('relatedMatches');
    }
  });

  it('all three composers resolve related matches through the one shared function', async () => {
    const source = readFileSync(
      join(process.cwd(), 'services', 'companion', 'overlayComposition.ts'),
      'utf8',
    );
    // One definition, three call sites (github / financial-context / generic). A second
    // definition would mean a shape had forked the lookup -- the exact
    // duplicate-implementation defect CLAUDE.md's inv.engineering.037 forbids.
    const definitions = source.match(/async function resolveRelatedMatches\(/g) ?? [];
    expect(definitions).toHaveLength(1);
    const callSites = source.match(/resolveRelatedMatches\(/g) ?? [];
    expect(callSites.length).toBeGreaterThanOrEqual(4); // 1 definition + >=3 calls
  });
});

// ─── MS-10 — One observer, one record ──────────────────────────────────────
//
// THE DEFECT (operator, 2026-07-27: "overlay is not picking up the current
// site"). The Companion's browser observation is ONE shared row --
// `companion_observation_latest`, keyed by persona, last writer wins. But the
// decision to SKIP a write lived in `content.js`, whose `lastSentSignature` is
// module state inside ONE tab's content script. Every open tab held its own
// copy, each claiming to describe the same single row.
//
// So: observe claude.ai (row = claude.ai), switch to a github.com tab (row =
// github.com), switch back to claude.ai -- and that tab's content script
// compares against ITS OWN last send, finds it identical, and suppresses. The
// row keeps saying github.com forever. The Overlay renders "REPOSITORY --
// GITHUB.COM" while the citizen is on claude.ai, the quick-link strip ranks on
// the github needle, and Refresh cannot help because Refresh's re-observe hop
// lands in the very function that is suppressing.
//
// The harness below runs the REAL shipped `background.js` + `content.js` in
// `node:vm` with a fake `chrome`, one page context per tab sharing one message
// bus and one server. The file's older structural canaries were written on the
// premise that "vitest cannot execute" these files; it can, and a structural
// grep could never have caught this -- the defect is in WHERE state lives, not
// in what any line says.

describe('extension/companion-observer — MS-10: one observer, one record', () => {
  const EXT_DIR = join(process.cwd(), 'extension', 'companion-observer');
  const extSource = (file: string) => readFileSync(join(EXT_DIR, file), 'utf8');

  /** Lets every pending promise + 0ms timer in both vm realms settle. */
  const flush = async () => {
    for (let i = 0; i < 4; i += 1) await new Promise((r) => setTimeout(r, 5));
  };

  function buildBrowser(opts?: { observationStatus?: () => number; hydrationDelayMs?: number }) {
    /** The single shared server row the whole defect is about. */
    const posted: Array<Record<string, unknown>> = [];
    const storage: Record<string, unknown> = {
      observerGrantState: {
        'current-tab': [{ capability: 'current-tab', scope: 'global', grantedAt: '2026-01-01T00:00:00.000Z' }],
        selection: [],
        'page-document': [],
        downloads: [],
        clipboard: [],
        notifications: [],
        history: [],
      },
      metameAuthSession: { accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: 4102444800 },
      metamePersonaId: 'persona-under-test',
    };
    const workerListeners: Array<(m: unknown, s: unknown, r: (v: unknown) => void) => unknown> = [];

    const localStorageArea = {
      // THE CALLBACK IS DEFERRED, because Chrome's is (MS-11, 2026-07-30).
      // This fake used to invoke `cb` SYNCHRONOUSLY, and that single detail
      // made the whole cold-start class of defect impossible to express here:
      // `grantStateCache` was always hydrated before any message could be
      // dispatched, so a handler reading it synchronously always looked
      // correct. In a real MV3 worker the hydration callback lands on a LATER
      // task than the message that woke the worker. A fake that is easier to
      // satisfy than the real API cannot falsify anything.
      get: (keys: string[], cb?: (r: Record<string, unknown>) => void) => {
        const out: Record<string, unknown> = {};
        for (const k of keys) out[k] = storage[k];
        if (cb) { setTimeout(() => cb(out), opts?.hydrationDelayMs ?? 0); return undefined; }
        return Promise.resolve(out);
      },
      set: (obj: Record<string, unknown>) => { Object.assign(storage, obj); return Promise.resolve(); },
      remove: (keys: string[]) => { for (const k of keys) delete storage[k]; return Promise.resolve(); },
    };

    const fetchStub = async (url: unknown, init?: { body?: string }) => {
      const href = String(url);
      if (href.endsWith('/grants')) {
        return { ok: true, status: 200, json: async () => ({ grants: [storage.observerGrantState] && [
          { capability: 'current-tab', scope: 'global', grantedAt: '2026-01-01T00:00:00.000Z' },
        ] }) };
      }
      if (href.endsWith('/observation')) {
        const status = opts?.observationStatus ? opts.observationStatus() : 200;
        // Recorded on ATTEMPT, so a rejected forward is still visible to the
        // test -- what matters is whether the write was attempted at all.
        posted.push({ ...(JSON.parse(init?.body ?? '{}') as Record<string, unknown>), __status: status });
        return { ok: status < 400, status, json: async () => ({ ok: status < 400 }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const workerSandbox: Record<string, unknown> = {
      console: { log: () => {}, warn: () => {}, info: () => {}, error: () => {} },
      setTimeout, clearTimeout, URL, AbortSignal,
      fetch: fetchStub,
      chrome: {
        storage: { local: localStorageArea, onChanged: { addListener: () => {} } },
        runtime: {
          onMessage: { addListener: (fn: never) => workerListeners.push(fn) },
          onInstalled: { addListener: () => {} },
          onStartup: { addListener: () => {} },
        },
        contextMenus: { create: () => {}, onClicked: { addListener: () => {} } },
        tabs: { query: async () => [], sendMessage: async () => undefined },
        scripting: { executeScript: async () => [] },
        action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
      },
    };
    const workerCtx = vm.createContext(workerSandbox);
    workerSandbox.importScripts = (...files: string[]) => {
      for (const f of files) vm.runInContext(extSource(f), workerCtx, { filename: f });
    };
    vm.runInContext(extSource('background.js'), workerCtx, { filename: 'background.js' });

    /** One page context per open tab — each gets its own content script, as
     *  in a real browser. They share only the message bus and the server. */
    function openTab(domain: string, title: string) {
      const pageSandbox: Record<string, unknown> = {
        console: { log: () => {}, warn: () => {}, info: () => {}, error: () => {} },
        setTimeout, clearTimeout,
        location: { hostname: domain, href: `https://${domain}/` },
        document: {
          title,
          visibilityState: 'visible',
          body: { innerText: '' },
          addEventListener: () => {},
        },
        chrome: {
          runtime: {
            lastError: undefined,
            onMessage: { addListener: () => {} },
            sendMessage: (message: unknown, cb?: (v: unknown) => void) => {
              let answered = false;
              const sendResponse = (v: unknown) => { if (!answered) { answered = true; cb?.(v); } };
              for (const fn of workerListeners) {
                const isAsync = fn(message, {}, sendResponse);
                if (isAsync === true) return;
              }
            },
          },
        },
      };
      pageSandbox.window = pageSandbox;
      const pageCtx = vm.createContext(pageSandbox);
      vm.runInContext(extSource('constants.js'), pageCtx, { filename: 'constants.js' });
      vm.runInContext(extSource('content.js'), pageCtx, { filename: 'content.js' });
      return {
        /** The real shipped entry point every re-observation runs through. */
        observe: async () => {
          await (pageSandbox.safeObserve as () => Promise<void>)();
          await flush();
        },
      };
    }

    return { posted, openTab, flush };
  }

  const domainsOf = (posted: Array<Record<string, unknown>>) =>
    posted.map((p) => p.currentTabDomain);

  it('re-observing a tab AFTER another tab overwrote the shared row writes again', async () => {
    const browser = buildBrowser();
    // Two open tabs. Each observes once on load, exactly as a real browser
    // does; then the citizen comes back to the first one.
    const claude = browser.openTab('claude.ai', 'Claude');
    await browser.flush();
    const github = browser.openTab('github.com', 'iQube-Protocol/AigentZBeta');
    await browser.flush();

    await claude.observe(); // the return — the write that must not be skipped

    // THE ASSERTION THE DEFECT FAILS. On the unfixed code the third write is
    // suppressed by claude.ai's own per-tab `lastSentSignature`, so the shared
    // row still says github.com while the citizen is looking at claude.ai --
    // exactly the operator's screenshot.
    expect(
      domainsOf(browser.posted),
      'returning to an already-observed tab must re-write the shared observation row: ' +
        'a per-observer "nothing changed" memory cannot know another tab has since overwritten it',
    ).toEqual(['claude.ai', 'github.com', 'claude.ai']);
  });

  it('re-observing the SAME unchanged page with no other tab between still costs no write', async () => {
    // The suppression is not deleted, it is relocated to the one place that
    // knows what the row holds. Its original purpose -- no network write per
    // tab flick when nothing actually changed -- must survive the move, or the
    // "fix" is just a revert of the write-per-flick work.
    const browser = buildBrowser();
    const claude = browser.openTab('claude.ai', 'Claude');
    await browser.flush();

    await claude.observe();
    await claude.observe();
    await claude.observe();

    expect(
      domainsOf(browser.posted),
      'an unchanged observation with no intervening tab must be written exactly once',
    ).toEqual(['claude.ai']);
  });

  it('a cold-started worker answers grant checks from STORAGE, not from its empty initial cache', async () => {
    // MS-11 — a cache may not answer authoritatively before it is hydrated.
    //
    // THE DEFECT (operator-diagnosed 2026-07-30, after the Overlay showed the
    // same stale site for hours while the popup reported "grants in sync"):
    // MV3 evicts the worker after ~30s idle, so the message that WAKES it is
    // dispatched to `onMessage` on an earlier task than the worker's own async
    // `chrome.storage.local.get` hydration callback. `CHECK_GRANT` answered
    // synchronously from `emptyGrantState()` — `false` for every capability,
    // on every domain — so `buildObservation` populated NO fields and posted
    // `{grantedCapabilities: [], observedAt}` with no `currentTabDomain`. The
    // citizen's `scope: 'global'` grant was in storage the entire time.
    //
    // `hydrationDelayMs` puts the hydration callback firmly AFTER the waking
    // message rather than leaving it to chance, so this pins the ordering
    // instead of racing it.
    const browser = buildBrowser({ hydrationDelayMs: 10 });
    const claude = browser.openTab('claude.ai', 'Claude');
    await browser.flush();

    expect(
      domainsOf(browser.posted),
      'the observation that woke the worker must carry the observed domain: a grant check ' +
        'answered before hydration reports "denied" for what is really "not loaded yet", and ' +
        'the resulting domainless observation leaves the shared row on whatever it last held',
    ).toEqual(['claude.ai']);
  });

  it('a REJECTED forward is retried on the next identical observation, never suppressed', async () => {
    // The old content-script suppression recorded its signature on the LOCAL
    // consent ack (`{ ok: true }` from the grant check), which says nothing
    // about whether the SERVER accepted the write. A failed forward therefore
    // suppressed its own retry.
    let status = 500;
    const browser = buildBrowser({ observationStatus: () => status });
    const claude = browser.openTab('claude.ai', 'Claude'); // page-load: rejected
    await browser.flush();
    status = 200;
    await claude.observe(); // identical payload — must be attempted again

    expect(
      browser.posted.length,
      'an observation the server refused was never recorded, so the identical retry must go out',
    ).toBe(2);
  });
});

// ─── Refresh proxy — terminal vs transient must match what the extension does
//
// `extension/companion-observer/background.js` deletes the citizen's cached
// session outright when this route answers with a status in its
// `TERMINAL_REFRESH_STATUSES` set. The route used to answer a flat 401 for
// EVERY failure of `refreshSession` — a GoTrue rate limit, a 5xx, a network
// error and a genuinely rejected token all arrive as a populated `error`. So
// one upstream blip logged the extension out: the Observer stopped writing and
// every "Pull Across" capture died at `ensureFreshToken()` with
// `no-auth-session`, silently, until the operator re-paired by hand.
//
// The two sides are pinned to each other here rather than to a literal, so the
// contract cannot drift on either side of the TS/extension boundary.

describe('POST /api/companion/observer/refresh-session — terminal vs transient', () => {
  /** The extension's own set, read from the shipped file — never re-listed. */
  const terminalStatuses = (() => {
    const src = readFileSync(
      join(process.cwd(), 'extension', 'companion-observer', 'background.js'),
      'utf8',
    );
    const m = src.match(/const TERMINAL_REFRESH_STATUSES = new Set\(\[([^\]]*)\]\)/);
    expect(m, 'background.js no longer declares TERMINAL_REFRESH_STATUSES').toBeTruthy();
    return m![1].split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n));
  })();

  const callRefresh = async (refreshError: unknown) => {
    vi.resetModules();
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { refreshSession: async () => ({ data: { session: null }, error: refreshError }) },
      }),
    }));
    const { POST } = await import('@/app/api/companion/observer/refresh-session/route');
    const res = await POST(
      makeRequest('http://localhost:3000/api/companion/observer/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'a-token' }),
      }),
    );
    vi.doUnmock('@supabase/supabase-js');
    return res;
  };

  it('a genuinely rejected refresh token answers terminally, so the dead credential is cleared', async () => {
    // GoTrue rejects an invalid/spent/revoked refresh token with a 4xx. This
    // is the case `clearAuthSession` exists for and it must keep working.
    const res = await callRefresh(Object.assign(new Error('Invalid Refresh Token'), { status: 400 }));
    expect(
      terminalStatuses.includes(res.status),
      `a rejected token must answer with a status the extension treats as terminal (${terminalStatuses.join('/')}), got ${res.status}`,
    ).toBe(true);
  });

  it('a TRANSIENT upstream failure must NOT answer terminally — a hiccup may not log the citizen out', async () => {
    for (const transient of [
      Object.assign(new Error('service unavailable'), { status: 503 }),
      // A 4xx, but it says "try again later", not "this token is dead".
      Object.assign(new Error('over_request_rate_limit'), { status: 429 }),
      Object.assign(new Error('fetch failed'), { status: undefined }), // network layer: AuthError.status is optional
      null, // no error, but no session either — unexplained, so not terminal
    ]) {
      const res = await callRefresh(transient);
      expect(
        terminalStatuses.includes(res.status),
        `a transient upstream failure (${String((transient as Error | null)?.message ?? 'no-error')}) must not answer with a terminal status; ` +
          'the extension deletes the cached session on those, which kills the Observer and every Pull Across capture',
      ).toBe(false);
    }
  });
});
