/**
 * Deterministic in-memory VelaTransport double.
 *
 * Exists so the provider's constitutional behaviour (disposition mapping,
 * fail-closed paths, attestation separation, no-leak invariants) is provable
 * in CI without Docker. It is NOT a substitute for the live-stack proof — the
 * real round trip is exercised by scripts/vela-slice2b-live-projection.ts.
 *
 * It reproduces the real transport's SHAPE faithfully in the ways that matter
 * to the provider: the same encryption envelope layout (nonce ‖ ciphertext ‖
 * tag lengths), the same "null while pending" polling contract, the same
 * errorCode semantics, and the same on-chain payload echo. It deliberately
 * does NOT reproduce Vela's actual cryptography — a test double that faked
 * ECDH could mask a real crypto defect, so the live script owns that claim.
 */

import { createHash, randomBytes } from 'crypto';
import type {
  VelaDeploymentDescriptor,
  VelaRequestResult,
  VelaTransport,
} from './velaTypes';

export interface VelaTestTransportOptions {
  deployment: VelaDeploymentDescriptor;
  /** The signer the "chain" reports as registered. */
  registeredTeeSigner: string;
  /** The signer the "enclave" actually signs with. Differs from the above to test signature mismatch. */
  signingTeeSigner?: string;
  /**
   * Decides what the confidential app returns for a given plaintext. Receives
   * the DECRYPTED plaintext so a test can model a real limit comparison.
   * Return null to model "no result event reached us".
   */
  verdictFor: (plaintextJson: string) => string | null;
  /** Non-zero models an Executor-side failure (request marked failed on-chain). */
  errorCode?: number;
  /** Number of polls that return null before the result appears. Models async observation. */
  pendingPolls?: number;
}

export class VelaTestTransport implements VelaTransport {
  readonly deployment: VelaDeploymentDescriptor;
  private readonly opts: VelaTestTransportOptions;
  /** requestId -> submitted ciphertext + the plaintext it wrapped. */
  private readonly submissions = new Map<string, { payload: Uint8Array; plaintext: string }>();
  private readonly pollCounts = new Map<string, number>();
  private nonce = 0;

  constructor(opts: VelaTestTransportOptions) {
    this.opts = opts;
    this.deployment = opts.deployment;
  }

  /**
   * Models the envelope layout only: 12-byte nonce ‖ ciphertext ‖ 16-byte tag,
   * matching vela/pkg/crypto/cipher.go's output shape. The "ciphertext" here is
   * reversible on purpose so `verdictFor` can inspect the plaintext — see the
   * module note on why this does not fake real ECDH.
   */
  async encryptForTee(plaintext: Uint8Array): Promise<Uint8Array> {
    const nonce = randomBytes(12);
    const tag = randomBytes(16);
    const out = new Uint8Array(12 + plaintext.length + 16);
    out.set(nonce, 0);
    out.set(plaintext, 12);
    out.set(tag, 12 + plaintext.length);
    return out;
  }

  private decrypt(payload: Uint8Array): string {
    return Buffer.from(payload.slice(12, payload.length - 16)).toString('utf8');
  }

  async submitProcessRequest(
    _applicationId: string,
    encryptedPayload: Uint8Array,
  ): Promise<string> {
    this.nonce += 1;
    const requestId = `0x${createHash('sha256')
      .update(`test-request:${this.nonce}`)
      .digest('hex')}`;
    this.submissions.set(requestId, {
      payload: encryptedPayload,
      plaintext: this.decrypt(encryptedPayload),
    });
    return requestId;
  }

  async fetchResult(requestId: string): Promise<VelaRequestResult | null> {
    const submission = this.submissions.get(requestId);
    if (!submission) return null;

    const pendingPolls = this.opts.pendingPolls ?? 0;
    const seen = this.pollCounts.get(requestId) ?? 0;
    if (seen < pendingPolls) {
      this.pollCounts.set(requestId, seen + 1);
      return null;
    }

    const signer = this.opts.signingTeeSigner ?? this.opts.registeredTeeSigner;
    return {
      requestId,
      applicationId: 'test-app',
      stateRootHex: `0x${createHash('sha256').update(submission.payload).digest('hex')}`,
      teeSignatureHex: `0x${'11'.repeat(65)}`,
      teeSignerAddress: signer,
      submittedPayload: submission.payload,
      decryptedUserEventJson: this.opts.verdictFor(submission.plaintext),
      errorCode: this.opts.errorCode ?? 0,
      errorMsg: this.opts.errorCode ? 'executor marked request failed' : '',
    };
  }

  async readRegisteredTeeSigner(): Promise<string> {
    return this.opts.registeredTeeSigner;
  }

  /** Test-only: the ciphertext actually submitted, for leak assertions. */
  submittedPayloadFor(requestId: string): Uint8Array | undefined {
    return this.submissions.get(requestId)?.payload;
  }
}
