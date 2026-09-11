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

/**
 * triageUnclassifiedProvenance's own evidence resolution is now ONE batched
 * `discovery_evidence` read (2026-09-04 perf fix — was N sequential
 * suggestClassification() calls, the dominant cost of a 15s+ programme-
 * composition timeout at live scale). A fake admin standing in for that one
 * `.from('discovery_evidence').select('id, source_ref').in('id', ids)` call
 * — `rows` maps evidence id -> source_ref (or null for "resolved row, no
 * source_ref"); an id absent from `rows` simulates "could not be resolved".
 */
function fakeEvidenceAdmin(rows: Record<string, string | null>) {
  return {
    from: (table: string) => {
      if (table !== 'discovery_evidence') throw new Error(`fakeEvidenceAdmin: unexpected table '${table}'`);
      return {
        select: () => ({
          in: async (_col: string, ids: string[]) => ({
            data: ids.filter((id) => id in rows).map((id) => ({ id, source_ref: rows[id] })),
            error: null,
          }),
        }),
      };
    },
  } as any;
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

describe('triageUnclassifiedProvenance — deterministic-only, no model call, ONE batched evidence read', () => {
  it('classifies no-evidence, incomplete-lineage, repo-internal-citation and candidate correctly, never calling the model', async () => {
    const admin = fakeEvidenceAdmin({
      'e-internal': 'https://dev-beta.aigentz.me/codex/viewer',
      'e-candidate': 'https://eur-lex.europa.eu/x',
      // 'e-incomplete' deliberately absent — simulates an unresolved evidence id
    });

    const inputs = [
      { id: 'inv-no-evidence', statement: 'statement for inv-no-evidence', provenance: null },
      { id: 'inv-incomplete', statement: 'statement for inv-incomplete', provenance: { evidence_ids: ['e-incomplete'] } },
      { id: 'inv-internal', statement: 'statement for inv-internal', provenance: { evidence_ids: ['e-internal'] } },
      { id: 'inv-candidate', statement: 'statement for inv-candidate', provenance: { evidence_ids: ['e-candidate'] } },
    ];
    const triaged = await triageUnclassifiedProvenance(admin, inputs);

    expect(triaged.find((t) => t.invariantId === 'inv-no-evidence')).toMatchObject({ disposition: 'exception', exceptionCause: 'no-evidence' });
    expect(triaged.find((t) => t.invariantId === 'inv-incomplete')).toMatchObject({ disposition: 'exception', exceptionCause: 'incomplete-lineage' });
    expect(triaged.find((t) => t.invariantId === 'inv-internal')).toMatchObject({ disposition: 'exception', exceptionCause: 'repo-internal-citation' });
    expect(triaged.find((t) => t.invariantId === 'inv-candidate')).toMatchObject({ disposition: 'candidate', evidenceRefs: ['https://eur-lex.europa.eu/x'] });

    expect(mockSuggestClassification).not.toHaveBeenCalled();
    expect(mockSuggestProvenanceClass).not.toHaveBeenCalled();
  });

  it('resolves ALL invariants\' evidence in ONE discovery_evidence read, never one call per invariant', async () => {
    let fromCallCount = 0;
    const admin = {
      from: (table: string) => {
        fromCallCount += 1;
        expect(table).toBe('discovery_evidence');
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => ({
              data: ids.map((id) => ({ id, source_ref: `https://eur-lex.europa.eu/${id}` })),
              error: null,
            }),
          }),
        };
      },
    } as any;
    const inputs = Array.from({ length: 50 }, (_, i) => ({
      id: `inv-${i}`, statement: `s-${i}`, provenance: { evidence_ids: [`e-${i}`] },
    }));
    await triageUnclassifiedProvenance(admin, inputs);
    expect(fromCallCount).toBe(1);
  });

  it('isExceptionOnlyRemainder is true only when every triaged record is an exception, and false on an empty set', () => {
    expect(isExceptionOnlyRemainder([])).toBe(false);
    expect(isExceptionOnlyRemainder([{ disposition: 'exception' }, { disposition: 'exception' }])).toBe(true);
    expect(isExceptionOnlyRemainder([{ disposition: 'exception' }, { disposition: 'candidate' }])).toBe(false);
  });
});

