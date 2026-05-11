/**
 * CartridgePresenceRegistry
 *
 * The single source of truth for "which cartridges are currently mounted
 * in this app instance, and what tab/sub-tab is each one on?"
 *
 * Honours the metaMe client protocol parent contract:
 *   docs/architecture/metame-client-protocols.md
 *
 * Specifically:
 *   - Publishes a `window.__metame.cartridges` read-only mirror with the
 *     canonical `CartridgePresenceSnapshot` shape from `types/metameWindow.ts`.
 *   - Broadcasts canonical `metame:cartridge-{opened,closed,tab-changed}`
 *     events from `METAME_EVENTS`. No bespoke event names.
 *   - Internal store remains authoritative; the `window.__metame.*` mirror
 *     is a read-only snapshot for non-React / cross-frame consumers.
 *
 * Why this exists
 * ---------------
 * Before this module the wallet, the runtime, the copilot, and cross-
 * cartridge links each invented their own routing ("am I in this cartridge?
 * dispatch a window event; otherwise build a URL"). Bugs followed:
 * wallet's Living Canon chip routed but Bring-a-Knight / Herald / Open-
 * Episodes chips silently no-op'd in the embedded copilot view. The
 * registry replaces all of those bespoke branches with one question:
 * "is cartridge X mounted somewhere on screen, and if so what are its
 * setters?"
 *
 * Public surface
 * --------------
 *   registerCartridge / deregisterCartridge / updateCartridgeState
 *     — used by `useCartridgePresence`. Don't call directly.
 *   getCartridge / getActiveCartridge / listCartridges
 *   subscribe(listener) → unsubscribe
 *   tryOpenInMountedCartridge({ cartridgeId, tab, subTab })
 *     — the one helper the wallet + cross-cartridge callers use.
 *
 * Privacy
 * -------
 * Snapshot carries no persona content (T0 or T1) — only surface identity
 * (cartridgeId, displayLabel, tab, subTab). Per the parent contract §
 * "Privacy boundaries".
 */

import {
  METAME_EVENTS,
  type CartridgePresenceEntry as CanonicalEntry,
  type CartridgePresenceSnapshot,
  type CartridgePresenceMirror,
} from '@/types/metameWindow';

// `import 'types/metameWindow'` already augments `Window['__metame']` —
// referencing the side-effect avoids tree-shaking the augmentation.
import '@/types/metameWindow';

export type CartridgeId = string;

/** Internal entry carries ordering/mode metadata; the published snapshot
 *  uses the canonical shape from `types/metameWindow.ts`. */
interface InternalEntry {
  cartridgeId: CartridgeId;
  displayLabel: string;
  tab?: string;
  subTab?: string;
  setTab?: (tab: string) => void;
  setSubTab?: (subTab: string) => void;
  close?: () => void;
  mode: 'inline' | 'layer';
  mountedAt: number;
}

type Listener = () => void;

interface RegistryState {
  entries: Map<CartridgeId, InternalEntry>;
  activeId: CartridgeId | null;
  listeners: Set<Listener>;
}

const STATE_KEY = '__metameCartridgeRegistryState';

function getState(): RegistryState {
  if (typeof window === 'undefined') {
    // SSR fallback — module-local, never observable to a real consumer.
    return { entries: new Map(), activeId: null, listeners: new Set() };
  }
  const w = window as unknown as { [STATE_KEY]?: RegistryState };
  if (!w[STATE_KEY]) {
    w[STATE_KEY] = { entries: new Map(), activeId: null, listeners: new Set() };
  }
  return w[STATE_KEY]!;
}

function notify(): void {
  const s = getState();
  s.listeners.forEach((fn) => {
    try { fn(); } catch (err) { console.warn('[CartridgePresenceRegistry] listener threw:', err); }
  });
}

// ─── Snapshot projection ─────────────────────────────────────────────────
// Project internal entries onto the canonical CartridgePresenceEntry shape
// from types/metameWindow.ts. Drops internal-only fields (mode, mountedAt,
// tab, subTab — tab info is published via metame:cartridge-tab-changed
// events per the parent contract).

function toCanonicalEntry(internal: InternalEntry, activeId: CartridgeId | null): CanonicalEntry {
  return {
    cartridgeId: internal.cartridgeId,
    displayLabel: internal.displayLabel,
    active: internal.cartridgeId === activeId,
    setTab: internal.setTab,
    setSubTab: internal.setSubTab,
    close: internal.close,
  };
}

function buildSnapshot(): CartridgePresenceSnapshot {
  const s = getState();
  const entries: Record<string, CanonicalEntry> = {};
  s.entries.forEach((v, k) => { entries[k] = toCanonicalEntry(v, s.activeId); });
  return { entries, activeCartridgeId: s.activeId };
}

