/**
 * CartridgePresenceRegistry — single source of truth for "which cartridges
 * are currently mounted in this app instance, and what tab/sub-tab is each
 * one on?"
 *
 * Why this exists
 * ---------------
 * The wallet, the runtime, the copilot, and cross-cartridge links all need
 * to ask:
 *   1. "Is cartridge X already mounted somewhere on screen?"
 *   2. "If so, switch it to tab Y / sub-tab Z."
 *   3. "If not, open it fresh (as a layer or via the codex shell URL)."
 *
 * Before this module each caller had its own ad-hoc answer: window-level
 * custom events, localStorage flags, buildCodexUrl-with-full-reload, etc.
 * That produced bugs like "the Living Canon chip in the wallet works in
 * the KNYT cartridge but does nothing in the AgentiQ cartridge" because
 * the routing logic guessed instead of looked.
 *
 * Public surface
 * --------------
 * Cartridges register themselves via the `useCartridgePresence` hook
 * (which writes here on mount, removes on unmount). Callers read via
 * `getActiveCartridge` / `getCartridge` / `subscribe`.
 *
 * Layered (wallet-launched) cartridge mounts ALSO broadcast a
 * `metame:cartridge-*` postMessage protocol to `window.parent` so the
 * thin-client shell can render chrome (cartridge icon + close button)
 * and route close/tab requests back into the app. See
 * `codexes/packs/agentiq/updates/2026-05-11_cartridge-presence-registry-spec.md`
 * for the protocol contract.
 *
 * Concurrency
 * -----------
 * Multiple instances of the same cartridge are not supported (last-mount
 * wins on collision — we log a warn). This matches the product model
 * where a cartridge is either visible or it isn't.
 */

export type CartridgeId =
  | 'knyt-codex'
  | 'qriptopian'
  | 'agentiq'
  | 'agentiq-os'
  | 'alpha-knyt'
  | 'metame'
  | 'marketa'
  | 'aigent-moneypenny'
  | 'aigent-nakamoto'
  | (string & {}); // openable for forward-compat without losing IntelliSense

export interface CartridgePresenceEntry {
  cartridgeId: CartridgeId;
  displayLabel: string;
  tab?: string;
  subTab?: string;
  /** Wallet/cross-cartridge callers invoke this to switch tab. */
  setTab?: (tab: string) => void;
  /** Wallet/cross-cartridge callers invoke this to switch sub-tab. */
  setSubTab?: (subTab: string) => void;
  /** Layer mode only: how to tear down the cartridge from outside. */
  close?: () => void;
  /** Render mode — informs callers whether we can `close()`. */
  mode: 'inline' | 'layer';
  /** Monotonic counter — most recently registered wins on collision. */
  mountedAt: number;
}

type Listener = () => void;

interface RegistryState {
  cartridges: Map<CartridgeId, CartridgePresenceEntry>;
  /** Cartridge id of the most recently focused entry; null if none. */
  activeId: CartridgeId | null;
  listeners: Set<Listener>;
}

const W = typeof window !== 'undefined'
  ? (window as unknown as { __metameCartridgeRegistry?: RegistryState })
  : null;

function getState(): RegistryState {
  if (!W) {
    // SSR fallback — a no-op state. Hooks gate on `typeof window` so this
    // path is only hit if a caller imports from a server module.
    return {
      cartridges: new Map(),
      activeId: null,
      listeners: new Set(),
    };
  }
  if (!W.__metameCartridgeRegistry) {
    W.__metameCartridgeRegistry = {
      cartridges: new Map(),
      activeId: null,
      listeners: new Set(),
    };
  }
  return W.__metameCartridgeRegistry;
}

function notify(): void {
  const s = getState();
  s.listeners.forEach((fn) => {
    try { fn(); } catch (err) { console.warn('[CartridgePresenceRegistry] listener threw:', err); }
  });
}

export function registerCartridge(entry: Omit<CartridgePresenceEntry, 'mountedAt'>): void {
  const s = getState();
  if (s.cartridges.has(entry.cartridgeId)) {
    console.warn(
      `[CartridgePresenceRegistry] ${entry.cartridgeId} re-registered; last mount wins.`,
    );
  }
  s.cartridges.set(entry.cartridgeId, { ...entry, mountedAt: Date.now() });
  s.activeId = entry.cartridgeId;
  notify();
}

export function deregisterCartridge(cartridgeId: CartridgeId): void {
  const s = getState();
  if (!s.cartridges.delete(cartridgeId)) return;
  if (s.activeId === cartridgeId) {
    // Promote the next most-recently-mounted cartridge to active.
    let next: CartridgePresenceEntry | null = null;
    s.cartridges.forEach((e) => {
      if (!next || e.mountedAt > next.mountedAt) next = e;
    });
    s.activeId = next?.cartridgeId ?? null;
  }
  notify();
}

export function updateCartridgeState(
  cartridgeId: CartridgeId,
  patch: Partial<Pick<CartridgePresenceEntry, 'tab' | 'subTab'>>,
): void {
  const s = getState();
  const cur = s.cartridges.get(cartridgeId);
  if (!cur) return;
  s.cartridges.set(cartridgeId, { ...cur, ...patch });
  notify();
}

export function setActiveCartridge(cartridgeId: CartridgeId): void {
  const s = getState();
  if (!s.cartridges.has(cartridgeId)) return;
  if (s.activeId === cartridgeId) return;
  s.activeId = cartridgeId;
  notify();
}

export function getCartridge(cartridgeId: CartridgeId): CartridgePresenceEntry | null {
  return getState().cartridges.get(cartridgeId) ?? null;
}

export function getActiveCartridge(): CartridgePresenceEntry | null {
  const s = getState();
  return s.activeId ? s.cartridges.get(s.activeId) ?? null : null;
}

export function listCartridges(): CartridgePresenceEntry[] {
  return Array.from(getState().cartridges.values());
}

export function subscribe(listener: Listener): () => void {
  const s = getState();
  s.listeners.add(listener);
  return () => { s.listeners.delete(listener); };
}

/**
 * Universal "open a task in a cartridge" entry point.
 *
 * If the cartridge is already mounted, switch its tab/sub-tab in place
 * (cheap, no full re-render of the codex shell). Otherwise return false
 * so the caller can fall through to a cross-cartridge URL navigation
 * via `buildCodexUrl`.
 */
export function tryOpenInMountedCartridge(args: {
  cartridgeId: CartridgeId;
  tab?: string;
  subTab?: string;
}): boolean {
  const entry = getCartridge(args.cartridgeId);
  if (!entry) return false;
  if (args.tab !== undefined && entry.setTab) entry.setTab(args.tab);
  if (args.subTab !== undefined && entry.setSubTab) entry.setSubTab(args.subTab);
  setActiveCartridge(args.cartridgeId);
  return true;
}
