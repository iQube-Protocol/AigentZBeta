/**
 * Provenance as a causal lineage (Al's ruling, relayed 2026-08-02).
 *
 *   > "Independent → Target-derived → Outcome-informed, where each state
 *   >  implies strictly more experimental influence than the one above it."
 *
 *   > "'Domain-adjacent' stops competing with 'Independent' as though they
 *   >  were peers — it becomes explanatory metadata about why something is
 *   >  relevant, while provenance … governs admissibility."
 *
 * The canaries here guard the two properties that make the change worth
 * making: the ORDER (so disagreement is tractable rather than a matter of
 * taste) and the SEPARATION (so a record can be both domain-adjacent and
 * independent without a reviewer having to discard one of two true facts).
 */

import { describe, it, expect } from 'vitest';

import {
  PROVENANCE_LINEAGE,
  CLASS_B_ALIASES,
  RELEVANCE_METADATA,
  UNKNOWN_PROVENANCE,
  experimentalInfluenceRank,
  isProvenanceClass,
  isRelevanceMetadata,
  admissibleAsExperimentalEvidence,
  admissibilityReason,
  resolveProvenance,
  labelsConflict,
} from '@/services/research/review/provenance';
import {
  EXP_P1_CONTESTED_RESOLUTIONS,
  contestedResolutionEffect,
} from '@/services/research/review/templates/expP1ContestedResolutions';

describe('the lineage is strictly ordered', () => {
  it('runs Independent → Target-derived → Outcome-informed', () => {
    expect([...PROVENANCE_LINEAGE]).toEqual(['independent', 'target-derived', 'outcome-informed']);
  });

  it('each class implies strictly more experimental influence than the one above', () => {
    const ranks = PROVENANCE_LINEAGE.map((c) => experimentalInfluenceRank(c));
    for (let i = 1; i < ranks.length; i += 1) {
      expect(ranks[i]!).toBeGreaterThan(ranks[i - 1]!);
    }
  });

  it('task-derived shares Class B\'s rank rather than inventing a fourth', () => {
    // The ruling names three classes; the corpus carries a fourth label meaning
    // the same causal position. A distinct rank would assert an ordering
    // nobody ruled on.
    expect(CLASS_B_ALIASES).toContain('task-derived');
    expect(experimentalInfluenceRank('task-derived')).toBe(experimentalInfluenceRank('target-derived'));
  });
});

describe('unknown and domain-adjacent are not positions on the axis', () => {
  it('unknown has no rank — it is the absence of a claim, not a weaker one', () => {
    expect(experimentalInfluenceRank(UNKNOWN_PROVENANCE)).toBeNull();
    expect(isProvenanceClass(UNKNOWN_PROVENANCE)).toBe(false);
  });

  it('domain-adjacent has no rank and is not a provenance', () => {
    expect(experimentalInfluenceRank('domain-adjacent')).toBeNull();
    expect(isProvenanceClass('domain-adjacent')).toBe(false);
    expect(isRelevanceMetadata('domain-adjacent')).toBe(true);
  });

  it('an unrecognised label is neither, and says so', () => {
    expect(isProvenanceClass('made-up')).toBe(false);
    expect(isRelevanceMetadata('made-up')).toBe(false);
    expect(admissibilityReason('made-up')).toMatch(/not a recognised provenance/i);
  });

  it('relevance metadata is a named list, not an inline literal', () => {
    // So code tempted to put it back in the eligibility set has to do so
    // against an explicit statement that it is not one.
    expect([...RELEVANCE_METADATA]).toEqual(['domain-adjacent']);
  });
});

describe('provenance governs admissibility', () => {
  it('only Independent is admissible as experimental evidence', () => {
    expect(admissibleAsExperimentalEvidence('independent')).toBe(true);
    expect(admissibleAsExperimentalEvidence('target-derived')).toBe(false);
    expect(admissibleAsExperimentalEvidence('task-derived')).toBe(false);
    expect(admissibleAsExperimentalEvidence('outcome-informed')).toBe(false);
  });

  it('domain-adjacent alone confers no eligibility — the real narrowing', () => {
    // It previously sat in ELIGIBLE_LABELS beside 'independent'. Under the
    // ruling it is not a provenance, so it cannot decide admissibility.
    expect(admissibleAsExperimentalEvidence('domain-adjacent')).toBe(false);
    expect(admissibilityReason('domain-adjacent')).toMatch(/cannot decide admissibility on its own/i);
  });

  it('unknown is not admissible and is not a verdict', () => {
    expect(admissibleAsExperimentalEvidence(UNKNOWN_PROVENANCE)).toBe(false);
    expect(admissibilityReason(UNKNOWN_PROVENANCE)).toMatch(/absence of one/i);
  });

  it('explains exclusion as circularity, never as a defect in the record', () => {
    for (const label of ['target-derived', 'outcome-informed']) {
      const reason = admissibilityReason(label);
      expect(reason, label).toMatch(/circularity|not for any defect/i);
      expect(reason, label).not.toMatch(/invalid|low quality|unreliable/i);
    }
  });
});

