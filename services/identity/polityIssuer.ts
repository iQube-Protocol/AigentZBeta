/**
 * Polity Passport Bureau — cryptographic issuer.
 *
 * The Bureau issues attestations (AgentKit delegation grants, ProveKit
 * proof commitments, passport credential proofs) signed with an EIP-191
 * signature from POLITY_ISSUER_PRIVATE_KEY. Anyone — including external
 * counsel, immigration partners, or judges — can verify these signatures
 * against POLITY_ISSUER_ADDRESS without holding any shared secret.
 *
 * This replaces the HMAC stub pattern in agentKitBridge.ts and
 * provekit/index.ts with real public-key cryptography. The signature
 * scheme is the standard Ethereum `personal_sign` (EIP-191) which any
 * EVM tooling can verify.
 *
 * Operator setup (production):
 *   1. Generate a fresh secp256k1 keypair:
 *        node -e "console.log(require('viem/accounts').generatePrivateKey())"
 *   2. Set POLITY_ISSUER_PRIVATE_KEY=0x<64-hex> in Amplify (server-only).
 *   3. The corresponding address is exposed at GET /api/polity-passport/issuer
 *      so verifiers know which key to check against.
 *
 * Dev fallback: when POLITY_ISSUER_PRIVATE_KEY is unset, the module
 * generates a deterministic key from the constant 'polity-dev-issuer-v0'.
 * Tokens produced in dev still verify cryptographically — they just
 * don't carry a stable production identity.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toBytes, verifyMessage, type Address, type Hex } from 'viem';

let cachedAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getIssuerAccount() {
  if (cachedAccount) return cachedAccount;
  const envKey = process.env.POLITY_ISSUER_PRIVATE_KEY;
  let key: Hex;
  if (envKey && envKey.startsWith('0x') && envKey.length === 66) {
    key = envKey as Hex;
  } else {
    // Dev-mode deterministic key. NOT for production — the corresponding
    // address is fixed and any party who can read this source can also
    // sign tokens with the same identity.
    const seed = keccak256(toBytes('polity-dev-issuer-v0'));
    key = seed as Hex;
  }
  cachedAccount = privateKeyToAccount(key);
  return cachedAccount;
}

export function getIssuerAddress(): Address {
  return getIssuerAccount().address;
}

export function isProductionIssuer(): boolean {
  return Boolean(process.env.POLITY_ISSUER_PRIVATE_KEY);
}

/**
 * Sign a canonical JSON payload with the Polity issuer key (EIP-191).
 * Returns a base64-encoded `<payload>.<sig>` token. Anyone can verify
 * with verifyIssuerToken() — no shared secret required.
 */
export async function signIssuerToken(payload: Record<string, unknown>): Promise<string> {
  const account = getIssuerAccount();
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  const signature = await account.signMessage({ message: encoded });
  return `${encoded}.${signature}`;
}

/**
 * Verify a token issued by signIssuerToken. Returns the decoded payload
 * on success, or null on signature mismatch / malformed token.
 *
 * For demos and external verifiers: this function can also accept the
 * expected issuer address as an override (in case the verifier is
 * checking a token from a different polity).
 */
export async function verifyIssuerToken(
  token: string,
  expectedIssuer?: Address,
): Promise<{ valid: boolean; payload: Record<string, unknown> | null; issuer: Address; error?: string }> {
  const issuer = expectedIssuer ?? getIssuerAddress();
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, payload: null, issuer, error: 'Malformed token' };
  }
  const lastDot = token.lastIndexOf('.');
  const encoded = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1) as Hex;
  if (!signature.startsWith('0x')) {
    return { valid: false, payload: null, issuer, error: 'Malformed signature' };
  }
  try {
    const ok = await verifyMessage({
      address: issuer,
      message: encoded,
      signature,
    });
    if (!ok) return { valid: false, payload: null, issuer, error: 'Signature mismatch' };
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
    return { valid: true, payload, issuer };
  } catch (e) {
    return {
      valid: false,
      payload: null,
      issuer,
      error: e instanceof Error ? e.message : 'Verification failed',
    };
  }
}
