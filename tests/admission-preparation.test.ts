/**
 * `services/corpusScout/admissionPreparation.ts` — the SHARED preparation
 * computation extracted from `prepare-recommendations/route.ts` (2026-08-31,
 * "Review & Admit machine-preparation" repair).
 *
 * Pins:
 *   1. It calls the SAME collaborators the route's original inline body
 *      called — no parallel implementation (inv.engineering.036/037).
 *   2. EXCEPTION ISOLATION — the behavioural addition over the original
 *      inline version: one source whose recommendation computation throws
 *      yields a `manual review required` entry naming the failure, and every
 *      OTHER pending source is computed normally, never withheld.
 *   3. An empty pending queue short-circuits before the lineage read (no
 *      wasted DB call) and returns clean empty structures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListCandidateSources = vi.fn();
vi.mock('@/services/corpusScout/provenance', () => ({
  listCandidateSources: (...args: any[]) => mockListCandidateSources(...args),
}));

const mockBuildDomainLineageIndex = vi.fn();
const mockDeriveSourceLineage = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  buildDomainLineageIndex: (...args: any[]) => mockBuildDomainLineageIndex(...args),
  deriveSourceLineage: (...args: any[]) => mockDeriveSourceLineage(...args),
}));

const mockFindRegistryEntry = vi.fn();
vi.mock('@/services/corpusScout/institutionalRegistry', () => ({
  findRegistryEntry: (...args: any[]) => mockFindRegistryEntry(...args),
}));

const mockComposeAdmissionRecommendation = vi.fn();
vi.mock('@/services/corpusScout/admissionRecommendation', () => ({
  composeAdmissionRecommendation: (...args: any[]) => mockComposeAdmissionRecommendation(...args),
}));

import { prepareAdmissionRecommendations } from '@/services/corpusScout/admissionPreparation';

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    sourceId: 'SRC-a',
    campaignDomain: 'financial-services',
    campaignSubDomain: 'banking',
    title: 'A report',
    issuer: 'BIS',
    canonicalUrl: 'https://bis.org/a.pdf',
    artifactHash: 'a'.repeat(64),
    normalizedTextHash: 'h1',
    publicationDate: '2026-01-01',
    authors: ['A'],
    extractionStatus: 'ok' as const,
    extractionWarnings: [] as string[],
    structuralTags: [] as string[],
    licenseStatus: 'unknown',
    reviewWorkflowStatus: 'pending_review' as const,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const admin = {} as any;

beforeEach(() => {
  mockListCandidateSources.mockReset();
  mockBuildDomainLineageIndex.mockReset();
  mockDeriveSourceLineage.mockReset();
  mockDeriveSourceLineage.mockReturnValue([]);
  mockFindRegistryEntry.mockReset();
  mockFindRegistryEntry.mockReturnValue(null);
  mockComposeAdmissionRecommendation.mockReset();
});

describe('prepareAdmissionRecommendations — empty queue short-circuits', () => {
  it('returns clean empty structures and never reads corpus lineage when nothing is pending', async () => {
    mockListCandidateSources.mockResolvedValue([]);
    const result = await prepareAdmissionRecommendations(admin, 'financial-services');
    expect(result).toEqual({
      recommendations: [],
      duplicateGroups: [],
      duplicateResolutions: [],
      duplicateDryRun: expect.objectContaining({ duplicateRecords: 0, canonicalRetained: 0 }),
    });
    expect(mockBuildDomainLineageIndex).not.toHaveBeenCalled();
  });
});

describe('prepareAdmissionRecommendations — exception isolation (2026-08-31)', () => {
  it('a thrown recommendation for ONE source never withholds the others — the batch still returns one entry per pending source', async () => {
    const rows = [candidateRow({ sourceId: 'SRC-good-1' }), candidateRow({ sourceId: 'SRC-bad' }), candidateRow({ sourceId: 'SRC-good-2' })];
    mockListCandidateSources.mockResolvedValue(rows);
    mockBuildDomainLineageIndex.mockResolvedValue({});
    mockComposeAdmissionRecommendation.mockImplementation(({ source }: { source: { sourceId: string } }) => {
      if (source.sourceId === 'SRC-bad') throw new Error('lineage lookup exploded');
      return { sourceId: source.sourceId, admissionClass: 'general finance', disposition: 'ready', warnings: [] };
    });

    const result = await prepareAdmissionRecommendations(admin, 'financial-services');

    expect(result.recommendations).toHaveLength(3);
    const good1 = result.recommendations.find((r) => r.sourceId === 'SRC-good-1');
    const good2 = result.recommendations.find((r) => r.sourceId === 'SRC-good-2');
    const bad = result.recommendations.find((r) => r.sourceId === 'SRC-bad');

    // Unaffected sources are computed EXACTLY as the (mocked) pure function
    // returned them — the failure next door changes nothing about them.
    expect(good1).toMatchObject({ admissionClass: 'general finance', disposition: 'ready' });
    expect(good2).toMatchObject({ admissionClass: 'general finance', disposition: 'ready' });

    // The failed source is ISOLATED, not thrown: a real, inspectable entry —
    // never an admission (never `reviewDecision` set), never silently dropped.
    expect(bad).toBeDefined();
    expect(bad!.admissionClass).toBe('manual review required');
    expect(bad!.reviewDecision).toBeNull();
    expect(bad!.disposition).toBe('exception');
    expect(bad!.warnings.join(' ')).toMatch(/lineage lookup exploded/);
    expect(bad!.exception).toBeDefined();
    expect(bad!.exception!.blocksCurrentStage).toBe(false);
  });

  it('a non-Error thrown value is still isolated and stringified into the warning, never propagated as a raw object', async () => {
    mockListCandidateSources.mockResolvedValue([candidateRow({ sourceId: 'SRC-weird' })]);
    mockBuildDomainLineageIndex.mockResolvedValue({});
    mockComposeAdmissionRecommendation.mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'a string, not an Error';
    });

    const result = await prepareAdmissionRecommendations(admin, 'financial-services');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].admissionClass).toBe('manual review required');
    expect(result.recommendations[0].warnings.join(' ')).toMatch(/a string, not an Error/);
  });
});

describe('prepareAdmissionRecommendations — reuses the EXISTING collaborators, never a parallel implementation', () => {
  it('computes duplicate groups over the SAME pending batch and passes isDuplicate through to composeAdmissionRecommendation', async () => {
    const rows = [
      candidateRow({ sourceId: 'SRC-dup-1', artifactHash: 'x'.repeat(64), canonicalUrl: 'https://bis.org/dup.pdf', normalizedTextHash: 'dup-text' }),
      candidateRow({ sourceId: 'SRC-dup-2', artifactHash: 'x'.repeat(64), canonicalUrl: 'https://bis.org/dup-mirror.pdf', normalizedTextHash: 'dup-text-2' }),
      candidateRow({ sourceId: 'SRC-unique', artifactHash: 'y'.repeat(64), canonicalUrl: 'https://bis.org/unique.pdf', normalizedTextHash: 'unique-text' }),
    ];
    mockListCandidateSources.mockResolvedValue(rows);
    mockBuildDomainLineageIndex.mockResolvedValue({});
    mockComposeAdmissionRecommendation.mockImplementation(({ source }: { source: { sourceId: string; isDuplicate: boolean } }) => ({
      sourceId: source.sourceId,
      admissionClass: source.isDuplicate ? 'manual review required' : 'general finance',
      disposition: source.isDuplicate ? 'exception' : 'ready',
      warnings: [],
    }));

    const result = await prepareAdmissionRecommendations(admin, 'financial-services');

    expect(result.duplicateGroups).toHaveLength(1);
    expect(new Set(result.duplicateGroups[0].sourceIds)).toEqual(new Set(['SRC-dup-1', 'SRC-dup-2']));
    expect(result.duplicateResolutions).toHaveLength(1);

    const dup1 = result.recommendations.find((r) => r.sourceId === 'SRC-dup-1')!;
    const unique = result.recommendations.find((r) => r.sourceId === 'SRC-unique')!;
    expect(dup1.admissionClass).toBe('manual review required');
    expect(unique.admissionClass).toBe('general finance');
  });
});
