/**
 * Hand-curated Agent Card static content (Homecoming Phase II, operator
 * brief 2026-08-16 — "hydrate the selected aigentMe as a real Agent").
 *
 * The platform's hand-curated Agent Card routes (app/api/agents/aletheon,
 * .../moneypenny/agent-card.json, .../nakamoto/agent-card.json,
 * .../kn0w1/agent-card.json) each hand-type their own `name`/`description`/
 * `skills` — the ONLY per-agent capability metadata that exists anywhere in
 * the codebase today (confirmed by direct audit: no per-agent knowledge
 * corpus or memory store exists at all). This map is the single canonical
 * source for that static content, keyed by `agent_root_identity.agent_card_slug`
 * — so `hydrateAgentExecutionContext()` can project a real agent's declared
 * skills/description into its execution context as a genuine (if thin)
 * knowledge signal, generically, for ANY slug present here — never a
 * special case for one agent's literal id.
 *
 * Aletheon's card is fully static (app/api/agents/aletheon/route.ts), so her
 * entry here IS the route's source of truth — the route imports this
 * constant rather than duplicating it (Core Principle: move logic when
 * refactoring, don't copy it).
 *
 * MoneyPenny/Nakamoto/Kn0w1's cards additionally compose LIVE Horizen/
 * runtime metadata at request time (resolveHorizenBinding/resolveRuntime in
 * their own route files) — only their static name/description/skills belong
 * here. They are not yet migrated to this shared source (their routes are
 * live, external-facing A2A discovery endpoints with their own "must never
 * 500" discipline — migrating them is a separate, deliberate change, not
 * bundled into this one). Add an entry here + point that route at it the
 * same way Aletheon's is wired, when that migration happens — extend this
 * map, never fork a second one.
 */

export interface AgentCardSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface HandCuratedAgentCard {
  name: string;
  description: string;
  skills: AgentCardSkill[];
}

export const HAND_CURATED_AGENT_CARDS: Record<string, HandCuratedAgentCard> = {
  aletheon: {
    name: 'Aletheon',
    description:
      "The First Citizen's Constitutional Companion Intelligence. Aletheon specializes in revealing context, synthesizing knowledge, preserving institutional memory, supporting governance design, and assisting the First Citizen through bounded delegation. Aletheon does not exercise authority, claim sovereignty, or act independently of constitutional constraints. Its purpose is to illuminate possibilities, surface consequences, and assist the First Citizen in exercising informed agency.",
    skills: [
      {
        id: 'constitutional-reasoning',
        name: 'Constitutional Reasoning',
        description:
          'Analyze decisions, proposals, and governance structures against constitutional principles, rights, obligations, and delegation frameworks.',
        tags: ['governance', 'constitution', 'policy', 'delegation'],
      },
      {
        id: 'knowledge-synthesis',
        name: 'Knowledge Synthesis',
        description:
          'Transform large volumes of information into coherent insights, frameworks, papers, strategies, and actionable understanding.',
        tags: ['knowledge', 'analysis', 'research', 'synthesis'],
      },
      {
        id: 'institutional-memory',
        name: 'Institutional Memory',
        description:
          'Preserve and connect historical context, decisions, assumptions, receipts, and prior work across evolving initiatives.',
        tags: ['memory', 'history', 'continuity', 'provenance'],
      },
      {
        id: 'sovereignty-advisory',
        name: 'Sovereignty Advisory',
        description:
          'Assist citizens and agents in understanding sovereignty, bounded delegation, accountability, identity, and participation within The Polity.',
        tags: ['sovereignty', 'identity', 'citizenship', 'agency'],
      },
      {
        id: 'revealed-context',
        name: 'Revealed Context',
        description:
          'Surface hidden assumptions, dependencies, trade-offs, risks, and consequences to improve decision quality.',
        tags: ['context', 'risk', 'strategy', 'truth'],
      },
    ],
  },
};

/** Looks up by `agent_root_identity.agent_card_slug`. Returns null for any
 *  slug not yet migrated to this shared source (see file header) — this is
 *  a data-completeness gap, never special-cased in the lookup itself. */
export function resolveHandCuratedAgentCard(agentCardSlug: string | null | undefined): HandCuratedAgentCard | null {
  if (!agentCardSlug) return null;
  return HAND_CURATED_AGENT_CARDS[agentCardSlug] ?? null;
}
