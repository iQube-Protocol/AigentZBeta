/**
 * VelaConfidentialProjectionProvider — the first ConfidentialProjectionProvider
 * implementation (VELA-001 Slice 2B).
 *
 * This is the ONLY module in the codebase that consumes both the Vela wire
 * layer (`velaTypes.ts`, `velaClientAdapter.ts`) and the domain seam
 * (`types/confidentialProjection.ts`). It is the constitutional boundary:
 * Vela opcodes, subgraph queries, ProcessorEndpoint details, P-521 mechanics
 * and WASM deployment internals stop here and do not travel outward.
 *
 * What this provider CANNOT do, structurally:
 *  - return an authorisation. `ConfidentialProjectionProvider` has no method
 *    that returns one, and this file never imports `ActionAuthorisation`.
 *  - report a TEE attestation it did not verify. `teeAttestationVerified` is
 *    derived from the DEPLOYMENT's recorded attestation mode, never from the
 *    fact that a request completed.
 *  - reveal why a projection was UNACCEPTABLE. The confidential app returns a
 *    coarse verdict; this provider carries the verdict and commitments only.
 *
 * Server-side only.
 */

import { createHash } from 'crypto';
import type {
  AttestationMode,
  ConfidentialEvidenceVerification,
  ConfidentialProjectionCapabilities,
  ConfidentialProjectionEvidence,
  ConfidentialProjectionDisposition,
  ConfidentialProjectionProvider,
  ConfidentialProjectionRequest,
  ConfidentialProjectionStatus,
  ConfidentialProjectionSubmission,
  ConfidentialProofState,
  PreparedConfidentialProjection,
} from '@/types/confidentialProjection';
import { toDomainAttestationMode, type VelaRequestResult, type VelaTransport } from './velaTypes';

/** sha256 hex commitment. Used for payload + result commitments (receipt-safe). */
function commit(namespace: string, bytes: Uint8Array | string): string {
  return createHash('sha256')
    .update(namespace)
    .update(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes))
    .digest('hex');
}

/**
 * The coarse verdict shape a confidential projection app must emit. Slice 2D
 * builds the real MoneyPenny projector; any app used with this provider must
 * emit exactly this and nothing more (no operand values, no failing-condition
 * name) — see VELA-PRIVACY-BOUNDARY-001 on why the verdict's own event is the
 * leak-prone surface.
 */
interface ConfidentialVerdictPayload {
  verdict: 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED';
}

/**
 * Parse the confidential app's result into a disposition.
 *
 * Fails closed: anything unrecognised, absent, or malformed becomes
 * UNRESOLVED rather than an exception or an optimistic ACCEPTABLE. A provider
 * that threw here would push an availability failure into the caller's error
 * path, where it could be retried into a different answer; UNRESOLVED keeps
 * "cannot safely decide" inside the constitutional vocabulary.
 */
export function parseConfidentialVerdict(
  resultJson: string | null,
): ConfidentialProjectionDisposition {
  if (!resultJson) return 'UNRESOLVED';
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultJson);
  } catch {
    return 'UNRESOLVED';
  }
  if (typeof parsed !== 'object' || parsed === null) return 'UNRESOLVED';
  const verdict = (parsed as Partial<ConfidentialVerdictPayload>).verdict;
  if (verdict === 'ACCEPTABLE' || verdict === 'UNACCEPTABLE' || verdict === 'UNRESOLVED') {
    return verdict;
  }
  return 'UNRESOLVED';
}

/**
 * Which proof states a deployment can legitimately claim.
 *
 * PRODUCTION_TEE_ATTESTATION_PROVEN is reachable ONLY from a NITRO_ATTESTED
 * deployment. This function is the single place that mapping lives, so no
 * amount of successful local execution can promote the third state — operator
 * ruling, 2026-08-22.
 */
export function provenStatesFor(mode: AttestationMode): ConfidentialProofState[] {
  const base: ConfidentialProofState[] = ['LOCAL_PROTOCOL_PROVEN', 'LOCAL_EXECUTION_PROVEN'];
  return mode === 'NITRO_ATTESTED'
    ? [...base, 'PRODUCTION_TEE_ATTESTATION_PROVEN']
    : base;
}

export class VelaConfidentialProjectionProvider implements ConfidentialProjectionProvider {
  constructor(
    private readonly transport: VelaTransport,
    private readonly applicationId: string,
  ) {}

  private get attestationMode(): AttestationMode {
    return toDomainAttestationMode(this.transport.deployment.attestationMode);
  }

  async getCapabilities(): Promise<ConfidentialProjectionCapabilities> {
    const mode = this.attestationMode;
    return {
      provider: 'vela',
      applicationRef: this.applicationId,
      attestationMode: mode,
      provenStates: provenStatesFor(mode),
    };
  }

