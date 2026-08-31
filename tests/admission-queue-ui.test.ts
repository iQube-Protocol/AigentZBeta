/**
 * "Review & Admit machine-preparation" repair (2026-08-31) — UI-wiring source
 * canaries, mirroring `tests/institution-verification-ui.test.ts`'s own
 * pattern for `verificationTarget` one stage later.
 *
 * The forbidden result the operator named explicitly:
 *
 *   Run until you need me
 *     -> "Stage 2 — Review & Admit: 34 admitted, 18 awaiting review"
 *     -> 18 raw cards, each offering "Admit — reference only" /
 *        "Reject — low substance" as if it were the real judgment — INCLUDING
 *        sources already flagged as exact duplicates
 *     -> no CTA beyond "go open Corpus Scout yourself"
 *
 * These are source-level canaries (this repo has no React Testing Library
 * harness for these two files) pinning that:
 *   1. The Research Copilot renders a REAL prepared-cohort control when
 *      `decision.admissionQueue` is present, and that the generic
 *      "Open {stageLabel}" fallback excludes it (no double-render).
 *   2. The Copilot's "Resolve deterministic duplicates" drives the EXISTING
 *      `resolve-duplicates` route non-dry-run — never a second write path.
 *   3. `CorpusReviewQueue` auto-runs "Prepare recommendations" on load —
 *      never gated behind a manual click only.
 *   4. `CandidateReviewCard` SUPPRESSES the raw admit/reject dropdown for a
 *      duplicate-flagged source — the exact live defect reported ("already
 *      flagged as a duplicate... still requiring a fake human dropdown
 *      choice").
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const COPILOT = 'components/composer/IRLResearchCopilotTab.tsx';
const PANEL = 'components/research/Track2ProgrammePanel.tsx';

describe('the Research Copilot renders a PREPARED admission cohort, never 18 raw rows', () => {
  const src = stripComments(readSource(COPILOT));

  it('renders the prepared-cohort block gated on decision.admissionQueue (via the precomputed local, not a re-read of the possibly-undefined property)', () => {
    expect(src).toMatch(/const admissionQueue = decision\?\.admissionQueue \?\? null;/);
    expect(src).toMatch(/\{decision && admissionQueue && admissionQueue\.length > 0 && \(/);
  });

  it('the generic "Open {stageLabel}" fallback EXCLUDES admissionQueue decisions — never the CTA for a prepared cohort', () => {
    expect(src).toMatch(/!\(decision\.reviewQueue && decision\.reviewQueue\.length > 0\) && !\(admissionQueue && admissionQueue\.length > 0\)/);
  });

  it('"Resolve deterministic duplicates" drives the EXISTING resolve-duplicates route, non-dry-run — never a second write path', () => {
    const fnStart = src.indexOf('const resolveDeterministicDuplicates = useCallback');
    const fnEnd = src.indexOf('}, [observe, personaId, runProgramme]);', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/\/api\/corpus-scout\/candidates\/resolve-duplicates/);
    expect(fnBody).toMatch(/dryRun:\s*false/);
    // Continues the programme afterward — never leaves the operator staring
    // at a stale count.
    expect(fnBody).toMatch(/runProgramme\(experimentIdForDecision\)/);
  });

  it('the ObjectiveCard render call site threads the resolve-duplicates handler and its busy/error/status state', () => {
    expect(src).toMatch(/onResolveDuplicates=\{\(decision\) => void resolveDeterministicDuplicates\(decision\)\}/);
    expect(src).toMatch(/admissionRunning=\{admissionRunning\}/);
    expect(src).toMatch(/admissionError=\{admissionError\}/);
  });
});

describe('CorpusReviewQueue auto-prepares recommendations — never gated behind a manual click only', () => {
  const src = stripComments(readSource(PANEL));

  it('a useEffect fires prepareRecommendations once rows are loaded and no attempt is in flight or already failed', () => {
    const effectStart = src.indexOf('useEffect(() => {\n    if (rows && rows.length > 0 && recommendations === null');
    expect(effectStart, 'auto-prepare effect not found').toBeGreaterThan(-1);
    const effectBody = src.slice(effectStart, effectStart + 400);
    expect(effectBody).toMatch(/void prepareRecommendations\(\);/);
    // Guards against an infinite retry loop on a persistent failure.
    expect(effectBody).toMatch(/recsErr === null/);
    expect(effectBody).toMatch(/!recsLoading/);
  });

  it('a fresh queue load clears any stale prepare-error, so the auto-prepare effect can retry on a genuinely new queue', () => {
    const loadStart = src.indexOf('const load = useCallback');
    const loadEnd = src.indexOf('[acquisitionDomain]);', loadStart);
    const loadBody = src.slice(loadStart, loadEnd);
    expect(loadBody).toMatch(/setRecsErr\(null\);/);
  });
});

describe('CandidateReviewCard never offers the raw admit/reject dropdown for a duplicate-flagged source', () => {
  const src = stripComments(readSource(PANEL));

  it('the decision UI (the DECISIONS <select>) is gated on !isDuplicate — a duplicate renders a notice instead', () => {
    const cardStart = src.indexOf('function CandidateReviewCard');
    expect(cardStart).toBeGreaterThan(-1);
    const nextFnStart = src.indexOf('\nfunction ', cardStart + 1);
    const cardBody = src.slice(cardStart, nextFnStart > -1 ? nextFnStart : cardStart + 15000);
    expect(cardBody).toMatch(/isDuplicate \? \(/);
    // The duplicate branch must NOT contain the raw decision <select> — it
    // points the steward at the Duplicate Resolution board instead.
    const duplicateBranchStart = cardBody.indexOf('isDuplicate ? (');
    const elseStart = cardBody.indexOf(') : (', duplicateBranchStart);
    expect(elseStart).toBeGreaterThan(duplicateBranchStart);
    const duplicateBranch = cardBody.slice(duplicateBranchStart, elseStart);
    expect(duplicateBranch).not.toMatch(/DECISIONS\.map/);
    expect(duplicateBranch).toMatch(/Duplicate Resolution board/);
    // The raw decision UI (DECISIONS.map, the "Record decision" button) still
    // exists — for every NON-duplicate source — just gated to the else branch.
    const elseBranch = cardBody.slice(elseStart, elseStart + 3000);
    expect(elseBranch).toMatch(/DECISIONS\.map/);
    expect(elseBranch).toMatch(/Record decision/);
  });

  it('mark_duplicate is not part of the raw DECISIONS vocabulary — confirming the raw dropdown could never have offered a correct choice for a duplicate anyway', () => {
    const decisionsStart = src.indexOf('const DECISIONS');
    const decisionsEnd = src.indexOf('];', decisionsStart);
    const decisionsBlock = src.slice(decisionsStart, decisionsEnd);
    expect(decisionsBlock).not.toMatch(/mark_duplicate/);
  });
});
