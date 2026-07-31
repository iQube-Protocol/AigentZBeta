/**
 * AgentKit bridge — wraps the existing bounded-delegation framework with
 * AgentKit's cryptographic policy/attestation layer.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 5. CRITICAL: AgentKit does
 * NOT replace our bounded-delegation framework. It operates within it.
 * Our framework defines the WHO/WHAT/WHEN of the delegation; AgentKit
 * provides the HOW — a cryptographic attestation that downstream
 * verifiers can use to confirm "this delegation came from a verified
 * human" without learning who.
 *
 * Inputs to the attestation:
 *   - delegation_grant_id (our primitive — the canonical source)
 *   - sponsor_passport_id (citizen who granted)
 *   - sponsor_world_id_nullifier (when verified; otherwise null →
 *     attestation still emits but without the verified_human flag)
 *   - delegated_agent_root_id
 *   - scope (allowed actions)
 *   - expires_at
 *
 * Output: an AgentKit attestation token that:
 *   - the agent runtime layer presents to downstream services
 *     (e.g. locker reads, QubeTalk messages)
 *   - any verifier can cryptographically check via the AgentKit verify
 *     API without learning citizen identity
 *   - encodes verified_human=true if the sponsor was World ID verified
 *
 * Stub mode: when AGENTKIT_API_KEY is unset (dev/sandbox), emits a
 * deterministic JWT-like token with a 'agentkit-stub' signature so the
 * flow is testable end-to-end. Real mode is wired against the World
 * AgentKit attestation API (TBD on canonical URL; check World docs).
 */

import { createHash } from 'crypto';
import { signIssuerToken, verifyIssuerToken, getIssuerAddress, isProductionIssuer } from '@/services/identity/polityIssuer';

export type AgentKitMode = 'stub' | 'live';

export interface AgentKitAttestationInput {
  /** Our bounded-delegation grant id (UUID). */
  delegationGrantId: string;
  /** Sponsoring citizen passport (T1-safe — registry public id). */
  sponsorPassportId: string;
  /** World ID nullifier hash of the sponsor (null when not verified). */
  sponsorWorldIdNullifier: string | null;
  /** Agent root identity DID (public). */
  delegatedAgentDidUri: string;
  /** Agent root id (uuid). */
  delegatedAgentRootId: string;
  /** Scopes the delegation grants. */
  allowedActions: string[];
  /** Grant expiry. */
  expiresAt: string | null;
}

export interface AgentKitAttestationResult {
  mode: AgentKitMode;
  /** Cryptographic attestation token — opaque to consumers, present to verifier. */
  attestationToken: string;
  /** True when sponsor was World ID verified. */
  verifiedHuman: boolean;
  /** Public attestation reference for the receipt trail. */
  attestationRef: string;
  /** Iso timestamp of issuance. */
  issuedAt: string;
  note?: string;
}

const AGENTKIT_POLICY_ID = process.env.AGENTKIT_POLICY_ID ?? 'polity-bounded-delegation-v0.1';

function chooseMode(): AgentKitMode {
  // Live whenever the polity issuer key is set in env. The token is
  // signed with a real EIP-191 signature any EVM-aware verifier can
  // check against the issuer's public address — no shared secret.
  return isProductionIssuer() ? 'live' : 'stub';
}

/**
 * Issue an AgentKit attestation for an existing bounded-delegation grant.
 *
 * Stub mode token shape: a base64url-encoded JSON payload + an HMAC
 * signature, joined by '.'. Mirrors a JWT shape (header.payload.sig)
 * minus the header for simplicity.
 */
export async function issueAgentKitAttestation(
  input: AgentKitAttestationInput,
): Promise<AgentKitAttestationResult> {
  const mode = chooseMode();
  const issuedAt = new Date().toISOString();
  const verifiedHuman = input.sponsorWorldIdNullifier !== null;
  const issuerAddress = getIssuerAddress();

  const payload = {
    iss: 'polity-passport-bureau',
    issuer_address: issuerAddress,
    policy: AGENTKIT_POLICY_ID,
    schema: 'polity.attestation.agentkit-delegation.v0.1',
    delegation_grant_id: input.delegationGrantId,
    sponsor_passport_id: input.sponsorPassportId,
    verified_human: verifiedHuman,
    // T2-safe nullifier hash IS the personhood commitment — safe to
    // include. We never serialise persona_id or any T0 id here.
    sponsor_personhood_commitment: input.sponsorWorldIdNullifier,
    delegate_did: input.delegatedAgentDidUri,
    scopes: input.allowedActions,
    issued_at: issuedAt,
    expires_at: input.expiresAt,
  };

  // Real EIP-191 signature — any EVM-aware verifier can confirm against
  // the issuer's public address without a shared secret.
  const attestationToken = await signIssuerToken(payload);
  const attestationRef = `agentkit:${mode}:${createHash('sha256').update(attestationToken).digest('hex').slice(0, 24)}`;

  return {
    mode,
    attestationToken,
    verifiedHuman,
    attestationRef,
    issuedAt,
    note:
      mode === 'stub'
        ? 'Dev-issuer mode — token is a real EIP-191 signature but signed with the deterministic dev key. Set POLITY_ISSUER_PRIVATE_KEY for a production identity.'
        : 'Production issuer — EIP-191 signature against POLITY_ISSUER_PRIVATE_KEY. Verifiers check at GET /api/access/delegation/agentkit-attest?token=...',
  };
}

/**
 * Verify an AgentKit attestation token by checking the EIP-191
 * signature against the polity issuer's address. Public; no auth
 * required — anyone can call this to confirm an attestation is genuine.
 */
export async function verifyAgentKitAttestation(token: string): Promise<{
  valid: boolean;
  payload: Record<string, unknown> | null;
  mode: AgentKitMode;
  issuer: string;
  error?: string;
}> {
  const mode = chooseMode();
  const result = await verifyIssuerToken(token);
  return {
    valid: result.valid,
    payload: result.payload,
    mode,
    issuer: result.issuer,
    error: result.error,
  };
}
