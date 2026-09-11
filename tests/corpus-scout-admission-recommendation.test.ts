/**
 * Corpus Scout (PRD-ICA-001) Track 2 Stage 2 — admission RECOMMENDATION
 * canaries (2026-08-03).
 *
 * Pins the behaviour the operator's correction of the same day required:
 *   1. A source with EXISTING invariant lineage is classified from that
 *      lineage, never from a fresh content guess.
 *   2. Parent-family grouping prevents one prolific (decomposed) branch from
 *      numerically dominating a source's classification.
 *   3. A source with NO lineage is marked PROVISIONAL and confidence-capped
 *      into the exception queue, regardless of how strong its content-only
 *      signals look.
 *   4. The recommendation pass writes NOTHING — pure functions, no I/O.
 *   5. The 8-class recommendation vocabulary maps onto the ratified
 *      `ReviewDecision` union; `manual review required` is deliberately
 *      unmapped.
 *   6. Admission-class judgment is independent of, never inferred from,
 *      subdomain placement.
 */

import { describe, it, expect } from 'vitest';
import {
  composeAdmissionRecommendation,
  groupLineageBySubDomain,
  RECOMMENDATION_TO_REVIEW_DECISION,
  RECOMMENDED_ADMISSION_CLASSES,
  CONFIDENCE_AUTO_INCLUDE_THRESHOLD,
  CONFIDENCE_MANUAL_REVIEW_THRESHOLD,
  PROVISIONAL_CONFIDENCE_CAP,
  DOMAIN_BASELINE_LABEL,
  type SourceQualitySignals,
} from '@/services/corpusScout/admissionRecommendation';
import { isReviewDecision } from '@/services/corpusScout/reviewDecision';
import { isExecutable } from '@/services/research/exceptionIsolation';
import { deriveSourceLineage, type DomainLineageIndex, type SourceLineageInvariant } from '@/services/invariants/discoveryEngine';

function baseSignals(overrides: Partial<SourceQualitySignals> = {}): SourceQualitySignals {
  return {
    sourceId: 'SRC-test-0000000001',
    campaignDomain: 'financial-services',
    campaignSubDomain: 'banking',
    issuer: 'BIS',
    // A resolved-looking title and complete metadata by default, so a test
    // that cares about a WARNING has to opt into producing one.
    title: 'Basel III Monitoring Report — March 2026',
    canonicalUrl: 'https://www.bis.org/bcbs/publ/d999.pdf',
    publicationDate: '2026-03-01',
    authors: ['BIS Basel Committee'],
    extractionStatus: 'ok',
    artifactHash: 'a'.repeat(64),
    extractionWarnings: [],
    structuralTags: [],
    licenseStatus: 'unknown',
    isDuplicate: false,
    institutionalTier: 'institutional-authority',
    ...overrides,
  };
}

function lineageItem(overrides: Partial<SourceLineageInvariant> = {}): SourceLineageInvariant {
  return {
    id: 'inv-1',
    promoted: true,
    domain: 'financial-services',
    subDomain: 'banking',
    statement: 'A test invariant.',
    parentIds: [],
    ...overrides,
  };
}

// ── 1 · The vocabulary is mapped, not restated ──────────────────────────────

describe('RECOMMENDATION_TO_REVIEW_DECISION — maps onto the ratified vocabulary, restates nothing', () => {
  it('every mapped value is a real ReviewDecision', () => {
    for (const cls of RECOMMENDED_ADMISSION_CLASSES) {
      const decision = RECOMMENDATION_TO_REVIEW_DECISION[cls];
      if (decision === undefined) continue;
      expect(isReviewDecision(decision), `${cls} maps to an unrecognised decision '${decision}'`).toBe(true);
    }
  });

  it("'manual review required' is deliberately unmapped — it is the absence of a decision, not an eighth one", () => {
    expect(RECOMMENDATION_TO_REVIEW_DECISION['manual review required']).toBeUndefined();
  });

  it('mark_duplicate is never offered by the recommendation vocabulary — it is a per-source fact reserved to the steward', () => {
    const mapped = Object.values(RECOMMENDATION_TO_REVIEW_DECISION);
    expect(mapped).not.toContain('mark_duplicate');
  });
});

