/**
 * repairLegacyPassportLinkage — generic legacy Passport/personhood linkage
 * reconciliation.
 *
 * Some `polity_passport_records` rows were issued before their
 * `kybe_identity_id` / `root_identity_id` anchors were written — the exact
 * issuance gap `services/identity/passportPrincipal.ts::
 * loadUsablePassportByKybe`'s own header documents ("kybe_identity_id is
 * NULL on every ppc-* row in this deployment"). This module backfills those
 * two columns for a SPECIFIC Passport, generically, at the personhood layer.
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
 * Principal resolution is generic and reused, never invented: it delegates
 * to `resolveClusterPrincipalForPersona` (`services/identity/
 * passportPrincipal.ts`), which walks the Passport's OWN `persona_id` to
 * every persona sharing its `auth_profile_id` and reuses the SAME
 * `personas.root_did` → `root_identity.did_uri` walk
 * `bureauIdentityService.ts::lookupExistingBinding` already performs for a
 * single persona. It deliberately does NOT assume
 * `root_identity.auth_user_id == personas.auth_profile_id` — live evidence
 * in this deployment disproves that equality (they are different identity
 * layers: `auth_profile_id` is the persona-cluster key, `auth_user_id` is
 * the Supabase auth principal reached only by walking the lineage).
 *
 * Never: reissues or supersedes the Passport, rewrites `persona_id` /
 * `passport_id` / `issued_at` / any status column, touches
 * `delegation_grants` or any agent-side table, or overwrites a conflicting
 * non-null anchor value. Repairs each anchor column independently and only
 * while it is still null — idempotent, each write guarded by its own
 * `IS NULL` check in the query itself, race-safe by construction.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveClusterPrincipalForPersona,
  type ClusterPrincipalFailure,
} from '@/services/identity/passportPrincipal';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export type LegacyLinkageRepairFailure =
  | 'passport_not_found'
  | 'no_persona_recorded'
  | ClusterPrincipalFailure;

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
  detail?: string;
}

/**
 * @param admin Injected Supabase admin client — this function's own reads/
 *   writes use it directly. `resolveClusterPrincipalForPersona` resolves its
 *   own client internally (matching its sibling functions in
 *   passportPrincipal.ts); both reach the same live database in production.
 * @param passportId The Passport's PUBLIC `passport_id` (same key
 *   `resolvePassportPrincipalById` already resolves by) — never the internal
 *   `id` uuid, which no caller outside this module should need.
 * @param actingPersonaId The persona performing this repair act (the caller,
 *   for the receipt's `personaId` — self-view, never the Passport holder's
 *   own persona unless they are the same).
 */
export async function repairLegacyPassportLinkage(
  admin: SupabaseClient,
  passportId: string,
  actingPersonaId: string,
): Promise<LegacyLinkageRepairOutcome | LegacyLinkageRepairError> {
  // 1. Load the Passport row. Never widened beyond the one row identified by
  //    its public passport_id.
  const { data: passport, error: passportErr } = await admin
    .from('polity_passport_records')
    .select('id, passport_id, persona_id, root_identity_id, kybe_identity_id')
    .eq('passport_id', passportId)
    .maybeSingle();
  if (passportErr) return { ok: false, reason: 'passport_not_found', detail: passportErr.message };
  if (!passport) return { ok: false, reason: 'passport_not_found' };

  const rootAlreadyLinked = Boolean(passport.root_identity_id);
  const kybeAlreadyLinked = Boolean(passport.kybe_identity_id);

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

  // 2. Resolve the PRINCIPAL via the persona-cluster walk — this Passport's
  //    OWN recorded persona_id only. Never a caller-supplied or currently
  //    -active persona.
  if (!passport.persona_id) {
    return { ok: false, reason: 'no_persona_recorded' };
  }
  const clusterResult = await resolveClusterPrincipalForPersona(passport.persona_id);
  if (!clusterResult.ok) {
    return { ok: false, reason: clusterResult.reason };
  }
  const { rootIdentityId: resolvedRootIdentityId, kybeId: resolvedKybeId } = clusterResult;

  // 3. Write each column independently, guarded by its OWN `IS NULL` check —
  //    race-safe, and never touches a field that already had a value.
  let rootAnchorFilledThisCall = false;
  let kybeAnchorFilledThisCall = false;
  let finalRootIdentityId = passport.root_identity_id;
  let finalKybeIdentityId = passport.kybe_identity_id;

  if (!rootAlreadyLinked) {
    const { data: updated, error: updErr } = await admin
      .from('polity_passport_records')
      .update({ root_identity_id: resolvedRootIdentityId })
      .eq('id', passport.id)
      .is('root_identity_id', null)
      .select('root_identity_id')
      .maybeSingle();
    if (updErr) return { ok: false, reason: 'cluster_principal_unresolved', detail: updErr.message };
    if (updated) {
      rootAnchorFilledThisCall = true;
      finalRootIdentityId = updated.root_identity_id;
    }
  }

  if (!kybeAlreadyLinked) {
    const { data: updated, error: updErr } = await admin
      .from('polity_passport_records')
      .update({ kybe_identity_id: resolvedKybeId })
      .eq('id', passport.id)
      .is('kybe_identity_id', null)
      .select('kybe_identity_id')
      .maybeSingle();
    if (updErr) return { ok: false, reason: 'cluster_principal_unresolved', detail: updErr.message };
    if (updated) {
      kybeAnchorFilledThisCall = true;
      finalKybeIdentityId = updated.kybe_identity_id;
    }
  }

  if (!rootAnchorFilledThisCall && !kybeAnchorFilledThisCall) {
    // Both fields were already set, or a concurrent repair won every race —
    // an honest no-op, not an error.
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

  // 4. Forward-looking reconciliation receipt — best-effort, AFTER the
  //    write, never gates it. Public passport_id + booleans only — no
  //    persona/root/kybe ids (T0 discipline).
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: actingPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'legacy_passport_linkage_reconciled',
      summary:
        `Passport ${passport.passport_id} — legacy personhood linkage reconciled (unlinked → linked). ` +
        `Resolved via the holder's persona-cluster principal; no reissuance, no status change.`,
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
