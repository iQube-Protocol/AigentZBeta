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
   * Path (not origin-qualified) to this agent's served health route — the
   * REQUIRED counterpart to `registry_assets.metadata.runtime.health`
   * (services/registry/runtimeDescriptor.ts), which is what
   * services/horizen/pulseEndpoint.ts actually resolves for Horizen Pulse.
   *
   * Required, not optional (Horizen Pilot Closure item 3, 2026-08-09): the
   * runtime descriptor's CONSUMPTION path was already fully generic before
   * this field existed — the gap was that adding a registrable agent here
   * never forced anyone to also give it a runtime surface, so MoneyPenny went
   * unpopulated indefinitely and Pulse/Ratify's P&L resolution honestly
   * returned null for her. `tests/registrable-agent-runtime-surface.test.ts`
   * fails the build if a listed agent's `runtimeHealthPath` is missing OR
   * does not resolve to a real route file on disk — the next agent cannot
   * silently skip this the way MoneyPenny did.
   *
   * This field states what the health surface SHOULD be; it does not by
   * itself populate `registry_assets.metadata.runtime` — that is still a
   * migration (or a `setAssetRuntimeDescriptor` call), same as any other
   * registry-asset data. What this closes is the SILENT skip, not the
   * deploy-time seeding step itself.
   */
  runtimeHealthPath: string;
}

/**
 * The registered agent's own custodied wallet IS `runtimeAgentId`'s
 * `agent_keys` row (AgentKeyService), the SAME wallet Verify's
 * `verify/authorize/route.ts` and Claim's `claim/prove-control/route.ts`
 * already sign with as `AGENT_KEY_REF = agent.runtimeAgentId`. Register used
 * to be the one outlier reading a per-agent env var
 * (MONEYPENNY_OWNER_WALLET_PRIVATE_KEY / NAKAMOTO_OWNER_WALLET_PRIVATE_KEY)
 * as an interactive signer — replaced 2026-08-01 (operator ruling: "Replace
 * NAKAMOTO_OWNER_WALLET_PRIVATE_KEY as the interactive Register dependency.
 * The Register stage must use Aigent Nakamoto's existing agent wallet
 * through the wallet signing boundary") so all three Register/Verify/Claim
 * stages sign through the ONE agent-wallet custody path, never a parallel
 * one. See services/horizen/registrationClient.ts's `resolveOwnerWalletAddress`
 * default and app/api/journey/moneypenny-horizen/register/broadcast/route.ts.
 */
