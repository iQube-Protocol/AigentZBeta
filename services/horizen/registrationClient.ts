/**
 * Horizen registration client — the Register stage's real, server-side
 * mutation path (agent-selectable Register stage, 2026-07-31).
 *
 * Until now `scripts/register-moneypenny-horizen.ts` was the ONLY way to run
 * this flow — CLI-only, hardcoded to MoneyPenny, requiring the operator's own
 * machine (real network egress to agent-registry.horizenlabs.io and
 * sepolia.base.org). This module extracts that script's already-reviewed MCP
 * mechanics (live tool discovery, schema matching, defensive tx extraction,
 * network/contract cross-checks) into a reusable, agent-parameterized,
 * request/response-shaped service — the script's own closing note anticipated
 * exactly this: "persist a metaMe binding record... That requires a small new
 * route... ask for it once you have these real values in hand."
 *
 * SPLIT INTO THREE NON-BLOCKING STEPS, deliberately, not one call:
 *   1. prepareAgentRegistration   — builds the unsigned tx. No key needed.
 *      The operator reviews this before anything is ever signed (mirrors the
 *      script's own printed-tx-then-typed-"yes" gate, translated to a web
 *      request/response instead of a blocking readline prompt).
 *   2. broadcastAgentRegistration — signs LOCALLY with the owner wallet's
 *      private key (the caller resolves it — as of 2026-08-01, from the
 *      agent's own custodied agent_keys row, never a per-agent env var —
 *      never logged, never returned by this function) and submits. Requires
 *      an explicit `confirm: true` from the caller — this function will not
 *      sign or submit without it.
 *   3. checkAgentRegistrationStatus — ONE status check + (if confirmed) ONE
 *      registry reread + persistence. Never an internal polling loop — a
 *      15-attempt/15s-apart poll (the script's own posture) does not fit a
 *      serverless request lifecycle; the caller (the Register stage UI)
 *      re-invokes this on an interval instead.
 *
 * WHAT THIS MODULE NEVER DOES: read, log, or return an owner private key. It
 * is read from the environment once per call, used in-memory by
 * `ethers.Wallet` to sign locally, and discarded — only the resulting SIGNED
 * TRANSACTION HEX (not the key) is ever sent to Horizen or returned to a
 * caller.
 */

import { createHash } from 'crypto';
import { ethers } from 'ethers';
import { HORIZEN_NETWORK_FACTS, type HorizenNetwork } from './identity';
import { HORIZEN_REGISTRY_MCP, fetchRegistryAgent as defaultFetchRegistryAgent, type HorizenRead } from './client';
import { findCompatibleTool, matchSchemaFields, type McpTool, type McpToolResult } from './mcpSchemaMatch';
import { resolveRegistrableAgent, type RegistrableAgentConfig } from './registrableAgents';
import { buildHorizenAgentPageUrl } from './agentPageUrl';

export type RegistrationRefusalCode =
  | 'UNKNOWN_AGENT'
  | 'AGENT_CARD_UNAVAILABLE'
  | 'AGENT_CARD_INVALID'
  | 'ALREADY_REGISTERED'
  | 'REGISTRATION_TOOL_NOT_FOUND'
  | 'UNSIGNED_TX_UNAVAILABLE'
  | 'NETWORK_OR_CONTRACT_MISMATCH'
  | 'CONFIRM_REQUIRED'
  | 'OWNER_KEY_NOT_CONFIGURED'
  | 'SUBMISSION_FAILED'
  | 'STATUS_UNAVAILABLE'
  | 'REGISTRY_REREAD_FAILED';

export type RegistrationResult<T> =
  | { ok: true; value: T }
  | { ok: false; refusalCode: RegistrationRefusalCode; detail: string };

export interface RegistrationMcpClient {
  listTools(): Promise<{ tools: McpTool[] }>;
  callTool(args: { name: string; arguments: Record<string, unknown> }): Promise<McpToolResult>;
}

async function defaultMcpClient(): Promise<RegistrationMcpClient> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'metame-agent-registrar', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(HORIZEN_REGISTRY_MCP)));
  return client as unknown as RegistrationMcpClient;
}