// ── 2 · Lineage-derived classification, not a content guess ────────────────

describe('composeAdmissionRecommendation — classifies from EXISTING lineage when it exists', () => {
  it('picks the sub-domain the invariant lineage actually carries, not the source-recorded one', () => {
    const source = baseSignals({ campaignSubDomain: 'payments' }); // recorded acquisition lane
    const lineage = [lineageItem({ subDomain: 'banking' })]; // but the lineage says banking
    const r = composeAdmissionRecommendation({ source, lineage });
    expect(r.provisional).toBe(false);
    expect(r.primarySubDomain).toBe('banking');
    expect(r.evidenceUsed.join(' ')).toMatch(/promoted invariant inv-1/);
  });

  it('an unpromoted candidate still contributes lineage (its own domain/subDomain columns, not an invariant record)', () => {
    const lineage = [lineageItem({ id: 'cand-1', promoted: false, subDomain: 'custody', parentIds: [] })];
    const r = composeAdmissionRecommendation({ source: baseSignals(), lineage });
    expect(r.provisional).toBe(false);
    expect(r.primarySubDomain).toBe('custody');
    expect(r.evidenceUsed.join(' ')).toMatch(/candidate cand-1/);
  });

  it('a domain-baseline lineage item (no sub-domain) is labelled, not dropped', () => {
    const lineage = [lineageItem({ subDomain: null })];
    const r = composeAdmissionRecommendation({ source: baseSignals(), lineage });
    expect(r.primarySubDomain).toBeNull();
    expect(r.evidenceUsed.join(' ')).toContain(DOMAIN_BASELINE_LABEL);
  });
});

// ── 3 · Parent-family grouping — the anti-domination mechanism ──────────────

describe('groupLineageBySubDomain — a decomposed branch cannot numerically overwhelm a source', () => {
  it('five children of ONE parent count as one family, not five independent votes', () => {
    const fiveSiblings = Array.from({ length: 5 }, (_, i) =>
      lineageItem({ id: `child-${i}`, subDomain: 'payments', parentIds: ['parent-x'] }),
    );
    const oneIndependent = lineageItem({ id: 'solo-1', subDomain: 'custody', parentIds: [] });
    const groups = groupLineageBySubDomain([...fiveSiblings, oneIndependent]);

    const payments = groups.find((g) => g.subDomain === 'payments')!;
    const custody = groups.find((g) => g.subDomain === 'custody')!;
    expect(payments.individualCount).toBe(5);
    expect(payments.familyCount).toBe(1); // the anti-domination assertion
    expect(custody.individualCount).toBe(1);
    expect(custody.familyCount).toBe(1);
    // Tied on family support (1 vs 1) — NOT 5 vs 1.
    expect(payments.familyCount).toBe(custody.familyCount);
  });

  it('this actually flips the RECOMMENDED primary sub-domain versus naive individual-count ranking', () => {
    // Naive per-invariant counting would pick 'payments' (5 > 2). Family-level
    // counting ties them at 1 branch each, and the alphabetically-first label
    // ('custody' < 'payments') is what the deterministic tie-break then picks
    // — proving the ranking is NOT driven by the inflated individual count.
    const fiveSiblingsOnePayments = Array.from({ length: 5 }, (_, i) =>
      lineageItem({ id: `child-${i}`, subDomain: 'payments', parentIds: ['parent-x'] }),
    );
    const twoIndependentCustody = [
      lineageItem({ id: 'root-1', subDomain: 'custody', parentIds: [] }),
      lineageItem({ id: 'root-2', subDomain: 'custody', parentIds: [] }),
    ];
    const r = composeAdmissionRecommendation({
      source: baseSignals(),
      lineage: [...fiveSiblingsOnePayments, ...twoIndependentCustody],
    });
    // 'custody' has 2 independent families beating 'payments' 1 family — the
    // family-level signal, not the 5-vs-2 individual-level signal, must win.
    expect(r.primarySubDomain).toBe('custody');
  });

  it('siblings sharing a DIFFERENT parent set are kept as separate families — no partial-overlap merge', () => {
    const groups = groupLineageBySubDomain([
      lineageItem({ id: 'a', subDomain: 'trading', parentIds: ['p1', 'p2'] }),
      lineageItem({ id: 'b', subDomain: 'trading', parentIds: ['p1'] }), // overlaps p1 only
    ]);
    expect(groups[0].familyCount).toBe(2);
  });
});

