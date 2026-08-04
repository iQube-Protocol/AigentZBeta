/**
 * services/invariants/provenanceSuggestion.ts (operator direction,
 * 2026-08-05: "the steward should never begin with a blank form when the
 * substrate can derive a reasonable proposal"). A SUGGESTION engine — never
 * writes a class, never invents a source. These tests lock in the defensive
 * validation, since an accepted suggestion becomes a real classification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallSovereign = vi.fn();
vi.mock('@/services/constitutional/modelRouter', () => ({
  callSovereign: (...args: any[]) => mockCallSovereign(...args),
}));

import { suggestProvenanceClass } from '@/services/invariants/provenanceSuggestion';

const CANDIDATE = { id: 'inv-1', statement: 'Robust cybersecurity measures are critical for financial services.' };

function classificationSuggestionWith(sources: Array<Partial<{ sourceRef: string; candidateTitle: string | null; issuer: string | null; recordedProvenanceClass: string | null; evidenceIds: string[]; evidenceTitles: string[]; reviewNotes: string | null; seedInstitution: string | null; seedClaim: string | null }>>) {
  return {
    invariantId: CANDIDATE.id,
    evidenceIdCount: sources.length,
    resolvedEvidenceCount: sources.length,
    unresolvedEvidenceIds: [],
    evidenceIdsWithoutSourceRef: [],
    sources: sources.map((s) => ({
      sourceRef: s.sourceRef ?? 'https://example.test/doc',
      evidenceIds: s.evidenceIds ?? ['e1'],
      evidenceTitles: s.evidenceTitles ?? [],
      candidateTitle: s.candidateTitle ?? null,
      issuer: s.issuer ?? null,
      recordedProvenanceClass: (s.recordedProvenanceClass as any) ?? null,
      reviewNotes: s.reviewNotes ?? null,
      seedInstitution: s.seedInstitution ?? null,
      seedClaim: s.seedClaim ?? null,
    })),
    suggestedEvidenceRefs: sources.map((s) => s.sourceRef ?? 'https://example.test/doc'),
    suggestedRationale: '',
    complete: true,
    notes: [],
  };
}

beforeEach(() => {
  mockCallSovereign.mockReset();
});

describe('suggestProvenanceClass — no evidence to reason from', () => {
  it('returns suggestion:null and never calls the model when there are no resolved sources', async () => {
    const result = await suggestProvenanceClass(CANDIDATE, classificationSuggestionWith([]));
    expect(result).toEqual({ ok: true, suggestion: null });
    expect(mockCallSovereign).not.toHaveBeenCalled();
  });
});

describe('suggestProvenanceClass — happy path', () => {
  it('returns a validated suggestion drawn from the resolved sources', async () => {
    const resolved = classificationSuggestionWith([
      { sourceRef: 'https://nist.gov/csf', candidateTitle: 'NIST Cybersecurity Framework' },
      { sourceRef: 'https://fatf-gafi.org/rec15', candidateTitle: 'FATF Recommendation 15' },
    ]);
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        suggestedClass: 'external-established',
        confidence: 97,
        primarySource: 'https://nist.gov/csf',
        supportingSources: ['https://fatf-gafi.org/rec15'],
        reason: 'Both are established external standards bodies.',
      }),
    });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion).toMatchObject({
      suggestedClass: 'external-established',
      confidence: 97,
      primarySource: 'https://nist.gov/csf',
      supportingSources: ['https://fatf-gafi.org/rec15'],
    });
  });
});

describe('suggestProvenanceClass — defensive validation (this becomes a real classification)', () => {
  const resolved = classificationSuggestionWith([{ sourceRef: 'https://real.test/a' }]);

  it('refuses when the model proposes a class outside the five real values', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestedClass: 'made-up-class', confidence: 90, primarySource: null, supportingSources: [], reason: 'x' }),
    });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(false);
  });

  it('drops a primarySource that was not among the resolved sources, rather than passing it through', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        suggestedClass: 'external-established',
        confidence: 90,
        primarySource: 'https://hallucinated.test/fake',
        supportingSources: [],
        reason: 'x',
      }),
    });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestion?.primarySource).toBeNull();
  });

  it('drops a supportingSource that was not among the resolved sources', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        suggestedClass: 'external-established',
        confidence: 90,
        primarySource: 'https://real.test/a',
        supportingSources: ['https://hallucinated.test/fake', 'https://real.test/a'],
        reason: 'x',
      }),
    });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(true);
    // the hallucinated ref is dropped, and the primary source is never duplicated into supporting
    if (result.ok) expect(result.suggestion?.supportingSources).toEqual([]);
  });

  it('refuses a suggestion with no reason', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestedClass: 'external-established', confidence: 90, primarySource: null, supportingSources: [], reason: '' }),
    });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(false);
  });

  it('clamps an out-of-range confidence rather than trusting it', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestedClass: 'external-established', confidence: -10, primarySource: null, supportingSources: [], reason: 'x' }),
    });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestion?.confidence).toBe(0);
  });

  it('returns ok:false, never a fabricated suggestion, when the provider call throws', async () => {
    mockCallSovereign.mockRejectedValue(new Error('all providers failed'));
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false, never a fabricated suggestion, when the model does not return parseable JSON', async () => {
    mockCallSovereign.mockResolvedValue({ text: 'this is not json' });
    const result = await suggestProvenanceClass(CANDIDATE, resolved);
    expect(result.ok).toBe(false);
  });
});
