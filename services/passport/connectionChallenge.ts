/**
 * Passport-native access — the single-use holder-control challenge.
 *
 * PRD-PAG-001 **Amendment A** §A.4 / §A.9.2 (ruled + ratified 2026-07-26).
 *
 * ── WHAT THIS CLOSES ───────────────────────────────────────────────────────
 *
 * The platform already has a SIWE-shaped challenge builder and an EVM
 * signature verifier (`services/identity/walletAliasService.ts`), and this
 * module reuses them rather than forking a second crypto path. What was
 * missing is **consumption**. `app/api/identity/wallet-alias/challenge`
 * states it outright: *"Nonces are stateless — they're embedded in the
 * message."* Nothing marks one spent.
 *
 * That is fine for wallet-alias binding, which re-validates persona ownership
 * at register time. It is not fine for **session establishment**, where a
 * replayed signature would mint a second session. Ruling 7 makes server-side
 * single-use consumption a prerequisite.
 *
 * ── THE PRE-SESSION LAW (ruling 8) ─────────────────────────────────────────
 *
 * **No function here may accept or return `personaId`, `authProfileId` or
 * `didPersonaId`.** A caller at challenge time has no session and cannot
 * present any of them; asking for one would rebuild the exact circular
 * dependency Amendment A exists to remove — *do not require an account session
 * in order to prove the Passport that is intended to establish the account
 * session.* The caller is named only by an opaque `provisionalConnectionId`.
 * Personhood and persona are resolved **after** holder proof succeeds.
 *
 * Note the existing `buildOwnershipChallenge` is deliberately NOT reused for
 * the message body: it embeds a `didPersonaId`, which a pre-session caller does
 * not have. `buildConnectionChallengeMessage` below is its persona-free
 * sibling. Verification RECOVERS the signer (`ethers.verifyMessage`, the same
 * primitive `verifyEvmOwnership` wraps) rather than comparing against a claimed
 * address, because a pre-session caller's address hint is untrusted input.
 *
 * ── SINGLE USE IS A DATABASE GUARANTEE, NOT AN APPLICATION ONE ─────────────
 *
 * Consumption is one conditional UPDATE (`… WHERE id = $1 AND consumed_at IS
 * NULL RETURNING *`). Never read-then-write: two proofs racing the same nonce
 * would both pass a read check and both mint a session. Postgres row locking
 * settles it — exactly one UPDATE returns a row, every other returns none.
 */

import crypto from 'node:crypto';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { verifyMessage } from 'ethers';

import { normaliseAddress } from '@/services/identity/walletAliasService';

const TABLE = 'passport_connection_challenges';

/** Short by design — a holder-control proof is an interactive act, not a grant. */
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;

export type RequestedAction = 'connect' | 'step_up';

export interface IssuedChallenge {
  /** The raw nonce. Returned ONCE and never stored — only its hash persists. */
  nonce: string;
  /** The exact string the wallet must sign. */
  message: string;
  /** Opaque pre-session handle for this connection attempt. Not an identity. */
  provisionalConnectionId: string;
  audience: string;
  origin: string;
  requestedAction: RequestedAction;
  expiresAt: string;
}

