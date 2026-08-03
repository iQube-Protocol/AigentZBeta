/**
 * Horizen authorization client — EXPLICIT MUTATION ORCHESTRATION.
 *
 * GJR-VFY-001 Phase 1 (operator ruling 2026-07-31). Companion to the
 * read-only `services/horizen/client.ts`, which stays read-only per its own
 * header — every mutating step for Horizen's Pulse/PnL transparency
 * authorization lives here instead, never folded into the read client.
 *
 * SCOPE DISCIPLINE: this is a Horizen-specific orchestrator, not a universal
 * "partner authorization" abstraction — that generalization is explicitly
 * deferred (SIGNING-SPINE-001). What IS generalized here (via
 * `./mcpSchemaMatch` and `@/services/signing/partnerAuthorizationSigner`) is
 * only the safe MECHANICS already proven in
 * `scripts/register-moneypenny-horizen.ts`: live tool discovery, schema
 * matching, defensive extraction, network/contract cross-checks, local
 * signing, submission, authoritative reread, and refusal on mismatch.
 *
 * NO HARDCODED PULSE TOOL NAMES. `build_pulse_auth_message` /
 * `enable_pulse_monitoring` / `get_onboarding_status` are the spec's
 * PROVISIONAL LABELS, tried first as exact-name candidates, with a
 * schema-shape fallback if the live server declares different names. If
 * neither yields a compatible tool for a required role, this refuses with
 * `HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND` rather than guessing a call shape.
 *
 * PARTNER CONFIRMATION IS NOT OPTIONAL: a locally valid signature does not
 * complete anything until Horizen accepts the submission AND an authoritative
 * reread confirms the resulting state (`SIGNED`/`SUBMITTED`/`CONFIRMED` are
 * never collapsed).
 */

import { createHash } from 'crypto';
import { HORIZEN_NETWORK_FACTS, parseAgentId, type HorizenNetwork } from './identity';
import { HORIZEN_REGISTRY_MCP, fetchRegistryAgent as defaultFetchRegistryAgent, type HorizenRead } from './client';
import { findCompatibleTool, matchSchemaFields, extractStringField, extractPartnerMessage, describeToolResultShape, type McpTool, type McpToolResult } from './mcpSchemaMatch';
import {
  signPartnerAuthorization,
  type ResolveSigningKey,
  type PartnerAuthorizationSignature,
} from '@/services/signing/partnerAuthorizationSigner';
import {
  createPartnerAuthorizationRequest,
  updatePartnerAuthorizationRequest,
  getPartnerAuthorizationRequest,
  type PartnerAuthorizationState,
} from './partnerAuthorizationStore';

// ── Types (GJR-VFY-001 §6, §8) ──────────────────────────────────────────────

export interface HorizenTransparencyAuthorization {
  version: string;
  aigentQubeId: string;
  agentCardHash: string;
  registry: {
    protocol: 'erc-8004';
    network: HorizenNetwork;
    contract: string;
    tokenId: string;
    registryAlias?: string;
  };
  controllerWallet: string;
  authorization: {
    pulseMonitoring: true;
    pnlDisclosure: true;
    purpose: 'horizen-financial-transparency';
    scope: string[];
  };
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  messageHash: string;
}

/**
 * UI-surface states (spec §8) — a superset of the persisted
 * `PartnerAuthorizationState`. `NOT_AVAILABLE`/`READY` describe a state
 * BEFORE any row exists (no capability wired yet / ready to prepare); every
 * other value corresponds 1:1 to a `partner_authorization_requests.state`.
 */
export type TransparencyAuthorizationState = 'NOT_AVAILABLE' | 'READY' | PartnerAuthorizationState;

