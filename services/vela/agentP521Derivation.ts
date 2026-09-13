/**
 * Deterministic P-521 key derivation from an agent's EXISTING Ethereum
 * signing custody — Vela accelerator Phase 4
 * (docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md
 * "Phase 4 — agent P-521 derivation"; analysis in docs/vela/VELA-SIGNER-TOPOLOGY-001.md §6b).
 *
 * WHY THIS EXISTS: `VelaClientAdapterOptions.requesterP521PrivateKeyHex`
 * (`velaClientAdapter.ts`) previously had to be supplied directly by the
 * caller — a raw hex string with no in-repo derivation. Per
 * VELA-SIGNER-TOPOLOGY-001.md's §6b analysis (source-verified against
 * `vela-common-ts` at tag v0.2.0) and the handoff's own instruction
 * ("Prefer: existing agent Ethereum custody -> deterministic Vela P-521
 * derivation. Do not create a second long-lived P-521 secret store"), this
 * module supplies that derivation: it re-derives the P-521 communication key
 * on demand, in-process, non-persistently, from the SAME Ethereum key the
 * agent already uses (`AgentKeyService`-held) — never a new custody surface.
 *
 * CONCEPTUALLY MIRRORS, DOES NOT REPRODUCE, Vela's own
 * `deriveP521PrivateKeyFromSigner` (`vela-common-ts/src/crypto/wallet.ts`):
 *   1. sign a fixed challenge string + the signer's own address;
 *   2. HKDF-SHA256-expand the signature bytes into P-521 scalar candidates;
 *   3. rejection-sample until Node's own curve-order check accepts one.
 *
 * This repo does NOT depend on `vela-common-ts` (confirmed — not in
 * package.json) and `velaClientAdapter.ts` already reimplements Vela's wire
 * cryptography directly against Node's `crypto` module rather than pulling in
 * that library (see its own header comment). This module follows the same
 * established pattern. Byte-identical output to Horizen's reference
 * implementation is NOT required or intended: nothing on Vela's chain/
 * contract side re-derives or verifies HOW a registered P-521 key was
 * derived — `ASSOCIATEKEY` only records whichever public key the requester
 * later uses for ECDH (`VELA_REQUEST_TYPE.ASSOCIATEKEY`, `velaTypes.ts`). So
 * this module uses its OWN HKDF salt/info domain-separation constants
 * (below), never Horizen's private ones — it only needs to be deterministic,
 * correct, and clearly documented as a conceptual mirror, not a byte-for-byte
 * reimplementation.
 *
 * CONSTITUTIONAL BOUNDARY (the handoff's own Phase 4 instruction, verbatim):
 * "Ethereum/P-521 possession proves control/communication capability;
 * Passport/delegation establishes authority; mandate authorizes the exact
 * act." This module derives communication-capability key material ONLY. It
 * has no opinion on, and must never be treated as, authorization — see
 * `services/constitutionalCommerce/actionAuthorisation.ts` for the actual
 * authority/mandate derivation, and
 * `tests/vela-agent-p521-derivation.test.ts` for a test proving a validly
 * derived key composes with, but never substitutes for, that check.
 *
 * NO NEW PERSISTENT SECRET STORE: `deriveAgentP521KeyPair` is a pure,
 * on-demand computation. Nothing it does writes to a database, a new env
 * var, or any other durable store — the derived private key exists only in
 * the calling process's memory for as long as the caller holds the returned
 * value.
 *
 * Server-side only. Never import into client code — like
 * `velaClientAdapter.ts`, this module handles private key material.
 */

import { createECDH, hkdfSync } from 'crypto';

/**
 * The 66-byte (528-bit) HKDF output width this module expands to before
 * masking. P-521's field/order is a 521-bit number (65 bytes + 1 bit); 66
 * bytes gives one full byte of header room to mask down to that 1 bit,
 * mirroring the shape `vela-common-ts`'s own rejection-sampling uses.
 */
