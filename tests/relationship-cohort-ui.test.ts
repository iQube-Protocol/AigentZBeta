/**
 * "Accept All High-Confidence (>95%)" retirement (2026-09-05, operator
 * audit) — UI-wiring source canaries, mirroring `tests/provenance-cohort-ui.test.ts`'s
 * own pattern one stage later (Stage 7, not Stage 5). The audit found: no
 * calibration or governance ratification of the 95% threshold exists
 * anywhere in this repo, real observed machine confidence tops out around
 * 90%, and Stage 5 already had a data-calibrated, count-based replacement
 * (`ProvenanceCohortRatificationBoard`) while Stage 7 did not. This pins
 * that Stage 7 now gets the same treatment, and that the dead percentage
 * shortcut is gone from BOTH stages, not just described as retired.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PANEL = 'components/research/Track2ProgrammePanel.tsx';

describe('the dead "Accept All High-Confidence (>N%)" batch shortcut is gone from BOTH Stage 5 and Stage 7', () => {
  const src = stripComments(readSource(PANEL));

  it('no "Accept All High-Confidence" control remains anywhere in the panel', () => {
    expect(src).not.toMatch(/Accept All High-Confidence/);
  });

  it('no acceptAllHighConfidence batch handler remains anywhere in the panel', () => {
    expect(src).not.toMatch(/acceptAllHighConfidence/);
  });

  it('HIGH_CONFIDENCE_THRESHOLD survives ONLY as a per-item display-tier constant, never as a batch-write gate', () => {
    // Still referenced (per-item card color tiers) — but never compared
    // against a `queue`/batch loop's `.confidence <=`/`.confidence >` short-
    // circuit that then dispatches a write.
    expect(src).toMatch(/const HIGH_CONFIDENCE_THRESHOLD = 95;/);
    expect(src).not.toMatch(/s\.confidence <= HIGH_CONFIDENCE_THRESHOLD/);
  });
});

describe('Stage 7 renders the relationship cohort ratification board as its PRIMARY action', () => {
  const src = stripComments(readSource(PANEL));

  it('RelationshipCohortRatificationBoard is rendered for add-relationships whenever orphan work exists', () => {
    const at = src.indexOf("s.id === \"add-relationships\" &&\n                        !isDownstreamOfReconciliation &&\n                        (programme.actionQueues?.orphans.length ?? 0) > 0 && (\n                          <RelationshipCohortRatificationBoard");
    expect(at, 'RelationshipCohortRatificationBoard render site not found for add-relationships').toBeGreaterThan(-1);
  });

  it('the board renders BEFORE the manual RelationshipQueue fallback in source order — the cohort action is the first offer, not a secondary one', () => {
    const boardAt = src.indexOf('<RelationshipCohortRatificationBoard');
    const queueAt = src.indexOf('<RelationshipQueue');
    expect(boardAt).toBeGreaterThan(-1);
    expect(queueAt).toBeGreaterThan(-1);
    expect(boardAt).toBeLessThan(queueAt);
  });

  it('RelationshipQueue is NOT removed — it remains available for exceptions and manual override', () => {
    expect(src).toMatch(/function RelationshipQueue\(/);
  });
});

describe('RelationshipCohortRatificationBoard — calls the real cohort endpoint, never a fabricated client-side relationship', () => {
  const src = stripComments(readSource(PANEL));
  const fnStart = src.indexOf('function RelationshipCohortRatificationBoard(');
  const fnEnd = src.indexOf('\ninterface ProvenanceCandidateRecommendationView', fnStart);
  const body = src.slice(fnStart, fnEnd);

  it('the component exists and is bounded correctly', () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
  });

  it('GET derives the cohort — read-only, no dryRun/rationale on the load call', () => {
    expect(body).toMatch(/personaFetch\(`\/api\/research\/track2\/\$\{encodeURIComponent\(experimentId\)\}\/relationship-cohort`, \{\s*\n\s*cache: "no-store",/);
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
    const buttonSite = body.indexOf('Ratify relationship cohort');
    expect(buttonSite).toBeGreaterThan(-1);
    const before = body.slice(Math.max(0, buttonSite - 2500), buttonSite);
    expect(before).toMatch(/view\.readyCount > 0/);
  });

  it('the primary CTA shows a real derived COUNT, never a bare percentage', () => {
    const buttonSite = body.indexOf('Ratify relationship cohort');
    const buttonLine = body.slice(buttonSite, buttonSite + 120);
    expect(buttonLine).toMatch(/\{view\.readyCount\}/);
    expect(buttonLine).not.toMatch(/%/);
  });

  it('exceptions are rendered but never offered a proposed relationship or a write path of their own', () => {
    expect(body).toMatch(/never proposed a relationship/);
  });

  it('on success, calls onDone() so the parent reloads the programme state — never leaves a stale stage status on screen', () => {
    const ratifyStart = body.indexOf('const ratify = useCallback');
    const ratifyEnd = body.indexOf('[view, experimentId, rationale, onDone, load]);', ratifyStart);
    const ratifyBody = body.slice(ratifyStart, ratifyEnd);
    expect(ratifyBody).toMatch(/onDone\(\);/);
  });
});
