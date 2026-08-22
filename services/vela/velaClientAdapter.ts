/**
 * Real Vela transport — the live implementation of `VelaTransport`.
 *
 * Speaks the actual v0.2.0 wire protocol against a running deployment:
 * `ProcessorEndpoint.submitRequest`, the `UserEvent`/`RequestCompleted`/
 * `StateRootUpdate` logs, the `stateUpdate` transaction's TEE signature, and
 * the `TeeAuthenticator`'s registered signer + P-521 public key.
 *
 * Cryptography is implemented directly against Node's primitives and matches
 * `vela/pkg/crypto/cipher.go` exactly, verified against source at tag v0.2.0:
 *
 *   ECDH(P-521)  →  HKDF-SHA256(salt = nil, info = nil, 32 bytes)  →
 *   AES-256-GCM with a random 12-byte nonce PREPENDED, no AAD
 *
 * Both `salt` and `info` are nil in Go (`hkdf.New(sha256.New, secret, nil, nil)`);
 * a zero-length salt is treated as HashLen zero bytes per RFC 5869, which is
 * what Node's hkdf does too. Getting either wrong yields a key that decrypts
 * nothing, so `velaCryptoSelfTest()` asserts the round trip before use.
 *
 * Server-side only. Never import into client code — it handles a P-521 private
 * key and an EVM signing key.
 */

import { createCipheriv, createDecipheriv, createECDH, hkdfSync, randomBytes } from 'crypto';
import { Contract, JsonRpcProvider, Wallet, type Log } from 'ethers';
import {
  VELA_REQUEST_TYPE,
  type VelaDeploymentDescriptor,
  type VelaRequestResult,
  type VelaTransport,
} from './velaTypes';

/** `ProcessorEndpoint.PROTOCOL_VERSION` — 0 at v0.2.0. */
const PROTOCOL_VERSION = 0;
const ETH_SENTINEL = '0x0000000000000000000000000000000000000000';

/** Minimal ABI — only what this transport actually calls. */
const PROCESSOR_ABI = [
  'function submitRequest(uint8 protocolVersion, uint64 applicationId, uint8 requestType, bytes payload, address tokenAddress, uint256 assetAmount, uint256 maxFeeValue) payable returns (bytes32)',
  'function minFeePerRequest() view returns (uint256)',
  'function stateUpdate(uint64 applicationId, bytes32 prevStateRoot, bytes32 newStateRoot, bytes32 processedRequestId, (bytes[] events, bytes32[] subTypes) userEventData, (bytes[] events, bytes32[] subTypes) appEventData, (address tokenAddress, address receiver, uint256 amount)[] withdrawalRequests, uint256 refund, uint256 applicationFees, uint8 errorCode, string errorMsg, bytes signature)',
  'event RequestSubmitted(uint64 indexed applicationId, bytes32 indexed requestId, address indexed sender, address facilitator)',
  'event RequestCompleted(uint64 indexed applicationId, bytes32 indexed requestId, uint256 applicationFees, uint8 status, uint8 errorCode, string errorMessage)',
  'event UserEvent(uint64 indexed applicationId, bytes32 indexed requestId, bytes32 indexed eventSubType, bytes encryptedData)',
  'event StateRootUpdate(uint64 indexed applicationId, bytes32 indexed requestId, bytes32 oldStateRoot, bytes32 newStateRoot)',
];

const TEE_AUTHENTICATOR_ABI = [
  'function getTeeSigner() view returns (address)',
  'function getPubSecp521r1() view returns (bytes)',
];

// ── Crypto (must match vela/pkg/crypto/cipher.go byte-for-byte) ──────────

/** ECDH(P-521) → HKDF-SHA256(nil salt, nil info) → 32-byte AES key. */
function deriveAesKey(privateKeyHex: string, peerPublicKeyHex: string): Buffer {
  const ecdh = createECDH('secp521r1');
  ecdh.setPrivateKey(Buffer.from(privateKeyHex.replace(/^0x/, ''), 'hex'));
  // Go's ecdh.PrivateKey.ECDH() returns the shared X coordinate only, which is
  // exactly what Node's computeSecret returns.
  const shared = ecdh.computeSecret(
    Buffer.from(peerPublicKeyHex.replace(/^0x/, ''), 'hex'),
  );
  return Buffer.from(
    hkdfSync('sha256', shared, Buffer.alloc(0), Buffer.alloc(0), 32),
  );
}

