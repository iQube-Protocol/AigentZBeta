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
import { findCompatibleTool, matchSchemaFields, missingRequiredFields, extractStringField, extractPartnerMessage, extractIssuedAt, describeToolResultShape, type McpTool, type McpToolResult } from './mcpSchemaMatch';
import {
  signPartnerAuthorization,
  type ResolveSigningKey,
  type PartnerAuthorizationSignature,
} from '@/services/signing/partnerAuthorizationSigner';
import {
  createPartnerAuthorizationRequest,
  updatePartnerAuthorizationRequest,
  getPartnerAuthorizationRequest,
  checkAuthorizationStoreAvailable as defaultCheckStoreAvailable,
  type AuthorizationStoreAvailability,
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
  /** build_pulse_auth_message's response named none of the shapes we can extract an issuedAt from — refusing rather than generating our own (al / Horizen brief, 2026-08-04). */
  | 'ISSUED_AT_UNAVAILABLE'
  /** enable_pulse_monitoring reported isError — a tool-level rejection (e.g. schema validation), distinct from a successful-but-unparseable response. */
  | 'HORIZEN_SUBMISSION_REJECTED'
  | 'NONCE_MISSING_OR_REPLAYED'
  | 'AUTHORIZATION_EXPIRED'
  | 'SIGNING_FAILED'
  | 'HORIZEN_SUBMISSION_FAILED'
  | 'REGISTRY_REREAD_FAILED'
  | 'REGISTRY_OWNER_MISMATCH'
  | 'HORIZEN_REREAD_NOT_CONFIRMED'
  /* The LOCAL authorization store could not be reached — checked before any
   * partner call, so this refusal always means Horizen was never asked. */
  | 'AUTHORIZATION_STORE_UNAVAILABLE'
  /**
   * The local authorization row itself could not be created (e.g. a
   * schema-drift missing column) — distinct from AUTHORIZATION_STORE_UNAVAILABLE
   * only in WHEN it was caught (the pre-flight probe vs the write itself);
   * both mean the same thing to the caller: Horizen never recorded anything
   * (al, 2026-08-04).
   */
  | 'LOCAL_PERSISTENCE_FAILED'
  /** A row for this deterministic authorizationId already exists AND has reached SUBMITTED/CONFIRMED — see partnerAuthorizationStore.ts's createPartnerAuthorizationRequest. Re-read status; never re-prepare blindly. */
  | 'AUTHORIZATION_ALREADY_IN_FLIGHT'
  /**
   * The signer module's OWN internal self-check (recovered === wallet ===
   * expectedSigner) already passed, but an INDEPENDENT re-verification —
   * recovering the signer from the EXACT message text over the FRESHLY
   * persisted record, at the orchestrator level — did not match (al,
   * 2026-08-04: "the decisive local test is recoverAddress(exactMessage,
   * signature) === ownerOf(agentId)... that should run before submission").
   * Exists to catch a FUTURE divergence between what was signed and what
   * gets submitted (e.g. a refactor that reconstructs the message from
   * parsed fields instead of threading it verbatim) before
   * enable_pulse_monitoring is ever called, not merely today's composition
   * of already-passing checks.
   */
  | 'SIGNATURE_INTEGRITY_FAILED'
  | 'STATE_MISMATCH';

/**
 * One row of a field-by-field comparison between what was SIGNED (parsed
 * from build_pulse_auth_message's exact returned text) and what was
 * SUBMITTED (the arguments actually sent to enable_pulse_monitoring) —
 * deliberately unnormalized (al, 2026-08-04: "Do not normalize values
 * before comparison. Show exact strings and lengths"). `signedValue` is
 * `null` when no matching labelled line was found in the message at all —
 * itself informative, not an error.
 */
export interface HorizenMessageFieldParityRow {
  field: string;
  signedValue: string | null;
  submittedValue: string | null;
  equal: boolean;
}

/**
 * A bounded escalation artifact (al, 2026-08-04) — produced ONLY when
 * enable_pulse_monitoring rejects a submission that verifySignatureIntegrity
 * already confirmed locally valid (recovered signer = submitted wallet =
 * registry owner). Unlike the bounded transcript in a refusal's `detail`
 * (never the message text, never the raw signature — safe for general
 * logs), THIS artifact deliberately carries the full exact message and
 * signature, because it exists for exactly one purpose: handing Horizen (or
 * an operator escalating to them) everything needed to determine whether
 * their build and enable endpoints agree on the same message, without
 * requiring a second live reproduction. Callers MUST route this to a
 * secure/restricted surface, never general logs or a broad API response —
 * this module does not decide that placement.
 */
export interface HorizenEscalationPacket {
  tokenId: string;
  network: HorizenNetwork;
  registryContract: string;
  expectedOwner: string;
  recoveredSigner: string;
  issuedAt: string;
  endpoint: string;
  messageByteLength: number;
  messageHash: string;
  exactMessage: string;
  signature: string;
  signatureLength: number;
  signatureVByte: string;
  submittedArguments: Record<string, unknown>;
  buildTool: { name: string; inputSchema: unknown; rawResult: unknown };
  submitTool: { name: string; rawResult: unknown };
  fieldParity: HorizenMessageFieldParityRow[];
  capturedAt: string;
}

export type AuthorizationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      refusalCode: HorizenAuthorizationRefusalCode;
      detail: string;
      /** Populated ONLY for HORIZEN_SUBMISSION_REJECTED, after local signature integrity already passed. See HorizenEscalationPacket's own doc comment for handling requirements. */
      escalationPacket?: HorizenEscalationPacket;
    };

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
  /** Injected by Phase 1's tests, which mock the store and must not probe it. */
  checkStoreAvailable?: () => Promise<AuthorizationStoreAvailability>;
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

