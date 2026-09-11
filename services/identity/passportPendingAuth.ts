/**
 * Passport-native access — the pending-auth transaction and persona
 * selection.
 *
 * PRD-PAG-001 Amendment A, first-connection closure (operator ruling,
 * 2026-07-28), rulings 1–3.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * §A.3.4's ratified ordering is:
 *
 *   connection request → challenge → holder proof → Passport resolution
 *   → personhood resolution → persona / default operating context → session
 *
 * The shipped Increment 5/6 code collapsed "persona / default operating
 * context" into whatever `getActivePersona`'s post-session fallback picked
 * ("first owned persona, sorted") — which is the exact mechanism behind the
 * recorded "sometimes not showing one of my personas" symptom (§A.10.3). This
 * file makes persona selection a genuine, explicit, PRE-session step: a
 * verified proof mints a short-lived PENDING-AUTH TRANSACTION (not a
 * session), the caller is shown its real persona choices, and only a
 * validated choice mints the final session.
 *
 * ── THE T0 BOUNDARY THIS FILE ENFORCES ──────────────────────────────────────
 *
 * `PersonaChoice` (returned to the client) carries ONLY `personaPublicRef`,
 * `displayLabel`, `avatarUrl?`, `personaType?` — never `authProfileId`, an
 * internal persona id, private DID material, email, wallet bindings,
 * standing, or relationship data (ruling 2's exact list). The internal
 * persona id is looked up ONLY server-side, to build this projection and to
 * validate a submitted `personaPublicRef` — it never appears in any value
 * this module returns to a route that serialises to a browser.
 *
 * ── THE CROSS-PRINCIPAL CHECK (canary 7 — the load-bearing property) ───────
 *
 * `personaPublicRef` is a one-way hash (`personaPublicRef(personaId) =
 * sha256(personaId).hex().slice(0,16)`) and is ALREADY the identifier that
 * appears in receipts today (services/identity/personaReferences.ts) — so it
 * is not secret. Accepting ANY syntactically valid ref a client submits would
 * let a submitted ref belonging to a DIFFERENT principal's persona select
 * that principal's persona for THIS session. `selectPersonaChoice` closes
 * this the only way a one-way hash can be closed: by recomputing the forward
 * hash over the SMALL, SERVER-RESOLVED candidate set (the personas this
 * transaction's own principal owns) and requiring an exact match. A ref for
 * any persona outside that set — forged, guessed, or copied from someone
 * else's receipt — matches nothing and is refused.
 *
 * ── NO AUTO-PICK, EVER (canary 5) ───────────────────────────────────────────
 *
 * `selectPersonaChoice` REQUIRES a submitted ref and never defaults to "the
 * only candidate" or "the first candidate" when one is omitted. A citizen
 * with exactly one owned persona still sees it named and still makes the
 * selecting act explicit — the fallback this rule replaces was silent
 * exactly because it never asked. Do not reintroduce a single-candidate
 * shortcut here; that is precisely the shape of the regression this file
 * exists to close.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { personaPublicRef } from '@/services/identity/personaReferences';
import {
  getSupabaseAdminClient,
  getOrCreateCanonicalAuthProfileId,
} from '@/services/wallet/personaRepo';
import { AIGENT_ME_APP_ORIGIN } from '@/services/agents/provisionAigentMePersona';

// ─── PersonaChoice — the ONLY shape a pre-session/pending-auth response may
// carry for a persona (ruling 2). ───────────────────────────────────────────

export interface PersonaChoice {
  personaPublicRef: string;
  displayLabel: string;
  avatarUrl?: string;
  personaType?: string;
}

/** Internal — never returned to a client. Used only to build/validate PersonaChoice. */
export interface CandidatePersona {
  id: string;
  displayLabel: string;
  avatarUrl: string | null;
  personaType: string | null;
}

