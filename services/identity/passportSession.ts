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
 * `supabase.auth.verifyOtp({ token_hash, type: 'email' })` and receives a
 * normal session. Supabase owns the token's single-use and expiry semantics.
 *
 * NOTE: the `hashed_token` here is minted via `generateLink({ type:
 * 'magiclink' })` (below) — that generateLink type is correct and unrelated
 * to verifyOtp's type. verifyOtp itself must use 'email', not 'magiclink':
 * Supabase Auth's /verify endpoint resolves a magiclink-generated token_hash
 * under the unified 'email' OTP type; 'magiclink' is generateLink()-only and
 * is rejected by /verify. Confirmed against Supabase's current passwordless
 * email-login docs (2026-08-21 Passport sign-in repair).
 *
 * ── ONE GRANT PER CALL — SEQUENTIAL, NEVER SIMULTANEOUS (P0.2, 2026-08-21) ──
 *
 * This function used to mint TWO `generateLink({ type: 'magiclink' })` grants
 * back-to-back for the SAME email — one for `tokenHash`, one for a second
 * `handoffTokenHash` — and returned both. Live evidence (Supabase Auth logs +
 * direct inspection of `auth.one_time_tokens`/`auth.users` on the connected
 * project) proved this was never safe: a `magiclink` grant for an EXISTING
 * user materializes in this project's GoTrue as a single-slot `recovery_token`
 * column on `auth.users`, not an append-only store. The second call
 * overwrote the first's token before this function even returned the grant,
 * so `tokenHash` was dead on arrival every single time — 100% of `/verify`
 * attempts in the live session under test failed with
 * `otp_expired` / "One-time token not found", never intermittently.
 *
 * The fix is architectural, not a type change: this function now mints
 * exactly ONE grant. A second, application-world grant is still needed (the
 * Companion iframe and the top-level app are separate storage partitions —
 * see `PassportSessionGrant`'s header, unchanged), but it is minted
 * SEQUENTIALLY, only after the first grant is actually redeemed, by
 * `POST /api/passport-connect/handoff-grant` — which itself calls this SAME
 * function again, from the caller's own freshly-established Supabase Bearer
 * session, never from a second call made before the first was consumed.
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
   *
   * THE PARTITION GAP STILL EXISTS (operator report 2026-07-26): the
   * Companion is an iframe inside the extension's side panel, and the
   * browser PARTITIONS third-party iframe storage — a session established
   * inside the Companion never reaches the top-level application tabs. That
   * still requires a SECOND grant for the application-world handoff. What
   * changed (P0.2, 2026-08-21) is WHEN and HOW that second grant is minted:
   * never here, never before this one is redeemed — see
   * `POST /api/passport-connect/handoff-grant`.
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
  //
  // EXACTLY ONE CALL (P0.2, 2026-08-21 — see this file's header). A second
  // `generateLink` call for the same email before this one is redeemed
  // overwrites it in this project's live GoTrue — do not add one here. A
  // caller that needs a second, application-world grant must request it
  // AFTER redeeming this one, via `POST /api/passport-connect/handoff-grant`
  // (which calls this same function again, sequentially).
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token ?? null;
  if (linkErr || !tokenHash) return { ok: false, reason: 'session_mint_failed' };

  return { ok: true, grant: { tokenHash, passport: principal.passport } };
}
