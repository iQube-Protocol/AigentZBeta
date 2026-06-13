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

import { createHash, createHmac } from 'crypto';

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

const AGENTKIT_API_KEY = process.env.AGENTKIT_API_KEY ?? '';
const AGENTKIT_POLICY_ID = process.env.AGENTKIT_POLICY_ID ?? 'polity-bounded-delegation-v0.1';
const AGENTKIT_ATTEST_URL = process.env.AGENTKIT_ATTEST_URL ?? '';

function chooseMode(): AgentKitMode {
  if (AGENTKIT_API_KEY && AGENTKIT_ATTEST_URL) return 'live';
  return 'stub';
}

function stubSign(payload: string): string {
  // Deterministic, env-keyed HMAC so dev environments produce reproducible
  // tokens. Not cryptographically meaningful — purely the stub-mode
  // signature consumers can pass through to the verifier (which knows the
  // same key in dev).
  const key = process.env.AGENTKIT_STUB_KEY ?? 'polity-agentkit-stub-key-v0.1';
  return createHmac('sha256', key).update(payload).digest('hex');
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

  if (mode === 'stub') {
    const payload = {
      iss: 'polity-passport-bureau',
      policy: AGENTKIT_POLICY_ID,
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
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = stubSign(encoded);
    const token = `${encoded}.agentkit-stub.${signature}`;
    const attestationRef = `agentkit:stub:${createHash('sha256').update(token).digest('hex').slice(0, 24)}`;

    return {
      mode,
      attestationToken: token,
      verifiedHuman,
      attestationRef,
      issuedAt,
      note: 'Stub mode — set AGENTKIT_API_KEY + AGENTKIT_ATTEST_URL and install the AgentKit SDK to issue cryptographic attestations from the World AgentKit policy engine.',
    };
  }

  // Live mode (TBD on AgentKit canonical SDK shape — follow World docs).
  throw new Error(
    'Live AgentKit attestation not yet wired — install the AgentKit SDK and configure AGENTKIT_API_KEY + AGENTKIT_ATTEST_URL.',
  );
}

/**
 * Verify an AgentKit attestation token. Stub mode recomputes the HMAC
 * with the same env-keyed secret and confirms the payload matches; live
 * mode calls the AgentKit verify API.
 */
export function verifyAgentKitAttestation(token: string): {
  valid: boolean;
  payload: Record<string, unknown> | null;
  mode: AgentKitMode;
  error?: string;
} {
  const mode = chooseMode();
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, payload: null, mode, error: 'Malformed token' };
  }

  // Stub mode local verification.
  if (mode === 'stub' || token.includes('.agentkit-stub.')) {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[1] !== 'agentkit-stub') {
      return { valid: false, payload: null, mode, error: 'Malformed stub token' };
    }
    const [encoded, , signature] = parts;
    const expected = stubSign(encoded);
    if (expected !== signature) {
      return { valid: false, payload: null, mode, error: 'Signature mismatch' };
    }
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      return { valid: true, payload, mode };
    } catch {
      return { valid: false, payload: null, mode, error: 'Payload decode failed' };
    }
  }

  // Live mode — TBD.
  return {
    valid: false,
    payload: null,
    mode,
    error: 'Live AgentKit verification not yet wired',
  };
}