export type HorizenAuthorizationRefusalCode =
  | 'INVALID_REQUEST'
  | 'MISSING_TOKEN_ID'
  | 'NETWORK_OR_CONTRACT_MISMATCH'
  | 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND'
  | 'PARTNER_MESSAGE_UNAVAILABLE'
  | 'NONCE_MISSING_OR_REPLAYED'
  | 'AUTHORIZATION_EXPIRED'
  | 'SIGNING_FAILED'
  | 'HORIZEN_SUBMISSION_FAILED'
  | 'REGISTRY_REREAD_FAILED'
  | 'REGISTRY_OWNER_MISMATCH'
  | 'HORIZEN_REREAD_NOT_CONFIRMED'
  | 'STATE_MISMATCH';

export type AuthorizationResult<T> =
  | { ok: true; value: T }
  | { ok: false; refusalCode: HorizenAuthorizationRefusalCode; detail: string };

// ── Injected dependencies (never touched by Phase 1 tests — always mocked) ──

export interface PartnerMcpClient {
  listTools(): Promise<{ tools: McpTool[] }>;
  callTool(args: { name: string; arguments: Record<string, unknown> }): Promise<McpToolResult>;
}

async function defaultMcpClient(): Promise<PartnerMcpClient> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'metame-horizen-authorization-client', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(HORIZEN_REGISTRY_MCP)));
  return client as unknown as PartnerMcpClient;
}

