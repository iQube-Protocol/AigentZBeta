/**
 * Track 2 EXP-P1 / Crystal v2 — cohort-level admission ratification
 * (2026-09-01). Reproduces the exact live narrative from the operator's
 * report: 34 admitted, 65 awaiting review, machine preparation classifying
 * 59 ready-with-warning + 6 manual-review exceptions (one exact-duplicate
 * group of six sharing an artifact hash), a Steward cohort ratification that
 * admits the 59 through the EXISTING `bulk-review` route in bounded
 * batches, and stale-cohort protection that fails closed when the prepared
 * cohort no longer matches what is about to be written.
 *
 * ── Reuse-first, not a parallel implementation ──────────────────────────────
 *
 * Every assertion below exercises REAL, already-shipped functions —
 * `composeAdmissionRecommendation`, `findDuplicateCandidates`,
 * `composeDuplicateResolution`, `eligibleAdmissionCohortIds`,
 * `resolvableDuplicateAliasIds`, `computeCohortHash` — never a re-derived
 * copy. Only I/O boundaries (Supabase reads, the ingestion broker, the
 * receipt writer) are mocked, mirroring `tests/admission-preparation.test.ts`
 * and `tests/track2-duplicate-pairs-merge-route.test.ts`'s own conventions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Fixture: the exact reported shape — 65 pending, 6 forming one
//    exact-duplicate group, 59 standalone. ───────────────────────────────────

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    sourceId: 'SRC-x',
    campaignDomain: 'financial-services',
    campaignSubDomain: 'financial-risk-value-systems',
    title: 'A report',
    issuer: 'Some Issuer',
    canonicalUrl: 'https://example.org/x.pdf',
    artifactHash: 'a'.repeat(64),
    normalizedTextHash: 'text-x',
    pageCount: 10,
    publicationDate: '2026-01-01',
    authors: ['A'],
    extractionStatus: 'ok' as const,
    extractionWarnings: [] as string[],
    structuralTags: [] as string[],
    licenseStatus: 'known',
    reviewWorkflowStatus: 'pending_review' as const,
    evidenceRowId: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** 59 standalone rows, each with a distinct artifact hash and no registry
 *  entry — `composeAdmissionRecommendation` recommends 'reference only' with
 *  the undeclared-tier warning, which is disposition 'ready-with-warning'
 *  (reviewTier 'needs-review' at confidence 0.8). */
function standaloneRows(count: number) {
  return Array.from({ length: count }, (_, i) => {
    // Fixed-width numeric suffix BEFORE padding, so e.g. "solo-001" is never
    // a string-prefix of "solo-010" once both are padEnd-64'd (a variable-
    // width suffix collides: "solo-1".padEnd(64,'0') === "solo-10"'s pad).
    const suffix = String(i + 1).padStart(3, '0');
    return candidateRow({
      sourceId: `SRC-solo-${i + 1}`,
      artifactHash: `solo-${suffix}`.padEnd(64, '0'),
      normalizedTextHash: `solo-text-${i + 1}`,
      canonicalUrl: `https://example.org/solo-${i + 1}.pdf`,
    });
  });
}

/** 6 rows sharing ONE artifact hash — an exact-duplicate group of six. */
function duplicateGroupRows() {
  const sharedHash = 'dup'.repeat(21) + 'd'; // 64 chars
  return Array.from({ length: 6 }, (_, i) =>
    candidateRow({
      sourceId: `SRC-dup-${i + 1}`,
      artifactHash: sharedHash,
      normalizedTextHash: `dup-text-${i + 1}`,
      canonicalUrl: `https://mirror-${i + 1}.example.org/same-doc.pdf`,
      createdAt: `2026-01-0${(i % 9) + 1}T00:00:00Z`,
    }),
  );
}

