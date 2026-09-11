/**
 * Corpus Scout (PRD-ICA-001) Ingestion Broker canaries — the ONLY module that
 * calls `addEvidence` (§6, §10 agent J).
 *
 * Pins:
 *   1. Refusal when reviewWorkflowStatus is not an approved value.
 *   2. Refusal when evidence_row_id is already set (no double-ingest, §17).
 *   3. Refusal when provenanceClass / artifactHash / normalizedText are missing.
 *   4. A >200,000-char normalizedText is CHUNKED into multiple addEvidence
 *      calls, never truncated (§6).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/services/invariants/discoveryEngine', () => ({
  addEvidence: vi.fn(),
}));
vi.mock('@/services/corpusScout/provenance', () => ({
  getCandidateSource: vi.fn(),
}));

import { addEvidence } from '@/services/invariants/discoveryEngine';
import { getCandidateSource } from '@/services/corpusScout/provenance';
import { ingestApprovedSource, chunkNormalizedText } from '@/services/corpusScout/ingestionBroker';
import type { CandidateSourceRow } from '@/services/corpusScout/types';

const mockedAddEvidence = vi.mocked(addEvidence);
const mockedGetCandidateSource = vi.mocked(getCandidateSource);

function baseCandidate(overrides: Partial<CandidateSourceRow> = {}): CandidateSourceRow {
  return {
    id: 'row-1',
    sourceId: 'SRC-test-0000000000',
    campaignDomain: 'constitutional-reasoning',
    campaignSubDomain: null,
    title: 'Test Source',
    issuer: null,
    authors: [],
    publicationDate: null,
    retrievedAt: new Date().toISOString(),
    canonicalUrl: 'https://example.com/doc.pdf',
    artifactHash: 'a'.repeat(64),
    normalizedTextHash: 'b'.repeat(64),
    mimeType: 'application/pdf',
    fileSizeBytes: 12345,
    pageCount: 10,
    licenseStatus: 'unknown',
    provenanceClass: 'external-established',
    reviewWorkflowStatus: 'approved_exp_p1',
    acquisitionMethod: 'direct-url',
    resolutionChain: {
      discoveryUrl: 'https://example.com/doc.pdf',
      downloadUrl: 'https://example.com/doc.pdf',
      resolvedArtifactUrl: 'https://example.com/doc.pdf',
      redirectCount: 0,
    },
    extractionStatus: 'ok',
    normalizedText: 'Substantive content. '.repeat(500),
    extractionWarnings: [],
    duplicateOfSourceId: null,
    humanReviewNotes: null,
    evidenceRowId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockAdmin(): SupabaseClient {
  return {
    from: () => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('chunkNormalizedText — never truncates', () => {
  it('leaves text at or under the 200,000-char cap as a single chunk', () => {
    const text = 'x'.repeat(200_000);
    expect(chunkNormalizedText(text)).toEqual([text]);
  });

  it('splits text over the cap into multiple chunks that reassemble losslessly', () => {
    const text = 'y'.repeat(450_000);
    const chunks = chunkNormalizedText(text);
    expect(chunks.length).toBe(3);
    expect(chunks.every((c) => c.length <= 200_000)).toBe(true);
    expect(chunks.join('')).toBe(text);
  });
});

describe('ingestApprovedSource — refusal gates (PRD-ICA-001 §6, §11, §17)', () => {
  beforeEach(() => {
    mockedAddEvidence.mockReset();
    mockedGetCandidateSource.mockReset();
  });

  it('refuses when reviewWorkflowStatus is pending_review (not yet approved)', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ reviewWorkflowStatus: 'pending_review' }));
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reviewWorkflowStatus/);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });

  it('refuses a rejected source even though it carries a normalizedText', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ reviewWorkflowStatus: 'rejected_low_substance' }));
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');
    expect(result.ok).toBe(false);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });

  it('refuses when evidence_row_id is already set — no double-ingest', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ evidenceRowId: 'evidence-row-existing' }));
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already ingested/);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });

  it('refuses when provenanceClass is not set', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ provenanceClass: null }));
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/provenanceClass/);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });

  it('refuses when artifactHash is missing (source never byte-verified)', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ artifactHash: null }));
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/artifactHash/);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });

  it('refuses when normalizedText is empty', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ normalizedText: '' }));
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/normalizedText/);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });

  it('refuses when the candidate source cannot be found', async () => {
    mockedGetCandidateSource.mockResolvedValue(null);
    const result = await ingestApprovedSource(mockAdmin(), 'SRC-missing', 'persona-1');
    expect(result.ok).toBe(false);
    expect(mockedAddEvidence).not.toHaveBeenCalled();
  });
});

describe('ingestApprovedSource — chunking a large artifact (PRD-ICA-001 §6)', () => {
  beforeEach(() => {
    mockedAddEvidence.mockReset();
    mockedGetCandidateSource.mockReset();
  });

  it('chunks a >200,000-char normalizedText into multiple addEvidence calls, never truncating', async () => {
    const longText = 'z'.repeat(450_000);
    mockedGetCandidateSource.mockResolvedValue(baseCandidate({ normalizedText: longText }));
    mockedAddEvidence
      .mockResolvedValueOnce({ ok: true, id: 'ev-1' })
      .mockResolvedValueOnce({ ok: true, id: 'ev-2' })
      .mockResolvedValueOnce({ ok: true, id: 'ev-3' });

    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');

    expect(mockedAddEvidence).toHaveBeenCalledTimes(3);
    const callContents = mockedAddEvidence.mock.calls.map((args) => (args[1] as { content: string }).content);
    expect(callContents.every((c) => c.length <= 200_000)).toBe(true);
    // Reassembled chunks equal the original text exactly — nothing truncated.
    expect(callContents.join('')).toBe(longText);
    expect(result.ok).toBe(true);
    expect(result.evidenceRowId).toBe('ev-1');
  });

  it('ingests a single-chunk approved source and threads domain/sourceRef/personaId through', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate());
    mockedAddEvidence.mockResolvedValueOnce({ ok: true, id: 'ev-only' });

    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');

    expect(result.ok).toBe(true);
    expect(result.evidenceRowId).toBe('ev-only');
    expect(mockedAddEvidence).toHaveBeenCalledTimes(1);
    expect(mockedAddEvidence.mock.calls[0][1]).toMatchObject({
      domain: 'constitutional-reasoning',
      sourceRef: 'https://example.com/doc.pdf',
      personaId: 'persona-1',
    });
  });

  it('surfaces an add-evidence failure without pretending the source was ingested', async () => {
    mockedGetCandidateSource.mockResolvedValue(baseCandidate());
    mockedAddEvidence.mockResolvedValueOnce({ ok: false, error: 'db insert failed' });

    const result = await ingestApprovedSource(mockAdmin(), 'SRC-x', 'persona-1');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/add-evidence failed/);
  });
});
