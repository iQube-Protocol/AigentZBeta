/**
 * useCartridgePresence — the one-line a cartridge top-level component
 * calls to publish itself into the CartridgePresenceRegistry.
 *
 * Usage (every cartridge top-level component):
 *
 *   useCartridgePresence({
 *     cartridgeId: 'knyt-codex',
 *     displayLabel: 'KNYT Cartridge',
 *     tab: activeTab,
 *     subTab: activeSubTab,           // optional
 *     onSetTab: setActiveTab,
 *     onSetSubTab: setActiveSubTab,   // optional
 *     onClose,                        // only when mounted as a layer
 *     mode: 'inline' | 'layer',       // defaults to 'inline'
 *   });
 *
 * What it does:
 *   - On mount → registerCartridge() into the in-app registry AND
 *     postMessage('metame:cartridge-opened') to the shell (if mode === 'layer'
 *     OR if running inside an iframe whose parent is the thin client).
 *   - When tab / subTab change → updateCartridgeState() + postMessage(
 *     'metame:cartridge-state-changed').
 *   - On unmount → deregisterCartridge() + postMessage('metame:cartridge-closed').
 *   - Listens for inbound shell messages:
 *       'metame:cartridge-set-tab' → invoke onSetTab/onSetSubTab.
 *       'metame:cartridge-close'   → invoke onClose.
 *
 * The hook is intentionally side-effect-only — it returns nothing. Callers
 * stay declarative: render their own UI, manage their own state, and the
 * hook syncs that state to the rest of the world.
 *
 * Stateless cartridges (no tab state) still call this hook with `tab`
 * omitted so that wallet / cross-cartridge callers can at least see
 * "this cartridge is mounted" and route around it correctly.
 */

import { useEffect, useRef } from 'react';
import {
  type CartridgeId,
  registerCartridge,
  deregisterCartridge,
  updateCartridgeState,
} from '@/services/cartridge/CartridgePresenceRegistry';

export interface UseCartridgePresenceArgs {
  cartridgeId: CartridgeId;
  displayLabel: string;
  tab?: string;
  subTab?: string;
  onSetTab?: (tab: string) => void;
  onSetSubTab?: (subTab: string) => void;
  onClose?: () => void;
  mode?: 'inline' | 'layer';
}

interface InboundShellMessage {
  type: 'metame:cartridge-close' | 'metame:cartridge-set-tab';
  cartridgeId?: CartridgeId;
  tab?: string;
  subTab?: string;
}

function postToShell(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  // Always target window.parent — if there's no parent frame (top-level
  // app), the postMessage no-ops. The thin-client shell embeds the app
  // in an iframe and listens on its window.
  try {
    window.parent.postMessage(payload, '*');
  } catch { /* cross-origin denied; silently ignore */ }
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

  // Keep latest setters in a ref so the inbound-message listener never
  // closes over a stale onSetTab from the first render.
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
    postToShell({
      type: 'metame:cartridge-opened',
      cartridgeId,
      displayLabel,
      tab,
      subTab,
      mode,
    });
    return () => {
      deregisterCartridge(cartridgeId);
      postToShell({ type: 'metame:cartridge-closed', cartridgeId });
    };
    // We intentionally depend only on cartridgeId/displayLabel/mode for
    // the mount/unmount cycle. Tab changes are synced separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartridgeId, displayLabel, mode]);

  // Tab / sub-tab change → update registry + broadcast.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    updateCartridgeState(cartridgeId, { tab, subTab });
    postToShell({
      type: 'metame:cartridge-state-changed',
      cartridgeId,
      tab,
      subTab,
    });
  }, [cartridgeId, tab, subTab]);

  // Inbound shell messages — let the shell drive tab/close.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onMessage(ev: MessageEvent<InboundShellMessage>): void {
      const data = ev.data;
      if (!data || typeof data !== 'object' || !data.type) return;
      if (data.cartridgeId && data.cartridgeId !== cartridgeId) return;
      const h = handlersRef.current;
      if (data.type === 'metame:cartridge-set-tab') {
        if (data.tab !== undefined && h.onSetTab) h.onSetTab(data.tab);
        if (data.subTab !== undefined && h.onSetSubTab) h.onSetSubTab(data.subTab);
      } else if (data.type === 'metame:cartridge-close') {
        if (h.onClose) h.onClose();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [cartridgeId]);
}
