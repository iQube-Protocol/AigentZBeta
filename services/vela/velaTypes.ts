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
 * The zero address `ProcessorEndpoint.submitRequest` treats as "native ETH,
 * no ERC-20" (`tokenAddress` parameter). Exported so the real transport and
 * any asset-bearing caller share one spelling instead of each hardcoding it.
 */
export const ETH_SENTINEL_ADDRESS = '0x0000000000000000000000000000000000000000';

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * A real on-chain asset to carry alongside a Vela request — the wire-level
 * counterpart of `submitRequest`'s `tokenAddress`/`assetAmount` parameters
 * (`PROCESSOR_ABI`, `velaClientAdapter.ts`). This is plumbing, not a new
 * domain concept: it exists solely so an ADDITIVE asset-bearing request path
 * can thread a real value through the existing wire call.
 *
 * Never accepted by `VelaTransport.submitProcessRequest` — that method's
 * no-funds behaviour (VELA-001's confidential-projection path; see the "a
 * projection carries no funds" comment in `velaClientAdapter.ts`) is frozen.
 * Use `VelaTransport.submitAssetBearingProcessRequest` instead.
 */
export interface VelaAssetRef {
  /** ERC-20 contract address, or `ETH_SENTINEL_ADDRESS` for native ETH. */
  tokenAddress: string;
  /** Amount in the asset's smallest on-chain unit (wei for ETH; the ERC-20's own decimals otherwise). Must be > 0n. */
  assetAmount: bigint;
}

/**
 * Fails closed on a malformed or non-positive asset before any network/chain
 * call is made — a zero or negative `assetAmount`, or a `tokenAddress` that
 * isn't a 20-byte hex address, is a caller defect, never something to submit
 * and let the chain reject. A zero-value request should use
 * `submitProcessRequest` (the existing no-funds projection path), not this
 * one — asset-bearing plumbing exists only for a request that actually
 * carries value.
 */
export function validateVelaAssetRef(asset: VelaAssetRef): void {
  if (!HEX_ADDRESS_RE.test(asset.tokenAddress)) {
    throw new Error(
      `invalid Vela asset tokenAddress "${asset.tokenAddress}" — must be a 20-byte hex address ` +
        `(use ETH_SENTINEL_ADDRESS for native ETH)`,
    );
  }
  if (typeof asset.assetAmount !== 'bigint') {
    throw new Error(
      `invalid Vela asset assetAmount — must be a bigint, got ${typeof asset.assetAmount}`,
    );
  }
  if (asset.assetAmount <= 0n) {
    throw new Error(
      `invalid Vela asset assetAmount ${asset.assetAmount} — must be > 0 ` +
        `(use submitProcessRequest for a no-funds projection request)`,
    );
  }
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
  /**
   * `ProcessorEndpoint.RequestCompleted`'s own `status` field — THE
   * AUTHORITATIVE completion signal on the deployed v0.2.0 ABI (Vela/Horizen
   * feedback, 2026-09-16): `0` = completed, `1` = failed. `errorCode`/
   * `errorMsg` below carry the SPECIFIC failure reason when `status !== 0`;
   * `status` itself is what a caller checks BEFORE treating any decoded
   * output (UserEvent/AppEvent/state change) as real — see
   * `services/vela/velaMultiPartyProjection.ts`'s own
   * `getVelaMultiPartyProjectionOutcome`, the enforcement point.
   */
  status: number;
  /**
   * `ProcessorEndpoint.RequestCompleted`'s own `applicationFees` (wei) — the
   * ACTUAL fee charged for this request, distinct from any client-side fee
   * reservation/estimate (see `services/vela/velaFuelAccounting.ts`).
   */
  applicationFees: string;
  /** hex-encoded state root the TEE signed, per AbstractTeeAuthenticator's signed-message fields. */
  stateRootHex: string;
  /**
   * hex-encoded PRIOR state root — `StateRootUpdate`'s own `oldStateRoot`,
   * paired with `stateRootHex` (that same log's `newStateRoot`) so a caller
   * can bind the exact state transition this request produced. Empty when no
   * `StateRootUpdate` log was found — mirrors `stateRootHex`'s own
   * "empty means not found" contract.
   */
  prevStateRootHex: string;
  teeSignatureHex: string;
  teeSignerAddress: string;
  /**
   * The on-chain transaction hash of the `stateUpdate` call that finalised
   * this request (submitted by the Manager relayer, per
   * docs/vela/VELA-SIGNER-TOPOLOGY-001.md — an RBAC-authorized submitter, not
   * the TEE signer). Public chain data, not confidential: recording it lets
   * evidence be independently looked up on-chain without widening what the
   * confidential environment discloses. Empty when the finalising
   * transaction could not be located.
   */
  stateUpdateTxHash: string;
  /**
   * The submitted ciphertext as recorded on-chain (`PendingRequest.payload`).
   * Lets the provider re-derive the payload commitment when fetching evidence
   * statelessly, so evidence is tied to a specific request without the
   * provider having to remember the submission.
   */
  submittedPayload: Uint8Array;
  /** Decrypted per-user event payload (the app's own result JSON), if one was emitted to us. */
  decryptedUserEventJson: string | null;
  /**
   * Total `UserEvent` logs found for this request, TO ANY RECIPIENT (not
   * just ours) — 2026-09-16 (2nd pass). Lets a decode layer distinguish
   * "zero events exist at all" (a genuine evidence/protocol defect on a
   * successful completion — the guest always emits at least one UserEvent
   * on every non-malfunction path) from "events exist, but none decrypt for
   * me" (the ordinary not-a-recipient case). See
   * `services/vela/velaMultiPartyProjection.ts`'s own
   * `getVelaMultiPartyProjectionOutcome` for where this is used.
   */
  userEventCount: number;
  /**
   * Count of `UserEvent` logs, among those actually inspected during
   * `fetchResult`'s decrypt attempt, whose ciphertext envelope was
   * structurally too short to be valid for ANY recipient — 2026-09-16 (3rd
   * pass). This is the ONE decrypt-failure class provably never a
   * legitimate "not addressed to me" outcome (a correctly encrypted
   * envelope is always >= 28 bytes regardless of recipient), so a decode
   * layer that sees `decryptedUserEventJson === null` AND
   * `malformedUserEventCount > 0` knows at least one candidate event is
   * corrupted evidence, not ordinary exclusion. Scanning stops at the first
   * successful decrypt (mirroring `decryptedUserEventJson`'s own contract),
   * so this count only reflects events actually inspected before a match,
   * if any. An ordinary AES-GCM authentication failure (wrong key or
   * tampered ciphertext — cryptographically indistinguishable from each
   * other by AEAD's own security design) is NEVER counted here; it remains
   * silent, exactly as before. See
   * `services/vela/velaClientAdapter.ts`'s `VelaMalformedCiphertextEnvelopeError`.
   */
  malformedUserEventCount: number;
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
  /**
   * Submits a PROCESS request carrying the ciphertext and NO asset value
   * (`tokenAddress`/`assetAmount` are the ETH sentinel / zero on the real
   * transport — "a projection carries no funds"). Returns the on-chain
   * requestId. Frozen behaviour: never extend this method with an asset
   * parameter — use `submitAssetBearingProcessRequest` instead.
   */
  submitProcessRequest(applicationId: string, encryptedPayload: Uint8Array): Promise<string>;
  /**
   * Submits a PROCESS request carrying the ciphertext AND a real on-chain
   * asset (native ETH or an allowlisted ERC-20) — the asset-bearing sibling
   * of `submitProcessRequest`, additive and separate so the no-funds
   * projection path above can never accidentally start carrying value.
   * Implementations MUST call `validateVelaAssetRef(asset)` (or equivalent)
   * before any network/chain call, so an invalid amount never reaches the
   * chain. Returns the on-chain requestId.
   */
  submitAssetBearingProcessRequest(
    applicationId: string,
    encryptedPayload: Uint8Array,
    asset: VelaAssetRef,
  ): Promise<string>;
  /** Polls for a completed result. Returns null while still pending. */
  fetchResult(requestId: string): Promise<VelaRequestResult | null>;
  /**
   * Reads the TeeAuthenticator's currently-registered signer so the provider
   * can check the result was signed by the identity the chain trusts.
   */
  readRegisteredTeeSigner(): Promise<string>;
}
