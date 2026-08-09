/**
 * Horizen Verifiable-PnL onboarding — the DEDICATED MUTATING boundary
 * (Horizen Pilot Closure, part C, 2026-08-09).
 *
 * ── WHY THIS IS SEPARATE FROM pnlServiceVerification.ts ────────────────────
 *
 * `pnlServiceVerification.ts` is deliberately read-only — it discovers and
 * receipts EVIDENCE of an existing PnL correlation, and never mutates
 * anything. Registering an agent with Horizen's Verifiable-PnL service is a
 * genuine mutation (a signed SIWE session, a signed SIWE wallet-link, a
 * `POST /v1/register` call) and belongs in its own boundary — the same
 * separation `registrationClient.ts` (mutating: prepare/broadcast/check) and
 * `client.ts` (read-only: registry/pulse/PnL correlation reads) already
 * establish for ERC-8004 identity registration. This module is that
 * boundary for Verifiable PnL.
 *
 * ── THE CONTRACT, RE-VERIFIED LIVE (2026-08-09, second pass) ────────────────
 *
 * Every endpoint and field name below is quoted from Horizen's OWN
 * currently-published runbook, re-fetched fresh on this date:
 *   - `https://agent-registry.horizenlabs.io/verifiable-pnl/AGENTS.md`
 *
 * CORRECTION to this module's first pass (same day, earlier): the first read
 * assumed `existing`-mode registration signed an `ownerSiwe` inline and
 * required an undocumented `tradingLinkWallet` EIP-712 envelope. A second,
 * more careful fetch of AGENTS.md shows the REAL shape:
 *
 *   POST /v1/register (mode: 'existing')
 *   { mode: 'existing', tokenId, agentCard: { name }, ownerWallet,
 *     tradingWallet, tradingSiwe: { message, signature } }
 *
 * Owner identity is established by a PRIOR `POST /v1/auth/siwe` call (owner
 * signs a standard SIWE message, server sets a session cookie); `ownerWallet`
 * in the register body is then just the plain address, checked against that
 * session — no `ownerSiwe` field in the register call itself. The ONLY
 * signature carried inline in `/v1/register` is `tradingSiwe`: a standard
 * SIWE message (the SAME template `buildPnlSiweMessage` already builds for
 * the owner) signed by the TRADING wallet, proving ITS consent to the link.
 * No EIP-712 anywhere in this flow — EIP-712 is used only by the separate
 * `POST /v1/prove/{jobId}/sign` performance-proof step, which is out of scope
 * here. The previous `TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED` refusal
 * described a schema gap that turned out not to exist and is removed.
 *
 * ── WHAT THIS MODULE STILL CANNOT DO, AND WHY ───────────────────────────────
 *
 * A TRADING WALLET DISTINCT FROM THE OWNER WALLET. The runbook states this as
 * a hard server-side rule, confirmed on both fetches: "tradingWallet MUST
 * differ from ownerWallet... rejected with 400 INVALID_INPUT" — because the
 * trading wallet's PnL is PUBLISHED on the leaderboard, and linking the owner
 * wallet would deanonymize the owner. This codebase's current wallet topology
 * has exactly ONE wallet per agent (`agent_keys`, one `evm_address` per
 * `runtimeAgentId` — see `registrableAgents.ts`'s own doctrine: "the ONE
 * agent-wallet custody path, never a parallel one"). There is no dedicated
 * trading wallet to reach for, and none is fabricated here —
 * `checkExistingModeEligibility` refuses with `TRADING_WALLET_DECISION_REQUIRED`
 * until a genuine, distinct trading wallet address (with a resolvable private
 * key, so its SIWE consent message can actually be signed) is supplied.
 *
 * Everything else below — terms/nonce fetch, the owner SIWE session, the
 * trading-wallet SIWE consent message, the ownership pre-check, the register
 * call itself — is fully specified and implemented for real.
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
  | 'TRADING_KEY_NOT_CONFIGURED'
  | 'TERMS_UNAVAILABLE'
  | 'NONCE_UNAVAILABLE'
  | 'TOKEN_OWNERSHIP_UNVERIFIABLE'
  | 'TOKEN_NOT_OWNED_BY_AGENT'
  | 'TRADING_WALLET_DECISION_REQUIRED'
  | 'TRADING_WALLET_MUST_DIFFER_FROM_OWNER'
  | 'OWNER_AUTH_FAILED'
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
  /**
   * The TRADING wallet's own private key, so its SIWE consent message
   * (`tradingSiwe`) can be signed. No default resolver exists — this
   * codebase has no dedicated trading-wallet custody path yet (see the
   * module doc). A caller with a genuinely provisioned trading wallet must
   * supply this explicitly; absent, `registerExistingAgent` refuses with
   * `TRADING_KEY_NOT_CONFIGURED` rather than falling back to anything.
   */
  resolveTradingWalletPrivateKey?: (tradingWalletAddress: string) => Promise<string | null>;
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
}

