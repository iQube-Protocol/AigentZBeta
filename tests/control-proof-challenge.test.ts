/**
 * services/passport/controlProofChallenge.ts — the Claim stage's
 * wallet-control-proof challenge. Pure, deterministic given injected
 * now()/randomNonce().
 */

import { describe, it, expect } from 'vitest';
import { buildControlProofChallenge } from '@/services/passport/controlProofChallenge';

const FIXED_NOW = () => new Date('2026-07-31T12:00:00.000Z');

describe('buildControlProofChallenge', () => {
  it('binds the exact wallet and aigentQubeId into the message text', () => {
    const challenge = buildControlProofChallenge(
      { aigentQubeId: 'aigentqube-moneypenny', controllerWallet: '0xController' },
      { now: FIXED_NOW, randomNonce: () => 'fixed-nonce' },
    );
    expect(challenge.message).toContain('0xController');
    expect(challenge.message).toContain('aigentqube-moneypenny');
    expect(challenge.message).toContain('fixed-nonce');
  });

  it('defaults to a 5-minute expiry window', () => {
    const challenge = buildControlProofChallenge(
      { aigentQubeId: 'x', controllerWallet: '0xC' },
      { now: FIXED_NOW, randomNonce: () => 'n' },
    );
    expect(Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt)).toBe(5 * 60 * 1000);
  });

  it('honors a custom expiresInSeconds', () => {
    const challenge = buildControlProofChallenge(
      { aigentQubeId: 'x', controllerWallet: '0xC', expiresInSeconds: 60 },
      { now: FIXED_NOW, randomNonce: () => 'n' },
    );
    expect(Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt)).toBe(60 * 1000);
  });

  it('produces a fresh nonce each call when none is injected', () => {
    const c1 = buildControlProofChallenge({ aigentQubeId: 'x', controllerWallet: '0xC' }, { now: FIXED_NOW });
    const c2 = buildControlProofChallenge({ aigentQubeId: 'x', controllerWallet: '0xC' }, { now: FIXED_NOW });
    expect(c1.nonce).not.toBe(c2.nonce);
  });
});