// ── 4 · No lineage → PROVISIONAL, capped into the exception queue ──────────

describe('composeAdmissionRecommendation — no lineage falls back to the source\'s OWN recorded fields, never a fresh guess', () => {
  it('is marked provisional and uses the recorded campaignSubDomain verbatim — nothing invented', () => {
    const source = baseSignals({ campaignSubDomain: 'qriptocent' });
    const r = composeAdmissionRecommendation({ source, lineage: [] });
    expect(r.provisional).toBe(true);
    expect(r.primarySubDomain).toBe('qriptocent');
    expect(r.warnings.join(' ')).toMatch(/PROVISIONAL/);
  });

  it('caps the SUB-DOMAIN confidence at PROVISIONAL_CONFIDENCE_CAP — the placement never reads as graph-derived', () => {
    const source = baseSignals({
      extractionWarnings: [],
      licenseStatus: 'declared',
      structuralTags: ['causal', 'threshold-based', 'governance', 'constraint', 'temporal'],
    });
    const r = composeAdmissionRecommendation({ source, lineage: [] });
    expect(r.domainConfidence).toBeLessThanOrEqual(PROVISIONAL_CONFIDENCE_CAP);
    expect(r.domainConfidence).toBeLessThan(CONFIDENCE_MANUAL_REVIEW_THRESHOLD);
  });

  /**
   * SUPERSEDED ASSERTION, REPLACED DELIBERATELY (exception-isolation ruling,
   * 2026-08-03).
   *
   * This block previously asserted `r.confidence <= PROVISIONAL_CONFIDENCE_CAP`
   * and `r.reviewTier === 'exception'` — i.e. that a source with no corpus
   * lineage is QUARANTINED. That encoded the paralysis the ruling abolishes:
   * a source cannot HAVE lineage until it has been admitted and extracted, so
   * the first Track 2 batch would have had nothing admissible at all.
   *
   * Per OS-9 ("a canary must be written against real evidence, not against the
   * assumptions of the code it guards"), a test that defends that behaviour is
   * a test defending a defect. The provisional discipline is preserved where it
   * belongs — on `domainConfidence`, asserted directly above — while admission
   * proceeds, because `ingestApprovedSource` writes the source's OWN
   * `campaignSubDomain` regardless of the lineage placement.
   */
  it('a no-lineage source is still ADMISSIBLE — the provisional placement is a warning, not a quarantine', () => {
    const r = composeAdmissionRecommendation({ source: baseSignals(), lineage: [] });
    expect(r.disposition).toBe('ready-with-warning');
    expect(isExecutable(r.disposition)).toBe(true);
    expect(r.exception).toBeUndefined();
    // …and it is never silently upgraded to look graph-derived.
    expect(r.provisional).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/PROVISIONAL/);
  });
});

// ── 5 · Admission class is a SEPARATE, independent judgment ────────────────

