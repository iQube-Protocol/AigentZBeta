/**
 * "Run institution verification" — UI-wiring source canaries (2026-08-31,
 * "targeted-acquisition ratified-but-unverified dead end" repair).
 *
 * The forbidden result the operator named explicitly:
 *
 *   Run until you need me
 *     -> "Run institution verification" [recognised as the gate]
 *     -> Open Discover Sources           [the ONLY CTA — a dead end]
 *     -> "Run institution verification"  [re-diagnosed, never executed]
 *     -> no action
 *
 * These are source-level canaries (not a rendered DOM assertion — this repo
 * has no React Testing Library harness for these two files) pinning that:
 *   1. Both surfaces render a REAL "Run institution verification" control
 *      when `decision.verificationTarget` is present.
 *   2. Neither surface falls through to the generic "Open {stageLabel}"
 *      fallback (the old dead end) for a `verificationTarget` decision.
 *   3. Both drive the SAME two routes (`verify-step`, `run-step`) — never a
 *      second verification or discovery implementation.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const COPILOT = 'components/composer/IRLResearchCopilotTab.tsx';
const PANEL = 'components/research/Track2ProgrammePanel.tsx';

describe('the Research Copilot renders a REAL verification control, never a dead end', () => {
  const src = stripComments(readSource(COPILOT));

  it('renders "Run institution verification" gated on decision.verificationTarget', () => {
    expect(src).toMatch(/decision\.verificationTarget/);
    expect(src).toMatch(/Run institution verification/);
  });

  it('the generic "Open {stageLabel}" fallback EXCLUDES verificationTarget decisions — never the CTA for a verification gate', () => {
    expect(src).toMatch(/!decision\.acquisitionBrief\s*&&\s*!decision\.verificationTarget/);
  });

  it('drives POST .../acquisition/verify-step — the SAME bounded step, never a second implementation', () => {
    expect(src).toMatch(/acquisition\/verify-step/);
  });

  it('reuses the SAME discovery loop the acquisition flow uses (runDiscoverySteps), never a duplicate run-step loop', () => {
    expect(src).toMatch(/runDiscoverySteps\(experimentIdForDecision/);
  });
});

describe('the manual Track 2 panel derives and exposes the SAME next action, never explanatory text alone', () => {
  const src = stripComments(readSource(PANEL));

  it('reads the SAME pendingDecision.verificationTarget the Copilot reads — one canonical source, not a second diagnosis', () => {
    expect(src).toMatch(/pendingDecision\.verificationTarget/);
  });

  it('renders a REAL "Run institution verification" control, not merely detail/remedies text', () => {
    expect(src).toMatch(/InstitutionVerificationAction/);
    expect(src).toMatch(/Run institution verification/);
  });

  it('drives the SAME two routes the Copilot drives — verify-step then run-step, no second implementation', () => {
    expect(src).toMatch(/acquisition\/verify-step/);
    expect(src).toMatch(/acquisition\/run-step/);
  });

  it('is wired into BOTH the readiness-checklist location and Stage 1\'s own card, so the action is visible wherever the operator looks', () => {
    const occurrences = (src.match(/<InstitutionVerificationAction/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
