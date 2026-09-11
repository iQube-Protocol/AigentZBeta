/**
 * The client half of principal-wallet provisioning.
 *
 * Everything secret happens here, in the browser, and stays here:
 *
 *   generate keypair → derive address → encrypt with the wallet password
 *   → send ONLY {address, publicKey, ciphertext envelope}
 *   → receive a fresh nonce → decrypt locally → sign locally
 *   → send ONLY {requestId, signature}
 *
 * The password, the plaintext private key and the decrypted envelope never
 * appear in a request body. The server refuses them if they ever do
 * (`screenProvisioningPayload`), but the guarantee lives here — a server-side
 * refusal is a backstop for a mistake, not a substitute for not making it.
 *
 * ── The local derivation hazard ────────────────────────────────────────────
 *
 * `keyService.deriveEvmAddress` has a FALLBACK: when `import('ethers')` fails
 * it SHA-256s the private key and returns the first 40 hex characters as an
 * "address". That address is well-formed, deterministic, and belongs to no
 * key — the exact ADDRESS_ONLY shape the wallet-binding trace (#121) found on
 * twenty-one persona rows.
 *
 * The server's control proof would catch it, and catching it there means the
 * operator has already been shown a provisioned wallet before it fails. So
 * `assertRealDerivation` re-derives independently and refuses BEFORE anything
 * is persisted. A fallback that silently produces an unsignable wallet is not
 * a degraded mode; it is the defect.
 */

import { personaFetch } from '@/utils/personaSpine';
import { generateEvmKeyPair, decryptPrivateKey, validatePassword } from '@/services/wallet/keyService';
import { PROVISIONING_SEQUENCE } from '@/services/wallet/principalWalletProvisioning';

/**
 * The phases a surface can render, in order.
 *
 * Deliberately coarser than PROVISIONING_SEQUENCE: the sequence records what
 * must HAPPEN and in what order, this records what is worth SHOWING. Merging
 * them would either flash eleven states past the operator or hide the two long
 * ones (persisting, awaiting proof) behind a single spinner.
 */
export type ProvisioningPhase = 'GENERATING' | 'ENCRYPTING' | 'PERSISTING' | 'AWAITING_CONTROL_PROOF';

export interface ProvisioningOutcome {
  ok: boolean;
  stage: 'NOT_STARTED' | 'SIGNER_CONFIGURED' | 'CONTROL_PROVEN';
  complete: boolean;
  boundAddress: string | null;
  /** Which step of PROVISIONING_SEQUENCE it stopped at. Null when complete. */
  stoppedAt: (typeof PROVISIONING_SEQUENCE)[number] | null;
  refusal: string | null;
  detail: string;
}

function stopped(
  stoppedAt: (typeof PROVISIONING_SEQUENCE)[number],
  refusal: string,
  detail: string,
  stage: ProvisioningOutcome['stage'] = 'NOT_STARTED',
  boundAddress: string | null = null,
): ProvisioningOutcome {
  return { ok: false, stage, complete: false, boundAddress, stoppedAt, refusal, detail };
}

/**
 * Re-derive the address from the private key by a path that CANNOT fall back,
 * and refuse if it disagrees.
 *
 * Deliberately not a call into keyService: the whole point is to not trust the
 * function whose fallback is the hazard.
 */
async function assertRealDerivation(privateKeyHex: string, claimedAddress: string): Promise<string | null> {
  let ethers: typeof import('ethers');
  try {
    ethers = await import('ethers');
  } catch {
    return (
      'The EVM cryptography library could not be loaded in this browser, so no address can be derived from a ' +
      'real key. Provisioning stopped rather than recording an address with nothing behind it.'
    );
  }
  let derived: string;
  try {
    derived = new ethers.Wallet('0x' + privateKeyHex).address;
  } catch (e) {
    return `The generated key could not be used to derive an address (${(e as Error).message}).`;
  }
  if (derived.toLowerCase() !== claimedAddress.toLowerCase()) {
    return (
      'The address generated for this wallet does not match the address its private key actually derives. ' +
      'This is the signature of a fallback derivation — the address would look valid and could never sign.'
    );
  }
  return null;
}

async function readRefusal(res: Response): Promise<{ refusal: string; detail: string }> {
  try {
    const j = (await res.json()) as { refusal?: unknown; detail?: unknown };
    return {
      refusal: typeof j.refusal === 'string' ? j.refusal : `HTTP_${res.status}`,
      detail:
        typeof j.detail === 'string'
          ? j.detail
          : `The server refused the request and gave no reason (HTTP ${res.status}).`,
    };
  } catch {
    // A status code is never an explanation.
    return {
      refusal: `HTTP_${res.status}`,
      detail: `The server responded ${res.status} with a body that could not be read as JSON.`,
    };
  }
}

/**
 * Run the whole ceremony, ending at CONTROL_PROVEN.
 *
 * Returns `complete: false` at SIGNER_CONFIGURED if the proof step does not
 * finish — never `ok: true` for a wallet whose control has not been shown.
 */
