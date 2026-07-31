/**
 * Knowledge Homecoming — constitutionalization pure-core canaries (CFS-023 slice 2).
 *
 * Pins the deterministic parse/validation/seed-derivation (no LLM, no DB): the
 * candidate validator (namespace + semanticType against the safe core sets, min
 * statement length), fence-tolerant array parsing with in-batch dedup, and stable
 * idempotent seed ids. The LLM extraction + substrate writes are impure and not
 * exercised here.
 */

import { describe, it, expect } from 'vitest';
import {
  candidateSeedId,
  validateCandidate,
  parseCandidateInvariants,
  HOMECOMING_NAMESPACES,
  HOMECOMING_SEMANTIC_TYPES,
} from '@/services/homecoming/constitutionalize';

describe('validateCandidate — strict on the safe core vocabularies', () => {
  it('accepts a well-formed candidate', () => {
    const c = validateCandidate({ statement: 'Authority may be delegated; sovereignty may not.', namespace: 'constitutional', semanticType: 'law', rationale: 'recurs' });
    expect(c).not.toBeNull();
    expect(c!.namespace).toBe('constitutional');
    expect(c!.rationale).toBe('recurs');
  });

  it('rejects out-of-core namespaces and semantic types', () => {
    expect(validateCandidate({ statement: 'A visual rule that is long enough.', namespace: 'style', semanticType: 'principle' })).toBeNull();
    expect(validateCandidate({ statement: 'An epistemic rule that is long enough.', namespace: 'reasoning', semanticType: 'epistemic' })).toBeNull();
  });

  it('rejects empty / trivially short / malformed statements', () => {
    expect(validateCandidate({ statement: 'short', namespace: 'reasoning', semanticType: 'heuristic' })).toBeNull();
    expect(validateCandidate({ namespace: 'reasoning', semanticType: 'heuristic' })).toBeNull();
    expect(validateCandidate(null)).toBeNull();
    expect(validateCandidate('nope')).toBeNull();
  });

  it('the safe core sets are exactly the five each', () => {
    expect([...HOMECOMING_NAMESPACES]).toEqual(['constitutional', 'reasoning', 'engineering', 'experience', 'capability']);
    expect([...HOMECOMING_SEMANTIC_TYPES]).toEqual(['principle', 'constraint', 'definition', 'heuristic', 'law']);
  });
});

describe('candidateSeedId — deterministic + idempotent', () => {
  it('is stable for the same statement and hc-prefixed', () => {
    const a = candidateSeedId('Authority may be delegated; sovereignty may not.');
    const b = candidateSeedId('Authority may be delegated; sovereignty may not.');
    expect(a).toBe(b);
    expect(a.startsWith('hc:')).toBe(true);
  });
});

describe('parseCandidateInvariants — fence-tolerant, dedup, honest drops', () => {
  it('parses a fenced JSON array and keeps only valid candidates', () => {
    const text = '```json\n[\n {"statement":"Every claim must be verifiable against a source.","namespace":"reasoning","semanticType":"constraint"},\n {"statement":"bad","namespace":"reasoning","semanticType":"law"},\n {"statement":"Disclose the minimum necessary and no more.","namespace":"constitutional","semanticType":"principle"}\n]\n```';
    const out = parseCandidateInvariants(text);
    expect(out).toHaveLength(2); // 'bad' dropped (too short)
    expect(out.map((c) => c.namespace)).toEqual(['reasoning', 'constitutional']);
  });

  it('dedupes candidates that map to the same seed id within a batch', () => {
    const text = JSON.stringify([
      { statement: 'Minimum disclosure is the default.', namespace: 'constitutional', semanticType: 'principle' },
      { statement: 'Minimum disclosure is the default.', namespace: 'constitutional', semanticType: 'principle' },
    ]);
    expect(parseCandidateInvariants(text)).toHaveLength(1);
  });

  it('returns [] on non-JSON, non-array, or garbage — never throws', () => {
    expect(parseCandidateInvariants('not json at all')).toEqual([]);
    expect(parseCandidateInvariants('{"statement":"x"}')).toEqual([]); // object, not array
    expect(parseCandidateInvariants('')).toEqual([]);
  });
});
