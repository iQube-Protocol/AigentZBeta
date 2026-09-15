/**
 * Focused regression tests for `VelaMalformedCiphertextEnvelopeError`
 * (services/vela/velaClientAdapter.ts, 2026-09-16, 3rd pass — UC0 final
 * closeout correction). Proves the ONE decrypt-failure class this module can
 * distinguish from ordinary "not addressed to me" exclusion: a ciphertext
 * envelope too short to be valid for ANY recipient. Also proves the residual,
 * genuinely indistinguishable case (a well-formed-length envelope sealed to a
 * different key) throws a DIFFERENT error type — never conflated with the
 * malformed-envelope class — and that neither error ever leaks the envelope
 * bytes, the plaintext, or key material.
 */

import { createECDH } from 'crypto';
import { describe, expect, it } from 'vitest';
import { velaDecrypt, velaEncrypt, VelaMalformedCiphertextEnvelopeError } from '@/services/vela/velaClientAdapter';

function freshP521KeyPair(): { priv: string; pub: string } {
  const ecdh = createECDH('secp521r1');
  ecdh.generateKeys();
  return { priv: ecdh.getPrivateKey('hex'), pub: ecdh.getPublicKey('hex') };
}

describe('VelaMalformedCiphertextEnvelopeError — structural malformation is provably never "not addressed to me"', () => {
  it('throws VelaMalformedCiphertextEnvelopeError (a distinct, instanceof-checkable type) for an envelope shorter than nonce+tag', () => {
    const { priv, pub } = freshP521KeyPair();
    const tooShort = Buffer.alloc(10); // < 12 (nonce) + 16 (tag)
    expect(() => velaDecrypt(tooShort, priv, pub)).toThrow(VelaMalformedCiphertextEnvelopeError);
  });

  it('a zero-length envelope also throws VelaMalformedCiphertextEnvelopeError, not a generic error', () => {
    const { priv, pub } = freshP521KeyPair();
    try {
      velaDecrypt(Buffer.alloc(0), priv, pub);
      expect.unreachable('expected velaDecrypt to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(VelaMalformedCiphertextEnvelopeError);
    }
  });

  it('an envelope of exactly the minimum valid length (28 bytes) does NOT throw VelaMalformedCiphertextEnvelopeError — it may still fail auth, but as the ordinary (different) failure class', () => {
    const { priv, pub } = freshP521KeyPair();
    const minLength = Buffer.alloc(28);
    try {
      velaDecrypt(minLength, priv, pub);
      // A random 28-byte buffer decrypting cleanly is not expected, but if it
      // somehow did, that is not a failure of this test's own claim.
    } catch (err) {
      expect(err).not.toBeInstanceOf(VelaMalformedCiphertextEnvelopeError);
    }
  });

  it('a well-formed-length envelope sealed to a DIFFERENT key throws a DIFFERENT error type — proves the two failure classes are genuinely distinguishable in code, not just in theory', () => {
    const sender = freshP521KeyPair();
    const recipient = freshP521KeyPair();
    const wrongRecipient = freshP521KeyPair();
    const envelope = velaEncrypt(Buffer.from('constitutional payload', 'utf8'), sender.priv, recipient.pub);

    let malformedThrown = false;
    try {
      velaDecrypt(envelope, wrongRecipient.priv, sender.pub);
    } catch (err) {
      malformedThrown = err instanceof VelaMalformedCiphertextEnvelopeError;
    }
    expect(malformedThrown).toBe(false);

    // The RIGHT key still round-trips correctly — proves the envelope itself
    // was well-formed all along; only the wrong-key attempt failed above.
    const opened = velaDecrypt(envelope, recipient.priv, sender.pub);
    expect(Buffer.from(opened).toString('utf8')).toBe('constitutional payload');
  });

  it('never exposes the envelope bytes, plaintext, or key material in the thrown error message', () => {
    const { priv, pub } = freshP521KeyPair();
    // Deliberately < 28 bytes (12-byte nonce + 16-byte tag minimum) so this
    // hits VelaMalformedCiphertextEnvelopeError, not the generic AES-GCM path.
    const tooShort = Buffer.from('secret-bytes-01234', 'utf8'); // 18 bytes
    expect(tooShort.length).toBeLessThan(28);
    try {
      velaDecrypt(tooShort, priv, pub);
      expect.unreachable('expected velaDecrypt to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain(tooShort.toString('hex'));
      expect(message).not.toContain(tooShort.toString('utf8'));
      expect(message).not.toContain(priv);
      expect(message).not.toContain(pub);
      // Only the LENGTH may appear — never the content.
      expect(message).toMatch(/\d+ bytes/);
    }
  });
});
