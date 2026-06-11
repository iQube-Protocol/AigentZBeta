/**
 * Polity Passport Bureau — identity & auth service (Stage 2).
 *
 * PRD: codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-prd-v1.md
 *   §5.1 (citizen identity), §7.1 (auth requirements), §8.1, §9 steps 2–3.
 *
 * Operator decision 1 (approved): Bureau sign-on is a REAL Supabase auth user
 * with a synthetic email (<username>@passport.metame.internal) + password.
 * Bureau personas therefore flow through the canonical identity spine
 * (getCallerIdentityContext → getActivePersona) with ZERO spine modification —
 * the spine resolves callers by token email, and the synthetic email is just
 * an email. No parallel auth gate, no parallel resolver. An optional real
 * recovery email is account-scope only (Addendum B stub) — it is never
 * passport data and never lands in passport tables.
 *
 * KybeDID binding (PRD §9 step 3): first real application logic on top of the
 * kybe_identity dev-stub schema. Flow:
 *   1. duplicate-check — one Bureau persona (and one citizen application
 *      path) per auth account
 *   2. find-or-create root_identity by auth_user_id (existing-RootDID mapping:
 *      a caller who already has a platform RootDID keeps it)
 *   3. mint kybe_identity row + link kybe_id into root_identity
 *   4. create did_persona row bridging root → persona layer
 *
 * T0 rule: raw kybe_did and root did_uri are server-internal. Browser-bound
 * responses carry ONLY commitment refs (kybePublicRef / rootDidPublicRef —
 * the hashPersonaRef pattern). Raw DIDs must never leave the server.
 */

import { createHash, randomBytes } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const BUREAU_SYNTHETIC_EMAIL_DOMAIN = 'passport.metame.internal';
export const BUREAU_APP_ORIGIN = 'polity-passport-bureau';

// ── Pure helpers (unit-tested in tests/passport-bureau.test.ts) ────────────

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/;

export type UsernameValidation = { ok: true } | { ok: false; reason: string };

/** 3–32 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen. */
export function validateBureauUsername(username: string): UsernameValidation {
  const value = (username || '').trim();
  if (value.length < 3 || value.length > 32) {
    return { ok: false, reason: 'Username must be 3–32 characters' };
  }
  if (value !== value.toLowerCase()) {
    return { ok: false, reason: 'Username must be lowercase' };
  }
  if (!USERNAME_RE.test(value)) {
    return {
      ok: false,
      reason: 'Username may contain lowercase letters, digits, and hyphens (no leading/trailing hyphen)',
    };
  }
  return { ok: true };
}

export function syntheticEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${BUREAU_SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isBureauSyntheticEmail(email: string): boolean {
  return (email || '').trim().toLowerCase().endsWith(`@${BUREAU_SYNTHETIC_EMAIL_DOMAIN}`);
}

/**
 * T2-safe public commitment ref for a DID — mirrors the hashPersonaRef
 * pattern in the DVN pipeline: SHA-256 prefix-truncated to 16 hex chars.
 * Reversible only by someone who already knows the raw DID.
 */
export function didPublicRef(did: string): string {
  return createHash('sha256').update(did).digest('hex').slice(0, 16);
}

export function mintKybeDid(): string {
  return `did:kybe:ppb:${randomBytes(16).toString('hex')}`;
}

/**
 * Addendum B recovery stub — account-scope recovery metadata returned with
 * sign-up and bind responses so the UI surfaces the self-custody warning.
 * The recovery email belongs to the ACCOUNT (Supabase auth), never the
 * passport payload.
 */
export function recoveryPolicyStub(recoveryEmailSet: boolean) {
  return {
    recovery_email_set: recoveryEmailSet,
    scope: 'account_recovery_only' as const,
    version: 'recovery-stub-v0.1' as const,
    warning: recoveryEmailSet
      ? 'Recovery email restores ACCOUNT access only. Vault keys are self-custodied — the Bureau cannot recover encrypted passport data.'
      : 'No recovery email set. Loss of your password means permanent loss of account access. Vault keys are self-custodied — the Bureau cannot recover them under any circumstances.',
  };
}

// ── Provisioning (server-side, service-role) ───────────────────────────────

export interface BureauSignupResult {
  ok: boolean;
  syntheticEmail?: string;
  authUserId?: string;
  error?: string;
  /** 409-class error: username already registered. */
  conflict?: boolean;
}

/**
 * Create the Bureau auth account: Supabase auth user with synthetic email.
 * email_confirm is true — the synthetic domain receives no mail, and the
 * password is the credential. An optional recovery email is stored as user
 * metadata (account scope, Addendum B stub); replacing the synthetic login
 * email with a real one is a later, user-initiated account action.
 */
export async function createBureauAuthUser(input: {
  username: string;
  password: string;
  recoveryEmail?: string | null;
}): Promise<BureauSignupResult> {
  const validation = validateBureauUsername(input.username);
  if (!validation.ok) return { ok: false, error: validation.reason };
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' };
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };

  const syntheticEmail = syntheticEmailForUsername(input.username);
  const { data, error } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      bureau_username: input.username.trim().toLowerCase(),
      app_origin: BUREAU_APP_ORIGIN,
      recovery_email: input.recoveryEmail?.trim().toLowerCase() || null,
      recovery_policy: 'recovery-stub-v0.1',
    },
  });

  if (error) {
    const isDuplicate = /already|registered|exists/i.test(error.message || '');
    return {
      ok: false,
      error: isDuplicate ? 'Username is already taken' : error.message,
      conflict: isDuplicate,
    };
  }

  return { ok: true, syntheticEmail, authUserId: data.user?.id };
}

