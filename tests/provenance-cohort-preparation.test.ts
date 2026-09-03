/**
 * services/research/provenanceCohortPreparation.ts — Track 2 Stage 5's
 * provenance-cohort preparation (2026-09-03). Reproduces the exact live
 * finding from EXP-P1 Crystal v2's 55 unclassified successor-scoped
 * invariants: zero resolve to a source ever admitted through Corpus Scout,
 * but their evidence collapses onto a handful of distinct source-document
 * signatures, and citing this platform's own deployed host or a Google Docs
 * draft must NEVER be proposed 'external-established'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSuggestClassification = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  suggestClassification: (...args: any[]) => mockSuggestClassification(...args),
}));

const mockSuggestProvenanceClass = vi.fn();
vi.mock('@/services/invariants/provenanceSuggestion', () => ({
  suggestProvenanceClass: (...args: any[]) => mockSuggestProvenanceClass(...args),
}));

import {
  triageUnclassifiedProvenance,
  prepareProvenanceCohort,
  eligibleProvenanceCohortIds,
  isExceptionOnlyRemainder,
} from '@/services/research/provenanceCohortPreparation';
import { looksSelfAuthored } from '@/services/research/experimentalPopulations';

function completeSuggestion(refs: string[]) {
  return {
    invariantId: 'x',
    evidenceIdCount: refs.length,
    resolvedEvidenceCount: refs.length,
    unresolvedEvidenceIds: [],
    evidenceIdsWithoutSourceRef: [],
    sources: refs.map((r) => ({
      sourceRef: r, evidenceIds: ['e1'], evidenceTitles: ['t'], candidateTitle: null,
      issuer: null, recordedProvenanceClass: null, reviewNotes: null, seedInstitution: null, seedClaim: null,
    })),
    suggestedEvidenceRefs: refs,
    suggestedRationale: 'r',
    complete: refs.length > 0,
    notes: [],
  };
}

beforeEach(() => {
  mockSuggestClassification.mockReset();
  mockSuggestProvenanceClass.mockReset();
});

describe('looksSelfAuthored — the anti-laundering gap this closes (2026-09-03)', () => {
  it('catches this platform\'s own deployed host, at any subdomain under aigentz.me', () => {
    expect(looksSelfAuthored('https://dev-beta.aigentz.me/codex/viewer')).toBe(true);
    expect(looksSelfAuthored('https://aigentz.me/')).toBe(true);
  });
  it('catches Google Docs/Drive — a private editable document is never a publisher, regardless of author', () => {
    expect(looksSelfAuthored('https://docs.google.com/document/d/abc/edit')).toBe(true);
    expect(looksSelfAuthored('https://drive.google.com/file/d/xyz')).toBe(true);
  });
  it('does NOT flag a genuine external regulator/standards-body URL', () => {
    expect(looksSelfAuthored('https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R1114')).toBe(false);
    expect(looksSelfAuthored('https://www.ffiec.gov/some/handbook.pdf')).toBe(false);
  });
  it('never throws on a malformed/non-URL ref — returns false, letting the non-URL doc-code patterns handle it', () => {
    expect(looksSelfAuthored('CFS-009')).toBe(false);
    expect(looksSelfAuthored('not a url at all')).toBe(false);
  });
});

describe('triageUnclassifiedProvenance — deterministic-only, no model call', () => {
  it('classifies no-evidence, incomplete-lineage, repo-internal-citation and candidate correctly, never calling the model', async () => {
    mockSuggestClassification
      .mockResolvedValueOnce(completeSuggestion([])) // inv-no-evidence
      .mockResolvedValueOnce({ ...completeSuggestion(['https://eur-lex.europa.eu/x']), complete: false, notes: ['gap'] }) // inv-incomplete
      .mockResolvedValueOnce(completeSuggestion(['https://dev-beta.aigentz.me/codex/viewer'])) // inv-internal
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/x'])); // inv-candidate

    const inputs = ['inv-no-evidence', 'inv-incomplete', 'inv-internal', 'inv-candidate'].map((id) => ({
      id, statement: `statement for ${id}`, provenance: null,
    }));
    const triaged = await triageUnclassifiedProvenance({} as any, inputs);

    expect(triaged.find((t) => t.invariantId === 'inv-no-evidence')).toMatchObject({ disposition: 'exception', exceptionCause: 'no-evidence' });
    expect(triaged.find((t) => t.invariantId === 'inv-incomplete')).toMatchObject({ disposition: 'exception', exceptionCause: 'incomplete-lineage' });
    expect(triaged.find((t) => t.invariantId === 'inv-internal')).toMatchObject({ disposition: 'exception', exceptionCause: 'repo-internal-citation' });
    expect(triaged.find((t) => t.invariantId === 'inv-candidate')).toMatchObject({ disposition: 'candidate', evidenceRefs: ['https://eur-lex.europa.eu/x'] });

    expect(mockSuggestProvenanceClass).not.toHaveBeenCalled();
  });

  it('isExceptionOnlyRemainder is true only when every triaged record is an exception, and false on an empty set', () => {
    expect(isExceptionOnlyRemainder([])).toBe(false);
    expect(isExceptionOnlyRemainder([{ disposition: 'exception' }, { disposition: 'exception' }])).toBe(true);
    expect(isExceptionOnlyRemainder([{ disposition: 'exception' }, { disposition: 'candidate' }])).toBe(false);
  });
});

describe('prepareProvenanceCohort — one suggestProvenanceClass call per DISTINCT signature, reused across every invariant that shares it', () => {
  it('reproduces the live shape: many invariants share few source signatures, and only distinct signatures are ever classified', async () => {
    // 4 invariants: 3 share signature [MiCA], 1 has [MiCA, FFIEC].
    mockSuggestClassification
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']))
      // second pass — one suggestProvenanceClass call per distinct signature re-resolves its representative
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']));

    mockSuggestProvenanceClass.mockResolvedValue({
      ok: true,
      suggestion: { suggestedClass: 'external-established', confidence: 90, primarySource: 'https://eur-lex.europa.eu/mica', supportingSources: [], reason: 'EU regulation' },
    });

    const inputs = ['a', 'b', 'c', 'd'].map((id) => ({ id, statement: `s-${id}`, provenance: null }));
    const prepared = await prepareProvenanceCohort({} as any, inputs);

    expect(prepared.recommendations).toHaveLength(4);
    expect(prepared.recommendations.every((r) => r.disposition === 'ready')).toBe(true);
    expect(prepared.distinctSignaturesClassified).toBe(2);
    // suggestProvenanceClass called exactly twice — once per distinct signature, never once per invariant.
    expect(mockSuggestProvenanceClass).toHaveBeenCalledTimes(2);

    const ids = eligibleProvenanceCohortIds(prepared.recommendations);
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('never proposes a class for a repo-internal/self-authored citation — isolated as an exception regardless of confidence', async () => {
    mockSuggestClassification.mockResolvedValueOnce(completeSuggestion(['https://docs.google.com/document/d/abc']));
    const inputs = [{ id: 'inv-1', statement: 'QriptoCENT doctrine', provenance: null }];
    const prepared = await prepareProvenanceCohort({} as any, inputs);

    expect(prepared.recommendations).toHaveLength(1);
    expect(prepared.recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'repo-internal-citation', proposedClass: null });
    expect(mockSuggestProvenanceClass).not.toHaveBeenCalled();
  });

  it('isolates a signature as an exception when suggestProvenanceClass fails, never defaulting a class', async () => {
    mockSuggestClassification
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']));
    mockSuggestProvenanceClass.mockResolvedValue({ ok: false, error: 'model unavailable' });

    const inputs = [{ id: 'inv-1', statement: 's', provenance: null }];
    const prepared = await prepareProvenanceCohort({} as any, inputs);

    expect(prepared.recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'suggestion-unavailable', proposedClass: null });
  });

  it('never invents an evidenceRef — every ready recommendation\'s evidenceRefs is a subset of what suggestClassification actually resolved', async () => {
    mockSuggestClassification
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']));
    mockSuggestProvenanceClass.mockResolvedValue({
      ok: true,
      suggestion: { suggestedClass: 'external-established', confidence: 80, primarySource: 'https://eur-lex.europa.eu/mica', supportingSources: ['https://www.ffiec.gov/handbook'], reason: 'r' },
    });
    const inputs = [{ id: 'inv-1', statement: 's', provenance: null }];
    const prepared = await prepareProvenanceCohort({} as any, inputs);
    expect(prepared.recommendations[0].evidenceRefs.sort()).toEqual(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']);
  });
});
