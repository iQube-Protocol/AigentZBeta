/**
 * repairLegacyPassportLinkage — principal-first legacy Passport/personhood
 * linkage reconciliation.
 *
 * Some `polity_passport_records` rows were issued before their
 * `kybe_identity_id` / `root_identity_id` anchors were written — the exact
 * issuance gap `services/identity/passportPrincipal.ts::
 * loadUsablePassportByKybe`'s own header documents. This module backfills
 * those two columns for a SPECIFIC Passport.
 *
 * ── ONTOLOGY (operator-locked, 2026-08-15) ─────────────────────────────────
 *
 * KybeDID and RootDID are person-grade, persona-agnostic credentials.
 * Personas are contextual bindings BENEATH that spine. Resolution therefore
 * flows KybeDID/RootDID → Passport → personas, never
 * persona → guess a root → infer personhood.
 *
 * This module previously resolved the principal by walking UP from the
 * target Passport's `persona_id` through `personas.root_did` — a
 * persona-upward heuristic (`resolveClusterPrincipalForPersona`, now
 * removed). A same-day read-only audit proved `personas.root_did` is a
 * semantically overloaded legacy column: only the Bureau bind path
 * (`bureauIdentityService.ts::bindBureauIdentity`) ever writes a genuine
 * `root_identity.did_uri` into it; every other persona-creation path writes
 * a disposable, persona-level identifier (an FIO-handle DID, a hash of the
 * handle, an import placeholder). That heuristic is SUPERSEDED, not
 * extended.
 *
 * The principal is now resolved exclusively from the ACTING CALLER's own
 * authenticated session — `auth_user_id → root_identity → kybe_id`
 * (`resolveRootPrincipalForAuthUser`) — never from the target Passport's
 * persona, and never by reading `personas.root_did`. Persona-cluster
 * ownership (`auth_profile_id` → `listOwnedPersonaIds`) is used ONLY as an
 * authorization predicate — does the caller's own cluster own the persona
 * this Passport belongs to? — never as the identity-resolution mechanism.
 * A caller can never submit an arbitrary `rootIdentityId`/`kybeId`; both
 * values come exclusively from the resolved principal.
 *
 * Governing model (operator-directed 2026-08-15): this is legacy Passport/
 * personhood LINKAGE reconciliation — NOT PRD-PAG-001 Amendment A §A.5
 * "Passport consolidation" (`services/passport/passportLineage.ts`, already
 * ratified but unwired). It never invokes `planConsolidation()`, never
 * transitions `citizen_status`/`participant_status`, never mints a
 * replacement Passport, and never touches `persona_id`, `passport_id`,
 * `issued_at`, or any revocation field. It only fills two currently-null
 * anchor columns on the ONE existing row.
 *
 * Fails closed whenever:
 *   - the caller's own principal cannot be resolved from their session;
 *   - the target Passport is not found or not usable (revoked/expired/
 *     inactive per `isPassportUsable`);
 *   - the target Passport's persona is not owned by the caller's own
 *     persona cluster (`not_authorized`);
 *   - an existing non-null `root_identity_id`/`kybe_identity_id` on the
 *     Passport disagrees with the caller's resolved principal
 *     (`principal_conflict` — never silently overwritten, never silently
 *     ignored).
 *
 * Never: reissues or supersedes the Passport, rewrites `persona_id` /
 * `passport_id` / `issued_at` / any status column, touches
 * `delegation_grants` or any agent-side table, reads `personas.root_did`, or
 * overwrites a conflicting non-null anchor value. Repairs each anchor
 * column independently and only while it is still null — idempotent, each
 * write guarded by its own `IS NULL` check in the query itself, race-safe
 * by construction.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveRootPrincipalForAuthUser,
  isPassportUsable,
  listOwnedPersonaIds,
  type PassportSnapshot,
  type RootPrincipalFailure,
} from '@/services/identity/passportPrincipal';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export type LegacyLinkageRepairFailure =
  | 'passport_not_found'
  | 'passport_not_usable'
  | 'no_persona_recorded'
  | 'caller_principal_unresolved'
  | 'not_authorized'
  | 'principal_conflict';

export interface LegacyLinkageRepairOutcome {
  ok: true;
  passportRecordId: string;
  passportId: string;
  /** True when NEITHER column was written this call (both already filled, or a concurrent repair won the race). */
  alreadyLinked: boolean;
  rootIdentityId: string | null;
  kybeIdentityId: string | null;
  /** True only when this call itself wrote root_identity_id. */
  rootAnchorFilledThisCall: boolean;
  /** True only when this call itself wrote kybe_identity_id. */
  kybeAnchorFilledThisCall: boolean;
  receiptId: string | null;
}

