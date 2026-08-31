/**
 * Research Copilot → Track 2 handoff (operator directive, 2026-08-26).
 *
 * Two defects fixed:
 *   A. The pending-judgment CTA opened the generic Experiment Lab tab
 *      instead of the exact Track 2 stage (e.g. Classify Provenance).
 *   B. Navigating away from the Copilot and back made the pending judgment
 *      disappear (it existed only in the ephemeral POST /advance result, and
 *      the Track 2 detail panel's landing scroll position visually
 *      "regressed" to Discover Sources on every fresh mount).
 *
 * Source-authority canaries (this repo's convention for these exact files —
 * see tests/research-programme-orchestrator.test.ts and
 * tests/ocsga-early-invitation-passport-routing.test.ts). The functional/
 * data-shape half of the deep-link contract is covered in
 * tests/research-programme-orchestrator.test.ts's "canonical Track 2
 * deep-link" describe block; this file covers the UI consumption chain.
 *
 * Reconciliation invariants under test:
 *   1. completed upstream stages may never visually regress merely because
 *      the user navigated away — Track2ProgrammePanel scrolls to the live
 *      stage on every fresh mount, not just Stage 1.
 *   2. a pending human gate remains the next act until a receipt resolves
 *      it — the Copilot's decision card is rendered from state that is
 *      re-derived on every mount, never only while `run` is in memory.
 *   3. CTA destinations must deep-link to the precise stage, never a
 *      generic Experiment page — the pending-decision button consumes
 *      `decision.deepLink` verbatim; it does not reconstruct a URL.
 *   4. returning from the Lab refreshes authoritative state — the Copilot's
 *      mount effect still calls refresh() unconditionally.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const COPILOT = 'components/composer/IRLResearchCopilotTab.tsx';
const LAB = 'components/composer/InvariantExperimentLab.tsx';
const PANEL = 'components/research/Track2ProgrammePanel.tsx';
const INTENT = 'services/research/track2DeepLinkIntent.ts';
const DEEP_LINK_TYPE = 'services/research/track2Programme.ts';

describe('the deep-link intent mailbox is a one-shot relay, never durable storage', () => {
  it('does not use localStorage/sessionStorage — a stale deep-link must never replay on an unrelated visit', () => {
    const src = stripComments(readSource(INTENT));
    expect(src).not.toMatch(/localStorage|sessionStorage/);
    expect(src).toMatch(/export function setPendingTrack2Stage/);
    expect(src).toMatch(/export function consumePendingTrack2Stage/);
  });

  it('consumePendingTrack2Stage clears on read — a second read never replays the same intent', () => {
    const src = stripComments(readSource(INTENT));
    const fnStart = src.indexOf('export function consumePendingTrack2Stage');
    const fnBody = src.slice(fnStart, fnStart + 300);
    expect(fnBody).toMatch(/pending = null/);
  });
});

describe('Track2DeepLink — the canonical contract type (services/research/track2Programme.ts)', () => {
  it('names programme, experiment, stage AND a structured surface — never a prose-only surface', () => {
    const src = stripComments(readSource(DEEP_LINK_TYPE));
    const typeStart = src.indexOf('export interface Track2DeepLink');
    expect(typeStart).toBeGreaterThan(-1);
    const typeBody = src.slice(typeStart, src.indexOf('}', src.indexOf('surfaceRef', typeStart)) + 1);
    expect(typeBody).toMatch(/experimentId: string/);
    expect(typeBody).toMatch(/stageId: Track2StageId/);
    expect(typeBody).toMatch(/cartridgeTab: 'irl-experiment-lab'/);
    expect(typeBody).toMatch(/labTab: 'track2'/);
    expect(typeBody).toMatch(/anchorId: string/);
  });

  it('is constructed in exactly ONE place — buildTrack2DeepLink — never hand-built at a call site', () => {
    const src = stripComments(readSource(DEEP_LINK_TYPE));
    expect(src).toMatch(/export function buildTrack2DeepLink/);
    // The anchor id convention lives HERE, once — a consumer never
    // reconstructs `track2-stage-${id}` itself.
    expect((src.match(/`track2-stage-\$\{stageId\}`/g) ?? []).length).toBe(1);
  });
});

describe('Research Copilot — the pending decision survives navigate-away-and-back', () => {
  it('recomputes pendingDecisionPreview from the SAME GET read as programmePreview — no local journey cursor', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/pendingDecisionPreview/);
    expect(src).toMatch(/setPendingDecisionPreview\(data\.pendingDecision \?\? null\)/);
    // Both come from the SAME response object inside the SAME refresh() call
    // — never a second fetch.
    const refreshStart = src.indexOf('const refresh = useCallback');
    const refreshEnd = src.indexOf('const openedRef = useRef(false);');
    const refreshBody = src.slice(refreshStart, refreshEnd);
    expect(refreshBody).toMatch(/setProgrammePreview\(data\.programme\)/);
    expect(refreshBody).toMatch(/setPendingDecisionPreview\(data\.pendingDecision \?\? null\)/);
  });

  it('the decision card is rendered OUTSIDE {run && (...)} — it must not require the ephemeral run result to exist', () => {
    const src = stripComments(readSource(COPILOT));
    const runBlockStart = src.indexOf('{run && (');
    // 2026-08-30 (targeted acquisition): the single `{decision && (` block
    // split into two siblings — `{decision && decision.acquisitionBrief && (`
    // (the `discover-sources` acquisition authorization) and
    // `{decision && !decision.acquisitionBrief && (` (every other pending
    // decision, unchanged) — both still driven by the SAME `decision` value,
    // both still siblings of, and preceding, `{run && (...)}`.
    const decisionBlockStart = src.indexOf('{decision &&');
    expect(runBlockStart).toBeGreaterThan(-1);
    expect(decisionBlockStart).toBeGreaterThan(-1);
    // The decision block(s) must appear BEFORE {run && (...)} in source order —
    // i.e. they are siblings, not nested inside it.
    expect(decisionBlockStart).toBeLessThan(runBlockStart);
    expect(src.indexOf('{decision && !decision.acquisitionBrief')).toBeLessThan(runBlockStart);
  });

  it('decision merges run.pendingDecision with the durable preview — freshest read wins, neither is the sole source', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/const decision = run\?\.pendingDecision \?\? pendingDecisionPreview;/);
  });

  it('the pending-decision CTA proceeds via onProceed(decision) — never a direct onOpenStage(decision.deepLink)', () => {
    // 2026-08-27 continuation fix: the CTA no longer navigates using
    // decision.deepLink straight off this card's own (possibly stale) props.
    // It hands the WHOLE decision to onProceed, which re-verifies freshness
    // (advance + a fresh Track 2 GET) before opening anything — see
    // services/research/track2ProceedNavigation.ts.
    const src = stripComments(readSource(COPILOT));
    // Spans BOTH decision siblings (the acquisition block and the generic
    // block, 2026-08-30) up to {run && (...)} — onProceed(decision) is the
    // secondary/demoted control in the acquisition block and the primary
    // control in the generic block; either way it is never onOpenStage.
    const decisionBlockStart = src.indexOf('{decision &&');
    const decisionBlockEnd = src.indexOf('{run && (', decisionBlockStart);
    const decisionBlock = src.slice(decisionBlockStart, decisionBlockEnd);
    expect(decisionBlock).toMatch(/onClick=\{\(\) => onProceed\(decision\)\}/);
    expect(decisionBlock).not.toMatch(/onOpenStage\(decision\.deepLink\)/);
    expect(decisionBlock).not.toMatch(/onOpenDetail/);
    // The old generic wording is gone — this CTA no longer claims a
    // destination it cannot guarantee ("in the Experiment Lab" named the
    // cartridge tab, not the stage).
    expect(decisionBlock).not.toMatch(/in the Experiment Lab/);
  });

  it('the pending-decision CTA never navigates on a failed proceed sequence — it shows the error and a Retry instead', () => {
    const src = stripComments(readSource(COPILOT));
    const decisionBlockStart = src.indexOf('{decision &&');
    const decisionBlockEnd = src.indexOf('{run && (', decisionBlockStart);
    const decisionBlock = src.slice(decisionBlockStart, decisionBlockEnd);
    expect(decisionBlock).toMatch(/proceedError/);
    expect(decisionBlock).toMatch(/Retry/);
    // The Retry control re-runs the SAME proceed sequence — never a bare
    // "dismiss" that leaves the operator with no way forward.
    expect(decisionBlock).toMatch(/onClick=\{\(\) => onProceed\(decision\)\}[\s\S]*Retry/);
  });

  it('proceedToDecision awaits /advance before reading Track 2, and reads Track 2 before navigating — never navigates on advance/refresh failure', () => {
    const src = stripComments(readSource(COPILOT));
    const fnStart = src.indexOf('const proceedToDecision = useCallback');
    const fnEnd = src.indexOf('}, [observe, personaId, goToTrack2Stage, goToExperimentLab]);', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    // Uses the pure, unit-tested sequence — never a hand-rolled reimplementation.
    expect(fnBody).toMatch(/proceedToTrack2Stage\(\{/);
    // advance is awaited (it is itself an async arrow function passed as a dep,
    // and outcome is awaited before any setState that could drive navigation).
    expect(fnBody).toMatch(/const outcome = await proceedToTrack2Stage/);
    // navigate/navigateGeneric are wired to the EXISTING primitives — no
    // second navigation mechanism introduced.
    expect(fnBody).toMatch(/navigate: goToTrack2Stage,/);
    expect(fnBody).toMatch(/navigateGeneric: goToExperimentLab,/);
    // A failed advance or a failed refresh sets an error, never silently proceeds.
    expect(fnBody).toMatch(/outcome\.kind === 'advance-failed'/);
    expect(fnBody).toMatch(/outcome\.kind === 'refresh-failed'/);
  });

  it('goToTrack2Stage writes the deep-link intent BEFORE dispatching the navigation event', () => {
    const src = stripComments(readSource(COPILOT));
    const fnStart = src.indexOf('const goToTrack2Stage = useCallback');
    const fnEnd = src.indexOf('}, [observe]);', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    const setIdx = fnBody.indexOf('setPendingTrack2Stage(');
    const dispatchIdx = fnBody.indexOf('dispatchEvent(');
    expect(setIdx).toBeGreaterThan(-1);
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeLessThan(dispatchIdx);
    // Passes the COMPLETE deep-link object (2026-08-27 fix) — never a
    // hand-picked subset of its fields that a downstream consumer would
    // then have to reconstruct the rest from.
    expect(fnBody).toMatch(/setPendingTrack2Stage\(deepLink\);/);
    expect(fnBody).toMatch(/tab: deepLink\.surfaceRef\.cartridgeTab/);
  });

  it('"Inspect Track 2" and the exceptions overflow link remain generic — only the pending-decision CTA deep-links', () => {
    const src = stripComments(readSource(COPILOT));
    // Both still ride the pre-existing, unmodified generic handler.
    expect(src).toMatch(/onClick=\{onOpenDetail\}/);
    expect(src).toMatch(/onOpenDetail=\{goToExperimentLab\}/);
  });

  it('the ObjectiveCard render call site threads both the preview and the proceed sequence', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/pendingDecisionPreview=\{pendingDecisionPreview\}/);
    expect(src).toMatch(/onProceed=\{\(decision\) => void proceedToDecision\(decision\)\}/);
    expect(src).toMatch(/proceeding=\{proceeding\}/);
    expect(src).toMatch(/proceedError=\{proceedError\}/);
  });

  it('the mount effect still calls refresh() unconditionally — returning from the Lab observes fresh authoritative state', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/void refresh\(\);/);
  });
});

// ── REVIEW & PROMOTE — a real decision surface, not a description
// (2026-08-30) ───────────────────────────────────────────────────────────────
//
// Mirrors the "Approve targeted acquisition" pattern already proven for
// `discover-sources`: the review card renders directly inside the Copilot,
// keyed on `decision.reviewQueue`, and calls the EXISTING canonical
// promotion/rejection route — never a second implementation.

describe('Research Copilot — Review & Promote renders as one bounded card per candidate', () => {
  it('the reviewQueue block is a sibling of, and precedes, {run && (...)}', () => {
    const src = stripComments(readSource(COPILOT));
    const runBlockStart = src.indexOf('{run && (');
    const reviewBlockStart = src.indexOf('decision.reviewQueue && decision.reviewQueue.length > 0 && (');
    expect(runBlockStart).toBeGreaterThan(-1);
    expect(reviewBlockStart).toBeGreaterThan(-1);
    expect(reviewBlockStart).toBeLessThan(runBlockStart);
  });

  it('the generic decision block never ALSO renders while a reviewQueue is present — no double-render', () => {
    const src = stripComments(readSource(COPILOT));
    // 2026-08-31 addition: also excludes a `verificationTarget` decision
    // (the "Run institution verification" control gets its own dedicated
    // block, same principle — never a double-render).
    expect(src).toMatch(/\{decision && !decision\.acquisitionBrief && !decision\.verificationTarget && !\(decision\.reviewQueue && decision\.reviewQueue\.length > 0\) && \(/);
  });

  it('Promote/Reject call the EXISTING canonical route — POST /api/invariants/discovery with action + candidateId — never a second promotion/rejection implementation', () => {
    const src = stripComments(readSource(COPILOT));
    const fnStart = src.indexOf('const submitReviewDecision = useCallback');
    const fnEnd = src.indexOf('}, [observe, personaId, runProgramme]);', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/"\/api\/invariants\/discovery"/);
    expect(fnBody).toMatch(/body: JSON\.stringify\(\{ action, candidateId \}\)/);
    // No OTHER route string appears in this function — the whole disposition
    // rides one call.
    expect((fnBody.match(/personaFetch\(/g) ?? []).length).toBe(2); // the disposition POST + the fresh Track2 GET
  });

  it('the two buttons pass the literal actions "promote"/"reject" — never a third disposition value invented client-side', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/onReviewDecision\(decision, c\.candidateId, "promote"\)/);
    expect(src).toMatch(/onReviewDecision\(decision, c\.candidateId, "reject"\)/);
  });

  it('"Exception / Inspect" performs no write — it reuses onProceed (navigation only), never the review-decision route', () => {
    const src = stripComments(readSource(COPILOT));
    const reviewBlockStart = src.indexOf("decision.reviewQueue && decision.reviewQueue.length > 0 && (");
    const reviewBlockEnd = src.indexOf('{decision && !decision.acquisitionBrief', reviewBlockStart);
    const reviewBlock = src.slice(reviewBlockStart, reviewBlockEnd);
    expect(reviewBlock).toMatch(/Exception \/ Inspect/);
    expect(reviewBlock).toMatch(/onClick=\{\(\) => onProceed\(decision\)\}/);
  });

  it('after a disposition, a fresh Track2 read decides whether to auto-continue — never a client-side decrement standing in for server truth', () => {
    const src = stripComments(readSource(COPILOT));
    const fnStart = src.indexOf('const submitReviewDecision = useCallback');
    const fnEnd = src.indexOf('}, [observe, personaId, runProgramme]);', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/setProgrammePreview\(trackData\.programme \?\? null\)/);
    expect(fnBody).toMatch(/setPendingDecisionPreview\(trackData\.pendingDecision \?\? null\)/);
    // The continue condition reads the FRESH server response, not a locally
    // decremented count.
    expect(fnBody).toMatch(/trackData\.pendingDecision\?\.stageId === "review-and-promote"/);
    expect(fnBody).toMatch(/await runProgramme\(experimentIdForDecision\);/);
  });

  it('the ObjectiveCard render call site threads the review-decision handler and its busy/error state', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/onReviewDecision=\{\(decision, candidateId, action\) => void submitReviewDecision\(decision, candidateId, action\)\}/);
    expect(src).toMatch(/reviewBusyId=\{reviewBusyId\}/);
    expect(src).toMatch(/reviewError=\{reviewError\}/);
  });
});

describe('InvariantExperimentLab — consumes the deep-link intent on the FIRST render, before any effect', () => {
  it('reads consumePendingTrack2Stage via a lazy useState initializer, called exactly once at mount', () => {
    const src = stripComments(readSource(LAB));
    expect(src).toMatch(/const \[initialTrack2Intent\] = useState\(\(\) => consumePendingTrack2Stage\(\)\);/);
    // TWO call sites (2026-08-30 same-tab re-navigation fix): the lazy
    // initializer above (the FIRST-mount consumption, unchanged) and one
    // inside a `codex:navigate-tab` listener effect — the SAME-tab case,
    // where `codex:navigate-tab` no-ops (the destination tab is already
    // active, so this component never remounts) and the mailbox must
    // therefore be re-consumed by an already-mounted listener instead. Each
    // call site consumes (and clears) the mailbox exactly once per
    // navigation — never both for the SAME intent, since the listener only
    // fires on a live dispatch, after the initial mount's own read already
    // happened.
    expect((src.match(/consumePendingTrack2Stage\(\)/g) ?? []).length).toBe(2);
  });

  it('defaults the tab to "track2" when a deep-link intent is present, "bundle" otherwise — never fights the deep-link', () => {
    const src = stripComments(readSource(LAB));
    expect(src).toMatch(/const \[tab, setTab\] = useState<LabTab>\(\(\) => \(initialTrack2Intent \? "track2" : "bundle"\)\);/);
  });

  it('passes the deep-link\'s OWN experimentId and anchorId through to Track2ProgrammePanel — never a hardcoded experimentId or a reconstructed anchor', () => {
    const src = stripComments(readSource(LAB));
    const renderIdx = src.indexOf('tab === "track2"');
    expect(renderIdx).toBeGreaterThan(-1);
    const renderBlock = src.slice(renderIdx, renderIdx + 300);
    // 2026-08-27 review finding: this previously hardcoded experimentId="EXP-P1"
    // and passed only a stage id for the panel to rebuild an anchor from.
    // 2026-08-30 (same-tab re-navigation fix): the panel now reads the LIVE
    // `track2Intent` state (updated by the same-tab listener above), not the
    // frozen `initialTrack2Intent` — still never hardcoded, still the
    // deep-link's own fields verbatim.
    expect(renderBlock).toMatch(/experimentId=\{track2Intent\?\.experimentId \?\? "EXP-P1"\}/);
    expect(renderBlock).toMatch(/initialAnchorId=\{track2Intent\?\.surfaceRef\.anchorId\}/);
    expect(renderBlock).not.toMatch(/experimentId="EXP-P1"/);
    // Keyed on the anchor so re-opening the SAME tab for a DIFFERENT stage
    // (already viewing Track 2) remounts the panel and re-scrolls, rather
    // than silently keeping the previous stage's scroll position.
    expect(renderBlock).toMatch(/key=\{track2Intent\?\.surfaceRef\.anchorId \?\? "track2-default"\}/);
  });
});

describe('scoped Track 2 access — the Austin/external-review workstream (2026-08-27 review finding)', () => {
  it('track2 is mapped to EXP-P1 in ITEM_EXPERIMENT — an EXP-P1-scoped reviewer must see the tab', () => {
    const src = stripComments(readSource(LAB));
    const mapStart = src.indexOf('const ITEM_EXPERIMENT');
    const mapEnd = src.indexOf('};', mapStart);
    const mapBody = src.slice(mapStart, mapEnd);
    expect(mapBody).toMatch(/track2:\s*"EXP-P1"/);
  });

  it('expIdForTab("track2") resolves to EXP-P1 — the actual function the scoped-access filter calls', async () => {
    const mod = await import('@/components/composer/InvariantExperimentLab');
    expect(mod.expIdForTab('track2')).toBe('EXP-P1');
  });

  it('a reviewer scoped to a DIFFERENT experiment does not resolve track2 to their own scope — denial canary', async () => {
    const mod = await import('@/components/composer/InvariantExperimentLab');
    const trackTwoExp = mod.expIdForTab('track2');
    const otherReviewerScope = new Set(['EXP-004']);
    expect(otherReviewerScope.has(trackTwoExp as string)).toBe(false);
  });

  it('two tabs sharing one experiment id (vp1 + track2, both EXP-P1) never duplicate a scope in the invitation grouping (regression: adding track2 broke groupAssignableScopesBySeries)', async () => {
    const { deriveExperimentSeriesGroups, groupAssignableScopesBySeries } = await import(
      '@/services/research/experimentSeriesGroups'
    );
    const groups = deriveExperimentSeriesGroups();
    const validationProgramme = groups.find((g) => g.title === 'Validation Programme');
    expect(validationProgramme).toBeDefined();
    // EXP-P1 appears exactly once in the group's own id list — deduped —
    // even though two tabs (vp1, track2) both resolve to it.
    expect(validationProgramme!.experimentIds.filter((id) => id === 'EXP-P1').length).toBe(1);

    const scopes = [
      { id: 'EXP-P1', label: 'EXP-P1' },
      { id: 'EXP-001', label: 'EXP-001' },
    ];
    const bucketed = groupAssignableScopesBySeries(scopes);
    // No scope is duplicated across (or within) buckets.
    expect(bucketed.flatMap((g) => g.scopes).length).toBe(scopes.length);
  });
});

describe('Track2ProgrammePanel — no visual regression to Discover Sources on a fresh mount', () => {
  it('accepts an initialAnchorId prop and consumes it VERBATIM — never reconstructs track2-stage-${stageId} from a bare stage id', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/initialAnchorId\?: string/);
    expect(src).toMatch(/scrollToAnchorId\(initialAnchorId \?\? `track2-stage-\$\{programme\.currentStageId\}`\)/);
    // 2026-08-27 review finding: this signature must be GONE — it named the
    // silent reconstruction the fix removed.
    expect(src).not.toMatch(/initialStageId/);
  });

  it('scrolls exactly ONCE on initial load — a ref guard, so it never fights reloadAndAdvance on later reloads', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/const didInitialScroll = useRef\(false\);/);
    const effectIdx = src.indexOf('if (didInitialScroll.current || !programme) return;');
    expect(effectIdx).toBeGreaterThan(-1);
    expect(src.slice(effectIdx, effectIdx + 200)).toMatch(/didInitialScroll\.current = true;/);
  });

  it('scrollToStage (this panel\'s own internal convention) is built ON TOP of the single scrollToAnchorId primitive, not a second DOM implementation', () => {
    const src = stripComments(readSource(PANEL));
    expect((src.match(/const scrollToAnchorId = useCallback/g) ?? []).length).toBe(1);
    expect((src.match(/const scrollToStage = useCallback/g) ?? []).length).toBe(1);
    const stageFnStart = src.indexOf('const scrollToStage = useCallback');
    const stageFnBody = src.slice(stageFnStart, stageFnStart + 200);
    expect(stageFnBody).toMatch(/scrollToAnchorId\(`track2-stage-\$\{stageId\}`\)/);
    // scrollToAnchorId's OWN body is the only place THIS panel's deep-link/
    // current-stage scroll mechanics live — its own requestAnimationFrame +
    // getElementById + scrollIntoView appear exactly once, inside it (the
    // panel has other, unrelated scrollIntoView call sites elsewhere, e.g.
    // failing-check "Resolve" links — those are a different concern and are
    // untouched by this fix).
    const anchorFnStart = src.indexOf('const scrollToAnchorId = useCallback');
    const anchorFnEnd = src.indexOf('}, []);', anchorFnStart);
    const anchorFnBody = src.slice(anchorFnStart, anchorFnEnd);
    expect((anchorFnBody.match(/scrollIntoView/g) ?? []).length).toBe(1);
  });

  it('the DOM anchor convention (track2-stage-${id}) is unchanged — the deep-link contract\'s anchorId still matches it', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/id=\{`track2-stage-\$\{s\.id\}`\}/);
  });
});