export interface AuthorizationDeps {
  mcpClient?: PartnerMcpClient;
  fetchRegistryAgent?: (registryAlias: string, network: HorizenNetwork) => Promise<HorizenRead<Record<string, unknown>>>;
  resolveSigningKey?: ResolveSigningKey;
  now?: () => Date;
  randomNonce?: () => string;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

const BUILD_TOOL_SPEC = {
  role: 'build',
  nameCandidates: ['build_pulse_auth_message'],
  requiredFieldHints: ['tokenid', 'agentid', 'network', 'wallet', 'address'],
};
const SUBMIT_TOOL_SPEC = {
  role: 'submit',
  nameCandidates: ['enable_pulse_monitoring'],
  requiredFieldHints: ['signature', 'signedmessage', 'signedpayload', 'authorization'],
};
const STATUS_TOOL_SPEC = {
  role: 'status',
  nameCandidates: ['get_onboarding_status', 'get_pulse_status', 'pulse_status', 'pulse-status'],
  requiredFieldHints: ['tokenid', 'agentid', 'transactionhash', 'txhash', 'submissionref'],
};

// ── Stage 1: prepare ─────────────────────────────────────────────────────

export interface PrepareHorizenTransparencyAuthorizationInput {
  authorizationId: string;
  /** The operator's own persona — the principal recording this act, resolved by the caller via the identity spine. Never derived from aigentQubeId. */
  actorPersonaId: string;
  aigentQubeId: string;
  agentCardHash: string;
  controllerWallet: string;
  keyRef: string;
  registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
  scope: string[];
  expiresInSeconds?: number;
}

export interface PreparedAuthorization {
  authorizationId: string;
  actorPersonaId: string;
  envelope: HorizenTransparencyAuthorization;
  /** The exact partner-supplied message text this envelope's signature must be produced over. Preserved verbatim, never altered. */
  message: string;
}

export async function prepareHorizenTransparencyAuthorization(
  input: PrepareHorizenTransparencyAuthorizationInput,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<PreparedAuthorization>> {
  if (!input.actorPersonaId || !input.aigentQubeId || !input.agentCardHash || !input.controllerWallet || !input.keyRef || !input.scope?.length) {
    return { ok: false, refusalCode: 'INVALID_REQUEST', detail: 'actorPersonaId, aigentQubeId, agentCardHash, controllerWallet, keyRef and a non-empty scope are all required' };
  }
  if (!input.registry?.tokenId) {
    return { ok: false, refusalCode: 'MISSING_TOKEN_ID', detail: 'registry.tokenId is required' };
  }
  const facts = HORIZEN_NETWORK_FACTS[input.registry.network];
  if (!facts) {
    return { ok: false, refusalCode: 'NETWORK_OR_CONTRACT_MISMATCH', detail: `"${input.registry.network}" is not a recognised Horizen network` };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { tools } = await mcpClient.listTools();
  const buildTool = findCompatibleTool(tools, BUILD_TOOL_SPEC, new Set());
  if (!buildTool.ok) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND',
      detail: `no tool compatible with role "build" declared by Horizen's MCP server. Declared tools: ${buildTool.declaredToolNames.join(', ') || '(none)'}`,
    };
  }

  /*
   * CONFORM TO THE DOCUMENTED CONTRACT, NOT TO WHAT HAPPENED TO COMPILE
   * (Horizen partner Q&A, relayed 2026-08-03).
   *
   * Pulse authorization is a Horizen capability layered ON TOP of ERC-8004
   * registration, not part of it. Its message is byte-exact plaintext and the
   * arguments that produce it are specified:
   *
   *   ASR Pulse enable
   *   Agent: 7866                      <- DECIMAL, never hex, never a label
   *   Network: sepolia
   *   Chain: 84532                     <- the CHAIN ID, not a network name
   *   Registry: 0x8004a818…            <- LOWERCASED
   *   Wallet: 0x…                      <- LOWERCASED, and must equal ownerOf(agentId)
   *   Issued At: <ISO-8601>
   *
   * Every one of those facts already lived in `HORIZEN_NETWORK_FACTS` and
   * `parseAgentId` (services/horizen/identity.ts) — this call simply wasn't
   * reading them. `chain` was being sent the string 'base-sepolia' where the
   * chain id 84532 belongs, and the network selector was the raw key rather
   * than `facts.pulseSelector`. That is inv.engineering.036/037 in its usual
   * shape: the authoritative source existed and a consumer bypassed it.
   */
  const parsedAgentId = parseAgentId(input.registry.tokenId);
  if (!parsedAgentId.ok) {
    return {
      ok: false,
      refusalCode: 'INVALID_REQUEST',
      detail: `registry.tokenId "${input.registry.tokenId}" is not a usable agent id (${parsedAgentId.reason}): ${parsedAgentId.detail}`,
    };
  }
  // Hex in the registry, decimal in Pulse/PnL — the partner Q&A is explicit
  // that these are the SAME identifier and must be normalised via BigInt.
  const decimalAgentId = parsedAgentId.value.toString(10);

  const buildArgs = matchSchemaFields(buildTool.tool.inputSchema, {
    tokenId: decimalAgentId,
    agentId: decimalAgentId,
    network: facts.pulseSelector,
    chain: facts.chainId,
    chainId: facts.chainId,
    registry: facts.identityRegistry.toLowerCase(),
    registryAddress: facts.identityRegistry.toLowerCase(),
    wallet: input.controllerWallet.toLowerCase(),
    address: input.controllerWallet.toLowerCase(),
  });
  const buildResult = await mcpClient.callTool({ name: buildTool.tool.name, arguments: buildArgs });
  const MESSAGE_FIELDS = ['message', 'payload', 'authMessage', 'messageToSign', 'authorizationMessage'];
  /*
   * Named field first; a lone non-error text block accepted as the message
   * second (Horizen's `build_pulse_auth_message` returns exactly that — 265
   * chars of plain text, established by the diagnostic refusal on 2026-08-03,
   * not assumed). Every refusal below still names what the partner actually
   * sent, because the next unknown shape should cost one line to diagnose.
   */
  const extracted = extractPartnerMessage(buildResult, MESSAGE_FIELDS);
  if (!extracted.ok) {
    return {
      ok: false,
      refusalCode: 'PARTNER_MESSAGE_UNAVAILABLE',
      detail:
        `"${buildTool.tool.name}" did not return a usable message — refusing rather than inventing one. ` +
        `${extracted.reason}. Looked for fields: ${MESSAGE_FIELDS.join(', ')}. ` +
        `Actually returned: ${describeToolResultShape(buildResult)}`,
    };
  }
  const message = extracted.message;

  const now = deps.now ?? (() => new Date());
  const nonce = deps.randomNonce ? deps.randomNonce() : sha256Hex(`${input.authorizationId}:${now().toISOString()}:${Math.random()}`).slice(0, 32);
  const issuedAt = now().toISOString();
  const expiresAt = new Date(now().getTime() + (input.expiresInSeconds ?? 900) * 1000).toISOString();

  const created = await createPartnerAuthorizationRequest({
    authorizationId: input.authorizationId,
    purpose: 'horizen-financial-transparency',
    subjectAigentQubeId: input.aigentQubeId,
    keyRef: input.keyRef,
    partner: 'horizen',
    network: input.registry.network,
    nonce,
    expiresAt,
  });
  if (!created.ok) {
    return { ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED', detail: created.detail };
  }

  const envelope: HorizenTransparencyAuthorization = {
    version: '1.0',
    aigentQubeId: input.aigentQubeId,
    agentCardHash: input.agentCardHash,
    registry: {
      protocol: 'erc-8004',
      network: input.registry.network,
      contract: facts.identityRegistry,
      tokenId: input.registry.tokenId,
      registryAlias: input.registry.registryAlias,
    },
    controllerWallet: input.controllerWallet,
    authorization: {
      pulseMonitoring: true,
      pnlDisclosure: true,
      purpose: 'horizen-financial-transparency',
      scope: input.scope,
    },
    nonce,
    issuedAt,
    expiresAt,
    messageHash: sha256Hex(message),
  };

  await updatePartnerAuthorizationRequest(input.authorizationId, { state: 'PREPARED', payloadHash: envelope.messageHash });

  return { ok: true, value: { authorizationId: input.authorizationId, actorPersonaId: input.actorPersonaId, envelope, message } };
}

// ── Stage 2: sign ────────────────────────────────────────────────────────

export async function signHorizenTransparencyAuthorization(
  prepared: PreparedAuthorization,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<PartnerAuthorizationSignature>> {
  const record = await getPartnerAuthorizationRequest(prepared.authorizationId);
  if (!record || record.state !== 'PREPARED') {
    return { ok: false, refusalCode: 'STATE_MISMATCH', detail: `authorization "${prepared.authorizationId}" is not in PREPARED state` };
  }
  await updatePartnerAuthorizationRequest(prepared.authorizationId, { state: 'AWAITING_SIGNATURE' });

  const signed = await signPartnerAuthorization(
    {
      keyRef: record.keyRef,
      payload: prepared.message,
      purpose: record.purpose,
      expectedSigner: prepared.envelope.controllerWallet,
      network: record.network,
      expiresAt: record.expiresAt,
    },
    { resolveSigningKey: deps.resolveSigningKey, now: deps.now },
  );
  if (!signed.ok) {
    const refusalCode = signed.refusalCode === 'EXPIRED' ? 'AUTHORIZATION_EXPIRED' : 'SIGNING_FAILED';
    await updatePartnerAuthorizationRequest(prepared.authorizationId, { state: 'REFUSED', refusalCode, refusalDetail: signed.detail });
    return { ok: false, refusalCode, detail: signed.detail };
  }

  await updatePartnerAuthorizationRequest(prepared.authorizationId, {
    state: 'SIGNED',
    signerAddress: signed.result.signerAddress,
    signatureRef: sha256Hex(signed.result.signature),
  });
  return { ok: true, value: signed.result };
}

// ── Stage 3: submit ──────────────────────────────────────────────────────

export async function submitHorizenTransparencyAuthorization(
  authorizationId: string,
  args: { message: string; signature: PartnerAuthorizationSignature },
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ submissionRef: string }>> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record || record.state !== 'SIGNED') {
    return { ok: false, refusalCode: 'STATE_MISMATCH', detail: `authorization "${authorizationId}" is not in SIGNED state` };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { tools } = await mcpClient.listTools();
  const submitTool = findCompatibleTool(tools, SUBMIT_TOOL_SPEC, new Set());
  if (!submitTool.ok) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND',
      detail: `no tool compatible with role "submit" declared by Horizen's MCP server. Declared tools: ${submitTool.declaredToolNames.join(', ') || '(none)'}`,
    };
  }

