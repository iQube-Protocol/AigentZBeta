/**
 * agentRootId → the other agent identifier vocabularies (Homecoming Phase II,
 * operator brief 2026-08-16 — "hydrate the selected aigentMe as a real
 * Agent").
 *
 * Direct audit (2026-08-17) found FIVE disjoint agent-identifier
 * vocabularies live in the codebase, with no existing function translating
 * between them:
 *   1. agent_root_identity.id          — a UUID PK. This is what
 *      resolveAigentMeIdentity() returns as `agentRootId`.
 *   2. agent_root_identity.agent_id    — text (e.g. 'polity-bound:aletheon',
 *      'aigent-z'). What services/homecoming/delegateStanding.ts keys on.
 *   3. agent_root_identity.agent_card_slug — text (e.g. 'aletheon'). What the
 *      generic Agent Card route (app/api/agents/[id]/agent-card.json) and
 *      the hand-curated card registry (handCuratedAgentCards.ts) key on.
 *   4. RUNTIME_AGENT_IDS runtime-agent-id — text (e.g. 'aigent-moneypenny').
 *      What services/metame/agentLlmOrchestra.ts (model/provider config)
 *      keys on. Overlaps with #2 for some agents (e.g. 'aigent-z') but not
 *      others (Aletheon's agent_id and runtime id are different strings).
 *   5. registry_assets.asset_id / aigentQubeId — text (e.g.
 *      'aigentqube-moneypenny'). What Horizen/runtime-descriptor projections
 *      key on. Only populated via services/horizen/registrableAgents.ts's
 *      REGISTRABLE_AGENTS allowlist (moneypenny/nakamoto/kn0w1 today).
 *
 * This function is the ONE join point: given the UUID, resolve every other
 * vocabulary this agent participates in. Downstream composers
 * (hydrateAgentExecutionContext) call this once rather than each
 * hand-rolling their own agent_root_identity lookup.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { normalizeAgentId } from '@/services/metame/agentLlmOrchestra';

export interface AgentIdentifiers {
  agentRootId: string;
  agentId: string;
  displayName: string | null;
  description: string | null;
  agentCardSlug: string | null;
  /** Present only if this agent is a member of RUNTIME_AGENT_IDS — absent
   *  (never fabricated) means the platform has no model/provider config for
   *  this agent yet. */
  runtimeAgentId: string | null;
  /** Present only if this agent's agentCardSlug is in REGISTRABLE_AGENTS —
   *  absent means no registry_assets/Horizen projection exists for it. */
  aigentQubeId: string | null;
}

export async function resolveAgentIdentifiers(agentRootId: string): Promise<AgentIdentifiers | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;

  const { data: row } = await admin
    .from('agent_root_identity')
    .select('id, agent_id, display_name, description, agent_card_slug')
    .eq('id', agentRootId)
    .maybeSingle();
  if (!row) return null;

  const agentCardSlug = typeof row.agent_card_slug === 'string' ? row.agent_card_slug : null;
  const registrable = resolveRegistrableAgent(agentCardSlug);

  return {
    agentRootId: String(row.id),
    agentId: String(row.agent_id),
    displayName: typeof row.display_name === 'string' ? row.display_name : null,
    description: typeof row.description === 'string' ? row.description : null,
    agentCardSlug,
    runtimeAgentId: registrable?.runtimeAgentId ?? normalizeAgentId(row.agent_id),
    aigentQubeId: registrable?.aigentQubeId ?? null,
  };
}
