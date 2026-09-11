/**
 * Session Service for Wallet
 * 
 * Manages wallet unlock sessions. Once a user enters their password,
 * the session remains active until timeout or explicit lock.
 * 
 * The decrypted private key is held in memory only and never persisted.
 * Session state is stored in sessionStorage (cleared on tab close).
 */

import { WalletSession, SessionConfig, EncryptedKey } from '@/types/persona';
import { decryptPrivateKey, verifyPassword } from './keyService';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  defaultTimeoutMinutes: 30,
  maxTimeoutMinutes: 120,
  autoLockOnBlur: false, // Can be enabled for higher security
};

const SESSION_STORAGE_KEY = 'wallet_session';
const DECRYPTED_KEY_CACHE = new Map<string, string>();

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Create a new wallet session
 * 
 * Called after successful password verification.
 */
export function createSession(
  personaId: string,
  timeoutMinutes: number = DEFAULT_SESSION_CONFIG.defaultTimeoutMinutes
): WalletSession {
  const now = Date.now();
  const session: WalletSession = {
    personaId,
    unlockedAt: now,
    expiresAt: now + timeoutMinutes * 60 * 1000,
    timeoutMinutes,
    isUnlocked: true,
  };
  
  // Store session metadata (not the key!)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }
  
  return session;
}

/**
 * Get the current session
 */
export function getSession(): WalletSession | null {
  if (typeof window === 'undefined') return null;
  
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const session: WalletSession = JSON.parse(stored);
    
    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Check if wallet is currently unlocked
 */
export function isWalletUnlocked(personaId?: string): boolean {
  const session = getSession();
  if (!session) return false;
  if (personaId && session.personaId !== personaId) return false;
  return session.isUnlocked && Date.now() < session.expiresAt;
}

/**
 * Extend the current session
 */
export function extendSession(additionalMinutes?: number): WalletSession | null {
  const session = getSession();
  if (!session) return null;
  
  const extension = additionalMinutes || session.timeoutMinutes;
  session.expiresAt = Date.now() + extension * 60 * 1000;
  
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }
  
  return session;
}

/**
 * Clear the current session (lock wallet)
 */
export function clearSession(): void {
  // Clear session storage
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
  
  // Clear all cached decrypted keys
  DECRYPTED_KEY_CACHE.clear();
}

/**
 * Lock the wallet (alias for clearSession)
 */
export function lockWallet(): void {
  clearSession();
}

// =============================================================================
// KEY CACHING (IN-MEMORY ONLY)
// =============================================================================

/**
 * Cache a decrypted private key in memory
 * 
 * The key is only held in memory and is cleared when:
 * - Session expires
 * - User locks wallet
 * - Tab is closed
 */
export function cacheDecryptedKey(personaId: string, privateKey: string): void {
  DECRYPTED_KEY_CACHE.set(personaId, privateKey);
}

/**
 * Get a cached decrypted key
 */
export function getCachedKey(personaId: string): string | null {
  // First check if session is still valid
  if (!isWalletUnlocked(personaId)) {
    // Session expired, clear the key
    DECRYPTED_KEY_CACHE.delete(personaId);
    return null;
  }
  
  return DECRYPTED_KEY_CACHE.get(personaId) || null;
}

/**
 * Check if a key is cached for a persona
 */
export function hasKeyInCache(personaId: string): boolean {
  return DECRYPTED_KEY_CACHE.has(personaId) && isWalletUnlocked(personaId);
}

/**
 * Clear a specific cached key
 */
export function clearCachedKey(personaId: string): void {
  DECRYPTED_KEY_CACHE.delete(personaId);
}

// =============================================================================
// UNLOCK FLOW
// =============================================================================

/**
 * Unlock wallet with password
 * 
 * Verifies password, decrypts key, caches it, and creates session.
 */
export async function unlockWallet(
  personaId: string,
  encryptedKey: EncryptedKey,
  password: string,
  timeoutMinutes?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Decrypt the private key
    const privateKey = await decryptPrivateKey(encryptedKey, password);
    
    // Cache the decrypted key in memory
    cacheDecryptedKey(personaId, privateKey);
    
    // Create the session
    createSession(personaId, timeoutMinutes);
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: (error as Error).message || 'Failed to unlock wallet' 
    };
  }
}

/**
 * Get decrypted key for signing (requires unlocked session)
 */
export function getKeyForSigning(personaId: string): string | null {
  if (!isWalletUnlocked(personaId)) {
    return null;
  }
  
  const key = getCachedKey(personaId);
  if (key) {
    // Extend session on activity
    extendSession();
  }
  
  return key;
}

// =============================================================================
// SESSION MONITORING
// =============================================================================

let sessionCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start monitoring session expiry
 */
export function startSessionMonitor(onExpire?: () => void): void {
  if (typeof window === 'undefined') return;
  
  // Clear any existing monitor
  stopSessionMonitor();
  
  // Check every minute
  sessionCheckInterval = setInterval(() => {
    const session = getSession();
    if (!session) {
      // Session expired or doesn't exist
      DECRYPTED_KEY_CACHE.clear();
      onExpire?.();
      stopSessionMonitor();
    }
  }, 60 * 1000);
}

