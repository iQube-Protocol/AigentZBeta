/**
 * Registrable-agent config (GJR-VFY-001/GJR-MKT-001, agent-selectable Register
 * stage, 2026-07-31).
 *
 * The Horizen journey's Register/Verify/Claim routes, the served Agent Card
 * routes, and the journey `state` route were all hardcoded to MoneyPenny
 * alone (`AIGENTQUBE_ID = 'aigentqube-moneypenny'`, `AGENT_KEY_REF =
 * 'aigent-moneypenny'`, repeated across 7 files). The operator's ruling
 * 2026-07-31: MoneyPenny is the demo agent; Aigent Nakamoto is the dry-run
 * agent; this is a product surface, not a demo fixture, so a third agent
 * must be addable as a config entry here — never a new hardcoded constant in
 * a route file.
 *
 * Every field below is sourced from an existing, real, authored record —
 * never invented (CLAUDE.md "No Guessing"):
 *   - moneypenny: app/api/agents/moneypenny/agent-card.json/route.ts,
 *     supabase/migrations/20260930000400_aigentqube_moneypenny_registry_asset.sql
 *   - nakamoto: services/homecoming/agentHomecoming.ts's
 *     HOMECOMING_DELEGATE_SPECS.nakamoto (description), RUNTIME_AGENT_IDS /
 *     AGENT_ID_ALIASES (services/metame/agentLlmOrchestra.ts) for the
 *     runtime agent id, scripts/register-agent-keys.ts's AGENTS entry for
 *     the fio_handle ('nakamoto@aigent').
 *
 * Adding a fourth registrable agent means: one entry here, one Agent Card
 * route mirroring the two below, and one registry_assets seed migration
 * mirroring 20260930000400 — never a new hardcoded constant in a route file.
 */

export interface RegistrableAgentConfig {
  /** URL/query-param-safe identifier — the Register dropdown's value. */
  slug: string;
  displayName: string;
  /** RUNTIME_AGENT_IDS entry (services/metame/agentLlmOrchestra.ts) — used as agent_keys.agent_id and receipts' agentsInvoked. */
  runtimeAgentId: string;
  /** registry_assets.asset_id for this agent's canonical AigentQube record. */
  aigentQubeId: string;
  /** Path (not origin-qualified) to this agent's served Agent Card route. */
  agentCardPath: string;
  /** agent_keys.fio_handle — used to resolve the agent's own persona row for journey-state receipt scoping. */
  fioHandle: string;
  /**
   * Env var name (never a value — resolved by the caller from process.env)
   * holding the private key of the wallet that becomes this agent's Horizen
   * ERC-8004 registration owner. Mirrors MONEYPENNY_OWNER_WALLET_PRIVATE_KEY's
   * existing .env.example convention (scripts/register-moneypenny-horizen.ts) —
   * one env var per agent, never a shared key, never stored anywhere but the
   * environment.
   */
  ownerPrivateKeyEnvVar: string;
}

export const REGISTRABLE_AGENTS: Record<string, RegistrableAgentConfig> = {
  moneypenny: {
    slug: 'moneypenny',
    displayName: 'Aigent MoneyPenny',
    runtimeAgentId: 'aigent-moneypenny',
    aigentQubeId: 'aigentqube-moneypenny',
    agentCardPath: '/api/agents/moneypenny/agent-card.json',
    fioHandle: 'moneypenny@aigent',
    ownerPrivateKeyEnvVar: 'MONEYPENNY_OWNER_WALLET_PRIVATE_KEY',
  },
  nakamoto: {
    slug: 'nakamoto',
    displayName: 'Aigent Nakamoto',
    runtimeAgentId: 'aigent-nakamoto',
    aigentQubeId: 'aigentqube-nakamoto',
    agentCardPath: '/api/agents/nakamoto/agent-card.json',
    fioHandle: 'nakamoto@aigent',
    ownerPrivateKeyEnvVar: 'NAKAMOTO_OWNER_WALLET_PRIVATE_KEY',
  },
};

export const DEFAULT_REGISTRABLE_AGENT_SLUG = 'moneypenny';

export function resolveRegistrableAgent(slug: string | null | undefined): RegistrableAgentConfig | null {
  if (!slug) return null;
  return REGISTRABLE_AGENTS[slug] ?? null;
}

export function listRegistrableAgents(): RegistrableAgentConfig[] {
  return Object.values(REGISTRABLE_AGENTS);
}
