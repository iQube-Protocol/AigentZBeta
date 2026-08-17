/**
 * KNYTS Bridge CHOOSE — three-item bug-fix closure (2026-08-16).
 *
 * Structural/source-authority canaries, matching the established convention
 * for this feature (tests/knyts-bridge-campaign-activation.test.ts) — no
 * live-DB or React-render harness exists in this test suite, so route
 * wiring and component-source invariants are verified from the real
 * TSX-aware AST (tests/_lib/sourceAuthority.ts), not re-derived assumptions.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('Bug 1 — book-interest route: a downstream projection failure never fails preregistration', () => {
  const SRC = stripComments(readSource('app/api/journey/knyts-bridge/choose/book-interest/route.ts'));

  it('the recorded-evidence success response is unconditional — not nested inside a try that could swallow it', () => {
    // The final NextResponse.json({ ok: true, ... }) must appear AFTER the
    // isNew projection block closes, at the function's own top level.
    const projectIdx = SRC.indexOf('projectKnytsBridgeEvidenceOutputs(evidence)');
    const responseIdx = SRC.indexOf('ok: true');
    expect(projectIdx).toBeGreaterThan(-1);
    expect(responseIdx).toBeGreaterThan(projectIdx);
  });

  it('the projection call is isolated in its own try/catch, independent of the outer route-level catch', () => {
    const idx = SRC.indexOf('if (isNew) {');
    expect(idx).toBeGreaterThan(-1);
    const block = SRC.slice(idx, idx + 500);
    expect(block).toContain('try {');
    expect(block).toContain('await projectKnytsBridgeEvidenceOutputs(evidence)');
    expect(block).toContain('catch (err)');
  });

  it('a projection failure is logged, never rethrown to the caller', () => {
    const idx = SRC.indexOf('if (isNew) {');
    const block = SRC.slice(idx, idx + 700);
    expect(block).toContain('console.error');
    expect(block).not.toMatch(/catch \(err\) \{\s*throw/);
  });

  it('evidence persistence itself is still a hard requirement — recordKnytsBridgeEvidence is not wrapped defensively', () => {
    // Only the PROJECTION leg is isolated; a failure to persist evidence at
    // all must still surface as a genuine error (required behavior: new
    // email -> contact resolved -> evidence persisted -> success response).
    const recordIdx = SRC.indexOf('await recordKnytsBridgeEvidence(');
    const isNewIdx = SRC.indexOf('if (isNew) {');
    expect(recordIdx).toBeGreaterThan(-1);
    expect(isNewIdx).toBeGreaterThan(recordIdx);
    const between = SRC.slice(recordIdx, isNewIdx);
    expect(between).not.toContain('try {');
  });
});

describe('Bug 2 — BridgeReserveInterestCard: theming follows an accent prop, CI unaffected', () => {
  const SRC = stripComments(readSource('components/journey/BridgeReserveInterestCard.tsx'));

  it('accepts an accent prop defaulting to indigo (CI unchanged) with an amber option', () => {
    expect(SRC).toContain("accent?: 'indigo' | 'amber'");
    expect(SRC).toMatch(/accent = 'indigo'/);
    expect(SRC).toContain('indigo:');
    expect(SRC).toContain('amber:');
  });

  it('no color is hardcoded outside the accent map — the rendered icon/input/button all key off accentClasses', () => {
    // The old hardcoded 'text-indigo-300' / 'bg-indigo-500' literals must be
    // gone from the render paths (they still legitimately appear inside the
    // ACCENT_CLASSES map itself, so assert absence outside that map instead
    // of a blanket absence).
    const afterMap = SRC.slice(SRC.indexOf('} as const;'));
    expect(afterMap).not.toContain('text-indigo-300');
    expect(afterMap).not.toContain('bg-indigo-500');
    expect(afterMap).toContain('accentClasses.icon');
    expect(afterMap).toContain('accentClasses.button');
    expect(afterMap).toContain('accentClasses.inputFocus');
  });

  it('the component is not forked — KNYTS and CI both import the same module', () => {
    const knyts = readSource('components/journey/KnytsBridgeChooseSurface.tsx');
    const ci = readSource('components/journey/ConstitutionalInternetBridgeChooseSurface.tsx');
    expect(knyts).toContain("from '@/components/journey/BridgeReserveInterestCard'");
    expect(ci).toContain("from '@/components/journey/BridgeReserveInterestCard'");
  });
});

describe('Bug 2 — call sites: KNYTS opts into amber, CI stays on the default', () => {
  it('KNYTS passes accent="amber" at its BridgeReserveInterestCard call site', () => {
    const SRC = stripComments(readSource('components/journey/KnytsBridgeChooseSurface.tsx'));
    const idx = SRC.indexOf('<BridgeReserveInterestCard');
    const block = SRC.slice(idx, idx + 700);
    expect(block).toContain('accent="amber"');
  });

  it('CI does not pass an accent prop — its call site (and therefore its rendered color) is unchanged', () => {
    const SRC = stripComments(readSource('components/journey/ConstitutionalInternetBridgeChooseSurface.tsx'));
    const idx = SRC.indexOf('<BridgeReserveInterestCard');
    const block = SRC.slice(idx, idx + 400);
    expect(block).not.toContain('accent=');
  });
});

describe('Bug 3A — Kickstarter is never embedded in an iframe; opens in a new tab on click', () => {
  const SRC = stripComments(readSource('components/journey/KnytsBridgeChooseSurface.tsx'));

  it('no <iframe> targets the Kickstarter URL anywhere in this surface', () => {
    expect(SRC).not.toMatch(/<iframe[^>]*kickstarterUrl/);
  });

  it('the Kickstarter card opens the URL via window.open() synchronously inside the click handler, never behind an await', () => {
    const idx = SRC.indexOf('const handleFollow = () => {');
    expect(idx).toBeGreaterThan(-1);
    const block = SRC.slice(idx, idx + 700);
    expect(block).toContain('window.open(kickstarterUrl');
    // The telemetry POST must remain fire-and-forget (void fetch(...)), and
    // window.open must not be inside that fetch's .then()/await chain.
    const openIdx = block.indexOf('window.open(');
    const fetchIdx = block.indexOf('void fetch(');
    expect(openIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(openIdx);
  });

  it('Kickstarter is an external action, not a left-pane view — no confirmation panel replaces the video (final closure pass, 2026-08-17)', () => {
    // Superseded by the final closure pass: clicking Follow used to switch
    // the left pane to a first-party confirmation panel, which was itself
    // the wrong UX. See tests/knyts-bridge-choose-final-closure.test.ts for
    // full coverage of the corrected badge-over-video behavior.
    expect(SRC).not.toContain("leftView === 'kickstarter'");
    expect(SRC).not.toMatch(/'video' \| 'store' \| 'ci' \| 'kickstarter'/);
  });

  it('the visible "open in new tab" fallback link is preserved, now as a badge over the video', () => {
    expect(SRC).toContain('Open Kickstarter in new tab');
  });
});

describe('Bug 3B — Follow-Kickstarter no longer competes with Store/CI for the leftView slot (final closure pass, 2026-08-17)', () => {
  const SRC = stripComments(readSource('components/journey/KnytsBridgeChooseSurface.tsx'));

  it('no separate kickstarterActive/showKickstarterPreview boolean exists anywhere in this surface', () => {
    expect(SRC).not.toMatch(/kickstarterActive/);
    expect(SRC).not.toMatch(/showKickstarterPreview/);
  });

  it('KickstarterFollowCard no longer accepts an active prop — it is an outbound action, not a contextual destination', () => {
    // Superseded: the earlier pass wired Kickstarter's own active/highlight
    // styling to `leftView === 'kickstarter'`, but that state no longer
    // exists. See tests/knyts-bridge-choose-final-closure.test.ts.
    const idx = SRC.indexOf('function KickstarterFollowCard(');
    const block = SRC.slice(idx, idx + 400);
    expect(block).not.toContain('active');
  });

  it('Store and CI destination cards read the identical leftView discriminator, so exactly one card is ever active', () => {
    expect(SRC).toContain("active={leftView === 'store'}");
    expect(SRC).toContain("active={leftView === 'ci'}");
  });
});