/**
 * The candidate values a Pulse build call may need, offered by name for
 * `matchSchemaFields` to select from against the tool's DECLARED schema.
 *
 * ── WHY THIS IS EXPORTED (2026-08-03) ─────────────────────────────────────
 *
 * `scripts/horizen-pulse-diagnostic.ts` — the tool built expressly to stop us
 * guessing about this call — hand-rolled its own argument object instead. It
 * sent `wallet`, Horizen's schema requires `walletAddress`, and the run
 * reported `walletAddress Required` as though that were the client's defect.
 * It is not: `matchSchemaFields` matches on containment, so `walletAddress`
 * picks up the `wallet` candidate and the real client sends it correctly.
 *
 * So the diagnostic manufactured a failure the code under diagnosis does not
 * have, and cost a round trip chasing it. A diagnostic that does not execute
 * the path it claims to diagnose is worse than none — it produces confident
 * wrong answers. That is inv.engineering.036/037 landing inside the very tool
 * meant to enforce evidence over inference. One definition, both callers.
 */
export function pulseBuildCandidates(
  facts: (typeof HORIZEN_NETWORK_FACTS)[HorizenNetwork],
  decimalAgentId: string,
  controllerWallet: string,
): Record<string, unknown> {
  return {
    // Pulse enable/disable is one tool; this path only ever enables. Disabling
    // is a separate governed act and is deliberately not wired here.
    action: 'enable',
    tokenId: decimalAgentId,
    agentId: decimalAgentId,
    network: facts.pulseSelector,
    chain: facts.pulseSelector,
    chainId: facts.chainId,
    registry: facts.identityRegistry.toLowerCase(),
    registryAddress: facts.identityRegistry.toLowerCase(),
    wallet: controllerWallet.toLowerCase(),
    address: controllerWallet.toLowerCase(),
  };
}

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
  /**
   * Enrollment metadata `enable_pulse_monitoring`'s live schema requires
   * (al / Horizen brief, 2026-08-04) — NOT part of the signed message
   * (`build_pulse_auth_message`'s ASR body carries only agentId/network/
   * chain/registry/wallet/issuedAt), so these two are resolved fresh at
   * submit time rather than persisted.
   *
   * `pulseEndpoint` MUST be resolved by the caller from the agent's own
   * canonical Agent Card `services[]` entry — never invented, never the
   * Agent Card URL itself unless the card explicitly declares that as the
   * monitored service. The caller refuses locally (before this pipeline is
   * even invoked) when no eligible public HTTPS endpoint exists.
   */
  agentDisplayName: string;
  pulseEndpoint: string;
}

export interface PreparedAuthorization {
  authorizationId: string;
  actorPersonaId: string;
  envelope: HorizenTransparencyAuthorization;
  /** The exact partner-supplied message text this envelope's signature must be produced over. Preserved verbatim, never altered. */
  message: string;
  /**
   * Carried forward ONLY so a submission rejection can attach a full
   * HorizenEscalationPacket naming exactly what the build stage declared and
   * returned (al, 2026-08-04: "print the live MCP inputSchema and complete
   * successful output from build_pulse_auth_message"). Never used for any
   * decision in this pipeline — a pure diagnostic carry.
   */
  buildToolName: string;
  buildToolInputSchema: unknown;
  rawBuildResult: unknown;
}

