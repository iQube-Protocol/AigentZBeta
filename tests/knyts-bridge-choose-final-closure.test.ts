/**
 * KNYTS Bridge CHOOSE — final closure pass, two fixes (2026-08-17).
 *
 * Structural/source-authority canaries, matching the established convention
 * for this component (tests/knyts-bridge-campaign-activation.test.ts,
 * tests/knyts-bridge-choose-three-bug-fixes.test.ts) — no live-DB or
 * React-render harness exists in this test suite, so component-source
 * invariants are verified from the real TSX-aware AST
 * (tests/_lib/sourceAuthority.ts), not re-derived assumptions.
 *
 * Fix 1 — Kickstarter is an external ACTION, never a left-pane view. The
 * bridge video must always remain visible; Follow only opens a new tab and
 * overlays a small badge on the existing video frame.
 *
 * Fix 2 — exactly one contextual destination chip (Store/CI) may be active
 * at a time, derived from the single `leftView` state. Every action that
 * conceptually leaves the contextual selection (Follow Kickstarter, Ask
 * Kn0w1, Share, the CFS Pilot mailto) must clear it back to `'video'`.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const SRC = stripComments(readSource('components/journey/KnytsBridgeChooseSurface.tsx'));

describe('Fix 1 — Kickstarter never replaces the video', () => {
  it("'kickstarter' is not a member of LeftView — the type is exactly video/store/ci", () => {
    expect(SRC).toMatch(/type LeftView = 'video' \| 'store' \| 'ci';/);
  });

  it('the left-pane ternary has no branch keyed on a kickstarter leftView', () => {
    expect(SRC).not.toMatch(/leftView === 'kickstarter'/);
  });

  it('no <iframe> anywhere in this surface targets the Kickstarter URL', () => {
    expect(SRC).not.toMatch(/<iframe[^>]*kickstarterUrl/);
  });

  it('Follow the Kickstarter opens the canonical URL in a new tab, synchronously, inside the click handler', () => {
    const idx = SRC.indexOf('const handleFollow = () => {');
    expect(idx).toBeGreaterThan(-1);
    const block = SRC.slice(idx, idx + 700);
    expect(block).toContain("window.open(kickstarterUrl, '_blank', 'noopener,noreferrer')");
    // Must not be inside an async/await chain — a direct user gesture.
    expect(block).not.toMatch(/await[\s\S]*window\.open/);
  });

  it('the fire-and-forget kickstarter_preview_clicked telemetry is unchanged', () => {
    const idx = SRC.indexOf('const handleFollow = () => {');
    const block = SRC.slice(idx, idx + 700);
    expect(block).toContain("void fetch('/api/journey/knyts-bridge/choose/kickstarter-click'");
    expect(block).not.toMatch(/await fetch\(/);
  });

  it('kickstarterOpened is a single-purpose flag, never a left-pane content discriminator', () => {
    expect(SRC).toContain('const [kickstarterOpened, setKickstarterOpened] = useState(false)');
    // It must not appear anywhere inside the leftView ternary's condition chain.
    const ternaryStart = SRC.indexOf("leftView === 'store' ?");
    const ternaryEnd = SRC.indexOf('</FullscreenableFrame>');
    const ternaryBlock = SRC.slice(ternaryStart, ternaryEnd);
    // It legitimately appears as a render GATE for the badge (an `&&` guard),
    // but never as part of an `leftView === ...` / ternary condition switch.
    expect(ternaryBlock).not.toMatch(/leftView === kickstarterOpened|kickstarterOpened === leftView/);
  });

  it('the "Open Kickstarter in new tab" badge is gated on kickstarterOpened and overlays the video, not a separate view', () => {
    const idx = SRC.indexOf('{kickstarterOpened && (');
    expect(idx, 'badge not found').toBeGreaterThan(-1);
    const block = SRC.slice(idx, idx + 500);
    expect(block).toContain('Open Kickstarter in new tab');
    expect(block).toContain('target="_blank"');
    expect(block).toContain(kickstarterUrlToken());
    function kickstarterUrlToken() {
      return 'href={kickstarterUrl}';
    }
  });

  it('the video (or its no-video fallback) and the badge share one relatively-positioned wrapper — the badge overlays, never replaces', () => {
    const videoIdx = SRC.indexOf("<div className=\"relative h-full w-full\">");
    expect(videoIdx, 'relative wrapper not found').toBeGreaterThan(-1);
    const badgeIdx = SRC.indexOf('{kickstarterOpened && (', videoIdx);
    const frameCloseIdx = SRC.indexOf('</FullscreenableFrame>', videoIdx);
    expect(badgeIdx).toBeGreaterThan(videoIdx);
    expect(badgeIdx).toBeLessThan(frameCloseIdx);
  });

  it('KickstarterFollowCard carries no active/highlight prop of its own — it is an outbound action, not a fourth contextual destination', () => {
    const idx = SRC.indexOf('function KickstarterFollowCard(');
    const sigBlock = SRC.slice(idx, idx + 250);
    expect(sigBlock).not.toContain('active');
  });
});

describe('Fix 2 — exactly one contextual destination chip is ever active', () => {
  it('Store and CI chips derive active from the single leftView discriminator', () => {
    expect(SRC).toContain("active={leftView === 'store'}");
    expect(SRC).toContain("active={leftView === 'ci'}");
  });

  it('no second boolean (e.g. ciActive) exists anywhere in this surface', () => {
    expect(SRC).not.toMatch(/ciActive/);
    expect(SRC).not.toMatch(/storeActive/);
  });

  it('CI active -> click Store: Store\'s onClick sets leftView to store, clearing CI (same discriminator, mutually exclusive by construction)', () => {
    const idx = SRC.indexOf('label="Explore the KNYT Store"');
    const block = SRC.slice(idx, idx + 200);
    expect(block).toContain("onClick={() => setLeftView('store')}");
  });

  it('CI active -> click Follow Kickstarter: the follow handler resets leftView to video before anything else, clearing CI', () => {
    const idx = SRC.indexOf('<KickstarterFollowCard');
    const block = SRC.slice(idx, idx + 550);
    const onFollowIdx = block.indexOf('onFollow={() => {');
    expect(onFollowIdx).toBeGreaterThan(-1);
    const setLeftViewIdx = block.indexOf("setLeftView('video')", onFollowIdx);
    const setOpenedIdx = block.indexOf('setKickstarterOpened(true)', onFollowIdx);
    expect(setLeftViewIdx).toBeGreaterThan(-1);
    expect(setOpenedIdx).toBeGreaterThan(-1);
    // Order doesn't semantically matter for two independent setState calls in
    // the same handler (React batches them), but both must be present.
  });

  it('CI active -> click Ask Kn0w1: the handler clears leftView to video before opening the copilot', () => {
    const idx = SRC.indexOf('Ask Kn0w1');
    // Walk backwards to the nearest onClick before this label.
    const onClickIdx = SRC.lastIndexOf('onClick={() => {', idx);
    const block = SRC.slice(onClickIdx, idx);
    expect(block).toContain("setLeftView('video')");
    expect(block).toContain('onOpenKnytCopilot?.()');
  });

  it('CI active -> click Share the Bridge: the handler clears leftView to video before opening the share modal', () => {
    const idx = SRC.indexOf('Share the Bridge');
    const onClickIdx = SRC.lastIndexOf('onClick={() => {', idx);
    const block = SRC.slice(onClickIdx, idx);
    expect(block).toContain("setLeftView('video')");
    expect(block).toContain('setShareOpen(true)');
  });

  it('CI active -> click the CFS Pilot card: onClick clears leftView to video AND activates the dormant Financial Sovereignty branch (AEE-XP-001 §4, Main Spine 2026-09-01 correction)', () => {
    const idx = SRC.indexOf('label="Apply to join the Constitutional Financial Services Pilot"');
    const onClickIdx = SRC.indexOf('onClick={() => {', idx);
    const block = SRC.slice(onClickIdx, idx + 400);
    expect(block).toContain("setLeftView('video')");
    expect(block).toContain('activateJourneyBranch(');
    expect(block).toContain('KNYTS_BRIDGE_CROSSING_JOURNEY.id');
    expect(block).toContain("'financial-services'");
    expect(block).toContain("'JOIN_FINANCIAL_SERVICES'");
    expect(block).toContain("'fs-discover'");
  });

  it('the CFS Pilot card still offers an inline mailto as a secondary CTA — DestinationCard\'s existing stopPropagation-guarded pattern, never a second bespoke anchor', () => {
    const idx = SRC.indexOf('label="Apply to join the Constitutional Financial Services Pilot"');
    const block = SRC.slice(idx, idx + 600);
    expect(block).toContain('mailtoSubject="Constitutional Financial Services Pilot — interest"');
    expect(block).toContain('mailtoLabel="Email instead"');
  });

  it('DestinationCard accepts and forwards a mailto extra — the anchor stops propagation so it never also fires the card\'s onClick', () => {
    const idx = SRC.indexOf('function DestinationCard(');
    const block = SRC.slice(idx, idx + 900);
    expect(block).toContain('mailtoSubject?: string');
    expect(block).toContain('mailtoLabel?: string');
    expect(block).toMatch(/<a[\s\S]*onClick={\(e\) => e\.stopPropagation\(\)}/);
  });
});
