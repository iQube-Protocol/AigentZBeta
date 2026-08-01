/**
 * Register ceremony — the wallet-mediated vertical slice for the Register
 * stage (Wallet Signing Topology, operator ruling 2026-08-01).
 *
 * Register signing-path convergence (Phase 1, registrationClient.ts) is
 * complete: Register signs through the agent's own custodied wallet, the
 * same agent_keys row Verify/Claim already use. That is NOT the same as
 * interactive wallet authorization — Phase 1 was still a direct,
 * server-custodial signature fired as a consequence of an authenticated
 * click. This module is the ceremony Phase 1 explicitly deferred:
 *
 *   principal wallet signs registration mandate
 *   → Aigent Nakamoto's wallet explicitly approves invocation of its
 *     custodied key
 *   → Nakamoto's agent key signs the Horizen registry transaction
 *   → transaction is broadcast
 *   → Horizen is reread
 *   → binding and receipts open in Nakamoto's wallet
 *
 * The agent key never leaves AgentKeyService/broadcastAgentRegistration's
 * stack frame — unchanged from Phase 1. What changes is WHEN it fires: only
 * as the direct, explicit consequence of an operator clicking Approve on a
 * named SigningRequest inside the agent's OWN wallet UI, never as an
 * invisible side effect of the Register stage's "confirm" click. The
 * Journey prepares the request; the wallet shows the exact consequence; the
 * operator explicitly approves; only then does the bounded custody service
 * sign (governing distinction, verbatim from the ruling).
 *
 * No administrative fallback is retained. There is exactly one path from
 * "operator wants to register this agent" to "Horizen transaction signed
 * and broadcast" — through this ceremony's two SigningRequests. The old
 * register/prepare + register/broadcast routes (Phase 1) remain as the
 * INTERNAL steps this ceremony calls (prepareAgentRegistration,
 * broadcastAgentRegistration) — they are no longer reachable as a
 * normal-UI shortcut once RegisterAgentPanel is rewired to this ceremony.
 */

import { resolveRegistrableAgent, resolveRegistrableAgentByRuntimeId, type RegistrableAgentConfig } from './registrableAgents';
import {
  prepareAgentRegistration,
  broadcastAgentRegistration,
  type RegistrationDeps,
  type UnsignedTx,
} from './registrationClient';
import {
  createSigningRequest,
  getSigningRequest,
  updateSigningRequest,
  generateSigningNonce,
} from '@/services/signing/signingRequestStore';
import type { SigningRequest } from '@/types/signingRequest';

export type RegisterCeremonyRefusalCode =
  | 'UNKNOWN_AGENT'
  | 'NO_PRINCIPAL_WALLET'
  | 'REQUEST_NOT_FOUND'
  | 'WRONG_ACTION_KIND'
  | 'NOT_PENDING'
  | 'EXPIRED'
  | 'SIGNER_MISMATCH'
  | 'PREPARE_FAILED'
  | 'BROADCAST_FAILED'
  | 'RECEIPT_DESTINATION_MISMATCH';

export type RegisterCeremonyResult<T> =
  | { ok: true; value: T }
  | { ok: false; refusalCode: RegisterCeremonyRefusalCode; detail: string };

const REGISTER_RECEIPT_DESTINATION_PREFIX = 'journey:horizen-moneypenny-admission:register';

function receiptDestination(agentSlug: string): string {
  return `${REGISTER_RECEIPT_DESTINATION_PREFIX}:${agentSlug}`;
}

// ── External deps this module needs, injectable for tests ─────────────────

export interface RegisterCeremonyDeps extends RegistrationDeps {
  /** Resolves the principal's OWN on-file EVM address — never trust a client-declared address. Defaults to services/identity/personaAddressResolver.ts's resolvePersonaWalletAddress. */
  resolvePrincipalWalletAddress?: (principalPersonaId: string) => Promise<string | null>;
  /** Recovers the signer address from an EIP-191 personal_sign payload+signature. Defaults to ethers.verifyMessage. */
  verifySignature?: (payload: string, signature: string) => string | null | Promise<string | null>;
  /** Records an evidence receipt; returns its id. Defaults to services/receipts/activityReceiptService.ts's createActivityReceipt. */
  recordReceipt?: (input: {
    personaId: string;
    actionType:
      | 'principal_registration_mandate_signed'
      | 'agent_registry_transaction_signed'
      | 'horizen_registration_submitted';
    summary: string;
    agentsInvoked: string[];
    actionInput: Record<string, unknown>;
  }) => Promise<string | null>;
  createSigningRequest?: typeof createSigningRequest;
  getSigningRequest?: typeof getSigningRequest;
  updateSigningRequest?: typeof updateSigningRequest;
  /** Resolves the agent's own custodied private key for broadcast — the ONLY moment it is touched. Defaults to AgentKeyService.getAgentKeys(agent.runtimeAgentId), the same source Verify/Claim already sign with. Injectable so tests never touch a real key store. */
  resolveAgentPrivateKey?: (agent: RegistrableAgentConfig) => Promise<string | undefined>;
  /** Public origin the Agent Card is served from — needed when this ceremony builds the unsigned tx at approval time. */
  agentCardBase: string;
}

