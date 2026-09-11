/**
 * Corpus Scout — registry verification's transient-status handling
 * (operator-approved fix, 2026-07-28: "World Bank hit two 504s and lost both
 * attempts. A timeout must not silently become 'no evidence.' The failed
 * acquisition attempt should remain observable.").
 *
 * `followRedirects` (`retrieval.ts`) now bounded-retries a TRANSIENT status
 * (429/502/503/504) or a genuine timeout before returning. These canaries
 * pin what happens on the OTHER side of that retry — once
 * `runVerification` receives an exhausted-retry outcome, it must record
 * `temporarily_unavailable`, never the harsher `verification_failed`, so a
 * transient remote hiccup stays distinguishable (and re-runnable) from a
 * genuinely dead or unauthorised URL.
 *
 * Uses `VerificationDeps` injection (already built into `registryVerification.ts`
 * for exactly this purpose) — no network access, no timing dependency on the
 * real retry/backoff delays in `retrieval.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  runVerification,
  type VerificationDeps,
} from '@/services/corpusScout/registryVerification';
import type { InstitutionDiscoveryResult } from '@/services/corpusScout/institutionNavigator';
import type { RetrievalResult } from '@/services/corpusScout/types';

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers() } as unknown as Response;
}

function makeDeps(overrides: Partial<VerificationDeps> = {}): VerificationDeps {
  const okDiscovery: InstitutionDiscoveryResult = {
    ok: true,
    pagesFetched: 1,
    candidates: [{ documentUrl: 'https://example.org/doc.pdf', title: 'Doc', discoveryUrl: 'https://example.org', foundOnUrl: 'https://example.org' }],
  };
  const okRetrieval: RetrievalResult = {
    ok: true,
    bytes: Buffer.from('%PDF-1.4\n' + 'x'.repeat(2000)),
    contentType: 'application/pdf',
    declaredMimeMismatch: false,
    artifactHash: 'a'.repeat(64),
    fileSizeBytes: 2000,
    resolutionChain: { discoveryUrl: 'https://example.org', downloadUrl: 'https://example.org/doc.pdf', resolvedArtifactUrl: 'https://example.org/doc.pdf', redirectCount: 0 },
  };
  return {
    followRedirects: async (url: string) => ({ ok: true, response: fakeResponse(200), finalUrl: url, redirectCount: 0 }),
    runInstitutionDiscovery: async () => okDiscovery,
    retrieveArtifact: async () => okRetrieval,
    inspectArtifact: async () => ({
      ok: true, normalizedText: 'substantive '.repeat(200), pageCount: 3,
      substantiveTextCharacters: 2400, blankPageRatio: 0, extractionWarnings: [], passesContentPresenceCheck: true,
    }),
    ...overrides,
  };
}

describe('runVerification — an exhausted-retry TRANSIENT status is temporarily_unavailable, never verification_failed', () => {
  it('THE CANARY: a 504 that survives followRedirects\' internal retries records temporarily_unavailable, with the transient reason in detail', async () => {
    const deps = makeDeps({
      followRedirects: async (url: string) => ({ ok: true, response: fakeResponse(504), finalUrl: url, redirectCount: 0 }),
    });

    const outcome = await runVerification('https://worldbank.example', deps);

    expect(outcome.status).toBe('temporarily_unavailable');
    expect(outcome.detail).toMatch(/504/);
    expect(outcome.detail).toMatch(/transient/i);
  });

  it('retries every status in the transient vocabulary (429/502/503/504) to temporarily_unavailable', async () => {
    for (const status of [429, 502, 503, 504]) {
      const deps = makeDeps({
        followRedirects: async (url: string) => ({ ok: true, response: fakeResponse(status), finalUrl: url, redirectCount: 0 }),
      });
      const outcome = await runVerification('https://example.org', deps);
      expect(outcome.status, `status ${status} must record temporarily_unavailable`).toBe('temporarily_unavailable');
    }
  });

  it('a NON-transient bad status (500, 400) still records verification_failed — the distinction is not erased', async () => {
    for (const status of [400, 500]) {
      const deps = makeDeps({
        followRedirects: async (url: string) => ({ ok: true, response: fakeResponse(status), finalUrl: url, redirectCount: 0 }),
      });
      const outcome = await runVerification('https://example.org', deps);
      expect(outcome.status, `status ${status} must stay verification_failed`).toBe('verification_failed');
    }
  });

  it('a network-level timeout still records temporarily_unavailable (unchanged prior behaviour)', async () => {
    const deps = makeDeps({
      followRedirects: async (url: string) => ({ ok: false, failureClass: 'timeout', redirectCount: 0, finalUrl: url }),
    });
    const outcome = await runVerification('https://example.org', deps);
    expect(outcome.status).toBe('temporarily_unavailable');
  });

  it('the failed attempt is OBSERVABLE, not silent — checkedAt, resolvedUrl and a non-empty detail are always recorded', async () => {
    const deps = makeDeps({
      followRedirects: async (url: string) => ({ ok: true, response: fakeResponse(503), finalUrl: url, redirectCount: 0 }),
    });
    const outcome = await runVerification('https://example.org', deps);
    expect(outcome.checkedAt).toBeTruthy();
    expect(outcome.resolvedUrl).toBe('https://example.org');
    expect(outcome.detail.length).toBeGreaterThan(0);
  });
});
