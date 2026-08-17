/**
 * provisionAgentWalletPersona — generic wallet-persona provisioner for a
 * bound/sponsored Agent (Homecoming Phase II, operator brief 2026-08-16,
 * P1 Item 4 — "bring the Wallet onto the constitutional projection").
 *
 * NOT to be confused with services/agents/provisionAgentPersona.ts (a
 * different, pre-existing function — the agent_persona DID-schema genesis
 * core used by Agent Homecoming's stand-up chain). That function provisions
 * the bounded-delegation identity layer (`agent_persona` table); this one
 * provisions the WALLET-visible `personas` row so an agent can be selected/
 * activated in the persona switcher. Two different tables, two different
 * concerns — the name collision this file's name avoids was caught and
 * corrected during implementation (an earlier draft used the same name and
 * clobbered the existing file; recovered via git checkout).
 *
 * Generalizes what was a single-purpose provisionAigentMePersona.ts into a
 * role-parameterized primitive: EVERY bound/sponsored agent projects
 * consistently through this one function, tagged by its actual role — never
 * hardcoding app_origin='aigent-me' for an agent that is not (or is no
 * longer) the persona's aigentMe. provisionAigentMePersona() is now a thin
 * wrapper calling this with role: 'aigentMe', preserved for its existing
 * call sites and its exact prior behaviour (same app_origin/fio_domain/type
 * values).
 *
 * Idempotency key is (auth profile, app_origin, agent did) — scoped PER
 * ROLE. Known limitation, not yet solved here (no current call site needs
 * it): if an agent is promoted from 'delegate' to 'aigentMe' after already
 * having a delegate-tagged persona, this creates a SECOND persona row
 * rather than migrating the first. Promotion-time persona migration is a
 * separate, deliberate follow-on — flagged here so it is not silently
 * assumed solved.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentPersonaRole = 'aigentMe' | 'delegate';

const ROLE_APP_ORIGIN: Record<AgentPersonaRole, string> = {
  aigentMe: 'aigent-me',
  delegate: 'aigent-delegate',
};

const ROLE_FIO_DOMAIN: Record<AgentPersonaRole, string> = {
  aigentMe: 'aigent.me',
  delegate: 'aigent.delegate',
};

const ROLE_PERSONA_TYPE: Record<AgentPersonaRole, string> = {
  aigentMe: 'AigentMe',
  delegate: 'AgentDelegate',
};

export interface AgentRootForWalletPersona {
  did_uri: string;
  display_name: string;
  agent_card_slug: string | null;
}

export interface AgentWalletPersonaResult {
  personaId: string;
  displayName: string;
  created: boolean;
}

/**
 * Idempotently provisions (or returns) the wallet persona for a bound/
 * sponsored agent, tagged by `role`. Best-effort: returns null on any
 * failure so the calling route never breaks over persona surfacing.
 */
export async function provisionAgentWalletPersona(input: {
  admin: SupabaseClient;
  callerAuthProfileId: string | null | undefined;
  agentRoot: AgentRootForWalletPersona;
  role: AgentPersonaRole;
  tenantId?: string;
}): Promise<AgentWalletPersonaResult | null> {
  const { admin, callerAuthProfileId, agentRoot, role } = input;
  const tenantId = input.tenantId ?? 'default';
  const appOrigin = ROLE_APP_ORIGIN[role];
  const fioDomain = ROLE_FIO_DOMAIN[role];
  const personaType = ROLE_PERSONA_TYPE[role];

  // Without an auth profile the persona can't be owned by (and surfaced to)
  // the caller — skip rather than orphan a row.
  if (!callerAuthProfileId) return null;
  if (!agentRoot?.did_uri) return null;

  try {
    // Idempotency — one persona per (auth profile, role, agent did).
    const { data: existing } = await admin
      .from('personas')
      .select('id, display_name')
      .eq('auth_profile_id', callerAuthProfileId)
      .eq('app_origin', appOrigin)
      .eq('root_did', agentRoot.did_uri)
      .maybeSingle();
    if (existing?.id) {
      return { personaId: String(existing.id), displayName: String(existing.display_name), created: false };
    }

    const slug = agentRoot.agent_card_slug || agentRoot.did_uri.split(':').pop() || 'agent';
    const fioHandle = `${slug}@${fioDomain}`;
    // Placeholder EVM key envelope (mirrors /api/persona/create). Agent
    // personas never attach a kybe identity (Option A constraint) — they
    // are agents, never presented as verified humans.
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const address = '0x' + hex;

    const { data: created, error } = await admin
      .from('personas')
      .insert({
        type: personaType,
        fio_handle: fioHandle,
        fio_domain: fioDomain,
        root_did: agentRoot.did_uri,
        display_name: agentRoot.display_name || (role === 'aigentMe' ? 'aigentMe' : 'Agent'),
        evm_key: { address },
        chain_addresses: {},
        tenant_id: tenantId,
        auth_profile_id: callerAuthProfileId,
        app_origin: appOrigin,
        // default_identity_state intentionally 'anonymous' — an agent
        // persona never presents as a verified human.
        default_identity_state: 'anonymous',
      })
      .select('id, display_name')
      .single();

    if (error) {
      // fio_handle collision (re-run for same slug) — fetch and return it.
      if (error.message.includes('fio_handle') || error.message.includes('duplicate')) {
        const { data: byHandle } = await admin
          .from('personas')
          .select('id, display_name')
          .eq('fio_handle', fioHandle)
          .maybeSingle();
        if (byHandle?.id) {
          return { personaId: String(byHandle.id), displayName: String(byHandle.display_name), created: false };
        }
      }
      console.error('[provisionAgentWalletPersona] insert failed', error.message);
      return null;
    }

    return { personaId: String(created.id), displayName: String(created.display_name), created: true };
  } catch (e) {
    console.error('[provisionAgentWalletPersona] threw', e instanceof Error ? e.message : e);
    return null;
  }
}