/** Pure. Builds the client-safe projection from a server-resolved candidate. */
export function toPersonaChoice(candidate: CandidatePersona): PersonaChoice {
  return {
    personaPublicRef: personaPublicRef(candidate.id),
    displayLabel: candidate.displayLabel,
    ...(candidate.avatarUrl ? { avatarUrl: candidate.avatarUrl } : {}),
    ...(candidate.personaType ? { personaType: candidate.personaType } : {}),
  };
}

export type PersonaSelectionFailure = 'ref_required' | 'no_candidates' | 'cross_principal_ref';

export type PersonaSelectionResult =
  | { ok: true; personaId: string; choice: PersonaChoice }
  | { ok: false; reason: PersonaSelectionFailure };

/**
 * THE cross-principal check (canary 7). Pure — no DB access, so it is
 * directly, behaviourally testable without a live Supabase instance.
 *
 * `candidates` MUST already be scoped to the pending-auth transaction's own
 * resolved principal (its `authProfileId`) by the caller — this function
 * trusts that scoping and does not re-derive it; it only proves that the
 * SUBMITTED ref names one of THESE candidates, never a persona outside them.
 */
export function selectPersonaChoice(
  candidates: readonly CandidatePersona[],
  submittedRef: string | null | undefined,
): PersonaSelectionResult {
  // No auto-pick. A missing ref is refused even when candidates.length === 1
  // — see the module header. This is the exact branch canary 5 mutates back
  // in and must catch.
  const ref = (submittedRef ?? '').trim();
  if (!ref) return { ok: false, reason: 'ref_required' };
  if (candidates.length === 0) return { ok: false, reason: 'no_candidates' };

  for (const candidate of candidates) {
    if (personaPublicRef(candidate.id) === ref) {
      return { ok: true, personaId: candidate.id, choice: toPersonaChoice(candidate) };
    }
  }
  // The ref did not match ANY candidate in this principal's own set — either
  // forged, guessed, or genuinely belongs to a different principal entirely.
  // Both collapse to the same refusal; distinguishing them would tell a
  // caller whether their forged ref was merely wrong or specifically
  // someone else's, which is exactly the probing surface the proof route's
  // own opaque-failure discipline (services/passport/connectionChallenge.ts)
  // already refuses to offer.
  return { ok: false, reason: 'cross_principal_ref' };
}

// ─── DB-touching half — pending-auth transaction issuance/spend, candidate
// listing, and wallet-binding reconciliation. Structural only below this
// line: no live Supabase in this test environment, so these are covered by
// the existing suite's methodology (source-order/shape assertions), same as
// connectionChallenge.ts's own DB-touching functions. ─────────────────────

const TABLE = 'passport_pending_auth';

/** Short — a pending-auth transaction is one interactive round-trip, not a session. */
export const PENDING_AUTH_TTL_MS = 5 * 60 * 1000;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface PendingAuthPrincipal {
  kybeId: string;
  rootIdentityId: string;
  authUserId: string;
  assuranceLevel: 'wallet_binding' | 'wallet_binding+world_id';
}

export interface IssuedPendingAuth {
  transactionToken: string;
  expiresAt: string;
}

/**
 * Mint a pending-auth transaction for an ALREADY-resolved principal. Mirrors
 * `issueConnectionChallenge`'s shape exactly (hash-only storage, raw token
 * returned once) — same primitive, new table, because this transaction
 * represents a different act (post-proof, pre-session) than the nonce it
 * follows.
 */
export async function issuePendingAuth(
  supabase: SupabaseClient,
  principal: PendingAuthPrincipal,
  audience: string,
  origin: string,
): Promise<IssuedPendingAuth | null> {
  const transactionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PENDING_AUTH_TTL_MS).toISOString();

  const { error } = await supabase.from(TABLE).insert({
    transaction_token_hash: sha256(transactionToken),
    kybe_identity_id: principal.kybeId,
    root_identity_id: principal.rootIdentityId,
    auth_user_id: principal.authUserId,
    assurance_level: principal.assuranceLevel,
    audience,
    origin,
    expires_at: expiresAt,
  });
  if (error) return null;

  return { transactionToken, expiresAt };
}