// ─── window.__metame.cartridges mirror ──────────────────────────────────
// Idempotent publish so HMR / multiple module loads don't double-register.

function publishMirror(): void {
  if (typeof window === 'undefined') return;
  if (!window.__metame) window.__metame = {};
  if (window.__metame.cartridges) return;

  const mirror: CartridgePresenceMirror = {
    getSnapshot: buildSnapshot,
    subscribe,
  };
  window.__metame.cartridges = mirror;
}

// ─── Public imperative API (same-frame) ─────────────────────────────────

export function registerCartridge(entry: {
  cartridgeId: CartridgeId;
  displayLabel: string;
  tab?: string;
  subTab?: string;
  setTab?: (tab: string) => void;
  setSubTab?: (subTab: string) => void;
  close?: () => void;
  mode?: 'inline' | 'layer';
}): void {
  publishMirror();
  const s = getState();
  if (s.entries.has(entry.cartridgeId)) {
    console.warn(
      `[CartridgePresenceRegistry] ${entry.cartridgeId} re-registered; last mount wins.`,
    );
  }
  s.entries.set(entry.cartridgeId, {
    ...entry,
    mode: entry.mode ?? 'inline',
    mountedAt: Date.now(),
  });
  s.activeId = entry.cartridgeId;
  notify();
}

export function deregisterCartridge(cartridgeId: CartridgeId): void {
  const s = getState();
  if (!s.entries.delete(cartridgeId)) return;
  if (s.activeId === cartridgeId) {
    let next: InternalEntry | null = null;
    s.entries.forEach((e) => {
      if (!next || e.mountedAt > next.mountedAt) next = e;
    });
    s.activeId = next?.cartridgeId ?? null;
  }
  notify();
}

export function updateCartridgeState(
  cartridgeId: CartridgeId,
  patch: Partial<Pick<InternalEntry, 'tab' | 'subTab'>>,
): void {
  const s = getState();
  const cur = s.entries.get(cartridgeId);
  if (!cur) return;
  s.entries.set(cartridgeId, { ...cur, ...patch });
  notify();
}

export function setActiveCartridge(cartridgeId: CartridgeId): void {
  const s = getState();
  if (!s.entries.has(cartridgeId)) return;
  if (s.activeId === cartridgeId) return;
  s.activeId = cartridgeId;
  notify();
}

export function getCartridge(cartridgeId: CartridgeId): CanonicalEntry | null {
  const s = getState();
  const internal = s.entries.get(cartridgeId);
  return internal ? toCanonicalEntry(internal, s.activeId) : null;
}

export function getActiveCartridge(): CanonicalEntry | null {
  const s = getState();
  if (!s.activeId) return null;
  const internal = s.entries.get(s.activeId);
  return internal ? toCanonicalEntry(internal, s.activeId) : null;
}

export function listCartridges(): CanonicalEntry[] {
  const s = getState();
  return Array.from(s.entries.values()).map((e) => toCanonicalEntry(e, s.activeId));
}

export function subscribe(listener: Listener): () => void {
  const s = getState();
  s.listeners.add(listener);
  return () => { s.listeners.delete(listener); };
}

/**
 * Universal "try to switch a mounted cartridge to a tab/sub-tab" entry
 * point. Returns true on success; false if the cartridge isn't currently
 * mounted (caller falls through to a cross-cartridge URL navigation via
 * `buildCodexUrl`).
 */
export function tryOpenInMountedCartridge(args: {
  cartridgeId: CartridgeId;
  tab?: string;
  subTab?: string;
}): boolean {
  const s = getState();
  const entry = s.entries.get(args.cartridgeId);
  if (!entry) return false;
  if (args.tab !== undefined && entry.setTab) entry.setTab(args.tab);
  if (args.subTab !== undefined && entry.setSubTab) entry.setSubTab(args.subTab);
  setActiveCartridge(args.cartridgeId);
  return true;
}

// Re-export canonical event names so callers don't have to dig through
// types/metameWindow.ts to find the right strings.
export const CARTRIDGE_EVENTS = {
  OPENED:      METAME_EVENTS.CARTRIDGE_OPENED,
  CLOSED:      METAME_EVENTS.CARTRIDGE_CLOSED,
  TAB_CHANGED: METAME_EVENTS.CARTRIDGE_TAB_CHANGED,
} as const;

// Initial mirror publish on module load so non-React consumers (debug
// console, vanilla JS) can find the namespace even before any cartridge
// mounts.
publishMirror();