export const REGISTRABLE_AGENTS: Record<string, RegistrableAgentConfig> = {
  moneypenny: {
    slug: 'moneypenny',
    displayName: 'Aigent MoneyPenny',
    runtimeAgentId: 'aigent-moneypenny',
    aigentQubeId: 'aigentqube-moneypenny',
    agentCardPath: '/api/agents/moneypenny/agent-card.json',
    fioHandle: 'moneypenny@aigent',
    runtimeHealthPath: '/api/agents/moneypenny/health',
  },
  nakamoto: {
    slug: 'nakamoto',
    displayName: 'Aigent Nakamoto',
    runtimeAgentId: 'aigent-nakamoto',
    aigentQubeId: 'aigentqube-nakamoto',
    agentCardPath: '/api/agents/nakamoto/agent-card.json',
    fioHandle: 'nakamoto@aigent',
    runtimeHealthPath: '/api/agents/nakamoto/health',
  },
  /*
   * Third registrable agent (Horizen Pilot — Know1 Recording Readiness Pass,
   * 2026-08-10) — added purely as configuration, per this file's own header
   * above. Every value below is sourced from an EXISTING, real record, never
   * invented:
   *   - runtimeAgentId 'aigent-kn0w1': services/metame/agentLlmOrchestra.ts's
   *     RUNTIME_AGENT_IDS (first-class runtime agent, with its own
   *     model/tool config), and app/data/personas.ts's 'aigent-kn0w1' entry
   *     (the system prompt actually driving his live chat behaviour).
   *   - aigentQubeId 'aigentqube-kn0w1': the EXISTING registry_assets row
   *     from supabase/migrations/20260414000000_aigentqube_registry_assets.sql
   *     + 20260415030000_aigentqube_add_aigent_know1.sql — an older AigentQube
   *     representation, upgraded additively by
   *     20260810010000_kn0w1_horizen_admission_fields.sql (this pass), never
   *     a duplicate record.
   *   - fioHandle 'kn0w1@aigent': scripts/register-agent-keys.ts's AGENTS
   *     entry (agentId: 'aigent-kn0w1').
   *
   * `slug` keeps the zero (matches the operator's canonical code identifier
   * exactly, per instruction: "do not invent aliases"). `displayName` drops
   * the zero — "Aigent Know1", not "Aigent Kn0w1" — a DELIBERATE operator
   * choice for TTS pronunciation on front-end/journey-narration surfaces,
   * confirmed to diverge from this repo's OTHER existing Kn0w1 display
   * convention (app/data/personas.ts's own "Naming conventions (locked)"
   * section states "Kn0w1" as the primary label for the KNYT-chat/avatar
   * surfaces) — that convention is untouched; this displayName applies only
   * within the Horizen admission journey's own narration/UI, the same scope
   * every other field on this object is already scoped to.
   */
  kn0w1: {
    slug: 'kn0w1',
    displayName: 'Aigent Know1',
    runtimeAgentId: 'aigent-kn0w1',
    aigentQubeId: 'aigentqube-kn0w1',
    agentCardPath: '/api/agents/kn0w1/agent-card.json',
    fioHandle: 'kn0w1@aigent',
    runtimeHealthPath: '/api/agents/kn0w1/health',
  },
  /*
   * Fourth registrable agent (GJR-FAC-001, Factor/Aegis identity
   * provisioning, operator directive 2026-09-05). Every value below is the
   * operator's own approved identifier for Factor, matching the exact
   * identity substrate provisioned alongside it — never invented:
   *   - runtimeAgentId 'aigent-factor': the agent_keys.agent_id this same
   *     pass provisions the owner/control wallet under
   *     (services/wallet/agentPurposeWalletService.ts's provisionOwnerWallet).
   *   - aigentQubeId 'aigentqube-factor': the registry_assets row seeded by
   *     supabase/migrations/20260905030000_aigentqube_factor_aegis_registry_assets.sql.
   *   - fioHandle 'factor@aigent': the operator's approved requested handle
   *     — REQUESTED/configured only until FIO registration is separately
   *     verified (services/identity/fioService.ts); never claimed as
   *     on-chain-registered merely because this string exists here.
   *
   * Aegis is deliberately NOT a registrable agent here — it is MoneyPenny's
   * independent assessor, never itself a Horizen Register/Verify/Claim
   * candidate (operator, 2026-09-05).
   */
  factor: {
    slug: 'factor',
    displayName: 'Factor',
    runtimeAgentId: 'aigent-factor',
    aigentQubeId: 'aigentqube-factor',
    agentCardPath: '/api/agents/factor/agent-card.json',
    fioHandle: 'factor@aigent',
    runtimeHealthPath: '/api/agents/factor/health',
  },
};

export const DEFAULT_REGISTRABLE_AGENT_SLUG = 'moneypenny';

export function resolveRegistrableAgent(slug: string | null | undefined): RegistrableAgentConfig | null {
  if (!slug) return null;
  return REGISTRABLE_AGENTS[slug] ?? null;
}

/** Looks up by `runtimeAgentId` (e.g. 'aigent-nakamoto') rather than slug (e.g. 'nakamoto') — the two are NOT interchangeable inputs to resolveRegistrableAgent. Needed wherever a caller only has the runtimeAgentId on hand (e.g. a SigningRequest's subjectAgentRef/walletRef, services/horizen/registerCeremony.ts). */
export function resolveRegistrableAgentByRuntimeId(runtimeAgentId: string | null | undefined): RegistrableAgentConfig | null {
  if (!runtimeAgentId) return null;
  return listRegistrableAgents().find((a) => a.runtimeAgentId === runtimeAgentId) ?? null;
}

export function listRegistrableAgents(): RegistrableAgentConfig[] {
  return Object.values(REGISTRABLE_AGENTS);
}
