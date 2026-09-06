/**
 * "Freeze Crystal vP2 for internal EXP-P1 run" — Research Copilot / Track 2
 * exposure of the governed internal-pilot freeze act (operator ruling,
 * 2026-09-06: "Frozen generations are immutable; Crystal lineages are
 * evolutionary"). Source-text canary, mirroring
 * tests/track2-admission-cohort-ratification.test.ts's own convention for
 * this file — `Track2ProgrammePanel.tsx` is too large and Supabase/persona-
 * dependent to mount behaviourally without a disproportionate harness, and
 * the properties below are genuinely structural (a request-body literal
 * either sends `executionDesignation: 'internal-pilot'` or it doesn't).
 *
 * Pins, per the operator's exact requirements for this surface:
 *   1. Exception Isolation — the new action renders ALONGSIDE the "Waiting
 *      for readiness" notice, never instead of it; the confirmatory freeze
 *      stays correctly gated while readiness is incomplete.
 *   2. Nothing is typed in by the operator: no free-text operator-reference
 *      input inside the new component; `signedBy`/`operatorRef` are resolved
 *      from the admin's own session (active-persona + identity references).
 *   3. `scientificDeviations` is DERIVED from the live `readiness.checks`
 *      (scientific-readiness tier, currently failing) — never a hardcoded
 *      `['derivation-headroom', 'boundary-coverage']` literal.
 *   4. `executionDesignation: 'internal-pilot'` and `boundaryAcknowledged:
 *      true` are sent by the component itself — never operator-set flags.
 *   5. The freeze rationale is the operator's own prepared verbatim text.
 *   6. After success, `nextGovernedAction` is rendered but nothing in this
 *      component calls any execution/run endpoint — exposure, never
 *      auto-execution.
 */
import { describe, it, expect } from 'vitest';

const PANEL = 'components/research/Track2ProgrammePanel.tsx';

describe('FreezeVP2InternalPilotAction — exposed on the freeze stage, EXP-P1 only', () => {
  it('is defined, and renders conditionally for experimentId === "EXP-P1" — never a generic all-experiments mechanism', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/function FreezeVP2InternalPilotAction\(/);
    expect(src).toMatch(/experimentId === "EXP-P1" && \(\s*<FreezeVP2InternalPilotAction/);
  });

  it('renders ALONGSIDE the "Waiting for readiness" notice, never replacing it (Exception Isolation)', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const readinessBranch = src.match(
      /if \(readinessStage && readinessStage\.status !== "complete"\) \{[\s\S]*?(?=return \(\s*<FreezeControl)/,
    );
    expect(readinessBranch, 'the readiness-incomplete branch should exist').not.toBeNull();
    const branch = readinessBranch![0];
    expect(branch).toMatch(/Waiting for readiness:/);
    expect(branch).toMatch(/<FreezeVP2InternalPilotAction/);
  });

  it('never renders a free-text operator-reference input inside its own body — signedBy is resolved, never typed', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const fn = src.match(/function FreezeVP2InternalPilotAction\([\s\S]*?\n\}\n/);
    expect(fn).not.toBeNull();
    const body = fn![0];
    expect(body).not.toMatch(/placeholder="operator reference/);
    expect(body).toMatch(/\/api\/wallet\/active-persona/);
    expect(body).toMatch(/\/api\/wallet\/identity\/references/);
  });

  it('derives scientificDeviations from the LIVE failing scientific-readiness checks — never a hardcoded check-name literal', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const fn = src.match(/function FreezeVP2InternalPilotAction\([\s\S]*?\n\}\n/);
    const body = fn![0];
    expect(body).toMatch(
      /readiness\?\.checks \?\? \[\]\)\.filter\(\(c\) => c\.tier === "scientific-readiness" && !c\.passed\)/,
    );
    expect(body).toMatch(/scientificDeviations: failingChecks\.map\(\(c\) => \(\{ checkName: c\.name, rationale: FREEZE_RATIONALE \}\)\)/);
    expect(body).not.toMatch(/'derivation-headroom'/);
    expect(body).not.toMatch(/'boundary-coverage'/);
  });

  it('sends executionDesignation: "internal-pilot" and boundaryAcknowledged: true — never operator-set flags', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const fn = src.match(/function FreezeVP2InternalPilotAction\([\s\S]*?\n\}\n/);
    const body = fn![0];
    expect(body).toMatch(/executionDesignation: "internal-pilot"/);
    expect(body).toMatch(/boundaryAcknowledged: true/);
  });

  it('uses the operator\'s exact prepared rationale text, verbatim, for both freezeRationale and each deviation', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const fn = src.match(/function FreezeVP2InternalPilotAction\([\s\S]*?\n\}\n/);
    const body = fn![0];
    expect(body).toMatch(
      /Crystal vP2 is frozen as the immutable substrate for an internal EXP-P1 experimental run\./,
    );
    expect(body).toMatch(/freezeRationale: FREEZE_RATIONALE/);
  });

  it('renders nextGovernedAction after success but never calls a run/execute endpoint — exposure, never auto-execution', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const fn = src.match(/function FreezeVP2InternalPilotAction\([\s\S]*?\n\}\n/);
    const body = fn![0];
    expect(body).toMatch(/nextGovernedAction/);
    expect(body).not.toMatch(/\/run\b/);
    expect(body).not.toMatch(/\/execute\b/);
    expect(body).not.toMatch(/execution-run/);
  });

  it('gates the single confirm button on operatorRef, contentHash, and at least one failing check', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(PANEL));
    const fn = src.match(/function FreezeVP2InternalPilotAction\([\s\S]*?\n\}\n/);
    const body = fn![0];
    expect(body).toMatch(/disabled=\{busy \|\| !operatorRef \|\| !contentHash \|\| failingChecks\.length === 0\}/);
  });
});
