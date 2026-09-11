/**
 * "Classify Provenance completed by manual burden" repair (2026-09-03) —
 * UI-wiring source canaries, mirroring `tests/admission-queue-ui.test.ts`'s
 * own pattern one stage later. The forbidden result the operator explicitly
 * rejected: a Stage 5 that STILL requires 55 per-record "Accept" then
 * "Classify & next" clicks even though the machinery to derive a cohort
 * mechanically already exists (`services/research/provenanceCohortPreparation.ts`).
 *
 * These are source-level canaries (this repo has no React Testing Library
 * harness for this panel) pinning that:
 *   1. Stage 5 renders the new ONE-decision-surface `ProvenanceCohortRatificationBoard`
 *      whenever there is unclassified work — never only the old per-record queue.
 *   2. The board is the FIRST thing rendered for `classify-provenance` — the
 *      manual `ClassificationQueue` stays available underneath, never removed
 *      (exceptions still need it), but is not the operator's first offer.
 *   3. The board calls the real cohort endpoint (GET to derive, POST with
 *      `dryRun:false` + `expectedCohortHash` to ratify) — never a fabricated
 *      client-side classification.
 *   4. Ratifying requires a rationale, mirroring every other cohort-write
 *      surface in this file (Stage 2's admission cohort, Stage 8's assignment
 *      board) — never a no-rationale bulk write.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PANEL = 'components/research/Track2ProgrammePanel.tsx';

describe('Stage 5 renders the provenance cohort ratification board as its PRIMARY action', () => {
  const src = stripComments(readSource(PANEL));

  it('ProvenanceCohortRatificationBoard is rendered for classify-provenance whenever unclassified work exists', () => {
    const at = src.indexOf("s.id === \"classify-provenance\" &&\n                        !pendingReconciliation &&\n                        (programme.actionQueues?.unclassified.length ?? 0) > 0 && (\n                          <ProvenanceCohortRatificationBoard");
    expect(at, 'ProvenanceCohortRatificationBoard render site not found for classify-provenance').toBeGreaterThan(-1);
  });

  it('the board renders BEFORE the manual ClassificationQueue fallback in source order — the cohort action is the first offer, not a secondary one', () => {
    const boardAt = src.indexOf('<ProvenanceCohortRatificationBoard');
    const queueAt = src.indexOf('<ClassificationQueue');
    expect(boardAt).toBeGreaterThan(-1);
    expect(queueAt).toBeGreaterThan(-1);
    expect(boardAt).toBeLessThan(queueAt);
  });

  it('ClassificationQueue is NOT removed — it remains available for exceptions and manual override', () => {
    expect(src).toMatch(/function ClassificationQueue\(/);
  });
});

describe('ProvenanceCohortRatificationBoard — calls the real cohort endpoint, never a fabricated client-side classification', () => {
  const src = stripComments(readSource(PANEL));
  const fnStart = src.indexOf('function ProvenanceCohortRatificationBoard(');
  const fnEnd = src.indexOf('\ninterface ProvenanceCandidateRecommendationView', fnStart);
  const body = src.slice(fnStart, fnEnd);

  it('the component exists and is bounded correctly', () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
  });

  it('GET derives the cohort — read-only, no dryRun/rationale on the load call', () => {
    expect(body).toMatch(/personaFetch\(`\/api\/research\/track2\/\$\{encodeURIComponent\(experimentId\)\}\/provenance-cohort`, \{\s*\n\s*cache: "no-store",/);
  });

  it('POST ratification always sends dryRun:false and the expectedCohortHash from the just-loaded view — the stale-cohort protection every other cohort-write surface in this file uses', () => {
    expect(body).toMatch(/method: "POST"/);
    expect(body).toMatch(/dryRun:\s*false/);
    expect(body).toMatch(/expectedCohortHash:\s*view\.cohortHash/);
  });

  it('a recommendation-set-changed refusal triggers a refresh, not a silent failure or a forced retry', () => {
    expect(body).toMatch(/recommendation-set-changed/);
    expect(body).toMatch(/await load\(\);/);
  });

  it('the Ratify button is disabled without a rationale — no no-rationale bulk write', () => {
    expect(body).toMatch(/disabled=\{busy \|\| !rationale\.trim\(\)\}/);
  });

  it('the Ratify button is gated on view.readyCount > 0 — never offered when nothing is eligible', () => {
    const buttonSite = body.indexOf('Ratify provenance cohort');
    expect(buttonSite).toBeGreaterThan(-1);
    const before = body.slice(Math.max(0, buttonSite - 2500), buttonSite);
    expect(before).toMatch(/view\.readyCount > 0/);
  });

  it('exceptions are rendered but never offered a proposed class or a write path of their own', () => {
    expect(body).toMatch(/never proposed a class/);
    expect(body).not.toMatch(/exceptionCause.*classDisposition/s);
  });

  it('on success, calls onDone() so the parent reloads the programme state — never leaves a stale stage status on screen', () => {
    const ratifyStart = body.indexOf('const ratify = useCallback');
    const ratifyEnd = body.indexOf('[view, experimentId, rationale, onDone, load]);', ratifyStart);
    const ratifyBody = body.slice(ratifyStart, ratifyEnd);
    expect(ratifyBody).toMatch(/onDone\(\);/);
  });
});