export type PendingAuthSpendFailure = 'unknown_transaction' | 'already_consumed' | 'expired' | 'unavailable';

export type PendingAuthSpendResult =
  | {
      ok: true;
      row: {
        id: string;
        kybeId: string;
        rootIdentityId: string;
        authUserId: string;
        assuranceLevel: string;
        audience: string;
        origin: string;
      };
    }
  | { ok: false; reason: PendingAuthSpendFailure };

/**
 * THE atomic spend (canary 6) — same discipline as
 * connectionChallenge.spendChallenge: a conditional UPDATE, never
 * read-then-write, so a replayed transaction token can win the race exactly
 * once, ever.
 */
export async function spendPendingAuth(
  supabase: SupabaseClient,
  transactionToken: string,
): Promise<PendingAuthSpendResult> {
  const tokenHash = sha256(transactionToken);

  const { data: row, error: readErr } = await supabase
    .from(TABLE)
    .select('id, kybe_identity_id, root_identity_id, auth_user_id, assurance_level, audience, origin, expires_at, consumed_at')
    .eq('transaction_token_hash', tokenHash)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'unavailable' };
  if (!row) return { ok: false, reason: 'unknown_transaction' };
  if (row.consumed_at) return { ok: false, reason: 'already_consumed' };

  const { data: spent, error: spendErr } = await supabase
    .from(TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (spendErr) return { ok: false, reason: 'unavailable' };
  if (!spent) return { ok: false, reason: 'already_consumed' };

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  return {
    ok: true,
    row: {
      id: row.id as string,
      kybeId: row.kybe_identity_id as string,
      rootIdentityId: row.root_identity_id as string,
      authUserId: row.auth_user_id as string,
      assuranceLevel: row.assurance_level as string,
      audience: row.audience as string,
      origin: row.origin as string,
    },
  };
}

/**
 * Stamp the persona chosen at /finalize onto the (already-spent) row, so the
 * ONE post-session self-view read (/resolved-persona) can hand the citizen's
 * own browser its own chosen persona id. Best-effort: a failure here does
 * NOT fail session issuance — it only means the client falls back to the
 * spine's own persona resolution for its very first request, same as any
 * other sign-in today.
 */
export async function stashSelectedPersona(
  supabase: SupabaseClient,
  pendingAuthId: string,
  personaId: string,
): Promise<void> {
  try {
    await supabase.from(TABLE).update({ selected_persona_id: personaId }).eq('id', pendingAuthId);
  } catch {
    // Best-effort — see the doc comment above.
  }
}

export type ResolvedPersonaFailure = 'unknown_transaction' | 'already_consumed' | 'not_selected' | 'unavailable';

export type ResolvedPersonaResult =
  | { ok: true; personaId: string; authUserId: string }
  | { ok: false; reason: ResolvedPersonaFailure };

/**
 * The SECOND and LAST consumption of a pending-auth row — see the migration
 * comment on `persona_activation_consumed_at`. Bearer-gated at the route
 * level (owner self-view exception): only a caller who can already present
 * the session this row minted may read the persona id it stashed, and only
 * once.
 */
/**
 * WHICH STORAGE WORLD is redeeming the persona activation.
 *
 * The Companion is an iframe inside the extension side panel and the browser
 * PARTITIONS third-party iframe storage, so a `localStorage.currentPersonaId`
 * written in the Companion is invisible to the top-level application — the
 * same partition gap §A.10.2a already closed for the SESSION by minting one
 * grant per world. The persona activation carries the same discipline: two
 * independent single-use markers on one row, so each world redeems the
 * citizen's ONE recorded choice exactly once, in its own storage.
 *
 * Never collapse these into a single marker "because the value is the same" —
 * that is precisely how the pin ended up existing in only one world and the
 * top-level app fell back to "first owned persona, sorted" (operator,
 * 2026-07-28: "actions aren't working ... not getting right overlay").
 */
export type PersonaActivationWorld = 'companion' | 'application';

