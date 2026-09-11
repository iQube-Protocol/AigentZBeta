/**
 * Local Wallet Profile Store
 *
 * A session-independent, browser-local index of the encrypted metaMe wallet
 * profiles that were created or imported ON THIS DEVICE. It exists so that
 * Passport authentication (`components/companion/PassportConnectPanel.tsx`)
 * can enumerate and unlock a wallet with ZERO Supabase session — the citizen
 * chooses a locally held wallet, proves control of it by signing, and only
 * THEN does the server resolve who they are from the recovered address.
 *
 * This index is NEVER authoritative. It is a UX convenience cache:
 *   - the server's recovered-address lookup is the sole source of authority
 *     for identity (see /api/passport-connect/proof)
 *   - a stale, missing, or tampered local entry can only make the flow less
 *     convenient (falls through to "no local wallet"), never grant access —
 *     there is no code path where reading this store alone establishes a
 *     session.
 *
 * Regression this repairs (operator ruling, 2026-08-01): the Passport connect
 * flow was calling `window.ethereum`/injected providers to sign the challenge.
 * The metaMe wallet — not MetaMask/Phantom/WalletConnect — is the Passport's
 * principal signing surface; external wallets may only be linked to it via a
 * separate, explicit "Linked wallets" action, never substituted as the
 * Passport authentication path.
 */

import { EncryptedKey } from "@/types/persona";

const STORAGE_KEY = "metame_local_wallet_profiles";

/** UX-hint only — see personaSpine's own `currentPersonaId` convention. Never authority. */
const LAST_ACTIVE_PERSONA_HINT_KEY = "currentPersonaId";

export interface LocalWalletProfile {
  personaId: string;
  address: string;
  displayLabel: string;
  encryptedPrivateKey: EncryptedKey;
  createdAt: string;
  lastUsedAt: string;
}

function readAll(): LocalWalletProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalWalletProfile[]) : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: LocalWalletProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Best-effort cache (e.g. storage quota) — never blocks the wallet flow.
  }
}

/** Wallet profiles available on this device, most-recently-used first. */
export function listLocalWalletProfiles(): LocalWalletProfile[] {
  return readAll().sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
}

/**
 * Record a newly created/imported wallet as a local profile. Called
 * alongside (never instead of) the server-side persona write — this is a
 * dual-write cache, not the source of truth.
 */
export function saveLocalWalletProfile(profile: {
  personaId: string;
  address: string;
  displayLabel: string;
  encryptedPrivateKey: EncryptedKey;
}): void {
  const now = new Date().toISOString();
  const existing = readAll().filter((p) => p.personaId !== profile.personaId);
  existing.push({ ...profile, createdAt: now, lastUsedAt: now });
  writeAll(existing);
}

/** Bump `lastUsedAt` after a successful local unlock, so it preselects next time. */
export function touchLocalWalletProfile(personaId: string): void {
  const all = readAll();
  const idx = all.findIndex((p) => p.personaId === personaId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], lastUsedAt: new Date().toISOString() };
  writeAll(all);
}

/** Forget a wallet profile on THIS device only. Never touches the server record. */
export function removeLocalWalletProfile(personaId: string): void {
  writeAll(readAll().filter((p) => p.personaId !== personaId));
}

/**
 * The profile to preselect as a UX hint — never as authority (see file
 * header). Prefers one matching the last-active-persona hint; falls back to
 * the most recently used local profile; null if this device holds none.
 */
export function getPreselectedLocalWalletProfile(): LocalWalletProfile | null {
  const profiles = listLocalWalletProfiles();
  if (profiles.length === 0) return null;
  const hint = typeof window !== "undefined" ? window.localStorage.getItem(LAST_ACTIVE_PERSONA_HINT_KEY) : null;
  if (hint) {
    const match = profiles.find((p) => p.personaId === hint);
    if (match) return match;
  }
  return profiles[0];
}

export function hasAnyLocalWalletProfile(): boolean {
  return readAll().length > 0;
}
