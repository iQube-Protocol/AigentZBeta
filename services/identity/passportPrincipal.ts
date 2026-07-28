/**
 * Passport-native access — the reverse personhood walk and the pre-session
 * principal resolver.
 *
 * PRD-PAG-001 **Amendment A** §A.3.1 / §A.3.2, increments 2 + 3
 * (ruled + chartered 2026-07-26).
 *
 * ── THE WALK ───────────────────────────────────────────────────────────────
 *
 * `personhoodResolver.ts` already walks the DidQube chain in the
 * session→personhood direction, and documents the fact this module depends on:
 * *"THE PASSPORT IS KYBE-DRIVEN: it belongs to the person, a level BENEATH
 * persona."* Passport-native access is the SAME chain walked in reverse, from a
 * wallet the caller has just proven control of:
 *
 *   proven wallet
 *     → wallet_alias_commitments (active, by address fingerprint)
 *        → root_identity
 *           → root_identity.kybe_id  ............ canonical personhood (the binding key)
 *              → every root under that kybe
 *                 → auth_user_id  ............... the internal Supabase principal
 *              → polity_passport_records(kybe_identity_id)  ... the Passport
 *
 * No new binding table: `root_identity.auth_user_id` is commented in migration
 * 20260427000000 as *"Supabase auth.users id — canonical link between auth
 * session and root DID"*, and is indexed.
 *
 * ── WHAT THIS MODULE MAY NOT DO (ruling 8) ─────────────────────────────────
 *
 * It is entered BEFORE a session exists, so it may never accept `personaId`,
 * `authProfileId` or `didPersonaId` as INPUT — a caller cannot present what it
 * has no session to hold. It resolves them; it never requires them.
 *
 * ── BINDING IS BY LINEAGE, NEVER BY EMAIL (ruling 3) ────────────────────────
 *
 * The binding key is the **kybe**. The auth user is reached only by walking the
 * lineage. An email is read off that already-linked auth user solely to address
 * the canonical auth-profile helper — the caller never supplies one, and no
 * lookup anywhere here matches on a caller-supplied email, display name, wallet
 * address or persona id. "Never merge on matching email" holds.
 *
 * ── FAIL CLOSED, EVERY BRANCH ──────────────────────────────────────────────
 *
 * Every failure returns a NAMED reason and no principal. There is no partial
 * success and no fallback that widens: a resolution this module cannot complete
 * with certainty must not produce a session.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  buildAddressFingerprint,
  normaliseAddress,
  type WalletChain,
} from '@/services/identity/walletAliasService';
import { verifyWorldIdProof, type WorldIdProofPayload } from '@/services/passport/personhoodProof';

/** T2-safe passport facts — the same field discipline as passportCredential.ts. */
export interface PassportSnapshot {
  passportClass: string | null;
  citizenStatus: string | null;
  participantStatus: string | null;
  passportGrade: string | null;
  revoked: boolean;
  expiresAt: string | null;
}

/**
 * The resolved constitutional principal. **T0 throughout** — every field here
 * is server-internal and must never be serialised to a browser or a receipt.
 */
export interface PassportPrincipal {
  /** Canonical personhood. THE binding key. */
  kybeId: string;
  /** The root the proven wallet hangs off. */
  rootIdentityId: string;
  /** The internal Supabase principal reached through the lineage. */
  authUserId: string;
  passport: PassportSnapshot;
}

export type PrincipalFailure =
  | 'wallet_unknown' // no active alias — this wallet is bound to no lineage
  | 'lineage_incomplete' // alias present but the kybe chain does not resolve
  | 'no_passport' // personhood resolves, but holds no Passport
  | 'passport_inactive' // Passport exists but is revoked / expired / not active
  | 'principal_unprovisioned' // lineage has no auth user — see the note below
  | 'unavailable';

export type PrincipalResult =
  | { ok: true; principal: PassportPrincipal }
  | { ok: false; reason: PrincipalFailure };

