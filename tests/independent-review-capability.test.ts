/**
 * IRL-REVIEW-001 Phase 1 — canaries for the independent-review capability.
 *
 * Every block below guards a failure that produces a PLAUSIBLE result rather
 * than an error. That is the whole risk profile of a review pipeline: a broken
 * one does not crash, it returns a clean-looking adjudication that nobody has
 * reason to doubt. So the assertions here are behavioural (drive the real
 * runner, the real package builder, the real resolver) and the source-level
 * greps are limited to properties that cannot be expressed any other way — the
 * absence of a database client, the absence of a clock, the absence of an
 * instance identifier in a generic layer.
 *
 * Mutation-tested: `codexes/packs/agentiq/updates/2026-07-29_irl-review-001-phase-1-adjudication-workflow.md`
 * records the table.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertBlinded,
  assertCoverageComplete,
  assertDecisionsSigned,
  assertPromptCarriesNoPriorAdjudication,
  assertReviewerIndependence,
  assessPrivateEvidence,
  assertSummaryDisclosureSafe,
  blockDecisionIsArithmeticallySound,
  buildBlockDecision,
  buildReviewPackage,
  buildReviewRequest,
  buildReviewReceipt,
  commit,
  createFileBackedProvider,
  createScriptedProvider,
  createdOrRevisedOnOrAfter,
  DEFAULT_DETERMINISM,
  exportRelations,
  findBlindingViolations,
  INDEPENDENCE_PROMPT_VERSION,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  mentionsAnyTerm,
  parseAdjudication,
  proportionalStratifiedSample,
  redactedPreview,
  resolveDecisions,
  ReviewRefusal,
  reviewReceiptGrantsApproval,
  REVIEW_ROLE_AUTHORITY,
  runDualReview,
  selectReviewer2Coverage,
  seededTake,
  tallyResolutions,
  unresolvedChronologyOrProvenance,
  verifyPackageHash,
  verifyPinnedPairAgainstCatalogue,
  type ModelCatalogueEntry,
  type PrivateEvidenceSummary,
  type ReviewDecision,
  type ReviewSubjectRecord,
  type ReviewerAssignment,
} from '@/services/research/review';
import {
  CLASS_C_BLOCK_RULING,
  EXP_P1_BOUNDARY_EXCLUSIONS,
  EXP_P1_NAMESPACE_BOUNDARY,
  EXP_P1_NON_TARGETS,
  EXP_P1_REVIEWER_PAIR,
  EXP_P1_TARGET_STATEMENT,
  expP1ClassCExceptionRules,
} from '@/services/research/review/templates/expP1Admissibility';

const REPO = join(__dirname, '..');
const REVIEW_DIR = join(REPO, 'services/research/review');

// ── Fixtures ────────────────────────────────────────────────────────────────

function subject(over: Partial<ReviewSubjectRecord> & { subjectRef: string }): ReviewSubjectRecord {
  return {
    statement: 'A constitutional statement about authority and delegation.',
    namespace: 'constitutional',
    sourceProvenance: 'platform-doctrine',
    sourceRefs: ['docs/source-a.md'],
    derivationRefs: ['ratified 2026-05-01'],
    createdAt: '2026-05-01T00:00:00.000Z',
    revisedAt: null,
    lifecycleStatus: 'canonical',
    ...over,
  };
}

const CLEAN_SUBJECTS: ReviewSubjectRecord[] = [
  subject({ subjectRef: 'inv.constitutional.001' }),
  subject({ subjectRef: 'inv.reasoning.002', namespace: 'reasoning' }),
  subject({ subjectRef: 'inv.polity.003', namespace: 'polity' }),
  subject({ subjectRef: 'inv.finance.004', namespace: 'finance', sourceProvenance: 'external-established' }),
];

function sealPackage(over: Partial<Parameters<typeof buildReviewPackage>[0]> = {}) {
  return buildReviewPackage({
    packageId: 'pkg.test',
    reviewId: 'review.test',
    assetRef: 'asset.test',
    assetCommitment: commit({ a: 1 }),
    targetDefinition: EXP_P1_TARGET_STATEMENT,
    nonTargets: EXP_P1_NON_TARGETS,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    sourceRefs: ['spec.md'],
    chronology: ['the corpus predates the apparatus'],
    evidenceSummaries: [],
    subjects: CLEAN_SUBJECTS,
    blockDecisions: [],
    exclusionsFromPackage: [],
    createdAt: '2026-07-29T00:00:00.000Z',
    ...over,
  });
}

function decisionScript(refs: string[], label: string, reason = 'predates the apparatus and names no target system') {
  return JSON.stringify({
    decisions: refs.map((subjectRef) => ({
      subjectRef,
      decision: label,
      reason,
      evidenceRefs: ['docs/source-a.md'],
      limitations: ['could not verify the original ratification record'],
      confidence: 0.8,
    })),
  });
}

const MODEL_A: ReviewerAssignment = {
  reviewerSlot: 'R1',
  reviewerType: 'external-model',
  provider: 'venice',
  requestedModelId: 'model-a',
  resolvedModelId: 'model-a-2026',
  modelFamily: 'alpha',
  promptVersion: INDEPENDENCE_PROMPT_VERSION,
  rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
};
const MODEL_B: ReviewerAssignment = {
  ...MODEL_A,
  reviewerSlot: 'R2',
  requestedModelId: 'model-b',
  resolvedModelId: 'model-b-2026',
  modelFamily: 'beta',
};

async function runFixtureReview(over: {
  r1Label?: string;
  r2Label?: string;
  onR2Call?: (req: { system: string; user: string }) => void;
  r2Raw?: string;
} = {}) {
  const pkg = sealPackage();
  const refs = pkg.subjects.map((s) => s.subjectRef);
  const request = buildReviewRequest({
    reviewId: 'review.test',
    assetType: 'invariant-set',
    reviewMode: 'dual',
    reviewQuestion: 'independent?',
    rubricId: INDEPENDENCE_RUBRIC_ID,
    packageRef: 'pkg.json',
    pkg,
    requestedAt: '2026-07-29T00:00:00.000Z',
    requestedByRef: 'steward.test',
  });
  const r1Provider = createScriptedProvider({
    responses: { 'model-a-2026': decisionScript(refs, over.r1Label ?? 'independent') },
  });
  const r2Provider = createScriptedProvider({
    providerName: 'scripted-2',
    responses: { 'model-b-2026': over.r2Raw ?? decisionScript(refs, over.r2Label ?? 'independent') },
    onCall: (req) => over.onR2Call?.({ system: req.system, user: req.user }),
  });
  let t = 0;
  return runDualReview({
    request,
    pkg,
    r1: { assignment: MODEL_A, provider: r1Provider },
    r2: { assignment: MODEL_B, provider: r2Provider },
    steward: { stewardRef: 'steward.test', interim: false },
    determinism: DEFAULT_DETERMINISM,
    coverage: { sampleRate: 1, sampleSeed: 'seed-1', mechanicallyFlagged: [] },
    assetRef: 'asset.test',
    assetCommitment: commit({ a: 1 }),
    now: () => `2026-07-29T00:00:0${t++}.000Z`,
  });
}

// ── 1. A package without a target statement is refused ──────────────────────

describe('the target statement is required, not implied', () => {
  it('refuses a package with no target statement', () => {
    // Previously the target lived only inside a triage script's keyword array,
    // which meant the thing every decision turned on existed as a side effect of
    // a list of strings. A reviewer with no stated target is guessing what it is
    // being asked to be independent OF, and will answer confidently anyway.
    expect(() => sealPackage({ targetDefinition: '   ' })).toThrowError(/target statement/i);
    try {
      sealPackage({ targetDefinition: '' });
      throw new Error('expected a refusal');
    } catch (e) {
      expect((e as ReviewRefusal).refusalCode).toBe('missing-target-statement');
    }
  });

  it('refuses a target statement with no stated non-targets', () => {
    expect(() => sealPackage({ nonTargets: [] })).toThrowError(/what the target is NOT/i);
  });

  it('carries the target statement into the hash and into every reviewer prompt', async () => {
    const a = sealPackage();
    const b = sealPackage({ targetDefinition: `${EXP_P1_TARGET_STATEMENT} (amended)` });
    expect(a.packageHash).not.toBe(b.packageHash);
    expect(verifyPackageHash(a)).toBe(true);

    let r2Prompt = '';
    await runFixtureReview({ onR2Call: (req) => { r2Prompt = req.user; } });
    expect(r2Prompt).toContain(EXP_P1_TARGET_STATEMENT.slice(0, 60));
  });
});

// ── 2. Blinding ─────────────────────────────────────────────────────────────

describe('blinding — a package cannot carry the answer it is asking for', () => {
  it('refuses a package carrying current eligibility labels', () => {
    expect(() =>
      sealPackage({ subjects: [{ ...CLEAN_SUBJECTS[0], relation: 'independent' } as unknown as ReviewSubjectRecord] }),
    ).toThrowError(/blinded/i);
  });

  it('refuses a package carrying Standing', () => {
    expect(() =>
      sealPackage({ subjects: [{ ...CLEAN_SUBJECTS[0], standing: 7 } as unknown as ReviewSubjectRecord] }),
    ).toThrowError(/blinded/i);
    expect(() =>
      sealPackage({ subjects: [{ ...CLEAN_SUBJECTS[0], times_validated: 3 } as unknown as ReviewSubjectRecord] }),
    ).toThrowError(/blinded/i);
  });

  it('refuses a package carrying a desired population count as a FIELD', () => {
    expect(() => sealPackage({ chronology: [], evidenceSummaries: [], subjects: CLEAN_SUBJECTS, ...({ desiredCount: 200 } as never) }))
      .not.toThrow(); // an input field the builder never copies is not a leak
    expect(() =>
      sealPackage({ subjects: [{ ...CLEAN_SUBJECTS[0], desiredPopulationSize: 200 } as unknown as ReviewSubjectRecord] }),
    ).toThrowError(/blinded/i);
  });

  it('refuses a desired population count written as PROSE — the damaging shape', () => {
    // A key check alone would sail past this, and it is the single most
    // damaging sentence a package could contain: never tell a reviewer that a
    // minimum population is wanted.
    expect(() => sealPackage({ chronology: ['We need at least 200 rows to survive the freeze.'] }))
      .toThrowError(/blinded/i);
    expect(() => sealPackage({ chronology: ['The desired population is large.'] })).toThrowError(/blinded/i);
    expect(() => sealPackage({ chronology: ['These should be classified as independent.'] })).toThrowError(/blinded/i);
  });

  it('reports every violation, not just the first', () => {
    const v = findBlindingViolations({ a: { standing: 1 }, b: { arm: 'B' }, c: 'the desired outcome is 300' });
    expect(v.length).toBeGreaterThanOrEqual(3);
    expect(v.some((x) => x.kind === 'phrase')).toBe(true);
    expect(v.some((x) => x.kind === 'key')).toBe(true);
  });

  it('lets an honest package through — a check that refuses everything gets switched off', () => {
    expect(() => assertBlinded({ statement: 'authority must be delegable and revocable', createdAt: '2026-01-01' }, 'x'))
      .not.toThrow();
  });
});

// ── 3. Reviewer independence ────────────────────────────────────────────────

describe('reviewer independence — shared hosting yes, shared weights no', () => {
  it('refuses identical requested model ids', () => {
    expect(() => assertReviewerIndependence(MODEL_A, { ...MODEL_B, requestedModelId: 'model-a' }))
      .toThrowError(/both slots requested/i);
  });

  it('refuses two aliases that RESOLVE to the same model', () => {
    // The failure a requested-id check cannot see.
    expect(() => assertReviewerIndependence(MODEL_A, { ...MODEL_B, resolvedModelId: 'model-a-2026' }))
      .toThrowError(/alias/i);
  });

  it('refuses the same model family even with different ids', () => {
    expect(() => assertReviewerIndependence(MODEL_A, { ...MODEL_B, modelFamily: 'alpha' }))
      .toThrowError(/family/i);
    expect(() => assertReviewerIndependence(MODEL_A, { ...MODEL_B, modelFamily: 'ALPHA' }))
      .toThrowError(/family/i);
  });

  it('fails closed on unknown lineage and on an unresolved id', () => {
    expect(() => assertReviewerIndependence(MODEL_A, { ...MODEL_B, modelFamily: undefined }))
      .toThrowError(/lineage/i);
    expect(() => assertReviewerIndependence(MODEL_A, { ...MODEL_B, resolvedModelId: undefined }))
      .toThrowError(/unresolved/i);
  });

  it('accepts a genuinely distinct pair', () => {
    expect(() => assertReviewerIndependence(MODEL_A, MODEL_B)).not.toThrow();
  });

  it('refuses one person occupying both human slots, and an unattributable human', () => {
    const h = (slot: 'R1' | 'R2', ref?: string): ReviewerAssignment => ({
      reviewerSlot: slot,
      reviewerType: 'human',
      humanReviewerRef: ref,
      humanReviewerRole: 'independent-review-steward',
      promptVersion: INDEPENDENCE_PROMPT_VERSION,
      rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    });
    expect(() => assertReviewerIndependence(h('R1', 'steward.a'), h('R2', 'steward.a')))
      .toThrowError(/both reviewer slots/i);
    expect(() => assertReviewerIndependence(h('R1'), h('R2', 'steward.b'))).toThrowError(/attributable/i);
    expect(() => assertReviewerIndependence(h('R1', 'steward.a'), h('R2', 'steward.b'))).not.toThrow();
  });
});

describe('the pinned reviewer pair is verified against a live catalogue', () => {
  const entry = (id: string, family: string, over: Partial<ModelCatalogueEntry> = {}): ModelCatalogueEntry => ({
    id,
    family,
    familyEvidence: 'modelSource',
    offline: false,
    deprecationDate: null,
    raw: { id },
    ...over,
  });
  const CATALOGUE = [
    entry(EXP_P1_REVIEWER_PAIR.R1.modelId, 'meta-llama'),
    entry(EXP_P1_REVIEWER_PAIR.R2.modelId, 'qwen'),
  ];

  it('records requested AND resolved ids plus the field the family came from', () => {
    const v = verifyPinnedPairAgainstCatalogue(EXP_P1_REVIEWER_PAIR, CATALOGUE, '2026-07-29T00:00:00.000Z');
    expect(v.R1.requestedModelId).toBe(EXP_P1_REVIEWER_PAIR.R1.modelId);
    expect(v.R1.resolvedModelId).toBe(EXP_P1_REVIEWER_PAIR.R1.modelId);
    expect(v.R1.familyEvidence).toBe('modelSource');
    expect(v.R1.family).not.toBe(v.R2.family);
  });

  it('REFUSES the run when a pinned id is absent — never substitutes', () => {
    expect(() => verifyPinnedPairAgainstCatalogue(EXP_P1_REVIEWER_PAIR, [CATALOGUE[0]], '2026-07-29T00:00:00.000Z'))
      .toThrowError(/not in the venice catalogue|versioned amendment/i);
  });

  it('refuses an offline model, a deprecated model, and undeterminable lineage', () => {
    const at = '2026-07-29T00:00:00.000Z';
    expect(() =>
      verifyPinnedPairAgainstCatalogue(EXP_P1_REVIEWER_PAIR, [{ ...CATALOGUE[0], offline: true }, CATALOGUE[1]], at),
    ).toThrowError(/offline/i);
    expect(() =>
      verifyPinnedPairAgainstCatalogue(
        EXP_P1_REVIEWER_PAIR,
        [{ ...CATALOGUE[0], deprecationDate: '2026-01-01' }, CATALOGUE[1]],
        at,
      ),
    ).toThrowError(/deprecat/i);
    expect(() =>
      verifyPinnedPairAgainstCatalogue(
        EXP_P1_REVIEWER_PAIR,
        [{ ...CATALOGUE[0], family: null, familyEvidence: null }, CATALOGUE[1]],
        at,
      ),
    ).toThrowError(/lineage/i);
  });

  it('refuses a catalogue whose two pinned entries share a family', () => {
    expect(() =>
      verifyPinnedPairAgainstCatalogue(
        EXP_P1_REVIEWER_PAIR,
        [CATALOGUE[0], { ...CATALOGUE[1], family: 'meta-llama' }],
        '2026-07-29T00:00:00.000Z',
      ),
    ).toThrowError(/family/i);
  });

  it('pins FIXED ids from two different declared lineages', () => {
    expect(EXP_P1_REVIEWER_PAIR.R1.modelId).toBe('llama-3.3-70b');
    expect(EXP_P1_REVIEWER_PAIR.R2.modelId).toBe('qwen3-235b-a22b-instruct-2507');
    expect(EXP_P1_REVIEWER_PAIR.R1.declaredLineage).not.toBe(EXP_P1_REVIEWER_PAIR.R2.declaredLineage);
    expect(EXP_P1_REVIEWER_PAIR.pairVersion).toMatch(/v\d+$/);
  });
});

// ── 4. Reviewer isolation ───────────────────────────────────────────────────

describe('R2 never sees R1 — SPEC §14.5', () => {
  it('the dispatched R2 prompt contains no trace of the first pass', async () => {
    let r2Text = '';
    const artifacts = await runFixtureReview({ onR2Call: (req) => { r2Text = `${req.system}\n${req.user}`; } });
    expect(artifacts.r1Decisions.length).toBeGreaterThan(0);
    for (const d of artifacts.r1Decisions) {
      expect(r2Text).not.toContain(d.outputHash);
      expect(r2Text).not.toContain(d.rawOutputRef);
      expect(r2Text).not.toContain(d.reason);
      expect(r2Text).not.toContain(`${d.subjectRef}: ${d.decision}`);
    }
  });

  it('the isolation gate catches a leak wherever it was introduced', () => {
    const prior: ReviewDecision[] = [
      {
        reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'inv.a', decision: 'independent',
        reason: 'predates the apparatus entirely', evidenceRefs: [], limitations: [],
        reviewedAt: 't', rawOutputRef: 'raw/r/R1', outputHash: 'abc123def456', reviewerRef: 'm',
      },
    ];
    // Every shape a leak plausibly takes: the commitment, the raw ref, the
    // rationale prose, and the hand-built "subject: label" summary.
    for (const leak of ['abc123def456', 'raw/r/R1', 'predates the apparatus entirely', 'inv.a: independent']) {
      try {
        assertPromptCarriesNoPriorAdjudication('R2', { system: 's', user: `rows\n${leak}\n` }, prior);
        throw new Error(`expected a refusal for leak ${JSON.stringify(leak)}`);
      } catch (e) {
        expect((e as ReviewRefusal).refusalCode).toBe('reviewer-isolation-breach');
      }
    }
    expect(() => assertPromptCarriesNoPriorAdjudication('R2', { system: 's', user: 'rows' }, prior)).not.toThrow();
    // Same-slot decisions are not foreign: a reviewer may see its own output.
    expect(() =>
      assertPromptCarriesNoPriorAdjudication('R1', { system: 's', user: 'abc123def456' }, prior),
    ).not.toThrow();
  });

  it('R2 COVERAGE may depend on the first pass even though the labels may not', async () => {
    // The distinction the design turns on. Stated executably so a reader does
    // not have to infer it from the absence of a counterexample.
    const artifacts = await runFixtureReview({ r1Label: 'unknown' });
    expect(artifacts.coverage.byRule.unknown.length).toBe(CLEAN_SUBJECTS.length);
  });
});

// ── 5. Contested, never averaged ────────────────────────────────────────────

describe('disagreement is surfaced, never averaged', () => {
  const signed = (slot: 'R1' | 'R2', decision: string, confidence: number): ReviewDecision => ({
    reviewId: 'r', reviewerSlot: slot, subjectRef: 'inv.x', decision,
    reason: `slot ${slot} reasoning`, evidenceRefs: [], limitations: [],
    reviewedAt: 't', rawOutputRef: `raw/${slot}`, outputHash: `hash-${slot}`, reviewerRef: `m-${slot}`, confidence,
  });

  it('two different labels produce ONE contested row carrying both verbatim', () => {
    const [r] = resolveDecisions({
      reviewId: 'r',
      subjectRefs: ['inv.x'],
      r1: [signed('R1', 'independent', 0.9)],
      r2: [signed('R2', 'domain-adjacent', 0.1)],
      r2Coverage: ['inv.x'],
      resolvedAt: 't',
    });
    expect(r.status).toBe('contested');
    expect(r.reviewer1Decision).toBe('independent');
    expect(r.reviewer2Decision).toBe('domain-adjacent');
    // No synthesised third label, and nowhere for a mean confidence to live.
    expect(Object.values(r)).not.toContain('independent-ish');
    expect(r).not.toHaveProperty('confidence');
    expect(JSON.stringify(r)).not.toContain('0.5');
  });

  it('a contested row is NOT eligible for local adoption', () => {
    const t = tallyResolutions(
      resolveDecisions({
        reviewId: 'r', subjectRefs: ['inv.x'],
        r1: [signed('R1', 'independent', 1)], r2: [signed('R2', 'target-derived', 1)],
        r2Coverage: ['inv.x'], resolvedAt: 't',
      }),
    );
    expect(t.contested).toBe(1);
    expect(t.eligibleForLocalAdoption).toBe(0);
  });

  it('a missing second pass on an assigned row is contested, not agreement', () => {
    const [r] = resolveDecisions({
      reviewId: 'r', subjectRefs: ['inv.x'],
      r1: [signed('R1', 'independent', 1)], r2: [], r2Coverage: ['inv.x'], resolvedAt: 't',
    });
    expect(r.status).toBe('contested');
    expect(r.resolutionReason).toMatch(/missing second pass/i);
  });

  it('agreement on `unknown` fails closed rather than reading as consensus', () => {
    const [r] = resolveDecisions({
      reviewId: 'r', subjectRefs: ['inv.x'],
      r1: [signed('R1', 'unknown', 1)], r2: [signed('R2', 'unknown', 1)], r2Coverage: ['inv.x'], resolvedAt: 't',
    });
    expect(r.status).toBe('unknown');
    expect(tallyResolutions([r]).eligibleForLocalAdoption).toBe(0);
  });

  it('only agreed rows carry a relation into the exporter; the rest fail closed there', () => {
    const resolutions = resolveDecisions({
      reviewId: 'r', subjectRefs: ['inv.x', 'inv.y'],
      r1: [signed('R1', 'independent', 1), { ...signed('R1', 'independent', 1), subjectRef: 'inv.y' }],
      r2: [signed('R2', 'target-derived', 1), { ...signed('R2', 'independent', 1), subjectRef: 'inv.y' }],
      r2Coverage: ['inv.x', 'inv.y'], resolvedAt: 't',
    });
    const { relations, exclusions } = exportRelations({
      resolutions, decisions: [], reviewerRef: 'review.test', reviewedAt: 't',
    });
    expect(Object.keys(relations)).toEqual(['inv.y']);
    expect(exclusions.map((e) => e.subjectRef)).toEqual(['inv.x']);
  });
});

// ── 6. Unsigned decisions ───────────────────────────────────────────────────

describe('an unsigned decision is refused', () => {
  const base: ReviewDecision = {
    reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'inv.x', decision: 'independent',
    reason: 'ok', evidenceRefs: [], limitations: [], reviewedAt: 't',
    rawOutputRef: 'raw/R1', outputHash: 'h', reviewerRef: 'm',
  };
  it.each([
    ['no attribution', { reviewerRef: '' }],
    ['no raw output reference', { rawOutputRef: '' }],
    ['no output commitment', { outputHash: '' }],
    ['no review timestamp', { reviewedAt: '' }],
  ])('refuses a decision with %s', (_label, over) => {
    expect(() => assertDecisionsSigned([{ ...base, ...over }])).toThrowError(/unsigned/i);
  });

  it('the resolver refuses unsigned input rather than resolving it', () => {
    expect(() =>
      resolveDecisions({
        reviewId: 'r', subjectRefs: ['inv.x'], r1: [{ ...base, outputHash: '' }], r2: [],
        r2Coverage: [], resolvedAt: 't',
      }),
    ).toThrowError(/unsigned/i);
  });

  it('accepts a fully signed decision', () => {
    expect(() => assertDecisionsSigned([base])).not.toThrow();
  });
});

// ── 7. Parsing fails closed ─────────────────────────────────────────────────

describe('parsing never fills a gap with a default', () => {
  const args = {
    reviewId: 'r', reviewerSlot: 'R1' as const, reviewerRef: 'm',
    rawOutputRef: 'raw/R1', reviewedAt: 't', expectedSubjectRefs: ['a', 'b'],
  };

  it('reports unanswered rows instead of assuming them fine', () => {
    const parsed = parseAdjudication({ ...args, raw: decisionScript(['a'], 'independent') });
    expect(parsed.unanswered).toEqual(['b']);
    expect(parsed.decisions).toHaveLength(1);
  });

  it('refuses a label outside the rubric and a decision with no reason', () => {
    expect(() =>
      parseAdjudication({ ...args, raw: JSON.stringify({ decisions: [{ subjectRef: 'a', decision: 'fine', reason: 'x' }] }) }),
    ).toThrowError(/not in the rubric/i);
    expect(() =>
      parseAdjudication({ ...args, raw: JSON.stringify({ decisions: [{ subjectRef: 'a', decision: 'independent', reason: '' }] }) }),
    ).toThrowError(/no reason/i);
  });

  it("refuses a bare 'domain-adjacent' — the permissive label carries the extra burden", () => {
    expect(() =>
      parseAdjudication({
        ...args,
        raw: JSON.stringify({ decisions: [{ subjectRef: 'a', decision: 'domain-adjacent', reason: 'yes' }] }),
      }),
    ).toThrowError(/substantive reason/i);
  });

  it('discards answers to rows the reviewer was never asked about', () => {
    const parsed = parseAdjudication({ ...args, raw: decisionScript(['a', 'zzz'], 'independent') });
    expect(parsed.unsolicited).toEqual(['zzz']);
  });
});

// ── 8. Block decision ───────────────────────────────────────────────────────

describe('a block decision reports its exceptions rather than presuming none', () => {
  const population = [
    ...Array.from({ length: 8 }, (_, i) => subject({ subjectRef: `inv.constitutional.${i}` })),
    ...Array.from({ length: 6 }, (_, i) => subject({ subjectRef: `inv.reasoning.${i}`, namespace: 'reasoning' })),
    subject({
      subjectRef: 'inv.engineering.dirty',
      namespace: 'engineering',
      statement: 'Invariant retrieval must fail closed when the slice is empty.',
    }),
  ];

  const build = (rules = expP1ClassCExceptionRules()) =>
    buildBlockDecision({
      blockId: 'block.test',
      ruling: CLASS_C_BLOCK_RULING,
      populationQuery: 'SELECT * FROM invariants WHERE namespace IN (…)',
      population,
      exceptionRules: rules,
      taskConstructionBegun: false,
      taskConstructionEvidence: 'no task specification exists',
      sampleSeed: 'block-seed',
      samplePerNamespace: 2,
    });

  it('refuses a block with no exception rules — a ruling that cannot fail is an assertion', () => {
    expect(() => build([])).toThrowError(/exception rules/i);
  });

  it('extracts the row derived from the pipeline under evaluation', () => {
    const b = build();
    expect(b.extracted.map((e) => e.subjectRef)).toContain('inv.engineering.dirty');
    expect(b.extracted.find((e) => e.subjectRef === 'inv.engineering.dirty')!.ruleIds)
      .toContain('mentions-experiment-or-target');
  });

  it('the admitted count is COMPUTED — a zero-exception result is an outcome, not a default', () => {
    const withNoRulesFiring = buildBlockDecision({
      blockId: 'b', ruling: CLASS_C_BLOCK_RULING, populationQuery: 'q',
      population: [subject({ subjectRef: 'inv.clean.1' })],
      exceptionRules: [mentionsAnyTerm('r', 'reason', ['a-term-that-appears-nowhere'])],
      taskConstructionBegun: false, taskConstructionEvidence: 'n/a',
      sampleSeed: 's', samplePerNamespace: 1,
    });
    expect(withNoRulesFiring.extracted).toHaveLength(0);
    expect(withNoRulesFiring.admitted).toBe(1);

    const b = build();
    expect(b.admitted).toBe(b.assessed - b.extracted.length);
    expect(b.admitted).toBeLessThan(b.assessed); // the count MOVED when a rule fired
    expect(blockDecisionIsArithmeticallySound(b)).toBe(true);
    // And a hand-set count is caught by the package builder, not trusted.
    expect(() => sealPackage({ subjects: CLEAN_SUBJECTS, blockDecisions: [{ ...b, admitted: b.assessed }] }))
      .toThrowError(/computed remainder/i);
  });

  it('records the exact query, the distributions, the date range and the chronology fact', () => {
    const b = build();
    expect(b.populationQuery).toMatch(/^SELECT/);
    expect(b.namespaceCounts).toMatchObject({ constitutional: 8, reasoning: 6, engineering: 1 });
    expect(Object.keys(b.createdAtCounts).length).toBeGreaterThan(0);
    expect(b.earliestCreatedAt).toBeTruthy();
    expect(b.latestCreatedAt).toBeTruthy();
    expect(b.taskConstructionBegun).toBe(false);
    expect(b.taskConstructionEvidence).toBeTruthy();
    expect(b.ruling.text).toBe(CLASS_C_BLOCK_RULING.text);
    expect(b.ruling.authority).toBe('operator-ratified');
  });

  it('samples PER NAMESPACE so a small doctrinal area cannot be smoothed away', () => {
    // A proportional sample of this population would frequently miss the single
    // engineering row — and engineering doctrine derived from defects in the
    // pipeline under evaluation is where the exceptions actually live.
    const b = build();
    const sampledNamespaces = new Set(
      b.representativeSample.map((ref) => population.find((p) => p.subjectRef === ref)!.namespace),
    );
    expect(sampledNamespaces).toEqual(new Set(['constitutional', 'reasoning', 'engineering']));
  });

  it('the recent-edit and unresolved-provenance rules fire on their own shapes', () => {
    const recent = subject({ subjectRef: 'inv.recent', createdAt: '2026-07-28T00:00:00.000Z' });
    const revised = subject({ subjectRef: 'inv.revised', revisedAt: '2026-07-28T00:00:00.000Z' });
    const bare = subject({ subjectRef: 'inv.bare', sourceRefs: [], derivationRefs: [] });
    const rule = createdOrRevisedOnOrAfter('r', 'reason', '2026-07-27');
    expect(rule.test(recent)).toBe(true);
    expect(rule.test(revised)).toBe(true);
    expect(rule.test(subject({ subjectRef: 'inv.old' }))).toBe(false);
    expect(unresolvedChronologyOrProvenance('u', 'reason').test(bare)).toBe(true);
  });
});

// ── 9. Coverage ─────────────────────────────────────────────────────────────

describe('second-review coverage is asymmetric, and private-source rows are mandatory', () => {
  const subjects = [
    subject({ subjectRef: 'a' }),
    subject({ subjectRef: 'b' }),
    subject({ subjectRef: 'private', privateEvidenceRef: 'summary/1' }),
    subject({ subjectRef: 'flagged' }),
    ...Array.from({ length: 20 }, (_, i) => subject({ subjectRef: `bulk-${i}`, namespace: 'reasoning' })),
  ];
  const dec = (ref: string, decision: string): ReviewDecision => ({
    reviewId: 'r', reviewerSlot: 'R1', subjectRef: ref, decision, reason: 'a sufficient reason',
    evidenceRefs: [], limitations: [], reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm',
  });
  const input = {
    subjects,
    r1Decisions: [
      dec('a', 'domain-adjacent'),
      dec('b', 'unknown'),
      dec('private', 'independent'),
      dec('flagged', 'independent'),
      ...Array.from({ length: 20 }, (_, i) => dec(`bulk-${i}`, 'independent')),
    ],
    packageExclusions: ['excluded-1'],
    mechanicallyFlagged: ['flagged'],
    sampleRate: 0.15,
    sampleSeed: 'coverage-seed',
  };

  it('includes every mandatory category', () => {
    const c = selectReviewer2Coverage(input);
    expect(c.byRule['domain-adjacent']).toEqual(['a']);
    expect(c.byRule.unknown).toEqual(['b']);
    expect(c.byRule['private-source']).toEqual(['private']);
    expect(c.byRule['mechanically-flagged']).toEqual(['flagged']);
    expect(c.byRule['proposed-exclusion']).toContain('excluded-1');
  });

  it('a private-source row is reviewed twice even when the sample would miss it', () => {
    // It reaches the external reviewer through an intermediary summary, so the
    // second pass is the only place the intermediation gets tested.
    const c = selectReviewer2Coverage({ ...input, sampleRate: 0 });
    expect(c.byRule['stratified-sample']).toHaveLength(0);
    expect(c.subjectRefs).toContain('private');
    expect(() => assertCoverageComplete(c, input)).not.toThrow();
  });

  it('assertCoverageComplete catches a private-source row that fell out', () => {
    const c = selectReviewer2Coverage({ ...input, sampleRate: 0 });
    const damaged = { ...c, subjectRefs: c.subjectRefs.filter((r) => r !== 'private') };
    expect(() => assertCoverageComplete(damaged, input)).toThrowError(/private-source/i);
  });

  it('samples ordinary `independent` rows per stratum, deterministically and re-derivably', () => {
    const c1 = selectReviewer2Coverage(input);
    const c2 = selectReviewer2Coverage(input);
    expect(c1.subjectRefs).toEqual(c2.subjectRefs);
    expect(c1.byRule['stratified-sample'].length).toBeGreaterThan(0);
    expect(c1.byRule['stratified-sample'].length).toBeLessThan(20);
    // Re-derivable by a third party holding only the seed and the population.
    expect(
      proportionalStratifiedSample(
        'coverage-seed',
        Array.from({ length: 20 }, (_, i) => ({ key: `bulk-${i}`, stratum: 'reasoning' })),
        0.15,
      ),
    ).toEqual(c1.byRule['stratified-sample'].filter((r) => r.startsWith('bulk-')));
  });

  it('refuses a sample with no committed seed', () => {
    expect(() => selectReviewer2Coverage({ ...input, sampleSeed: '  ' })).toThrowError(/seed/i);
  });
});

// ── 10. Private evidence ────────────────────────────────────────────────────

describe('a private evidence summary is evidence, not authority', () => {
  const clean: PrivateEvidenceSummary = {
    invariantId: 'inv.private.1',
    sourceCommitment: 'ab12cd34ef56ab78',
    sourceClass: 'confidential-operating-record',
    sourcePredatesTaskConstruction: true,
    sourcePredatesPilotOutcomes: true,
    derivedFromTargetSystem: false,
    derivedFromTaskOrExpectedAnswer: false,
    revisedAfterObservedOutcome: false,
    derivationMethod: 'manual extraction by a named local reviewer',
    factualBasis: 'a dated internal record predating the apparatus',
    localReviewerRef: 'local.reviewer.1',
    reviewedAt: '2026-07-29T00:00:00.000Z',
    signatureOrReceiptRef: 'receipt:abc',
  };

  it('a sufficient summary determines NOTHING — it forces no label', () => {
    const a = assessPrivateEvidence(clean, clean.invariantId);
    expect(a.verdict).toBe('sufficient');
    expect(a.forcedRelation).toBeNull();
    // The whole module: no function anywhere maps a summary to an admissible label.
    expect(Object.keys(a)).not.toContain('relation');
  });

  it('the reviewer may still answer `unknown` over a perfectly clean summary', () => {
    // Executable statement of "evidence, not authority": the pipeline records
    // the reviewer's answer, never the summary's implication.
    const [r] = resolveDecisions({
      reviewId: 'r', subjectRefs: ['inv.private.1'],
      r1: [{
        reviewId: 'r', reviewerSlot: 'R1', subjectRef: 'inv.private.1', decision: 'unknown',
        reason: 'the summary asserts cleanliness I cannot verify', evidenceRefs: [], limitations: [],
        reviewedAt: 't', rawOutputRef: 'raw', outputHash: 'h', reviewerRef: 'm',
      }],
      r2: [], r2Coverage: [], resolvedAt: 't',
    });
    expect(r.status).toBe('unknown');
  });

  it.each([
    ['unavailable', null],
    ['missing derivation method', { ...clean, derivationMethod: '' }],
    ['unverifiable — no signature', { ...clean, signatureOrReceiptRef: '' }],
    ['contradictory — predates tasks yet derived from them', { ...clean, derivedFromTaskOrExpectedAnswer: true }],
  ])('forces `unknown` when the summary is %s', (_label, summary) => {
    const a = assessPrivateEvidence(summary as PrivateEvidenceSummary | null, 'inv.private.1');
    expect(a.verdict).toBe('insufficient');
    expect(a.forcedRelation).toBe('unknown');
    expect(a.findings.length).toBeGreaterThan(0);
  });

  it('does NOT classify every private-source row `unknown` by default', () => {
    // The ruling's central correction: a blanket rule would collapse the
    // population and privilege publicly shareable evidence over valid
    // confidential evidence.
    expect(assessPrivateEvidence(clean, clean.invariantId).forcedRelation).toBeNull();
  });

  it('refuses a summary that over-discloses', () => {
    expect(() => assertSummaryDisclosureSafe(clean)).not.toThrow();
    expect(() =>
      assertSummaryDisclosureSafe({ ...clean, factualBasis: 'persona 550e8400-e29b-41d4-a716-446655440000 wrote it' }),
    ).toThrowError(/UUID/i);
    expect(() =>
      assertSummaryDisclosureSafe({ ...clean, standing: 9 } as unknown as PrivateEvidenceSummary),
    ).toThrowError(/blinded/i);
  });
});

// ── 11. The receipt records the event, not an approval ──────────────────────

describe('the review receipt does not ratify — held in the data, not only the prose', () => {
  it('carries four explicit negative facts even on a fully agreed run', async () => {
    const artifacts = await runFixtureReview();
    expect(artifacts.tally.contested).toBe(0);
    expect(artifacts.tally.agreed).toBe(CLEAN_SUBJECTS.length);
    const p = artifacts.receipt.payload;
    expect(p.ratifiesAsset).toBe(false);
    expect(p.grantsStanding).toBe(false);
    expect(p.changesLifecycle).toBe(false);
    expect(p.freezesAsset).toBe(false);
    expect(p.authorityNote).toMatch(/does not ratify/i);
    expect(reviewReceiptGrantsApproval(p)).toBe(false);
  });

  it('records requested AND resolved model ids, both output commitment sets, and the tally', async () => {
    const artifacts = await runFixtureReview();
    const p = artifacts.receipt.payload;
    expect(p.reviewers.map((r) => r.requestedModelId)).toEqual(['model-a', 'model-b']);
    expect(p.reviewers.map((r) => r.resolvedModelId)).toEqual(['model-a-2026', 'model-b-2026']);
    expect(p.rawOutputCommitments).toHaveLength(2);
    expect(p.parsedOutputCommitments).toHaveLength(2);
    expect(p.packageHash).toBe(artifacts.preRunManifest.packageHash);
    expect(p.promptVersion).toBe(INDEPENDENCE_PROMPT_VERSION);
  });

  it('flags an unresolved run as awaiting governed resolution', () => {
    const built = buildReviewReceipt({
      request: buildReviewRequest({
        reviewId: 'r', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'q',
        rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'p', pkg: sealPackage(),
        requestedAt: 't', requestedByRef: 'steward',
      }),
      assetRef: 'a', assetCommitment: 'c',
      assignments: [MODEL_A, MODEL_B],
      steward: { stewardRef: 'steward', interim: false },
      blockDecisions: [],
      rawOutputCommitments: ['x'], parsedOutputCommitments: ['y'],
      tally: { agreed: 1, contested: 2, rejected: 0, unknown: 0, accepted: 0, deferred: 0, eligibleForLocalAdoption: 1 },
      promptVersion: INDEPENDENCE_PROMPT_VERSION, rubricRef: INDEPENDENCE_RUBRIC_ID,
      rubricVersion: INDEPENDENCE_RUBRIC_VERSION, reviewStartedAt: 't', reviewCompletedAt: 't',
    });
    expect(built.payload.resolutionStatus).toBe('awaiting-governed-resolution');
    expect(built.actionType).toBe('independent_review_completed');
    expect(built.summary).not.toMatch(/approv|ratif(?!ication)/i);
  });

  it('the anchorable action type and the TypeScript union agree', () => {
    const dvn = readFileSync(join(REPO, 'services/dvn/activityReceiptDvnPipeline.ts'), 'utf8');
    const svc = readFileSync(join(REPO, 'services/receipts/activityReceiptService.ts'), 'utf8');
    expect(dvn).toContain("'independent_review_completed',");
    expect(svc).toContain("| 'independent_review_completed'");
  });
});

// ── 12. No reviewer path can write ──────────────────────────────────────────

describe('the review path cannot reach the corpus', () => {
  function reviewSources(): Array<{ file: string; src: string }> {
    const out: Array<{ file: string; src: string }> = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.ts')) out.push({ file: p.replace(`${REPO}/`, ''), src: readFileSync(p, 'utf8') });
      }
    };
    walk(REVIEW_DIR);
    return out;
  }

  it('finds the modules it is supposed to be scanning', () => {
    // A floor, so the assertions below cannot pass vacuously because the walk
    // broke or the directory moved.
    const files = reviewSources();
    expect(files.length).toBeGreaterThanOrEqual(13);
    expect(files.map((f) => f.file)).toContain('services/research/review/runner.ts');
  });

  it('imports no database client and issues no table query', () => {
    const forbidden = [
      /from\s+['"]@supabase\//,
      /\bcreateClient\s*\(/,
      /getSupabaseServer/,
      /supabaseAdmin/,
      /\.from\(\s*['"`]/,
      /SUPABASE_SERVICE_ROLE_KEY/,
    ];
    for (const { file, src } of reviewSources()) {
      for (const rx of forbidden) {
        expect(rx.test(src), `${file} must not reach a database: matched ${rx}`).toBe(false);
      }
    }
  });

  it('performs no lifecycle change, Standing grant, canonization or freeze', () => {
    // Call shapes, not the words: the receipt payload's authority note has to
    // be able to SAY that it does not canonize anything.
    const forbidden = [
      /grantStanding\s*\(/, /canoniz[ea]\w*\s*\(/i, /freeze\w*\s*\(/i,
      /updateLifecycle\s*\(/, /setStanding\s*\(/, /markCanonical\s*\(/i,
    ];
    for (const { file, src } of reviewSources()) {
      for (const rx of forbidden) {
        expect(rx.test(src), `${file} must not mutate governed state: matched ${rx}`).toBe(false);
      }
    }
  });

  it('no role in the authority model may edit source assets or grant Standing', () => {
    for (const [role, a] of Object.entries(REVIEW_ROLE_AUTHORITY)) {
      expect(a.mayEditSourceAssets, role).toBe(false);
      expect(a.mayGrantStanding, role).toBe(false);
      expect(a.mayCanonize, role).toBe(false);
      expect(a.mayChangeLifecycle, role).toBe(false);
    }
    // The authority SPLIT: the routine reviewer and the final governed authority
    // are not the same party.
    expect(REVIEW_ROLE_AUTHORITY.reviewer.mayApproveFreeze).toBe(false);
    expect(REVIEW_ROLE_AUTHORITY['independent-review-steward'].mayApproveFreeze).toBe(false);
    expect(REVIEW_ROLE_AUTHORITY['independent-review-steward'].mayResolveContested).toBe(true);
    expect(REVIEW_ROLE_AUTHORITY.operator.mayApproveFreeze).toBe(true);
    expect(REVIEW_ROLE_AUTHORITY.operator.mayAdjudicate).toBe(false);
  });
});

// ── 13. Determinism ─────────────────────────────────────────────────────────

describe('package construction and hashing read no clock and no random source', () => {
  it('the review modules contain no Date.now / Math.random / new Date()', () => {
    const walk = (dir: string, acc: Array<{ file: string; src: string }> = []) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, acc);
        else if (name.endsWith('.ts')) acc.push({ file: p.replace(`${REPO}/`, ''), src: readFileSync(p, 'utf8') });
      }
      return acc;
    };
    for (const { file, src } of walk(REVIEW_DIR)) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(/Date\.now\(/.test(code), `${file}`).toBe(false);
      expect(/Math\.random\(/.test(code), `${file}`).toBe(false);
      expect(/new Date\(/.test(code), `${file}`).toBe(false);
    }
  });

  it('the same inputs always produce the same package hash', () => {
    expect(sealPackage().packageHash).toBe(sealPackage().packageHash);
    expect(verifyPackageHash(sealPackage())).toBe(true);
  });

  it('a seeded sample is stable and re-derivable', () => {
    const keys = Array.from({ length: 30 }, (_, i) => `k${i}`);
    expect(seededTake('s', keys, 5)).toEqual(seededTake('s', keys, 5));
    expect(seededTake('s', keys, 5)).not.toEqual(seededTake('other-seed', keys, 5));
    expect(seededTake('s', [...keys].reverse(), 5)).toEqual(seededTake('s', keys, 5));
  });
});

// ── 14. The generic layer names no instance ─────────────────────────────────

describe('the capability is generic — EXP-P1 is a template, not the subject', () => {
  it('no instance identifier appears outside templates/', () => {
    // `IRL-REVIEW-001` is the CAPABILITY's own identifier and is expected here.
    // What must not appear is the first instance: its experiment id, its
    // subject corpus, or any of the products in its non-target list.
    const forbidden = [
      /exp[-_]?p1/i, /moneypenny/i, /cryptosent/i, /qriptocent/i, /marketa/i,
      /vl-ct-001/i, /crystal/i, /invariant corpus/i,
    ];
    const walk = (dir: string, acc: Array<{ file: string; src: string }> = []) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'templates') continue;
          walk(p, acc);
        } else if (name.endsWith('.ts')) {
          acc.push({ file: p.replace(`${REPO}/`, ''), src: readFileSync(p, 'utf8') });
        }
      }
      return acc;
    };
    const files = walk(REVIEW_DIR);
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const { file, src } of files) {
      for (const rx of forbidden) {
        expect(rx.test(src), `${file} names an instance-specific identifier: ${rx}`).toBe(false);
      }
    }
  });

  it('the template supplies every instance-specific input the generic layer requires', () => {
    expect(EXP_P1_TARGET_STATEMENT.length).toBeGreaterThan(80);
    expect(EXP_P1_NON_TARGETS.length).toBeGreaterThanOrEqual(4);
    expect(CLASS_C_BLOCK_RULING.authority).toBe('operator-ratified');
  });
});

// ── 15. The vP1 namespace boundary ──────────────────────────────────────────

describe('the vP1 boundary excludes style and narrative, with reasons recorded', () => {
  it('style and narrative are OUT of the confirmatory boundary', () => {
    expect(EXP_P1_NAMESPACE_BOUNDARY).not.toContain('style');
    expect(EXP_P1_NAMESPACE_BOUNDARY).not.toContain('narrative');
    expect(EXP_P1_NAMESPACE_BOUNDARY).toEqual(
      ['capability', 'commercialisation', 'constitutional', 'cybernetics', 'engineering', 'epistemology',
        'experience', 'finance', 'interaction', 'polity', 'reasoning', 'representation', 'sovereignty'],
    );
  });

  it('each exclusion records a reason, and the reason is construct clarity — not lack of value', () => {
    for (const ns of ['style', 'narrative']) {
      expect(EXP_P1_BOUNDARY_EXCLUSIONS[ns]).toMatch(/construct clarity/i);
      expect(EXP_P1_BOUNDARY_EXCLUSIONS[ns]).toMatch(/outcome measures/i);
    }
  });

  it('the exporter script agrees with the template — the boundary is not two lists', () => {
    // The .mjs cannot import TypeScript, so the duplication is unavoidable and
    // is canaried rather than trusted (CLAUDE.md, source-of-truth parity).
    const mjs = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf8');
    const block = /const EXP_P1_NAMESPACES = new Set\(\[([\s\S]*?)\]\);/.exec(mjs);
    expect(block).not.toBeNull();
    const scriptBoundary = [...block![1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect(scriptBoundary).toEqual([...EXP_P1_NAMESPACE_BOUNDARY].sort());

    const exclusions = /const EXP_P1_BOUNDARY_EXCLUSIONS = \{([\s\S]*?)\n\};/.exec(mjs);
    expect(exclusions).not.toBeNull();
    for (const ns of Object.keys(EXP_P1_BOUNDARY_EXCLUSIONS)) {
      expect(exclusions![1]).toContain(`${ns}:`);
    }
    expect(mjs).toContain('boundary_exclusions: EXP_P1_BOUNDARY_EXCLUSIONS');
  });
});

// ── 16. Providers are pluggable; credentials fail loudly ────────────────────

describe('providers are pluggable and a missing credential is loud', () => {
  it('a second provider implementation drives the identical runner path', async () => {
    // The seam is real, not aspirational: the whole review above ran on a
    // provider that is not the default vendor.
    const artifacts = await runFixtureReview();
    expect(artifacts.r1Decisions.length).toBeGreaterThan(0);
    expect(artifacts.receipt.payload.reviewers).toHaveLength(2);
  });

  it('a human slot returns the same decision schema through the same seam', async () => {
    const human = createFileBackedProvider({
      reviewerRef: 'steward.human',
      rawDecisions: decisionScript(['a'], 'independent'),
    });
    const res = await human.adjudicate({ modelId: 'human', system: '', user: '', determinism: DEFAULT_DETERMINISM });
    const parsed = parseAdjudication({
      reviewId: 'r', reviewerSlot: 'R2', reviewerRef: 'steward.human', raw: res.raw,
      rawOutputRef: 'raw/human', reviewedAt: 't', expectedSubjectRefs: ['a'],
    });
    expect(parsed.decisions[0].decision).toBe('independent');
    expect(parsed.decisions[0].reviewerRef).toBe('steward.human');
    await expect(human.listModels()).rejects.toThrowError(/catalogue/i);
  });

  it('refuses an unattributable or empty human adjudication', () => {
    expect(() => createFileBackedProvider({ reviewerRef: '', rawDecisions: '{}' })).toThrowError(/attributable/i);
    expect(() => createFileBackedProvider({ reviewerRef: 'x', rawDecisions: '   ' })).toThrowError(/no adjudication/i);
  });

  it('the default provider refuses to construct without its credential', async () => {
    const { createVeniceProvider } = await import('@/services/research/review/providers');
    const prior = process.env.VENICE_API_KEY;
    delete process.env.VENICE_API_KEY;
    try {
      expect(() => createVeniceProvider()).toThrowError(/VENICE_API_KEY/);
      // Loud, and specifically NOT a degrade: the message says why.
      try {
        createVeniceProvider();
      } catch (e) {
        expect((e as ReviewRefusal).refusalCode).toBe('missing-provider-credential');
        expect((e as Error).message).toMatch(/never be recorded as a review that found nothing/i);
      }
    } finally {
      if (prior !== undefined) process.env.VENICE_API_KEY = prior;
    }
  });
});

// ── 17. The redacted preview IS the dispatched package ──────────────────────

describe('the redacted preview is the same object the reviewers receive', () => {
  it('preview hash equals the dispatched package hash', async () => {
    const pkg = sealPackage();
    const preview = redactedPreview(pkg);
    expect(preview.packageHash).toBe(pkg.packageHash);
    expect(preview.hashVerified).toBe(true);
    expect(preview.package).toBe(pkg);
  });

  it('a package mutated after sealing fails the preview rather than being shown as clean', () => {
    const pkg = sealPackage();
    (pkg.subjects[0] as unknown as Record<string, unknown>).standing = 9;
    expect(() => redactedPreview(pkg)).toThrowError(/blinded/i);
  });

  it('the runner refuses a package whose hash no longer matches its content', async () => {
    const pkg = sealPackage();
    pkg.subjects[0].statement = 'quietly edited after sealing';
    const request = buildReviewRequest({
      reviewId: 'review.test', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'q',
      rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'p', pkg, requestedAt: 't', requestedByRef: 'steward',
    });
    await expect(
      runDualReview({
        request, pkg,
        r1: { assignment: MODEL_A, provider: createScriptedProvider({ responses: {} }) },
        r2: { assignment: MODEL_B, provider: createScriptedProvider({ responses: {} }) },
        steward: { stewardRef: 's', interim: false },
        determinism: DEFAULT_DETERMINISM,
        coverage: { sampleRate: 1, sampleSeed: 's', mechanicallyFlagged: [] },
        assetRef: 'a', assetCommitment: 'c', now: () => 't',
      }),
    ).rejects.toThrowError(/modified after sealing/i);
  });
});

// ── 18. Reproducibility ─────────────────────────────────────────────────────

describe('reproducibility artifacts are committed before the first model call', () => {
  it('the pre-run manifest exists and carries everything a rerun needs', async () => {
    const seen: string[] = [];
    const pkg = sealPackage();
    const refs = pkg.subjects.map((s) => s.subjectRef);
    const request = buildReviewRequest({
      reviewId: 'review.test', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'q',
      rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'p', pkg, requestedAt: 't', requestedByRef: 'steward',
    });
    let t = 0;
    const artifacts = await runDualReview({
      request, pkg,
      r1: {
        assignment: MODEL_A,
        provider: createScriptedProvider({
          responses: { 'model-a-2026': decisionScript(refs, 'independent') },
          onCall: () => seen.push('r1-called'),
        }),
      },
      r2: {
        assignment: MODEL_B,
        provider: createScriptedProvider({
          responses: { 'model-b-2026': decisionScript(refs, 'independent') },
          onCall: () => seen.push('r2-called'),
        }),
      },
      steward: { stewardRef: 's', interim: false },
      determinism: DEFAULT_DETERMINISM,
      coverage: { sampleRate: 1, sampleSeed: 's', mechanicallyFlagged: [] },
      assetRef: 'a', assetCommitment: 'c',
      now: () => `2026-07-29T00:00:0${t++}.000Z`,
      onStep: (step) => seen.push(step),
    });
    // The manifest is committed BEFORE either reviewer is called — otherwise a
    // run that went badly could be re-run with different settings and still look
    // like the original.
    expect(seen.indexOf('pre-run-manifest')).toBeLessThan(seen.indexOf('r1-called'));
    expect(seen.indexOf('pre-run-manifest')).toBeLessThan(seen.indexOf('r2-called'));

    const m = artifacts.preRunManifest;
    expect(m.assignments.map((a) => a.resolvedModelId)).toEqual(['model-a-2026', 'model-b-2026']);
    expect(m.promptVersion).toBe(INDEPENDENCE_PROMPT_VERSION);
    expect(m.rubricVersion).toBe(INDEPENDENCE_RUBRIC_VERSION);
    expect(m.determinism.temperature).toBe(0);
    expect(m.coverageSampleSeed).toBe('s');
    expect(m.manifestCommitment).toHaveLength(64);
    expect(artifacts.rawOutputs).toHaveLength(2);
    expect(artifacts.rawOutputs.every((r) => r.outputHash.length === 64)).toBe(true);
  });

  it('an interim steward must record why the arrangement is interim', async () => {
    const pkg = sealPackage();
    const request = buildReviewRequest({
      reviewId: 'review.test', assetType: 'invariant-set', reviewMode: 'dual', reviewQuestion: 'q',
      rubricId: INDEPENDENCE_RUBRIC_ID, packageRef: 'p', pkg, requestedAt: 't', requestedByRef: 'steward',
    });
    await expect(
      runDualReview({
        request, pkg,
        r1: { assignment: MODEL_A, provider: createScriptedProvider({ responses: {} }) },
        r2: { assignment: MODEL_B, provider: createScriptedProvider({ responses: {} }) },
        steward: { stewardRef: 'operator', interim: true },
        determinism: DEFAULT_DETERMINISM,
        coverage: { sampleRate: 1, sampleSeed: 's', mechanicallyFlagged: [] },
        assetRef: 'a', assetCommitment: 'c', now: () => 't',
      }),
    ).rejects.toThrowError(/interim/i);
  });
});
