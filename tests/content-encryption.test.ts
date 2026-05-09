/**
 * Phase 2.2 — encryption library unit tests.
 *
 * Coverage:
 *   - round-trip (encrypt → decrypt → identical plaintext)
 *   - per-asset key isolation (asset A key cannot decrypt asset B ciphertext)
 *   - tamper detection (modified ciphertext or auth tag → throw)
 *   - version isolation (v1 key ≠ v2 key for same masterId)
 *   - missing env throws with a clear message
 *
 * No KMS or external dependencies — all in-process.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  deriveAssetKey,
  encryptBuffer,
  decryptBuffer,
  isEncryptionConfigured,
} from '@/services/content/encryption';

const TEST_MASTER_KEY_BASE64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab12'; // 32 bytes hex
let originalEnv: string | undefined;

beforeAll(() => {
  originalEnv = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
  process.env.CONTENT_ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY_BASE64;
});

afterAll(() => {
  if (originalEnv === undefined) {
    delete process.env.CONTENT_ENCRYPTION_MASTER_KEY;
  } else {
    process.env.CONTENT_ENCRYPTION_MASTER_KEY = originalEnv;
  }
});

describe('encryption library', () => {
  it('round-trips plaintext through encrypt → decrypt', () => {
    const plaintext = Buffer.from('hello world — gated content body', 'utf8');
    const enc = encryptBuffer(plaintext, { masterId: 'asset_a' });
    const dec = decryptBuffer(enc.ciphertext, enc.iv, enc.authTag, { masterId: 'asset_a' });
    expect(dec.toString('utf8')).toBe('hello world — gated content body');
  });

  it('returns IV and auth tag of the expected lengths', () => {
    const enc = encryptBuffer(Buffer.from('x'), { masterId: 'asset_a' });
    expect(enc.iv).toHaveLength(12);
    expect(enc.authTag).toHaveLength(16);
    expect(enc.keyId).toBe('v1');
  });

  it('isolates keys per asset id', () => {
    const plaintext = Buffer.from('shared secret', 'utf8');
    const encA = encryptBuffer(plaintext, { masterId: 'asset_a' });
    expect(() =>
      decryptBuffer(encA.ciphertext, encA.iv, encA.authTag, { masterId: 'asset_b' }),
    ).toThrow();
  });

  it('detects ciphertext tampering', () => {
    const plaintext = Buffer.from('canonical bytes', 'utf8');
    const enc = encryptBuffer(plaintext, { masterId: 'asset_a' });
    const tampered = Buffer.from(enc.ciphertext);
    tampered[0] = tampered[0] ^ 0xff;
    expect(() =>
      decryptBuffer(tampered, enc.iv, enc.authTag, { masterId: 'asset_a' }),
    ).toThrow();
  });

  it('detects auth-tag tampering', () => {
    const enc = encryptBuffer(Buffer.from('x'), { masterId: 'asset_a' });
    const tamperedTag = Buffer.from(enc.authTag);
    tamperedTag[0] = tamperedTag[0] ^ 0xff;
    expect(() =>
      decryptBuffer(enc.ciphertext, enc.iv, tamperedTag, { masterId: 'asset_a' }),
    ).toThrow();
  });

  it('derives different keys for different versions on the same asset', () => {
    const v1 = deriveAssetKey('asset_a', 'v1');
    // Cast to any so the test covers the rotation contract even before v2 ships
    const v2 = deriveAssetKey('asset_a', 'v2' as any);
    expect(Buffer.compare(v1, v2)).not.toBe(0);
  });

  it('isEncryptionConfigured returns true with a valid env key', () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it('isEncryptionConfigured returns false when env is missing', () => {
    const saved = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
    delete process.env.CONTENT_ENCRYPTION_MASTER_KEY;
    expect(isEncryptionConfigured()).toBe(false);
    process.env.CONTENT_ENCRYPTION_MASTER_KEY = saved;
  });

  it('throws a clear error when env is missing on encrypt', () => {
    const saved = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
    delete process.env.CONTENT_ENCRYPTION_MASTER_KEY;
    expect(() => encryptBuffer(Buffer.from('x'), { masterId: 'a' })).toThrow(
      /CONTENT_ENCRYPTION_MASTER_KEY/,
    );
    process.env.CONTENT_ENCRYPTION_MASTER_KEY = saved;
  });
});