export function velaEncrypt(
  plaintext: Uint8Array,
  privateKeyHex: string,
  peerPublicKeyHex: string,
  nonceOverride?: Buffer,
): Uint8Array {
  const key = deriveAesKey(privateKeyHex, peerPublicKeyHex);
  // Random 12-byte nonce, matching Go's aesgcm.NonceSize(). Injectable only so
  // a test can pin a known vector; never pass one from production code.
  const nonce = nonceOverride ?? randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  // nonce ‖ ciphertext ‖ tag — Go appends the GCM tag to the ciphertext and
  // prepends the nonce.
  return Buffer.concat([nonce, ct, cipher.getAuthTag()]);
}

export function velaDecrypt(
  envelope: Uint8Array,
  privateKeyHex: string,
  peerPublicKeyHex: string,
): Uint8Array {
  const buf = Buffer.from(envelope);
  if (buf.length < 12 + 16) throw new Error('velaDecrypt: envelope too short');
  const key = deriveAesKey(privateKeyHex, peerPublicKeyHex);
  const nonce = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Proves the encrypt/decrypt pair round-trips through a real P-521 ECDH
 * exchange between two independently generated keypairs. Run before any live
 * submission: a silent key-derivation mismatch would otherwise surface as an
 * unexplained enclave-side decrypt failure.
 */
export function velaCryptoSelfTest(): void {
  const a = createECDH('secp521r1');
  a.generateKeys();
  const b = createECDH('secp521r1');
  b.generateKeys();
  const aPriv = a.getPrivateKey('hex');
  const aPub = a.getPublicKey('hex');
  const bPriv = b.getPrivateKey('hex');
  const bPub = b.getPublicKey('hex');

  const msg = Buffer.from('vela crypto self test', 'utf8');
  const sealed = velaEncrypt(msg, aPriv, bPub);
  const opened = velaDecrypt(sealed, bPriv, aPub);
  if (Buffer.from(opened).toString('utf8') !== msg.toString('utf8')) {
    throw new Error('velaCryptoSelfTest: ECDH/HKDF/AES-GCM round trip failed');
  }
  if (
    !deriveAesKey(aPriv, bPub).equals(deriveAesKey(bPriv, aPub))
  ) {
    throw new Error('velaCryptoSelfTest: derived keys are not symmetric');
  }
}

// ── Transport ────────────────────────────────────────────────────────────

export interface VelaClientAdapterOptions {
  deployment: VelaDeploymentDescriptor;
  /** EVM signing key of the confidential requester (the submitter). */
  requesterPrivateKeyHex: string;
  /** P-521 private key whose public half is registered via ASSOCIATEKEY. */
  requesterP521PrivateKeyHex: string;
  /** Fee ceiling per request, wei. Must be >= minFeePerRequest. */
  maxFeeValueWei?: bigint;
}

export class VelaClientAdapter implements VelaTransport {
  readonly deployment: VelaDeploymentDescriptor;
  private readonly provider: JsonRpcProvider;
  private readonly wallet: Wallet;
  private readonly processor: Contract;
  private readonly teeAuthenticator: Contract;
  private readonly opts: VelaClientAdapterOptions;
  private teePubKeyHex: string | null = null;
  /** requestId -> block the submission landed in, so log scans stay bounded. */
  private readonly submitBlock = new Map<string, number>();

  constructor(opts: VelaClientAdapterOptions) {
    this.opts = opts;
    this.deployment = opts.deployment;
    this.provider = new JsonRpcProvider(opts.deployment.rpcUrl);
    this.wallet = new Wallet(opts.requesterPrivateKeyHex, this.provider);
    this.processor = new Contract(
      opts.deployment.processorEndpointAddress,
      PROCESSOR_ABI,
      this.wallet,
    );
    this.teeAuthenticator = new Contract(
      opts.deployment.teeAuthenticatorAddress,
      TEE_AUTHENTICATOR_ABI,
      this.provider,
    );
  }

  /** The enclave's registered P-521 public key, read from the chain. */
  private async teePublicKey(): Promise<string> {
    if (!this.teePubKeyHex) {
      const raw: string = await this.teeAuthenticator.getPubSecp521r1();
      this.teePubKeyHex = raw.replace(/^0x/, '');
      if (this.teePubKeyHex.length !== 266) {
        throw new Error(
          `unexpected TEE P-521 public key length: ${this.teePubKeyHex.length / 2} bytes (expected 133)`,
        );
      }
    }
    return this.teePubKeyHex;
  }

  async encryptForTee(plaintext: Uint8Array): Promise<Uint8Array> {
    return velaEncrypt(
      plaintext,
      this.opts.requesterP521PrivateKeyHex,
      await this.teePublicKey(),
    );
  }

  async submitProcessRequest(
    applicationId: string,
    encryptedPayload: Uint8Array,
  ): Promise<string> {
    const minFee: bigint = await this.processor.minFeePerRequest();
    const maxFee = this.opts.maxFeeValueWei ?? minFee;
    if (maxFee < minFee) {
      throw new Error(`maxFeeValue ${maxFee} is below minFeePerRequest ${minFee}`);
    }

    const tx = await this.processor.submitRequest(
      PROTOCOL_VERSION,
      BigInt(applicationId),
      VELA_REQUEST_TYPE.PROCESS,
      encryptedPayload,
      ETH_SENTINEL,
      0n, // a projection carries no funds
      maxFee,
      { value: maxFee }, // msg.value must cover assetAmount + maxFeeValue
    );
    const receipt = await tx.wait();
    if (!receipt) throw new Error('submitProcessRequest: no receipt');

    // The requestId is the RequestSubmitted log's second topic.
    const submitted = receipt.logs.find((l: Log) => {
      try {
        return this.processor.interface.parseLog(l)?.name === 'RequestSubmitted';
      } catch {
        return false;
      }
    });
    if (!submitted) throw new Error('submitProcessRequest: no RequestSubmitted log');
    const requestId = this.processor.interface.parseLog(submitted)!.args.requestId as string;
    this.submitBlock.set(requestId, receipt.blockNumber);
    return requestId;
  }

  async fetchResult(requestId: string): Promise<VelaRequestResult | null> {
    const fromBlock = this.submitBlock.get(requestId) ?? 0;
    const completed = await this.processor.queryFilter(
      this.processor.filters.RequestCompleted(null, requestId),
      fromBlock,
    );
    if (completed.length === 0) return null; // still pending

    const done = this.processor.interface.parseLog(completed[0])!;
    const applicationId = String(done.args.applicationId);
    const errorCode = Number(done.args.errorCode);
    const errorMsg = String(done.args.errorMessage ?? '');

    // The state root the TEE signed.
    const rootLogs = await this.processor.queryFilter(
      this.processor.filters.StateRootUpdate(null, requestId),
      fromBlock,
    );
    const stateRootHex =
      rootLogs.length > 0
        ? (this.processor.interface.parseLog(rootLogs[0])!.args.newStateRoot as string)
        : '';

    // The TEE's ECDSA signature is the last calldata argument of the
    // `stateUpdate` transaction that finalised this request — it is not
    // emitted as an event, so it is recovered by decoding the tx input.
    let teeSignatureHex = '';
    const tx = await this.provider.getTransaction(completed[0].transactionHash);
    if (tx) {
      try {
        const decoded = this.processor.interface.parseTransaction({ data: tx.data });
        if (decoded?.name === 'stateUpdate') {
          teeSignatureHex = decoded.args.signature as string;
        }
      } catch {
        // Leave empty — verifyProjectionEvidence then reports the evidence as
        // not protocol-verified rather than assuming it is.
      }
    }

    // The per-user encrypted result, decrypted with our own P-521 key.
    let decryptedUserEventJson: string | null = null;
    const userEvents = await this.processor.queryFilter(
      this.processor.filters.UserEvent(null, requestId),
      fromBlock,
    );
    for (const log of userEvents) {
      const encrypted = this.processor.interface.parseLog(log)!.args.encryptedData as string;
      try {
        decryptedUserEventJson = Buffer.from(
          velaDecrypt(
            Buffer.from(encrypted.replace(/^0x/, ''), 'hex'),
            this.opts.requesterP521PrivateKeyHex,
            await this.teePublicKey(),
          ),
        ).toString('utf8');
        break;
      } catch {
        // Not addressed to us. Per VELA-PRIVACY-BOUNDARY-001 a non-recipient
        // simply fails to decrypt; that is expected, not an error.
      }
    }

    return {
      requestId,
      applicationId,
      stateRootHex,
      teeSignatureHex,
      teeSignerAddress: await this.readRegisteredTeeSigner(),
      submittedPayload: Buffer.from(
        (await this.submittedPayloadHex(requestId)).replace(/^0x/, ''),
        'hex',
      ),
      decryptedUserEventJson,
      errorCode,
      errorMsg,
    };
  }

  /** The ciphertext as recorded on-chain, recovered from the submitting tx. */
  private async submittedPayloadHex(requestId: string): Promise<string> {
    const fromBlock = this.submitBlock.get(requestId) ?? 0;
    const submitted = await this.processor.queryFilter(
      this.processor.filters.RequestSubmitted(null, requestId),
      fromBlock,
    );
    if (submitted.length === 0) return '0x';
    const tx = await this.provider.getTransaction(submitted[0].transactionHash);
    if (!tx) return '0x';
    try {
      const decoded = this.processor.interface.parseTransaction({ data: tx.data });
      if (decoded?.name === 'submitRequest') return decoded.args.payload as string;
    } catch {
      /* fall through */
    }
    return '0x';
  }

  async readRegisteredTeeSigner(): Promise<string> {
    return await this.teeAuthenticator.getTeeSigner();
  }
}