export async function provisionPrincipalWallet(input: {
  personaId: string;
  /** Never transmitted. Used locally to encrypt, then to decrypt for the proof. */
  password: string;
  /** Idempotency key for the provisioning POST. */
  requestId: string;
  /**
   * Phase reporting for the wallet surface.
   *
   * The surface has to show GENERATING / ENCRYPTING / PERSISTING /
   * AWAITING_CONTROL_PROOF as distinct states, and the only place that knows
   * which one is running is here. A second copy of this sequence living in the
   * component would be the parallel implementation inv.engineering.037
   * forbids — and would drift the moment either changed.
   */
  onPhase?: (phase: ProvisioningPhase) => void;
}): Promise<ProvisioningOutcome> {
  const phase = (p: ProvisioningPhase) => input.onPhase?.(p);

  const strength = validatePassword(input.password);
  if (!strength.valid) {
    return stopped(
      'encrypt-private-key-client-side',
      'WEAK_WALLET_PASSWORD',
      `This password cannot protect a principal key: ${strength.errors.join('; ')}.`,
    );
  }

  // ── generate + derive + encrypt, all client-side ────────────────────────
  phase('GENERATING');
  let pair: Awaited<ReturnType<typeof generateEvmKeyPair>>;
  try {
    pair = await generateEvmKeyPair(input.password);
  } catch (e) {
    return stopped('generate-keypair-client-side', 'KEYGEN_FAILED', (e as Error).message);
  }

  // Decrypt once to check the derivation, and hold the plaintext only for as
  // long as the two local steps that need it.
  let plaintextKey: string;
  try {
    plaintextKey = await decryptPrivateKey(pair.encryptedPrivateKey, input.password);
  } catch (e) {
    return stopped('encrypt-private-key-client-side', 'ENVELOPE_UNREADABLE', (e as Error).message);
  }

  phase('ENCRYPTING');
  const derivationFault = await assertRealDerivation(plaintextKey, pair.address);
  if (derivationFault) {
    return stopped('derive-address-client-side', 'FALLBACK_DERIVATION_REFUSED', derivationFault);
  }

  // ── persist ciphertext + address (and, server-side, preserve the external
  //    binding and supersede the placeholder) ──────────────────────────────
  phase('PERSISTING');
  const provisionRes = await personaFetch('/api/wallet/principal/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    personaIdHint: input.personaId,
    body: JSON.stringify({
      subjectPersonaId: input.personaId,
      requestId: input.requestId,
      derivedAddress: pair.address,
      publicKey: pair.publicKey,
      encryptedEnvelope: pair.encryptedPrivateKey,
    }),
  });
  if (!provisionRes.ok) {
    const { refusal, detail } = await readRefusal(provisionRes);
    return stopped('persist-ciphertext-envelope-and-address', refusal, detail);
  }

  // ── issue a fresh nonce ─────────────────────────────────────────────────
  phase('AWAITING_CONTROL_PROOF');
  const nonceRes = await personaFetch('/api/wallet/principal/control-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    personaIdHint: input.personaId,
    body: JSON.stringify({}),
  });
  if (!nonceRes.ok) {
    const { refusal, detail } = await readRefusal(nonceRes);
    return stopped('issue-fresh-control-proof-nonce', refusal, detail, 'SIGNER_CONFIGURED', pair.address);
  }
  const issued = (await nonceRes.json()) as { requestId?: string; nonce?: string };
  if (!issued.requestId || !issued.nonce) {
    return stopped(
      'issue-fresh-control-proof-nonce',
      'NONCE_NOT_ISSUED',
      'The server accepted the request but returned no nonce, so there is nothing to sign.',
      'SIGNER_CONFIGURED',
      pair.address,
    );
  }

  // ── sign LOCALLY ────────────────────────────────────────────────────────
  let signature: string;
  try {
    const ethers = await import('ethers');
    signature = await new ethers.Wallet('0x' + plaintextKey).signMessage(issued.nonce);
  } catch (e) {
    return stopped(
      'unlock-and-sign-locally',
      'LOCAL_SIGNING_FAILED',
      (e as Error).message,
      'SIGNER_CONFIGURED',
      pair.address,
    );
  } finally {
    // The plaintext key has done its two jobs. Drop the reference before any
    // further await gives something else a chance to observe it.
    plaintextKey = '';
  }

  // ── recover and compare, server-side ────────────────────────────────────
  const verifyRes = await personaFetch('/api/wallet/principal/control-proof?verify=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    personaIdHint: input.personaId,
    body: JSON.stringify({ requestId: issued.requestId, signature }),
  });
  if (!verifyRes.ok) {
    const { refusal, detail } = await readRefusal(verifyRes);
    return stopped('recover-and-compare-server-side', refusal, detail, 'SIGNER_CONFIGURED', pair.address);
  }

  return {
    ok: true,
    stage: 'CONTROL_PROVEN',
    complete: true,
    boundAddress: pair.address,
    stoppedAt: null,
    detail:
      'A first-party principal wallet was created in this browser, its encrypted envelope stored, and its ' +
      'control proven by signing a fresh nonce that recovered to the bound address.',
    refusal: null,
  };
}