async function defaultResolvePrincipalWalletAddress(principalPersonaId: string): Promise<string | null> {
  const { resolvePersonaWalletAddress } = await import('@/services/identity/personaAddressResolver');
  return resolvePersonaWalletAddress(principalPersonaId, 'base');
}

async function defaultVerifySignature(payload: string, signature: string): Promise<string | null> {
  try {
    const { ethers } = await import('ethers');
    return ethers.verifyMessage(payload, signature);
  } catch {
    return null;
  }
}

async function defaultRecordReceipt(input: {
  personaId: string;
  actionType: string;
  summary: string;
  agentsInvoked: string[];
  actionInput: Record<string, unknown>;
}): Promise<string | null> {
  const { createActivityReceipt } = await import('@/services/receipts/activityReceiptService');
  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'agentiq',
    actionType: input.actionType as never,
    summary: input.summary,
    agentsInvoked: input.agentsInvoked,
    actionInput: input.actionInput,
  });
  return receipt?.id ?? null;
}

// ── Step 1: principal prepares the registration mandate ────────────────────

export interface PrepareRegistrationMandateInput {
  agentSlug: string;
  principalPersonaId: string;
}

export async function prepareRegistrationMandate(
  input: PrepareRegistrationMandateInput,
  deps: RegisterCeremonyDeps,
): Promise<RegisterCeremonyResult<SigningRequest>> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `"${input.agentSlug}" is not a registrable agent` };
  }

  const resolveWallet = deps.resolvePrincipalWalletAddress ?? defaultResolvePrincipalWalletAddress;
  const principalWallet = await resolveWallet(input.principalPersonaId);
  if (!principalWallet) {
    return {
      ok: false,
      refusalCode: 'NO_PRINCIPAL_WALLET',
      detail: 'No wallet is on file for the operator — a signing action cannot be offered until one is configured. Never fabricating a mandate signature.',
    };
  }

  const create = deps.createSigningRequest ?? createSigningRequest;
  const nonce = generateSigningNonce('principal', 'authorize_registration');
  const consequence = `Authorizes ${agent.displayName}'s registration as a discoverable, technically controllable presence in Horizen's ERC-8004 registry. Does not grant any spending or execution authority.`;
  const payload =
    `metaMe registration-mandate: I, the operator, authorize ${agent.displayName} ` +
    `(AigentQube "${agent.aigentQubeId}") to be registered in Horizen's ERC-8004 registry. ` +
    `nonce=${nonce}`;

  const result = await create({
    actionKind: 'authorize_registration',
    signerRole: 'principal',
    principalPersonaId: input.principalPersonaId,
    subjectAgentRef: agent.runtimeAgentId,
    subjectAigentQubeId: agent.aigentQubeId,
    authorityCredential: null,
    walletRef: 'principal',
    network: 'base-sepolia',
    payload,
    consequence,
    expiresInSeconds: 600,
    receiptDestination: receiptDestination(agent.slug),
    nonce,
  });
  if (!result.ok) {
    return { ok: false, refusalCode: 'REQUEST_NOT_FOUND', detail: result.detail };
  }
  return { ok: true, value: result.record };
}

// ── Step 2: principal approves (signs) the mandate ─────────────────────────

export interface ApprovePrincipalMandateInput {
  requestId: string;
  principalPersonaId: string;
  signature: string;
}

export interface ApprovedMandateOutcome {
  mandateRequest: SigningRequest;
  /** The follow-on agent-role SigningRequest this approval just created — the operator's next step, in Nakamoto's own wallet. */
  agentInvocationRequest: SigningRequest;
}