export async function prepareHorizenTransparencyAuthorization(
  input: PrepareHorizenTransparencyAuthorizationInput,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<PreparedAuthorization>> {
  if (!input.actorPersonaId || !input.aigentQubeId || !input.agentCardHash || !input.controllerWallet || !input.keyRef || !input.scope?.length) {
    return { ok: false, refusalCode: 'INVALID_REQUEST', detail: 'actorPersonaId, aigentQubeId, agentCardHash, controllerWallet, keyRef and a non-empty scope are all required' };
  }
  if (!input.agentDisplayName || !input.pulseEndpoint) {
    return { ok: false, refusalCode: 'INVALID_REQUEST', detail: 'agentDisplayName and pulseEndpoint are required — enable_pulse_monitoring cannot enroll without them' };
  }
  if (!input.registry?.tokenId) {
    return { ok: false, refusalCode: 'MISSING_TOKEN_ID', detail: 'registry.tokenId is required' };
  }
  const facts = HORIZEN_NETWORK_FACTS[input.registry.network];
  if (!facts) {
    return { ok: false, refusalCode: 'NETWORK_OR_CONTRACT_MISMATCH', detail: `"${input.registry.network}" is not a recognised Horizen network` };
  }

  /*
   * A LOCAL PREREQUISITE IS CHECKED LOCALLY, BEFORE ANY OUTBOUND ACT
   * (operator, 2026-08-03).
   *
   * This function used to call Horizen — listTools, then build the
   * authorization message — and only afterwards try to persist the request.
   * So a missing local table surfaced as:
   *
   *   createPartnerAuthorizationRequest failed: Could not find the table
   *   'public.partner_authorization_requests' in the schema cache
   *
   * …AFTER the partner had already been asked to do work. That is backwards
   * twice over: we ask an external party for something we cannot record, and
   * the operator learns about a deploy step from a partner-facing ceremony.
   *
   * `deps.checkStoreAvailable` is injectable so Phase 1's tests, which mock
   * the store entirely, are not forced through a real availability probe.
   */
  const checkStore = deps.checkStoreAvailable ?? defaultCheckStoreAvailable;
  const storeState = await checkStore();
  if (!storeState.available) {
    return {
      ok: false,
      refusalCode: 'AUTHORIZATION_STORE_UNAVAILABLE',
      detail:
        `The local authorization store is unavailable (${storeState.kind}), so this request could not be ` +
        `recorded and Horizen was NOT called — nothing was authorized and nothing needs undoing. ` +
        `${storeState.detail}. Remedy: ${storeState.remedy}`,
    };
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

  /*
   * `chain` IS THE NETWORK SELECTOR, NOT THE CHAIN ID — corrected 2026-08-03
   * from Horizen's own schema rejection:
   *
   *   chain: expected 'base-mainnet' | 'base-sepolia', received number
   *   action: expected 'enable' | 'disable', received undefined, Required
   *
   * I had read `Chain: 84532` from the Q&A's MESSAGE BODY and applied it to
   * the tool ARGUMENT. Those are different contracts: 84532 is what Horizen
   * writes INTO the plaintext it returns; the argument that selects the
   * network is the same string selector as `network`. Converging on "the
   * contract" means the contract for the thing being called, not a
   * neighbouring one — and the tool's own declared inputSchema, which we
   * already fetch, outranks any prose about it.
   */
  const buildArgs = matchSchemaFields(buildTool.tool.inputSchema, pulseBuildCandidates(facts, decimalAgentId, input.controllerWallet));

  // Fail HERE, naming the field, rather than at the partner with a generic
  // validation dump — the schema was in hand before the call was made.
  const missing = missingRequiredFields(buildTool.tool.inputSchema, buildArgs);
  if (missing.length > 0) {
    return {
      ok: false,
      refusalCode: 'INVALID_REQUEST',
      detail:
        `"${buildTool.tool.name}" declares required argument(s) this client supplies no value for: ` +
        `${missing.join(', ')}. Declared schema: ${JSON.stringify(buildTool.tool.inputSchema?.properties ?? {})}`,
    };
  }
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

  /*
   * NEVER REGENERATE issuedAt (al / Horizen brief, 2026-08-04). This used to
   * be `now().toISOString()` — a value independently generated AFTER the
   * build call returned, with no relationship to what the signed message
   * actually says. `enable_pulse_monitoring`'s own live schema requires back
   * "the issuedAt returned by build_pulse_auth_message"; Horizen's signature
   * verification reconstructs the message server-side using ITS OWN
   * issuedAt, so submitting any other value fails verification even with an
   * otherwise-correct call. Extracted from the message text itself — never
   * generated, never guessed.
   */
  const issuedAt = extractIssuedAt(message);
  if (!issuedAt) {
    return {
      ok: false,
      refusalCode: 'ISSUED_AT_UNAVAILABLE',
      detail:
        `"${buildTool.tool.name}"'s response did not contain a recognisable issuedAt — refusing rather than ` +
        `generating one, since enable_pulse_monitoring requires back the EXACT value embedded in the signed ` +
        `message. Looked for: issuedAt="...", "Issued At: ...". Actually returned: ${describeToolResultShape(buildResult)}`,
    };
  }

  const now = deps.now ?? (() => new Date());
  const nonce = deps.randomNonce ? deps.randomNonce() : sha256Hex(`${input.authorizationId}:${now().toISOString()}:${Math.random()}`).slice(0, 32);
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
    agentId: decimalAgentId,
    walletAddress: input.controllerWallet,
    issuedAt,
  });
  if (!created.ok) {
    // Pass the store's own refusalCode through VERBATIM (fixed 2026-08-04) —
    // this used to hardcode NONCE_MISSING_OR_REPLAYED regardless of what the
    // store actually reported, mislabeling e.g. a LOCAL_PERSISTENCE_FAILED
    // schema-drift refusal as a nonce replay.
    return { ok: false, refusalCode: created.refusalCode, detail: created.detail };
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

  return {
    ok: true,
    value: {
      authorizationId: input.authorizationId,
      actorPersonaId: input.actorPersonaId,
      envelope,
      message,
      buildToolName: buildTool.tool.name,
      buildToolInputSchema: buildTool.tool.inputSchema,
      rawBuildResult: buildResult,
    },
  };
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

/**
 * A BOUNDED, SAFE diagnostic transcript (al, 2026-08-04: "If local recovery
 * does equal the ERC-8004 owner and Horizen still rejects it... output a
 * safe signature transcript and escalate it... as a contract discrepancy
 * rather than adding more inference code"). Attached ONLY when Horizen
 * rejects a submission this client already verified locally
 * (verifySignatureIntegrity ran before submit was ever called) — the point
 * is to hand a partner-facing escalation exactly the facts needed to
 * distinguish a signature-format variant this integration hasn't matched
 * from a genuine server-side defect, nothing more. Deliberately narrow:
 * message BYTE LENGTH and a HASH of it, never the message text itself; the
 * signature's length/prefix/v-byte, never anything secret (the private key
 * never reaches this function at all). Every field is a fact already
 * computed for this exact submission — nothing inferred, nothing guessed.
 */
function buildSignatureDiagnosticTranscript(args: {
  message: string;
  signature: PartnerAuthorizationSignature;
  expectedOwner: string;
  agentId: string;
  issuedAt: string;
  endpoint: string;
}): Record<string, string | number> {
  const sig = args.signature.signature;
  return {
    messageByteLength: Buffer.byteLength(args.message, 'utf8'),
    messageHash: sha256Hex(args.message),
    recoveredSigner: args.signature.signerAddress,
    expectedOwner: args.expectedOwner,
    signatureLength: sig.length,
    signaturePrefix: sig.slice(0, 10),
    signatureVByte: sig.length >= 2 ? sig.slice(-2) : '',
    agentId: args.agentId,
    issuedAt: args.issuedAt,
    endpoint: args.endpoint,
  };
}

/**
 * Parses `Label: value` lines out of the ASR message text — the format
 * every documented example uses ("Agent: 7866", "Network: sepolia",
 * "Issued At: <ISO-8601>", ...). Labels are captured EXACTLY as they appear
 * (case, spacing) so a caller can inspect what the message actually said;
 * matching against a canonical field name for the parity table below is a
 * SEPARATE, case-insensitive step, never baked into this parse.
 */
export function parseLabelledMessageFields(message: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of message.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.+?)\s*$/.exec(line);
    if (m) fields.set(m[1], m[2]);
  }
  return fields;
}

