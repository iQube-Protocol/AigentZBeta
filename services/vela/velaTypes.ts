/**
 * Vela (Horizen CCE) v0.2.0 wire-format types — source-verified against
 * pinned tags (see docs/vela/VELA-SIGNER-TOPOLOGY-001.md "Sources").
 *
 * These are the platform's own wire types (request types, deploy descriptor,
 * confidential projection provider capability/request/status shapes) — NOT
 * the shared commerce ontology. MoneyPenny-facing code consumes
 * `types/constitutionalCommerce.ts`; this module is what a
 * VelaConfidentialProjectionProvider (Slice 2B, not yet built) speaks
 * underneath that interface. Never let a Vela-specific shape leak past the
 * provider boundary into the Financial Services Runtime (PRD §10).
 */

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
 * Which `TeeAuthenticator` contract variant a deployment runs, and whether
 * its `teeSigner`/`pubSecp521r1` registration is attestation-backed. Per
 * VELA-ATTESTATION-BOUNDARY-001: this fact is invisible from
 * `ProcessorEndpoint` behavior and MUST be recorded explicitly per
 * deployment, never inferred.
 */
export type VelaAttestationMode =
  | 'no_attestation' // NoAttestationTeeAuthenticator — teeSigner set by admin fiat, zero proof
  | 'nitro_attested'; // TeeAuthenticator + INitroProver — real AWS Nitro attestation chain verified on-chain

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
 * The confidential projection provider capability/request/status/evidence
 * shapes referenced by PRD §10's `ConfidentialProjectionProvider` interface.
 * Defined here (not yet implemented against — Slice 2B) so the interface can
 * be typed precisely when it is built.
 */
export interface ConfidentialProjectionCapabilities {
  applicationId: string;
  attestationMode: VelaAttestationMode;
  /** True only when attestationMode === 'nitro_attested' AND a real attestation has been independently verified — never inferred from a successful request. */
  attestationVerified: boolean;
}

export interface ConfidentialProjectionRequest {
  actionRef: string;
  /** Opaque, pre-encrypted payload bytes (ECDH+AES-256-GCM per VELA-PRIVACY-BOUNDARY-001) — plaintext confidential values never reach this type. */
  encryptedPayload: Uint8Array;
  /** hex-encoded 133-byte P-521 public key the requester registered via ASSOCIATEKEY. */
  requesterP521PublicKeyHex: string;
}

export interface PreparedConfidentialProjection extends ConfidentialProjectionRequest {
  applicationId: string;
  requestType: typeof VELA_REQUEST_TYPE.PROCESS;
}

export interface ConfidentialProjectionSubmission {
  requestId: string;
  submittedAt: string;
}

export type ConfidentialProjectionObserverState =
  | 'NOT_STARTED'
  | 'PREPARED'
  | 'AWAITING_APPROVAL'
  | 'SUBMITTED'
  | 'OBSERVING'
  | 'PROJECTION_COMPLETE'
  | 'ATTESTATION_VERIFIED'
  | 'PROJECTION_ACCEPTABLE'
  | 'PROJECTION_UNACCEPTABLE'
  | 'PROJECTION_UNRESOLVED'
  | 'ACTION_AUTHORISED'
  | 'ACTION_REFUSED'
  | 'FAILED'
  | 'STATE_CONFLICT';

export interface ConfidentialProjectionStatus {
  requestId: string;
  state: ConfidentialProjectionObserverState;
}

/**
 * Evidence returned alongside a completed projection. `PROJECTION_COMPLETE`
 * (a state update was signed and posted) is distinct from
 * `ATTESTATION_VERIFIED` (the signer's registration was independently
 * checked against a real Nitro attestation chain) — see
 * VELA-ATTESTATION-BOUNDARY-001. Never assume the latter from the former.
 */
export interface ConfidentialProjectionEvidence {
  requestId: string;
  applicationId: string;
  /** hex-encoded state root the TEE signed, per AbstractTeeAuthenticator's signed-message fields. */
  stateRootHex: string;
  teeSignatureHex: string;
  teeSignerAddress: string;
  attestationMode: VelaAttestationMode;
}

export interface ConfidentialEvidenceVerification {
  requestId: string;
  attestationVerified: boolean;
  reason: string;
}
