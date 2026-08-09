/**
 * Horizen Verifiable-PnL onboarding — the DEDICATED MUTATING boundary
 * (Horizen Pilot Closure, part C, 2026-08-09).
 *
 * ── WHY THIS IS SEPARATE FROM pnlServiceVerification.ts ────────────────────
 *
 * `pnlServiceVerification.ts` is deliberately read-only — it discovers and
 * receipts EVIDENCE of an existing PnL correlation, and never mutates
 * anything. Registering an agent with Horizen's Verifiable-PnL service is a
 * genuine mutation (a signed SIWE session, a signed EIP-712 wallet-link, a
 * `POST /v1/register` call) and belongs in its own boundary — the same
 * separation `registrationClient.ts` (mutating: prepare/broadcast/check) and
 * `client.ts` (read-only: registry/pulse/PnL correlation reads) already
 * establish for ERC-8004 identity registration. This module is that
 * boundary for Verifiable PnL.
 *
 * ── THE CONTRACT, VERIFIED LIVE (2026-08-09) ────────────────────────────────
 *
 * Every endpoint, field name and error code below is quoted from Horizen's
 * OWN currently-published documents, fetched live on this date — never
 * inferred, never carried forward from the older 2026-07-28 partner brief:
 *   - `https://agent-registry.horizenlabs.io/verifiable-pnl/AGENTS.md`
 *     (the runbook — end-to-end flow, error catalog, SIWE message template)
 *   - `https://agent-registry.horizenlabs.io/verifiable-pnl/openapi.json`
 *     (the machine-readable contract — exact request/response schemas)
 *
 * ── WHAT THIS MODULE CANNOT YET DO, AND WHY ─────────────────────────────────
 *
 * `existing`-mode registration (attaching Verifiable PnL to an ALREADY
 * registered ERC-8004 token — Nakamoto's tokenId 8798, MoneyPenny's 8872 —
 * never minting a second identity) requires TWO things this module does not
 * invent:
 *
 *   1. A TRADING WALLET DISTINCT FROM THE OWNER WALLET. The runbook states
 *      this as a hard server-side rule: "tradingWallet must differ from the
 *      owner wallet... rejected with 400 INVALID_INPUT" — because the trading
 *      wallet's PnL is PUBLISHED on the leaderboard, and linking the owner
 *      wallet would deanonymize the owner. This codebase's current wallet
 *      topology has exactly ONE wallet per agent (`agent_keys`, one
 *      `evm_address` per `runtimeAgentId` — see `registrableAgents.ts`'s own
 *      doctrine: "the ONE agent-wallet custody path, never a parallel one").
 *      There is no dedicated trading wallet to reach for. This module NEVER
 *      silently reuses the owner wallet (that request would be rejected
 *      anyway) and never fabricates a new one — `checkExistingModeEligibility`
 *      refuses with `TRADING_WALLET_DECISION_REQUIRED` until a genuine,
 *      distinct trading wallet address is supplied by the caller.
 *
 *   2. THE `tradingLinkWallet` EIP-712 SCHEMA. The OpenAPI spec names the
 *      field (`existing`-mode registration requires `ownerSiwe` + a
 *      `tradingLinkWallet: { signature, deadline }` the spec's own
 *      description calls "EIP-712 (proof the trading wallet consents to
 *      being linked)") but publishes NO domain/types/message definition for
 *      it — unlike the `POST /v1/prove` EIP-712 envelope, which IS fully
 *      specified. `registerExistingAgent` accepts a pre-computed
 *      `tradingLinkWallet` as an explicit input rather than constructing it,
 *      and refuses with `TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED` when one
 *      isn't supplied — never guessing a typed-data shape Horizen has not
 *      documented.
 *
 * Everything else below — terms/nonce fetch, the owner SIWE message and
 * session, the ownership pre-check, the register call itself once its inputs
 * are genuinely available — is fully specified and implemented for real.
 */

import { ethers } from 'ethers';
import { HORIZEN_NETWORK_FACTS, type HorizenNetwork } from './identity';
import { HORIZEN_PNL_BASE, fetchPnlTerms, fetchPnlSiweNonce, fetchPnlTokenOwner, type HorizenClientOptions, type HorizenFetch } from './client';
import { resolveRegistrableAgent, type RegistrableAgentConfig } from './registrableAgents';
import { resolveAgentOwnerWalletAddress } from './registrationClient';

