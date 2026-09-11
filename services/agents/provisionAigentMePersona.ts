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
 *
 * Homecoming Phase II P1 Item 4 (operator brief 2026-08-16): this is now a
 * thin wrapper over the generic provisionAgentWalletPersona({agentRoot, role})
 * (services/agents/provisionAgentWalletPersona.ts) — every bound/sponsored
 * agent projects through that ONE function, tagged by its actual role, so a
 * non-aigentMe delegate is never mistakenly tagged app_origin='aigent-me'.
 * This wrapper preserves the exact prior behaviour (same app_origin/
 * fio_domain/type values) for its existing call sites. NOT the same module
 * as services/agents/provisionAgentPersona.ts — see that file's header for
 * the distinct concern it covers (agent_persona DID-schema genesis).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  provisionAgentWalletPersona,
  type AgentRootForWalletPersona,
} from '@/services/agents/provisionAgentWalletPersona';

export const AIGENT_ME_APP_ORIGIN = 'aigent-me';

export type AgentRootForPersona = AgentRootForWalletPersona;

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
  return provisionAgentWalletPersona({ ...input, role: 'aigentMe' });
}
