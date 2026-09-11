/**
 * DUPLICATE RESOLUTION — an exception surface that terminates in an executable
 * decision (operator ruling, 2026-08-03).
 *
 *   > "Present the smallest safe decision at the point where the exception
 *   >  appears, with the evidence and consequence already assembled."
 *
 *   > "An exception surface is incomplete unless it offers the next safe act in
 *   >  context."
 *
 * These defend the OPERATOR-EXPERIENCE invariants II–IX: the panel must carry
 * evidence, recommendation, rationale, consequence and action; it must never
 * send the operator to find a record the system already holds; and the
 * recommended act must be prepared, not authored from scratch.
 *
 * Subject selection is by the PROPERTY UNDER TEST throughout, never by array
 * index — the child rule of the ratified CANARY-REPRODUCES-DEFECT invariant
 * (CI-2026-08-03-CANARY-SUBJECT-SELECTION-001).
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  composeDuplicateResolution,
  dryRunDuplicateResolution,
  extractedChars,
  metadataCompleteness,
  renderDuplicateDryRun,
  scoreCopy,
  DUPLICATE_TREATMENTS,
  type DuplicateCandidateFacts,
} from '@/services/corpusScout/duplicateResolution';
import type { DuplicateGroup } from '@/services/corpusScout/intelligence';

/**
 * Fixtures shaped like the operator's LIVE screenshot pair, using the real
 * source-id format and the real field names (OS-9: fixture from production
 * shape, not from the writer's convenience).
 */
const CANONICAL_ID = 'SRC-review-research-sa-54ec9bf370';
const ALIAS_ID = 'SRC-review-research-sa-bb42816ac5';
const SHARED_HASH = 'a'.repeat(64);

function facts(overrides: Partial<DuplicateCandidateFacts> = {}): DuplicateCandidateFacts {
  return {
    sourceId: CANONICAL_ID,
    title: 'Survey of the users of BIS research',
    canonicalUrl: 'https://www.bis.org/publ/research.pdf',
    artifactHash: SHARED_HASH,
    pageCount: 76,
    issuer: 'BIS',
    publicationDate: '2026-01-01',
    authors: ['BIS'],
    extractionStatus: 'ok',
    extractionWarnings: [],
    reviewWorkflowStatus: 'pending_review',
    campaignSubDomain: 'banking',
    evidenceRowId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    normalizedTextChars: 40_000,
    ...overrides,
  };
}

/** The weaker copy from the operator's example: same bytes, thinner record. */
function weakerCopy(overrides: Partial<DuplicateCandidateFacts> = {}): DuplicateCandidateFacts {
  return facts({
    sourceId: ALIAS_ID,
    artifactHash: null,
    pageCount: null,
    publicationDate: null,
    authors: [],
    extractionStatus: 'below-threshold',
    campaignSubDomain: null,
    createdAt: '2026-08-02T00:00:00.000Z',
    normalizedTextChars: 900,
    ...overrides,
  });
}

const group = (sourceIds: string[]): DuplicateGroup => ({
  matchType: 'artifact-hash',
  key: SHARED_HASH,
  sourceIds,
});

// ── 1 · THE RECOMMENDATION IS DERIVED AND EXPLAINED ────────────────────────