/**
 * Prove an EXISTING principal wallet, without creating anything.
 *
 * ── Why this is a separate entry point ─────────────────────────────────────
 *
 * The browser run (2026-08-02) produced the state this exists for: a wallet
 * whose envelope was persisted and whose control proof did not complete. From
 * the outside that is indistinguishable from "no wallet" unless the surface
 * says otherwise, and the tempting recovery — run provisioning again — would
 * generate a SECOND keypair and abandon the first. The operator was explicit:
 *
 *   > "Never regenerate the wallet in this state."
 *
 * So retry is its own path with its own guarantee: it decrypts the stored
 * envelope, signs a fresh nonce, and lets the server recover. It calls
 * `/provision` never, and `generateEvmKeyPair` never — the canary checks both.
 */
export async function proveExistingPrincipalWallet(input: {
  personaId: string;
  password: string;
  onPhase?: (phase: ProvisioningPhase) => void;
}): Promise<ProvisioningOutcome> {
  input.onPhase?.('AWAITING_CONTROL_PROOF');

  // The envelope is fetched from the wallet's own local store, decrypted
  // locally, and never leaves. Reading it from the SERVER would mean shipping
  // key material to the browser over the wire on every retry — the retry path
  // must not be a weaker door into the same house.
  const envelopeRes = await personaFetch('/api/wallet/principal/envelope', {
    cache: 'no-store',
    personaIdHint: input.personaId,
  });
  if (!envelopeRes.ok) {
    const { refusal, detail } = await readRefusal(envelopeRes);
    return stopped('unlock-and-sign-locally', refusal, detail, 'SIGNER_CONFIGURED');
  }
  const { encryptedEnvelope, boundAddress } = (await envelopeRes.json()) as {
    encryptedEnvelope?: unknown;
    boundAddress?: string;
  };
  if (!encryptedEnvelope || !boundAddress) {
    return stopped(
      'unlock-and-sign-locally',
      'NO_CONFIGURED_SIGNER',
      'No stored envelope was returned for this persona, so there is nothing to prove control of.',
      'NOT_STARTED',
    );
  }

  let plaintextKey: string;
  try {
    plaintextKey = await decryptPrivateKey(encryptedEnvelope as Parameters<typeof decryptPrivateKey>[0], input.password);
  } catch {
    return stopped(
      'unlock-and-sign-locally',
      'WRONG_WALLET_PASSWORD',
      'The stored wallet could not be unlocked with that password. The wallet is intact — nothing was ' +
        'changed and nothing was replaced. Try the password you set when it was created.',
      'SIGNER_CONFIGURED',
      boundAddress,
    );
  }

  const nonceRes = await personaFetch('/api/wallet/principal/control-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    personaIdHint: input.personaId,
    body: JSON.stringify({}),
  });
  if (!nonceRes.ok) {
    const { refusal, detail } = await readRefusal(nonceRes);
    return stopped('issue-fresh-control-proof-nonce', refusal, detail, 'SIGNER_CONFIGURED', boundAddress);
  }
  const issued = (await nonceRes.json()) as { requestId?: string; nonce?: string };
  if (!issued.requestId || !issued.nonce) {
    return stopped(
      'issue-fresh-control-proof-nonce',
      'NONCE_NOT_ISSUED',
      'The server accepted the request but returned no nonce, so there is nothing to sign.',
      'SIGNER_CONFIGURED',
      boundAddress,
    );
  }

  let signature: string;
  try {
    const ethers = await import('ethers');
    signature = await new ethers.Wallet('0x' + plaintextKey).signMessage(issued.nonce);
  } catch (e) {
    return stopped('unlock-and-sign-locally', 'LOCAL_SIGNING_FAILED', (e as Error).message, 'SIGNER_CONFIGURED', boundAddress);
  } finally {
    plaintextKey = '';
  }

  const verifyRes = await personaFetch('/api/wallet/principal/control-proof?verify=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    personaIdHint: input.personaId,
    body: JSON.stringify({ requestId: issued.requestId, signature }),
  });
  if (!verifyRes.ok) {
    const { refusal, detail } = await readRefusal(verifyRes);
    return stopped('recover-and-compare-server-side', refusal, detail, 'SIGNER_CONFIGURED', boundAddress);
  }

  return {
    ok: true,
    stage: 'CONTROL_PROVEN',
    complete: true,
    boundAddress,
    stoppedAt: null,
    detail: 'The stored wallet was unlocked in this browser, signed a fresh nonce, and recovered to its bound address.',
    refusal: null,
  };
}
