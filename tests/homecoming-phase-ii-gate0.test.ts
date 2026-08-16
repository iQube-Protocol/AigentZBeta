/**
 * Homecoming Phase II activation pack — Gate 0 bridge hotfixes
 * (`codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md`).
 *
 * 0A: the Kickstarter CTA previously awaited its telemetry POST before
 * calling `window.open()` — popup-blocked in most browsers since it was no
 * longer synchronously tied to the click, AND stranded the visitor entirely
 * if the POST failed. The fix decouples navigation (synchronous, resolved
 * client-side) from telemetry (fire-and-forget).
 *
 * 0B: CI's "Explore the Mythos" destination label becomes "Explore the
 * Mythos of the Polity" — copy only, no behavior change.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('Gate 0A — Kickstarter CTA navigates unconditionally', () => {
  const SRC = stripComments(readSource('components/journey/KnytsBridgeChooseSurface.tsx'));

  it('resolves the Kickstarter URL synchronously, client-side — no server round-trip gates navigation', () => {
    const idx = SRC.indexOf('const kickstarterUrl = getKnytsBridgeKickstarterUrl();');
    expect(idx, 'kickstarterUrl must be resolved synchronously via the shared config, not fetched').toBeGreaterThan(-1);
  });

  it('KickstarterFollowCard calls onFollow() synchronously — never inside/after an awaited fetch', () => {
    const idx = SRC.indexOf('function KickstarterFollowCard');
    const body = SRC.slice(idx, SRC.indexOf('return (', idx));
    // handleFollow must not be declared async, and onFollow() must be
    // called before the fetch — never gated on its resolution.
    expect(body).not.toMatch(/const handleFollow = async/);
    const onFollowIdx = body.indexOf('onFollow();');
    const fetchIdx = body.indexOf('fetch(');
    expect(onFollowIdx, 'onFollow() call not found').toBeGreaterThan(-1);
    expect(fetchIdx, 'fetch call not found').toBeGreaterThan(-1);
    expect(onFollowIdx).toBeLessThan(fetchIdx);
  });

  it('the telemetry fetch is fire-and-forget (void + .catch), never awaited before navigation', () => {
    const idx = SRC.indexOf('function KickstarterFollowCard');
    const body = SRC.slice(idx, SRC.indexOf('function MailtoCard', idx));
    expect(body).toContain('void fetch(');
    expect(body).not.toMatch(/await fetch\(/);
  });

  it('an always-visible, real <a target="_blank"> fallback exists — never gated on a detected iframe failure', () => {
    const idx = SRC.indexOf("leftView === 'kickstarter'");
    const block = SRC.slice(idx, idx + 1200);
    expect(block).toContain('target="_blank"');
    expect(block).toContain('rel="noopener noreferrer"');
    expect(block).toContain('Open Kickstarter in new tab');
    // Unconditional — the anchor is a sibling of the iframe, not behind an
    // onError/failure-detected conditional.
    expect(block).not.toMatch(/onError.*Open Kickstarter/s);
  });

  it('reward copy is truthful: states the CONFIRMED-follow amount, never implies the click itself earned it', () => {
    expect(SRC).toContain('Earn 0.25 Knightcoin (0.25 DVN KNYT) when your follow is confirmed.');
  });

  it('the click route still only ever records the observed preview-click action (regression pin)', () => {
    const routeSrc = stripComments(readSource('app/api/journey/knyts-bridge/choose/kickstarter-click/route.ts'));
    expect(routeSrc).toContain("actionType: 'kickstarter_preview_clicked'");
    expect(routeSrc).not.toContain('kickstarter_follow_confirmed');
  });
});

describe('Gate 0B — Constitutional Internet Bridge copy', () => {
  const SRC = stripComments(readSource('components/journey/ConstitutionalInternetBridgeChooseSurface.tsx'));

  it('the Mythos destination label is corrected to "Explore the Mythos of the Polity"', () => {
    expect(SRC).toContain('label="Explore the Mythos of the Polity"');
  });

  it('no navigation/behavior changed — the mythos left-view id and its onClick wiring are unchanged', () => {
    const idx = SRC.indexOf('label="Explore the Mythos of the Polity"');
    const block = SRC.slice(Math.max(0, idx - 200), idx + 200);
    expect(block).toContain("active={leftView === 'mythos'}");
    expect(block).toContain("onClick={() => setLeftView('mythos')}");
  });
});
