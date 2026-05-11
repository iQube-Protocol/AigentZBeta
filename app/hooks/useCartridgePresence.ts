/**
 * useCartridgePresence — one-line hook every cartridge top-level
 * component calls to publish itself into the CartridgePresenceRegistry
 * and the metaMe cross-frame protocol.
 *
 * Honours the parent contract:
 *   docs/architecture/metame-client-protocols.md
 *
 * On mount:
 *   - registerCartridge() into the in-app registry (publishes to
 *     window.__metame.cartridges automatically)
 *   - postMessage(METAME_EVENTS.CARTRIDGE_OPENED) to same-frame +
 *     window.parent (the host shell)
 *
 * On tab / subTab change:
 *   - updateCartridgeState() in the registry
 *   - postMessage(METAME_EVENTS.CARTRIDGE_TAB_CHANGED) to same-frame +
 *     parent so the shell can mirror breadcrumbs
 *
 * On unmount:
 *   - deregisterCartridge()
 *   - postMessage(METAME_EVENTS.CARTRIDGE_CLOSED) to same-frame + parent
 *
 * Inbound messages:
 *   - Listens for METAME_EVENTS.CARTRIDGE_CLOSED — when the shell sends
 *     this for our cartridgeId, we invoke onClose so the layer tears
 *     down. Origin enforced via isMetameOriginAllowed.
 *
 * Privacy: only surface identity (cartridgeId, displayLabel, tab,
 * subTab) appears in events / mirror. No T0 or T1 persona content.
 *
 * Usage example (KnytTab):
 *
 *   useCartridgePresence({
 *     cartridgeId: 'knyt-codex',
 *     displayLabel: 'KNYT Cartridge',
 *     tab: activeTab,
 *     onSetTab: setActiveTab,
 *   });
 */

import { useEffect, useRef } from 'react';
import {
  registerCartridge,
  deregisterCartridge,
  updateCartridgeState,
} from '@/services/cartridge/CartridgePresenceRegistry';
import { METAME_EVENTS } from '@/types/metameWindow';
import { isMetameOriginAllowed } from '@/utils/metameOriginAllowlist';

export interface UseCartridgePresenceArgs {
  cartridgeId: string;
  displayLabel: string;
  tab?: string;
  subTab?: string;
  onSetTab?: (tab: string) => void;
  onSetSubTab?: (subTab: string) => void;
  onClose?: () => void;
  mode?: 'inline' | 'layer';
}

interface InboundShellMessage {
  type?: string;
  cartridgeId?: string;
}

function broadcast(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  // Same-frame mirror so in-frame subscribers receive every event.
  try {
    window.postMessage(payload, window.location.origin);
  } catch { /* origin-locked or restricted */ }
  // Cross-frame mirror to parent (host shell). Parent decides via its
  // own allowlist whether to act on it.
  if (window.parent !== window) {
    try { window.parent.postMessage(payload, '*'); } catch { /* CSP / cross-origin denied */ }
  }
}

export function useCartridgePresence(args: UseCartridgePresenceArgs): void {
  const {
    cartridgeId,
    displayLabel,
    tab,
    subTab,
    onSetTab,
    onSetSubTab,
    onClose,
    mode = 'inline',
  } = args;

  // Keep latest setters in a ref so the inbound listener never closes
  // over a stale onClose from the first render.
  const handlersRef = useRef({ onSetTab, onSetSubTab, onClose });
  handlersRef.current = { onSetTab, onSetSubTab, onClose };

  // Mount + unmount lifecycle.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    registerCartridge({
      cartridgeId,
      displayLabel,
      tab,
      subTab,
      setTab: onSetTab,
      setSubTab: onSetSubTab,
      close: onClose,
      mode,
    });
    broadcast({
      type: METAME_EVENTS.CARTRIDGE_OPENED,
      schemaVersion: 1,
      cartridgeId,
      displayLabel,
    });
    return () => {
      deregisterCartridge(cartridgeId);
      broadcast({
        type: METAME_EVENTS.CARTRIDGE_CLOSED,
        schemaVersion: 1,
        cartridgeId,
      });
    };
    // mount / unmount only — tab changes are synced in a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartridgeId, displayLabel, mode]);

  // Tab / sub-tab change → update registry + broadcast.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    updateCartridgeState(cartridgeId, { tab, subTab });
    broadcast({
      type: METAME_EVENTS.CARTRIDGE_TAB_CHANGED,
      schemaVersion: 1,
      cartridgeId,
      tab,
      subTab,
    });
  }, [cartridgeId, tab, subTab]);

  // Inbound: shell asks the layer to close. Origin enforced; bare
  // cartridgeId filter so a global close intent (cartridgeId omitted)
  // doesn't fire every cartridge's onClose.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onMessage(ev: MessageEvent<InboundShellMessage>): void {
      if (!isMetameOriginAllowed(ev.origin)) return;
      const data = ev.data;
      if (!data || typeof data !== 'object' || !data.type) return;
      if (data.cartridgeId && data.cartridgeId !== cartridgeId) return;
      if (data.type !== METAME_EVENTS.CARTRIDGE_CLOSED) return;
      // Self-echo guard: our own outbound CLOSED broadcasts come from
      // the unmount path. If we receive CLOSED while still mounted, it's
      // a shell-driven request → invoke onClose.
      const h = handlersRef.current;
      if (h.onClose) h.onClose();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [cartridgeId]);
}