export async function approvePrincipalRegistrationMandate(
  input: ApprovePrincipalMandateInput,
  deps: RegisterCeremonyDeps,
): Promise<RegisterCeremonyResult<ApprovedMandateOutcome>> {
  const getRequest = deps.getSigningRequest ?? getSigningRequest;
  const update = deps.updateSigningRequest ?? updateSigningRequest;
  const create = deps.createSigningRequest ?? createSigningRequest;

  const request = await getRequest(input.requestId);
  if (!request) return { ok: false, refusalCode: 'REQUEST_NOT_FOUND', detail: `no signing request "${input.requestId}"` };
  if (request.actionKind !== 'authorize_registration' || request.signerRole !== 'principal') {
    return { ok: false, refusalCode: 'WRONG_ACTION_KIND', detail: `request "${input.requestId}" is not a pending registration mandate` };
  }
  if (request.principalPersonaId !== input.principalPersonaId) {
    return { ok: false, refusalCode: 'SIGNER_MISMATCH', detail: 'this request does not belong to the calling persona' };
  }
  if (request.status !== 'pending') {
    return { ok: false, refusalCode: 'NOT_PENDING', detail: `request is "${request.status}", not pending` };
  }
  if (new Date(request.expiresAt).getTime() < Date.now()) {
    await update(request.id, { status: 'expired' });
    return { ok: false, refusalCode: 'EXPIRED', detail: `request expired at ${request.expiresAt}` };
  }

  const resolveWallet = deps.resolvePrincipalWalletAddress ?? defaultResolvePrincipalWalletAddress;
  const onFileAddress = await resolveWallet(input.principalPersonaId);
  if (!onFileAddress) {
    return { ok: false, refusalCode: 'NO_PRINCIPAL_WALLET', detail: 'no wallet on file for this persona' };
  }

  const verify = deps.verifySignature ?? defaultVerifySignature;
  const recovered = await verify(request.payload, input.signature);
  if (!recovered || recovered.toLowerCase() !== onFileAddress.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'SIGNER_MISMATCH',
      detail: `signature recovers to ${recovered ?? 'nothing'}, expected the operator's on-file wallet ${onFileAddress}`,
    };
  }

  await update(request.id, { status: 'approved', signature: input.signature, signerAddress: recovered });

  const record = deps.recordReceipt ?? defaultRecordReceipt;
  await record({
    personaId: input.principalPersonaId,
    actionType: 'principal_registration_mandate_signed',
    summary: `Operator signed the registration mandate for ${request.subjectAigentQubeId ?? request.subjectAgentRef}`,
    agentsInvoked: request.subjectAgentRef ? [request.subjectAgentRef] : [],
    actionInput: { requestId: request.id, signerAddress: recovered },
  });

  // The unsigned tx is built HERE, only once the principal has authorized
  // the act — never earlier. Horizen's own MCP tools/network are consulted
  // now, not at prepareRegistrationMandate time.
  const agent = resolveRegistrableAgentByRuntimeId(request.subjectAgentRef);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `subject agent "${request.subjectAgentRef}" no longer resolves` };
  }
  const prepared = await prepareAgentRegistration({ agentSlug: agent.slug, agentCardBase: deps.agentCardBase }, deps);
  if (!prepared.ok) {
    return { ok: false, refusalCode: 'PREPARE_FAILED', detail: prepared.detail };
  }

  const agentNonce = generateSigningNonce(agent.runtimeAgentId, 'sign_registry_transaction');
  const agentConsequence =
    `Approves ${agent.displayName}'s own custodied wallet to sign and broadcast the reviewed Horizen ` +
    `ERC-8004 registration transaction (network ${prepared.value.network}). The private key never leaves ` +
    `AgentKeyService — this approval only authorizes ITS invocation.`;
  const agentRequestResult = await create({
    actionKind: 'sign_registry_transaction',
    signerRole: 'agent',
    principalPersonaId: input.principalPersonaId,
    subjectAgentRef: agent.runtimeAgentId,
    subjectAigentQubeId: agent.aigentQubeId,
    authorityCredential: null,
    walletRef: agent.runtimeAgentId,
    network: prepared.value.network,
    payload: JSON.stringify({ unsignedTx: prepared.value.unsignedTx, mandateRequestId: request.id }),
    consequence: agentConsequence,
    expiresInSeconds: 900,
    receiptDestination: receiptDestination(agent.slug),
    nonce: agentNonce,
  });
  if (!agentRequestResult.ok) {
    return { ok: false, refusalCode: 'REQUEST_NOT_FOUND', detail: agentRequestResult.detail };
  }

  const resolvedMandate = await getRequest(request.id);
  return {
    ok: true,
    value: { mandateRequest: resolvedMandate ?? request, agentInvocationRequest: agentRequestResult.record },
  };
}