/** Every spelling variant this integration has seen or documented for each canonical field the ASR message may name — case-insensitive lookup keys only. */
const FIELD_LABEL_CANDIDATES: Record<string, string[]> = {
  agentId: ['agent', 'agentid', 'agent id'],
  name: ['name'],
  endpoint: ['endpoint'],
  walletAddress: ['wallet', 'walletaddress', 'wallet address'],
  issuedAt: ['issued at', 'issuedat'],
  action: ['action'],
  network: ['network'],
  chain: ['chain'],
  chainId: ['chain id', 'chainid'],
  registry: ['registry', 'registry address', 'registry contract'],
};

/**
 * The field-by-field parity report (al, 2026-08-04): "Parse every factual
 * field from the signed text and produce a parity report... Do not
 * normalize values before comparison. Show exact strings and lengths."
 * Exact string equality only — no case-folding, no trimming beyond what the
 * line parser already does to isolate the value from its label, no address
 * checksum normalization. A field absent from BOTH is still reported
 * (`equal: false` when either side is null) so a caller sees explicitly
 * that no comparison could be made, rather than the row being silently
 * dropped.
 */
export function buildFieldParityTable(message: string, submitted: Record<string, unknown>): HorizenMessageFieldParityRow[] {
  const parsedLabels = parseLabelledMessageFields(message);
  const lowerLabelMap = new Map<string, string>();
  for (const [label, value] of parsedLabels) lowerLabelMap.set(label.toLowerCase(), value);

  return Object.entries(FIELD_LABEL_CANDIDATES).map(([field, candidates]) => {
    let signedValue: string | null = null;
    for (const candidate of candidates) {
      if (lowerLabelMap.has(candidate)) {
        signedValue = lowerLabelMap.get(candidate)!;
        break;
      }
    }
    const raw = submitted[field];
    const submittedValue = raw === undefined || raw === null ? null : String(raw);
    return {
      field,
      signedValue,
      submittedValue,
      equal: signedValue !== null && submittedValue !== null && signedValue === submittedValue,
    };
  });
}

/**
 * Assembles the bounded escalation artifact — see HorizenEscalationPacket's
 * own doc comment for what this is for and how it must be handled.
 */
