/**
 * Passkey enrolment + unlock — holder-control level 2.
 *
 * PRD-PAG-001 Amendment A §A.6 (ratified 2026-07-27, operator:
 * "ratified - build"). WebAuthn was genuinely unbuilt; this module is the
 * server side of both ceremonies (registration and authentication), built on
 * `@simplewebauthn/server` for the FIDO2 parsing/verification and on the
 * EXISTING single-use challenge store for replay safety.
 *
 * The charter's rule, verbatim: "additional passkey enrolment is optional for
 * ordinary access; cryptographic holder-control proof is not optional;
 * step-up is mandatory where consequence requires it."
 *
 * ── SINGLE-USE CHALLENGES (ruling 7 — non-negotiable) ──────────────────────
 *
 * Every WebAuthn ceremony challenge lives in `passport_connection_challenges`
 * and is consumed through `spendChallenge` — the SAME atomic conditional
 * update (`… WHERE consumed_at IS NULL`) the wallet ceremonies use, in the
 * same order: SPEND FIRST, judge the cryptography after. A second nonce store
 * or a read-then-write check would be the parallel-implementation defect
 * (inv.engineering.037). A ceremony's challenge can never be spent on the
 * other ceremony: the spend checks the requested action.
 *
 * ── WHO IS BOUND, AND HOW (T0 discipline) ──────────────────────────────────
 *
 * Enrolment happens on an AUTHENTICATED session: the ROUTE resolves the
 * caller through the canonical spine resolution (`getCallerIdentityContext`)
 * and passes the resolved `authUserId` in — this module never trusts a
 * client-supplied identity. Credentials bind to the auth user (the same
 * anchor `root_identity.auth_user_id` uses). No personaId, authProfileId or
 * rootDid enters any client-bound shape; the WebAuthn user handle is a
 * one-way commitment, mirroring the platform's hashPersonaRef pattern.
 *
 * Unlock (authentication) is PRE-SESSION, like the passport-connect routes:
 * the caller presents only its assertion; the auth user is resolved from the
 * server-side credential row, then walked to an ACTIVE Passport
 * (`resolvePassportPrincipalForAuthUser`) before any session is minted —
 * possession of a passkey is holder-control proof, not constitutional access
 * by itself. The session is the ordinary Supabase envelope via
 * `issuePassportSession` (ruling 4) — no second mint path.
 */

import { createHash } from 'node:crypto';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { issuePasskeyChallenge, spendChallenge } from '@/services/passport/connectionChallenge';
import { resolvePassportPrincipalForAuthUser } from '@/services/identity/passportPrincipal';
import { issuePassportSession, type PassportSessionGrant } from '@/services/identity/passportSession';

const TABLE = 'passport_passkey_credentials';

/**
 * WebAuthn user handle — a one-way commitment, never the auth user id itself.
 * Deterministic so re-enrolment maps to the same handle; irreversible so the
 * handle discloses nothing (the hashPersonaRef pattern).
 */
export function passkeyUserHandle(authUserId: string): string {
  return createHash('sha256').update(`passport:passkey:user:${authUserId}`).digest('hex').slice(0, 32);
}

function rpIdFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** The base64url form of the challenge as it appears in clientDataJSON —
 *  @simplewebauthn encodes a string challenge as base64url(utf8(challenge)). */
function expectedChallengeEncoding(nonce: string): string {
  return Buffer.from(nonce, 'utf8').toString('base64url');
}

/**
 * Recover OUR nonce from the ceremony response's clientDataJSON, so the spend
 * is keyed by what the authenticator actually signed over — the caller never
 * separately names a nonce it could mismatch.
 */
