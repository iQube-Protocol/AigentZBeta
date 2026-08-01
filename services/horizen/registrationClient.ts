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
 * Horizen's build_registration_tx (confirmed live via its own Zod validation
 * error, 2026-07-31) wants a `services` array alongside name/description —
 * built from the Agent Card's own already-published `skills`, never invented.
 * If Horizen's deeper (per-item) validation wants a different shape, that
 * will surface as a fresh UNSIGNED_TX_UNAVAILABLE with the raw error visible
 * (see below) — never guessed further ahead of that evidence.
 */
function buildServicesFromCard(card: Record<string, unknown>): Array<{ name?: string; description?: string }> {
  const skills = Array.isArray(card.skills) ? card.skills : [];
  return skills
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      name: typeof s.name === 'string' ? s.name : undefined,
      description: typeof s.description === 'string' ? s.description : undefined,
    }));
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

interface UnsignedTx {
  to?: string;
  data?: string;
  value?: string | number;
  chainId?: string | number;
}

/** Mirrors scripts/register-moneypenny-horizen.ts's extractUnsignedTx — moved here so the script and this service share one implementation (never a second copy, inv.engineering.036/037). */
export function extractUnsignedTx(toolResult: McpToolResult | null | undefined): UnsignedTx | null {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === 'text' && typeof item.text === 'string') {
      try {
        const parsed = JSON.parse(item.text);
        if (parsed?.to && parsed?.data) return parsed;
        if (parsed?.transaction?.to && parsed?.transaction?.data) return parsed.transaction;
        if (parsed?.unsignedTransaction) return parsed.unsignedTransaction;
      } catch {
        // not JSON — keep looking
      }
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
      detail:
        'could not locate an unsigned transaction in build_registration_tx\'s result. ' +
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

  return {
    ok: true,
    value: { agentSlug: agent.slug, agentCardUrl: cardUrl, agentCardHash: sha256Hex(cardRaw), network, unsignedTx },
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
  const statusArgs = matchSchemaFields(byName.get_onboarding_status.inputSchema, {
    transactionHash: input.txHash,
    txHash: input.txHash,
    hash: input.txHash,
    network: input.network,
    chain: input.network,
  });
  const statusResult = await mcpClient.callTool({ name: 'get_onboarding_status', arguments: statusArgs });
  const statusText = flattenToolResultText(statusResult);
  const rawStatus = JSON.stringify(statusResult).slice(0, 500);
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