function buildHorizenEscalationPacket(args: {
  registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
  expectedOwner: string;
  message: string;
  signature: PartnerAuthorizationSignature;
  issuedAt: string;
  endpoint: string;
  submittedArguments: Record<string, unknown>;
  buildToolName: string;
  buildToolInputSchema: unknown;
  rawBuildResult: unknown;
  submitToolName: string;
  rawSubmitResult: unknown;
  now: () => Date;
}): HorizenEscalationPacket {
  const sig = args.signature.signature;
  return {
    tokenId: args.registry.tokenId,
    network: args.registry.network,
    registryContract: HORIZEN_NETWORK_FACTS[args.registry.network]?.identityRegistry ?? 'unknown',
    expectedOwner: args.expectedOwner,
    recoveredSigner: args.signature.signerAddress,
    issuedAt: args.issuedAt,
    endpoint: args.endpoint,
    messageByteLength: Buffer.byteLength(args.message, 'utf8'),
    messageHash: sha256Hex(args.message),
    exactMessage: args.message,
    signature: sig,
    signatureLength: sig.length,
    signatureVByte: sig.length >= 2 ? sig.slice(-2) : '',
    submittedArguments: args.submittedArguments,
    buildTool: { name: args.buildToolName, inputSchema: args.buildToolInputSchema, rawResult: args.rawBuildResult },
    submitTool: { name: args.submitToolName, rawResult: args.rawSubmitResult },
    fieldParity: buildFieldParityTable(args.message, args.submittedArguments),
    capturedAt: args.now().toISOString(),
  };
}

