/**
 * Passport-native access — session issuance.
 *
 * PRD-PAG-001 **Amendment A** §A.3.2, increment 3 (ruled + chartered
 * 2026-07-26).
 *
 * ── THE RULING THIS IMPLEMENTS ─────────────────────────────────────────────
 *
 *   Passport / KybeDID  = identity and authority root
 *   Supabase user       = internal application principal record
 *   Supabase session    = application session transport
 *
 * Supabase stays the application-session **compatibility envelope** for this
 * phase. It is no longer the constitutional source of identity: the Passport
 * is. What the citizen never does is create, name, password-protect or sign
 * into that internal record — it is resolved behind the proof.
 *
 * ── WHY THIS NEEDS NO SPINE CHANGE ─────────────────────────────────────────
 *
 * Because the path terminates in an ORDINARY Supabase session, everything
 * downstream is untouched: `getCallerIdentityContext` sees the same Bearer it
 * always saw, `getActivePersona` cannot tell which credential produced it, and
 * `evaluateAccess` is unchanged. That is the whole reason ruling A.3.2 removes
 * protected-file impact (§A.9.1) — and it is also why rollback is safe: a
 * session minted here is indistinguishable from any other, so disabling the
 * feature strands nothing in an unrecognisable format.
 *
 * The planned "second credential kind in `getCallerIdentityContext`" (§A.10.1
 * increment 4) is therefore **not required** and deliberately not built.
 * Adding a second credential path that resolves the same context would be the
 * parallel-implementation defect the spine rules exist to prevent.
 *
 * ── WHAT IS HANDED BACK (selective disclosure, §5) ─────────────────────────
 *
 * A single-use `tokenHash`. Not the email, not the auth user id, not the kybe,
 * not a persona. The browser exchanges it via
 * `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` and receives a
 * normal session. Supabase owns the token's single-use and expiry semantics.
 */

import {
  getSupabaseAdminClient,
  getOrCreateCanonicalAuthProfileId,
} from '@/services/wallet/personaRepo';
import type { PassportPrincipal } from '@/services/identity/passportPrincipal';

export type SessionFailure =
  | 'principal_unresolved'
  | 'session_mint_failed'
  | 'unavailable';

export interface PassportSessionGrant {
  /**
   * Single-use handle the browser exchanges for a session. Carries no identity
   * on its face and is useless without the exchange.
   */
  tokenHash: string;
  /** T2-safe passport facts, safe to render in the connect confirmation. */
  passport: PassportPrincipal['passport'];
}

export type SessionResult =
  | { ok: true; grant: PassportSessionGrant }
  | { ok: false; reason: SessionFailure };

/**
 * Mint an application session for an already-resolved constitutional principal.
 *
 * The caller MUST have completed both prior acts — a consumed holder-control
 * challenge and a `resolvePassportPrincipal` success. This function re-verifies
 * nothing and asserts nothing about control; handing it an unverified principal
 * would mint a session for whoever was named.
 */
export async function issuePassportSession(
  principal: PassportPrincipal,
): Promise<SessionResult> {
  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  // The internal principal record. Reached through the lineage — the address
  // below is read OFF the resolved auth user, never matched TO one.
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(
    principal.authUserId,
  );
  const email = userRes?.user?.email?.trim().toLowerCase() ?? null;
  if (userErr || !email) return { ok: false, reason: 'principal_unresolved' };

  // Ensure the canonical auth profile exists, so the first spine resolution
  // after sign-in finds a profile rather than racing to create one. Best
  // effort: a failure here does not invalidate the proof, and the spine's own
  // find-or-create still runs.
  await getOrCreateCanonicalAuthProfileId(email).catch(() => null);

  // Supabase mints the session credential; we never hand-roll one. `magiclink`
  // requires the user to already exist, which is exactly the guarantee we want
  // — this path must resolve an existing principal, never conjure one.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token ?? null;
  if (linkErr || !tokenHash) return { ok: false, reason: 'session_mint_failed' };

  return { ok: true, grant: { tokenHash, passport: principal.passport } };
}
