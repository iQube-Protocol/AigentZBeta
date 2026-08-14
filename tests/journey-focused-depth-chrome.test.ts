/**
 * KNYTS Bridge Focused/Full chrome regression (2026-08-11).
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 *
 * Two related bugs in the focusedNavDepth + Focus/Full toggle boundary:
 *
 * 1. `buildEmbedSurfaceSrc` threaded a surface's REGISTRY-static
 *    `focusedNavDepth` into the iframe URL unconditionally — even when the
 *    caller (JourneyRunSurface's expand-to-Full toggle) had already
 *    overridden `focused` to `undefined` for the expanded/Full state. Result:
 *    Full view still carried `?depth=0`, so KNYT Pulse's Full view rendered
 *    with all chrome suppressed instead of the complete canonical cartridge.
 *
 * 2. `CodexPanelDynamic`'s chrome-visibility logic collapsed BOTH the
 *    top-level cartridge bar (KNYT | Codex | Store | Terra | Order | 21 Sats
 *    | Admin | Docs) and the active group's own sibling-tab sub-header
 *    (e.g. Store's Episodes | KNYT Cards | Bundles | Investor KNYT) into a
 *    single `primaryChromeHidden` flag that only fired at depth 0. At depth
 *    1 (Store/Buy), NEITHER tier was hidden — Focused rendered full chrome.
 *
 * This file covers bug 1 (the URL-generation boundary) directly. Bug 2 is
 * covered by tests/codex-chrome-depth.test.ts against the extracted pure
 * resolveCodexChromeVisibility function.
 */

import { describe, it, expect } from 'vitest';
import { buildCodexUrl } from '@/utils/codex-nav';
import { JOURNEY_SURFACES, buildEmbedSurfaceSrc, type JourneySurfaceDescriptor } from '@/services/journey/journeySurfaceRegistry';

function embedDescriptor(ref: string): Extract<JourneySurfaceDescriptor, { kind: 'embed' }> {
  const descriptor = JOURNEY_SURFACES[ref];
  if (!descriptor || descriptor.kind !== 'embed') throw new Error(`"${ref}" is not a registered embed surface`);
  return descriptor;
}

function depthParam(src: string): string | null {
  return new URL(src, 'https://example.test').searchParams.get('depth');
}
function chromeParam(src: string): string | null {
  return new URL(src, 'https://example.test').searchParams.get('chrome');
}

describe('buildEmbedSurfaceSrc — depth only travels with focused mode', () => {
  it('knyts-bridge-buy-store: Focused carries chrome=focused&depth=1', () => {
    const descriptor = embedDescriptor('knyts-bridge-buy-store');
    expect(descriptor.focused).toBe(true);
    expect(descriptor.focusedNavDepth).toBe(1);

    const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(chromeParam(src)).toBe('focused');
    expect(depthParam(src)).toBe('1');
  });

  it('knyts-bridge-buy-store: Full (focused overridden to undefined) carries NEITHER chrome nor depth', () => {
    const descriptor = embedDescriptor('knyts-bridge-buy-store');
    // Mirrors JourneyRunSurface's expand-to-Full override exactly:
    // `{ ...descriptor, focused: shouldFocus ? true : undefined }`.
    const fullDescriptor = { ...descriptor, focused: undefined };

    const src = buildEmbedSurfaceSrc(fullDescriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(chromeParam(src)).toBeNull();
    expect(depthParam(src)).toBeNull();
  });

  it('knyts-bridge-view-pulse: Focused carries chrome=focused&depth=0', () => {
    const descriptor = embedDescriptor('knyts-bridge-view-pulse');
    expect(descriptor.focused).toBe(true);
    expect(descriptor.focusedNavDepth).toBe(0);

    const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(chromeParam(src)).toBe('focused');
    expect(depthParam(src)).toBe('0');
  });

  it('knyts-bridge-view-pulse: Full carries NEITHER chrome nor depth (this was the reported regression)', () => {
    const descriptor = embedDescriptor('knyts-bridge-view-pulse');
    const fullDescriptor = { ...descriptor, focused: undefined };

    const src = buildEmbedSurfaceSrc(fullDescriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(chromeParam(src)).toBeNull();
    expect(depthParam(src)).toBeNull();
  });

  it('knyts-bridge-stand: Focused carries chrome=focused&depth=0, Full carries neither', () => {
    const descriptor = embedDescriptor('knyts-bridge-stand');
    expect(descriptor.focusedNavDepth).toBe(0);

    const focusedSrc = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(chromeParam(focusedSrc)).toBe('focused');
    expect(depthParam(focusedSrc)).toBe('0');

    const fullSrc = buildEmbedSurfaceSrc({ ...descriptor, focused: undefined }, { personaId: 'p1' }, buildCodexUrl);
    expect(chromeParam(fullSrc)).toBeNull();
    expect(depthParam(fullSrc)).toBeNull();
  });
});