export async function submitHorizenTransparencyAuthorization(
  authorizationId: string,
  args: {
    message: string;
    signature: PartnerAuthorizationSignature;
    /**
     * Enrollment metadata NOT part of the signed message — resolved fresh by
     * the caller (never persisted, never message-critical). See
     * PrepareHorizenTransparencyAuthorizationInput's own doc comment.
     */
    agentDisplayName: string;
    endpoint: string;
    /**
     * Escalation-only carry (al, 2026-08-04) — never used for any decision
     * here. registry/expectedOwner let a rejection's escalation packet name
     * the registry contract and the owner already confirmed by
     * verifySignatureIntegrity; the build* fields let it include the build
     * stage's exact tool name/schema/raw response, all optional so this
     * function stays independently callable/testable without them.
     */
    registry?: { network: HorizenNetwork; tokenId: string; registryAlias?: string };
    expectedOwner?: string;
    buildToolName?: string;
    buildToolInputSchema?: unknown;
    rawBuildResult?: unknown;
  },
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ submissionRef: string }>> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record || record.state !== 'SIGNED') {
    return { ok: false, refusalCode: 'STATE_MISMATCH', detail: `authorization "${authorizationId}" is not in SIGNED state` };
  }
  // The three message-critical facts MUST have been persisted at prepare —
  // a row from before this correction landed cannot be resubmitted (its
  // signature was produced without them being tracked at all).
  if (!record.agentId || !record.walletAddress || !record.issuedAt) {
    return {
      ok: false,
      refusalCode: 'STATE_MISMATCH',
      detail:
        `authorization "${authorizationId}" is missing agentId/walletAddress/issuedAt — it was prepared before ` +
        `the 2026-08-04 correction and cannot be resumed. Re-run prepare to start a fresh request.`,
    };
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

  /*
   * THE FULL ENROLLMENT ENVELOPE, NOT JUST THE SIGNATURE (al / Horizen brief,
   * 2026-08-04). `enable_pulse_monitoring`'s live schema requires agentId,
   * name, endpoint, walletAddress, signature AND issuedAt — offering only
   * message/signature candidates left every one of those unmatched and sent
   * as `undefined`, which is exactly the five-field Zod rejection observed
   * live. agentId/walletAddress/issuedAt are read back from the PERSISTED
   * record — the exact values that produced the signed message, never
   * re-derived; name/endpoint come from the caller since they are not part
   * of the signed message at all.
   */
  const submitArgs = matchSchemaFields(submitTool.tool.inputSchema, {
    agentId: record.agentId,
    name: args.agentDisplayName,
    endpoint: args.endpoint,
    walletAddress: record.walletAddress,
    message: args.message,
    signature: args.signature.signature,
    signedMessage: args.signature.signature,
    signedPayload: args.signature.signature,
    signerAddress: args.signature.signerAddress,
    issuedAt: record.issuedAt,
    chain: record.network,
    network: record.network,
  });

  const missing = missingRequiredFields(submitTool.tool.inputSchema, submitArgs);
  if (missing.length > 0) {
    const detail =
      `"${submitTool.tool.name}" declares required argument(s) this client supplies no value for: ` +
      `${missing.join(', ')}. Declared schema: ${JSON.stringify(submitTool.tool.inputSchema?.properties ?? {})}`;
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: 'HORIZEN_SUBMISSION_FAILED', refusalDetail: detail });
    return { ok: false, refusalCode: 'HORIZEN_SUBMISSION_FAILED', detail };
  }

  const submitResult = await mcpClient.callTool({ name: submitTool.tool.name, arguments: submitArgs });

  /*
   * isError IS TERMINAL, CHECKED FIRST (al / Horizen brief, 2026-08-04).
   *
   * A tool-level rejection (schema validation, business-rule refusal, ...)
   * still returns `content` — usually the error body — and the code
   * previously ran straight into `extractStringField` looking for a
   * submission reference inside it, then reported the misleading "did not
   * return a recognisable submission reference" as if the call had merely
   * returned an unfamiliar SUCCESS shape. It never had: `enable_pulse_
   * monitoring` was rejected outright by Horizen's own argument validation.
   * Reusing `describeToolResultShape`'s error-body-verbatim path (the same
   * discipline `extractPartnerMessage` already applies) reports what
   * actually happened instead of a generic parsing complaint.
   */
  if (submitResult.isError === true) {
    /*
     * A bounded, safe diagnostic transcript rides along with this refusal
     * (al, 2026-08-04) — this call is only reached after
     * verifySignatureIntegrity already confirmed recovery/wallet/owner agree
     * LOCALLY, so a rejection here means either a signature-contract variant
     * this integration hasn't matched (prefix, encoding, hashing) or a
     * partner-side defect — never a local ownership/logic bug the earlier
     * gates would already have caught.
     */
    const transcript = buildSignatureDiagnosticTranscript({
      message: args.message,
      signature: args.signature,
      expectedOwner: record.walletAddress,
      agentId: record.agentId,
      issuedAt: record.issuedAt,
      endpoint: args.endpoint,
    });
    const partnerErrorText = describeToolResultShape(submitResult);

    /*
     * TWO FRAMINGS, NOT ONE (al, 2026-08-04): "The error should now be
     * surfaced as: Horizen rejected a locally verified owner signature.
     * Local authorization integrity passed. Partner contract clarification
     * required. — not merely 'Invalid signature', and not another
     * invitation to retry." That framing is only HONEST when this rejection
     * is actually the signature check — an unrelated rejection (a schema
     * validation dump, a business-rule refusal) keeps the generic wording
     * because it IS generic, and claiming "local integrity passed" for a
     * defect this integration might still own would overclaim.
     */
    const looksLikeSignatureRejection = /invalid signature/i.test(partnerErrorText);
    const detail = looksLikeSignatureRejection
      ? `Horizen rejected a locally verified owner signature. Local authorization integrity passed. Partner contract ` +
        `clarification required. Partner response: ${partnerErrorText}. ` +
        `Local signature transcript (recovery already verified before this call): ${JSON.stringify(transcript)}`
      : `"${submitTool.tool.name}" rejected the request: ${partnerErrorText}. ` +
        `Local signature transcript (recovery already verified before this call): ${JSON.stringify(transcript)}`;

    // The full escalation packet — the exact message/signature belong here,
    // NEVER in `detail` above (general-log-visible). Requires the
    // escalation-only carry fields; standalone callers that omit them
    // (e.g. direct unit tests of this function alone) simply get no packet
    // rather than a half-populated one.
    const escalationPacket =
      args.registry && args.expectedOwner && args.buildToolName !== undefined
        ? buildHorizenEscalationPacket({
            registry: args.registry,
            expectedOwner: args.expectedOwner,
            message: args.message,
            signature: args.signature,
            issuedAt: record.issuedAt,
            endpoint: args.endpoint,
            submittedArguments: submitArgs,
            buildToolName: args.buildToolName,
            buildToolInputSchema: args.buildToolInputSchema,
            rawBuildResult: args.rawBuildResult,
            submitToolName: submitTool.tool.name,
            rawSubmitResult: submitResult,
            now: deps.now ?? (() => new Date()),
          })
        : undefined;

    /*
     * ESCALATION LOGGING (2026-08-04) — mirrors services/dvn/
     * activityReceiptDvnPipeline.ts's [DVN ESCALATION] console.error
     * pattern verbatim: same mechanism, same reason (surfaces in
     * CloudWatch/Amplify error-level logs, restricted to infra operators,
     * never a general API response or a broad-audience DB column). Without
     * this, the packet was computed and then silently discarded — it never
     * reached `detail` (general-log-visible; deliberately bounded) and the
     * route never forwards `escalationPacket` to its JSON response. This is
     * the ONLY place this artifact is currently retrievable.
     */
    if (escalationPacket) {
      console.error(`[HORIZEN ESCALATION] enable_pulse_monitoring rejected authorization "${authorizationId}": ${JSON.stringify(escalationPacket)}`);
    }

    await updatePartnerAuthorizationRequest(authorizationId, {
      state: 'REFUSED',
      refusalCode: 'HORIZEN_SUBMISSION_REJECTED',
      refusalDetail: detail,
    });
    return { ok: false, refusalCode: 'HORIZEN_SUBMISSION_REJECTED', detail, ...(escalationPacket ? { escalationPacket } : {}) };
  }

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
 * Does the registry's own on-chain owner match the wallet this ceremony is
 * signing/submitting as? One definition, two call sites (2026-08-04):
 *   - `runHorizenTransparencyAuthorization` — BEFORE submit, so a wrong
 *     wallet never reaches Horizen's state-changing enable_pulse_monitoring
 *     call at all.
 *   - `verifyHorizenTransparencyActivation` — AFTER submit, as the
 *     authoritative post-hoc confirmation (control could theoretically
 *     change between prepare and reread).
 *
 * ── WHY THE PRE-SUBMIT CALL EXISTS (al, 2026-08-04) ─────────────────────
 *
 * The message-building comment above states outright: "Wallet: 0x… must
 * equal ownerOf(agentId)". Before this, the ONLY owner cross-check ran
 * post-submit — so a wallet that is not the token's actual on-chain owner
 * reached Horizen's REAL signature verification and came back as:
 *
 *   "enable_pulse_monitoring" rejected the request: tool-reported error:
 *   Registry API returned 401 for /agents/8798/enable-pulse — Invalid
 *   signature
 *
 * That is cryptographically true (the signature cannot verify against a
 * message the actual owner didn't produce) but diagnostically useless — it
 * reads as a signing bug when the real defect is a wrong wallet. Checking
 * here turns that into a named, local REGISTRY_OWNER_MISMATCH before any
 * partner contact for the state-changing call happens.
 */
async function crossCheckRegistryOwner(
  registry: { network: HorizenNetwork; tokenId: string; registryAlias?: string },
  controllerWallet: string,
  deps: AuthorizationDeps,
): Promise<
  | { ok: true; owner: string }
  | { ok: false; refusalCode: 'REGISTRY_REREAD_FAILED' | 'REGISTRY_OWNER_MISMATCH'; detail: string }
> {
  const fetchAgent = deps.fetchRegistryAgent ?? defaultFetchRegistryAgent;
  const reread = await fetchAgent(registry.registryAlias ?? registry.tokenId, registry.network);
  if (!reread.ok) {
    return { ok: false, refusalCode: 'REGISTRY_REREAD_FAILED', detail: `registry reread failed: ${reread.reason}` };
  }
  const owner = pickStringField(reread.value, ['owner', 'ownerAddress', 'controller', 'controllerWallet']);
  if (owner && owner.toLowerCase() !== controllerWallet.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'REGISTRY_OWNER_MISMATCH',
      detail: `registry-reread owner (${owner}) does not match the controller wallet (${controllerWallet})`,
    };
  }
  // No `owner` field reported at all (a lenient registry read) — the
  // controllerWallet is the only candidate available; downstream callers
  // (verifySignatureIntegrity) use this as the expected owner for the
  // decisive local test either way.
  return { ok: true, owner: owner ?? controllerWallet };
}