describe('prepareProvenanceCohort — one suggestProvenanceClass call per DISTINCT signature, reused across every invariant that shares it', () => {
  it('reproduces the live shape: many invariants share few source signatures, and only distinct signatures are ever classified', async () => {
    // 4 invariants: a/b/c share signature [MiCA], d has [MiCA, FFIEC]. The
    // triage phase resolves all of this from the batched admin read; only
    // the per-DISTINCT-signature representative call (one for [MiCA], one
    // for [MiCA, FFIEC]) still goes through suggestClassification.
    const admin = fakeEvidenceAdmin({
      'e-a': 'https://eur-lex.europa.eu/mica',
      'e-b': 'https://eur-lex.europa.eu/mica',
      'e-c': 'https://eur-lex.europa.eu/mica',
      'e-d1': 'https://eur-lex.europa.eu/mica',
      'e-d2': 'https://www.ffiec.gov/handbook',
    });
    mockSuggestClassification
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']))
      .mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']));

    mockSuggestProvenanceClass.mockResolvedValue({
      ok: true,
      suggestion: { suggestedClass: 'external-established', confidence: 90, primarySource: 'https://eur-lex.europa.eu/mica', supportingSources: [], reason: 'EU regulation' },
    });

    const inputs = [
      { id: 'a', statement: 's-a', provenance: { evidence_ids: ['e-a'] } },
      { id: 'b', statement: 's-b', provenance: { evidence_ids: ['e-b'] } },
      { id: 'c', statement: 's-c', provenance: { evidence_ids: ['e-c'] } },
      { id: 'd', statement: 's-d', provenance: { evidence_ids: ['e-d1', 'e-d2'] } },
    ];
    const prepared = await prepareProvenanceCohort(admin, inputs);

    expect(prepared.recommendations).toHaveLength(4);
    expect(prepared.recommendations.every((r) => r.disposition === 'ready')).toBe(true);
    expect(prepared.distinctSignaturesClassified).toBe(2);
    // suggestProvenanceClass called exactly twice — once per distinct signature, never once per invariant.
    expect(mockSuggestProvenanceClass).toHaveBeenCalledTimes(2);
    expect(mockSuggestClassification).toHaveBeenCalledTimes(2);

    const ids = eligibleProvenanceCohortIds(prepared.recommendations);
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('never proposes a class for a repo-internal/self-authored citation — isolated as an exception regardless of confidence, never even reaching the model-suggestion phase', async () => {
    const admin = fakeEvidenceAdmin({ 'e-1': 'https://docs.google.com/document/d/abc' });
    const inputs = [{ id: 'inv-1', statement: 'QriptoCENT doctrine', provenance: { evidence_ids: ['e-1'] } }];
    const prepared = await prepareProvenanceCohort(admin, inputs);

    expect(prepared.recommendations).toHaveLength(1);
    expect(prepared.recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'repo-internal-citation', proposedClass: null });
    expect(mockSuggestClassification).not.toHaveBeenCalled();
    expect(mockSuggestProvenanceClass).not.toHaveBeenCalled();
  });

  it('isolates a signature as an exception when suggestProvenanceClass fails, never defaulting a class', async () => {
    const admin = fakeEvidenceAdmin({ 'e-1': 'https://eur-lex.europa.eu/mica' });
    mockSuggestClassification.mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica']));
    mockSuggestProvenanceClass.mockResolvedValue({ ok: false, error: 'model unavailable' });

    const inputs = [{ id: 'inv-1', statement: 's', provenance: { evidence_ids: ['e-1'] } }];
    const prepared = await prepareProvenanceCohort(admin, inputs);

    expect(prepared.recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'suggestion-unavailable', proposedClass: null });
  });

  it('never invents an evidenceRef — every ready recommendation\'s evidenceRefs is a subset of what the batched evidence read actually resolved', async () => {
    const admin = fakeEvidenceAdmin({
      'e-1': 'https://eur-lex.europa.eu/mica',
      'e-2': 'https://www.ffiec.gov/handbook',
    });
    mockSuggestClassification.mockResolvedValueOnce(completeSuggestion(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']));
    mockSuggestProvenanceClass.mockResolvedValue({
      ok: true,
      suggestion: { suggestedClass: 'external-established', confidence: 80, primarySource: 'https://eur-lex.europa.eu/mica', supportingSources: ['https://www.ffiec.gov/handbook'], reason: 'r' },
    });
    const inputs = [{ id: 'inv-1', statement: 's', provenance: { evidence_ids: ['e-1', 'e-2'] } }];
    const prepared = await prepareProvenanceCohort(admin, inputs);
    expect(prepared.recommendations[0].evidenceRefs.sort()).toEqual(['https://eur-lex.europa.eu/mica', 'https://www.ffiec.gov/handbook']);
  });
});