const P521_CANDIDATE_BYTES = 66;

/**
 * This module's OWN domain-separation constants — deliberately NOT
 * Horizen's. Vela's chain/contracts never re-derive or verify the derivation
 * method, only the resulting public key registered via `ASSOCIATEKEY`, so
 * these values only need to be stable and unique to this repo's derivation.
 * Changing any of them changes every agent's derived P-521 identity — do not
 * change without a deliberate migration plan.
 */
const MONEYPENNY_AGENT_P521_HKDF_CHALLENGE =
  'AigentZBeta MoneyPenny Vela P-521 derivation challenge v1:';
const MONEYPENNY_AGENT_P521_HKDF_SALT = 'aigentz:moneypenny:vela:p521:hkdf-salt:v1';
const MONEYPENNY_AGENT_P521_HKDF_INFO = 'aigentz:moneypenny:vela:p521:hkdf-info:v1';

/**
 * Bounded so a pathological (or test-injected) candidate generator can never
 * spin forever. In practice a rejection is astronomically unlikely: P-521's
 * order occupies effectively the entire masked 521-bit range, so the very
 * first candidate is valid the overwhelming majority of the time. This bound
 * exists purely as a fail-safe, not because retries are expected.
 */
const DEFAULT_MAX_DERIVATION_ATTEMPTS = 16;

export interface AgentP521KeyPair {
  /**
   * Raw P-521 private scalar, hex-encoded — exactly the bytes that were
   * handed to `crypto.createECDH('secp521r1').setPrivateKey()`, so re-hex-
   * decoding this value reproduces the identical key. This is the value
   * `VelaClientAdapterOptions.requesterP521PrivateKeyHex` expects.
   */
  privateKeyHex: string;
  /**
   * Uncompressed P-521 public key, hex-encoded (0x04 || X || Y — 133 bytes),
   * matching the wire format `TeeAuthenticator.getPubSecp521r1()` /
   * `ASSOCIATEKEY` register (`docs/vela/VELA-SIGNER-TOPOLOGY-001.md` §6b).
   */
  publicKeyHex: string;
}

/**
 * The minimal signing capability this derivation needs — deliberately NOT a
 * raw private-key string. An ethers `Wallet` (or any ethers `Signer`)
 * already satisfies this shape; nothing here requires exporting a raw key
 * beyond what the caller already holds. `AgentKeyService.getAgentKeys()`
 * returns a raw `evmPrivateKey` hex string today (see this module's own
 * resolution record for why V1, not V2), so callers wrap it in
 * `new ethers.Wallet(evmPrivateKey)` before calling in — exactly how
 * `velaClientAdapter.ts` already constructs its own `Wallet` from that same
 * raw key.
 */
export interface AgentP521DerivationSigner {
  getAddress(): Promise<string>;
  /** Ethereum personal-sign (EIP-191). Deterministic per RFC 6979 for a
   *  given key + message — confirmed for this repo's ethers v6 dependency by
   *  `tests/vela-agent-p521-derivation.test.ts`'s determinism case, not
   *  assumed. */
  signMessage(message: string | Uint8Array): Promise<string>;
}

/**
 * Deterministically derives a masked, HKDF-expanded P-521 scalar CANDIDATE
 * for one rejection-sampling attempt. Pure and side-effect-free — exported
 * so the masking rule and per-attempt determinism can be unit-tested in
 * isolation from the ECDH validity check and from any real signature.
 *
 * `ikm` is the input keying material (the agent's Ethereum signature bytes
 * over the fixed challenge, in production; any deterministic byte buffer in
 * a test). `attempt` folds a counter into the HKDF `info` parameter so a
 * rejected candidate's retry is itself deterministic, never random.
 */
