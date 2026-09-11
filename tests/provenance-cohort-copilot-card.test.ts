/**
 * Research Copilot — "Classify Provenance completed by manual burden" repair
 * (2026-09-04), the Copilot-side half. Companion to `tests/provenance-cohort-ui.test.ts`
 * (the Track2ProgrammePanel board) and `tests/provenance-cohort-preparation.test.ts`
 * (the batched-triage perf fix). The reported live defect: the Copilot's own
 * remedy text already pointed at `GET .../provenance-cohort`, but clicking
 * through from the Copilot still landed the operator in "Record 1 of 55"
 * one-at-a-time classification, and the click could fail outright with
 * "programme state composition exceeded its 15000ms safety budget" — the
 * heavy `loadTrack2ProgrammeState` read this card used to depend on merely
 * to show up.
 *
 * These are source-level canaries (no React Testing Library harness for this
 * file) pinning that:
 *   1. The Copilot renders its OWN "Prepared — Classify Provenance" cohort
 *      card, independent of `decision`/`pendingDecision`.
 *   2. That card's data comes from a DIRECT fetch of the lightweight
 *      `/provenance-cohort` route — never derived from, or gated behind,
 *      the heavy `loadTrack2ProgrammeState` composition.
 *   3. Ratification POSTs the SAME route with `dryRun:false` +
 *      `expectedCohortHash` — never a second write path — and continues the
 *      programme automatically afterward (never leaves the operator to
 *      manually resume Validate/Relationships/Assignment).
 *   4. The card sits OUTSIDE the `decision`-block span
 *      `tests/track2-copilot-deep-link.test.ts` already pins (never
 *      reintroduces the `onOpenDetail`-inside-decision-block regression that
 *      guard exists to prevent).
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const COPILOT = 'components/composer/IRLResearchCopilotTab.tsx';

describe('the Copilot renders a PREPARED provenance cohort, never per-record navigation', () => {
  const src = stripComments(readSource(COPILOT));

  it('renders the cohort card gated on provenanceCohortPreview matching this objective — independent of `decision`', () => {
    expect(src).toMatch(/\{provenanceCohortPreview && provenanceCohortPreview\.experimentId === objective\.experimentId && \(/);
  });

  it('the card sits BEFORE the decision-block span (acquisitionBrief..{run &&(...)}) — never nested inside it, matching the sibling-card pattern every other decision card uses', () => {
    const cardAt = src.indexOf('{provenanceCohortPreview && provenanceCohortPreview.experimentId === objective.experimentId && (');
    const decisionBlockAt = src.indexOf('{decision && decision.acquisitionBrief && (');
    expect(cardAt).toBeGreaterThan(-1);
    expect(decisionBlockAt).toBeGreaterThan(-1);
    expect(cardAt).toBeLessThan(decisionBlockAt);
  });

  it('renders the counts and the single Ratify button in the requested shape', () => {
    expect(src).toMatch(/Prepared — Classify Provenance · \{provenanceCohortPreview\.total\} unclassified/);
    expect(src).toMatch(/ready for cohort ratification/);
    expect(src).toMatch(/isolated exception\(s\) — require individual review/);
    expect(src).toMatch(/Ratify provenance cohort/);
    expect(src).toMatch(/Inspect individually/);
  });
});

describe('provenance cohort preview — fetched DIRECTLY from the lightweight route, never through the heavy composition', () => {
  const src = stripComments(readSource(COPILOT));

  it('the refresh() loop fetches /provenance-cohort only when this stage is the pending one, never unconditionally', () => {
    const gateAt = src.indexOf('if (data.pendingDecision?.stageId === "classify-provenance")');
    expect(gateAt).toBeGreaterThan(-1);
    const block = src.slice(gateAt, gateAt + 800);
    expect(block).toMatch(/\/provenance-cohort`/);
    expect(block).toMatch(/setProvenanceCohortPreview\(/);
  });

  it('loadProvenanceCohortPreview calls the dedicated route directly — never /api/research/track2/[experimentId] (the heavy composition)', () => {
    const fnStart = src.indexOf('const loadProvenanceCohortPreview = useCallback');
    const fnEnd = src.indexOf('}, [personaId]);', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = src.slice(fnStart, fnEnd);
    expect(body).toMatch(/\/api\/research\/track2\/\$\{encodeURIComponent\(experimentId\)\}\/provenance-cohort`/);
  });
});

describe('ratifyProvenanceCohort — the ONE click, same write path, auto-continues the programme', () => {
  const src = stripComments(readSource(COPILOT));
  const fnStart = src.indexOf('const ratifyProvenanceCohort = useCallback');
  const fnEnd = src.indexOf('}, [observe, personaId, runProgramme, provenanceCohortPreview, provenanceRationale, loadProvenanceCohortPreview]);', fnStart);
  const body = src.slice(fnStart, fnEnd);

  it('the function exists and is bounded correctly', () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
  });

  it('POSTs the SAME provenance-cohort route with dryRun:false and expectedCohortHash — never a second write path', () => {
    expect(body).toMatch(/method: "POST"/);
    expect(body).toMatch(/\/provenance-cohort`/);
    expect(body).toMatch(/dryRun:\s*false/);
    expect(body).toMatch(/expectedCohortHash:\s*provenanceCohortPreview\.cohortHash/);
  });

  it('a rationale is required before the write — no no-rationale bulk write', () => {
    expect(body).toMatch(/if \(!provenanceRationale\.trim\(\)\)/);
  });

  it('a recommendation-set-changed refusal reloads the preview rather than failing silently or forcing a retry', () => {
    expect(body).toMatch(/recommendation-set-changed/);
    expect(body).toMatch(/await loadProvenanceCohortPreview\(experimentId\);/);
  });

  it('on success, continues the programme automatically via runProgramme — never leaves the operator to manually resume Validate/Relationships/Assignment', () => {
    expect(body).toMatch(/await runProgramme\(experimentId\);/);
  });
});

describe('the ObjectiveCard render call site threads the provenance cohort props', () => {
  const src = stripComments(readSource(COPILOT));

  it('passes provenanceCohortPreview and the ratify handler through to ObjectiveCard', () => {
    expect(src).toMatch(/provenanceCohortPreview=\{provenanceCohortPreview\}/);
    expect(src).toMatch(/onRatifyProvenanceCohort=\{\(experimentId\) => void ratifyProvenanceCohort\(experimentId\)\}/);
  });
});
