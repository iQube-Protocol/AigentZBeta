/**
 * Persona Types for Smart Wallet
 * 
 * A PersonaQube represents a user's identity in the Qripto/KNYT ecosystem.
 * It links FIO handles, DIDs, EVM keys, reputation, and wallet functionality.
 */

// =============================================================================
// FIO DOMAIN TYPES
// =============================================================================

/** Supported FIO domains for persona handles */
export type FioDomain = 'qripto' | 'knyt';

/** FIO handle format: username@domain */
export interface FioHandle {
  username: string;
  domain: FioDomain;
  full: string; // "username@domain"
}

/** FIO registration status */
export interface FioRegistration {
  handle: string;
  publicKey: string;
  txId: string;
  registeredAt: string;
  expiresAt: string;
}

// =============================================================================
// KEY MANAGEMENT
// =============================================================================

/** Source of the EVM key */
export type KeySource = 'generated' | 'imported';

/** Encrypted key storage */
export interface EncryptedKey {
  /** The encrypted private key (AES-256-GCM) */
  ciphertext: string;
  /** Initialization vector */
  iv: string;
  /** Salt for key derivation */
  salt: string;
  /** Auth tag for GCM */
  authTag: string;
}

/** EVM key pair for wallet operations */
export interface EvmKeyPair {
  /** Public key (hex) */
  publicKey: string;
  /** Derived address (0x...) */
  address: string;
  /** Encrypted private key */
  encryptedPrivateKey: EncryptedKey;
  /** How the key was obtained */
  keySource: KeySource;
  /** When the key was created/imported */
  createdAt: string;
}

/** Future: Bitcoin key pair */
export interface BitcoinKeyPair {
  publicKey: string;
  address: string;
  encryptedPrivateKey: EncryptedKey;
  network: 'mainnet' | 'testnet';
}

/** Future: Solana key pair */
export interface SolanaKeyPair {
  publicKey: string;
  address: string;
  encryptedPrivateKey: EncryptedKey;
}

// =============================================================================
// CHAIN ADDRESSES
// =============================================================================

/** Chain addresses derived from EVM key */
export interface ChainAddresses {
  /** Base chain address */
  base: string;
  /** Optimism chain address */
  optimism: string;
  /** Polygon chain address */
  polygon: string;
  /** Arbitrum chain address (Phase 2) */
  arbitrum?: string;
  /** Ethereum mainnet address (Phase 2) */
  ethereum?: string;
}

/** FIO chain mappings for address resolution */
export interface FioChainMappings {
  /** Chain ID -> Address mapping registered with FIO */
  mappings: Record<string, string>;
  /** Last sync timestamp */
  lastSyncedAt: string;
}

// =============================================================================
// PERSONA QUBE
// =============================================================================

/** Persona status */
export type PersonaStatus = 'active' | 'inactive' | 'suspended' | 'pending';

/**
 * PersonaQube - The core identity iQube for a user
 * 
 * This represents a user's identity in the ecosystem, linking:
 * - FIO handle (human-readable identifier)
 * - DID (decentralized identifier)
 * - EVM keys (for signing transactions)
 * - Reputation (score, bucket, badges)
 * - Chain addresses (derived from EVM key)
 */
export interface PersonaQube {
  /** Unique identifier */
  id: string;
  
  /** iQube type discriminator */
  type: 'PersonaQube';
  
  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------
  
  /** FIO handle (e.g., "alice@qripto" or "bob@knyt") */
  fioHandle: string;
  
  /** FIO domain (qripto or knyt) */
  fioDomain: FioDomain;
  
  /** Decentralized Identifier (did:iq:...) */
  rootDid: string;
  
  /** Display name for UI */
  displayName: string;
  
  /** Optional avatar URI */
  avatarUri?: string;
  
  // -------------------------------------------------------------------------
  // Keys & Addresses
  // -------------------------------------------------------------------------
  