describe('the panel derives a canonical copy and says why (UX II, III, VI)', () => {
  const plan = composeDuplicateResolution({
    group: group([CANONICAL_ID, ALIAS_ID]),
    rows: [facts(), weakerCopy()],
  });

  it("recommends the operator's own expected canonical for the live pair", () => {
    // The worked example. Mutation: drop the artifact-hash or extraction
    // weight -> the thinner copy can win and the recommendation inverts.
    expect(plan.kind).toBe('recommended-resolution-available');
    expect(plan.canonicalSourceId).toBe(CANONICAL_ID);
    expect(plan.aliasSourceIds).toEqual([ALIAS_ID]);
  });

  it('explains WHY in the terms the operator used — from real fields only', () => {
    const why = plan.why.join(' ');
    expect(why).toMatch(/complete artifact hash present/);
    expect(why).toMatch(/successful extraction/);
    expect(why).toMatch(/metadata field\(s\) captured/);
  });

  it('states why the system considers them duplicates at all', () => {
    expect(plan.duplicateBasis).toMatch(/Identical artifact hash/);
    expect(plan.duplicateBasis).toMatch(/same underlying document bytes/);
  });

  it('shows EVERY member side by side with its own signals — none is dropped', () => {
    // Selected by sourceId, never by position.
    const shown = plan.copies.map((c) => c.sourceId).sort();
    expect(shown).toEqual([ALIAS_ID, CANONICAL_ID].sort());
    const alias = plan.copies.find((c) => c.sourceId === ALIAS_ID);
    expect(alias, 'the alias must be presented too, not hidden').toBeDefined();
    expect(alias!.signals.length).toBeGreaterThan(0);
  });

  it('pre-populates an editable rationale — never blank (UX VI)', () => {
    // Mutation: return '' and let the UI ask the operator to type one -> the
    // operator authors from scratch, which the ruling forbids.
    expect(plan.rationale).toMatch(new RegExp(`Selected ${CANONICAL_ID} as the canonical copy because`));
    expect(plan.rationale).toMatch(new RegExp(`Preserved ${ALIAS_ID} as an exact-duplicate alias`));
    expect(plan.rationale).toMatch(/excluded it from duplicate ingestion/);
  });

  it('states the consequence BEFORE the act, including that both records survive', () => {
    const consequence = plan.consequence.join(' ');
    expect(consequence).toMatch(/BOTH RECORDS ARE PRESERVED/);
    expect(consequence).toMatch(/Aliasing is not deletion/);
    expect(consequence).toMatch(/excluded from ingestion/);
    expect(consequence).toMatch(/No unrelated record is affected/);
  });

  it('offers the four treatments the ruling names', () => {
    expect([...DUPLICATE_TREATMENTS]).toEqual([
      'accept-recommendation',
      'choose-other-copy',
      'keep-both-as-distinct-editions',
      'defer',
    ]);
  });
});

// ── 2 · THE TWO CLASSES OF EXCEPTION ───────────────────────────────────────

describe('exceptions are split by whether judgement is actually needed', () => {
  it('identical copies yield GENUINE JUDGMENT REQUIRED, not a coin-flip recommendation', () => {
    // Two rows with identical signals cannot be separated. Mutation: fall back
    // to "first by id" -> the system invents a preference it does not have and
    // presents a guess as a derivation.
    const a = facts({ sourceId: 'SRC-aaa' });
    const b = facts({ sourceId: 'SRC-bbb' });
    const plan = composeDuplicateResolution({ group: group(['SRC-aaa', 'SRC-bbb']), rows: [a, b] });
    expect(plan.kind).toBe('genuine-judgment-required');
    expect(plan.canonicalSourceId).toBeNull();
    expect(plan.aliasSourceIds).toEqual([]);
    expect(plan.ambiguity).toMatch(/different editions, revisions, translations, or genuinely distinct works/);
  });

  it('even an ambiguous group gets a pre-populated rationale — the operator still never starts blank', () => {
    const plan = composeDuplicateResolution({
      group: group(['SRC-aaa', 'SRC-bbb']),
      rows: [facts({ sourceId: 'SRC-aaa' }), facts({ sourceId: 'SRC-bbb' })],
    });
    expect(plan.rationale.length).toBeGreaterThan(40);
    expect(plan.rationale).toMatch(/judgement/);
  });

  it('an ambiguous group blocks nothing — it stays isolated', () => {
    const plan = composeDuplicateResolution({
      group: group(['SRC-aaa', 'SRC-bbb']),
      rows: [facts({ sourceId: 'SRC-aaa' }), facts({ sourceId: 'SRC-bbb' })],
    });
    expect(plan.consequence.join(' ')).toMatch(/blocks nothing/);
  });
});

// ── 3 · THE QUALITY SIGNALS ARE REAL FIELDS ────────────────────────────────

