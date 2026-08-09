/**
 * services/horizen/pnlOnboardingClient.ts — the dedicated MUTATING boundary
 * for Horizen Verifiable-PnL onboarding (Horizen Pilot Closure, part C,
 * 2026-08-09).
 *
 * Verifies the two real, undocumented blockers refuse honestly rather than
 * fabricate: no trading wallet distinct from the owner wallet exists in this
 * codebase's current topology, and Horizen's own OpenAPI spec names but does
 * not define the `tradingLinkWallet` EIP-712 schema. Also pins the exact
 * SIWE message template (quoted from Horizen's live-fetched runbook) and the
 * ownership pre-check's use of the genuinely public, unauthenticated
 * `GET /v1/erc8004/{tokenId}/owner` endpoint.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildPnlSiweMessage,
  checkExistingModeEligibility,
  registerExistingAgent,
} from '@/services/horizen/pnlOnboardingClient';

const OWNER_WALLET = '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9'; // Nakamoto's real wallet, per the codebase's own registration test fixtures
const TRADING_WALLET = '0x1111111111111111111111111111111111111a';

function fakeFetch(handlers: Record<string, () => { status: number; body: unknown }>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(handlers).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    const { status, body } = handlers[key]();
    return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
  });
}

describe('buildPnlSiweMessage — the exact template from Horizen\'s live runbook, verbatim', () => {
  it('embeds the terms statement, domain, URI, chain id, nonce and timestamps in the documented order', () => {
    const msg = buildPnlSiweMessage({
      domain: 'agent-registry.horizenlabs.io',
      address: OWNER_WALLET,
      uri: 'https://agent-registry.horizenlabs.io/verifiable-pnl',
      termsStatement: 'I accept the Terms v3 (sha256:abc123)',
      chainId: 84532,
      nonce: 'nonce-123',
      issuedAt: '2026-08-09T00:00:00.000Z',
      expirationTime: '2026-08-09T00:10:00.000Z',
    });
    expect(msg).toContain('agent-registry.horizenlabs.io wants you to sign in with your Ethereum account:');
    expect(msg).toContain(OWNER_WALLET);
    expect(msg).toContain('Register your AI agent on the DeFi Agents Verifiable PnL leaderboard. I accept the Terms v3 (sha256:abc123)');
    expect(msg).toContain('URI: https://agent-registry.horizenlabs.io/verifiable-pnl');
    expect(msg).toContain('Chain ID: 84532');
    expect(msg).toContain('Nonce: nonce-123');
    expect(msg).toContain('Issued At: 2026-08-09T00:00:00.000Z');
    expect(msg).toContain('Expiration Time: 2026-08-09T00:10:00.000Z');
  });
});

describe('checkExistingModeEligibility — never silently reuses the owner wallet as the trading wallet', () => {
  it('refuses TRADING_WALLET_DECISION_REQUIRED when no trading wallet is supplied — this codebase has exactly one wallet per agent', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    const result = await checkExistingModeEligibility(
      { agentSlug: 'nakamoto', tokenId: '8798' },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TRADING_WALLET_DECISION_REQUIRED' });
  });

  it('refuses TRADING_WALLET_MUST_DIFFER_FROM_OWNER rather than let a caller pass the owner wallet as the trading wallet', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    const result = await checkExistingModeEligibility(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: OWNER_WALLET },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TRADING_WALLET_MUST_DIFFER_FROM_OWNER' });
  });

  it('refuses TOKEN_NOT_OWNED_BY_AGENT when Horizen\'s own pre-check reports a different owner — never silently proceeds', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: '0xDeadbeefDeadbeefDeadbeefDeadbeefDeadbeef', verifiable: true } }),
    });
    const result = await checkExistingModeEligibility(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TOKEN_NOT_OWNED_BY_AGENT' });
  });

  it('does not treat verifiable:false as a denial — the registry pre-check being unconfigured is a different fact from ownership failing', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: null, verifiable: false } }),
    });
    const result = await checkExistingModeEligibility(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result.ok).toBe(true);
  });

  it('succeeds when the on-chain owner matches the resolved owner wallet AND a distinct trading wallet is supplied', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    const result = await checkExistingModeEligibility(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({
      ok: true,
      value: { ownerWalletAddress: OWNER_WALLET, tradingWalletAddress: TRADING_WALLET, ownerMatches: true },
    });
  });

  it('refuses UNKNOWN_AGENT for a slug not in the registrable-agents config', async () => {
    const result = await checkExistingModeEligibility({ agentSlug: 'not-a-real-agent', tokenId: '1' });
    expect(result).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
  });
});

describe('registerExistingAgent — refuses rather than fabricates the undocumented tradingLinkWallet EIP-712 schema', () => {
  it('refuses TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED when no pre-computed tradingLinkWallet is supplied', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    const result = await registerExistingAgent(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET, network: 'base-sepolia', confirm: true },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TRADING_LINK_SIGNATURE_FORMAT_UNPUBLISHED' });
  });

  it('refuses CONFIRM_REQUIRED before ever reading eligibility — never registers implicitly', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('must never be called before confirm is checked');
    });
    const result = await registerExistingAgent(
      // @ts-expect-error — deliberately omitting confirm to exercise the refusal
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET, network: 'base-sepolia' },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'CONFIRM_REQUIRED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('propagates the SAME eligibility refusal (e.g. TRADING_WALLET_DECISION_REQUIRED) before ever attempting to sign or submit', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    // tradingWalletAddress omitted here would be a type error, so use the
    // owner wallet itself to trigger the "must differ" refusal instead —
    // still proves eligibility is checked before any signing dependency runs.
    const resolveOwnerPrivateKey = vi.fn(async () => 'should-never-be-called');
    const result = await registerExistingAgent(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: OWNER_WALLET, network: 'base-sepolia', confirm: true },
      { fetchImpl, resolveOwnerPrivateKey, resolveOwnerWalletAddress: async () => OWNER_WALLET },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TRADING_WALLET_MUST_DIFFER_FROM_OWNER' });
    expect(resolveOwnerPrivateKey).not.toHaveBeenCalled();
  });
});