export function deriveP521ScalarCandidate(ikm: Buffer, attempt: number): Buffer {
  const info = `${MONEYPENNY_AGENT_P521_HKDF_INFO}:attempt:${attempt}`;
  const expanded = Buffer.from(
    hkdfSync(
      'sha256',
      ikm,
      Buffer.from(MONEYPENNY_AGENT_P521_HKDF_SALT, 'utf8'),
      Buffer.from(info, 'utf8'),
      P521_CANDIDATE_BYTES,
    ),
  );
  // P-521's order is a 521-bit number (65 bytes + 1 bit). Of the top byte's
  // 8 bits, only bit 0 is ever significant — mask the rest to zero so the
  // candidate falls within (or very near) the curve's valid scalar range,
  // the same rejection-sampling shape vela-common-ts's own derivation uses.
  expanded[0] = expanded[0] & 0x01;
  return expanded;
}

/**
 * True iff Node's own P-521 implementation accepts `candidate` as a valid
 * private scalar (non-zero, within the curve order). This is the REAL
 * rejection-sampling check — deliberately not a hand-derived comparison
 * against a hardcoded curve-order constant. Verified interactively before
 * relying on it here: `crypto.createECDH('secp521r1').setPrivateKey()`
 * throws `"Private key is not valid for specified curve."` for an all-zero
 * or out-of-range 66-byte buffer, and succeeds for an in-range one.
 */
export function isValidP521ScalarCandidate(candidate: Buffer): boolean {
  try {
    createECDH('secp521r1').setPrivateKey(candidate);
    return true;
  } catch {
    return false;
  }
}

export interface DeriveAgentP521KeyPairOptions {
  /** Bound on rejection-sampling attempts. Default `DEFAULT_MAX_DERIVATION_ATTEMPTS`. */
  maxAttempts?: number;
  /**
   * TEST-ONLY override for the per-attempt candidate generator. Defaults to
   * the real `deriveP521ScalarCandidate`. Exists so a test can deterministically
   * force a rejection-sampling retry (e.g. an all-zero candidate at attempt
   * 0) without needing to find a naturally-colliding signature — which,
   * given P-521's order occupies effectively the entire masked 521-bit
   * range, would not occur in any practical search. Never set this in
   * production code; `VelaClientAdapter`'s factory never passes it.
   */
  candidateGeneratorForTesting?: (ikm: Buffer, attempt: number) => Buffer;
}

/**
 * Deterministically derives a P-521 keypair from an agent's EXISTING
 * Ethereum signing capability. See this file's header for the full scheme
 * and its constitutional boundary.
 *
 * Determinism: the SAME signer (same underlying private key) always
 * produces the SAME P-521 keypair, byte-for-byte, on every call — because
 * `signMessage` over a fixed message is itself deterministic (RFC 6979) and
 * HKDF-SHA256 is a pure function of its inputs. Nothing here is persisted;
 * calling this again re-derives the identical key on demand.
 */
export async function deriveAgentP521KeyPair(
  signer: AgentP521DerivationSigner,
  options: DeriveAgentP521KeyPairOptions = {},
): Promise<AgentP521KeyPair> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_DERIVATION_ATTEMPTS;
  const generateCandidate = options.candidateGeneratorForTesting ?? deriveP521ScalarCandidate;

  const address = await signer.getAddress();
  const message = `${MONEYPENNY_AGENT_P521_HKDF_CHALLENGE}${address}`;
  const signatureHex = await signer.signMessage(message);
  const ikm = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateCandidate(ikm, attempt);
    const ecdh = createECDH('secp521r1');
    try {
      ecdh.setPrivateKey(candidate);
    } catch {
      continue; // rejected scalar — deterministically retry with the next attempt counter
    }
    return {
      privateKeyHex: candidate.toString('hex'),
      publicKeyHex: ecdh.getPublicKey('hex'),
    };
  }

  throw new Error(
    `deriveAgentP521KeyPair: exhausted ${maxAttempts} rejection-sampling attempts without ` +
      'finding a valid P-521 scalar — this should be astronomically unlikely; treat as a defect.',
  );
}
