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
 * Resolve the constitutional principal from an EXISTING Passport id — the
 * caller already has a `passport_id` in hand (e.g. a recorded
 * `sponsor_passport_id` on some other row) and needs its principal root, with
 * no live wallet proof or WorldID session available. Same walk as the other
 * two entry points (Passport → kybe → every sibling root → single auth
 * user), entered one link later because the Passport is already identified
 * by id rather than discovered via wallet fingerprint or WorldID nullifier
 * hash. Generic at the personhood layer — for anything holding a passport_id
 * that needs its principal, not specific to any one delegate or agent
 * (added for the Chrysalis Homecoming delegation-anchor repair,
 * operator-directed 2026-08-15, but not delegate-specific in any way).
 */
export async function resolvePassportPrincipalById(passportId: string): Promise<PrincipalResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const { data: passportRow, error: ppErr } = await supabase
    .from('polity_passport_records')
    .select(
      'kybe_identity_id, passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at',
    )
    .eq('passport_id', passportId)
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

  // Kybe → every sibling root under it → the single internal Supabase
  // principal. Refuses on zero or ambiguous (>1) auth users — the SAME
  // disambiguation rule the wallet and WorldID entry points use, not a
  // re-derived copy.
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

export type ExplicitAnchorFailure =
  | 'no_passport'
  | 'anchor_incomplete' // root_identity_id or kybe_identity_id is null
  | 'root_not_found'
  | 'kybe_mismatch' // the referenced root's own kybe_id disagrees with the Passport's kybe_identity_id
  | 'passport_inactive'
  | 'unavailable';

export type ExplicitAnchorResult =
  | { ok: true; rootIdentityId: string; kybeId: string }
  | { ok: false; reason: ExplicitAnchorFailure };

/**
 * Resolve the principal root/kybe from a Passport's OWN, ALREADY-RECONCILED
 * `root_identity_id`/`kybe_identity_id` anchor columns — no auth-user
 * disambiguation, no sibling-root walk, no session/auth_user_id involved at
 * all.
 *
 * For a caller whose Passport linkage has ALREADY had its constitutional
 * root selection performed (`services/passport/
 * legacyPassportLinkageRepair.ts`, which itself resolves via the caller's
 * own authenticated `auth_user_id` and writes the resolved anchors onto the
 * Passport). A consumer of that already-reconciled Passport — e.g. the
 * Chrysalis Homecoming anchoring repair reading a `sponsor_passport_id` —
 * does not need to re-derive the principal by walking `resolveAuthUserForKybe`
 * a second time; that would re-litigate a decision already made, and
 * incorrectly refuse whenever the resolved kybe ALSO happens to have
 * unrelated historical sibling `root_identity` rows under other auth users
 * (a real, separate §A.5 consolidation question this specific consumer has
 * no need to answer, because the Passport already names its own root).
 *
 * Fails closed if either anchor is null, the referenced `root_identity` row
 * does not exist, that root's own `kybe_id` disagrees with the Passport's
 * `kybe_identity_id` (defense in depth against a data-integrity drift), or
 * the Passport is no longer usable (revoked/expired/inactive).
 *
 * Deliberately does NOT call `resolveAuthUserForKybe` — this function never
 * resolves or disambiguates an auth user, and must not be used anywhere a
 * caller needs session/auth-user-level authority. `resolvePassportPrincipalById`
 * is unchanged and remains the correct choice for any authentication
 * -sensitive consumer that needs the stricter, auth-user-verified walk.
 */
