/**
 * Encryption Service for Codex Content
 * 
 * Provides AES-256-GCM encryption/decryption for content stored on Autonomys.
 * Keys are wrapped with a project master key and stored in tokenQubes.
 * 
 * Phase 1: Project-held keys (custodial)
 * Phase 2: Per-issue user-wrapped keys (canonical) - see PHASE2_CANONICAL_MINTING.md
 */

import * as crypto from 'crypto';

// Environment variable for project master key (used to wrap content keys)
const PROJECT_MASTER_KEY = process.env.CODEX_MASTER_KEY || '';

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptionResult {
  ciphertext: Buffer;
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  algorithm: string;
}

export interface DecryptionParams {
  ciphertext: Buffer;
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  key: Buffer;
}

export interface WrappedKey {
  keyCiphertext: string; // Base64 encoded wrapped key
  wrappingAlgorithm: string;
}

/**
 * Generate a new random symmetric key for content encryption
 */
export function generateContentKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate a random IV for AES-GCM
 */
export function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Encrypt content using AES-256-GCM
 * 
 * @param plaintext - The content to encrypt
 * @param key - 32-byte symmetric key
 * @returns Encryption result with ciphertext, IV, and auth tag
 */
export function encryptContent(plaintext: Buffer, key: Buffer): EncryptionResult {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }

  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: ALGORITHM,
  };
}

/**
 * Decrypt content using AES-256-GCM
 * 
 * @param params - Decryption parameters including ciphertext, IV, auth tag, and key
 * @returns Decrypted plaintext
 */
export function decryptContent(params: DecryptionParams): Buffer {
  const { ciphertext, iv, authTag, key } = params;

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }

  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTagBuffer);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext;
}

/**
 * Create a decryption stream for streaming large files
 * 
 * @param iv - Base64 encoded IV
 * @param authTag - Base64 encoded auth tag
 * @param key - 32-byte symmetric key
 * @returns Transform stream for decryption
 */
export function createDecryptionStream(
  iv: string,
  authTag: string,
  key: Buffer
): crypto.DecipherGCM {
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTagBuffer);

  return decipher;
}

/**
 * Wrap a content key with the project master key
 * Used for storing keys in tokenQubes (Phase 1 - custodial)
 * 
 * @param contentKey - The symmetric key to wrap
 * @returns Wrapped key data
 */
export function wrapKeyWithMasterKey(contentKey: Buffer): WrappedKey {
  if (!PROJECT_MASTER_KEY) {
    throw new Error('CODEX_MASTER_KEY environment variable not set');
  }

  // Derive a 256-bit key from the master key using SHA-256
  const masterKeyBuffer = crypto
    .createHash('sha256')
    .update(PROJECT_MASTER_KEY)
    .digest();

  // Use AES-256-GCM for key wrapping
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, masterKeyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const wrappedKey = Buffer.concat([
    cipher.update(contentKey),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + wrappedKey for storage
  const combined = Buffer.concat([iv, authTag, wrappedKey]);

  return {
    keyCiphertext: combined.toString('base64'),
    wrappingAlgorithm: 'AES-256-GCM-WRAP',
  };
}

/**
 * Unwrap a content key using the project master key
 * Used for retrieving keys from tokenQubes (Phase 1 - custodial)
 * 
 * @param wrappedKey - The wrapped key data
 * @returns The original symmetric key
 */
export function unwrapKeyWithMasterKey(wrappedKey: WrappedKey): Buffer {
  if (!PROJECT_MASTER_KEY) {
    throw new Error('CODEX_MASTER_KEY environment variable not set');
  }

  // Derive the same 256-bit key from the master key
  const masterKeyBuffer = crypto
    .createHash('sha256')
    .update(PROJECT_MASTER_KEY)
    .digest();

  // Parse the combined data
  const combined = Buffer.from(wrappedKey.keyCiphertext, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedKey = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // Decrypt the key
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKeyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const contentKey = Buffer.concat([
    decipher.update(encryptedKey),
    decipher.final(),
  ]);

  return contentKey;
}

/**
 * Compute SHA-256 checksum of content
 * Used for integrity verification
 */
export function computeChecksum(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validate that a key is the correct length
 */
export function isValidKey(key: Buffer): boolean {
  return key.length === KEY_LENGTH;
}

/**
 * Get encryption metadata for storage
 */
export function getEncryptionMetadata(): {
  algorithm: string;
  keyLength: number;
  ivLength: number;
} {
  return {
    algorithm: ALGORITHM,
    keyLength: KEY_LENGTH,
    ivLength: IV_LENGTH,
  };
}

// Export constants for use elsewhere
export const ENCRYPTION_ALGORITHM = ALGORITHM;
export const ENCRYPTION_KEY_LENGTH = KEY_LENGTH;
export const ENCRYPTION_IV_LENGTH = IV_LENGTH;
