/**
 * The one place overlay stacking order is decided.
 *
 * ── The defect this closes (operator, 2026-08-02) ──────────────────────────
 *
 *   > "The wallet is not rendering on top, you have to come out of full screen
 *   >  in order to see the wallet … the whole point of having it in full screen
 *   >  mode is that you should be able to walk the client through the journey
 *   >  … without having any distraction of the rest of the page furniture."
 *
 * `JourneyRunSurface`'s fullscreen portal picked `z-[70]`. `SmartWalletDrawer`'s
 * overlay picked `z-50`. Neither knew about the other, both were locally
 * reasonable, and the wallet lost — so the one surface an operator must reach
 * mid-demo was unreachable in exactly the mode demos are given in.
 *
 * That is `inv.engineering.036` in its most literal form: two components each
 * holding a number that only means something RELATIVE to the other's. Numbers
 * scattered across components cannot express an ordering, so they drift and
 * leapfrog. This module holds the ordering itself; a component asks for a
 * layer by name and never invents a number.
 *
 * ── The ordering, and why it is this way round ─────────────────────────────
 *
 *   cartridge content
 *   → CARTRIDGE_FULLSCREEN  a presentation mode: it removes page furniture so
 *                           a journey can be walked through cleanly
 *   → WALLET_OVERLAY        an ACT: signing, proving control, approving an
 *                           invocation
 *   → WALLET_POPOVER        a control inside that act (persona switcher, menus)
 *
 * An act always outranks the stage it is performed on. Fullscreen exists to
 * present the journey; a wallet that cannot open on top of it defeats the
 * presentation instead of serving it.
 *
 * ── Stacking context, not just z-index ─────────────────────────────────────
 *
 * A higher number is NOT sufficient: `z-index` only orders siblings within a
 * stacking context, and any ancestor with `transform`, `filter`, `opacity < 1`
 * or `will-change` creates one — trapping a `fixed inset-0` child below an
 * unrelated portal no matter how large its z-index. This codebase has lost
 * multiple rounds to exactly that (the wallet-in-cartridge history). So a
 * surface that must sit above everything ALSO portals to `document.body`,
 * where the ordering below is the only thing that decides.
 */

export const OVERLAY_LAYER = {
  /** The Journey's distraction-free presentation mode. */
  CARTRIDGE_FULLSCREEN: 70,
  /**
   * The wallet, opened over a cartridge. Above fullscreen deliberately — see
   * the ordering note above. Raising anything past this needs a reason stated
   * HERE, not a larger number written somewhere else.
   */
  WALLET_OVERLAY: 80,
  /** Menus and switchers inside the wallet. Above their own surface only. */
  WALLET_POPOVER: 90,
} as const;

export type OverlayLayerName = keyof typeof OVERLAY_LAYER;

/** Tailwind arbitrary-value class for a named layer. */
export function overlayZClass(layer: OverlayLayerName): string {
  return `z-[${OVERLAY_LAYER[layer]}]`;
}

/**
 * True when a layer must outrank the cartridge's fullscreen presentation.
 * Exported so the relationship is checkable rather than remembered — the
 * failure was that nobody could see the two numbers at once.
 */
export function outranksFullscreen(layer: OverlayLayerName): boolean {
  return OVERLAY_LAYER[layer] > OVERLAY_LAYER.CARTRIDGE_FULLSCREEN;
}

/**
 * Permissions an iframe hosting OUR OWN cartridge/wallet surfaces must carry.
 *
 * ── The defect this closes (operator, 2026-08-02) ──────────────────────────
 *
 *   > "Passkey is not configured for this address, so can't add passkey. That
 *   >  needs to be fixed as well."
 *
 * The panel's classification was correct — the browser really did raise
 * `ERROR_INVALID_RP_ID` / `ERROR_INVALID_DOMAIN`. One cause was the server
 * minting the challenge from the Lambda's own origin (fixed in the passkey
 * routes). The other is here: **WebAuthn is gated by Permissions Policy inside
 * an iframe.** `publickey-credentials-create` is refused in ANY iframe that
 * does not explicitly allow it — including a same-origin one — and
 * `publickey-credentials-get` is refused cross-origin.
 *
 * Our cartridge iframes carried `microphone; clipboard-read; clipboard-write`
 * and nothing else, so enrolment could never succeed inside the viewer no
 * matter how the server was configured. The failure surfaces as a
 * relying-party error, which points at DNS or config rather than at the frame
 * — which is why it survived this long.
 *
 * ONLY for frames rendering our own origin. An iframe pointing at a third
 * party (e.g. the Horizen registry page) must NOT be handed credential
 * permissions — that would delegate our users' authenticator to someone else.
 */
export const OWN_SURFACE_IFRAME_ALLOW =
  'microphone; clipboard-read; clipboard-write; publickey-credentials-create; publickey-credentials-get';
