/**
 * repairDelegationAnchor — generic constitutional-anchoring repair for
 * legacy polity-bound Homecoming delegates (CFS-023).
 *
 * Some delegates completed mechanical stand-up (agent_root_identity +
 * agent_persona both seeded) while their sponsor's identity did not resolve
 * through the direct `root_did` string match `provisionAgentPersona.ts`
 * performs at provisioning time — that file's own comment names this exact
 * condition and flags it "for later backfill." This module is that backfill.
 *
 * Governing model (operator-ruled 2026-08-15): delegated agency is
 * PRINCIPAL-BOUND and PERSONA-EXERCISED. Three layers, never conflated:
 *   1. Principal/personhood continuity — durable source of authority.
 *   2. Sponsorship provenance — the persona/passport that performed the
 *      original genesis act. NEVER rewritten here.
 *   3. Operational delegation — mutable bounded grants from authorized
 *      personas (`delegation_grants`). NEVER read or written here.
 *
 * Field semantics (locked):
 *   - `agent_root_identity.sponsor_persona_id` / `sponsor_passport_id` =
 *     historical act provenance. Read-only in this module.
 *   - `agent_persona.delegation_user_root_id` = the principal/root anchor.
 *     Filled ONLY if currently null, resolved via the CANONICAL personhood/
 *     Passport continuity path (`resolvePassportPrincipalById`, which reuses
 *     — never re-derives — the same sibling-root disambiguation rule the
 *     wallet and WorldID connection flows already use).
 *   - `agent_persona.delegation_persona_id` = the original sponsor's Bureau
 *     `did_persona` bridge. Filled only if it genuinely resolves; left null
 *     otherwise — an honest, unrepaired-but-accurate state, not an error.
 *
 * Never: reruns genesis, recreates or revokes the delegate, rewrites
 * `sponsor_persona_id`/`sponsor_passport_id`/`created_at`, touches
 * `delegation_grants`, or overwrites a conflicting non-null anchor field.
 * Repairs each anchor column independently and only while it is still null
 * (a partial prior state — one field filled, one not — is left with the
 * filled field untouched and only the remaining null field considered).
 * Idempotent: each column write is guarded by its own `IS NULL` check in the
 * query itself, race-safe by construction.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePassportPrincipalById } from '@/services/identity/passportPrincipal';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export type AnchorRepairFailure =
  | 'agent_not_found'
  | 'not_polity_bound'
  | 'no_agent_persona'
  | 'no_sponsor_passport_recorded'
  | 'principal_unresolved';

export interface AnchorRepairOutcome {
  ok: true;
  agentRootId: string;
  agentPersonaId: string;
  /** True when NEITHER column was written this call (both already filled, or a concurrent repair won the race). */
  alreadyAnchored: boolean;
  delegationUserRootId: string | null;
  delegationPersonaId: string | null;
  /** True only when this call itself wrote delegation_user_root_id. */
  rootAnchorFilledThisCall: boolean;
  /** True only when this call itself wrote delegation_persona_id. */
  personaBridgeFilledThisCall: boolean;
  receiptId: string | null;
}

export interface AnchorRepairError {
  ok: false;
  reason: AnchorRepairFailure;
  detail?: string;
}

/**
 * @param admin Injected Supabase admin client — this function's own reads/
 *   writes use it directly (matching provisionAgentPersona.ts's convention).
 *   `resolvePassportPrincipalById` resolves its own client internally
 *   (matching its sibling functions in passportPrincipal.ts); both reach the
 *   same live database in production.
 * @param agentRootId `agent_root_identity.id` of the delegate to repair.
 * @param actingPersonaId The persona performing this repair act (the caller,
 *   for the receipt's `personaId` — self-view, never the delegate's sponsor).
 */