export interface RegistrationDeps {
  mcpClient?: RegistrationMcpClient;
  fetchAgentCard?: (base: string, path: string) => Promise<{ card: Record<string, unknown>; url: string; raw: string }>;
  rpcProvider?: ethers.Provider;
  fetchRegistryAgent?: (registryAlias: string, network: HorizenNetwork) => Promise<HorizenRead<Record<string, unknown>>>;
  updateRegistryAssetBinding?: (aigentQubeId: string, patch: { tokenId: string; registryAlias: string; agentIdentifier: string | null; humanReadableUrl: string | null }) => Promise<void>;
  createRegistrationReceipt?: (input: { actorPersonaId: string; agent: RegistrableAgentConfig; network: HorizenNetwork; txHash: string }) => Promise<string | null>;
  /**
   * Derives the owner wallet's PUBLIC address ONLY — derivation/lookup, never
   * signs anything. Horizen's real build_registration_tx schema (confirmed
   * live, 2026-07-31) requires the owning walletAddress upfront, before any
   * signature exists. Injectable for tests.
   *
   * Default (2026-08-01, replacing the old per-agent env var — operator
   * ruling: "Replace NAKAMOTO_OWNER_WALLET_PRIVATE_KEY as the interactive
   * Register dependency"): resolves the agent's OWN custodied wallet via
   * AgentKeyService, keyed by `agent.runtimeAgentId` — the SAME
   * `AGENT_KEY_REF` Verify's authorize route and Claim's prove-control route
   * already sign with. Register is no longer the one stage with a separate
   * signing path.
   */
  resolveOwnerWalletAddress?: (agent: RegistrableAgentConfig) => string | null | Promise<string | null>;
}

async function defaultResolveOwnerWalletAddress(agent: RegistrableAgentConfig): Promise<string | null> {
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const addresses = await new AgentKeyService().getAgentAddresses(agent.runtimeAgentId);
  return addresses?.evmAddress ?? null;
}

/**
 * The agent's own custodied wallet ADDRESS — public derivation, never a key.
 *
 * Exported (2026-08-02) so a status check can recover it instead of requiring
 * the caller to have carried it. A broadcast whose confirmation poll timed out
 * left the operator holding a transaction they could not ask about: the txHash
 * survives in the receipt, but the owner address lived only in the page's
 * memory and vanished on reload. The address is a property OF THE AGENT and
 * was always derivable here — asking a browser to remember it was the mistake.
 */
export async function resolveAgentOwnerWalletAddress(
  agent: RegistrableAgentConfig,
): Promise<string | null> {
  return defaultResolveOwnerWalletAddress(agent);
}

/**
 * The `services` array Horizen's `build_registration_tx` requires.
 *
 * ── The defect this closes (operator, 2026-08-02, live MCP error) ──────────
 *
 *   MCP error -32602: Invalid arguments for tool build_registration_tx:
 *     services[0].endpoint  Required (received undefined)
 *     services[1].endpoint  Required (received undefined)
 *     services[2].endpoint  Required (received undefined)
 *
 * Horizen requires an `endpoint` on EVERY service. We sent name + description
 * only, so every registration attempt was rejected at the first contact with
 * Horizen — which is why the invocation step was never once reached, across
 * six signed mandates.
 *
 * ── Where the endpoint comes from, and why it is not a guess ───────────────
 *
 * Our Agent Cards publish no per-skill endpoint: an A2A `skill` carries
 * id/name/description/tags, and nothing addressable. The card DOES publish
 * one real, reachable URL for the agent itself — `card.url`, the same value
 * already sent as `agentURI`. Every skill listed on a card is served by that
 * one agent at that one address, so the agent's own published URL is the
 * truthful endpoint for each of them.
 *
 * It is taken from the card, never constructed here. `prepareAgentRegistration`
 * already refuses with AGENT_CARD_INVALID when `card.url` is missing, so this
 * cannot silently emit an empty endpoint. If per-skill endpoints are ever
 * published, read them here in preference — but do not synthesise one by
 * appending a skill id to a URL that would not resolve.
 */
function buildServicesFromCard(
  card: Record<string, unknown>,
): Array<{ name?: string; description?: string; endpoint?: string }> {
  const skills = Array.isArray(card.skills) ? card.skills : [];
  const agentEndpoint = typeof card.url === 'string' ? card.url : undefined;
  return skills
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      name: typeof s.name === 'string' ? s.name : undefined,
      description: typeof s.description === 'string' ? s.description : undefined,
      // A skill's own endpoint if one is ever published; otherwise the agent's.
      endpoint: typeof s.endpoint === 'string' ? s.endpoint : agentEndpoint,
    }));
}

/**
 * Horizen's own words about WHICH arguments it refused, or null when the
 * failure was not an argument-validation one.
 *
 * Reads the Zod issues it returns and names the paths, so a missing required
 * field is reported as a missing required field rather than as an absent
 * transaction. Never invents a cause: if the shape is unrecognised, this
 * returns null and the caller falls back to describing the symptom.
 */
