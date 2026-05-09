/**
 * Content encryption — AES-256-GCM with HKDF-SHA256 per-asset key derivation.
 *
 * Phase 2.2 of the unified IAM foundation plan (2026-05-09 decisions).
 *
 * Design (locked, do not change without operator approval):
 *
 *   Master secret (env)            CONTENT_ENCRYPTION_MASTER_KEY
 *   Per-asset key (derived)        HKDF(master, salt=masterId, info='aigentz-content-v1') → 32 bytes
 *   Cipher                         AES-256-GCM
 *   IV                             12 random bytes per object (stored on row)
 *   Auth tag                       16 bytes appended by GCM (stored on row)
 *   Key version                    encryption_key_id column ('v1' until rotated)
 *
 * Rotation strategy: introduce a new `info` (e.g. 'aigentz-content-v2'),
 * mark new uploads with encryption_key_id='v2', maintain a dual-decrypt
 * window while a background re-encrypt job processes 'v1' rows. Old key
 * version is retired by retiring the master secret.
 *
 * KMS migration path: future encryption_key_id values prefixed `kms:` route
 * through a KMS adapter; the HKDF path remains for v1/v2 rows.
 *
 * Privacy contract:
 *   - Plaintext never persists to disk on the server. Encrypt-on-upload
 *     paths stream-encrypt where possible.
 *   - Master key never leaves the env. Per-asset key is recomputed at each
 *     read; we don't cache derivations across requests.
 *   - The encryption_key_id and IV+tag together are PUBLIC (they appear on
 *     the row, the spine reads them in unauthenticated contexts to set
 *     content_state). They are not secrets — only the master is.
 */

import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;        // GCM standard
const AUTH_TAG_LENGTH = 16;  // GCM standard
const KEY_LENGTH = 32;       // AES-256
const HKDF_INFO_V1 = 'aigentz-content-v1';

export type EncryptionVersion = 'v1';

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: EncryptionVersion;
}

export interface EncryptionInputs {
  masterId: string;       // asset id (master_content_qubes.id or codex_media_assets.id)
  keyId?: EncryptionVersion;
}

/**
 * Read the master secret from env. Throws if missing — refusing to encrypt
 * with a placeholder is the correct behaviour because a dummy master would
 * silently render every payload undecryptable later.
 */
function getMasterKey(): Buffer {
  const raw = process.env.CONTENT_ENCRYPTION_MASTER_KEY || '';
  if (!raw) {
    throw new Error(
      'CONTENT_ENCRYPTION_MASTER_KEY is not set. ' +
        'Generate with: openssl rand -base64 32',
    );
  }
  // Accept base64 or hex; default to base64 because that's what
  // `openssl rand -base64 32` produces.
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      // Fall back to hex if base64 produced something off-length
      const hexBuf = Buffer.from(raw, 'hex');
      if (hexBuf.length === 32) buf = hexBuf;
    }
  } catch {
    buf = Buffer.from(raw, 'hex');
  }
  if (buf.length !== 32) {
    throw new Error(
      `CONTENT_ENCRYPTION_MASTER_KEY has invalid length (expected 32 bytes, got ${buf.length}). ` +
        'Generate with: openssl rand -base64 32',
    );
  }
  return buf;
}

/**
 * Derive a per-asset key from the master secret using HKDF-SHA256.
 * Salt = masterId (asset id) — every asset gets its own key. Info is
 * versioned so future rotation can introduce a v2 derivation without
 * invalidating v1 ciphertexts.
 */
export function deriveAssetKey(masterId: string, version: EncryptionVersion = 'v1'): Buffer {
  const master = getMasterKey();
  const info = version === 'v1' ? HKDF_INFO_V1 : `aigentz-content-${version}`;
  const salt = Buffer.from(masterId, 'utf8');
  const derived = hkdfSync('sha256', master, salt, info, KEY_LENGTH);
  return Buffer.from(derived);
}

/**
 * Encrypt a buffer with the per-asset key. Returns the ciphertext + IV +
 * auth tag separately so callers persist them to the row.
 */
export function encryptBuffer(plaintext: Buffer, opts: EncryptionInputs): EncryptedPayload {
  const keyId = opts.keyId ?? 'v1';
  const key = deriveAssetKey(opts.masterId, keyId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Defensive zero of the derived key — we don't keep it in memory longer
  // than this function's stack frame.
  key.fill(0);
  return { ciphertext, iv, authTag, keyId };
}

/**
 * Decrypt with the per-asset key. Throws if the auth tag fails (tampered
 * ciphertext, wrong key, wrong IV). The thrown error must propagate to a
 * 500 — DO NOT silently fall back to a different key version, that masks
 * tampering.
 */
export function decryptBuffer(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  opts: EncryptionInputs,
): Buffer {
  const keyId = opts.keyId ?? 'v1';
  const key = deriveAssetKey(opts.masterId, keyId);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  key.fill(0);
  return plaintext;
}

/**
 * Probe — does the env have a usable master key configured?
 * Used by the encrypt-on-upload paths to give a clear 500 hint rather
 * than a cryptic crypto error when the env var is missing in dev.
 */
export function isEncryptionConfigured(): boolean {
  try {
    const buf = getMasterKey();
    return buf.length === 32;
  } catch {
    return false;
  }
}