  const submitArgs = matchSchemaFields(submitTool.tool.inputSchema, {
    message: args.message,
    signature: args.signature.signature,
    signedMessage: args.signature.signature,
    signedPayload: args.signature.signature,
    signerAddress: args.signature.signerAddress,
    network: record.network,
  });
  const submitResult = await mcpClient.callTool({ name: submitTool.tool.name, arguments: submitArgs });
  const SUBMISSION_FIELDS = ['submissionRef', 'transactionHash', 'txHash', 'hash', 'id'];
  const submissionRef = extractStringField(submitResult, SUBMISSION_FIELDS);
  if (!submissionRef) {
    // Same diagnostic treatment as the build stage — an unrecognised partner
    // response must be reportable without reverse-engineering the integration.
    const detail =
      `"${submitTool.tool.name}" did not return a recognisable submission reference. ` +
      `Looked for: ${SUBMISSION_FIELDS.join(', ')}. Actually returned: ${describeToolResultShape(submitResult)}`;
    await updatePartnerAuthorizationRequest(authorizationId, {
      state: 'REFUSED',
      refusalCode: 'HORIZEN_SUBMISSION_FAILED',
      refusalDetail: detail,
    });
    return { ok: false, refusalCode: 'HORIZEN_SUBMISSION_FAILED', detail };
  }