export type PnlOnboardingRefusalCode =
  | 'UNKNOWN_AGENT'
  | 'OWNER_WALLET_UNRESOLVED'
  | 'OWNER_KEY_NOT_CONFIGURED'
  | 'TERMS_UNAVAILABLE'
  | 'NONCE_UNAVAILABLE'
  | 'TOKEN_OWNERSHIP_UNVERIFIABLE'
  | 'TOKEN_NOT_OWNED_BY_AGENT'
  | 'TRADING_WALLET_DECISION_REQUIRED'
  | 'TRADING_WALLET_MUST_DIFFER_FROM_OWNER'
  | 'TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED'
  | 'CONFIRM_REQUIRED'
  | 'REGISTER_REQUEST_FAILED';

export type PnlOnboardingResult<T> =
  | { ok: true; value: T }
  | { ok: false; refusalCode: PnlOnboardingRefusalCode; detail: string };

export interface PnlOnboardingDeps {
  fetchImpl?: HorizenFetch;
  /** Injectable so tests never sign with a real key. Defaults to a fresh ethers.Wallet from the resolved owner private key. */
  resolveOwnerPrivateKey?: (agent: RegistrableAgentConfig) => Promise<string | null>;
  /** Injectable so tests never touch a real AgentKeyService/Supabase. Defaults to the same resolver registrationClient.ts's Register stage uses. */
  resolveOwnerWalletAddress?: (agent: RegistrableAgentConfig) => Promise<string | null>;
}

async function defaultResolveOwnerPrivateKey(agent: RegistrableAgentConfig): Promise<string | null> {
  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const keys = await new AgentKeyService().getAgentKeys(agent.runtimeAgentId);
  return keys?.evmPrivateKey ?? null;
}

/**
 * The EXACT SIWE message template from the runbook's own reference
 * implementations (viem, CDP, Python — all three build the identical
 * string). `statement` MUST be `GET /v1/terms`'s own `statement` field,
 * embedded verbatim, or `/v1/register` rejects with `TERMS_NOT_ACCEPTED`.
 */