export async function resolvePassportExplicitAnchor(passportId: string): Promise<ExplicitAnchorResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

  const { data: passportRow, error: ppErr } = await supabase
    .from('polity_passport_records')
    .select(
      'root_identity_id, kybe_identity_id, passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at',
    )
    .eq('passport_id', passportId)
    .maybeSingle();
  if (ppErr) return { ok: false, reason: 'unavailable' };
  if (!passportRow) return { ok: false, reason: 'no_passport' };

  const row = passportRow as Record<string, unknown>;
  const rootIdentityId = row.root_identity_id as string | null;
  const kybeId = row.kybe_identity_id as string | null;
  if (!rootIdentityId || !kybeId) return { ok: false, reason: 'anchor_incomplete' };

  const passport: PassportSnapshot = {
    passportClass: (row.passport_class as string) ?? null,
    citizenStatus: (row.citizen_status as string) ?? null,
    participantStatus: (row.participant_status as string) ?? null,
    passportGrade: (row.passport_grade as string) ?? null,
    revoked: Boolean(row.revoked),
    expiresAt: (row.expires_at as string) ?? null,
  };
  if (!isPassportUsable(passport)) return { ok: false, reason: 'passport_inactive' };

  const { data: rootRow, error: rootErr } = await supabase
    .from('root_identity')
    .select('id, kybe_id')
    .eq('id', rootIdentityId)
    .maybeSingle();
  if (rootErr) return { ok: false, reason: 'unavailable' };
  if (!rootRow) return { ok: false, reason: 'root_not_found' };
  if ((rootRow as { kybe_id?: string }).kybe_id !== kybeId) return { ok: false, reason: 'kybe_mismatch' };

  return { ok: true, rootIdentityId, kybeId };
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
 * SUPERSEDED 2026-08-15 (operator-locked ontology ruling, same day): this
 * module used to export `resolveClusterPrincipalForPersona`, which resolved
 * a principal by walking a persona's `auth_profile_id` cluster and matching
 * `personas.root_did` against `root_identity.did_uri` — a PERSONA-UPWARD
 * heuristic. It has been removed.
 *
 * Read-only audit (2026-08-15) proved `personas.root_did` is a semantically
 * overloaded legacy column: only ONE write site
 * (`services/passport/bureauIdentityService.ts::bindBureauIdentity`) ever
 * writes a genuine `root_identity.did_uri` into it. Every other persona
 * -creation path — `services/identity/personaService.ts`,
 * `app/api/persona/create`, `app/api/identity/persona/create-with-fio`,
 * `app/api/wallet/persona`, batch-import scripts — writes a disposable,
 * persona-level identifier instead (`did:fio:<handle>`, a hash of the FIO
 * handle, or an import placeholder). A persona-upward walk therefore only
 * ever worked by COINCIDENCE, for personas that happened to go through the
 * Bureau path — it inherited every other path's inconsistency by
 * construction, and was superseded rather than patched.
 *
 * KybeDID/RootDID are person-grade, persona-agnostic credentials.
 * `root_identity`/`kybe_identity` are the durable spine; `personas` are
 * contextual bindings BENEATH that spine, never the other way round.
 * Principal resolution now flows exclusively from the authenticated
 * session's own `auth_user_id` (see `resolveRootPrincipalForAuthUser`
 * below) — KybeDID/RootDID → Passport → personas, never
 * persona → guess a root → infer personhood. `personas.root_did` itself is
 * left untouched here (a separate identity-spine normalization question,
 * not resolved by this change) but MUST NOT be read for principal
 * resolution anywhere in this codebase going forward.
 */

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

  // 1. Auth user → root → kybe.
  const rootPrincipal = await resolveRootPrincipalForAuthUser(authUserId);
  if (!rootPrincipal.ok) return { ok: false, reason: rootPrincipal.reason };
  const { rootIdentityId, kybeId } = rootPrincipal;

  // 2. Personhood → Passport — the same lookup the wallet walk ends in.
  const passportResult = await loadUsablePassportByKybe(supabase, kybeId);
  if (!passportResult.ok) return passportResult;

  return {
    ok: true,
    principal: { kybeId, rootIdentityId, authUserId, passport: passportResult.passport },
  };
}

export type RootPrincipalFailure = 'lineage_incomplete' | 'unavailable';

export type RootPrincipalResult =
  | { ok: true; rootIdentityId: string; kybeId: string }
  | { ok: false; reason: RootPrincipalFailure };