function describeRejectedArguments(result: McpToolResult): string | null {
  const raw = JSON.stringify(result ?? {});
  if (!/Input validation error|invalid_type|invalid_literal|unrecognized_keys/.test(raw)) return null;
  const paths = [...raw.matchAll(/\\"path\\":\s*\[([^\]]*)\]/g)]
    // The paths arrive inside a JSON string, so newlines are literal \n escape
    // sequences rather than whitespace — strip both, or the names come back
    // with the escapes still in them.
    .map((m) =>
      m[1]
        .replace(/\\[nrt]/g, '')
        .replace(/\\"/g, '')
        .replace(/["\s]/g, '')
        .split(',')
        .filter(Boolean)
        .join('.'),
    )
    .filter(Boolean);
  const unique = [...new Set(paths)];
  if (unique.length === 0) return 'Horizen rejected the arguments sent to build_registration_tx';
  return (
    `Horizen rejected the arguments sent to build_registration_tx — it requires ` +
    `${unique.join(', ')}`
  );
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function defaultFetchAgentCard(base: string, path: string): Promise<{ card: Record<string, unknown>; url: string; raw: string }> {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Agent Card fetch failed: HTTP ${res.status} from ${url}`);
  const raw = await res.text();
  return { card: JSON.parse(raw), url, raw };
}

const REGISTRATION_TOOL_NAMES = ['build_registration_tx', 'submit_registry_tx', 'get_onboarding_status'] as const;

async function listRegistrationTools(mcpClient: RegistrationMcpClient) {
  const { tools } = await mcpClient.listTools();
  const byName: Partial<Record<(typeof REGISTRATION_TOOL_NAMES)[number], McpTool>> = {};
  for (const name of REGISTRATION_TOOL_NAMES) {
    byName[name] = tools.find((t) => t.name === name);
  }
  return { tools, byName };
}

export interface UnsignedTx {
  to?: string;
  data?: string;
  value?: string | number;
  chainId?: string | number;
}

/** Mirrors scripts/register-moneypenny-horizen.ts's extractUnsignedTx — moved here so the script and this service share one implementation (never a second copy, inv.engineering.036/037). */
/**
 * The first balanced JSON object embedded anywhere in `text`, or null.
 *
 * Horizen does not return bare JSON. It returns human prose, a `--- structured
 * ---` marker, and then the object — so `JSON.parse(text)` throws on the very
 * response that contains the transaction. Brace-balanced rather than a regex,
 * and string-aware, so a `{` or `}` inside a description field cannot truncate
 * the object early (Nakamoto's own description contains braces-adjacent
 * punctuation and several escaped quotes).
 */
function firstEmbeddedJsonObject(text: string): unknown | null {
  // Horizen marks the machine-readable part; prefer it when present so a brace
  // in the prose above can never be mistaken for the start of the object.
  const marker = text.indexOf('--- structured ---');
  const from = marker === -1 ? 0 : marker;

  // Otherwise try EVERY `{` in turn. Taking only the first one is fragile:
  // Horizen's prose is free text, and a single stray brace in it would consume
  // the whole extraction and report "no transaction" about a response that
  // contains one. Found by a test case before it was found in production.
  for (let start = text.indexOf('{', from); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break; // not the object — try the next candidate `{`
          }
        }
      }
    }
  }
  return null;
}


/**
 * The unsigned transaction inside a `build_registration_tx` result.
 *
 * ── The defect this closes (operator, 2026-08-02) ──────────────────────────
 *
 * Horizen BUILT the transaction — "Unsigned registration transaction built for
 * 0x24BB… on Base Sepolia" — and this function reported it could not find one.
 * Two reasons, both here:
 *
 *   1. It called `JSON.parse` on the WHOLE text block. Horizen's reply is
 *      prose, then a `--- structured ---` marker, then the object. The parse
 *      threw on every successful response, and the `catch` swallowed it as
 *      "not JSON — keep looking".
 *   2. Horizen nests the transaction under `tx`. The recognised keys were
 *      `to`/`data` at the root, `transaction`, and `unsignedTransaction` —
 *      three shapes, none of them the one actually returned.
 *
 * So a successful build was indistinguishable from a failed one. The refusal
 * that followed said "could not locate an unsigned transaction", which was
 * true of this function and false of the world.
 *
 * Every previously recognised shape is still accepted: the fix widens what can
 * be read, it does not move the target.
 */
export function extractUnsignedTx(toolResult: McpToolResult | null | undefined): UnsignedTx | null {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === 'text' && typeof item.text === 'string') {
      // Whole-text JSON first; then the object embedded after Horizen's prose.
      let parsed: any = null;
      try {
        parsed = JSON.parse(item.text);
      } catch {
        parsed = firstEmbeddedJsonObject(item.text);
      }
      if (!parsed) continue;
      if (parsed?.to && parsed?.data) return parsed;
      // Horizen's own shape, confirmed live 2026-08-02.
      if (parsed?.tx?.to && parsed?.tx?.data) return parsed.tx;
      if (parsed?.transaction?.to && parsed?.transaction?.data) return parsed.transaction;
      if (parsed?.unsignedTransaction) return parsed.unsignedTransaction;
    }
  }
  return null;
}

/** Mirrors scripts/register-moneypenny-horizen.ts's extractTxHash — same reuse rationale as extractUnsignedTx above. */
export function extractTxHash(toolResult: McpToolResult | null | undefined): string | null {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === 'text' && typeof item.text === 'string') {
      try {
        const parsed = JSON.parse(item.text);
        const candidate = parsed?.transactionHash ?? parsed?.txHash ?? parsed?.hash;
        if (typeof candidate === 'string' && candidate.startsWith('0x')) return candidate;
      } catch {
        const match = /0x[a-fA-F0-9]{64}/.exec(item.text);
        if (match) return match[0];
      }
    }
  }
  return null;
}

// ── Step 1: prepare ──────────────────────────────────────────────────────

export interface PrepareAgentRegistrationInput {
  agentSlug: string;
  /** Public origin the Agent Card is served from (e.g. https://dev-beta.aigentz.me). */
  agentCardBase: string;
}

export interface PreparedAgentRegistration {
  agentSlug: string;
  agentCardUrl: string;
  agentCardHash: string;
  network: HorizenNetwork;
  unsignedTx: UnsignedTx;
  /**
   * HORIZEN'S OWN IDENTIFIER FOR THIS AGENT, if the build response carried
   * one — the value `get_onboarding_status` requires as `agentId`.
   *
   * ── Why this exists (operator, 2026-08-02) ─────────────────────────────
   *
   * `build_registration_tx` returns a whole object and this function used to
   * keep FOUR fields plus the unsigned transaction, discarding the rest. The
   * status check then had no agentId to send, every call was rejected as a
   * schema error, and the surface reported twenty "not confirmed" answers
   * that were never answers at all.
   *
   * Null means Horizen did not return one in a shape we recognise — an
   * honest absence, not a default. The caller decides what to do about it and
   * must NOT invent a substitute: a wrong agentId produces a confident
   * negative about someone's registration, which is worse than no answer.
   */
  horizenAgentId: string | null;
}

export async function prepareAgentRegistration(
  input: PrepareAgentRegistrationInput,
  deps: RegistrationDeps = {},
): Promise<RegistrationResult<PreparedAgentRegistration>> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `"${input.agentSlug}" is not a registrable agent` };
  }

  const network: HorizenNetwork = 'base-sepolia';
  const facts = HORIZEN_NETWORK_FACTS[network];

  const fetchCard = deps.fetchAgentCard ?? defaultFetchAgentCard;
  let card: Record<string, unknown>;
  let cardUrl: string;
  let cardRaw: string;
  try {
    const fetched = await fetchCard(input.agentCardBase, agent.agentCardPath);
    card = fetched.card;
    cardUrl = fetched.url;
    cardRaw = fetched.raw;
  } catch (err) {
    return { ok: false, refusalCode: 'AGENT_CARD_UNAVAILABLE', detail: err instanceof Error ? err.message : 'Agent Card fetch failed' };
  }

  if (card?.name !== agent.displayName) {
    return { ok: false, refusalCode: 'AGENT_CARD_INVALID', detail: `name mismatch: expected "${agent.displayName}", got ${JSON.stringify(card?.name)}` };
  }
  const metadata = (card?.metadata ?? {}) as Record<string, unknown>;
  if (metadata.runtime_agent_id !== agent.runtimeAgentId) {
    return { ok: false, refusalCode: 'AGENT_CARD_INVALID', detail: `metadata.runtime_agent_id mismatch: got ${JSON.stringify(metadata.runtime_agent_id)}` };
  }
  const horizen = (metadata.horizen ?? {}) as Record<string, unknown>;
  if (horizen.tokenId != null) {
    return { ok: false, refusalCode: 'ALREADY_REGISTERED', detail: `${agent.displayName} already has a Horizen tokenId (${JSON.stringify(horizen.tokenId)}) on record — refusing to re-register` };
  }
  if (!card?.url) {
    return { ok: false, refusalCode: 'AGENT_CARD_INVALID', detail: 'card.url (the agentURI to register) is missing' };
  }

  // Horizen's build_registration_tx requires the owning wallet's address
  // UPFRONT, before any signature exists (confirmed live via its own Zod
  // validation error, 2026-07-31 — see buildArgs below). Looking up the
  // agent's own custodied address is NOT signing; refusing here when it has
  // none is more honest than building a tx nobody can complete.
  const resolveOwnerAddress = deps.resolveOwnerWalletAddress ?? defaultResolveOwnerWalletAddress;
  const ownerWalletAddress = await resolveOwnerAddress(agent);
  if (!ownerWalletAddress) {
    return {
      ok: false,
      refusalCode: 'OWNER_KEY_NOT_CONFIGURED',
      detail: `${agent.displayName} has no custodied wallet on record (agent_keys, runtimeAgentId "${agent.runtimeAgentId}") — Horizen's build_registration_tx requires the owner wallet address before a transaction can be built`,
    };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { byName } = await listRegistrationTools(mcpClient);
  if (!byName.build_registration_tx) {
    return { ok: false, refusalCode: 'REGISTRATION_TOOL_NOT_FOUND', detail: 'Horizen\'s MCP server does not currently declare a "build_registration_tx" tool' };
  }

  // Field names below are CONFIRMED live (2026-07-31), from
  // build_registration_tx's own Zod validation error against an earlier,
  // guessed call: walletAddress/name/description/services are required.
  // `services` is built from the card's own published `skills` — never
  // invented (see buildServicesFromCard).
  const cardDescription = typeof card.description === 'string' ? card.description : '';
  const buildArgs = matchSchemaFields(byName.build_registration_tx.inputSchema, {
    walletAddress: ownerWalletAddress,
    wallet: ownerWalletAddress,
    address: ownerWalletAddress,
    name: agent.displayName,
    agentName: agent.displayName,
    description: cardDescription,
    services: buildServicesFromCard(card),
    agentURI: cardUrl,
    agentUri: cardUrl,
    uri: cardUrl,
    metadataURI: cardUrl,
    network,
    chain: network,
  });
  const buildResult = await mcpClient.callTool({ name: 'build_registration_tx', arguments: buildArgs });
  const unsignedTx = extractUnsignedTx(buildResult);
  if (!unsignedTx) {
    return {
      ok: false,
      refusalCode: 'UNSIGNED_TX_UNAVAILABLE',
      // Surface the exact call and response — this refusal has no way to
      // guess Horizen's real schema, so the operator needs to SEE it rather
      // than get a bare "not found" (mirrors scripts/register-moneypenny-
      // horizen.ts's own propose-and-confirm transparency: print what was
      // sent and what came back, never assume).
      /*
       * LEAD WITH THE REJECTED ARGUMENTS, NOT THE RAW DUMP (2026-08-02).
       *
       * Horizen answers a bad call with a Zod validation error naming the
       * exact paths it refused — `services[0].endpoint  Required`. That is a
       * precise, actionable fact, and it was buried mid-way through a 4000-
       * character JSON dump behind the words "could not locate an unsigned
       * transaction", which describe a symptom and name nothing. The operator
       * found it by reading the dump; nobody should have to.
       *
       * The full arguments and raw result still follow — they are what let the
       * cause be found at all, and truncating them would trade one blindness
       * for another.
       */
      detail:
        `${describeRejectedArguments(buildResult) ?? 'could not locate an unsigned transaction in build_registration_tx\'s result'}. ` +
        `Arguments sent: ${JSON.stringify(buildArgs)}. ` +
        `Raw result: ${JSON.stringify(buildResult).slice(0, 4000)}`,
    };
  }

  if (unsignedTx.to && unsignedTx.to.toLowerCase() !== facts.identityRegistry.toLowerCase()) {
    return { ok: false, refusalCode: 'NETWORK_OR_CONTRACT_MISMATCH', detail: `unsigned tx "to" (${unsignedTx.to}) does not match this repo's recorded IdentityRegistry (${facts.identityRegistry})` };
  }
  if (unsignedTx.chainId != null && Number(unsignedTx.chainId) !== facts.chainId) {
    return { ok: false, refusalCode: 'NETWORK_OR_CONTRACT_MISMATCH', detail: `unsigned tx chainId (${unsignedTx.chainId}) does not match ${network} (${facts.chainId})` };
  }

  /*
   * Read the identifier out of the SAME response the transaction came from —
   * one parse, one source. `firstEmbeddedJsonObject` already handles Horizen
   * returning its payload as text inside a content block.
   */
  const buildPayload = firstEmbeddedJsonObject(JSON.stringify(buildResult)) as Record<string, unknown> | null;
  const horizenAgentId = pickStringField(buildPayload, [
    'agentId',
    'agentID',
    'agent_id',
    'agentIdentifier',
    'identifier',
  ]);

  return {
    ok: true,
    value: {
      agentSlug: agent.slug,
      agentCardUrl: cardUrl,
      agentCardHash: sha256Hex(cardRaw),
      network,
      unsignedTx,
      horizenAgentId,
    },
  };
}

// ── Step 2: broadcast ────────────────────────────────────────────────────

export interface BroadcastAgentRegistrationInput {
  agentSlug: string;
  unsignedTx: UnsignedTx;
  /** The operator's explicit go-ahead on the exact unsigned tx from step 1 — this function refuses without it. */
  confirm: true;
  /** The owner wallet's private key, resolved by the CALLER from its own per-agent env var — never read from process.env here. */
  ownerPrivateKey: string | undefined;
  rpcUrl: string;
}

export interface BroadcastedAgentRegistration {
  txHash: string;
  ownerWalletAddress: string;
  network: HorizenNetwork;
}

export async function broadcastAgentRegistration(
  input: BroadcastAgentRegistrationInput,
  deps: RegistrationDeps = {},
): Promise<RegistrationResult<BroadcastedAgentRegistration>> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `"${input.agentSlug}" is not a registrable agent` };
  }
  if (input.confirm !== true) {
    return { ok: false, refusalCode: 'CONFIRM_REQUIRED', detail: 'confirm must be true — this function never signs without the operator\'s explicit go-ahead on the reviewed unsigned tx' };
  }
  if (!input.ownerPrivateKey) {
    return { ok: false, refusalCode: 'OWNER_KEY_NOT_CONFIGURED', detail: `no owner wallet private key configured for "${agent.slug}"` };
  }

  const network: HorizenNetwork = 'base-sepolia';
  const facts = HORIZEN_NETWORK_FACTS[network];
  const provider = deps.rpcProvider ?? new ethers.JsonRpcProvider(input.rpcUrl);
  const wallet = new ethers.Wallet(input.ownerPrivateKey, provider);

  const populated = await wallet.populateTransaction({
    to: input.unsignedTx.to,
    data: input.unsignedTx.data,
    value: input.unsignedTx.value ?? 0,
    chainId: facts.chainId,
  });
  const signedTx = await wallet.signTransaction(populated);

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { byName } = await listRegistrationTools(mcpClient);
  if (!byName.submit_registry_tx) {
    return { ok: false, refusalCode: 'REGISTRATION_TOOL_NOT_FOUND', detail: 'Horizen\'s MCP server does not currently declare a "submit_registry_tx" tool' };
  }
  const submitArgs = matchSchemaFields(byName.submit_registry_tx.inputSchema, {
    signedTransaction: signedTx,
    signedTx,
    rawTransaction: signedTx,
    rawTx: signedTx,
    tx: signedTx,
    network,
    chain: network,
  });
  const submitResult = await mcpClient.callTool({ name: 'submit_registry_tx', arguments: submitArgs });
  const txHash = extractTxHash(submitResult);
  if (!txHash) {
    return { ok: false, refusalCode: 'SUBMISSION_FAILED', detail: 'submit_registry_tx did not return a recognisable transaction hash' };
  }

  return { ok: true, value: { txHash, ownerWalletAddress: wallet.address, network } };
}

// ── Step 3: check status (single attempt — caller re-invokes on an interval) ──

export interface CheckAgentRegistrationStatusInput {
  /**
   * Horizen's REQUIRED `agentId` for `get_onboarding_status`. Carried forward
   * from the registration that produced the transaction. Absent means the
   * check cannot be made — see the refusal in the function body.
   */
  horizenAgentId?: string | null;
  agentSlug: string;
  txHash: string;
  ownerWalletAddress: string;
  network: HorizenNetwork;
  actorPersonaId: string;
}

export interface AgentRegistrationStatus {
  confirmed: boolean;
  tokenId: string | null;
  registryAlias: string | null;
  /**
   * Horizen's own human-readable-page path identifier (e.g. `0xZkSignalAgent`)
   * — resolved from a DISTINCT reread field, never defaulted from tokenId
   * (operator ruling 2026-07-31; see services/horizen/agentPageUrl.ts).
   */
  agentIdentifier: string | null;
  /** Present only once agentIdentifier resolves — never a guessed URL. */
  humanReadableUrl: string | null;
  rawStatus: string;
  receiptId: string | null;
}

function flattenToolResultText(result: McpToolResult | null | undefined): string {
  if (Array.isArray(result?.content)) {
    return result!.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join(' ').toLowerCase();
  }
  return JSON.stringify(result ?? {}).toLowerCase();
}

export async function checkAgentRegistrationStatus(
  input: CheckAgentRegistrationStatusInput,
  deps: RegistrationDeps = {},
): Promise<RegistrationResult<AgentRegistrationStatus>> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `"${input.agentSlug}" is not a registrable agent` };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { byName } = await listRegistrationTools(mcpClient);
  if (!byName.get_onboarding_status) {
    return { ok: false, refusalCode: 'REGISTRATION_TOOL_NOT_FOUND', detail: 'Horizen\'s MCP server does not currently declare a "get_onboarding_status" tool' };
  }
  /*
   * `agentId` IS REQUIRED, AND WE WERE NEVER SENDING IT (2026-08-02).
   *
   * The operator surfaced the raw answer after twenty "not confirmed" checks:
   *
   *   MCP error -32602: Invalid arguments for tool get_onboarding_status:
   *     path: ["agentId"]  expected: "string"  received: "undefined"  Required
   *
   * So not one of those twenty calls ever asked Horizen anything. Every reply
   * was a schema rejection, and the code below read it as an ANSWER — the
   * error text simply did not contain 'active' | 'confirmed' | 'complete', so
   * `confirmed` came out false and the surface reported "Horizen has not
   * confirmed this registration". A tool that refused to run was rendered as a
   * chain that had not confirmed. Those are not the same fact, and the second
   * one is about the operator's transaction.
   *
   * WHICH VALUE. Horizen addresses a registered agent by its OWNER WALLET
   * ADDRESS — the registry reread below is literally
   * `fetchAgent(input.ownerWalletAddress, input.network)`. That is the best
   * evidence available for what `agentId` means here, so it leads. The agent's
   * runtime id is offered under the other synonyms; `matchSchemaFields` only
   * emits keys the declared schema actually has, so offering more candidates
   * cannot send a field Horizen did not ask for.
   *
   * If this is still the wrong value, the refusal below now NAMES the rejected
   * argument and prints what was sent — the next failure diagnoses itself
   * instead of costing another twenty checks.
   */
  /*
   * NO IDENTIFIER, NO CALL (operator direction via Al, 2026-08-02).
   *
   * If the tool declares `agentId` and we have nothing real to put in it, the
   * check CANNOT be made — and making it anyway is what produced twenty
   * rejections rendered as twenty negative answers. Refused here, before the
   * call, in terms that separate the two facts: the check is misconfigured;
   * the transaction is not.
   *
   * ── The wallet fallback is REMOVED (operator direction via Al, 2026-08-02) ─
   *
   *   > "fetchAgent(ownerWalletAddress, network) being wallet-keyed does not
   *   >  prove that get_onboarding_status.agentId accepts a wallet address.
   *   >  Those are different tool contracts. Passing the wallet as agentId
   *   >  could produce a misleading negative rather than an explicit
   *   >  configuration error."
   *
   * Correct, and it is the more dangerous of the two failure modes: a refusal
   * says "we could not ask"; a wallet Horizen does not recognise as an agentId
   * may come back as a clean, confident "not registered" about a registration
   * that exists. Only an identifier Horizen itself produced is sent. Nothing
   * is substituted.
   */
  const declaresAgentId = /agentId/.test(JSON.stringify(byName.get_onboarding_status.inputSchema ?? {}));

  /*
   * RECOVERY HOP 3 — ASK HORIZEN'S OWN REGISTRY (operator direction via Al).
   *
   *   prepared identifier -> receipt -> REGISTRY RECORD -> transaction event -> stop
   *
   * Hops 1 and 2 only help registrations prepared AFTER the identifier began
   * being persisted. The pilot's transaction predates that, so it has nothing
   * to recover from and the refusal fires — correctly, but with no way
   * forward.
   *
   * This is hop 3: read the registry record Horizen itself keeps and take the
   * identifier IF the response explicitly contains one. That is not the wallet
   * substitution Al struck out — the wallet is the LOOKUP KEY for a read whose
   * ANSWER carries Horizen's own identifier. Nothing is inferred: absent means
   * absent, and the refusal still fires.
   */
  let recoveredAgentId: string | null = null;
  if (declaresAgentId && !input.horizenAgentId?.trim()) {
    try {
      const lookup = deps.fetchRegistryAgent ?? defaultFetchRegistryAgent;
      const record = await lookup(input.ownerWalletAddress, input.network);
      if (record.ok) {
        recoveredAgentId = pickStringField(record.value, ['agentId', 'agentIdentifier', 'identifier', 'tokenId']);
      }
    } catch {
      // A failed lookup is not an answer about the registration. Left null so
      // the refusal below reports honestly rather than this becoming a
      // silent second failure mode.
    }
  }

  const agentIdToSend = input.horizenAgentId?.trim() || recoveredAgentId || null;
  if (declaresAgentId && !agentIdToSend) {
    return {
      ok: false,
      refusalCode: 'STATUS_UNAVAILABLE',
      detail:
        'Horizen status could not be checked because the registration\'s agent identifier was unavailable — ' +
        'it was not returned when the registration was built, is not on the submission receipt, and Horizen\'s ' +
        `registry holds no identifier for ${input.ownerWalletAddress} on ${input.network}. ` +
        `The on-chain transaction (${input.txHash}) remains valid. Do not re-register.`,
    };
  }

  const statusArgs = matchSchemaFields(byName.get_onboarding_status.inputSchema, {
    agentId: agentIdToSend,
    // The wallet address is still offered under WALLET-named fields, where it
    // is unambiguously a wallet. It is never offered as an agent identifier.
    ownerAddress: input.ownerWalletAddress,
    walletAddress: input.ownerWalletAddress,
    agentSlug: agent.slug,
    runtimeAgentId: agent.runtimeAgentId,
    transactionHash: input.txHash,
    txHash: input.txHash,
    hash: input.txHash,
    network: input.network,
    chain: input.network,
  });
  const statusResult = await mcpClient.callTool({ name: 'get_onboarding_status', arguments: statusArgs });
  const statusText = flattenToolResultText(statusResult);
  const rawStatus = JSON.stringify(statusResult).slice(0, 500);

  /*
   * A TOOL THAT REFUSED TO RUN IS NOT A NEGATIVE ANSWER.
   *
   * Checked BEFORE the confirmation heuristic, because the heuristic cannot
   * tell them apart: a validation error contains none of the success words and
   * so silently becomes `confirmed: false`. Reported as a refusal that names
   * the argument Horizen rejected and the arguments we sent.
   */
  const rejected = describeRejectedArguments(statusResult);
  if (rejected) {
    return {
      ok: false,
      refusalCode: 'STATUS_UNAVAILABLE',
      detail:
        `Horizen refused the status check itself — ${rejected}. This says NOTHING about the transaction: ` +
        'it was broadcast and stands, and nothing needs re-registering. ' +
        `Arguments sent: ${JSON.stringify(statusArgs)}. Raw result: ${rawStatus}`,
    };
  }

  const confirmed = statusText.includes('active') || statusText.includes('confirmed') || statusText.includes('complete');

  if (!confirmed) {
    return { ok: true, value: { confirmed: false, tokenId: null, registryAlias: null, agentIdentifier: null, humanReadableUrl: null, rawStatus, receiptId: null } };
  }

  const fetchAgent = deps.fetchRegistryAgent ?? defaultFetchRegistryAgent;
  const reread = await fetchAgent(input.ownerWalletAddress, input.network);
  if (!reread.ok) {
    return { ok: false, refusalCode: 'REGISTRY_REREAD_FAILED', detail: `registry reread failed: ${reread.reason}` };
  }
  const tokenId = pickStringField(reread.value, ['tokenId', 'agentId', 'id']);
  const registryAlias = pickStringField(reread.value, ['registryAlias', 'alias']) ?? (tokenId ? `0x${BigInt(tokenId).toString(16)}` : null);
  // DISTINCT field, deliberately not overlapping tokenId's candidate names —
  // operator ruling 2026-07-31: never conflate the two without confirmation
  // from Horizen's real response. Absent means "not yet resolvable", not
  // "same as tokenId".
  const agentIdentifier = pickStringField(reread.value, ['agentIdentifier', 'identifier', 'slug']);
  const humanReadableUrl = agentIdentifier ? buildHorizenAgentPageUrl(agentIdentifier, input.network) : null;

  let receiptId: string | null = null;
  if (tokenId && registryAlias) {
    if (deps.updateRegistryAssetBinding) {
      await deps.updateRegistryAssetBinding(agent.aigentQubeId, { tokenId, registryAlias, agentIdentifier, humanReadableUrl });
    }
    if (deps.createRegistrationReceipt) {
      receiptId = await deps.createRegistrationReceipt({ actorPersonaId: input.actorPersonaId, agent, network: input.network, txHash: input.txHash });
    }
  }

  return { ok: true, value: { confirmed: true, tokenId, registryAlias, agentIdentifier, humanReadableUrl, rawStatus, receiptId } };
}

function pickStringField(obj: Record<string, unknown> | null | undefined, names: string[]): string | null {
  if (!obj) return null;
  for (const n of names) {
    const v = obj[n];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}
