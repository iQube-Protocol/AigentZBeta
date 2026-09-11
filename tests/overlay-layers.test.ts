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

import {
  OVERLAY_LAYER,
  overlayZClass,
  outranksFullscreen,
  OWN_SURFACE_IFRAME_ALLOW,
} from '@/components/ui/overlayLayers';
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

describe('passkeys can actually be created where the wallet renders', () => {
  /*
   * Operator, 2026-08-02: "Passkey is not configured for this address, so
   * can't add passkey."
   *
   * The panel's classification was right — the browser really did raise
   * ERROR_INVALID_RP_ID / ERROR_INVALID_DOMAIN. Two independent causes, and
   * fixing either alone leaves it broken:
   *
   *   1. the server minted the challenge from `request.nextUrl.origin`, which
   *      behind Amplify's CloudFront is the LAMBDA's host, not the domain the
   *      user is on — so the relying party was one the browser has never
   *      visited;
   *   2. WebAuthn is gated by Permissions Policy inside an iframe.
   *      `publickey-credentials-create` is refused in ANY iframe that does not
   *      allow it, INCLUDING a same-origin one.
   *
   * Both surface as a relying-party error, which points at DNS or config
   * rather than at the frame or the proxy — which is why it survived.
   */
  const PASSKEY_ROUTES = [
    'app/api/passport/passkey/auth-options/route.ts',
    'app/api/passport/passkey/auth-verify/route.ts',
    'app/api/passport/passkey/enrol-options/route.ts',
    'app/api/passport/passkey/enrol-verify/route.ts',
  ];

  it('every passkey route derives the PUBLIC origin, never the Lambda\'s', () => {
    for (const p of PASSKEY_ROUTES) {
      const src = stripComments(readSource(p));
      expect(src, p).toMatch(/origin: resolveRequestOrigin\(request\)/);
      expect(src, p).not.toMatch(/origin: request\.nextUrl\.origin/);
    }
  });

  it('options and verify use the SAME origin resolver — a mismatch fails every ceremony', () => {
    // The challenge is minted with one rpID and verified against another; if
    // the two resolvers ever diverge, every passkey silently stops working.
    const optionsSrc = stripComments(readSource('app/api/passport/passkey/enrol-options/route.ts'));
    const verifySrc = stripComments(readSource('app/api/passport/passkey/enrol-verify/route.ts'));
    expect(optionsSrc).toMatch(/resolveRequestOrigin/);
    expect(verifySrc).toMatch(/resolveRequestOrigin/);
  });

  it('our own cartridge iframes allow credential creation and use', () => {
    expect(OWN_SURFACE_IFRAME_ALLOW).toMatch(/publickey-credentials-create/);
    expect(OWN_SURFACE_IFRAME_ALLOW).toMatch(/publickey-credentials-get/);
    for (const p of ['components/preview/PreviewFrame.tsx', 'components/metame/MetaMeRuntimeClient.tsx']) {
      const src = stripComments(readSource(p));
      expect(src, p).toMatch(/allow=\{OWN_SURFACE_IFRAME_ALLOW\}/);
      // The allow-list that could never create a passkey must not return.
      expect(src, p).not.toMatch(/allow="microphone; clipboard-read; clipboard-write"/);
    }
  });

  it('a third-party iframe is NOT handed credential permissions', () => {
    // Delegating our users' authenticator to someone else's page is a
    // different act entirely from letting our own surface use it.
    const journey = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));
    expect(journey).not.toMatch(/publickey-credentials/);
  });
});
