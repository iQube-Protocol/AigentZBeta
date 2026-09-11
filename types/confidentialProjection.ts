/**
 * Confidential Projection — the constitutional seam (VELA-001 Slice 2B).
 *
 * This module is the DOMAIN layer's entire vocabulary for confidential
 * consequence projection. It is deliberately provider-neutral: nothing here
 * knows about Vela request opcodes, GraphQL/subgraph internals,
 * ProcessorEndpoint wire details, P-521 implementation details, or WASM
 * deployment internals. Those live behind a provider implementation
 * (`services/vela/velaProjectionProvider.ts` is the first one) and must not
 * leak past it — operator ruling, 2026-08-22.
 *
 * Four standing rulings this module encodes structurally, so a later change
 * cannot quietly violate one:
 *
 *  1. **No new custody surface.** A provider reuses an identity the principal
 *     already controls. Reuse is TECHNICAL; it never merges CONSTITUTIONAL
 *     roles — hence `ConfidentialProjectionIdentitySet` keeps five distinct
 *     fields even when several resolve to the same address today.
 *  2. **Confidentiality is bounded, not total.** A provider protects
 *     confidential application state and computation. It does NOT make the
 *     surrounding transaction primitives private. See
 *     docs/vela/VELA-PRIVACY-BOUNDARY-001.md.
 *  3. **Local execution is not production attestation.** `protocolExecutionVerified`
 *     and `teeAttestationVerified` are separate booleans that no code path may
 *     collapse or infer one from the other.
 *  4. **CFS-006a composes with, is not replaced by, ConsequenceProjection.** A
 *     provider contributes ONLY `ConsequenceProjection.confidential`
 *     (`types/constitutionalCommerce.ts`); CFS-006a keeps contributing
 *     `.public`; the constitutional runtime composes them and derives the
 *     disposition.
 *
 * Authority boundary: nothing in this module can express AUTHORIZED,
 * AUTHORITY_VALID or MANDATE_VALID. A confidential projection yields evidence
 * about a projected consequence, never an authorisation. The runtime derives
 * `Consequential Authority ∩ Acceptable Consequence Projection = Action
 * Authorised` — see `ActionAuthorisation` in types/constitutionalCommerce.ts.
 *
 * T0 discipline: opaque refs only. No confidential VALUE (balance, exposure,
 * limit, price) and no `personaId`/`authProfileId`/`rootDid` appears on any
 * type here — including on the evidence types, which are receipt-bound.
 */

// ── Verdict ──────────────────────────────────────────────────────────────

/**
 * The ONLY verdict vocabulary a confidential projection may return.
 *
 * Deliberately coarse. Per the privacy boundary, the verdict leaves the
 * confidential environment through a publicly-observable event, so it carries
 * the projection's conclusion and nothing about how it was reached. A provider
 * that returned "UNACCEPTABLE because exposure limit exceeded by 4200" would
 * leak the very fact the confidential computation exists to protect.
 *
 * UNRESOLVED is not an error state — it is the honest representation of
 * "cannot safely decide", and it fails closed at the authorisation plane.
 */
export type ConfidentialProjectionDisposition =
  | 'ACCEPTABLE'
  | 'UNACCEPTABLE'
  | 'UNRESOLVED';

// ── Attestation ──────────────────────────────────────────────────────────

/**
 * How a confidential environment's identity was established. MUST be recorded
 * per deployment from known configuration — never inferred from the fact that
 * a request succeeded. Per VELA-ATTESTATION-BOUNDARY-001, a genuinely
 * attested deployment and an unattested one are indistinguishable from
 * request/response behaviour alone.
 */
export type AttestationMode =
  /** Emulated/dev environment: the signing identity was registered by admin fiat with no attestation proof. */
  | 'NO_ATTESTATION_LOCAL'
  /** Real AWS Nitro attestation document verified on-chain against a pinned enclave measurement. */
  | 'NITRO_ATTESTED';

/**
 * Three permanently distinct proof states. No amount of successful local
 * execution promotes the third — operator ruling, 2026-08-22.
 */
export type ConfidentialProofState =
  /** The request/response protocol and wire formats behave as specified. */
  | 'LOCAL_PROTOCOL_PROVEN'
  /** Confidential computation actually ran and produced a signed result. */
  | 'LOCAL_EXECUTION_PROVEN'
  /** A real hardware TEE attestation chain was verified. Reachable ONLY with a genuinely attested deployment. */
  | 'PRODUCTION_TEE_ATTESTATION_PROVEN';

// ── Identity roles ───────────────────────────────────────────────────────

/**
 * The five semantic identity roles in a confidential projection.
 *
 * Several of these resolve to the SAME key/address in the first
 * implementation — Slice 2A proved MoneyPenny's existing wallet key can serve
 * the confidential-requester role technically. They are kept as five distinct
 * fields anyway, because technical reuse of a key is not constitutional
 * merger of the roles it plays. Collapsing them would make it impossible to
 * later separate (e.g.) the privacy identity from the execution signer
 * without a breaking change, and would erase the distinction that keeps the
 * confidential environment from becoming an authority source.
 *
 * Field-name note: the operator's ruling named the last two `velaRequester`
 * and `velaPrivacyIdentity`. They are provider-neutral here
 * (`confidentialRequester`, `confidentialPrivacyIdentity`) because this is
 * the domain layer, which by the same ruling must not know about Vela; the
 * Vela provider is where those names instantiate.
 */
