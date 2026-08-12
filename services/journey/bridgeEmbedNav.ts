/**
 * bridgeEmbedNav — a Guided Journey Bridge embed's "return to root tab"
 * signal (2026-08-12, KNYTS↔CI parity pass).
 *
 * Why this exists: a focused embed surface (JourneySurfaceDescriptor's
 * `focused: true`, e.g. the KNYTS Bridge's Stand → Quests embed) shows the
 * destination cartridge's content with NO tab-group chrome — by design, so
 * the Bridge stays a minimal guide rather than the full cartridge shell.
 * When that content itself navigates to a sibling tab in the SAME cartridge
 * (e.g. a Quests card opening Living Canon via
 * `services/cartridge/CartridgePresenceRegistry.ts`'s `tryOpenInMountedCartridge`
 * — a same-window, in-memory tab switch with no iframe reload), there is no
 * chrome left to click back to the root tab with. The existing "Open full
 * view ↗" toggle escapes by switching to EXPANDED/full-chrome presentation
 * (a real, useful affordance, but a different one — it widens the view
 * rather than just returning to where the visitor started).
 *
 * This module is the narrow fix: a postMessage command from the PARENT
 * window (JourneyRunSurface, which owns the iframe element) INTO the
 * embedded cartridge's own window, asking it to reset its mounted tab back
 * to the descriptor's `rootTab` — via the SAME CartridgePresenceRegistry
 * every other same-window tab switch already uses, never a second tab-state
 * mechanism. Serializable, boundary-crossing, generic: any focused embed
 * descriptor can declare `rootTab` + `returnLabel` and get the toolbar for
 * free (JourneyRunSurface.tsx renders it), and any embed host that mounts
 * `subscribeBridgeEmbedReturn` (CodexPanelDynamic.tsx does, for every
 * cartridge it renders) can answer it — not a KNYTS-specific mechanism.
 *
 * Mirrors services/wallet/walletSurfaceRequest.ts's shape: a plain
 * serializable message, `targetOrigin: '*'` (the payload carries no secret —
 * a cartridge id and a tab slug — and pinning an origin would break the
 * legitimate cross-origin embed hosts this exists to serve), no function
 * callbacks across the boundary.
 */

export const BRIDGE_EMBED_RETURN_TYPE = 'metame:bridge-embed-return:v1';

/** Fully serializable. No functions, no class instances, no DOM nodes. */
export interface BridgeEmbedReturnCommand {
  type: typeof BRIDGE_EMBED_RETURN_TYPE;
  /** The mounted cartridge to reset — matches the embed descriptor's own `codexSlug`. */
  cartridgeId: string;
  /** The tab to return to — the embed descriptor's own `rootTab`. */
  rootTab: string;
}

function isReturnCommand(v: unknown): v is BridgeEmbedReturnCommand {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === BRIDGE_EMBED_RETURN_TYPE &&
    typeof (v as { cartridgeId?: unknown }).cartridgeId === 'string' &&
    typeof (v as { rootTab?: unknown }).rootTab === 'string'
  );
}

/**
 * Sent by the PARENT (JourneyRunSurface) into the embedded iframe's own
 * window. `target` is the iframe's `contentWindow` — a direct reference,
 * not a broadcast, since the parent already holds the exact frame it wants
 * to address and addressing every descendant frame (as walletSurfaceRequest
 * climbs every ANCESTOR) would risk resetting an unrelated embed's tab.
 */
export function requestBridgeEmbedReturn(
  target: Window | null | undefined,
  cartridgeId: string,
  rootTab: string,
): void {
  if (!target) return;
  const command: BridgeEmbedReturnCommand = { type: BRIDGE_EMBED_RETURN_TYPE, cartridgeId, rootTab };
  try {
    target.postMessage(command, '*');
  } catch {
    /* a cross-origin frame that refuses postMessage is not fatal — the
       visitor still has the "Open full view" escape hatch */
  }
}

/**
 * Subscribed INSIDE the embedded cartridge's own window (CodexPanelDynamic.tsx).
 * The listener is responsible for checking `command.cartridgeId` against its
 * own id before acting — this module only validates message shape.
 */
export function subscribeBridgeEmbedReturn(listener: (command: BridgeEmbedReturnCommand) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onMessage = (e: MessageEvent) => {
    if (isReturnCommand(e.data)) listener(e.data);
  };
  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
  };
}