export interface IssueChallengeInput {
  audience: string;
  origin: string;
  requestedAction?: RequestedAction;
  /** Optional hint. The authority is always the RECOVERED signer, never this. */
  walletAddress?: string;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * The message a pre-session caller signs.
 *
 * Persona-free by construction (ruling 8) and explicit about who is asking, so
 * a human reading their wallet prompt can see the application and origin the
 * signature will be valid for — and only for.
 */
export function buildConnectionChallengeMessage(input: {
  audience: string;
  origin: string;
  nonce: string;
  requestedAction: RequestedAction;
  expiresAt: string;
}): string {
  return [
    `${input.origin} wants you to prove control of this wallet.`,
    '',
    input.requestedAction === 'step_up'
      ? 'Purpose: authorise a consequential action (step-up).'
      : 'Purpose: connect with your Polity Passport.',
    `Application: ${input.audience}`,
    `Origin: ${input.origin}`,
    `Nonce: ${input.nonce}`,
    `Expires: ${input.expiresAt}`,
    '',
    'Signing proves you control this wallet. It does not transfer anything.',
  ].join('\n');
}

/**
 * Mint a challenge. Fails CLOSED — a store that is unavailable yields null and
 * the caller must refuse the connection, never fall back to an unconsumed
 * nonce.
 */
export async function issueConnectionChallenge(
  input: IssueChallengeInput,
): Promise<IssuedChallenge | null> {
  const audience = input.audience.trim();
  const origin = input.origin.trim();
  if (!audience || !origin) return null;

  const requestedAction: RequestedAction = input.requestedAction ?? 'connect';
  const nonce = crypto.randomBytes(32).toString('hex');
  const provisionalConnectionId = `pcx_${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  let walletAddress: string | null = null;
  if (input.walletAddress) {
    try {
      walletAddress = normaliseAddress('evm', input.walletAddress);
    } catch {
      return null; // A malformed address is a client error, not a challenge.
    }
  }

  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { error } = await supabase.from(TABLE).insert({
    nonce_hash: sha256(nonce),
    provisional_connection_id: provisionalConnectionId,
    audience,
    origin,
    requested_action: requestedAction,
    wallet_address: walletAddress,
    expires_at: expiresAt,
  });
  if (error) return null;

  return {
    nonce,
    message: buildConnectionChallengeMessage({
      audience,
      origin,
      nonce,
      requestedAction,
      expiresAt,
    }),
    provisionalConnectionId,
    audience,
    origin,
    requestedAction,
    expiresAt,
  };
}

export type ProofFailure =
  | 'unknown_challenge'
  | 'already_consumed'
  | 'expired'
  | 'audience_mismatch'
  | 'origin_mismatch'
  | 'bad_signature'
  | 'unavailable';

export type ProofResult =
  | {
      ok: true;
      /** The RECOVERED signer — the only wallet identity this module asserts. */
      walletAddress: string;
      provisionalConnectionId: string;
      audience: string;
      origin: string;
      requestedAction: RequestedAction;
    }
  | { ok: false; reason: ProofFailure };

/**
 * Verify a holder-control proof and spend the challenge.
 *
 * ORDER MATTERS. The challenge is consumed **before** the signature is checked.
 * A nonce offered to a signature check is spent whether or not the signature is
 * good — otherwise a bad-signature attempt would leave it live, and an attacker
 * could grind signatures against one nonce until something verified. One
 * presentation, one nonce, regardless of outcome.
 */
export async function verifyConnectionProof(input: {
  nonce: string;
  message: string;
  signature: string;
  audience: string;
  origin: string;
}): Promise<ProofResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const nonceHash = sha256(input.nonce);

  const { data: row, error: readErr } = await supabase
    .from(TABLE)
    .select(
      'id, provisional_connection_id, audience, origin, requested_action, expires_at, consumed_at',
    )
    .eq('nonce_hash', nonceHash)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'unavailable' };
  if (!row) return { ok: false, reason: 'unknown_challenge' };
  if (row.consumed_at) return { ok: false, reason: 'already_consumed' };

  // THE ATOMIC SPEND. Conditional update, never read-then-write: two proofs
  // racing one nonce would both pass the read above, and both would mint a
  // session. Exactly one UPDATE can match `consumed_at IS NULL`.
  const { data: spent, error: spendErr } = await supabase
    .from(TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (spendErr) return { ok: false, reason: 'unavailable' };
  if (!spent) return { ok: false, reason: 'already_consumed' };

  // Everything below runs against a nonce that is now spent. Order is
  // deliberate: expiry and binding are checked after the spend so a rejected
  // attempt cannot leave a reusable challenge behind.
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  if (row.audience !== input.audience.trim()) {
    return { ok: false, reason: 'audience_mismatch' };
  }
  if (row.origin !== input.origin.trim()) {
    return { ok: false, reason: 'origin_mismatch' };
  }
  // The signed message must be the one that carried this nonce — otherwise a
  // signature over an attacker-chosen message would satisfy the check.
  if (!input.message.includes(`Nonce: ${input.nonce}`)) {
    return { ok: false, reason: 'bad_signature' };
  }

  // Recover the signer rather than compare against a claimed address: a
  // pre-session caller's `walletAddress` hint is untrusted input, so the
  // authority has to be whoever actually signed. Same `ethers.verifyMessage`
  // primitive `verifyEvmOwnership` uses — one signature path, not two.
  let recovered: string;
  try {
    recovered = normaliseAddress('evm', verifyMessage(input.message, input.signature));
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }

  return {
    ok: true,
    walletAddress: recovered,
    provisionalConnectionId: row.provisional_connection_id,
    audience: row.audience,
    origin: row.origin,
    requestedAction: row.requested_action as RequestedAction,
  };
}
