/**
 * `runVerificationStep` (`services/corpusScout/registryVerification.ts`,
 * 2026-08-31, "verification wall-clock granularity" repair).
 *
 * Live incident: `verifyInstitutionEntry` chained resolve-seed + discover-
 * candidates (itself up to six sequential page fetches) + up to five
 * document fetch+inspects in ONE call — the exact shape that produced a
 * real HTTP 504 on `POST .../acquisition/verify-step` for BIS. This suite
 * pins the fix: EXACTLY ONE bounded external operation per call, a hard
 * internal deadline race (never an empty 504 — the losing side is
 * abandoned, logged, never awaited), and durable phase/cursor persistence
 * on `corpus_institutional_registry.verification_progress` between calls.
 *
 * Uses the real `VerificationDeps` injection point (no module mocking
 * needed for the external I/O) and the shared in-memory `fakeSupabase` for
 * the registry row — a real multi-call sequence against the SAME fake row
 * is exactly what proves progress persists between calls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  runVerificationStep,
  VERIFICATION_STEP_DEADLINE_MS,
  type VerificationDeps,
} from '@/services/corpusScout/registryVerification';
import type { InstitutionDiscoveryResult } from '@/services/corpusScout/institutionNavigator';
import type { RetrievalResult } from '@/services/corpusScout/types';
import { createFakeSupabase } from './_lib/fakeSupabase';

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers() } as unknown as Response;
}

function candidate(n: number) {
  return {
    documentUrl: `https://bis.org/doc-${n}.pdf`,
    title: `Document ${n}`,
    discoveryUrl: 'https://bis.org',
    foundOnUrl: 'https://bis.org',
  };
}

const OK_RETRIEVAL: RetrievalResult = {
  ok: true,
  bytes: Buffer.from('%PDF-1.4\n' + 'x'.repeat(2000)),
  contentType: 'application/pdf',
  declaredMimeMismatch: false,
  artifactHash: 'a'.repeat(64),
  fileSizeBytes: 2000,
  resolutionChain: { discoveryUrl: 'https://bis.org', downloadUrl: 'https://bis.org/doc-1.pdf', resolvedArtifactUrl: 'https://bis.org/doc-1.pdf', redirectCount: 0 },
};
const FAILING_INSPECTION = {
  ok: true as const, normalizedText: 'x', pageCount: 1, substantiveTextCharacters: 5,
  blankPageRatio: 0, extractionWarnings: ['too short'], passesContentPresenceCheck: false,
};
const QUALIFYING_INSPECTION = {
  ok: true as const, normalizedText: 'substantive '.repeat(200), pageCount: 3,
  substantiveTextCharacters: 2400, blankPageRatio: 0, extractionWarnings: [], passesContentPresenceCheck: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeDeps(overrides: Partial<VerificationDeps> = {}): VerificationDeps {
  const discovery: InstitutionDiscoveryResult = { ok: true, pagesFetched: 1, candidates: [candidate(1), candidate(2), candidate(3)] };
  return {
    followRedirects: async (url: string) => ({ ok: true, response: fakeResponse(200), finalUrl: url, redirectCount: 0 }),
    runInstitutionDiscovery: async () => discovery,
    retrieveArtifact: async () => OK_RETRIEVAL,
    inspectArtifact: async () => QUALIFYING_INSPECTION,
    ...overrides,
  };
}

const KEY = { domain: 'financial-services', pillarKey: 'multilateral', institutionName: 'BIS' };

function seedRatifiedRow(fakeTables: ReturnType<typeof createFakeSupabase>['tables'], overrides: Record<string, unknown> = {}) {
  fakeTables.corpus_institutional_registry = [{
    domain: KEY.domain, pillar_key: KEY.pillarKey, institution_name: KEY.institutionName,
    status: 'ratified', verification_status: 'proposed', seed_url: 'https://bis.org',
    verification_progress: null,
    ...overrides,
  }];
}

function readRow(fakeTables: ReturnType<typeof createFakeSupabase>['tables']) {
  return fakeTables.corpus_institutional_registry![0] as Record<string, unknown>;
}

describe('runVerificationStep — one bounded phase per call', () => {
  let fakeAdmin: ReturnType<typeof createFakeSupabase>['admin'];
  let fakeTables: ReturnType<typeof createFakeSupabase>['tables'];

  beforeEach(() => {
    const fake = createFakeSupabase();
    fakeAdmin = fake.admin;
    fakeTables = fake.tables;
    seedRatifiedRow(fakeTables);
  });

  it('call 1: resolve-seed only — advances to discover-candidates, persists progress, never touches discovery/retrieval', async () => {
    let discoveryCalled = false;
    const deps = makeDeps({ runInstitutionDiscovery: async () => { discoveryCalled = true; return { ok: true, pagesFetched: 1, candidates: [] }; } });
    const result = await runVerificationStep(fakeAdmin as never, KEY, deps);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe('in-progress');
    expect(discoveryCalled).toBe(false); // the NEXT call's job, not this one's

    const row = readRow(fakeTables);
    expect(row.verification_status).toBe('pending_verification');
    expect((row.verification_progress as { phase: string }).phase).toBe('discover-candidates');
    expect((row.verification_progress as { resolvedUrl: string }).resolvedUrl).toBe('https://bis.org');
  });

  it('call 2 (resuming from call 1): discover-candidates only — advances to fetch-document with candidates persisted', async () => {
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    expect((readRow(fakeTables).verification_progress as { phase: string }).phase).toBe('discover-candidates');

    let retrieveCalled = false;
    const result = await runVerificationStep(fakeAdmin as never, KEY, makeDeps({ retrieveArtifact: async () => { retrieveCalled = true; return OK_RETRIEVAL; } }));
    expect(result.ok && result.status).toBe('in-progress');
    expect(retrieveCalled).toBe(false); // fetch-document is the NEXT call's job

    const row = readRow(fakeTables);
    const progress = row.verification_progress as { phase: string; candidates: unknown[]; candidateIndex: number; candidatesFound: number };
    expect(progress.phase).toBe('fetch-document');
    expect(progress.candidates).toHaveLength(3);
    expect(progress.candidateIndex).toBe(0);
    expect(progress.candidatesFound).toBe(3);
  });

  it('call 3: fetch-document finds a qualifying document on the FIRST candidate — terminal "verified", progress cleared', async () => {
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    const result = await runVerificationStep(fakeAdmin as never, KEY, makeDeps());

    expect(result.ok).toBe(true);
    if (result.ok && result.status !== 'in-progress') {
      expect(result.status).toBe('verified');
      expect(result.outcome.qualifyingDocuments).toHaveLength(1);
      expect(result.outcome.documentsInspected).toBe(1);
      expect(result.outcome.candidatesFound).toBe(3);
    }

    const row = readRow(fakeTables);
    expect(row.verification_status).toBe('verified');
    expect(row.verification_progress).toBeNull(); // cleared — no run in flight any more
  });

  it('a non-qualifying candidate advances the cursor to the next one, staying in-progress — never jumps straight to terminal', async () => {
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    // Candidate 0 fails the standard.
    const result = await runVerificationStep(fakeAdmin as never, KEY, makeDeps({ inspectArtifact: async () => FAILING_INSPECTION }));
    expect(result.ok && result.status).toBe('in-progress');
    const progress = readRow(fakeTables).verification_progress as { candidateIndex: number; documentsInspected: number };
    expect(progress.candidateIndex).toBe(1);
    expect(progress.documentsInspected).toBe(1);
  });

  it('all candidates exhausted with none qualifying — terminal "insufficient_corpus", documentsInspected matches attempts', async () => {
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps()); // resolve
    await runVerificationStep(fakeAdmin as never, KEY, makeDeps()); // discover -> 3 candidates
    const failing = makeDeps({ inspectArtifact: async () => FAILING_INSPECTION });
    await runVerificationStep(fakeAdmin as never, KEY, failing); // candidate 0
    await runVerificationStep(fakeAdmin as never, KEY, failing); // candidate 1
    await runVerificationStep(fakeAdmin as never, KEY, failing); // candidate 2 — last, still in-progress (cursor -> 3)
    const result = await runVerificationStep(fakeAdmin as never, KEY, failing); // cursor >= length — terminal

    expect(result.ok).toBe(true);
    if (result.ok && result.status !== 'in-progress') {
      expect(result.status).toBe('insufficient_corpus');
      expect(result.outcome.documentsInspected).toBe(3);
    }
    expect(readRow(fakeTables).verification_progress).toBeNull();
  });

  // ── THE DEADLINE RACE — the actual wall-clock granularity fix ───────────
  it('THE LIVE FIX: an external operation that exceeds the internal deadline returns in-progress at the SAME phase/cursor — never an empty 504', async () => {
    const slowDeps = makeDeps({
      followRedirects: async (url: string) => { await sleep(200); return { ok: true, response: fakeResponse(200), finalUrl: url, redirectCount: 0 }; },
    });
    const start = Date.now();
    const result = await runVerificationStep(fakeAdmin as never, KEY, slowDeps, 30); // 30ms deadline, work takes 200ms
    const wallClock = Date.now() - start;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('in-progress');
      expect(result.diagnostics.phase).toBe('resolve-seed'); // unchanged — never skipped
      expect(result.diagnostics.elapsedMs).toBeGreaterThanOrEqual(30);
    }
    // The REQUEST itself returned close to the deadline, not the 200ms the
    // slow work actually needed — this IS the bound the operator required.
    expect(wallClock).toBeLessThan(150);
    // Never advanced past resolve-seed — the row still shows it starting.
    const row = readRow(fakeTables);
    expect((row.verification_progress as { phase: string }).phase).toBe('resolve-seed');
  });

  it('a healthy institution never engages the deadline race at all — completes well inside VERIFICATION_STEP_DEADLINE_MS', async () => {
    const start = Date.now();
    const result = await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    const wallClock = Date.now() - start;
    expect(result.ok && result.status).toBe('in-progress');
    expect(wallClock).toBeLessThan(VERIFICATION_STEP_DEADLINE_MS);
  });

  // ── DIAGNOSTICS — the exact shape the operator asked for ────────────────
  it('every response carries institution/phase/cursor/elapsedMs/externalCallsAttempted', async () => {
    const result = await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagnostics).toMatchObject({
        institutionName: 'BIS', phase: 'resolve-seed', cursor: 0, externalCallsAttempted: 1,
      });
      expect(typeof result.diagnostics.elapsedMs).toBe('number');
    }
  });

  // ── EXCEPTION ISOLATION — a terminal failure for BIS is durable and
  // independent of any other institution's own row/progress.
  it('a resolve failure (dead seed URL) terminates as verification_failed WITHOUT ever touching discovery/retrieval, and is isolated to this row', async () => {
    const deps = makeDeps({ followRedirects: async () => ({ ok: false, failureClass: 'unknown' as const, redirectCount: 0, finalUrl: 'https://bis.org' }) });
    const result = await runVerificationStep(fakeAdmin as never, KEY, deps);
    expect(result.ok).toBe(true);
    if (result.ok && result.status !== 'in-progress') expect(result.status).toBe('verification_failed');
    expect(readRow(fakeTables).verification_status).toBe('verification_failed');
  });

  it('progress persists across calls for TWO institutions independently — one row never clobbers the other', async () => {
    const KEY_B = { domain: 'financial-services', pillarKey: 'multilateral', institutionName: 'IMF' };
    fakeTables.corpus_institutional_registry!.push({
      domain: KEY_B.domain, pillar_key: KEY_B.pillarKey, institution_name: KEY_B.institutionName,
      status: 'ratified', verification_status: 'proposed', seed_url: 'https://imf.org', verification_progress: null,
    });

    await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    await runVerificationStep(fakeAdmin as never, KEY_B, makeDeps());

    const rows = fakeTables.corpus_institutional_registry as Record<string, unknown>[];
    const bis = rows.find((r) => r.institution_name === 'BIS')!;
    const imf = rows.find((r) => r.institution_name === 'IMF')!;
    expect((bis.verification_progress as { resolvedUrl: string }).resolvedUrl).toBe('https://bis.org');
    expect((imf.verification_progress as { resolvedUrl: string }).resolvedUrl).toBe('https://imf.org');
  });

  it('resuming an ALREADY-pending_verification row with existing progress does NOT re-resolve or re-discover — jumps straight to the persisted phase', async () => {
    seedRatifiedRow(fakeTables, {
      verification_status: 'pending_verification',
      verification_progress: {
        phase: 'fetch-document', seedUrl: 'https://bis.org', resolvedUrl: 'https://bis.org',
        candidates: [candidate(1)], candidateIndex: 0, candidatesFound: 1, documentsInspected: 0,
        startedAt: '2026-08-31T00:00:00.000Z',
      },
    });
    let resolveCalled = false;
    let discoverCalled = false;
    const deps = makeDeps({
      followRedirects: async (url: string) => { resolveCalled = true; return { ok: true, response: fakeResponse(200), finalUrl: url, redirectCount: 0 }; },
      runInstitutionDiscovery: async () => { discoverCalled = true; return { ok: true, pagesFetched: 1, candidates: [] }; },
    });
    const result = await runVerificationStep(fakeAdmin as never, KEY, deps);
    expect(resolveCalled).toBe(false);
    expect(discoverCalled).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok && result.status !== 'in-progress') expect(result.status).toBe('verified');
  });

  it('refuses to start from a non-startable status (e.g. "deprecated") — never silently proceeds', async () => {
    seedRatifiedRow(fakeTables, { verification_status: 'deprecated', verification_progress: null });
    const result = await runVerificationStep(fakeAdmin as never, KEY, makeDeps());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/deprecated/);
  });
});
