/**
 * Vela (Horizen CCE) v0.2.0 wire-format types — source-verified against
 * pinned tags (see docs/vela/VELA-SIGNER-TOPOLOGY-001.md "Sources").
 *
 * These are the platform's own WIRE types (request opcodes, deploy
 * descriptor, on-chain result shape, transport contract) — NOT the domain
 * seam and NOT the commerce ontology. The domain layer speaks
 * `types/confidentialProjection.ts` and `types/constitutionalCommerce.ts`;
 * `velaProjectionProvider.ts` is the ONLY module that consumes both this file
 * and those. Never let a Vela-specific shape leak past the provider boundary
 * into the Financial Services Runtime (PRD §10, operator ruling 2026-08-22).
 */

import type { AttestationMode } from '@/types/confidentialProjection';

/** ProcessorEndpoint.RequestType (vela/contracts/contracts/ProcessorEndpoint.sol, v0.2.0). */
export const VELA_REQUEST_TYPE = {
  DEPLOYAPP: 0,
  PROCESS: 1,
  DEANONYMIZATION: 2,
  ASSOCIATEKEY: 3,
  TRUSTPROCESS: 4,
} as const;
export type VelaRequestType = (typeof VELA_REQUEST_TYPE)[keyof typeof VELA_REQUEST_TYPE];

/**
 * The v1 deploy payload wire contract (`DeployDescriptor` /
 * `DeployModeArtifactRef`, vela-common-go/common) — what `submitDeployRequest`
 * carries. `mode` is always `'artifact_ref'` in v0.2.0.
 */
export interface VelaDeployDescriptor {
  mode: 'artifact_ref';
  artifactId: string; // "sha256:<hex>"
  wasmSha256: string;
  constructorParams?: Record<string, unknown>;
}

/**
 * Which `TeeAuthenticator` contract variant a deployment runs. Per
 * VELA-ATTESTATION-BOUNDARY-001: this fact is invisible from
 * `ProcessorEndpoint` behavior and MUST be recorded explicitly per
 * deployment, never inferred.
 *
 * Maps 1:1 onto the domain-layer `AttestationMode`
 * (`types/confidentialProjection.ts`) via `toDomainAttestationMode()` — the
 * Vela-side spelling stays here so contract-variant vocabulary does not leak
 * into the domain layer.
 */
export type VelaAttestationMode =
  | 'no_attestation' // NoAttestationTeeAuthenticator — teeSigner set by admin fiat, zero proof
  | 'nitro_attested'; // TeeAuthenticator + INitroProver — real AWS Nitro attestation chain verified on-chain

/** Translate the Vela contract-variant fact into the domain vocabulary. */
export function toDomainAttestationMode(mode: VelaAttestationMode): AttestationMode {
  return mode === 'nitro_attested' ? 'NITRO_ATTESTED' : 'NO_ATTESTATION_LOCAL';
}

/** One Vela deployment's on-chain coordinates. Never carries any private key. */
export interface VelaDeploymentDescriptor {
  chainId: number;
  rpcUrl: string;
  processorEndpointAddress: string;
  teeAuthenticatorAddress: string;
  authorityServiceUrl: string;
  subgraphUrl: string;
  attestationMode: VelaAttestationMode;
}

/** A deployed Vela application, identified by its on-chain applicationId. */
export interface VelaApplicationRef {
  applicationId: string; // uint64, carried as decimal string (see vela-common-go ApplicationIdType JSON convention)
  wasmSha256: string;
  deployment: VelaDeploymentDescriptor;
}

/**
 * The result of one completed Vela request, as observed on-chain/via subgraph.
 * This is the WIRE shape — the provider translates it into the domain's
 * `ConfidentialProjectionEvidence`. Deliberately NOT exported past the
 * provider boundary.
 */
export interface VelaRequestResult {
  requestId: string;
  applicationId: string;
  /** hex-encoded state root the TEE signed, per AbstractTeeAuthenticator's signed-message fields. */
  stateRootHex: string;
  teeSignatureHex: string;
  teeSignerAddress: string;
  /**
   * The submitted ciphertext as recorded on-chain (`PendingRequest.payload`).
   * Lets the provider re-derive the payload commitment when fetching evidence
   * statelessly, so evidence is tied to a specific request without the
   * provider having to remember the submission.
   */
  submittedPayload: Uint8Array;
  /** Decrypted per-user event payload (the app's own result JSON), if one was emitted to us. */
  decryptedUserEventJson: string | null;
  /** Non-zero when the Executor marked the request failed (errorCode/errorMsg on the update payload). */
  errorCode: number;
  errorMsg: string;
}

/**
 * The narrow transport the Vela provider needs. Implemented by
 * `velaClientAdapter.ts` against the real stack, and by a deterministic
 * in-memory double in tests so CI needs no Docker.
 */
export interface VelaTransport {
  readonly deployment: VelaDeploymentDescriptor;
  /**
   * ECDH(requester P-521 ↔ enclave CommunicationKey) → HKDF-SHA256 →
   * AES-256-GCM, nonce prepended. Matches vela/pkg/crypto/cipher.go exactly.
   */
  encryptForTee(plaintext: Uint8Array): Promise<Uint8Array>;
  /** Submits a PROCESS request carrying the ciphertext. Returns the on-chain requestId. */
  submitProcessRequest(applicationId: string, encryptedPayload: Uint8Array): Promise<string>;
  /** Polls for a completed result. Returns null while still pending. */
  fetchResult(requestId: string): Promise<VelaRequestResult | null>;
  /**
   * Reads the TeeAuthenticator's currently-registered signer so the provider
   * can check the result was signed by the identity the chain trusts.
   */
  readRegisteredTeeSigner(): Promise<string>;
}