export async function repairDelegationAnchor(
  admin: SupabaseClient,
  agentRootId: string,
  actingPersonaId: string,
): Promise<AnchorRepairOutcome | AnchorRepairError> {
  // 1. Load agent_root_identity; refuse unless polity_bound (never touch an
  //    autonomous agent's identity model with a bounded-delegate mechanism).
  const { data: root, error: rootErr } = await admin
    .from('agent_root_identity')
    .select('id, agent_id, agent_class, agent_card_slug, display_name, sponsor_passport_id')
    .eq('id', agentRootId)
    .maybeSingle();
  if (rootErr) return { ok: false, reason: 'agent_not_found', detail: rootErr.message };
  if (!root) return { ok: false, reason: 'agent_not_found' };
  if (root.agent_class !== 'polity_bound') return { ok: false, reason: 'not_polity_bound' };

  // 2. Load agent_persona (must already exist — this repairs anchoring, it
  //    never provisions a persona; that is standUpDelegate's job).
  const { data: persona, error: personaErr } = await admin
    .from('agent_persona')
    .select('id, delegation_user_root_id, delegation_persona_id')
    .eq('agent_root_id', agentRootId)
    .maybeSingle();
  if (personaErr) return { ok: false, reason: 'no_agent_persona', detail: personaErr.message };
  if (!persona) return { ok: false, reason: 'no_agent_persona' };

  const rootAlreadyAnchored = Boolean(persona.delegation_user_root_id);
  const personaBridgeAlreadyFilled = Boolean(persona.delegation_persona_id);

  if (rootAlreadyAnchored && personaBridgeAlreadyFilled) {
    return {
      ok: true,
      alreadyAnchored: true,
      agentRootId: root.id,
      agentPersonaId: persona.id,
      delegationUserRootId: persona.delegation_user_root_id,
      delegationPersonaId: persona.delegation_persona_id,
      rootAnchorFilledThisCall: false,
      personaBridgeFilledThisCall: false,
      receiptId: null,
    };
  }

  // 3. Resolve the PRINCIPAL via the canonical, reused personhood path — the
  //    RECORDED sponsor_passport_id only. Never a caller-supplied or
  //    currently-active persona; never falls back to inventing one.
  let resolvedRootIdentityId: string | null = null;
  let resolvedDelegationPersonaId: string | null = null;
  if (!rootAlreadyAnchored || !personaBridgeAlreadyFilled) {
    if (!root.sponsor_passport_id) {
      return { ok: false, reason: 'no_sponsor_passport_recorded' };
    }
    const principalResult = await resolvePassportPrincipalById(root.sponsor_passport_id);
    if (!principalResult.ok) {
      return { ok: false, reason: 'principal_unresolved', detail: principalResult.reason };
    }
    resolvedRootIdentityId = principalResult.principal.rootIdentityId;

    // Sponsor's Bureau did_persona bridge, scoped to the SAME canonical root
    // just resolved — may legitimately be absent (left null, not an error).
    const { data: didPersonaRows } = await admin
      .from('did_persona')
      .select('id')
      .eq('root_id', resolvedRootIdentityId)
      .eq('app_origin', 'polity-passport-bureau')
      .limit(1);
    resolvedDelegationPersonaId = didPersonaRows && didPersonaRows.length > 0 ? String(didPersonaRows[0].id) : null;
  }

  // 4. Write each column independently, guarded by its OWN `IS NULL` check —
  //    race-safe, and never touches a field that already had a value.
  let rootAnchorFilledThisCall = false;
  let personaBridgeFilledThisCall = false;
  let finalDelegationUserRootId = persona.delegation_user_root_id;
  let finalDelegationPersonaId = persona.delegation_persona_id;

  if (!rootAlreadyAnchored && resolvedRootIdentityId) {
    const { data: updated, error: updErr } = await admin
      .from('agent_persona')
      .update({ delegation_user_root_id: resolvedRootIdentityId })
      .eq('id', persona.id)
      .is('delegation_user_root_id', null)
      .select('delegation_user_root_id')
      .maybeSingle();
    if (updErr) return { ok: false, reason: 'principal_unresolved', detail: updErr.message };
    if (updated) {
      rootAnchorFilledThisCall = true;
      finalDelegationUserRootId = updated.delegation_user_root_id;
    }
  }

  if (!personaBridgeAlreadyFilled && resolvedDelegationPersonaId) {
    const { data: updated } = await admin
      .from('agent_persona')
      .update({ delegation_persona_id: resolvedDelegationPersonaId })
      .eq('id', persona.id)
      .is('delegation_persona_id', null)
      .select('delegation_persona_id')
      .maybeSingle();
    if (updated) {
      personaBridgeFilledThisCall = true;
      finalDelegationPersonaId = updated.delegation_persona_id;
    }
  }

  if (!rootAnchorFilledThisCall && !personaBridgeFilledThisCall) {
    // Both fields were already set, or a concurrent repair won every race —
    // an honest no-op, not an error.
    return {
      ok: true,
      alreadyAnchored: true,
      agentRootId: root.id,
      agentPersonaId: persona.id,
      delegationUserRootId: finalDelegationUserRootId,
      delegationPersonaId: finalDelegationPersonaId,
      rootAnchorFilledThisCall: false,
      personaBridgeFilledThisCall: false,
      receiptId: null,
    };
  }

  // 5. Forward-looking anchoring-repair receipt — best-effort, AFTER the
  //    write, never gates it. Agent-scoped identifiers only. Never a
  //    fabricated historical genesis receipt — this describes the REPAIR
  //    act, dated to now, not the original stand-up.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: actingPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'agent_delegation_anchor_repaired',
      summary:
        `${root.display_name} — constitutional delegation anchor repaired (unanchored → anchored). ` +
        `Principal root resolved via the recorded sponsor Passport; sponsor provenance unchanged.`,
      agentsInvoked: [root.agent_id],
      actionInput: {
        delegate: root.agent_card_slug,
        agent_root_id: root.id,
        agent_persona_id: persona.id,
        root_anchor_filled_this_call: rootAnchorFilledThisCall,
        persona_bridge_filled_this_call: personaBridgeFilledThisCall,
      },
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt is best-effort — never fail or unwind the repair over the audit write.
  }

  return {
    ok: true,
    alreadyAnchored: false,
    agentRootId: root.id,
    agentPersonaId: persona.id,
    delegationUserRootId: finalDelegationUserRootId,
    delegationPersonaId: finalDelegationPersonaId,
    rootAnchorFilledThisCall,
    personaBridgeFilledThisCall,
    receiptId,
  };
}
