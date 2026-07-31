/**
 * Wallet-control-proof challenge (GJR Claim stage — "prove wallet control
 * precedes Marketa's final eligibility recommendation, never the reverse").
 *
 * A purpose-bound message for the SAME narrow signer Phase 1 built for
 * Horizen's transparency authorization (services/signing/
 * partnerAuthorizationSigner.ts's signPartnerAuthorization) — this is the
 * signing primitive's second, still-narrow purpose ('wallet-control-proof'),
 * not a generalization of it. Building the challenge is pure; signing it is
 * the caller's job via signPartnerAuthorization, exactly as
 * services/horizen/authorizationClient.ts already does for its own purpose.
 */

import { createHash } from 'crypto';

export interface ControlProofChallenge {
  aigentQubeId: string;
  controllerWallet: string;
  message: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface BuildControlProofChallengeInput {
  aigentQubeId: string;
  controllerWallet: string;
  expiresInSeconds?: number;
}

export interface BuildControlProofChallengeDeps {
  now?: () => Date;
  randomNonce?: () => string;
}

export function buildControlProofChallenge(
  input: BuildControlProofChallengeInput,
  deps: BuildControlProofChallengeDeps = {},
): ControlProofChallenge {
  const now = deps.now ?? (() => new Date());
  const issuedAt = now().toISOString();
  const nonce = deps.randomNonce
    ? deps.randomNonce()
    : createHash('sha256').update(`${input.aigentQubeId}:${issuedAt}:${Math.random()}`, 'utf8').digest('hex').slice(0, 32);
  const expiresAt = new Date(now().getTime() + (input.expiresInSeconds ?? 300) * 1000).toISOString();

  return {
    aigentQubeId: input.aigentQubeId,
    controllerWallet: input.controllerWallet,
    message:
      `metaMe wallet-control-proof: I control ${input.controllerWallet} for AigentQube ` +
      `"${input.aigentQubeId}". nonce=${nonce} issuedAt=${issuedAt} expiresAt=${expiresAt}`,
    nonce,
    issuedAt,
    expiresAt,
  };
}
