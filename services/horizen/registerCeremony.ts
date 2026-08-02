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
import {
  PRINCIPAL_MANDATE_TTL_SECONDS,
  AGENT_INVOCATION_TTL_SECONDS,
} from '@/services/signing/mandatePolicy';

export type RegisterCeremonyRefusalCode =
  | 'UNKNOWN_AGENT'
  /**
   * A wallet resolves for the principal but cannot sign — twenty random bytes
   * with no key behind them, a legacy address held as evidence only, an
   * unbound envelope. Distinct from NO_PRINCIPAL_WALLET, which means nothing
   * resolved at all: the two need different remedies, and collapsing them is
   * what let an unsignable wallet reach the mandate step (trace #121).
   */
  | 'PRINCIPAL_WALLET_NOT_SIGNER_CONFIGURED'
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

  /*
   * CAPABILITY, NOT PRESENCE (operator ruling, 2026-08-02; trace #121).
   *
   * "Is an address on file" is not "may this wallet sign". Three provisioning
   * paths write twenty random bytes with no key behind them; a legacy deployer
   * address sits under PILOT-WALLET-EXCEPTION-001 as evidence only. Both look
   * like a resolved address to the old check, and neither can produce a
   * signature — so the mandate would be offered and then fail at recovery,
   * after the operator had been told it was theirs to sign.
   *
   * Only SIGNER_CONFIGURED proceeds. Every other capability is refused BY NAME,
   * so the refusal states which remedy applies rather than one flat message.
   *
   * PREPARE vs SIGN — two different gates (operator ruling via Al, 2026-08-02).
   * Preparing a mandate does not sign anything, so it needs only that a signer
   * is CONFIGURED: offering a mandate for a wallet with no signer behind it is
   * what the trace found, and that is what this check stops. SIGNING it
   * additionally requires CONTROL_PROVEN — a fresh unlock whose signature
   * recovers the bound address — and the consequential act additionally
   * requires AUTHORITY_RESOLVED and MANDATE_VALID
   * (services/wallet/walletControlProof.ts). This gate is the first of four,
   * not a substitute for the rest.
   *
   * Injected deps skip this: a test stub has no store to classify against, and
   * that seam is what keeps this rule unit-testable.
   */
  if (!deps.resolvePrincipalWalletAddress) {
    const { classifyPersonaWalletCapability } = await import('@/services/identity/personaAddressResolver');
    const { mayProduceSignature } = await import('@/services/wallet/pilotWalletException');
    const capability = await classifyPersonaWalletCapability(input.principalPersonaId, 'base');
    if (!mayProduceSignature(capability.capability)) {
      return {
        ok: false,
        refusalCode: 'PRINCIPAL_WALLET_NOT_SIGNER_CONFIGURED',
        detail:
          `The operator's principal wallet is ${capability.capability} — it cannot produce a signature, so no ` +
          `mandate is offered. ${capability.detail}` +
          (capability.remediation ? ` ${capability.remediation}` : '') +
          ' Never fabricating a mandate signature.',
      };
    }
  }

  const resolveWallet = deps.resolvePrincipalWalletAddress ?? defaultResolvePrincipalWalletAddress;
  const principalWallet = await resolveWallet(input.principalPersonaId);
  if (!principalWallet) {
    // The refusal itself is correct and stays — a mandate signature is never
    // fabricated. What changes is that it now says WHICH of the three address
    // sources is empty and what fixes it (operator report, 2026-08-02): a
    // backfill gap, absent key material and a malformed address are three
    // different problems, and one flat message made the ceremony
    // unfixable from the error alone. Only injected deps skip this — a test
    // stub has no store to diagnose against.
    let detail =
      'No wallet is on file for the operator — a signing action cannot be offered until one is configured. Never fabricating a mandate signature.';
    if (!deps.resolvePrincipalWalletAddress) {
      try {
        const { diagnosePersonaWalletAddress } = await import('@/services/identity/personaAddressResolver');
        const diagnosis = await diagnosePersonaWalletAddress(input.principalPersonaId, 'base');
        if (diagnosis.remediation) detail = `${detail} ${diagnosis.remediation}`;
      } catch {
        // Diagnosis is an enrichment — its failure must never change the
        // refusal itself.
      }
    }
    return { ok: false, refusalCode: 'NO_PRINCIPAL_WALLET', detail };
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
    // Operator-approved governance parameter, stated once in
    // services/signing/mandatePolicy.ts — never a literal here. Was 600s,
    // which was SHORTER than the machine leg below; five consecutive mandates
    // expired unsigned before that was noticed.
    expiresInSeconds: PRINCIPAL_MANDATE_TTL_SECONDS,
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
      /*
       * NAME THE SOURCES, NOT JUST THE VALUES (operator, 2026-08-02).
       *
       * The signature is produced from `evm_key.encryptedPrivateKey` and
       * validated against whatever `resolvePersonaWalletAddress` returns —
       * which prefers the flat `personas.evm_address` column. Those are two
       * records of one fact, and while they agree nothing is wrong; the
       * moment one is written without the other, every signature the operator
       * makes is correct and every verification refuses it.
       *
       * The old message named two hex strings and no sources, so a SPLIT
       * RECORD read as a broken signer. Pointing at the reconciliation route
       * turns "which of these is wrong" into one request.
       */
      detail:
        `signature recovers to ${recovered ?? 'nothing'}, expected ${onFileAddress} — the address ` +
        `resolvePersonaWalletAddress returns (personas.evm_address first, then evm_key.address). ` +
        `If your wallet was re-provisioned, those two may disagree: GET ` +
        `/api/wallet/principal/address-reconciliation reports every source and says which diverges. ` +
        `Nothing was signed on Horizen and nothing was changed.`,
    };
  }

  /*
   * ── ORDER: EVERY FALLIBLE STEP BEFORE THE MANDATE IS CONSUMED ────────────
   *
   * THE DEFECT THIS CLOSES (operator, 2026-08-02): "Approve invocation of
   * custodied key has NEVER shown and it has never gotten to this stage …
   * after signing it just gives [a refusal] and then when the wallet is closed
   * it goes back to Principal wallet ready to sign being the only green
   * stage."
   *
   * The mandate was marked `approved` FIRST, and `prepareAgentRegistration` —
   * which fetches the Agent Card, resolves the agent's custodied wallet, and
   * calls Horizen's MCP `build_registration_tx` — ran AFTER. So any failure in
   * that call left the operator's signed mandate CONSUMED and no invocation
   * request created. Every attempt destroyed a mandate and produced nothing,
   * and the only remedy was to prepare a fresh one and lose it the same way.
   *
   * The signature is verified above and is not in doubt. What follows can fail
   * for reasons that have nothing to do with the operator's authority — an
   * unreachable MCP server, an unconfigured agent key, a card mismatch. A
   * mandate must not be spent on someone else's outage.
   *
   * So: resolve the agent and build the transaction FIRST. Only when the
   * invocation is actually creatable does the mandate flip to `approved`. A
   * refusal here leaves it PENDING and re-signable — the operator retries
   * without re-preparing, and their signature was not wasted.
   */
  const agent = resolveRegistrableAgentByRuntimeId(request.subjectAgentRef);
  if (!agent) {
    return {
      ok: false,
      refusalCode: 'UNKNOWN_AGENT',
      detail:
        `subject agent "${request.subjectAgentRef}" no longer resolves. ` +
        'Your mandate is UNCHANGED and still signable — nothing was consumed.',
    };
  }
  // The unsigned tx is built HERE, only once the principal has authorized
  // the act — never earlier. Horizen's own MCP tools/network are consulted
  // now, not at prepareRegistrationMandate time.
  const prepared = await prepareAgentRegistration({ agentSlug: agent.slug, agentCardBase: deps.agentCardBase }, deps);
  if (!prepared.ok) {
    return {
      ok: false,
      refusalCode: 'PREPARE_FAILED',
      detail:
        `${prepared.detail} — this is the step that first contacts Horizen, and it failed for a reason ` +
        'unrelated to your signature. Your mandate is UNCHANGED and still signable: retry without ' +
        'preparing a fresh one.',
    };
  }

  // Past every fallible step. NOW the mandate is spent.
  await update(request.id, { status: 'approved', signature: input.signature, signerAddress: recovered });

  const record = deps.recordReceipt ?? defaultRecordReceipt;
  await record({
    personaId: input.principalPersonaId,
    actionType: 'principal_registration_mandate_signed',
    summary: `Operator signed the registration mandate for ${request.subjectAigentQubeId ?? request.subjectAgentRef}`,
    agentsInvoked: request.subjectAgentRef ? [request.subjectAgentRef] : [],
    actionInput: { requestId: request.id, signerAddress: recovered },
  });

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
    expiresInSeconds: AGENT_INVOCATION_TTL_SECONDS,
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