/**
 * Stop monitoring session expiry
 */
export function stopSessionMonitor(): void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

/**
 * Set up auto-lock on tab blur (optional high-security feature)
 */
export function setupAutoLockOnBlur(enabled: boolean = true): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleBlur = () => {
    if (enabled) {
      lockWallet();
    }
  };
  
  window.addEventListener('blur', handleBlur);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('blur', handleBlur);
  };
}

// =============================================================================
// SESSION INFO
// =============================================================================

/**
 * Get remaining session time in seconds
 */
export function getSessionTimeRemaining(): number {
  const session = getSession();
  if (!session) return 0;
  
  const remaining = session.expiresAt - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Get session info for display
 */
export function getSessionInfo(): {
  isUnlocked: boolean;
  personaId: string | null;
  timeRemaining: number;
  expiresAt: Date | null;
} {
  const session = getSession();

  if (!session) {
    return {
      isUnlocked: false,
      personaId: null,
      timeRemaining: 0,
      expiresAt: null,
    };
  }

  return {
    isUnlocked: session.isUnlocked,
    personaId: session.personaId,
    timeRemaining: getSessionTimeRemaining(),
    expiresAt: new Date(session.expiresAt),
  };
}

// =============================================================================
// WALLET ACCESS STATE — five independent facts (operator ruling, 2026-08-02)
// =============================================================================

/**
 * "A successful passkey or username/password login must not automatically
 * imply walletUnlocked = true." This was already true structurally before
 * this section existed — `walletUnlocked` has only ever been set by
 * `unlockWallet()` below (called ONLY from the wallet-password path;
 * `PassportConnectPanel`'s passkey ceremony and any Supabase email/password
 * sign-in never call it) — but the five facts were never modeled as ONE
 * explicit, testable shape a caller could read in one place. This section
 * adds that shape without changing any existing behavior:
 *
 *   sessionAuthenticated       — an application session exists (Supabase or
 *                                 the Passport-native session grant). Caller-
 *                                 supplied: this module has no session of its
 *                                 own to check, so it never guesses.
 *   walletAvailable            — a local wallet profile EXISTS on this device
 *                                 (caller-supplied — see
 *                                 `services/wallet/localWalletStore.ts`,
 *                                 which this module deliberately does not
 *                                 import, to avoid a session/storage layer
 *                                 depending on the device-index layer).
 *   walletUnlocked             — `isWalletUnlocked()` for this persona: the
 *                                 decrypted key is cached and the bounded
 *                                 session has not expired.
 *   walletSessionExpiresAt     — when that bounded session expires, or null
 *                                 if the wallet is not currently unlocked.
 *   lastStrongAuthenticationAt — the last time a cryptographic
 *                                 holder-control proof ran (a wallet
 *                                 signature OR a passkey assertion) — NOT
 *                                 the last ordinary sign-in. Recorded via
 *                                 `recordStrongAuthentication()`, called by
 *                                 both the wallet-password ceremony
 *                                 (`PassportConnectPanel`'s wallet-signature
 *                                 proof) and the passkey ceremony, so a
 *                                 future step-up decision can ask "how long
 *                                 ago did this device last actually prove
 *                                 control" independently of ordinary
 *                                 convenience access.
 */

const LAST_STRONG_AUTH_KEY = 'wallet_last_strong_authentication_at';

/** Record that a cryptographic holder-control proof just ran (wallet signature or passkey). */
export function recordStrongAuthentication(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_STRONG_AUTH_KEY, String(Date.now()));
  } catch {
    // Best-effort — a missing timestamp only degrades a future step-up UX
    // decision, never security itself (the proof already happened).
  }
}

/** Epoch ms of the last recorded strong authentication on this device, or null if none this session. */
export function getLastStrongAuthenticationAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LAST_STRONG_AUTH_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export interface WalletAccessState {
  sessionAuthenticated: boolean;
  walletAvailable: boolean;
  walletUnlocked: boolean;
  walletSessionExpiresAt: number | null;
  lastStrongAuthenticationAt: number | null;
}

/**
 * Assemble the five facts. `sessionAuthenticated` and `walletAvailable` are
 * caller-supplied (this module has no session store and deliberately does
 * not import `localWalletStore.ts` — see this section's own header) —
 * `walletUnlocked`/`walletSessionExpiresAt`/`lastStrongAuthenticationAt` are
 * this module's own authority.
 */
export function getWalletAccessState(input: {
  personaId: string | null;
  sessionAuthenticated: boolean;
  walletAvailable: boolean;
}): WalletAccessState {
  const session = input.personaId ? getSession() : null;
  const walletUnlocked = input.personaId ? isWalletUnlocked(input.personaId) : false;
  return {
    sessionAuthenticated: input.sessionAuthenticated,
    walletAvailable: input.walletAvailable,
    walletUnlocked,
    walletSessionExpiresAt: walletUnlocked && session ? session.expiresAt : null,
    lastStrongAuthenticationAt: getLastStrongAuthenticationAt(),
  };
}

// All exports are inline with their declarations
