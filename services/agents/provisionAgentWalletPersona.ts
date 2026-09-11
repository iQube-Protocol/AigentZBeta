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
 * Resolves the agent's REAL custodied EVM address from `agent_keys`
 * (2026-09-05 fix — this function previously fabricated a random 20-byte
 * hex address here, unconditionally, so every agent's wallet-visible
 * persona showed an address that did not match the real one signing its
 * Register/Verify/Claim transactions; verified live: moneypenny/nakamoto/
 * kn0w1's existing `personas` rows all currently carry the fabricated
 * value, not their real `agent_keys.evm_address`).
 *
 * `did_uri` is `did:agent:root:<runtimeAgentId>` for every agent this
 * function has ever been called for (the same convention
 * `services/journey/agentAdmissionState.ts`'s migrated-agent mint uses) —
 * the runtimeAgentId is the last colon-separated segment, exactly like
 * this file's own `slug` fallback already derives it two lines below.
 *
 * Falls back to a clearly-random placeholder ONLY when no `agent_keys` row
 * exists yet for this agent (an agent that has no wallet at all still
 * needs SOME address to satisfy `personas.evm_key`'s existing shape) —
 * logged, never silent, so this fallback is never mistaken for a real
 * resolution failure.
 */
async function resolveWalletAddress(didUri: string): Promise<string> {
  const runtimeAgentId = didUri.split(':').pop();
  if (runtimeAgentId) {
    try {
      const { AgentKeyService } = await import('@/services/identity/agentKeyService');
      const addresses = await new AgentKeyService().getAgentAddresses(runtimeAgentId);
      if (addresses?.evmAddress) return addresses.evmAddress;
    } catch (e) {
      console.error('[provisionAgentWalletPersona] getAgentAddresses threw', e instanceof Error ? e.message : e);
    }
  }
  console.warn(`[provisionAgentWalletPersona] no agent_keys row for '${runtimeAgentId ?? didUri}' — falling back to a placeholder address.`);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return '0x' + hex;
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
    const address = await resolveWalletAddress(agentRoot.did_uri);

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