describe('Track 2 admission cohort — reproduces the exact reported narrative (pure composition)', () => {
  it('65 pending sources classify as 59 ready-with-warning + 6 exceptions, the 6 being exactly the duplicate group', async () => {
    const mockListCandidateSources = vi.fn().mockResolvedValue([...standaloneRows(59), ...duplicateGroupRows()]);
    vi.doMock('@/services/corpusScout/provenance', () => ({ listCandidateSources: mockListCandidateSources }));
    vi.doMock('@/services/invariants/discoveryEngine', () => ({
      buildDomainLineageIndex: vi.fn().mockResolvedValue({}),
      deriveSourceLineage: vi.fn().mockReturnValue([]),
    }));
    vi.doMock('@/services/corpusScout/institutionalRegistry', () => ({
      findRegistryEntry: vi.fn().mockReturnValue(null), // undeclared tier for every source
    }));
    vi.resetModules();

    const { prepareAdmissionRecommendations, eligibleAdmissionCohortIds, resolvableDuplicateAliasIds } = await import(
      '@/services/corpusScout/admissionPreparation'
    );
    const { computeCohortHash } = await import('@/services/research/cohortAuthorization');

    const prepared = await prepareAdmissionRecommendations({} as any, 'financial-services');

    expect(prepared.recommendations).toHaveLength(65);
    const eligibleIds = eligibleAdmissionCohortIds(prepared.recommendations);
    const exceptionIds = prepared.recommendations.filter((r) => r.disposition === 'exception').map((r) => r.sourceId);
    expect(eligibleIds).toHaveLength(59);
    expect(exceptionIds).toHaveLength(6);
    // The 6 exceptions are EXACTLY the duplicate group — never a different set.
    expect(new Set(exceptionIds)).toEqual(new Set(Array.from({ length: 6 }, (_, i) => `SRC-dup-${i + 1}`)));

    // One exact-duplicate group, six members, one deterministic recommendation.
    expect(prepared.duplicateGroups).toHaveLength(1);
    expect(prepared.duplicateGroups[0].sourceIds).toHaveLength(6);
    expect(prepared.duplicateResolutions).toHaveLength(1);
    expect(prepared.duplicateResolutions[0].kind).toBe('recommended-resolution-available');

    // Resolving retains EXACTLY one canonical; the other five are aliases —
    // never a delete, never more than one canonical.
    const aliasIds = resolvableDuplicateAliasIds(prepared.duplicateResolutions);
    expect(aliasIds).toHaveLength(5);
    expect(new Set(aliasIds).has(prepared.duplicateResolutions[0].canonicalSourceId!)).toBe(false);

    // The cohort hash is a real commitment over the real 59 ids — order-
    // independent, and it changes if even one id is added or removed.
    const hash = computeCohortHash(eligibleIds);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(computeCohortHash([...eligibleIds].reverse())).toBe(hash);
    expect(computeCohortHash(eligibleIds.slice(0, 58))).not.toBe(hash);
  });
});

