/**
 * Shared TypeScript augmentation for `window.__metame`.
 *
 * Every metaMe client-side protocol that publishes a non-React,
 * cross-frame-readable mirror does so under a single key on this namespace.
 * One key per protocol — no nested grab-bags, no name collisions.
 *
 * See: docs/architecture/metame-client-protocols.md
 *      §"The window.__metame namespace"
 *
 * Adding a key requires a PR that:
 *   1. Reserves the key in docs/architecture/metame-client-protocols.md
 *      (Reserved window.__metame.* keys table)
 *   2. Augments `MetameNamespace` here with the protocol's mirror shape
 *   3. Lands the protocol implementation that publishes the mirror
 *
 * Each mirror exposes the same two-function shape so consumers can interop
 * without knowing protocol internals:
 *
 *   {
 *     getSnapshot(): TSnapshot;
 *     subscribe(listener: () => void): () => void;
 *   }
 *
 * Privacy contract (per types/access.ts):
 *   - Mirrors expose T1 only (personaSessionToken, displayLabel, etc.)
 *   - Most mirrors carry no persona content at all (cartridgeId, tab, …)
 *   - T0 (personaId, authProfileId, rootDid, kybeAttestation, cross-persona
 *     fioHandle) MUST NOT appear in any mirror snapshot
 */

import type { ActivePersonaSurface } from './access';

/**
 * Canonical mirror shape every protocol's `window.__metame.<key>` honours.
 */
export interface ProtocolMirror<TSnapshot> {
  getSnapshot(): TSnapshot;
  subscribe(listener: () => void): () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// PersonaSpine — `window.__metame.persona`
// ─────────────────────────────────────────────────────────────────────────

export type PersonaSpineMirrorStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'refreshing'
  | 'unauthenticated'
  | 'error';

export interface PersonaSpineMirrorSnapshot {
  status: PersonaSpineMirrorStatus;
  surface: ActivePersonaSurface | null;
  error: string | null;
}

export interface PersonaSpineMirror
  extends ProtocolMirror<PersonaSpineMirrorSnapshot> {
  /** Force a re-fetch. No-op while a fetch is in flight. */
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// CartridgePresenceRegistry — `window.__metame.cartridges`
//
// Owned by the runtime-shell agent. The shape below is a forward-declaration
// to reserve the namespace; the implementing agent finalises the snapshot
// type in their PR. Reviewers reject PRs that publish to
// `window.__metame.cartridges` without extending this declaration.
// ─────────────────────────────────────────────────────────────────────────

export interface CartridgePresenceEntry {
  cartridgeId: string;
  displayLabel: string;
  /** Whether this is the most-recently-focused cartridge. */
  active: boolean;
  /** Drive a tab change in the mounted cartridge. */
  setTab?: (tab: string) => void;
  /** Drive a sub-tab change in the mounted cartridge. */
  setSubTab?: (slug: string) => void;
  /** Tear down the mounted cartridge. */
  close?: () => void;
}

export interface CartridgePresenceSnapshot {
  /** All mounted cartridges, keyed by cartridgeId. */
  entries: Record<string, CartridgePresenceEntry>;
  /** Convenience: the active cartridge id, or null. */
  activeCartridgeId: string | null;
}

export type CartridgePresenceMirror = ProtocolMirror<CartridgePresenceSnapshot>;

// ─────────────────────────────────────────────────────────────────────────
// Reserved keys — declared here for completeness so the future PRs that
// land them do not need to amend Window typing separately. Each remains
// optional until the owning protocol publishes.
// ─────────────────────────────────────────────────────────────────────────

/** NotificationsBus — future. */
export type NotificationsMirror = ProtocolMirror<unknown>;
/** ReceiptsStream — future. */
export type ReceiptsStreamMirror = ProtocolMirror<unknown>;
/** ApprovalsQueue — future. */
export type ApprovalsQueueMirror = ProtocolMirror<unknown>;
/** CapsuleEvents — future. */
export type CapsuleEventsMirror = ProtocolMirror<unknown>;

// ─────────────────────────────────────────────────────────────────────────
// The namespace.
// ─────────────────────────────────────────────────────────────────────────

export interface MetameNamespace {
  persona?: PersonaSpineMirror;
  cartridges?: CartridgePresenceMirror;
  notifications?: NotificationsMirror;
  receipts?: ReceiptsStreamMirror;
  approvals?: ApprovalsQueueMirror;
  capsules?: CapsuleEventsMirror;
}

// ─────────────────────────────────────────────────────────────────────────
// Global augmentation.
// ─────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window {
    __metame?: MetameNamespace;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Canonical metame:* event names (single source of truth).
// Adding to this list requires a PR amending
// docs/architecture/metame-client-protocols.md (Reserved event-name roster).
// ─────────────────────────────────────────────────────────────────────────

export const METAME_EVENTS = {
  // PersonaSpine
  PERSONA_CHANGED: 'metame:persona-changed',
  PERSONA_REVOKED: 'metame:persona-revoked',

  // CartridgePresenceRegistry
  CARTRIDGE_OPENED: 'metame:cartridge-opened',
  CARTRIDGE_CLOSED: 'metame:cartridge-closed',
  CARTRIDGE_TAB_CHANGED: 'metame:cartridge-tab-changed',

  // Future protocols (declared for namespace reservation)
  NOTIFICATION_POSTED: 'metame:notification-posted',
  RECEIPT_FINALIZED: 'metame:receipt-finalized',
  APPROVAL_REQUESTED: 'metame:approval-requested',
  APPROVAL_RESOLVED: 'metame:approval-resolved',
  CAPSULE_MOUNTED: 'metame:capsule-mounted',
  CAPSULE_EVENT: 'metame:capsule-event',
} as const;

export type MetameEventName = (typeof METAME_EVENTS)[keyof typeof METAME_EVENTS];

/**
 * Deprecated event names kept dispatched/listened to for one release after
 * their canonical replacement lands. Consumers receiving these should
 * `console.warn` once per page load and migrate to the canonical name.
 */
export const METAME_DEPRECATED_ALIASES: Record<string, MetameEventName> = {
  'aa-persona-change-v1': METAME_EVENTS.PERSONA_CHANGED,
};

// Module-only export to make this file a module under isolatedModules.
export {};