export function buildPnlSiweMessage(input: {
  domain: string;
  address: string;
  uri: string;
  termsStatement: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  return (
    `${input.domain} wants you to sign in with your Ethereum account:\n` +
    `${input.address}\n\n` +
    `Register your AI agent on the DeFi Agents Verifiable PnL leaderboard. ${input.termsStatement}\n\n` +
    `URI: ${input.uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${input.chainId}\n` +
    `Nonce: ${input.nonce}\n` +
    `Issued At: ${input.issuedAt}\n` +
    `Expiration Time: ${input.expirationTime}`
  );
}

export interface ExistingModeEligibility {
  agentSlug: string;
  tokenId: string;
  ownerWalletAddress: string;
  /** null until the caller supplies one — see the module doc's blocker #1. */
  tradingWalletAddress: string | null;
  /** From `GET /v1/erc8004/{tokenId}/owner` — null when the registry read itself couldn't verify (not a denial). */
  onChainOwner: string | null;
  ownerMatches: boolean;
}

/**
 * Pre-check for `existing`-mode registration — resolves the agent's owner
 * wallet, reads the token's on-chain owner from Horizen's own public
 * pre-check endpoint, and states plainly whether a distinct trading wallet
 * has even been decided yet. Never mutates anything; safe to call at any
 * time to see where onboarding currently stands.
 */
export async function checkExistingModeEligibility(
  input: { agentSlug: string; tokenId: string; tradingWalletAddress?: string },
  deps: PnlOnboardingDeps = {},
): Promise<PnlOnboardingResult<ExistingModeEligibility>> {
  const agent = resolveRegistrableAgent(input.agentSlug);
  if (!agent) {
    return { ok: false, refusalCode: 'UNKNOWN_AGENT', detail: `"${input.agentSlug}" is not a registrable agent` };
  }
  const resolveOwnerWalletAddress = deps.resolveOwnerWalletAddress ?? resolveAgentOwnerWalletAddress;
  const ownerWalletAddress = await resolveOwnerWalletAddress(agent);
  if (!ownerWalletAddress) {
    return {
      ok: false,
      refusalCode: 'OWNER_WALLET_UNRESOLVED',
      detail: `${agent.displayName} has no custodied wallet on record (agent_keys, runtimeAgentId "${agent.runtimeAgentId}")`,
    };
  }

  const clientOptions: HorizenClientOptions = { fetchImpl: deps.fetchImpl };
  const ownerRead = await fetchPnlTokenOwner(input.tokenId, clientOptions);
  const onChainOwner = ownerRead.ok && ownerRead.value.verifiable ? ownerRead.value.owner : null;
  if (!ownerRead.ok && ownerRead.reason !== 'not-found') {
    return {
      ok: false,
      refusalCode: 'TOKEN_OWNERSHIP_UNVERIFIABLE',
      detail: `GET /v1/erc8004/${input.tokenId}/owner could not be read: ${ownerRead.detail} — this says nothing about ownership, only that the pre-check itself failed`,
    };
  }
  const ownerMatches = onChainOwner ? onChainOwner.toLowerCase() === ownerWalletAddress.toLowerCase() : false;
  if (onChainOwner && !ownerMatches) {
    return {
      ok: false,
      refusalCode: 'TOKEN_NOT_OWNED_BY_AGENT',
      detail: `tokenId ${input.tokenId} is owned by ${onChainOwner} on Horizen's own pre-check, not ${agent.displayName}'s resolved owner wallet ${ownerWalletAddress}`,
    };
  }

  const tradingWalletAddress = input.tradingWalletAddress?.trim() || null;
  if (!tradingWalletAddress) {
    return {
      ok: false,
      refusalCode: 'TRADING_WALLET_DECISION_REQUIRED',
      detail:
        `Horizen's existing-mode registration requires a trading wallet address DISTINCT from the owner wallet ` +
        `(${ownerWalletAddress}) — its PnL is published on the public leaderboard, so reusing the owner wallet would ` +
        `deanonymize the owner and is rejected server-side (400 INVALID_INPUT). This codebase's current wallet ` +
        `topology has exactly one wallet per agent; no dedicated trading wallet exists for "${agent.slug}". This is ` +
        `an operator decision, not something this function may assign — supply tradingWalletAddress once one exists.`,
    };
  }
  if (tradingWalletAddress.toLowerCase() === ownerWalletAddress.toLowerCase()) {
    return {
      ok: false,
      refusalCode: 'TRADING_WALLET_MUST_DIFFER_FROM_OWNER',
      detail: `tradingWalletAddress equals the owner wallet (${ownerWalletAddress}) — Horizen rejects this with 400 INVALID_INPUT`,
    };
  }

  return {
    ok: true,
    value: { agentSlug: agent.slug, tokenId: input.tokenId, ownerWalletAddress, tradingWalletAddress, onChainOwner, ownerMatches },
  };
}

export interface RegisterExistingAgentInput {
  agentSlug: string;
  tokenId: string;
  tradingWalletAddress: string;
  network: HorizenNetwork;
  /** Never skipped implicitly — mirrors registrationClient.ts's broadcastAgentRegistration confirm gate. */
  confirm: true;
  /**
   * A pre-computed EIP-712 signature proving the trading wallet consents to
   * the link — see the module doc's blocker #2. This module does not (and,
   * without Horizen publishing the schema, cannot) construct this itself.
   */
  tradingLinkWallet?: { signature: string; deadline: string };
}

export interface RegisteredPnlAgent {
  agentId: string;
}

/**
 * `POST /v1/register` with `mode: 'existing'` — the real mutation. Refuses
 * before ever contacting Horizen if any precondition is unmet; never signs
 * or submits partially.
 */
export async function registerExistingAgent(
  input: RegisterExistingAgentInput,
  deps: PnlOnboardingDeps = {},
): Promise<PnlOnboardingResult<RegisteredPnlAgent>> {
  if (input.confirm !== true) {
    return { ok: false, refusalCode: 'CONFIRM_REQUIRED', detail: 'confirm must be true — this function never registers without explicit confirmation' };
  }
  const eligibility = await checkExistingModeEligibility(
    { agentSlug: input.agentSlug, tokenId: input.tokenId, tradingWalletAddress: input.tradingWalletAddress },
    deps,
  );
  if (!eligibility.ok) return eligibility;

  if (!input.tradingLinkWallet) {
    return {
      ok: false,
      refusalCode: 'TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED',
      detail:
        'Horizen\'s openapi.json names the existing-mode field (tradingLinkWallet: an EIP-712 "proof the trading ' +
        'wallet consents to being linked") but publishes no domain/types/message definition for it — unlike ' +
        'POST /v1/prove\'s EIP-712 envelope, which IS fully specified. Refusing rather than fabricating a typed-data ' +
        'shape Horizen has not documented. Supply a pre-computed { signature, deadline } once the schema is known.',
    };
  }

  const agent = resolveRegistrableAgent(input.agentSlug)!; // eligibility.ok already proved this resolves
  const resolveOwnerPrivateKey = deps.resolveOwnerPrivateKey ?? defaultResolveOwnerPrivateKey;
  const ownerPrivateKey = await resolveOwnerPrivateKey(agent);
  if (!ownerPrivateKey) {
    return { ok: false, refusalCode: 'OWNER_KEY_NOT_CONFIGURED', detail: `no owner wallet private key configured for "${agent.slug}" (agent_keys)` };
  }

  const clientOptions: HorizenClientOptions = { fetchImpl: deps.fetchImpl };
  const termsRead = await fetchPnlTerms(clientOptions);
  if (!termsRead.ok) {
    return { ok: false, refusalCode: 'TERMS_UNAVAILABLE', detail: `GET /v1/terms failed: ${termsRead.detail}` };
  }
  const nonceRead = await fetchPnlSiweNonce(clientOptions);
  if (!nonceRead.ok) {
    return { ok: false, refusalCode: 'NONCE_UNAVAILABLE', detail: `GET /v1/siwe/nonce failed: ${nonceRead.detail}` };
  }

  // Identity chain, not the P&L proof chain — see D's chain-semantics note
  // in pnlServiceVerification.ts. SIWE authenticates OWNERSHIP of the
  // ERC-8004 identity, which lives on this network.
  const chainId = HORIZEN_NETWORK_FACTS[input.network].chainId;
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const ownerSiweMessage = buildPnlSiweMessage({
    domain: nonceRead.value.expectedDomain,
    address: eligibility.value.ownerWalletAddress,
    uri: nonceRead.value.expectedUri,
    termsStatement: termsRead.value.statement,
    chainId,
    nonce: nonceRead.value.nonce,
    issuedAt,
    expirationTime,
  });
  const ownerWallet = new ethers.Wallet(ownerPrivateKey);
  const ownerSignature = await ownerWallet.signMessage(ownerSiweMessage);

  const fetchImpl = deps.fetchImpl;
  const body = {
    mode: 'existing' as const,
    tokenId: input.tokenId,
    tradingWallet: input.tradingWalletAddress,
    ownerSiwe: { message: ownerSiweMessage, signature: ownerSignature },
    tradingLinkWallet: input.tradingLinkWallet,
  };
  try {
    const res = fetchImpl
      ? await fetchImpl(`${HORIZEN_PNL_BASE}/v1/register`, {
          headers: { 'Content-Type': 'application/json' },
          // HorizenFetch's type only declares GET-shaped options in client.ts,
          // but the underlying fetch/fetchWithRetry both accept method+body —
          // widened here rather than forking a second transport.
          ...({ method: 'POST', body: JSON.stringify(body) } as Record<string, unknown>),
        } as Parameters<HorizenFetch>[1])
      : await fetch(`${HORIZEN_PNL_BASE}/v1/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = (json.error ?? {}) as Record<string, unknown>;
      return {
        ok: false,
        refusalCode: 'REGISTER_REQUEST_FAILED',
        detail: `POST /v1/register rejected [${err.code ?? res.status}]: ${err.message ?? 'unknown error'}${err.hint ? ` — ${err.hint}` : ''}`,
      };
    }
    if (typeof json.agentId !== 'string') {
      return { ok: false, refusalCode: 'REGISTER_REQUEST_FAILED', detail: `POST /v1/register returned no agentId: ${JSON.stringify(json)}` };
    }
    return { ok: true, value: { agentId: json.agentId } };
  } catch (err) {
    return { ok: false, refusalCode: 'REGISTER_REQUEST_FAILED', detail: err instanceof Error ? err.message : String(err) };
  }
}
