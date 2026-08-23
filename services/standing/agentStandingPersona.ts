/**
 * resolveAgentStandingPersonaId — the agent's OWN CRM Standing persona, not
 * the sponsoring human's.
 *
 * 2026-08-23 repair (operator-directed, live-DB-checked): the prior
 * implementation queried `crm_personas.identity_persona_id` (a UUID FK into
 * the identity `personas` table) using the agent's TEXT `runtimeAgentId`
 * (e.g. `'aigent-nakamoto'`) directly. That is a type mismatch — every call
 * either threw (invalid UUID input) or silently matched nothing — so Runtime
 * Standing eligibility could never resolve for any agent, regardless of its
 * real score. Live DB check (operator, 2026-08-23) additionally established:
 *   - No `personas` row exists yet whose `root_did` equals any of Nakamoto's/
 *     Kn0w1's/MoneyPenny's `agent_root_identity.did_uri`.
 *   - Existing CRM/persona rows that happen to share a display name with
 *     these agents (e.g. "Nakamoto") are NOT durably bound to the canonical
 *     agent RootDID and MUST NOT be adopted by name-matching.
 *
 * The canonical, operator-ratified resolution chain (never inferred from
 * display name, never a fabricated UUID):
 *
 *   agent_root_identity.did_uri (caller-supplied, already resolved by
 *     resolveAgentAdmissionState — never re-derived here)
 *     -> personas.root_did = did_uri   (idempotently provisioned if absent,
 *        scoped to app_origin=CANONICAL_AGENT_APP_ORIGIN AND
 *        auth_profile_id IS NULL so it can never collide with a per-sponsor
 *        wallet persona created by provisionAgentWalletPersona.ts, which
 *        uses the SAME root_did but a real auth_profile_id)
 *     -> crm_personas.identity_persona_id = personas.id
 *        (auto-mirrored by the existing `sync_persona_to_crm_persona`
 *        trigger on every `personas` INSERT — supabase/migrations/
 *        20260512030000_crm_personas_auto_mirror.sql — never a second,
 *        manual crm_personas write here)
 *     -> crm_personas.id  (returned)
 *
 * This is a reconciliation/provisioning repair for migrated agents, not a
 * new identity model — it reuses the exact `personas` row shape
 * `provisionAgentWalletPersona.ts` already writes, under a distinct
 * `app_origin` so the canonical, sponsor-independent agent Standing identity
 * is never confused with (or silently merged into) a citizen's per-sponsor
 * delegate/aigentMe wallet persona for the same agent.
 *
 * Three-valued, matching this codebase's house style:
 *   `undefined` = the read/resolution itself failed, OR the caller's own
 *     `agentRootDid` resolution failed (propagated, never re-derived) — an
 *     audit gap.
 *   `null` = resolution succeeded and this agent genuinely has no root
 *     identity yet (`agentRootDid === null`).
 *   a string = the real, durably-bound crm_personas.id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

/**
 * Distinct from every `app_origin` `provisionAgentWalletPersona.ts` writes
 * (`aigent-me`, `aigent-delegate`) — this identifies the ONE canonical,
 * sponsor-independent Standing identity for an agent's own RootDID, never a
 * per-citizen wallet persona.
 */
export const CANONICAL_AGENT_STANDING_APP_ORIGIN = 'aigent-canonical-standing';

async function resolveCanonicalAgentPersonaId(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  agentRootDid: string,
): Promise<string | null> {
  const { data: existing, error: existingErr } = await admin
    .from('personas')
    .select('id')
    .eq('root_did', agentRootDid)
    .eq('app_origin', CANONICAL_AGENT_STANDING_APP_ORIGIN)
    .is('auth_profile_id', null)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.id) return String((existing as { id: string }).id);

  // Idempotent provisioning — mirrors provisionAgentWalletPersona.ts's exact
  // `personas` insert shape, scoped by CANONICAL_AGENT_STANDING_APP_ORIGIN +
  // auth_profile_id: null so it is structurally distinct from any per-sponsor
  // wallet persona sharing the same root_did.
  const fioHandle = `${agent.slug}@aigent-standing`;
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { data: created, error: createErr } = await admin
    .from('personas')
    .insert({
      type: 'AgentStandingIdentity',
      fio_handle: fioHandle,
      fio_domain: 'aigent.standing',
      root_did: agentRootDid,
      display_name: agent.displayName,
      evm_key: { address: `0x${hex}` },
      chain_addresses: {},
      tenant_id: 'default',
      auth_profile_id: null,
      app_origin: CANONICAL_AGENT_STANDING_APP_ORIGIN,
      default_identity_state: 'anonymous',
    })
    .select('id')
    .single();

  if (!createErr) return String((created as { id: string }).id);

  // A concurrent request provisioned it first — re-read rather than fail.
  const { data: retry } = await admin
    .from('personas')
    .select('id')
    .eq('root_did', agentRootDid)
    .eq('app_origin', CANONICAL_AGENT_STANDING_APP_ORIGIN)
    .is('auth_profile_id', null)
    .maybeSingle();
  if (retry?.id) return String((retry as { id: string }).id);
  throw new Error(createErr.message);
}

export async function resolveAgentStandingPersonaId(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  /**
   * The agent's `agent_root_identity.did_uri`, as already resolved by
   * `resolveAgentAdmissionState` (`AgentAdmissionState.agentRootDid`) —
   * never re-derived here, so this function and its caller can never
   * disagree about which root identity is in play.
   */
  agentRootDid: string | null | undefined,
): Promise<string | null | undefined> {
  if (agentRootDid === undefined) return undefined; // the caller's own admission read failed — propagate, never fabricate
  if (agentRootDid === null) return null; // genuinely no root identity yet

  try {
    const canonicalPersonaId = await resolveCanonicalAgentPersonaId(admin, agent, agentRootDid);
    if (!canonicalPersonaId) return null;

    const { data: crmRow, error: crmErr } = await admin
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', canonicalPersonaId)
      .maybeSingle();
    if (crmErr) throw new Error(crmErr.message);
    return crmRow?.id ? String((crmRow as { id: string }).id) : null;
  } catch {
    return undefined;
  }
}