export interface RegisteredPnlAgent {
  agentId: string;
}

function rawFetch(deps: PnlOnboardingDeps) {
  return deps.fetchImpl ?? (fetch as unknown as HorizenFetch);
}

/**
 * `POST /v1/auth/siwe` — establishes the owner's session (Set-Cookie), which
 * `POST /v1/register`'s `ownerWallet` field is checked against. Standalone
 * because both `existing`-mode registration and any future `/v1/agents/owned`
 * read need the same owner session.
 */
async function authenticateOwnerSession(
  agent: RegistrableAgentConfig,
  ownerWalletAddress: string,
  ownerPrivateKey: string,
  network: HorizenNetwork,
  deps: PnlOnboardingDeps,
): Promise<{ ok: true; cookie: string | null } | { ok: false; refusalCode: PnlOnboardingRefusalCode; detail: string }> {
  const clientOptions: HorizenClientOptions = { fetchImpl: deps.fetchImpl };
  const termsRead = await fetchPnlTerms(clientOptions);
  if (!termsRead.ok) {
    return { ok: false, refusalCode: 'TERMS_UNAVAILABLE', detail: `GET /v1/terms failed: ${termsRead.detail}` };
  }
  const nonceRead = await fetchPnlSiweNonce(clientOptions);
  if (!nonceRead.ok) {
    return { ok: false, refusalCode: 'NONCE_UNAVAILABLE', detail: `GET /v1/siwe/nonce failed: ${nonceRead.detail}` };
  }

  // Identity chain, not the P&L proof chain — see part D's chain-semantics
  // note in pnlServiceVerification.ts. SIWE authenticates OWNERSHIP of the
  // ERC-8004 identity, which lives on this network.
  const chainId = HORIZEN_NETWORK_FACTS[network].chainId;
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = buildPnlSiweMessage({
    domain: nonceRead.value.expectedDomain,
    address: ownerWalletAddress,
    uri: nonceRead.value.expectedUri,
    termsStatement: termsRead.value.statement,
    chainId,
    nonce: nonceRead.value.nonce,
    issuedAt,
    expirationTime,
  });
  const wallet = new ethers.Wallet(ownerPrivateKey);
  const signature = await wallet.signMessage(message);

  const doFetch = rawFetch(deps);
  try {
    const res = await doFetch(`${HORIZEN_PNL_BASE}/v1/auth/siwe`, {
      headers: { 'Content-Type': 'application/json' },
      ...({ method: 'POST', body: JSON.stringify({ message, signature }) } as Record<string, unknown>),
    } as Parameters<HorizenFetch>[1]);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const err = (json.error ?? {}) as Record<string, unknown>;
      return { ok: false, refusalCode: 'OWNER_AUTH_FAILED', detail: `POST /v1/auth/siwe rejected [${err.code ?? res.status}]: ${err.message ?? 'unknown error'}` };
    }
    const cookie = typeof res.headers?.get === 'function' ? res.headers.get('set-cookie') : null;
    return { ok: true, cookie };
  } catch (err) {
    return { ok: false, refusalCode: 'OWNER_AUTH_FAILED', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * `POST /v1/register` with `mode: 'existing'` — the real mutation. Refuses
 * before ever contacting Horizen if any precondition is unmet; never signs
 * or submits partially.
 *
 * Ceremony (confirmed live, 2026-08-09 — see module doc):
 *   1. Owner signs a SIWE message -> POST /v1/auth/siwe -> session cookie
 *   2. Trading wallet signs ITS OWN SIWE message (same template, different
 *      signer) -> carried inline as `tradingSiwe` in the register body
 *   3. POST /v1/register { mode: 'existing', tokenId, agentCard, ownerWallet,
 *      tradingWallet, tradingSiwe }, with the owner's session cookie attached
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

  const agent = resolveRegistrableAgent(input.agentSlug)!; // eligibility.ok already proved this resolves
  const resolveOwnerPrivateKey = deps.resolveOwnerPrivateKey ?? defaultResolveOwnerPrivateKey;
  const ownerPrivateKey = await resolveOwnerPrivateKey(agent);
  if (!ownerPrivateKey) {
    return { ok: false, refusalCode: 'OWNER_KEY_NOT_CONFIGURED', detail: `no owner wallet private key configured for "${agent.slug}" (agent_keys)` };
  }

  // No default resolver exists for this — see the module doc. A caller
  // without a genuinely provisioned trading wallet refuses HERE, not with a
  // fabricated key or a silent fallback to the owner's.
  if (!deps.resolveTradingWalletPrivateKey) {
    return {
      ok: false,
      refusalCode: 'TRADING_KEY_NOT_CONFIGURED',
      detail:
        `No resolver for the trading wallet's (${input.tradingWalletAddress}) own private key was supplied — its SIWE ` +
        `consent message ("tradingSiwe") must be signed by that wallet itself, and this codebase has no dedicated ` +
        `trading-wallet custody path yet. Provisioning one is the operator decision this refusal exists to surface.`,
    };
  }
  const tradingPrivateKey = await deps.resolveTradingWalletPrivateKey(input.tradingWalletAddress);
  if (!tradingPrivateKey) {
    return { ok: false, refusalCode: 'TRADING_KEY_NOT_CONFIGURED', detail: `no private key resolvable for trading wallet ${input.tradingWalletAddress}` };
  }

  const ownerAuth = await authenticateOwnerSession(agent, eligibility.value.ownerWalletAddress, ownerPrivateKey, input.network, deps);
  if (!ownerAuth.ok) return ownerAuth;

  const clientOptions: HorizenClientOptions = { fetchImpl: deps.fetchImpl };
  const termsRead = await fetchPnlTerms(clientOptions);
  if (!termsRead.ok) {
    return { ok: false, refusalCode: 'TERMS_UNAVAILABLE', detail: `GET /v1/terms failed: ${termsRead.detail}` };
  }
  const nonceRead = await fetchPnlSiweNonce(clientOptions);
  if (!nonceRead.ok) {
    return { ok: false, refusalCode: 'NONCE_UNAVAILABLE', detail: `GET /v1/siwe/nonce failed: ${nonceRead.detail}` };
  }
  const chainId = HORIZEN_NETWORK_FACTS[input.network].chainId;
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const tradingSiweMessage = buildPnlSiweMessage({
    domain: nonceRead.value.expectedDomain,
    address: input.tradingWalletAddress,
    uri: nonceRead.value.expectedUri,
    termsStatement: termsRead.value.statement,
    chainId,
    nonce: nonceRead.value.nonce,
    issuedAt,
    expirationTime,
  });
  const tradingWallet = new ethers.Wallet(tradingPrivateKey);
  const tradingSignature = await tradingWallet.signMessage(tradingSiweMessage);

  const doFetch = rawFetch(deps);
  const body = {
    mode: 'existing' as const,
    tokenId: input.tokenId,
    agentCard: { name: agent.displayName },
    ownerWallet: eligibility.value.ownerWalletAddress,
    tradingWallet: input.tradingWalletAddress,
    tradingSiwe: { message: tradingSiweMessage, signature: tradingSignature },
  };
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ownerAuth.cookie) headers['Cookie'] = ownerAuth.cookie;
    const res = await doFetch(`${HORIZEN_PNL_BASE}/v1/register`, {
      headers,
      ...({ method: 'POST', body: JSON.stringify(body) } as Record<string, unknown>),
    } as Parameters<HorizenFetch>[1]);
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
