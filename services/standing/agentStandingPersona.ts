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
 * The narrow subset of `RegistrableAgentConfig` this module actually needs —
 * a real `RegistrableAgentConfig` satisfies it structurally, but so does a
 * platform agent that is deliberately NOT a registrable agent (e.g. Aegis,
 * services/aegis/aegisAssessmentService.ts — MoneyPenny's independent
 * assessor, never a Horizen Register/Verify/Claim candidate). Loosening this
 * away from `RegistrableAgentConfig` lets this file's own contract (a
 * canonical wallet-visible Standing identity for ANY platform agent's
 * RootDID) serve agents outside the registrable-agent roster without forcing
 * them to grow Horizen-specific fields they don't have.
 */
export interface StandingAgentIdentity {
  slug: string;
  displayName: string;
  runtimeAgentId: string;
}

/**
 * Distinct from every `app_origin` `provisionAgentWalletPersona.ts` writes
 * (`aigent-me`, `aigent-delegate`) — this identifies the ONE canonical,
 * sponsor-independent Standing identity for an agent's own RootDID, never a
 * per-citizen wallet persona.
 */
export const CANONICAL_AGENT_STANDING_APP_ORIGIN = 'aigent-canonical-standing';

/**
 * The agent's REAL custodied EVM address from `agent_keys` (2026-09-05 fix —
 * mirrors the identical fix already applied to
 * services/agents/provisionAgentWalletPersona.ts's resolveWalletAddress().
 * This function previously fabricated a random 20-byte hex address here,
 * unconditionally, so every canonical Standing identity's wallet-visible
 * `personas` row showed an address that did not match the real one signing
 * that agent's Register/Verify/Claim transactions — verified live:
 * moneypenny/nakamoto/kn0w1's existing `personas` rows (app_origin
 * 'aigent-canonical-standing') all currently carry the fabricated value, not
 * their real `agent_keys.evm_address`. NOT retroactively corrected here —
 * that is a separate, deliberate decision needing explicit operator sign-off,
 * same as the parallel fix already flagged this way.
 *
 * Falls back to a clearly-random placeholder ONLY when no `agent_keys` row
 * exists yet for this agent — logged, never silent.
 */
async function resolveCanonicalAgentWalletAddress(runtimeAgentId: string): Promise<string> {
  try {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const addresses = await new AgentKeyService().getAgentAddresses(runtimeAgentId);
    if (addresses?.evmAddress) return addresses.evmAddress;
  } catch (e) {
    console.error('[resolveCanonicalAgentPersonaId] getAgentAddresses threw', e instanceof Error ? e.message : e);
  }
  console.warn(`[resolveCanonicalAgentPersonaId] no agent_keys row for '${runtimeAgentId}' — falling back to a placeholder address.`);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return '0x' + hex;
}

/**
 * The agent's canonical Standing IDENTITY persona id (`personas.id`) —
 * exported separately from `resolveAgentStandingPersonaId` (which returns
 * the CRM persona id) because some callers need to match against
 * `activity_receipts.persona_id`, which is always the T0 IDENTITY persona id
 * (see `createActivityReceipt`'s `personaId` param), never the CRM row id.
 * Same idempotent resolve-or-provision logic; only the returned id differs.
 */
export async function resolveCanonicalAgentPersonaId(
  admin: SupabaseClient,
  agent: StandingAgentIdentity,
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
  const address = await resolveCanonicalAgentWalletAddress(agent.runtimeAgentId);

  const { data: created, error: createErr } = await admin
    .from('personas')
    .insert({
      type: 'AgentStandingIdentity',
      fio_handle: fioHandle,
      fio_domain: 'aigent.standing',
      root_did: agentRootDid,
      display_name: agent.displayName,
      evm_key: { address },
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