describe('the single constitutional question', () => {
  it('takes the STRONGEST supported provenance across reviewers', () => {
    // Influence is a claim evidence can establish; not finding it shows
    // nothing about whether it exists.
    expect(resolveProvenance(['independent', 'outcome-informed']).resolved).toBe('outcome-informed');
    expect(resolveProvenance(['independent', 'target-derived']).resolved).toBe('target-derived');
  });

  it('unknown gives way to any affirmative classification', () => {
    const r = resolveProvenance([UNKNOWN_PROVENANCE, 'independent']);
    expect(r.resolved).toBe('independent');
    expect(r.unknownYielded).toBe(true);
    expect(r.reason).toMatch(/absence of evidence/i);
  });

  it('unknown survives only when nobody could support a class', () => {
    const r = resolveProvenance([UNKNOWN_PROVENANCE, UNKNOWN_PROVENANCE]);
    expect(r.resolved).toBe(UNKNOWN_PROVENANCE);
    expect(r.unknownYielded).toBe(false);
    expect(r.reason).toMatch(/genuine evidentiary insufficiency/i);
  });

  it('domain-adjacent alone leaves the record Unknown, and is carried alongside', () => {
    const r = resolveProvenance(['domain-adjacent']);
    expect(r.resolved).toBe(UNKNOWN_PROVENANCE);
    expect(r.relevance).toEqual(['domain-adjacent']);
  });

  it('keeps relevance metadata beside a resolved provenance rather than discarding it', () => {
    // The pairing a flat label set could not express: a reviewer had to
    // choose, and choosing discarded one of two true facts.
    const r = resolveProvenance(['domain-adjacent', 'independent']);
    expect(r.resolved).toBe('independent');
    expect(r.relevance).toEqual(['domain-adjacent']);
  });
});

describe('which differences are real disagreements', () => {
  it('a provenance paired with relevance metadata is NOT a conflict', () => {
    expect(labelsConflict('independent', 'domain-adjacent')).toBe(false);
  });

  it('unknown against a classification is NOT a conflict — it yields', () => {
    expect(labelsConflict(UNKNOWN_PROVENANCE, 'outcome-informed')).toBe(false);
  });

  it('two different ranks IS a conflict', () => {
    expect(labelsConflict('independent', 'outcome-informed')).toBe(true);
  });

  it('two labels of the same rank are not in conflict', () => {
    expect(labelsConflict('target-derived', 'task-derived')).toBe(false);
  });

  it('identical labels never conflict', () => {
    expect(labelsConflict('independent', 'independent')).toBe(false);
  });
});

describe("Al's seven recommendations", () => {
  it('covers exactly the seven contested records', () => {
    expect(EXP_P1_CONTESTED_RESOLUTIONS.map((r) => r.subjectRef)).toEqual([
      'inv.representation.128',
      'inv.polity.163',
      'inv.polity.209',
      'inv.reasoning.323',
      'inv.reasoning.354',
      'inv.reasoning.356',
      'inv.reasoning.357',
    ]);
  });

  it('assigns the four background records Independent', () => {
    const independent = EXP_P1_CONTESTED_RESOLUTIONS.filter((r) => r.recommended === 'independent');
    expect(independent.map((r) => r.subjectRef)).toEqual([
      'inv.representation.128',
      'inv.polity.163',
      'inv.polity.209',
      'inv.reasoning.323',
    ]);
  });

  it('assigns the three reasoning.35x records Outcome-informed', () => {
    const outcome = EXP_P1_CONTESTED_RESOLUTIONS.filter((r) => r.recommended === 'outcome-informed');
    expect(outcome.map((r) => r.subjectRef)).toEqual([
      'inv.reasoning.354',
      'inv.reasoning.356',
      'inv.reasoning.357',
    ]);
  });

  it('every recommendation is a real provenance class with a stated basis', () => {
    for (const r of EXP_P1_CONTESTED_RESOLUTIONS) {
      expect(isProvenanceClass(r.recommended), r.subjectRef).toBe(true);
      expect(r.basis.length, r.subjectRef).toBeGreaterThan(20);
    }
  });

  it('derives the corpus effect rather than asserting a count that can go stale', () => {
    const effect = contestedResolutionEffect();
    expect(effect.admissible).toHaveLength(4);
    expect(effect.excludedAsExperimentallyInfluenced).toHaveLength(3);
    // Not intuitive, and worth meeting here rather than in a corpus total:
    // "resolved" does not mean "included".
    expect(effect.excludedAsExperimentallyInfluenced).toContain('inv.reasoning.354');
  });
});