/**
 * A Passport is usable for access only while it is genuinely active.
 * Deliberately strict: an unrecognised status is NOT active.
 */
export function isPassportUsable(p: PassportSnapshot): boolean {
  if (p.revoked) return false;
  if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) return false;
  return p.citizenStatus === 'active' || p.participantStatus === 'active';
}

/**
 * Resolve the constitutional principal behind a wallet the caller has ALREADY
 * proven control of.
 *
 * The caller must have a successful `verifyConnectionProof` result in hand —
 * this function does no signature work and asserts nothing about control. Pass
 * the RECOVERED signer, never a caller-supplied address.
 */
export async function resolvePassportPrincipal(
  provenWalletAddress: string,
  chain: WalletChain = 'evm',
): Promise<PrincipalResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  let fingerprint: string;
  try {
    fingerprint = buildAddressFingerprint(chain, normaliseAddress(chain, provenWalletAddress));
  } catch {
    return { ok: false, reason: 'wallet_unknown' };
  }

  // 1. Proven wallet → root identity. ACTIVE aliases only: a revoked or expired
  //    binding must not carry access, or revocation would be cosmetic.
  const { data: aliasRows, error: aliasErr } = await supabase
    .from('wallet_alias_commitments')
    .select('root_identity_id')
    .eq('address_fingerprint', fingerprint)
    .eq('status', 'active')
    .limit(2);
  if (aliasErr) return { ok: false, reason: 'unavailable' };
  const rootIds = (aliasRows ?? [])
    .map((r) => (r as { root_identity_id?: string }).root_identity_id)
    .filter((v): v is string => Boolean(v));
  if (rootIds.length === 0) return { ok: false, reason: 'wallet_unknown' };
  // A wallet bound under two live roots is ambiguous. Refusing is the only safe
  // answer — picking one would silently choose whose session to mint.
  if (new Set(rootIds).size > 1) return { ok: false, reason: 'lineage_incomplete' };
  const rootIdentityId = rootIds[0];

  // 2. Root → kybe. This is the canonical personhood and the binding key.
  const { data: rootRow, error: rootErr } = await supabase
    .from('root_identity')
    .select('id, kybe_id, auth_user_id')
    .eq('id', rootIdentityId)
    .maybeSingle();
  if (rootErr) return { ok: false, reason: 'unavailable' };
  const kybeId = (rootRow as { kybe_id?: string } | null)?.kybe_id;
  if (!kybeId) return { ok: false, reason: 'lineage_incomplete' };

  // 3. Every root under that kybe → the internal Supabase principal. Walked
  //    kybe-wide rather than off the single root so a citizen whose wallet
  //    hangs off a later root still resolves to the one person's principal.
  const authUserResult = await resolveAuthUserForKybe(supabase, kybeId);
  if (!authUserResult.ok) return authUserResult;
  const authUserId = authUserResult.authUserId;

  // 4. Personhood → Passport. Keyed by kybe, never by persona or wallet.
  const passportResult = await loadUsablePassportByKybe(supabase, kybeId);
  if (!passportResult.ok) return passportResult;

  return {
    ok: true,
    principal: { kybeId, rootIdentityId, authUserId, passport: passportResult.passport },
  };
}

/**
 * Resolve the constitutional principal from a LIVE World ID proof — the
 * "present Passport" act (PRD-PAG-001 Amendment A, first-connection closure,
 * operator ruling 2026-07-28, ruling 1). This is the ONLY entry point that
 * resolves a principal with NO existing wallet_alias_commitments row: a
 * fresh, server-verified World ID proof identifies a UNIQUE human
 * independently of any wallet, and `world_id_nullifier_hash` (unique-indexed
 * on `polity_passport_records`) is the reverse-lookup key from that human
 * back to their Passport lineage — the same shape as `address_fingerprint`
 * for wallets, but for personhood.
 *
 * Deliberately requires STRONG proof only (§A.6 level 3: "step-up is
 * mandatory where consequence requires it"). Establishing a brand-new
 * wallet↔personhood binding from zero prior authenticated context is exactly
 * that kind of consequential act — a citizen whose Passport carries only
 * weak (captcha) proof cannot use this path; they still have the
 * already-shipped bind-while-signed-in route (Amendment B) once ratified for
 * execution.
 */