const ACTIVATION_COLUMN: Record<PersonaActivationWorld, string> = {
  companion: 'persona_activation_consumed_at',
  application: 'persona_activation_handoff_consumed_at',
};

export async function consumeResolvedPersona(
  supabase: SupabaseClient,
  transactionToken: string,
  world: PersonaActivationWorld = 'companion',
): Promise<ResolvedPersonaResult> {
  const tokenHash = sha256(transactionToken);
  const column = ACTIVATION_COLUMN[world];

  const { data: row, error: readErr } = await supabase
    .from(TABLE)
    .select(
      'id, auth_user_id, selected_persona_id, consumed_at, persona_activation_consumed_at, persona_activation_handoff_consumed_at',
    )
    .eq('transaction_token_hash', tokenHash)
    .maybeSingle();
  if (readErr) return { ok: false, reason: 'unavailable' };
  if (!row || !row.consumed_at) return { ok: false, reason: 'unknown_transaction' };
  if ((row as Record<string, unknown>)[column]) return { ok: false, reason: 'already_consumed' };
  if (!row.selected_persona_id) return { ok: false, reason: 'not_selected' };

  const { data: spent, error: spendErr } = await supabase
    .from(TABLE)
    .update({ [column]: new Date().toISOString() })
    .eq('id', row.id)
    .is(column, null)
    .select('id')
    .maybeSingle();
  if (spendErr) return { ok: false, reason: 'unavailable' };
  if (!spent) return { ok: false, reason: 'already_consumed' };

  return { ok: true, personaId: row.selected_persona_id as string, authUserId: row.auth_user_id as string };
}

/**
 * `authUserId` (the internal Supabase principal `passportPrincipal.ts`
 * resolves) → `authProfileId` (the canonical CRM identity `personas` rows key
 * off). The SAME two-step walk `passportSession.ts`'s `issuePassportSession`
 * already performs (getUserById → getOrCreateCanonicalAuthProfileId) —
 * extracted here so /proof (listing candidates) and /finalize (re-validating
 * them) call ONE function rather than two copies that could drift.
 */
export async function resolveAuthProfileIdForAuthUser(authUserId: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data: userRes, error } = await admin.auth.admin.getUserById(authUserId);
  const email = userRes?.user?.email?.trim().toLowerCase() ?? null;
  if (error || !email) return null;
  return getOrCreateCanonicalAuthProfileId(email);
}

/**
 * The candidate set for a resolved principal — every persona owned by the
 * SAME `auth_profile_id` the principal's `authUserId` resolves to. This is
 * the scoping `selectPersonaChoice` trusts its caller to have already done;
 * it is deliberately the ONLY place that scoping happens, so /proof and
 * /finalize can never disagree about which personas belong to a principal.
 */
export async function listCandidatePersonas(
  supabase: SupabaseClient,
  authProfileId: string,
): Promise<CandidatePersona[]> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, display_name, avatar_uri, fio_handle, app_origin')
    .eq('auth_profile_id', authProfileId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  // This list is a personhood/human-identity choice — "which of MY human
  // personas am I connecting as" — not an agent-delegation picker. A
  // citizen's own aigentMe (app_origin === AIGENT_ME_APP_ORIGIN,
  // provisionAigentMePersona.ts) is deliberately excluded entirely, not just
  // de-prioritised: it never presents as a verified human
  // (default_identity_state: 'anonymous') and offering it here as a Passport
  // proof destination would let a first-time connection resolve to the
  // delegate agent instead of the principal. Explicit act-as-agent selection
  // is a separate, already-authenticated wallet-switcher flow, not this one.
  return (data as Array<Record<string, unknown>>)
    .filter((r) => (r.app_origin as string | null) !== AIGENT_ME_APP_ORIGIN)
    .map((r) => ({
      id: String(r.id),
      displayLabel: (r.display_name as string) || (r.fio_handle as string) || 'Persona',
      avatarUrl: (r.avatar_uri as string) ?? null,
      personaType: null,
    }));
}