describe('every signal is backed by a field that exists', () => {
  it('metadata completeness counts the four real bibliographic columns', () => {
    const full = metadataCompleteness(facts());
    expect(full.captured.sort()).toEqual(['authors', 'issuer', 'pageCount', 'publicationDate']);
    const thin = metadataCompleteness(weakerCopy());
    expect(thin.missing.sort()).toEqual(['authors', 'pageCount', 'publicationDate']);
  });

  it('extraction completeness reads the real length field, and unknown is not zero', () => {
    expect(extractedChars(facts({ normalizedTextChars: 1234 }))).toBe(1234);
    expect(extractedChars(facts({ normalizedTextChars: undefined, normalizedText: 'abc' }))).toBe(3);
    // Absent is null — "unknown" and "empty" are different facts.
    expect(extractedChars(facts({ normalizedTextChars: undefined, normalizedText: undefined }))).toBeNull();
  });

  it('an already-admitted copy is favoured for its existing lineage', () => {
    const scored = scoreCopy(facts({ evidenceRowId: 'ev-1' }), '2026-08-01T00:00:00.000Z');
    const lineage = scored.signals.find((s) => s.name === 'lineage');
    expect(lineage!.detail).toMatch(/already admitted as evidence/);
    expect(lineage!.points).toBeGreaterThan(0);
  });

  it('recency is only a TIE-BREAK — it can never outweigh a real quality difference', () => {
    // The later copy is richer; the earlier one gets only the tie-break point.
    // Mutation: raise the recency weight -> acquisition order starts deciding
    // canonicality, which is not a quality signal at all.
    const earlyThin = weakerCopy({ sourceId: 'SRC-early', createdAt: '2026-08-01T00:00:00.000Z' });
    const lateRich = facts({ sourceId: 'SRC-late', createdAt: '2026-08-09T00:00:00.000Z' });
    const plan = composeDuplicateResolution({
      group: group(['SRC-early', 'SRC-late']),
      rows: [earlyThin, lateRich],
    });
    expect(plan.canonicalSourceId).toBe('SRC-late');
  });
});

// ── 4 · PRESERVE BOTH RECORDS — the property most easily lost ──────────────

describe('aliasing preserves both records; no path deletes a source', () => {
  it('the dry run asserts zero deletions and zero unrelated records affected', () => {
    const plan = composeDuplicateResolution({
      group: group([CANONICAL_ID, ALIAS_ID]),
      rows: [facts(), weakerCopy()],
    });
    const d = dryRunDuplicateResolution([plan]);
    expect(d.recordsDeleted).toBe(0);
    expect(d.unrelatedRecordsAffected).toBe(0);
    expect(d.freezeImpact).toBe('none');
    expect(d.canonicalRetained).toBe(1);
    expect(d.aliasesExcluded).toBe(1);
    expect(d.duplicateRecords).toBe(2);
  });

  it('renders the dry run in the operator\'s own lines', () => {
    const plan = composeDuplicateResolution({
      group: group([CANONICAL_ID, ALIAS_ID]),
      rows: [facts(), weakerCopy()],
    });
    const lines = renderDuplicateDryRun(dryRunDuplicateResolution([plan]));
    expect(lines).toEqual([
      '2 duplicate record(s)',
      '1 canonical source(s) retained',
      '1 duplicate alias(es) excluded from ingestion',
      '0 record(s) deleted',
      '0 unrelated record(s) affected',
      'Freeze impact: none',
    ]);
  });

  it('NO CODE PATH DELETES A CANDIDATE SOURCE', () => {
    /*
     * The property the ruling names explicitly — "Preserve both records
     * always. Aliasing is not deletion." Asserted over the source itself
     * because a future refactor could satisfy every behavioural test above
     * while introducing a delete.
     *
     * Mutation: add `.delete()` against corpus_candidate_sources anywhere in
     * the resolution path -> this fails.
     */
    for (const path of [
      'services/corpusScout/duplicateResolution.ts',
      'app/api/corpus-scout/candidates/resolve-duplicates/route.ts',
      'services/corpusScout/reviewDecision.ts',
    ]) {
      const src = stripComments(readSource(path));
      expect(src, `${path} must not delete a candidate source`).not.toMatch(/\.delete\(\)/);
      expect(src, `${path} must not remove a source row`).not.toMatch(/from\('corpus_candidate_sources'\)[\s\S]{0,80}\.delete/);
    }
  });
});

