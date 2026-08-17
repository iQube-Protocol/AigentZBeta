/**
 * hydrateAgentExecutionContext — hydrate the aigentMe-assigned Agent as a
 * real Agent, not merely a prompt persona (Homecoming Phase II, operator
 * brief 2026-08-16, P0 Item 2).
 *
 * Desired execution path (as specified):
 *   resolveConstitutionalContext() → currentAigentMe →
 *   resolveAigentMeIdentity() → agentRootId → hydrateAgentExecutionContext(...)
 *   → speaker identity/knowledge/memory/model config/capabilities →
 *   merge with aigentMe surface context → authority intersection → execute
 *
 * This function composes EXISTING canonical loaders — it builds no parallel
 * ones. A direct audit (2026-08-17) of every candidate loader for the six
 * dimensions the brief names found:
 *
 *   - Identity, capability (Agent Card skills) — composable, via
 *     resolveAgentIdentifiers() + handCuratedAgentCards.ts.
 *   - Model/provider configuration — composable via
 *     services/metame/agentLlmOrchestra.ts, but ONLY for agents already in
 *     RUNTIME_AGENT_IDS. Absent (never fabricated) otherwise — this is
 *     "capability != authority to exercise it" applied to infrastructure:
 *     an agent can be assigned the aigentMe role without yet having a
 *     configured runtime provider, and that gap must surface honestly, not
 *     silently default to another agent's model config.
 *   - Constitutional/standing metadata — composable via
 *     services/homecoming/delegateStanding.ts.
 *   - Per-agent KNOWLEDGE — no dedicated corpus/manifest system exists
 *     anywhere in the codebase (confirmed, not merely absent for this
 *     agent). Per operator decision 2026-08-17: the Agent Card's own
 *     declared skills/description is projected as a genuine, if thin,
 *     knowledge signal (`knowledge.proxy`) — sourced from the agent's own
 *     card, never fabricated. `knowledge.hasDedicatedCorpus` stays `false`
 *     so no downstream consumer mistakes the proxy for a real corpus.
 *   - Per-agent MEMORY — no persistent per-agent store exists anywhere
 *     (what exists, memory_invariants, is keyed by the HUMAN persona ×
 *     cartridge, a different axis entirely). Per operator decision
 *     2026-08-17: left explicitly absent (`memory: null`), not faked.
 *
 * Generic by construction: every step below keys off `agentRootId` and the
 * identifiers resolveAgentIdentifiers() derives from it. No agent id is
 * special-cased — Aletheon is the acceptance case, not a special case.
 */

import { resolveAgentIdentifiers } from '@/services/agents/agentIdentifiers';
import { resolveHandCuratedAgentCard, type AgentCardSkill } from '@/services/agents/handCuratedAgentCards';
import { getAgentLlmProviders, getDefaultAgentModelSelection, type AgentProviderOption, type AgentModelSelection } from '@/services/metame/agentLlmOrchestra';
import { readDelegateStanding } from '@/services/homecoming/delegateStanding';

export interface AgentExecutionContext {
  agentRootId: string;
  agentId: string;
  displayName: string | null;
  description: string | null;

  capabilities: {
    skills: AgentCardSkill[];
  } | null;

  knowledge: {
    /** The Agent Card's own declared description/skills, projected as a
     *  knowledge signal. NOT a corpus — see `hasDedicatedCorpus`. */
    proxy: { description: string | null; skills: AgentCardSkill[] } | null;
    hasDedicatedCorpus: false;
  };

  /** Always null today — no per-agent memory store exists on the platform
   *  (confirmed gap, not this agent's absence). */
  memory: null;

  model: {
    runtimeAgentId: string | null;
    providers: AgentProviderOption[];
    defaultSelection: AgentModelSelection | null;
  };

  standing: {
    overall: number;
    bucket: number;
    trustBandCeiling: string;
  } | null;
}

export async function hydrateAgentExecutionContext(agentRootId: string): Promise<AgentExecutionContext | null> {
  const identifiers = await resolveAgentIdentifiers(agentRootId);
  if (!identifiers) return null;

  const handCurated = resolveHandCuratedAgentCard(identifiers.agentCardSlug);
  const skills = handCurated?.skills ?? [];
  const description = handCurated?.description ?? identifiers.description;

  const providers = identifiers.runtimeAgentId ? getAgentLlmProviders(identifiers.runtimeAgentId) : [];
  const defaultSelection = identifiers.runtimeAgentId ? getDefaultAgentModelSelection(identifiers.runtimeAgentId) : null;

  const standing = await readDelegateStanding(identifiers.agentId).catch(() => null);

  return {
    agentRootId: identifiers.agentRootId,
    agentId: identifiers.agentId,
    displayName: identifiers.displayName,
    description,
    capabilities: skills.length > 0 ? { skills } : null,
    knowledge: {
      proxy: handCurated ? { description: handCurated.description, skills: handCurated.skills } : null,
      hasDedicatedCorpus: false,
    },
    memory: null,
    model: {
      runtimeAgentId: identifiers.runtimeAgentId,
      providers,
      defaultSelection,
    },
    standing,
  };
}