export interface LegacyLinkageRepairError {
  ok: false;
  reason: LegacyLinkageRepairFailure;
  detail?: RootPrincipalFailure | string;
}

export interface LegacyLinkageRepairCaller {
  /** Supabase auth.users id — the ONLY source of the resolved principal. */
  authUserId: string;
  /** Persona-cluster key — used ONLY for the ownership/authorization check. */
  authProfileId: string;
  /** The persona performing this repair act, for the receipt's personaId (self-view). */
  actingPersonaId: string;
}

/**
 * @param admin Injected Supabase admin client — this function's own reads/
 *   writes use it directly. `resolveRootPrincipalForAuthUser` and
 *   `listOwnedPersonaIds` resolve/consume their own client internally
 *   (matching their siblings in passportPrincipal.ts); all reach the same
 *   live database in production.
 * @param passportId The Passport's PUBLIC `passport_id` — never the internal
 *   `id` uuid, which no caller outside this module should need.
 * @param caller The AUTHENTICATED caller's own session identity — never a
 *   caller-supplied rootIdentityId/kybeId, and never derived from the
 *   Passport's own persona.
 */
export async function repairLegacyPassportLinkage(
  admin: SupabaseClient,
  passportId: string,
  caller: LegacyLinkageRepairCaller,
): Promise<LegacyLinkageRepairOutcome | LegacyLinkageRepairError> {
  // 1. Resolve the CALLER's own person-grade principal from their
  //    authenticated session. This is the ONLY source of truth for the
  //    values that will be written — never a caller-supplied id, never the
  //    target Passport's persona.
  const principal = await resolveRootPrincipalForAuthUser(caller.authUserId);
  if (!principal.ok) {
    return { ok: false, reason: 'caller_principal_unresolved', detail: principal.reason };
  }
  const { rootIdentityId: callerRootIdentityId, kybeId: callerKybeId } = principal;

  // 2. Load the Passport row.
  const { data: passport, error: passportErr } = await admin
    .from('polity_passport_records')
    .select(
      'id, passport_id, persona_id, root_identity_id, kybe_identity_id, passport_class, citizen_status, participant_status, revoked, expires_at',
    )
    .eq('passport_id', passportId)
    .maybeSingle();
  if (passportErr) return { ok: false, reason: 'passport_not_found', detail: passportErr.message };
  if (!passport) return { ok: false, reason: 'passport_not_found' };

  const snapshot: PassportSnapshot = {
    passportClass: passport.passport_class ?? null,
    citizenStatus: passport.citizen_status ?? null,
    participantStatus: passport.participant_status ?? null,
    passportGrade: null,
    revoked: Boolean(passport.revoked),
    expiresAt: passport.expires_at ?? null,
  };
  if (!isPassportUsable(snapshot)) {
    return { ok: false, reason: 'passport_not_usable' };
  }
  if (!passport.persona_id) {
    return { ok: false, reason: 'no_persona_recorded' };
  }

  // 3. AUTHORIZATION ONLY — never identity resolution. Does the caller's own
  //    persona cluster own the persona this Passport belongs to?
  const owned = await listOwnedPersonaIds(admin, caller.authProfileId);
  if (!owned.ok || !owned.personaIds.includes(String(passport.persona_id))) {
    return { ok: false, reason: 'not_authorized' };
  }

  // 4. Conflict check — never silently overwrite, and never silently ignore,
  //    an existing non-null anchor that disagrees with the caller's own
  //    resolved principal.
  const rootAlreadyLinked = Boolean(passport.root_identity_id);
  const kybeAlreadyLinked = Boolean(passport.kybe_identity_id);
  if (rootAlreadyLinked && passport.root_identity_id !== callerRootIdentityId) {
    return { ok: false, reason: 'principal_conflict', detail: 'root_identity_id' };
  }
  if (kybeAlreadyLinked && passport.kybe_identity_id !== callerKybeId) {
    return { ok: false, reason: 'principal_conflict', detail: 'kybe_identity_id' };
  }

  if (rootAlreadyLinked && kybeAlreadyLinked) {
    return {
      ok: true,
      alreadyLinked: true,
      passportRecordId: passport.id,
      passportId: passport.passport_id,
      rootIdentityId: passport.root_identity_id,
      kybeIdentityId: passport.kybe_identity_id,
      rootAnchorFilledThisCall: false,
      kybeAnchorFilledThisCall: false,
      receiptId: null,
    };
  }

  // 5. Write each column independently, guarded by its OWN `IS NULL` check —
  //    race-safe, and never touches a field that already had a (matching)
  //    value.
  let rootAnchorFilledThisCall = false;
  let kybeAnchorFilledThisCall = false;
  let finalRootIdentityId = passport.root_identity_id;
  let finalKybeIdentityId = passport.kybe_identity_id;

  if (!rootAlreadyLinked) {
    const { data: updated, error: updErr } = await admin
      .from('polity_passport_records')
      .update({ root_identity_id: callerRootIdentityId })
      .eq('id', passport.id)
      .is('root_identity_id', null)
      .select('root_identity_id')
      .maybeSingle();
    if (updErr) return { ok: false, reason: 'principal_conflict', detail: updErr.message };
    if (updated) {
      rootAnchorFilledThisCall = true;
      finalRootIdentityId = updated.root_identity_id;
    }
  }

  if (!kybeAlreadyLinked) {
    const { data: updated, error: updErr } = await admin
      .from('polity_passport_records')
      .update({ kybe_identity_id: callerKybeId })
      .eq('id', passport.id)
      .is('kybe_identity_id', null)
      .select('kybe_identity_id')
      .maybeSingle();
    if (updErr) return { ok: false, reason: 'principal_conflict', detail: updErr.message };
    if (updated) {
      kybeAnchorFilledThisCall = true;
      finalKybeIdentityId = updated.kybe_identity_id;
    }
  }

  if (!rootAnchorFilledThisCall && !kybeAnchorFilledThisCall) {
    // Both fields were already set (and matched), or a concurrent repair won
    // every race — an honest no-op, not an error.
    return {
      ok: true,
      alreadyLinked: true,
      passportRecordId: passport.id,
      passportId: passport.passport_id,
      rootIdentityId: finalRootIdentityId,
      kybeIdentityId: finalKybeIdentityId,
      rootAnchorFilledThisCall: false,
      kybeAnchorFilledThisCall: false,
      receiptId: null,
    };
  }

  // 6. Forward-looking reconciliation receipt — best-effort, AFTER the
  //    write, never gates it. Public passport_id + booleans only — no
  //    persona/root/kybe/auth ids (T0 discipline).
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: caller.actingPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'legacy_passport_linkage_reconciled',
      summary:
        `Passport ${passport.passport_id} — legacy personhood linkage reconciled (unlinked → linked). ` +
        `Resolved via the caller's own authenticated person-grade principal; no reissuance, no status change.`,
      actionInput: {
        passport_record_id: passport.passport_id,
        root_anchor_filled_this_call: rootAnchorFilledThisCall,
        kybe_anchor_filled_this_call: kybeAnchorFilledThisCall,
      },
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt is best-effort — never fail or unwind the repair over the audit write.
  }

  return {
    ok: true,
    alreadyLinked: false,
    passportRecordId: passport.id,
    passportId: passport.passport_id,
    rootIdentityId: finalRootIdentityId,
    kybeIdentityId: finalKybeIdentityId,
    rootAnchorFilledThisCall,
    kybeAnchorFilledThisCall,
    receiptId,
  };
}