  await updatePartnerAuthorizationRequest(authorizationId, { state: 'SUBMITTED', submissionRef });
  return { ok: true, value: { submissionRef } };
}

// ── Stage 4: verify ──────────────────────────────────────────────────────

function pickStringField(obj: Record<string, unknown> | null | undefined, names: string[]): string | null {
  if (!obj) return null;
  for (const n of names) {
    const v = obj[n];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * Flattens an MCP tool result's text content into one lowercase string for a
 * keyword confirmation check. `JSON.stringify(toolResult)` on the WRAPPED
 * `{content:[{type:'text',text:...}]}` shape double-escapes the inner JSON's
 * quotes, so a literal `'"active"'` search never matches — this joins the
 * actual text bodies instead of stringifying the wrapper around them.
 */
function flattenToolResultText(result: McpToolResult | null | undefined): string {
  if (Array.isArray(result?.content)) {
    return result!.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join(' ').toLowerCase();
  }
  return JSON.stringify(result ?? {}).toLowerCase();
}

export async function verifyHorizenTransparencyActivation(
  authorizationId: string,
  args: { actorPersonaId: string; registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string }; controllerWallet: string },
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ confirmed: true }>> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record || record.state !== 'SUBMITTED') {
    return { ok: false, refusalCode: 'STATE_MISMATCH', detail: `authorization "${authorizationId}" is not in SUBMITTED state` };
  }

  const fetchAgent = deps.fetchRegistryAgent ?? defaultFetchRegistryAgent;
  const reread = await fetchAgent(args.registry.registryAlias ?? args.registry.tokenId, args.registry.network);
  if (!reread.ok) {
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: 'REGISTRY_REREAD_FAILED', refusalDetail: reread.reason });
    return { ok: false, refusalCode: 'REGISTRY_REREAD_FAILED', detail: `registry reread failed: ${reread.reason}` };
  }
  const owner = pickStringField(reread.value, ['owner', 'ownerAddress', 'controller', 'controllerWallet']);
  if (owner && owner.toLowerCase() !== args.controllerWallet.toLowerCase()) {
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: 'REGISTRY_OWNER_MISMATCH', refusalDetail: `registry owner ${owner} != controller ${args.controllerWallet}` });
    return { ok: false, refusalCode: 'REGISTRY_OWNER_MISMATCH', detail: `registry-reread owner (${owner}) does not match the controller wallet (${args.controllerWallet})` };
  }

  const mcpClient = deps.mcpClient ?? (await defaultMcpClient());
  const { tools } = await mcpClient.listTools();
  const statusTool = findCompatibleTool(tools, STATUS_TOOL_SPEC, new Set());
  if (!statusTool.ok) {
    return {
      ok: false,
      refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND',
      detail: `no tool compatible with role "status" declared by Horizen's MCP server. Declared tools: ${statusTool.declaredToolNames.join(', ') || '(none)'}`,
    };
  }
  const statusArgs = matchSchemaFields(statusTool.tool.inputSchema, {
    tokenId: args.registry.tokenId,
    agentId: args.registry.tokenId,
    submissionRef: record.submissionRef ?? '',
    transactionHash: record.submissionRef ?? '',
    network: args.registry.network,
  });
  const statusResult = await mcpClient.callTool({ name: statusTool.tool.name, arguments: statusArgs });
  const statusText = flattenToolResultText(statusResult);
  const confirmed = statusText.includes('active') || statusText.includes('confirmed') || statusText.includes('enabled') || statusText.includes('complete');
  const rawStatus = JSON.stringify(statusResult).slice(0, 500);
  if (!confirmed) {
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', refusalDetail: rawStatus, partnerStatus: rawStatus });
    return { ok: false, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED', detail: 'authoritative reread did not confirm activation — a valid signature is not completion without it' };
  }

  const { createActivityReceipt } = await import('@/services/receipts/activityReceiptService');
  let receiptRef: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: args.actorPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'horizen_pulse_authorized',
      summary: `Horizen Pulse/PnL transparency authorization confirmed for ${record.subjectAigentQubeId} (token ${args.registry.tokenId}, ${args.registry.network})`,
      actionInput: {
        aigentQubeId: record.subjectAigentQubeId,
        controllerWallet: args.controllerWallet,
        tokenId: args.registry.tokenId,
        network: args.registry.network,
        authorizationId,
        signatureRef: record.signatureRef,
        submissionRef: record.submissionRef,
      },
    });
    receiptRef = receipt?.id ?? null;
  } catch {
    // Receipt failure never re-opens a partner-confirmed authorization; it is
    // surfaced as a null receiptRef for the caller to retry recording.
  }

  await updatePartnerAuthorizationRequest(authorizationId, {
    state: 'CONFIRMED',
    partnerStatus: rawStatus,
    receiptRef: receiptRef ?? undefined,
  });

  return { ok: true, value: { confirmed: true } };
}

// ── Full pipeline convenience wrapper (Phase 1 acceptance criterion) ────────

export async function runHorizenTransparencyAuthorization(
  input: PrepareHorizenTransparencyAuthorizationInput,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ authorizationId: string; receiptRef: string | null }>> {
  const prepared = await prepareHorizenTransparencyAuthorization(input, deps);
  if (!prepared.ok) return prepared;

  const signed = await signHorizenTransparencyAuthorization(prepared.value, deps);
  if (!signed.ok) return signed;

  const submitted = await submitHorizenTransparencyAuthorization(
    prepared.value.authorizationId,
    { message: prepared.value.message, signature: signed.value },
    deps,
  );
  if (!submitted.ok) return submitted;

  const verified = await verifyHorizenTransparencyActivation(
    prepared.value.authorizationId,
    { actorPersonaId: input.actorPersonaId, registry: input.registry, controllerWallet: input.controllerWallet },
    deps,
  );
  if (!verified.ok) return verified;

  const finalRecord = await getPartnerAuthorizationRequest(prepared.value.authorizationId);
  return { ok: true, value: { authorizationId: prepared.value.authorizationId, receiptRef: finalRecord?.receiptRef ?? null } };
}
