/**
 * Corpus Scout (PRD-ICA-001) — Phase 3 lightweight intelligence canaries.
 *
 * Pins the heuristic contract (§8, §14.3): classification is keyword/pattern
 * HEURISTIC only and must never crash on degenerate input; empty text yields
 * no tags; duplicate detection catches byte-identical hashes (mirrors and
 * re-submissions) and never groups missing hashes together; lane coverage
 * aggregates per sub-domain so one lane cannot silently dominate (§12).
 */

import { describe, it, expect } from 'vitest';
import {
  assessLaneCoverage,
  classifyStructuralValue,
  findDuplicateCandidates,
} from '@/services/corpusScout/intelligence';
import { STRUCTURAL_VALUE_TAGS } from '@/services/corpusScout/types';

describe('classifyStructuralValue — heuristic, never crashes, always labeled', () => {
  it('empty text → no tags, no crash, heuristic marker present', () => {
    const r = classifyStructuralValue('');
    expect(r.heuristic).toBe(true);
    expect(r.tags).toEqual([]);
  });

  it('whitespace-only text → no tags', () => {
    expect(classifyStructuralValue('   \n\t  ').tags).toEqual([]);
  });

  it('non-string input (defensive) → no tags, never a crash', () => {
    // A failed extraction path could hand through undefined/null at runtime.
    expect(classifyStructuralValue(undefined as unknown as string).tags).toEqual([]);
    expect(classifyStructuralValue(null as unknown as string).tags).toEqual([]);
  });

  it('assigns recognizable tags from characteristic phrasing', () => {
    const text =
      'A rise in interest rates leads to a fall in bond prices. ' +
      'The insurer must not exceed the solvency threshold. ' +
      'Capital is defined as the excess of assets over liabilities. ' +
      'The probability of default follows a known distribution.';
    const { tags, heuristic } = classifyStructuralValue(text);
    expect(heuristic).toBe(true);
    expect(tags).toContain('causal');
    expect(tags).toContain('threshold-based');
    expect(tags).toContain('constraint');
    expect(tags).toContain('definitional');
    expect(tags).toContain('probabilistic');
  });

  it('only emits tags from the PRD §8 vocabulary', () => {
    const text = STRUCTURAL_VALUE_TAGS.join(' ') + ' because if x then y trade-off feedback loop';
    for (const tag of classifyStructuralValue(text).tags) {
      expect(STRUCTURAL_VALUE_TAGS).toContain(tag);
    }
  });

  it('unrelated prose yields no false authority — few or no tags', () => {
    const r = classifyStructuralValue('The quick brown fox jumped over a lazy dog near the river.');
    expect(r.tags).toEqual([]);
  });
});

describe('assessLaneCoverage — §12 coverage-control aggregation', () => {
  it('empty input → empty coverage, no crash', () => {
    expect(assessLaneCoverage([])).toEqual([]);
  });

  it('groups by sub-domain with pending/approved/closed rollups', () => {
    const rows = assessLaneCoverage([
      { campaignSubDomain: 'actuarial-science', reviewWorkflowStatus: 'pending_review' },
      { campaignSubDomain: 'actuarial-science', reviewWorkflowStatus: 'approved_exp_p1' },
      { campaignSubDomain: 'actuarial-science', reviewWorkflowStatus: 'rejected_out_of_domain' },
      { campaignSubDomain: null, reviewWorkflowStatus: 'needs_retrieval_fix' },
    ]);
    const actuarial = rows.find((r) => r.lane === 'actuarial-science');
    expect(actuarial).toMatchObject({ total: 3, pending: 1, approved: 1, closed: 1 });
    expect(actuarial?.byStatus.approved_exp_p1).toBe(1);
    const unassigned = rows.find((r) => r.lane === '(unassigned)');
    expect(unassigned).toMatchObject({ total: 1, pending: 1 });
  });
});

describe('findDuplicateCandidates — exact matches only (mirrors, not paraphrases)', () => {
  const base = { normalizedTextHash: null, canonicalUrl: '' };

  it('empty input → no groups, no crash', () => {
    expect(findDuplicateCandidates([])).toEqual([]);
  });

  it('catches identical artifact hashes', () => {
    const groups = findDuplicateCandidates([
      { ...base, sourceId: 'SRC-a', artifactHash: 'deadbeef', canonicalUrl: 'https://x/1' },
      { ...base, sourceId: 'SRC-b', artifactHash: 'deadbeef', canonicalUrl: 'https://x/2' },
      { ...base, sourceId: 'SRC-c', artifactHash: 'cafef00d', canonicalUrl: 'https://x/3' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ matchType: 'artifact-hash', key: 'deadbeef' });
    expect(groups[0].sourceIds.sort()).toEqual(['SRC-a', 'SRC-b']);
  });

  it('never groups missing hashes together', () => {
    const groups = findDuplicateCandidates([
      { sourceId: 'SRC-a', artifactHash: null, normalizedTextHash: null, canonicalUrl: 'https://x/1' },
      { sourceId: 'SRC-b', artifactHash: null, normalizedTextHash: null, canonicalUrl: 'https://x/2' },
    ]);
    expect(groups).toEqual([]);
  });

  it('does not re-report the same member set on a weaker axis', () => {
    const groups = findDuplicateCandidates([
      { sourceId: 'SRC-a', artifactHash: 'deadbeef', normalizedTextHash: 'text1', canonicalUrl: 'https://x/same' },
      { sourceId: 'SRC-b', artifactHash: 'deadbeef', normalizedTextHash: 'text1', canonicalUrl: 'https://x/same' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchType).toBe('artifact-hash');
  });

  it('catches same canonical URL even when hashes differ (re-retrieval drift)', () => {
    const groups = findDuplicateCandidates([
      { sourceId: 'SRC-a', artifactHash: 'aaa', normalizedTextHash: null, canonicalUrl: 'https://x/doc.pdf' },
      { sourceId: 'SRC-b', artifactHash: 'bbb', normalizedTextHash: null, canonicalUrl: 'https://x/doc.pdf' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchType).toBe('canonical-url');
  });
});