export async function bureauUsernameAvailable(username: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  const validation = validateBureauUsername(username);
  if (!validation.ok) return { available: false, reason: validation.reason };

  const admin = getSupabaseServer();
  if (!admin) return { available: false, reason: 'Supabase configuration missing' };

  // crm_auth_profiles is the spine's canonical email index — a Bureau account
  // that has authenticated at least once has a row here; a fresh auth user
  // may not yet, so also probe auth.users via the admin API.
  const syntheticEmail = syntheticEmailForUsername(username);
  const { data: profileRows } = await admin
    .from('crm_auth_profiles')
    .select('id')
    .eq('email', syntheticEmail)
    .limit(1);
  if (profileRows && profileRows.length > 0) {
    return { available: false, reason: 'Username is already taken' };
  }

  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    // listUsers has no email filter in this SDK version; fall back to a
    // create-time conflict as the authoritative check. This probe is only
    // best-effort UX.
    void data;
  } catch {
    // best-effort — signup remains the authoritative duplicate check
  }

  return { available: true };
}

export interface BureauBindResult {
  ok: boolean;
  personaId?: string;
  /** T2 commitment refs — raw DIDs never leave the server. */
  kybePublicRef?: string;
  rootDidPublicRef?: string;
  /** True when the caller already had a platform RootDID and it was mapped. */
  existingRootDidMapped?: boolean;
  alreadyBound?: boolean;
  error?: string;
}

/**
 * Persona + KybeDID create/bind flow (PRD §9 steps 2–3).
 *
 * Idempotent on the Bureau persona: if the caller's auth profile already has
 * a Bureau persona, the existing binding is returned (alreadyBound: true)
 * rather than minting a duplicate — one Bureau persona per account.
 */