/**
 * THE decisive local test (al, 2026-08-04): `recoverAddress(exactMessage,
 * signature) === walletAddress submitted === ownerOf(agentId)`. Three
 * quantities, one gate — not a composition of two separately-passing checks
 * trusted by inference:
 *   - `expectedOwner` is the value crossCheckRegistryOwner ACTUALLY resolved
 *     moments earlier (never re-derived, never assumed equal to
 *     controllerWallet even though it always is today);
 *   - `record.walletAddress` is read FRESH from the persisted row — the same
 *     one submitHorizenTransparencyAuthorization is about to read
 *     `agentId`/`walletAddress`/`issuedAt` from — never the in-memory value
 *     used to build/sign, so a drift between "what was signed" and "what
 *     will be submitted" cannot hide behind an unchanged local variable;
 *   - `signature.signerAddress` is the signer module's OWN internal
 *     recovery, re-derived here independently rather than trusted.
 *
 * `exactMessage` MUST be the verbatim string returned by
 * build_pulse_auth_message, threaded through unmodified — never
 * reconstructed from parsed fields. Signing method is ordinary EIP-191
 * personal_sign (`ethers.Wallet.signMessage` / `ethers.verifyMessage`) — the
 * SAME primitive on both the signing and recovery side; no typed-data
 * signing, no pre-hashing, anywhere in this pipeline.
 *
 * By construction today all three quantities agree (composition, not
 * coincidence: the same controllerWallet flows through prepare -> sign ->
 * here). Its value is as a REGRESSION GATE — it fails loudly if a future
 * change ever lets any one of them diverge from the other two, before
 * enable_pulse_monitoring is ever called.
 */