describe('POST /api/corpus-scout/candidates/bulk-review — stale-cohort protection (2026-09-01)', () => {
  const mockGetActivePersona = vi.fn();
  const mockGetSupabaseServer = vi.fn();
  const mockGetCandidateSource = vi.fn();
  const mockApplyCandidateReviewDecision = vi.fn();
  const mockPrepareAdmissionRecommendations = vi.fn();
  const mockWriteLifecycleReceipt = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockGetActivePersona.mockReset().mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
    mockGetSupabaseServer.mockReset().mockReturnValue({});
    mockGetCandidateSource.mockReset().mockImplementation(async (_admin: unknown, sourceId: string) => ({
      sourceId,
      reviewWorkflowStatus: 'pending_review',
    }));
    mockApplyCandidateReviewDecision.mockReset().mockResolvedValue({
      ok: true,
      ingestion: { ok: true, evidenceRowId: 'EV-1' },
    });
    mockPrepareAdmissionRecommendations.mockReset();
    mockWriteLifecycleReceipt.mockReset().mockResolvedValue({ ok: true, receiptId: 'r-1' });

    vi.doMock('@/services/identity/getActivePersona', () => ({ getActivePersona: mockGetActivePersona }));
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: mockGetSupabaseServer }));
    vi.doMock('@/services/corpusScout/provenance', () => ({ getCandidateSource: mockGetCandidateSource }));
    vi.doMock('@/services/corpusScout/reviewDecision', () => ({
      applyCandidateReviewDecision: mockApplyCandidateReviewDecision,
      isReviewDecision: (v: unknown) => typeof v === 'string' && ['approve_exp_p1', 'approve_general_finance', 'approve_reference_only', 'mark_duplicate', 'reject_out_of_domain', 'reject_low_substance', 'reject_provenance', 'reject_access_or_license'].includes(v),
      DECISION_TO_STATUS: {
        approve_exp_p1: 'approved_exp_p1',
        approve_general_finance: 'approved_general_finance',
        approve_reference_only: 'approved_reference_only',
        mark_duplicate: 'duplicate',
        reject_out_of_domain: 'rejected_out_of_domain',
        reject_low_substance: 'rejected_low_substance',
        reject_provenance: 'rejected_provenance',
        reject_access_or_license: 'rejected_access_or_license',
      },
      INGESTING_DECISIONS: new Set(['approve_exp_p1', 'approve_general_finance', 'approve_reference_only']),
    }));
    vi.doMock('@/services/corpusScout/types', () => ({
      isProvenanceClass: (v: unknown) =>
        typeof v === 'string' &&
        ['external-established', 'external-empirical', 'platform-derived', 'platform-hypothesized', 'platform-doctrine'].includes(v),
    }));
    vi.doMock('@/services/research/lifecycle', () => ({ writeLifecycleReceipt: mockWriteLifecycleReceipt }));
    vi.doMock('@/services/identity/personaReferences', () => ({ personaPublicRef: (id: string) => `pub:${id}` }));
    vi.doMock('@/services/corpusScout/admissionPreparation', () => ({
      prepareAdmissionRecommendations: mockPrepareAdmissionRecommendations,
      eligibleAdmissionCohortIds: (recs: Array<{ disposition: string; sourceId: string }>) =>
        recs.filter((r) => r.disposition === 'ready' || r.disposition === 'ready-with-warning').map((r) => r.sourceId),
    }));
  });

  function makeRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest;
  }

  it('refuses to write when the corpus moved since preparation — a source in expectedCohortHash is no longer in the fresh eligible cohort', async () => {
    // The cohort SHOWN to the steward: SRC-1..SRC-3 eligible.
    const shownRecs = ['SRC-1', 'SRC-2', 'SRC-3'].map((id) => ({ sourceId: id, disposition: 'ready-with-warning' }));
    // By the time they click "Admit", SRC-3 was independently decided —
    // the FRESH read the route recomputes reflects only SRC-1/SRC-2.
    const freshRecs = ['SRC-1', 'SRC-2'].map((id) => ({ sourceId: id, disposition: 'ready-with-warning' }));
    mockPrepareAdmissionRecommendations.mockResolvedValue({ recommendations: freshRecs, duplicateGroups: [], duplicateResolutions: [], duplicateDryRun: {} });

    const { computeCohortHash } = await import('@/services/research/cohortAuthorization');
    const shownHash = computeCohortHash(shownRecs.map((r) => r.sourceId));

    const { POST } = await import('@/app/api/corpus-scout/candidates/bulk-review/route');
    const res = await POST(
      makeRequest({
        sourceIds: ['SRC-1', 'SRC-2', 'SRC-3'],
        decision: 'approve_general_finance',
        notes: 'cohort ratification',
        provenanceClass: 'external-established',
        dryRun: false,
        campaignDomain: 'financial-services',
        expectedCohortHash: shownHash,
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('recommendation-set-changed');
    // FAILS CLOSED — nothing was written for ANY source in the stale batch,
    // not even the two that are still genuinely eligible.
    expect(mockApplyCandidateReviewDecision).not.toHaveBeenCalled();
  });

  it('writes normally when the fresh cohort still matches expectedCohortHash', async () => {
    const recs = ['SRC-1', 'SRC-2'].map((id) => ({ sourceId: id, disposition: 'ready-with-warning' }));
    mockPrepareAdmissionRecommendations.mockResolvedValue({ recommendations: recs, duplicateGroups: [], duplicateResolutions: [], duplicateDryRun: {} });

    const { computeCohortHash } = await import('@/services/research/cohortAuthorization');
    const hash = computeCohortHash(['SRC-1', 'SRC-2']);

    const { POST } = await import('@/app/api/corpus-scout/candidates/bulk-review/route');
    const res = await POST(
      makeRequest({
        sourceIds: ['SRC-1', 'SRC-2'],
        decision: 'approve_general_finance',
        notes: 'cohort ratification',
        provenanceClass: 'external-established',
        dryRun: false,
        campaignDomain: 'financial-services',
        expectedCohortHash: hash,
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockApplyCandidateReviewDecision).toHaveBeenCalledTimes(2);
  });

  it('skips the check entirely when expectedCohortHash is omitted — every existing caller (manual per-source decisions, targeted rejections) is unaffected', async () => {
    const { POST } = await import('@/app/api/corpus-scout/candidates/bulk-review/route');
    const res = await POST(
      makeRequest({
        sourceIds: ['SRC-9'],
        decision: 'reject_low_substance',
        notes: 'manual rejection, no cohort involved',
        dryRun: false,
      }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockPrepareAdmissionRecommendations).not.toHaveBeenCalled();
    expect(mockApplyCandidateReviewDecision).toHaveBeenCalledTimes(1);
  });

  it('never checks staleness on a dry run — a stale preview is uninformative, not a write to fail closed on', async () => {
    const recs = ['SRC-1'].map((id) => ({ sourceId: id, disposition: 'ready-with-warning' }));
    mockPrepareAdmissionRecommendations.mockResolvedValue({ recommendations: recs, duplicateGroups: [], duplicateResolutions: [], duplicateDryRun: {} });
    const { POST } = await import('@/app/api/corpus-scout/candidates/bulk-review/route');
    const res = await POST(
      makeRequest({
        sourceIds: ['SRC-1', 'SRC-2'],
        decision: 'approve_general_finance',
        provenanceClass: 'external-established',
        dryRun: true,
        campaignDomain: 'financial-services',
        expectedCohortHash: 'definitely-stale-hash',
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.dryRun).toBe(true);
  });
});

describe('Population scope labeling — never "Full population" for a scoped subset (2026-09-01)', () => {
  it('the acquisition-round scope and the cumulative-programme scope render distinct labels', async () => {
    const { populationScopeLabel } = await import('@/services/research/exceptionIsolation');
    expect(populationScopeLabel('current-acquisition-round')).toBe('Current acquisition round —');
    expect(populationScopeLabel('cumulative-programme')).toBe('Cumulative EXP-P1 / Crystal v2 —');
    expect(populationScopeLabel('current-acquisition-round')).not.toBe(populationScopeLabel('cumulative-programme'));
    // Undeclared/legacy callers get a neutral label, never the overclaiming
    // "Full population" this whole repair removes.
    expect(populationScopeLabel(undefined)).not.toMatch(/full population/i);
  });

  it('resolveTrack2Population (the freeze package\'s ONE all-eight-real-counts computation) declares itself cumulative-programme in source — never left to drift silently unlabeled', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource('services/research/track2Population.ts'));
    expect(src).toMatch(/scope:\s*'cumulative-programme'/);
  });

  it('the corpus-scout Stage 2 routes (prepare-recommendations, resolve-duplicates) declare current-acquisition-round — never claim to be the cumulative view', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    for (const route of [
      'app/api/corpus-scout/candidates/prepare-recommendations/route.ts',
      'app/api/corpus-scout/candidates/resolve-duplicates/route.ts',
    ]) {
      const src = stripComments(readSource(route));
      expect(src, `${route} should scope its population as current-acquisition-round`).toMatch(/scope:\s*'current-acquisition-round'/);
    }
  });

  it('Track2ProgrammePanel renders the SCOPE-DERIVED label, not a hardcoded "Full population —"', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource('components/research/Track2ProgrammePanel.tsx'));
    expect(src).not.toMatch(/Full population —/);
    expect(src).toMatch(/populationScopeLabel\(population\.scope\)/);
  });
});

describe('Research Copilot — "Admit eligible sources" is a real cohort action, not a deep-link (2026-09-01)', () => {
  const PANEL = 'components/composer/IRLResearchCopilotTab.tsx';

  it('the eligible-cohort filter matches the shared definition exactly — ready OR ready-with-warning, never including the manual-review exceptions', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/r\.disposition === "ready" \|\| r\.disposition === "ready-with-warning"/);
  });

  it('the button is gated on BOTH a chosen provenance class and a non-empty rationale — no silent default', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/disabled=\{admitRunning \|\| !admitProvenanceClass \|\| !admitRationale\.trim\(\)\}/);
  });

  it('the write echoes decision.admissionCohortHash as expectedCohortHash — the client cannot admit against a stale prepared cohort', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/expectedCohortHash:\s*decision\.admissionCohortHash/);
  });

  it('batches through the EXISTING bulk-review route via partitionForExecution — never a second batching scheme or a raw single POST of the whole cohort', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/partitionForExecution\(sourceIds\)/);
    expect(src).toMatch(/\/api\/corpus-scout\/candidates\/bulk-review/);
  });

  it('a stale-cohort refusal (recommendation-set-changed) stops the WHOLE act rather than admitting a partial cohort under a stale premise', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/data\?\.error === "recommendation-set-changed"/);
    expect(src).toMatch(/staleCohort = true/);
  });

  it('on success it calls the SAME runProgramme "Run until you need me" continuation resolveDeterministicDuplicates already uses — the operator never has to manually restart the loop', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const admitAt = src.indexOf('const admitEligibleCohort = useCallback');
    const nextFnAt = src.indexOf('const submitReviewDecision = useCallback');
    expect(admitAt).toBeGreaterThan(-1);
    expect(nextFnAt).toBeGreaterThan(admitAt);
    const body = src.slice(admitAt, nextFnAt);
    expect(body).toMatch(/await runProgramme\(decision\.deepLink\.experimentId\)/);
  });
});