export async function resolvePassportPrincipalByWorldId(
  worldIdProof: WorldIdProofPayload,
): Promise<PrincipalResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const verification = await verifyWorldIdProof(worldIdProof);
  if (!verification.ok) return { ok: false, reason: 'no_passport' };

  const { data: passportRow, error: ppErr } = await supabase
    .from('polity_passport_records')
    .select(
      'kybe_identity_id, passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at',
    )
    .eq('world_id_nullifier_hash', worldIdProof.nullifier_hash)
    .maybeSingle();
  if (ppErr) return { ok: false, reason: 'unavailable' };
  if (!passportRow) return { ok: false, reason: 'no_passport' };

  const row = passportRow as Record<string, unknown>;
  const kybeId = row.kybe_identity_id as string | null;
  if (!kybeId) return { ok: false, reason: 'lineage_incomplete' };

  const passport: PassportSnapshot = {
    passportClass: (row.passport_class as string) ?? null,
    citizenStatus: (row.citizen_status as string) ?? null,
    participantStatus: (row.participant_status as string) ?? null,
    passportGrade: (row.passport_grade as string) ?? null,
    revoked: Boolean(row.revoked),
    expiresAt: (row.expires_at as string) ?? null,
  };
  if (!isPassportUsable(passport)) return { ok: false, reason: 'passport_inactive' };

  // Kybe → an active root under it, for the binding step that follows
  // (services/identity/walletAliasService.ts's establishWalletBindingForRoot
  // needs a specific root_identity_id, not just the kybe). Prefer a root that
  // already has an auth user; two live roots with the SAME kybe but
  // DIFFERENT auth users is the consolidation ambiguity (§A.5) — refuse
  // rather than choose, same posture as the wallet walk.
  const authUserResult = await resolveAuthUserForKybe(supabase, kybeId);
  if (!authUserResult.ok) return authUserResult;

  const { data: rootRow, error: rootErr } = await supabase
    .from('root_identity')
    .select('id')
    .eq('kybe_id', kybeId)
    .eq('auth_user_id', authUserResult.authUserId)
    .limit(1)
    .maybeSingle();
  if (rootErr) return { ok: false, reason: 'unavailable' };
  const rootIdentityId = (rootRow as { id?: string } | null)?.id;
  if (!rootIdentityId) return { ok: false, reason: 'lineage_incomplete' };

  return {
    ok: true,
    principal: { kybeId, rootIdentityId, authUserId: authUserResult.authUserId, passport },
  };
}

/**
 * The kybe → sibling roots → single auth user walk, shared by the wallet
 * entry point and the World ID entry point (inv.engineering.036 — one
 * authoritative location, not two copies that could drift).
 */