/**
 * The auth_user_id → root_identity → kybe_id walk — THE canonical
 * person-grade principal resolver, entered directly from an authenticated
 * session's own `auth_user_id`. Never touches `personas`.
 *
 * Extracted from `resolvePassportPrincipalForAuthUser` (which additionally
 * requires the resolved kybe to already hold a currently-usable Passport) so
 * a caller that only needs the root/kybe — not an existing Passport under it
 * — can reuse the identical walk without re-deriving it
 * (inv.engineering.036/037). The canonical use case: legacy Passport
 * linkage reconciliation (`services/passport/legacyPassportLinkageRepair.ts`)
 * exists specifically to ATTACH a Passport to this exact principal, so
 * requiring one already resolvable would be circular.
 *
 * One personhood or refusal: two kybes under one auth user is the
 * consolidation problem (§A.5) — refuse rather than choose, the same
 * posture as the wallet walk.
 */
export async function resolveRootPrincipalForAuthUser(authUserId: string): Promise<RootPrincipalResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, reason: 'unavailable' };

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

  return { ok: true, rootIdentityId, kybeId };
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
  /*
   * A USABLE row wins over an unusable one — never "the oldest row wins"
   * (found 2026-08-03, Nakamoto journey).
   *
   * This took `.order(created_at, ascending).limit(1)`: the OLDEST record
   * under the kybe. A personhood that ever accumulated a second record — an
   * early revoked or expired issuance followed by the real one — therefore
   * resolved to the dead row, failed `isPassportUsable`, and reported
   * `passport_inactive` for an operator whose current Passport is valid. On
   * the journey's Passport stage that rendered as "Your Polity Citizen
   * Passport does not currently resolve" — a re-litigation of a settled fact,
   * lost to row-selection order.
   *
   * The question this function answers is in its name: is there a usable
   * Passport for this personhood? So it reads the records and answers THAT —
   * preferring any usable row, and only when none is usable reporting the
   * newest row's honest inactive state.
   */
  const { data: passportRows, error: ppErr } = await supabase
    .from('polity_passport_records')
    .select('passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at')
    .eq('kybe_identity_id', kybeId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (ppErr) return { ok: false, reason: 'unavailable' };
  const rows = (passportRows ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return { ok: false, reason: 'no_passport' };

  const snapshots: PassportSnapshot[] = rows.map((row) => ({
    passportClass: (row.passport_class as string) ?? null,
    citizenStatus: (row.citizen_status as string) ?? null,
    participantStatus: (row.participant_status as string) ?? null,
    passportGrade: (row.passport_grade as string) ?? null,
    revoked: Boolean(row.revoked),
    expiresAt: (row.expires_at as string) ?? null,
  }));
  const usable = snapshots.find((p) => isPassportUsable(p));
  if (usable) return { ok: true, passport: usable };
  return { ok: false, reason: 'passport_inactive' };
}

/**
 * Does the CALLER hold a usable Polity **Citizen** Passport — asked by
 * persona, for the case where the kybe anchor was never written.
 *
 * ── WHY THIS EXISTS (operator, 2026-08-03) ────────────────────────────────
 *
 * The Journey's Passport stage asks one question: *does the active human
 * principal hold a usable Citizen Passport, such that they may sponsor an
 * agent?* It resolved that through `loadUsablePassportByKybe`, and got `false`
 * for an operator holding FIVE active, unrevoked, unexpired Citizen Passports.
 *
 * The cause was not actor–subject confusion (the resolver never receives the
 * agent) and not row selection. It was that `kybe_identity_id` is NULL on every
 * `ppc-*` row in this deployment, so a query filtering on it cannot return a
 * row for anyone. The Passports are reachable only by `persona_id` — which is
 * how `/api/polity-passport/wallet` finds them, and why the wallet and the
 * Journey disagreed about the same fact.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * NOT a replacement for the kybe walk, and NOT usable for minting a session.
 * `resolvePassportPrincipalForAuthUser` is unchanged: passport-native ACCESS
 * still demands a full kybe-anchored principal, because a session must be
 * bound to personhood. This answers the narrower, read-only question "may this
 * caller sponsor?", which needs a Passport but not a minted principal.
 *
 * ── THE TWO CONSTRAINTS THAT KEEP IT SAFE ─────────────────────────────────
 *
 * 1. Personas are resolved SERVER-SIDE from the caller's own auth profile.
 *    A caller-supplied personaId is never trusted here — that would let any
 *    caller assert someone else's Passport.
 * 2. `passport_class = 'citizen'` is filtered in the QUERY. An agent's
 *    `agent_participant` Passport can never satisfy the principal check, so
 *    the role separation the operator insists on — principal vs delegate —
 *    is structural rather than conventional. (Agents are root-id anchored and
 *    correctly carry no kybe; only Citizen Passports are kybe-bearing.)
 *
 * The underlying issuance gap — Citizen Passports written without their kybe
 * anchor — is a SEPARATE defect this one merely stops blocking on. Fixing the
 * issuer does not make this redundant: it will simply start succeeding at the
 * kybe step first.
 */
/**
 * The persona ids a caller owns — THE shared scope for "does this holder have
 * X", so every surface answers it over the same set.
 *
 * ── WHY (operator, 2026-08-03) ────────────────────────────────────────────
 *
 * The Journey routed to the Delegate path (it searched every persona the
 * caller owns and found the Citizen Passport) while the Passport Bureau
 * embedded inside it said "No Citizen Passport application yet" — because
 * `/api/polity-passport/wallet` scoped to the ACTIVE persona alone. A holder
 * with several personas therefore got two answers to one question, on one
 * screen. A credential belongs to the HOLDER, not to whichever persona happens
 * to be selected when the question is asked.
 */
export async function listOwnedPersonaIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  authProfileId: string,
): Promise<{ ok: true; personaIds: string[] } | { ok: false; reason: PrincipalFailure }> {
  if (!authProfileId) return { ok: false, reason: 'principal_unprovisioned' };
  const { data, error } = await supabase
    .from('personas')
    .select('id')
    .eq('auth_profile_id', authProfileId)
    .eq('status', 'active');
  if (error) return { ok: false, reason: 'unavailable' };
  const personaIds = (data ?? []).map((r) => (r as { id?: string }).id).filter((v): v is string => Boolean(v));
  if (personaIds.length === 0) return { ok: false, reason: 'principal_unprovisioned' };
  return { ok: true, personaIds };
}

export async function loadUsableCitizenPassportForAuthProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  authProfileId: string,
): Promise<{ ok: true; passport: PassportSnapshot } | { ok: false; reason: PrincipalFailure }> {
  const owned = await listOwnedPersonaIds(supabase, authProfileId);
  if (!owned.ok) return { ok: false, reason: owned.reason };
  const personaIds = owned.personaIds;

  const { data: rows, error } = await supabase
    .from('polity_passport_records')
    .select('passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at')
    .in('persona_id', personaIds)
    .eq('passport_class', 'citizen')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return { ok: false, reason: 'unavailable' };
  if (!rows || rows.length === 0) return { ok: false, reason: 'no_passport' };

  const snapshots: PassportSnapshot[] = (rows as Record<string, unknown>[]).map((row) => ({
    passportClass: (row.passport_class as string) ?? null,
    citizenStatus: (row.citizen_status as string) ?? null,
    participantStatus: (row.participant_status as string) ?? null,
    passportGrade: (row.passport_grade as string) ?? null,
    revoked: Boolean(row.revoked),
    expiresAt: (row.expires_at as string) ?? null,
  }));
  // Same discipline as the kybe path: a USABLE row wins over an unusable one.
  const usable = snapshots.find((p) => isPassportUsable(p));
  if (usable) return { ok: true, passport: usable };
  return { ok: false, reason: 'passport_inactive' };
}
