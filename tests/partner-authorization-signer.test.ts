/**
 * services/signing/partnerAuthorizationSigner.ts — the narrow local-signing
 * helper GJR-VFY-001 Phase 1 builds around the invariant "callers may
 * request a signature; they may not receive custody material."
 *
 * These tests exercise the REAL `ethers` signing/verification path (no
 * network I/O — key resolution is injected via `resolveSigningKey`, exactly
 * like `services/horizen/client.ts`'s `fetchImpl` injection convention), and
 * assert the private key never appears on the returned result.
 */

import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { signPartnerAuthorization, sha256Hex } from '@/services/signing/partnerAuthorizationSigner';

const WALLET = ethers.Wallet.createRandom();
const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function baseInput(overrides: Partial<Parameters<typeof signPartnerAuthorization>[0]> = {}) {
  return {
    keyRef: 'aigent-moneypenny',
    payload: 'authorize pulse monitoring for token 1234 on base-sepolia',
    purpose: 'horizen-financial-transparency',
    expectedSigner: WALLET.address,
    network: 'base-sepolia',
    expiresAt: FUTURE,
    ...overrides,
  };
}

function resolverFor(wallet: ethers.HDNodeWallet | ethers.Wallet, storedAddress?: string) {
  return async () => ({ privateKeyHex: wallet.privateKey, storedAddress: storedAddress ?? wallet.address });
}

describe('signPartnerAuthorization', () => {
  it('produces a valid signature that recovers to the expected signer', async () => {
    const result = await signPartnerAuthorization(baseInput(), { resolveSigningKey: resolverFor(WALLET) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.signerAddress.toLowerCase()).toBe(WALLET.address.toLowerCase());
    expect(result.result.payloadHash).toBe(sha256Hex(baseInput().payload));
    expect(ethers.verifyMessage(baseInput().payload, result.result.signature).toLowerCase()).toBe(WALLET.address.toLowerCase());
  });

  it('NEVER returns the private key on the result object', async () => {
    const result = await signPartnerAuthorization(baseInput(), { resolveSigningKey: resolverFor(WALLET) });
    expect(result.ok).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(WALLET.privateKey.slice(2)); // hex body without 0x
    expect(Object.keys((result as any).result)).toEqual(['signature', 'signerAddress', 'payloadHash', 'signedAt']);
  });

  it('refuses an empty payload without resolving any key', async () => {
    let resolveCalled = false;
    const result = await signPartnerAuthorization(baseInput({ payload: '   ' }), {
      resolveSigningKey: async () => { resolveCalled = true; return { privateKeyHex: WALLET.privateKey }; },
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'EMPTY_PAYLOAD' });
    expect(resolveCalled).toBe(false);
  });

  it('refuses an already-expired request without resolving any key', async () => {
    let resolveCalled = false;
    const result = await signPartnerAuthorization(baseInput({ expiresAt: PAST }), {
      resolveSigningKey: async () => { resolveCalled = true; return { privateKeyHex: WALLET.privateKey }; },
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'EXPIRED' });
    expect(resolveCalled).toBe(false);
  });

  it('refuses when no key resolves for the given keyRef', async () => {
    const result = await signPartnerAuthorization(baseInput(), { resolveSigningKey: async () => null });
    expect(result).toMatchObject({ ok: false, refusalCode: 'KEY_NOT_FOUND' });
  });

  it('refuses when the custody store\'s recorded address does not match the key it actually stores', async () => {
    const other = ethers.Wallet.createRandom();
    const result = await signPartnerAuthorization(baseInput(), { resolveSigningKey: resolverFor(WALLET, other.address) });
    expect(result).toMatchObject({ ok: false, refusalCode: 'STORED_ADDRESS_MISMATCH' });
  });

  it('refuses when the resolved wallet does not match the expected controller signer', async () => {
    const other = ethers.Wallet.createRandom();
    const result = await signPartnerAuthorization(baseInput({ expectedSigner: other.address }), { resolveSigningKey: resolverFor(WALLET) });
    expect(result).toMatchObject({ ok: false, refusalCode: 'SIGNER_MISMATCH' });
  });

  it('accepts a private key resolved without the 0x prefix', async () => {
    const result = await signPartnerAuthorization(baseInput(), {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey.slice(2) }),
    });
    expect(result.ok).toBe(true);
  });
});