export async function bindBureauIdentity(input: {
  /** Canonical spine auth profile id (from getCallerIdentityContext). */
  authProfileId: string;
  /** Raw Supabase auth.users id (JWT sub) — anchors root_identity. */
  authUserId: string;
  displayName?: string | null;
  /**
   * Bureau username (from signup user_metadata). Used to derive a synthetic
   * `<username>@polity` fio_handle — personas.fio_handle is NOT NULL in the
   * live schema, so anonymous Bureau personas carry a unique synthetic handle
   * in the polity domain rather than null. T0 either way; never serialized.
   */
  bureauUsername?: string | null;
}): Promise<BureauBindResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };

  // 1) Duplicate-check — one Bureau persona per auth account.
  const { data: existingPersonas, error: existingError } = await admin
    .from('personas')
    .select('id')
    .eq('auth_profile_id', input.authProfileId)
    .eq('app_origin', BUREAU_APP_ORIGIN)
    .limit(1);
  if (existingError) return { ok: false, error: existingError.message };

  if (existingPersonas && existingPersonas.length > 0) {
    const personaId = String(existingPersonas[0].id);
    const bound = await lookupExistingBinding(personaId);
    return { ok: true, personaId, alreadyBound: true, ...bound };
  }

  // 2) Existing-RootDID mapping — a caller who already has a platform
  //    root_identity keeps it; otherwise create one anchored to the auth user.
  let rootRow: { id: string; did_uri: string; kybe_id: string | null } | null = null;
  let existingRootDidMapped = false;
  {
    const { data } = await admin
      .from('root_identity')
      .select('id, did_uri, kybe_id')
      .eq('auth_user_id', input.authUserId)
      .limit(1);
    if (data && data.length > 0) {
      rootRow = data[0] as typeof rootRow;
      existingRootDidMapped = true;
    }
  }

  // 3) Mint KybeDID (reuse the root's existing kybe link when present —
  //    one KybeDID per human, never a second).
  let kybeDid: string;
  let kybeId: string;
  if (rootRow?.kybe_id) {
    const { data: kybeRows, error: kybeError } = await admin
      .from('kybe_identity')
      .select('id, kybe_did')
      .eq('id', rootRow.kybe_id)
      .limit(1);
    if (kybeError || !kybeRows || kybeRows.length === 0) {
      return { ok: false, error: 'Existing kybe link is dangling — manual review required' };
    }
    kybeId = String(kybeRows[0].id);
    kybeDid = String(kybeRows[0].kybe_did);
  } else {
    kybeDid = mintKybeDid();
    const { data: kybeRow, error: kybeError } = await admin
      .from('kybe_identity')
      .insert({ kybe_did: kybeDid, state: 'active' })
      .select('id')
      .single();
    if (kybeError) return { ok: false, error: kybeError.message };
    kybeId = String(kybeRow.id);
  }

  if (!rootRow) {
    const rootDidUri = `did:root:ppb:${randomBytes(16).toString('hex')}`;
    const { data: createdRoot, error: rootError } = await admin
      .from('root_identity')
      .insert({
        did_uri: rootDidUri,
        kybe_id: kybeId,
        kybe_hash: didPublicRef(kybeDid),
        kyc_status: 'unverified',
        auth_user_id: input.authUserId,
      })
      .select('id, did_uri, kybe_id')
      .single();
    if (rootError) return { ok: false, error: rootError.message };
    rootRow = createdRoot as typeof rootRow;
  } else if (!rootRow.kybe_id) {
    const { error: linkError } = await admin
      .from('root_identity')
      .update({ kybe_id: kybeId, kybe_hash: didPublicRef(kybeDid) })
      .eq('id', rootRow.id);
    if (linkError) return { ok: false, error: linkError.message };
  }

  // 4) Bureau persona — owned by the caller via auth_profile_id so
  //    getActivePersona resolves it with no spine change. fio_handle is
  //    NOT NULL in the live schema: derive a unique synthetic handle from
  //    the bureau username, falling back to the KybeDID commitment ref so
  //    the handle is always unique and never null.
  const syntheticHandle = input.bureauUsername?.trim()
    ? `${input.bureauUsername.trim().toLowerCase()}@polity`
    : `anon-${didPublicRef(kybeDid)}@polity`;
  const { data: personaRow, error: personaError } = await admin
    .from('personas')
    .insert({
      type: 'PersonaQube',
      fio_handle: syntheticHandle,
      fio_domain: 'polity',
      root_did: rootRow!.did_uri,
      display_name: input.displayName?.trim() || 'Polity Citizen',
      avatar_uri: null,
      evm_key: null,
      chain_addresses: {},
      reputation_score: 0,
      reputation_bucket: 0,
      badges: [],
      status: 'active',
      tenant_id: 'default',
      auth_profile_id: input.authProfileId,
      discoverable_within_tenant: false,
      default_identity_state: 'anonymous',
      app_origin: BUREAU_APP_ORIGIN,
      world_id_status: 'unverified',
    })
    .select('id')
    .single();
  if (personaError) return { ok: false, error: personaError.message };

  // 5) did_persona bridge row (root → persona layer).
  await admin.from('did_persona').insert({
    root_id: rootRow!.id,
    default_identity_state: 'anonymous',
    app_origin: BUREAU_APP_ORIGIN,
    world_id_status: 'unverified',
    persona_type: 'anon',
  });

  return {
    ok: true,
    personaId: String(personaRow.id),
    kybePublicRef: didPublicRef(kybeDid),
    rootDidPublicRef: didPublicRef(rootRow!.did_uri),
    existingRootDidMapped,
  };
}

async function lookupExistingBinding(personaId: string): Promise<{
  kybePublicRef?: string;
  rootDidPublicRef?: string;
}> {
  const admin = getSupabaseServer();
  if (!admin) return {};
  const { data: personaRows } = await admin
    .from('personas')
    .select('root_did')
    .eq('id', personaId)
    .limit(1);
  const rootDid = personaRows?.[0]?.root_did ? String(personaRows[0].root_did) : null;
  if (!rootDid) return {};

  const { data: rootRows } = await admin
    .from('root_identity')
    .select('kybe_id, kybe_identity(kybe_did)')
    .eq('did_uri', rootDid)
    .limit(1);
  const kybeDid = (rootRows?.[0] as { kybe_identity?: { kybe_did?: string } } | undefined)
    ?.kybe_identity?.kybe_did;

  return {
    rootDidPublicRef: didPublicRef(rootDid),
    ...(kybeDid ? { kybePublicRef: didPublicRef(kybeDid) } : {}),
  };
}