  /** Unified EVM key pair (works across all EVM chains) */
  evmKey: EvmKeyPair;
  
  /** Chain-specific addresses (all derived from same EVM key) */
  chainAddresses: ChainAddresses;
  
  /** FIO chain mappings */
  fioMappings?: FioChainMappings;
  
  /** Future: Bitcoin key */
  bitcoinKey?: BitcoinKeyPair;
  
  /** Future: Solana key */
  solanaKey?: SolanaKeyPair;
  
  // -------------------------------------------------------------------------
  // Reputation
  // -------------------------------------------------------------------------
  
  /** Overall reputation score (0-100) */
  reputationScore: number;
  
  /** Reputation bucket (0-5) */
  reputationBucket: 0 | 1 | 2 | 3 | 4 | 5;
  
  /** Earned badges */
  badges: string[];
  
  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------
  
  /** Persona status */
  status: PersonaStatus;
  
  /** Creation timestamp */
  createdAt: string;
  
  /** Last update timestamp */
  updatedAt: string;
  
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  
  /** Owner's auth profile ID */
  authProfileId?: string;
}

// =============================================================================
// WALLET SESSION
// =============================================================================

/**
 * WalletSession - Manages password unlock state
 * 
 * Once a user enters their password, the session remains active
 * until timeout or explicit lock. The decrypted key is held in
 * memory only and never persisted.
 */
export interface WalletSession {
  /** Active persona ID */
  personaId: string;
  
  /** When the session was unlocked */
  unlockedAt: number;
  
  /** When the session expires (ms since epoch) */
  expiresAt: number;
  
  /** Session timeout in minutes */
  timeoutMinutes: number;
  
  /** Whether the session is currently unlocked */
  isUnlocked: boolean;
}

/** Session configuration */
export interface SessionConfig {
  /** Default timeout in minutes */
  defaultTimeoutMinutes: number;
  
  /** Maximum timeout in minutes */
  maxTimeoutMinutes: number;
  
  /** Whether to auto-lock on tab blur */
  autoLockOnBlur: boolean;
}

// =============================================================================
// PERSONA CREATION
// =============================================================================

/** Input for creating a new persona */
export interface CreatePersonaInput {
  /** Desired FIO handle (without domain) */
  username: string;
  
  /** FIO domain to use */
  domain: FioDomain;
  
  /** Display name */
  displayName: string;
  
  /** Optional avatar URI */
  avatarUri?: string;
  
  /** Key source */
  keySource: KeySource;
  
  /** If importing, the private key (will be encrypted immediately) */
  importedPrivateKey?: string;
  
  /** Password for encrypting the private key */
  password: string;
  
  /** Tenant ID */
  tenantId: string;
}

/** Result of persona creation */
export interface CreatePersonaResult {
  success: boolean;
  persona?: PersonaQube;
  fioRegistration?: FioRegistration | { txId: string; fioAddress: string; expiration: string; fee: number } | null;
  /**
   * FIO keypair for the persona. Returned ONCE on creation so the wizard
   * can show the user their private key + mnemonic for backup. Never
   * persisted server-side in Phase 1 — the user is responsible for
   * recording it. Phase 2 will add encrypted server-side custody as an
   * optional convenience.
   */
  fioKeyPair?: { publicKey: string; privateKey: string; mnemonic: string } | null;
  /** Non-fatal error from the FIO chain register step. Persona is still created. */
  fioRegistrationError?: string | null;
  error?: string;
}

// =============================================================================
// PERSONA CONTEXT (for wallet UI)
// =============================================================================

/** Persona context for wallet components */
export interface PersonaWalletContext {
  /** Current active persona */
  activePersona: PersonaQube | null;
  
  /** All personas owned by user */
  personas: PersonaQube[];
  
  /** Current wallet session */
  session: WalletSession | null;
  
  /** Whether wallet is unlocked */
  isUnlocked: boolean;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error: string | null;
}

// All types are exported inline with their declarations