  /**
   * Encrypts the confidential inputs. The returned `PreparedConfidentialProjection`
   * has no field able to hold plaintext — that is the type-level guarantee
   * that plaintext cannot travel to submit.
   */
  async prepareProjection(
    request: ConfidentialProjectionRequest,
  ): Promise<PreparedConfidentialProjection> {
    const plaintext = Buffer.from(
      JSON.stringify({
        type: 'confidential_consequence_projection',
        inputs: request.confidentialInputs,
        // Public context rides along so the app can bind its verdict to the
        // action, but it is BY DEFINITION non-confidential (policy version,
        // action type) — never a limit or balance.
        context: request.publicContext ?? {},
      }),
      'utf8',
    );
    const encryptedPayload = await this.transport.encryptForTee(plaintext);
    return {
      actionRef: request.actionRef,
      mandateRef: request.mandateRef,
      identities: request.identities,
      applicationRef: this.applicationId,
      encryptedPayload,
      payloadCommitment: commit('vela:payload:', encryptedPayload),
    };
  }

  async submitProjection(
    prepared: PreparedConfidentialProjection,
  ): Promise<ConfidentialProjectionSubmission> {
    const requestRef = await this.transport.submitProcessRequest(
      prepared.applicationRef,
      prepared.encryptedPayload,
    );
    return { requestRef, submittedAt: new Date().toISOString() };
  }

  async getProjectionStatus(requestRef: string): Promise<ConfidentialProjectionStatus> {
    const result = await this.transport.fetchResult(requestRef);
    if (!result) return { requestRef, state: 'OBSERVING' };
    if (result.errorCode !== 0) {
      // The Executor marked the request failed. That is an execution failure,
      // not a verdict — it must not read as UNACCEPTABLE (which would look
      // like the confidential conditions were evaluated and rejected).
      return { requestRef, state: 'FAILED', disposition: 'UNRESOLVED' };
    }
    const disposition = parseConfidentialVerdict(result.decryptedUserEventJson);
    const state =
      disposition === 'ACCEPTABLE'
        ? 'PROJECTION_ACCEPTABLE'
        : disposition === 'UNACCEPTABLE'
          ? 'PROJECTION_UNACCEPTABLE'
          : 'PROJECTION_UNRESOLVED';
    return { requestRef, state, disposition };
  }

  async getProjectionEvidence(requestRef: string): Promise<ConfidentialProjectionEvidence> {
    const result = await this.transport.fetchResult(requestRef);
    if (!result) {
      throw new Error(
        `getProjectionEvidence: no completed result for ${requestRef} — poll getProjectionStatus until it leaves OBSERVING`,
      );
    }
    return this.evidenceFrom(result);
  }

  private evidenceFrom(result: VelaRequestResult): ConfidentialProjectionEvidence {
    const disposition =
      result.errorCode !== 0
        ? 'UNRESOLVED'
        : parseConfidentialVerdict(result.decryptedUserEventJson);
    return {
      requestRef: result.requestId,
      applicationRef: result.applicationId,
      disposition,
      // Commit to the result rather than carrying it: the verdict is coarse
      // and public, but the raw app payload may carry more than the verdict.
      resultCommitment: commit('vela:result:', result.decryptedUserEventJson ?? ''),
      // Same namespace + input as prepareProjection's commitment, so evidence
      // fetched statelessly still ties to the exact ciphertext submitted.
      payloadCommitment: commit('vela:payload:', result.submittedPayload),
      executionProofRefs: [
        `stateRoot:${result.stateRootHex}`,
        `teeSignature:${result.teeSignatureHex}`,
        `teeSigner:${result.teeSignerAddress}`,
      ],
      attestationMode: this.attestationMode,
    };
  }

  /**
   * Independently verify the evidence.
   *
   * Two separate questions, two separate booleans, neither inferred from the
   * other:
   *  - protocolExecutionVerified: was this result signed by the identity the
   *    chain's TeeAuthenticator currently trusts? (checkable anywhere)
   *  - teeAttestationVerified: was that identity's registration itself backed
   *    by a real hardware attestation chain? (a property of the DEPLOYMENT,
   *    which is why it reads `attestationMode` and never the result)
   */
  async verifyProjectionEvidence(
    evidence: ConfidentialProjectionEvidence,
  ): Promise<ConfidentialEvidenceVerification> {
    const mode = this.attestationMode;
    const registeredSigner = await this.transport.readRegisteredTeeSigner();
    const signerRef = evidence.executionProofRefs.find((r) => r.startsWith('teeSigner:'));
    const evidenceSigner = signerRef?.slice('teeSigner:'.length) ?? '';
    const protocolExecutionVerified =
      evidenceSigner.length > 0 &&
      evidenceSigner.toLowerCase() === registeredSigner.toLowerCase();

    // NOTE the deliberate absence of `&& protocolExecutionVerified` below.
    // Attestation is a fact about how the signing identity was registered, not
    // about whether a given result matched it. Coupling them would let a
    // successful local execution read as attested.
    const teeAttestationVerified = mode === 'NITRO_ATTESTED';

    return {
      requestRef: evidence.requestRef,
      protocolExecutionVerified,
      teeAttestationVerified,
      attestationMode: mode,
      provenStates: provenStatesFor(mode),
      reason: protocolExecutionVerified
        ? teeAttestationVerified
          ? 'result signed by the chain-registered TEE signer; that signer was registered under a verified Nitro attestation'
          : 'result signed by the chain-registered TEE signer; that signer was registered WITHOUT attestation (emulated environment) — protocol proven, hardware trust not proven'
        : 'result signature does not match the TEE signer currently registered on-chain',
    };
  }
}