export function challengeNonceFromClientData(clientDataJSON: string): string | null {
  try {
    const parsed = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
      challenge?: unknown;
    };
    if (typeof parsed.challenge !== 'string' || !parsed.challenge) return null;
    return Buffer.from(parsed.challenge, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

// ── Enrolment (authenticated; the route resolves the caller) ───────────────

export type PasskeyFailure =
  | 'challenge_unavailable'
  | 'challenge_rejected' // spend failed — expired, consumed, wrong binding
  | 'verification_failed'
  | 'credential_unknown'
  | 'counter_regression'
  | 'no_constitutional_access'
  | 'session_unavailable'
  | 'unavailable';

export async function beginPasskeyEnrolment(input: {
  /** Resolved SERVER-SIDE by the route via the canonical spine resolution. */
  authUserId: string;
  audience: string;
  origin: string;
}): Promise<
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON; expiresAt: string }
  | { ok: false; reason: PasskeyFailure }
> {
  const rpID = rpIdFromOrigin(input.origin);
  if (!rpID) return { ok: false, reason: 'challenge_unavailable' };

  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const issued = await issuePasskeyChallenge({
    audience: input.audience,
    origin: input.origin,
    action: 'passkey_enrol',
  });
  if (!issued) return { ok: false, reason: 'challenge_unavailable' };

  // Exclude already-enrolled credentials so the authenticator refuses a
  // duplicate registration instead of silently double-binding.
  const { data: existing } = await supabase
    .from(TABLE)
    .select('credential_id, transports')
    .eq('auth_user_id', input.authUserId)
    .is('revoked_at', null);

  const handle = passkeyUserHandle(input.authUserId);
  const options = await generateRegistrationOptions({
    rpName: input.audience,
    rpID,
    userName: `citizen-${handle.slice(0, 8)}`,
    userID: new Uint8Array(Buffer.from(handle, 'utf8')),
    challenge: issued.challenge,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    excludeCredentials: (existing ?? []).map((row) => ({
      id: String((row as { credential_id: string }).credential_id),
      transports: ((row as { transports?: unknown }).transports ?? []) as AuthenticatorTransportFuture[],
    })),
  });

  return { ok: true, options, expiresAt: issued.expiresAt };
}

export async function completePasskeyEnrolment(input: {
  /** Resolved SERVER-SIDE by the route via the canonical spine resolution. */
  authUserId: string;
  response: RegistrationResponseJSON;
  audience: string;
  origin: string;
  friendlyName?: string | null;
}): Promise<{ ok: true; credentialId: string } | { ok: false; reason: PasskeyFailure }> {
  const rpID = rpIdFromOrigin(input.origin);
  if (!rpID) return { ok: false, reason: 'verification_failed' };

  // SPEND FIRST (ruling 7). The nonce is recovered from what the
  // authenticator signed over; a failed verification still costs it.
  const nonce = challengeNonceFromClientData(input.response?.response?.clientDataJSON ?? '');
  if (!nonce) return { ok: false, reason: 'verification_failed' };
  const spend = await spendChallenge({
    nonce,
    audience: input.audience,
    origin: input.origin,
    expectedActions: ['passkey_enrol'],
  });
  if (!spend.ok) {
    return { ok: false, reason: spend.reason === 'unavailable' ? 'unavailable' : 'challenge_rejected' };
  }

  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: expectedChallengeEncoding(nonce),
      expectedOrigin: input.origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return { ok: false, reason: 'verification_failed' };
  }
  if (!verified.verified || !verified.registrationInfo) {
    return { ok: false, reason: 'verification_failed' };
  }

  const { credential, credentialBackedUp } = verified.registrationInfo;

  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const { error } = await supabase.from(TABLE).insert({
    auth_user_id: input.authUserId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    sign_count: credential.counter,
    transports: credential.transports ?? [],
    backed_up: Boolean(credentialBackedUp),
    friendly_name: input.friendlyName?.trim() || null,
  });
  if (error) return { ok: false, reason: 'unavailable' };

  return { ok: true, credentialId: credential.id };
}

/**
 * The caller's OWN active passkey credentials — the DURABLE truth behind the
 * enrolment surface's state (operator ruling, 2026-08-02).
 *
 * WHY THIS EXISTS: the browser reporting
 * `ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED` says only that the
 * AUTHENTICATOR believes it already holds a credential for this relying
 * party. It does not say the platform holds a matching active record — the
 * record may be absent, revoked, bound to a different RP configuration, or
 * left behind by another environment. Treating that browser-side claim as
 * durable success would show "Passkey ready" to a citizen whose next sign-in
 * will fail, which is the same class of lie as fabricating any other state.
 *
 * Enrolment is COMPLETE only when: the registration ceremony succeeded ∩
 * enrol-verify succeeded ∩ this reread confirms an active credential bound
 * to the current principal.
 *
 * Returns metadata only. The stored `public_key` and `credential_id` are
 * never serialised — a credential id is a stable per-RP handle, and the
 * count plus timestamps are all a UI needs to render truthfully.
 */
export async function listActivePasskeyCredentials(
  authUserId: string,
): Promise<
  | { ok: true; credentials: Array<{ friendlyName: string | null; createdAt: string; lastUsedAt: string | null; backedUp: boolean }> }
  | { ok: false; reason: 'unavailable' }
> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const { data, error } = await supabase
    .from(TABLE)
    .select('friendly_name, created_at, last_used_at, backed_up, revoked_at')
    .eq('auth_user_id', authUserId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  // UNKNOWN, never "you have none" — a store failure must not render as an
  // absent credential and send a citizen to re-enrol needlessly.
  if (error) return { ok: false, reason: 'unavailable' };

  return {
    ok: true,
    credentials: (data ?? []).map((r) => ({
      friendlyName: (r as { friendly_name: string | null }).friendly_name ?? null,
      createdAt: String((r as { created_at: string }).created_at),
      lastUsedAt: (r as { last_used_at: string | null }).last_used_at ?? null,
      backedUp: Boolean((r as { backed_up: boolean }).backed_up),
    })),
  };
}

// ── Unlock (pre-session, like passport-connect) ────────────────────────────

export async function beginPasskeyAuthentication(input: {
  audience: string;
  origin: string;
}): Promise<
  | { ok: true; options: PublicKeyCredentialRequestOptionsJSON; expiresAt: string }
  | { ok: false; reason: PasskeyFailure }
> {
  const rpID = rpIdFromOrigin(input.origin);
  if (!rpID) return { ok: false, reason: 'challenge_unavailable' };

  const issued = await issuePasskeyChallenge({
    audience: input.audience,
    origin: input.origin,
    action: 'passkey_auth',
  });
  if (!issued) return { ok: false, reason: 'challenge_unavailable' };

  // Empty allowCredentials: discoverable credentials — the browser offers the
  // holder their own passkeys. Never a server-side list keyed by a
  // caller-claimed identity: a pre-session caller has none to claim
  // (ruling 8), and enumerating credential ids for a claimed account would
  // let anyone probe who has enrolled.
  const options = await generateAuthenticationOptions({
    rpID,
    challenge: issued.challenge,
    userVerification: 'required',
    allowCredentials: [],
  });

  return { ok: true, options, expiresAt: issued.expiresAt };
}

export async function completePasskeyAuthentication(input: {
  response: AuthenticationResponseJSON;
  audience: string;
  origin: string;
}): Promise<{ ok: true; grant: PassportSessionGrant } | { ok: false; reason: PasskeyFailure }> {
  const rpID = rpIdFromOrigin(input.origin);
  if (!rpID) return { ok: false, reason: 'verification_failed' };

  // SPEND FIRST (ruling 7), before any credential lookup or verification.
  const nonce = challengeNonceFromClientData(input.response?.response?.clientDataJSON ?? '');
  if (!nonce) return { ok: false, reason: 'verification_failed' };
  const spend = await spendChallenge({
    nonce,
    audience: input.audience,
    origin: input.origin,
    expectedActions: ['passkey_auth'],
  });
  if (!spend.ok) {
    return { ok: false, reason: spend.reason === 'unavailable' ? 'unavailable' : 'challenge_rejected' };
  }

  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const { data: row, error: rowErr } = await supabase
    .from(TABLE)
    .select('id, auth_user_id, credential_id, public_key, sign_count, transports')
    .eq('credential_id', input.response.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (rowErr) return { ok: false, reason: 'unavailable' };
  if (!row) return { ok: false, reason: 'credential_unknown' };

  const storedCounter = Number((row as { sign_count?: unknown }).sign_count ?? 0);

  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: expectedChallengeEncoding(nonce),
      expectedOrigin: input.origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: String((row as { credential_id: string }).credential_id),
        publicKey: new Uint8Array(
          Buffer.from(String((row as { public_key: string }).public_key), 'base64url'),
        ),
        counter: storedCounter,
        transports: ((row as { transports?: unknown }).transports ?? []) as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return { ok: false, reason: 'verification_failed' };
  }
  if (!verified.verified) return { ok: false, reason: 'verification_failed' };

  // Cloned-authenticator signal: a counter that fails to advance past a
  // previously seen non-zero value. The library refuses regressions; this
  // records the advance so the NEXT regression is caught.
  const newCounter = verified.authenticationInfo.newCounter;
  await supabase
    .from(TABLE)
    .update({ sign_count: newCounter, last_used_at: new Date().toISOString() })
    .eq('id', (row as { id: string }).id);

  // Holder-control proven. Now the CONSTITUTIONAL half: the credential's auth
  // user must still walk to an ACTIVE Passport, or no session is minted.
  const principal = await resolvePassportPrincipalForAuthUser(
    String((row as { auth_user_id: string }).auth_user_id),
  );
  if (!principal.ok) {
    return {
      ok: false,
      reason: principal.reason === 'unavailable' ? 'unavailable' : 'no_constitutional_access',
    };
  }

  // The one session mint (ruling 4) — the ordinary Supabase envelope.
  const session = await issuePassportSession(principal.principal);
  if (!session.ok) return { ok: false, reason: 'session_unavailable' };

  return { ok: true, grant: session.grant };
}