export async function verifySignatureIntegrity(
  authorizationId: string,
  exactMessage: string,
  signature: PartnerAuthorizationSignature,
  expectedOwner: string,
): Promise<{ ok: true } | { ok: false; refusalCode: 'SIGNATURE_INTEGRITY_FAILED'; detail: string }> {
  const record = await getPartnerAuthorizationRequest(authorizationId);
  if (!record?.walletAddress) {
    return {
      ok: false,
      refusalCode: 'SIGNATURE_INTEGRITY_FAILED',
      detail: `authorization "${authorizationId}" has no persisted walletAddress to verify the signature against`,
    };
  }
  const { ethers } = await import('ethers');
  const recovered = ethers.verifyMessage(exactMessage, signature.signature);
  const recoveredLower = recovered.toLowerCase();
  if (
    recoveredLower !== signature.signerAddress.toLowerCase() ||
    recoveredLower !== record.walletAddress.toLowerCase() ||
    recoveredLower !== expectedOwner.toLowerCase()
  ) {
    return {
      ok: false,
      refusalCode: 'SIGNATURE_INTEGRITY_FAILED',
      detail:
        `recovered signer (${recovered}) over the exact message about to be submitted does not agree with ALL of: ` +
        `persisted walletAddress (${record.walletAddress}), registry owner (${expectedOwner}) — refusing before ` +
        `enable_pulse_monitoring is called`,
    };
  }
  return { ok: true };
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

  const ownerCheck = await crossCheckRegistryOwner(args.registry, args.controllerWallet, deps);
  if (!ownerCheck.ok) {
    await updatePartnerAuthorizationRequest(authorizationId, { state: 'REFUSED', refusalCode: ownerCheck.refusalCode, refusalDetail: ownerCheck.detail });
    return { ok: false, refusalCode: ownerCheck.refusalCode, detail: ownerCheck.detail };
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

/**
 * ONE CONNECTION, ONE TOOL LISTING, FOR THE WHOLE CEREMONY.
 *
 * Each stage below independently falls back to `defaultMcpClient()` when no
 * client is injected. Run end to end with no deps, that meant THREE separate
 * transport connections to Horizen and THREE `listTools` round trips for a
 * tool set that cannot change inside a single ceremony — roughly three times
 * the remote latency of the work actually being done, inside one serverless
 * request whose budget the operator has already seen exhausted (an empty
 * response body, 2026-08-03).
 *
 * Wrapping the shared client rather than editing each stage keeps every stage
 * independently callable — Phase 1's tests drive them one at a time with their
 * own mock — while making the composed path pay the connection cost once.
 */
function shareOneConnection(client: PartnerMcpClient): PartnerMcpClient {
  let tools: Promise<{ tools: McpTool[] }> | null = null;
  return {
    listTools: () => (tools ??= client.listTools()),
    callTool: (args) => client.callTool(args),
  };
}

export async function runHorizenTransparencyAuthorization(
  input: PrepareHorizenTransparencyAuthorizationInput,
  deps: AuthorizationDeps = {},
): Promise<AuthorizationResult<{ authorizationId: string; receiptRef: string | null }>> {
  const shared: AuthorizationDeps = { ...deps, mcpClient: shareOneConnection(deps.mcpClient ?? (await defaultMcpClient())) };

  const prepared = await prepareHorizenTransparencyAuthorization(input, shared);
  if (!prepared.ok) return prepared;

  /*
   * OWNERSHIP, BEFORE SIGNING (moved here 2026-08-04, al: "Signing is itself
   * a governed cryptographic act... there is no reason to ask the agent key
   * to sign a message that is already known to name the wrong wallet."). The
   * canonical order is now: resolve token -> read ownerOf -> compare with the
   * proposed signer -> build the exact message (already done above, in
   * prepare) -> sign -> submit -> reread. verifyHorizenTransparencyActivation's
   * post-submit reread remains as the authoritative CONFIRMATION afterward —
   * not a duplicate of this pre-flight refusal.
   */
  const ownerCheck = await crossCheckRegistryOwner(input.registry, input.controllerWallet, shared);
  if (!ownerCheck.ok) {
    await updatePartnerAuthorizationRequest(prepared.value.authorizationId, {
      state: 'REFUSED',
      refusalCode: ownerCheck.refusalCode,
      refusalDetail: ownerCheck.detail,
    });
    return { ok: false, refusalCode: ownerCheck.refusalCode, detail: ownerCheck.detail };
  }

  const signed = await signHorizenTransparencyAuthorization(prepared.value, shared);
  if (!signed.ok) return signed;

  /*
   * THE DECISIVE LOCAL TEST, BEFORE SUBMISSION (al, 2026-08-04): recover the
   * signer from the EXACT message that will be submitted and require it
   * match ALL THREE of the persisted walletAddress, the ACTUAL registry
   * owner just resolved (`ownerCheck.owner`, never re-derived), and the
   * signer module's own recovery. See verifySignatureIntegrity's own doc
   * comment for why this checks all three explicitly rather than trusting
   * composition of separately-passing checks.
   */
  const integrityCheck = await verifySignatureIntegrity(prepared.value.authorizationId, prepared.value.message, signed.value, ownerCheck.owner);
  if (!integrityCheck.ok) {
    await updatePartnerAuthorizationRequest(prepared.value.authorizationId, {
      state: 'REFUSED',
      refusalCode: integrityCheck.refusalCode,
      refusalDetail: integrityCheck.detail,
    });
    return { ok: false, refusalCode: integrityCheck.refusalCode, detail: integrityCheck.detail };
  }

  const submitted = await submitHorizenTransparencyAuthorization(
    prepared.value.authorizationId,
    {
      message: prepared.value.message,
      signature: signed.value,
      agentDisplayName: input.agentDisplayName,
      endpoint: input.pulseEndpoint,
      // Escalation-only carry — see submitHorizenTransparencyAuthorization's
      // own doc comment. ownerCheck.owner is the ACTUAL resolved registry
      // owner (never re-derived here).
      registry: input.registry,
      expectedOwner: ownerCheck.owner,
      buildToolName: prepared.value.buildToolName,
      buildToolInputSchema: prepared.value.buildToolInputSchema,
      rawBuildResult: prepared.value.rawBuildResult,
    },
    shared,
  );
  if (!submitted.ok) return submitted;

  const verified = await verifyHorizenTransparencyActivation(
    prepared.value.authorizationId,
    { actorPersonaId: input.actorPersonaId, registry: input.registry, controllerWallet: input.controllerWallet },
    shared,
  );
  if (!verified.ok) return verified;

  const finalRecord = await getPartnerAuthorizationRequest(prepared.value.authorizationId);
  return { ok: true, value: { authorizationId: prepared.value.authorizationId, receiptRef: finalRecord?.receiptRef ?? null } };
}
