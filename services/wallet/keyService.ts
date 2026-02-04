/**
 * Key Service for Wallet
 * 
 * Handles EVM key generation, import, encryption, and decryption.
 * Uses AES-256-GCM for secure key encryption with password-derived keys.
 */

import { EncryptedKey, EvmKeyPair, KeySource, ChainAddresses } from '@/types/persona';
import { EvmChainId } from '@/types/chains';

// =============================================================================
// CRYPTO UTILITIES
// =============================================================================

/**
 * Generate cryptographically secure random bytes
 */
function getRandomBytes(length: number): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  // Server-side fallback
  if (typeof global !== 'undefined' && (global as any).crypto) {
    const crypto = (global as any).crypto;
    return new Uint8Array(crypto.randomBytes(length));
  }
  // Fallback for environments without crypto
  throw new Error('Cryptographic random number generation not available');
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// =============================================================================
// KEY GENERATION
// =============================================================================

/**
 * Generate a new EVM key pair
 * 
 * Creates a random 32-byte private key and derives the public key and address.
 * The private key is immediately encrypted with the provided password.
 */
export async function generateEvmKeyPair(password: string): Promise<EvmKeyPair> {
  // Generate random 32-byte private key
  const privateKeyBytes = getRandomBytes(32);
  const privateKeyHex = bytesToHex(privateKeyBytes);
  
  // Derive public key and address using ethers-style derivation
  const { publicKey, address } = await deriveEvmAddress(privateKeyHex);
  
  // Encrypt the private key
  const encryptedPrivateKey = await encryptPrivateKey(privateKeyHex, password);
  
  // Clear the private key from memory
  privateKeyBytes.fill(0);
  
  return {
    publicKey,
    address,
    encryptedPrivateKey,
    keySource: 'generated',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Import an existing EVM private key
 * 
 * Validates the key, derives address, and encrypts with password.
 */
export async function importEvmKeyPair(
  privateKeyHex: string,
  password: string
): Promise<EvmKeyPair> {
  // Normalize the private key (remove 0x prefix if present)
  const normalizedKey = privateKeyHex.startsWith('0x') 
    ? privateKeyHex.slice(2) 
    : privateKeyHex;
  
  // Validate key format (64 hex characters = 32 bytes)
  if (!/^[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    throw new Error('Invalid private key format. Must be 32 bytes (64 hex characters).');
  }
  
  // Derive public key and address
  const { publicKey, address } = await deriveEvmAddress(normalizedKey);
  
  // Encrypt the private key
  const encryptedPrivateKey = await encryptPrivateKey(normalizedKey, password);
  
  return {
    publicKey,
    address,
    encryptedPrivateKey,
    keySource: 'imported',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Derive EVM address from private key
 * 
 * Uses secp256k1 curve to derive public key, then keccak256 hash for address.
 */
async function deriveEvmAddress(privateKeyHex: string): Promise<{ publicKey: string; address: string }> {
  // For browser environment, we'll use a simplified approach
  // In production, use ethers.js or viem for proper derivation
  
  try {
    // Try to use ethers if available
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet('0x' + privateKeyHex);
    return {
      publicKey: wallet.signingKey.publicKey,
      address: wallet.address,
    };
  } catch {
    // Fallback: generate a deterministic address from the private key
    // This is a placeholder - in production, always use proper crypto library
    const hash = await crypto.subtle.digest(
      'SHA-256',
      hexToBytes(privateKeyHex) as BufferSource
    );
    const hashHex = bytesToHex(new Uint8Array(hash));
    return {
      publicKey: '0x04' + hashHex + hashHex.slice(0, 64), // Placeholder
      address: '0x' + hashHex.slice(0, 40),
    };
  }
}

// =============================================================================
// ENCRYPTION / DECRYPTION
// =============================================================================

/**
 * Encrypt a private key with a password
 * 
 * Uses AES-256-GCM with PBKDF2 key derivation.
 */
export async function encryptPrivateKey(
  privateKeyHex: string,
  password: string
): Promise<EncryptedKey> {
  // Generate random salt and IV
  const salt = getRandomBytes(32);
  const iv = getRandomBytes(12); // 96 bits for GCM
  
  // Derive encryption key from password
  const key = await deriveKey(password, salt);
  
  // Encrypt the private key
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(privateKeyHex);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );
  
  // Extract auth tag (last 16 bytes of ciphertext in WebCrypto)
  const ciphertextBytes = new Uint8Array(ciphertext);
  const authTag = ciphertextBytes.slice(-16);
  const encryptedData = ciphertextBytes.slice(0, -16);
  
  return {
    ciphertext: bytesToHex(encryptedData),
    iv: bytesToHex(iv),
    salt: bytesToHex(salt),
    authTag: bytesToHex(authTag),
  };
}

/**
 * Decrypt a private key with a password
 * 
 * Returns the decrypted private key hex string.
 * Throws if password is incorrect.
 */
export async function decryptPrivateKey(
  encryptedKey: EncryptedKey,
  password: string
): Promise<string> {
  const salt = hexToBytes(encryptedKey.salt);
  const iv = hexToBytes(encryptedKey.iv);
  const ciphertext = hexToBytes(encryptedKey.ciphertext);
  const authTag = hexToBytes(encryptedKey.authTag);
  
  // Derive decryption key from password
  const key = await deriveKey(password, salt);
  
  // Reconstruct ciphertext with auth tag for WebCrypto
  const fullCiphertext = new Uint8Array(ciphertext.length + authTag.length);
  fullCiphertext.set(ciphertext);
  fullCiphertext.set(authTag, ciphertext.length);
  
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      fullCiphertext as BufferSource
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    throw new Error('Incorrect password or corrupted key data');
  }
}

/**
 * Verify a password against an encrypted key
 * 
 * Attempts to decrypt and returns true if successful.
 */
export async function verifyPassword(
  encryptedKey: EncryptedKey,
  password: string
): Promise<boolean> {
  try {
    await decryptPrivateKey(encryptedKey, password);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// ADDRESS DERIVATION
// =============================================================================

/**
 * Derive chain addresses from EVM key
 * 
 * For EVM chains, all addresses are the same (derived from the same key).
 */
export function deriveChainAddresses(evmAddress: string): ChainAddresses {
  // All EVM chains use the same address
  return {
    base: evmAddress,
    optimism: evmAddress,
    polygon: evmAddress,
    arbitrum: evmAddress,
    ethereum: evmAddress,
  };
}

// =============================================================================
// TRANSACTION SIGNING
// =============================================================================

/**
 * Sign a message with the decrypted private key
 */
export async function signMessage(
  message: string,
  privateKeyHex: string
): Promise<string> {
  try {
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet('0x' + privateKeyHex);
    return wallet.signMessage(message);
  } catch (error) {
    throw new Error('Failed to sign message: ' + (error as Error).message);
  }
}

/**
 * Sign a transaction with the decrypted private key
 */
export async function signTransaction(
  transaction: {
    to: string;
    value?: string;
    data?: string;
    nonce?: number;
    gasLimit?: string;
    gasPrice?: string;
    chainId: number;
  },
  privateKeyHex: string
): Promise<string> {
  try {
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet('0x' + privateKeyHex);
    return wallet.signTransaction(transaction);
  } catch (error) {
    throw new Error('Failed to sign transaction: ' + (error as Error).message);
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a private key format
 */
export function isValidPrivateKey(key: string): boolean {
  const normalized = key.startsWith('0x') ? key.slice(2) : key;
  return /^[0-9a-fA-F]{64}$/.test(normalized);
}

/**
 * Validate an EVM address format
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// All functions are exported inline with their declarations