async function resolveAuthUserForKybe(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  kybeId: string,
): Promise<{ ok: true; authUserId: string } | { ok: false; reason: PrincipalFailure }> {
  const { data: siblingRoots, error: sibErr } = await supabase
    .from('root_identity')
    .select('auth_user_id')
    .eq('kybe_id', kybeId);
  if (sibErr) return { ok: false, reason: 'unavailable' };
  const authUserIds = [
    ...new Set(
      (siblingRoots ?? [])
        .map((r) => (r as { auth_user_id?: string }).auth_user_id)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  if (authUserIds.length === 0) {
    // NOT a defect, and NOT something to paper over by minting an identifier.
    //
    // Every Passport issued through the Bureau today is anchored to an auth
    // user (`bureauIdentityService.ts` — "find-or-create root_identity by
    // auth_user_id"), so this branch is unreachable for existing Passports. It
    // becomes reachable only once ISSUANCE can mint an account-less lineage,
    // which Amendment A §8 puts explicitly out of scope. Fail honestly here
    // rather than invent a synthetic principal.
    return { ok: false, reason: 'principal_unprovisioned' };
  }
  if (authUserIds.length > 1) {
    // Two auth users under one personhood is precisely what Passport
    // consolidation (§A.5) exists to reconcile. Until it ships, refuse rather
    // than choose.
    return { ok: false, reason: 'lineage_incomplete' };
  }
  return { ok: true, authUserId: authUserIds[0] };
}

/**
 * Resolve the constitutional principal behind an auth user a caller has
 * ALREADY authenticated cryptographically — the passkey unlock path (§A.6
 * level 2). Same chain, entered one link later: the credential store binds
 * passkey → auth user, and this walks auth user → root → kybe → Passport so
 * a passkey unlock still refuses without an ACTIVE Passport, exactly like the
 * wallet path.
 *
 * The caller must have a verified WebAuthn assertion in hand
 * (`completePasskeyAuthentication`) — this function does no signature work.
 * The auth user id comes from the server-side credential row, never from the
 * caller (ruling 8 stays intact: the pre-session caller supplies only its
 * assertion).
 */
export async function resolvePassportPrincipalForAuthUser(
  authUserId: string,
): Promise<PrincipalResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  // 1. Auth user → roots → kybe. One personhood or refusal: two kybes under
  //    one auth user is the consolidation problem (§A.5) — refuse rather than
  //    choose, the same posture as the wallet walk.
  const { data: rootRows, error: rootErr } = await supabase
    .from('root_identity')
    .select('id, kybe_id')
    .eq('auth_user_id', authUserId);
  if (rootErr) return { ok: false, reason: 'unavailable' };
  const roots = (rootRows ?? []) as Array<{ id?: string; kybe_id?: string }>;
  const kybeIds = [...new Set(roots.map((r) => r.kybe_id).filter((v): v is string => Boolean(v)))];
  if (kybeIds.length === 0) return { ok: false, reason: 'lineage_incomplete' };
  if (kybeIds.length > 1) return { ok: false, reason: 'lineage_incomplete' };
  const kybeId = kybeIds[0];
  const rootIdentityId = String(roots.find((r) => r.kybe_id === kybeId)?.id ?? '');
  if (!rootIdentityId) return { ok: false, reason: 'lineage_incomplete' };

  // 2. Personhood → Passport — the same lookup the wallet walk ends in.
  const passportResult = await loadUsablePassportByKybe(supabase, kybeId);
  if (!passportResult.ok) return passportResult;

  return {
    ok: true,
    principal: { kybeId, rootIdentityId, authUserId, passport: passportResult.passport },
  };
}

/**
 * The one passport-by-personhood lookup both entry points end in. Exported
 * so /api/passport-connect/finalize can RE-DERIVE the current passport state
 * at session-mint time (rather than trust a snapshot taken a few minutes
 * earlier at proof time) — defense in depth against a revocation landing
 * inside the pending-auth transaction's short window.
 */
export async function loadUsablePassportByKybe(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  kybeId: string,
): Promise<{ ok: true; passport: PassportSnapshot } | { ok: false; reason: PrincipalFailure }> {
  const { data: passportRow, error: ppErr } = await supabase
    .from('polity_passport_records')
    .select('passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at')
    .eq('kybe_identity_id', kybeId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ppErr) return { ok: false, reason: 'unavailable' };
  if (!passportRow) return { ok: false, reason: 'no_passport' };

  const row = passportRow as Record<string, unknown>;
  const passport: PassportSnapshot = {
    passportClass: (row.passport_class as string) ?? null,
    citizenStatus: (row.citizen_status as string) ?? null,
    participantStatus: (row.participant_status as string) ?? null,
    passportGrade: (row.passport_grade as string) ?? null,
    revoked: Boolean(row.revoked),
    expiresAt: (row.expires_at as string) ?? null,
  };
  if (!isPassportUsable(passport)) return { ok: false, reason: 'passport_inactive' };
  return { ok: true, passport };
}