describe('admission class — independent of subdomain placement, from source-quality signals only', () => {
  it('an exact-duplicate group member is always manual review required, whatever its lineage says', () => {
    const r = composeAdmissionRecommendation({
      source: baseSignals({ isDuplicate: true }),
      lineage: [lineageItem()], // strong, unambiguous lineage
    });
    expect(r.admissionClass).toBe('manual review required');
    expect(r.reviewDecision).toBeNull();
    expect(r.disposition).toBe('exception');
  });

  it('a failed extraction is reject — low substance, a measured fact, not a guess', () => {
    const r = composeAdmissionRecommendation({
      source: baseSignals({ extractionStatus: 'failed' }),
      lineage: [],
    });
    expect(r.admissionClass).toBe('reject — low substance');
    expect(r.reviewDecision).toBe('reject_low_substance');
  });

  it('a missing artifact hash is manual review required, never auto-approved', () => {
    const r = composeAdmissionRecommendation({ source: baseSignals({ artifactHash: null }), lineage: [lineageItem()] });
    expect(r.admissionClass).toBe('manual review required');
  });

  it('institutional-authority tier recommends EXP-P1 evidence; practitioner-pattern recommends general finance; undeclared recommends reference only', () => {
    const authority = composeAdmissionRecommendation({ source: baseSignals({ institutionalTier: 'institutional-authority' }), lineage: [] });
    const practitioner = composeAdmissionRecommendation({ source: baseSignals({ institutionalTier: 'practitioner-pattern' }), lineage: [] });
    const undeclared = composeAdmissionRecommendation({ source: baseSignals({ institutionalTier: null }), lineage: [] });
    expect(authority.admissionClass).toBe('EXP-P1 evidence');
    expect(practitioner.admissionClass).toBe('general finance');
    expect(undeclared.admissionClass).toBe('reference only');
  });

  it('never machine-recommends reject — out of domain, reject — provenance, or reject — access or licence (no grounded signal supports them)', () => {
    // Exhaustive-ish sweep over the signal space this module reads; none of
    // the three classes should ever come out, because nothing here can
    // assert topical fit, provenance failure, or a licence prohibition
    // without guessing.
    const tiers: (SourceQualitySignals['institutionalTier'])[] = ['institutional-authority', 'practitioner-pattern', null];
    const statuses: SourceQualitySignals['extractionStatus'][] = ['pending', 'ok', 'below-threshold', 'failed'];
    const seen = new Set<string>();
    for (const institutionalTier of tiers) {
      for (const extractionStatus of statuses) {
        for (const isDuplicate of [true, false]) {
          for (const artifactHash of [null, 'x'.repeat(64)]) {
            const r = composeAdmissionRecommendation({
              source: baseSignals({ institutionalTier, extractionStatus, isDuplicate, artifactHash }),
              lineage: [],
            });
            seen.add(r.admissionClass);
          }
        }
      }
    }
    expect(seen.has('reject — out of domain')).toBe(false);
    expect(seen.has('reject — provenance')).toBe(false);
    expect(seen.has('reject — access or licence')).toBe(false);
  });
});

// ── 6 · The pass writes nothing — pure, no I/O ──────────────────────────────

describe('the recommendation module performs no I/O', () => {
  it('imports no Supabase client and calls no admin.from(...)', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'services/corpusScout/admissionRecommendation.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/@supabase\/supabase-js/);
    expect(src).not.toMatch(/\.from\(['"]corpus_candidate_sources['"]\)/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.insert\(/);
  });
});

// ── 7 · deriveSourceLineage (discoveryEngine.ts) — pure, given a built index ─

describe('deriveSourceLineage — resolves lineage from an already-built index, no query per source', () => {
  function index(overrides: Partial<DomainLineageIndex> = {}): DomainLineageIndex {
    return {
      domain: 'financial-services',
      evidenceIdsByRef: new Map(),
      candidates: [],
      parentsByInvariantId: new Map(),
      ...overrides,
    };
  }

  it('returns empty for a source URL with no matching evidence — the ordinary Stage 2 case (never yet ingested)', () => {
    const lineage = deriveSourceLineage('https://example.com/never-ingested.pdf', index());
    expect(lineage).toEqual([]);
  });

  it('resolves via source_ref → evidence id → candidate.evidenceIds, exactly the reverse of suggestClassification\'s join', () => {
    const idx = index({
      evidenceIdsByRef: new Map([['https://example.com/doc.pdf', ['e1', 'e2']]]),
      candidates: [
        {
          id: 'cand-1',
          domain: 'financial-services',
          subDomain: 'banking',
          scopeLevel: 'sub-domain',
          abstractionLevel: 'L2',
          discoveryClass: 'constitutional',
          statement: 'stmt',
          rationale: '',
          evidenceIds: ['e2'],
          confidence: 0.7,
          status: 'promoted',
          promotedInvariantId: 'inv-9',
          createdAt: new Date().toISOString(),
          stage: 'constitutional',
          classification: null,
          coverage: null,
        } as never,
      ],
      parentsByInvariantId: new Map([['inv-9', ['inv-parent']]]),
    });
    const lineage = deriveSourceLineage('https://example.com/doc.pdf', idx);
    expect(lineage).toHaveLength(1);
    expect(lineage[0]).toMatchObject({ id: 'inv-9', promoted: true, subDomain: 'banking', parentIds: ['inv-parent'] });
  });
});
