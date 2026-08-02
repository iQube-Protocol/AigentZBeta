/**
 * The wallet must be reachable in the mode demos are given in.
 *
 * ── The defect this exists to prevent, which already happened ──────────────
 *
 * Operator, 2026-08-02:
 *
 *   > "The wallet is not rendering on top, you have to come out of full screen
 *   >  in order to see the wallet … the whole point of having it in full screen
 *   >  mode is that you should be able to walk the client through the journey
 *   >  … without having any distraction of the rest of the page furniture."
 *
 * `JourneyRunSurface`'s fullscreen portal picked `z-[70]`. `SmartWalletDrawer`
 * picked `z-50`. Neither knew about the other; both were locally reasonable;
 * the wallet lost. Two components each holding a number that only means
 * something RELATIVE to the other's is `inv.engineering.036` in its most
 * literal form — an ordering that no single place expresses.
 */

import { describe, it, expect } from 'vitest';

import { OVERLAY_LAYER, overlayZClass, outranksFullscreen } from '@/components/ui/overlayLayers';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('an act outranks the stage it is performed on', () => {
  it('the wallet overlay sits above the cartridge fullscreen presentation', () => {
    expect(OVERLAY_LAYER.WALLET_OVERLAY).toBeGreaterThan(OVERLAY_LAYER.CARTRIDGE_FULLSCREEN);
    expect(outranksFullscreen('WALLET_OVERLAY')).toBe(true);
    expect(outranksFullscreen('CARTRIDGE_FULLSCREEN')).toBe(false);
  });

  it('controls inside the wallet sit above the wallet', () => {
    expect(OVERLAY_LAYER.WALLET_POPOVER).toBeGreaterThan(OVERLAY_LAYER.WALLET_OVERLAY);
  });

  it('every layer is distinct — a tie is an ordering nobody decided', () => {
    const values = Object.values(OVERLAY_LAYER);
    expect(new Set(values).size).toBe(values.length);
  });

  it('emits a real Tailwind arbitrary-value class', () => {
    expect(overlayZClass('WALLET_OVERLAY')).toBe(`z-[${OVERLAY_LAYER.WALLET_OVERLAY}]`);
  });
});

describe('neither surface holds its own number any more', () => {
  const drawer = stripComments(readSource('app/components/content/SmartWalletDrawer.tsx'));
  const journey = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));

  it('the wallet overlay asks for its layer by name', () => {
    expect(drawer).toMatch(/overlayZClass\('WALLET_OVERLAY'\)/);
    // The literal that lost to fullscreen must not come back.
    expect(drawer).not.toMatch(/fixed inset-0 z-50/);
  });

  it('the fullscreen surface asks for its layer by name', () => {
    expect(journey).toMatch(/overlayZClass\('CARTRIDGE_FULLSCREEN'\)/);
    expect(journey).not.toMatch(/fixed inset-0 z-\[70\]/);
  });
});

describe('the overlay escapes the cartridge stacking context', () => {
  const drawer = stripComments(readSource('app/components/content/SmartWalletDrawer.tsx'));

  it('portals to document.body — a z-index alone cannot beat an ancestor', () => {
    // z-index orders siblings WITHIN a stacking context. Any cartridge
    // ancestor with transform/filter/opacity creates one, trapping a
    // `fixed inset-0` child below a body-level portal at any z-index. This
    // codebase has lost several rounds to exactly that.
    expect(drawer).toMatch(/createPortal\(overlayTree, document\.body\)/);
  });

  it('embedded mode is NOT portalled — it belongs inside its host layout', () => {
    // The copilot supplies the wallet's column; escaping it would break the
    // one arrangement that has always worked (MS-2, one owner per surface).
    expect(drawer).toMatch(/variant === 'overlay' && typeof document !== 'undefined'/);
    expect(drawer).toMatch(/: overlayTree;/);
  });
});
