/**
 * Partner-authorization signing — a narrowly scoped local-signing helper.
 *
 * Scope (operator ruling 2026-07-31, GJR-VFY-001 Phase 1): this signs
 * PURPOSE-BOUND PARTNER AUTHORIZATION messages (starting with Horizen's
 * transparency authorization). It is NOT a universal signing service and
 * must not be reached for by other callers (persona payments, Passport
 * Bureau issuance, arbitrary transaction signing) — those keep their own,
 * unchanged signing paths in this phase. A later, separately-scoped
 * capability (SIGNING-SPINE-001) may unify them; this module does not.
 *
 * THE INVARIANT THIS FILE EXISTS TO ENFORCE: "Callers may request a
 * signature; they may not receive custody material." `agentKeyService`
 * itself still hands back a decrypted private key to ITS caller (unchanged
 * in this phase — see the Phase 1 audit,
 * codexes/packs/agentiq/updates/2026-07-31_gjr-vfy-001-gjr-mkt-001-specifications.md).
 * This module is the one caller of `agentKeyService` that stops that leak:
 * the resolved key lives only inside `signPartnerAuthorization`'s local
 * `ethers.Wallet` instance and is never placed on the returned result, logged,
 * or otherwise allowed to escape this function's stack frame.
 */

import { createHash } from 'crypto';

export interface SignPartnerAuthorizationInput {
  /** Resolves to an existing `agent_keys` row (the agent id) — never a raw key. */
  keyRef: string;
  /** The exact, already-canonicalized message this signature will authorize. */
  payload: string;
  /** Binds the signature to a specific consequence (e.g. 'horizen-financial-transparency'). Recorded, not itself validated here. */
  purpose: string;
  /** The registered controller address the resulting signature must recover to. */
  expectedSigner: string;
  /** Recorded for audit; this signer always produces an EIP-191 personal_sign regardless of network. */
  network: string;
  /** ISO 8601. A request that has already expired is refused before any key is touched. */
  expiresAt: string;
}

export interface PartnerAuthorizationSignature {
  signature: string;
  signerAddress: string;
  payloadHash: string;
  signedAt: string;
}

export type PartnerAuthorizationRefusalCode =
  | 'EMPTY_PAYLOAD'
  | 'EXPIRED'
  | 'KEY_NOT_FOUND'
  | 'STORED_ADDRESS_MISMATCH'
  | 'SIGNER_MISMATCH';

export type SignPartnerAuthorizationResult =
  | { ok: true; result: PartnerAuthorizationSignature }
  | { ok: false; refusalCode: PartnerAuthorizationRefusalCode; detail: string };

export interface ResolvedSigningKey {
  privateKeyHex: string;
  /** The address the custody store believes corresponds to this key, if it records one. */
  storedAddress?: string;
}

export type ResolveSigningKey = (keyRef: string) => Promise<ResolvedSigningKey | null>;

async function defaultResolveSigningKey(keyRef: string): Promise<ResolvedSigningKey | null> {
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const svc = new AgentKeyService();
  const keys = await svc.getAgentKeys(keyRef);
  if (!keys?.evmPrivateKey) return null;
  return { privateKeyHex: keys.evmPrivateKey, storedAddress: keys.evmAddress };
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Sign a purpose-bound partner authorization message with the wallet resolved
 * from `keyRef`. The private key never appears in the returned value, in any
 * thrown error, or in a log line — it lives only inside the `ethers.Wallet`
 * constructed on this stack frame.
 */
export async function signPartnerAuthorization(
  input: SignPartnerAuthorizationInput,
  deps: { resolveSigningKey?: ResolveSigningKey; now?: () => Date } = {},
): Promise<SignPartnerAuthorizationResult> {
  if (!input.payload || input.payload.trim().length === 0) {
    return { ok: false, refusalCode: 'EMPTY_PAYLOAD', detail: 'payload is empty' };
  }
  const now = deps.now ?? (() => new Date());
  if (now().getTime() > new Date(input.expiresAt).getTime()) {
    return { ok: false, refusalCode: 'EXPIRED', detail: `request expired at ${input.expiresAt}` };
  }

  const resolve = deps.resolveSigningKey ?? defaultResolveSigningKey;
  const resolved = await resolve(input.keyRef);
  if (!resolved?.privateKeyHex) {
    return { ok: false, refusalCode: 'KEY_NOT_FOUND', detail: `no signing key resolved for keyRef "${input.keyRef}"` };
  }

  const { ethers } = await import('ethers');
  const privateKeyHex = resolved.privateKeyHex.startsWith('0x') ? resolved.privateKeyHex : `0x${resolved.privateKeyHex}`;
  const wallet = new ethers.Wallet(privateKeyHex);

  if (resolved.storedAddress && resolved.storedAddress.toLowerCase() !== wallet.address.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'STORED_ADDRESS_MISMATCH',
      detail: `custody store's recorded address (${resolved.storedAddress}) does not match the address derived from its own stored key — refusing rather than trusting either blindly`,
    };
  }

  const signature = await wallet.signMessage(input.payload);
  const recovered = ethers.verifyMessage(input.payload, signature);
  if (recovered.toLowerCase() !== wallet.address.toLowerCase() || recovered.toLowerCase() !== input.expectedSigner.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'SIGNER_MISMATCH',
      detail: `signature recovers to ${recovered}, expected controller ${input.expectedSigner}`,
    };
  }

  return {
    ok: true,
    result: {
      signature,
      signerAddress: wallet.address,
      payloadHash: sha256Hex(input.payload),
      signedAt: now().toISOString(),
    },
  };
}