// ── 5 · THE BATCH ACT OPERATES ONLY ON DETERMINISTIC RECOMMENDATIONS ───────

describe('resolve-all acts only where a recommendation exists', () => {
  const decided = composeDuplicateResolution({
    group: group([CANONICAL_ID, ALIAS_ID]),
    rows: [facts(), weakerCopy()],
  });
  const ambiguous = composeDuplicateResolution({
    group: { matchType: 'artifact-hash', key: 'b'.repeat(64), sourceIds: ['SRC-x', 'SRC-y'] },
    rows: [facts({ sourceId: 'SRC-x' }), facts({ sourceId: 'SRC-y' })],
  });

  it('the ambiguous group is SKIPPED BY NAME, never silently omitted', () => {
    // A group that vanished from the summary would look resolved.
    const d = dryRunDuplicateResolution([decided, ambiguous]);
    expect(d.groupKeys).toEqual([decided.groupKey]);
    const skipped = d.skipped.find((s) => s.groupKey === ambiguous.groupKey);
    expect(skipped, 'the ambiguous group must appear in `skipped`').toBeDefined();
    expect(skipped!.reason).toMatch(/do not separate these copies|no deterministic recommendation/);
  });

  it('counts cover only the actionable group', () => {
    const d = dryRunDuplicateResolution([decided, ambiguous]);
    expect(d.canonicalRetained).toBe(1);
    expect(d.aliasesExcluded).toBe(1);
    expect(d.recordsDeleted).toBe(0);
  });
});

// ── 6 · THE ROUTE REUSES THE EXISTING GOVERNED PATH ────────────────────────

describe('the executor introduces no parallel write path', () => {
  const ROUTE = 'app/api/corpus-scout/candidates/resolve-duplicates/route.ts';

  it('loops the EXISTING single-source applier, once per alias', () => {
    // Mutation: write review_workflow_status directly -> a second decision
    // path exists and the mark_duplicate refusals stop applying.
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/applyCandidateReviewDecision\(/);
    expect(src).toMatch(/decision: 'mark_duplicate'/);
    expect(src).toMatch(/duplicateOfSourceId: canonical/);
    expect(src, 'must not update the status column directly').not.toMatch(/review_workflow_status:/);
  });

  it('does NOT relax bulk-review\'s refusal of mark_duplicate', () => {
    // That refusal exists because the alias target is a per-source fact. This
    // route honours it by looping the single-source applier — it must not call
    // the bulk route at all.
    const src = stripComments(readSource(ROUTE));
    expect(src).not.toMatch(/bulk-review/);
    const bulk = stripComments(readSource('app/api/corpus-scout/candidates/bulk-review/route.ts'));
    expect(bulk, 'bulk-review must still refuse mark_duplicate').toMatch(/mark_duplicate cannot be applied in bulk/);
  });

  it('receipts through cohortAuthorization, not a forked receipt', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/buildCohortAuthorization\(/);
    expect(src).toMatch(/writeLifecycleReceipt\(/);
  });

  it('dryRun defaults TRUE — a forgotten flag previews', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/const dryRun = body\.dryRun !== false;/);
  });

  it('a canonical override is honoured only INSIDE its own group', () => {
    // An override naming a source outside the group would alias an unrelated
    // record — the one thing isolation forbids.
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/p\.copies\.some\(\(c\) => c\.sourceId === override\)/);
  });
});

// ── 7 · NEVER SEND THE OPERATOR LOOKING (UX III, VIII) ─────────────────────