// ── Step 3: agent wallet approves invocation of its custodied key ─────────

export interface ApproveAgentInvocationInput {
  requestId: string;
}

export interface AgentInvocationOutcome {
  request: SigningRequest;
  txHash: string;
  ownerWalletAddress: string;
  network: string;
}

export async function approveAgentRegistryInvocation(
  input: ApproveAgentInvocationInput,
  deps: RegisterCeremonyDeps,
): Promise<RegisterCeremonyResult<AgentInvocationOutcome>> {
  const getRequest = deps.getSigningRequest ?? getSigningRequest;
  const update = deps.updateSigningRequest ?? updateSigningRequest;

  const request = await getRequest(input.requestId);
  if (!request) return { ok: false, refusalCode: 'REQUEST_NOT_FOUND', detail: `no signing request "${input.requestId}"` };
  if (request.actionKind !== 'sign_registry_transaction' || request.signerRole !== 'agent') {
    return { ok: false, refusalCode: 'WRONG_ACTION_KIND', detail: `request "${input.requestId}" is not a pending agent registry-transaction approval` };
  }
  if (request.status !== 'pending') {
    return { ok: false, refusalCode: 'NOT_PENDING', detail: `request is "${request.status}", not pending` };
  }
  if (new Date(request.expiresAt).getTime() < Date.now()) {
    await update(request.id, { status: 'expired' });
    return { ok: false, refusalCode: 'EXPIRED', detail: `request expired at ${request.expiresAt}` };
  }

  const agent = resolveRegistrableAgentByRuntimeId(request.subjectAgentRef);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `subject agent "${request.subjectAgentRef}" no longer resolves` };
  }

  let unsignedTx: UnsignedTx;
  try {
    unsignedTx = (JSON.parse(request.payload) as { unsignedTx: UnsignedTx }).unsignedTx;
  } catch {
    return { ok: false, refusalCode: 'PREPARE_FAILED', detail: 'stored request payload did not contain a parseable unsigned transaction' };
  }

  // THIS IS THE ONLY MOMENT the bounded custody service is invoked — as the
  // direct, explicit consequence of THIS approval, never earlier.
  const resolveAgentKey = deps.resolveAgentPrivateKey ?? defaultResolveAgentPrivateKey;
  const ownerPrivateKey = await resolveAgentKey(agent);
  if (!ownerPrivateKey) {
    return { ok: false, refusalCode: 'BROADCAST_FAILED', detail: `${agent.displayName} has no custodied wallet on record (agent_keys, runtimeAgentId "${agent.runtimeAgentId}")` };
  }
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org';
  const broadcast = await broadcastAgentRegistration(
    { agentSlug: agent.slug, unsignedTx, confirm: true, ownerPrivateKey, rpcUrl },
    deps,
  );
  if (!broadcast.ok) {
    return { ok: false, refusalCode: 'BROADCAST_FAILED', detail: broadcast.detail };
  }

  await update(request.id, { status: 'executed', signerAddress: broadcast.value.ownerWalletAddress });

  const record = deps.recordReceipt ?? defaultRecordReceipt;
  await record({
    personaId: request.principalPersonaId,
    actionType: 'agent_registry_transaction_signed',
    summary: `${agent.displayName}'s own custodied wallet signed the Horizen registration transaction`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: { requestId: request.id, txHash: broadcast.value.txHash },
  });
  await record({
    personaId: request.principalPersonaId,
    actionType: 'horizen_registration_submitted',
    summary: `${agent.displayName}'s Horizen registration transaction broadcast (${broadcast.value.network}, tx ${broadcast.value.txHash})`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: { requestId: request.id, txHash: broadcast.value.txHash, network: broadcast.value.network },
  });

  const resolved = await getRequest(request.id);
  return {
    ok: true,
    value: {
      request: resolved ?? request,
      txHash: broadcast.value.txHash,
      ownerWalletAddress: broadcast.value.ownerWalletAddress,
      network: broadcast.value.network,
    },
  };
}

async function defaultResolveAgentPrivateKey(agent: RegistrableAgentConfig): Promise<string | undefined> {
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const keys = await new AgentKeyService().getAgentKeys(agent.runtimeAgentId);
  return keys?.evmPrivateKey;
}
