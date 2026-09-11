/**
 * metaMe Companion runtime canary (PRD-MMC-001 Phase 0/1).
 *
 * Pure-shape checks — no network, no Supabase. Locks the two contracts the
 * Companion runtime exists to keep:
 *
 *  1. TIER LAW — the browser-bound Companion contract (`types/companion.ts`)
 *     declares NO forbidden T0 field (personaId / authProfileId / rootDid /
 *     kybeAttestation / cross-persona fioHandle), and a resolved
 *     CompanionRuntimeContext never carries one even when an upstream read
 *     leaks extra fields (the feed projection is a whitelist).
 *
 *  2. COMPOSITION — deep links delegate to the canonical `buildCodexUrl`
 *     (T1 `?pst=` only; the dispatcher never emits a raw persona UUID),
 *     and identity resolution fails CLOSED (identity null on 401; no feed
 *     read without identity).
 *
 * NO observation surface exists in Phase 0/1 — the contract must not even
 * declare browser-context fields (tab / selection / history / clipboard);
 * those are Phase 2+, gated on PRD-MMC-001 §4 ratification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('@/utils/personaSpine', () => ({
  personaFetch: vi.fn(),
}));

import { personaFetch } from '@/utils/personaSpine';
import {
  buildCompanionDeepLinkUrl,
  mapReceiptsToFeed,
  resolveCompanionContext,
} from '@/services/companion/runtime';

const mockedFetch = personaFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedFetch.mockReset();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const FORBIDDEN_T0_FIELDS = [
  'personaId',
  'authProfileId',
  'rootDid',
  'kybeAttestation',
] as const;

/** Collect every key present anywhere in a JSON-serialisable value. */
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

const okJson = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;
const errJson = (status: number) =>
  ({ ok: false, status, json: async () => ({ error: 'unauthenticated' }) }) as unknown as Response;

// ─── 1. Contract source declares no T0 field ────────────────────────────────

describe('types/companion.ts — no T0 field declarations', () => {
  const source = readFileSync(
    join(process.cwd(), 'types', 'companion.ts'),
    'utf8',
  );

  for (const field of [...FORBIDDEN_T0_FIELDS, 'fioHandle']) {
    it(`does not declare a "${field}" property`, () => {
      // Property-declaration position only — mentions in comments (the
      // tier-law documentation) are expected and fine.
      const decl = new RegExp(`^\\s*(readonly\\s+)?${field}\\??\\s*:`, 'm');
      expect(decl.test(source)).toBe(false);
    });
  }

  it('declares no browser-observation fields in Phase 0/1', () => {
    for (const observed of ['currentTab', 'pageDocument', 'browsingHistory', 'clipboard']) {
      const decl = new RegExp(`^\\s*(readonly\\s+)?${observed}\\??\\s*:`, 'm');
      expect(decl.test(source)).toBe(false);
    }
  });
});

// ─── 2. Deep links — canonical helper, pst only ─────────────────────────────

describe('buildCompanionDeepLinkUrl', () => {
  it('delegates to buildCodexUrl and carries the T1 pst', () => {
    const url = buildCompanionDeepLinkUrl(
      { slug: 'knyt', tab: 'knyt-alpha', from: 'companion' },
      { personaSessionToken: 'pst-token-t1' },
    );
    expect(url).toContain('/triad/embed/codex/knyt');
    expect(url).toContain('pst=pst-token-t1');
    expect(url).toContain('tab=knyt-alpha');
    expect(url).toContain('from=companion');
    expect(url).not.toContain('personaId=');
  });

  it('emits no identity param when unauthenticated', () => {
    const url = buildCompanionDeepLinkUrl({ slug: 'knyt' });
    expect(url).not.toContain('pst=');
    expect(url).not.toContain('personaId=');
  });
});

// ─── 3. Feed projection is a whitelist ──────────────────────────────────────

describe('mapReceiptsToFeed', () => {
  it('projects only whitelisted T1 fields and drops everything else', () => {
    const feed = mapReceiptsToFeed([
      {
        id: 'r1',
        createdAt: '2026-07-22T00:00:00Z',
        actionType: 'artifact_created',
        summary: 'Created a thing',
        activeCartridge: 'knyt-codex',
        // Simulated upstream leak — MUST be dropped by the projection:
        personaId: 'persona-uuid-LEAK',
        authProfileId: 'auth-LEAK',
        rootDid: 'did:fio:LEAK',
      },
    ]);
    expect(feed).toHaveLength(1);
    const keys = collectKeys(feed);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(feed[0]).toEqual({
      id: 'r1',
      kind: 'artifact_created',
      title: 'Created a thing',
      occurredAt: '2026-07-22T00:00:00Z',
      cartridge: 'knyt-codex',
    });
  });

  it('tolerates malformed input', () => {
    expect(mapReceiptsToFeed(undefined)).toEqual([]);
    expect(mapReceiptsToFeed([null, 42, { id: 'no-timestamp' }])).toEqual([]);
  });
});

// ─── 4. Resolver — fail closed, T1-only context ─────────────────────────────

describe('resolveCompanionContext', () => {
  it('fails closed on 401 — identity null and no feed read attempted', async () => {
    mockedFetch.mockResolvedValueOnce(errJson(401));
    const ctx = await resolveCompanionContext({ surface: 'web-embed' });
    expect(ctx.identity).toBeNull();
    expect(ctx.feed).toEqual([]);
    // Only the identity read fired — no receipts read without identity.
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves a T1-only context with the feed, threading the personaIdHint', async () => {
    mockedFetch
      .mockResolvedValueOnce(
        okJson({
          personaSessionToken: 'pst-abc',
          identifiability: 'semi_anonymous',
          cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: [] },
          cohortMemberships: [],
          sessionExpiresAt: '2026-07-22T01:00:00Z',
          displayLabel: 'Sunfish',
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          receipts: [
            {
              id: 'r1',
              createdAt: '2026-07-22T00:00:00Z',
              actionType: 'intent_queued',
              summary: 'Queued',
            },
          ],
          count: 1,
        }),
      );

    const ctx = await resolveCompanionContext({
      surface: 'web-embed',
      personaIdHint: 'hint-uuid',
    });

    expect(ctx.identity?.personaSessionToken).toBe('pst-abc');
    expect(ctx.session.expiresAt).toBe('2026-07-22T01:00:00Z');
    expect(ctx.feed).toHaveLength(1);
    expect(ctx.surface).toBe('web-embed');

    // Both spine reads used personaFetch with the SAME hint (one transport,
    // one resolved persona).
    for (const call of mockedFetch.mock.calls) {
      expect(call[1]?.personaIdHint).toBe('hint-uuid');
    }

    // The resolved context carries no forbidden T0 key anywhere.
    const keys = collectKeys(JSON.parse(JSON.stringify(ctx)));
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
});