export interface ConfidentialProjectionIdentitySet {
  /** WHOSE authority the action is taken under. Constitutional, never derived from a projection. */
  authorityPrincipal: string;
  /** WHO signed the mandate that bounds the action. */
  mandateSigner: string;
  /** WHO submits the confidential projection request. Technical submitter; carries no authority. */
  confidentialRequester: string;
  /** WHO may decrypt the confidential inputs/results. Distinct from the submitter on purpose. */
  confidentialPrivacyIdentity: string;
  /** WHO signs the eventual on-chain execution, if the action is authorised. Never the projection's decision. */
  executionSigner: string;
}

// ── Provider contract ────────────────────────────────────────────────────

export interface ConfidentialProjectionCapabilities {
  /** Opaque provider identifier (e.g. 'vela'). */
  provider: string;
  /** Opaque handle for the deployed confidential application. */
  applicationRef: string;
  attestationMode: AttestationMode;
  /**
   * Proof states this deployment can actually reach. A NO_ATTESTATION_LOCAL
   * deployment MUST NOT list PRODUCTION_TEE_ATTESTATION_PROVEN.
   */
  provenStates: ConfidentialProofState[];
}

/**
 * A request for confidential projection. `confidentialInputs` is the caller's
 * plaintext, held only long enough to be encrypted by `prepareProjection` —
 * it is `never` persisted, logged, or placed on any downstream type. Keys are
 * opaque labels; values are numeric so the domain layer can carry a limit
 * comparison without knowing what the limit means.
 */
export interface ConfidentialProjectionRequest {
  actionRef: string;
  mandateRef: string;
  identities: ConfidentialProjectionIdentitySet;
  /** Plaintext confidential inputs. MUST NOT survive prepareProjection(). */
  confidentialInputs: Record<string, number>;
  /** Non-confidential context safe to carry alongside (policy version, action type). */
  publicContext?: Record<string, string>;
}

/**
 * A request whose confidential inputs have been encrypted. Deliberately
 * carries `encryptedPayload` and NOT `confidentialInputs` — the type system
 * is what guarantees plaintext cannot reach the submit path.
 */
export interface PreparedConfidentialProjection {
  actionRef: string;
  mandateRef: string;
  identities: ConfidentialProjectionIdentitySet;
  applicationRef: string;
  /** Opaque ciphertext. Encrypted to the confidential environment's public key. */
  encryptedPayload: Uint8Array;
  /** sha256 commitment over the ciphertext, safe for receipts. */
  payloadCommitment: string;
}

export interface ConfidentialProjectionSubmission {
  requestRef: string;
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
  | 'FAILED'
  | 'STATE_CONFLICT';

export interface ConfidentialProjectionStatus {
  requestRef: string;
  state: ConfidentialProjectionObserverState;
  /** Set only once the projection has completed. */
  disposition?: ConfidentialProjectionDisposition;
}

/**
 * Evidence about a completed confidential projection.
 *
 * Carries the verdict and verifiable references — never the confidential
 * inputs, never intermediate values, and never the specific condition that
 * failed. `resultCommitment` lets a later observer prove this evidence
 * corresponds to a specific result without revealing it.
 */
export interface ConfidentialProjectionEvidence {
  requestRef: string;
  applicationRef: string;
  disposition: ConfidentialProjectionDisposition;
  /** sha256 commitment over the confidential result. Receipt-safe. */
  resultCommitment: string;
  /** Commitment over the submitted ciphertext, tying evidence to a specific request. */
  payloadCommitment: string;
  /** Opaque signature/state-root references proving the environment produced this result. */
  executionProofRefs: string[];
  attestationMode: AttestationMode;
}

/**
 * The outcome of independently verifying evidence.
 *
 * The two booleans are structurally separate and one may never be inferred
 * from the other. A local deployment returns
 * `protocolExecutionVerified: true, teeAttestationVerified: false,
 * attestationMode: 'NO_ATTESTATION_LOCAL'`.
 */
export interface ConfidentialEvidenceVerification {
  requestRef: string;
  /** The result was produced by the environment we submitted to, per its own signature/state proof. */
  protocolExecutionVerified: boolean;
  /** A real hardware TEE attestation chain was verified. NEVER implied by protocolExecutionVerified. */
  teeAttestationVerified: boolean;
  attestationMode: AttestationMode;
  provenStates: ConfidentialProofState[];
  /** Human-readable basis for the two booleans above. Must not reveal confidential values. */
  reason: string;
}

/**
 * The constitutional seam. MoneyPenny and the Financial Services Runtime
 * consume THIS, never a provider-specific client.
 *
 * Note what is absent by design: no `authorize()`, no `isAuthorized()`, no
 * method returning an authorisation of any kind. A provider contributes
 * projection evidence; the runtime derives authorisation.
 */
export interface ConfidentialProjectionProvider {
  getCapabilities(): Promise<ConfidentialProjectionCapabilities>;
  /** Encrypts confidential inputs. The returned value MUST NOT carry plaintext. */
  prepareProjection(
    request: ConfidentialProjectionRequest,
  ): Promise<PreparedConfidentialProjection>;
  submitProjection(
    prepared: PreparedConfidentialProjection,
  ): Promise<ConfidentialProjectionSubmission>;
  getProjectionStatus(requestRef: string): Promise<ConfidentialProjectionStatus>;
  getProjectionEvidence(requestRef: string): Promise<ConfidentialProjectionEvidence>;
  verifyProjectionEvidence(
    evidence: ConfidentialProjectionEvidence,
  ): Promise<ConfidentialEvidenceVerification>;
}
