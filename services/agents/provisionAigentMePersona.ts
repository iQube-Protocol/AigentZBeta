/**
 * provisionAigentMePersona — surface a citizen's aigentMe as a wallet persona.
 *
 * Closes the loop: once an agent is designated the citizen's aigentMe (via
 * genesis, one-click create, or promotion of an existing delegate), this
 * provisions a `personas` row representing that aigentMe so it appears in the
 * wallet persona switcher, is renameable via the normal Edit Persona flow, and
 * — because it is owned by the caller's auth profile — can be activated.
 *
 * Identity model (Options B / B+ / A):
 *   - B  (default): the persona is the citizen's engage/delegate target. The UI
 *     treats a default tap as "engage", NOT a spine identity swap.
 *   - B+ (advanced): the persona IS owned by the caller's auth profile, so the
 *     existing spine (getActivePersona) will accept an explicit "Act as
 *     aigentMe" switch with no resolver change.
 *   - A  (admin-only, future/stub): autonomous agents deployed by a user.
 *     CONSTRAINT: such an agent MUST NOT carry a kybe DID, MUST remain
 *     identifiable as an agent (never human), and CANNOT hold a citizen
 *     passport. This helper never attaches a kybe identity, and the aigentMe
 *     persona is always marked app_origin='aigent-me' (agent, not human).
 *
 * The aigentMe persona is linked to its agent via confirmed columns only:
 *   personas.root_did = agent_root_identity.did_uri  AND  app_origin='aigent-me'
 * (no dependency on persona_agent_binding, whose base schema isn't in
 * migrations). It deliberately carries NO kybe_identity link — it is an agent.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const AIGENT_ME_APP_ORIGIN = 'aigent-me';

export interface AgentRootForPersona {
  did_uri: string;
  display_name: string;
  agent_card_slug: string | null;
}

export interface AigentMePersonaResult {
  personaId: string;
  displayName: string;
  created: boolean;
}

/**
 * Idempotently provisions (or returns) the aigentMe wallet persona for the
 * caller. Best-effort: returns null on any failure so the calling route never
 * breaks the aigentMe create/promote flow over persona surfacing.
 */
export async function provisionAigentMePersona(input: {
  admin: SupabaseClient;
  callerAuthProfileId: string | null | undefined;
  agentRoot: AgentRootForPersona;
  tenantId?: string;
}): Promise<AigentMePersonaResult | null> {
  const { admin, callerAuthProfileId, agentRoot } = input;
  const tenantId = input.tenantId ?? 'default';

  // Without an auth profile the persona can't be owned by (and surfaced to)
  // the caller — skip rather than orphan a row.
  if (!callerAuthProfileId) return null;
  if (!agentRoot?.did_uri) return null;

  try {
    // Idempotency — one aigentMe persona per (auth profile, agent did).
    const { data: existing } = await admin
      .from('personas')
      .select('id, display_name')
      .eq('auth_profile_id', callerAuthProfileId)
      .eq('app_origin', AIGENT_ME_APP_ORIGIN)
      .eq('root_did', agentRoot.did_uri)
      .maybeSingle();
    if (existing?.id) {
      return { personaId: String(existing.id), displayName: String(existing.display_name), created: false };
    }

    const slug = agentRoot.agent_card_slug || agentRoot.did_uri.split(':').pop() || 'aigentme';
    const fioHandle = `${slug}@aigent.me`;
    // Placeholder EVM key envelope (mirrors /api/persona/create). The aigentMe
    // is an agent persona — no kybe identity is attached (Option A constraint).
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const address = '0x' + hex;

    const { data: created, error } = await admin
      .from('personas')
      .insert({
        type: 'AigentMe',
        fio_handle: fioHandle,
        fio_domain: 'aigent.me',
        root_did: agentRoot.did_uri,
        display_name: agentRoot.display_name || 'aigentMe',
        evm_key: { address },
        chain_addresses: {},
        tenant_id: tenantId,
        auth_profile_id: callerAuthProfileId,
        app_origin: AIGENT_ME_APP_ORIGIN,
        // default_identity_state intentionally 'anonymous' — an agent persona
        // never presents as a verified human.
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
      return null;
    }

    return { personaId: String(created.id), displayName: String(created.display_name), created: true };
  } catch {
    return null;
  }
}