describe('the surface never tells the operator to go and find the record', () => {
  it('the duplicate plan contains no navigation instruction', () => {
    /*
     * The literal defect: the old card said "Decide this source individually in
     * the review queue". Mutation: reinstate any "Go to…/Find…/Locate…"
     * phrasing in the resolution path -> this fails.
     */
    const plan = composeDuplicateResolution({
      group: group([CANONICAL_ID, ALIAS_ID]),
      rows: [facts(), weakerCopy()],
    });
    const prose = [plan.rationale, ...plan.why, ...plan.consequence, plan.duplicateBasis].join(' ');
    for (const forbidden of [/\bGo to\b/i, /\bFind\b/i, /\bLocate\b/i, /in the review queue/i, /individually/i]) {
      expect(prose, `the panel must not send the operator away: ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it('the module offers the act rather than describing where to perform it', () => {
    const src = stripComments(readSource('services/corpusScout/duplicateResolution.ts'));
    expect(src).toMatch(/accept-recommendation/);
    // The ambiguous branch may say a group stays for review; it must still not
    // instruct navigation.
    expect(src).not.toMatch(/Go to the review queue|Navigate to|Open the .* screen/i);
  });
});


// ── 8 · THE SURFACE ITSELF (operator invariants II–IX) ─────────────────────

describe('the panel presents the decision instead of describing where to make it', () => {
  const PANEL = 'components/research/Track2ProgrammePanel.tsx';

  it('renders every member side by side with the evidence the ruling names', () => {
    // Mutation: drop any of these fields -> the operator is asked to confirm a
    // canonical choice they cannot check.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('function DuplicateResolutionBoard');
    expect(at).toBeGreaterThan(-1);
    const board = src.slice(at, src.indexOf('function ExceptionsSurface'));
    for (const field of [
      'f.artifactHash',
      'f.pageCount',
      'f.extractionStatus',
      'f.campaignSubDomain',
      'f.evidenceRowId',
      'f.canonicalUrl',
      'copy.sourceId',
    ]) {
      expect(board, `${field} must be shown on each member`).toContain(field);
    }
  });

  it('answers all five questions in the same place', () => {
    const src = stripComments(readSource(PANEL));
    const board = src.slice(src.indexOf('function DuplicateResolutionBoard'), src.indexOf('function ExceptionsSurface'));
    expect(board, 'what happened').toMatch(/plan\.duplicateBasis/);
    expect(board, 'what is recommended').toMatch(/Recommended canonical source/);
    expect(board, 'why').toMatch(/plan\.why/);
    expect(board, 'what happens if I approve').toMatch(/plan\.consequence/);
    expect(board, 'the single action').toMatch(/Accept recommendation and continue/);
  });

  it('the rationale field is pre-populated from the plan, never empty', () => {
    // Mutation: default to '' -> the operator authors from scratch (UX VI).
    const src = stripComments(readSource(PANEL));
    const board = src.slice(src.indexOf('function DuplicateResolutionBoard'), src.indexOf('function ExceptionsSurface'));
    expect(board).toMatch(/rationales\[plan\.groupKey\] \?\? plan\.rationale/);
  });

  it('offers all four treatments without leaving the panel (UX VIII)', () => {
    const src = stripComments(readSource(PANEL));
    const board = src.slice(src.indexOf('function DuplicateResolutionBoard'), src.indexOf('function ExceptionsSurface'));
    expect(board).toMatch(/Accept recommendation and continue/);
    expect(board).toMatch(/Choose \{c\.sourceId/);
    expect(board).toMatch(/Defer this group/);
    expect(board).toMatch(/distinct editions/);
  });

  it('the batch act requires a preview first and excludes judgement groups', () => {
    const src = stripComments(readSource(PANEL));
    const board = src.slice(src.indexOf('function DuplicateResolutionBoard'), src.indexOf('function ExceptionsSurface'));
    expect(board).toMatch(/Resolve all recommended exceptions/);
    expect(board).toMatch(/disabled=\{busy \|\| !preview\}/);
    expect(board).toMatch(/needing genuine judgement are excluded/);
  });

  it('a group answered by the board is not ALSO listed in the exception list (one decision, one place)', () => {
    // Mutation: drop the resolvedGroupSourceIds filter -> the same problem
    // appears twice and the operator may act in the weaker place.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/resolvedGroupSourceIds/);
    const surface = src.slice(src.indexOf('function ExceptionsSurface'), src.indexOf('function ExceptionsSurface') + 2000);
    expect(surface).toMatch(/exceptions\.filter\(\(e\) => !\(resolvedGroupSourceIds\?\.has\(e\.recordId\)/);
  });
});
