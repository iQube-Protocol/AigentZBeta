/**
 * services/horizen/pnlOnboardingClient.ts — the dedicated MUTATING boundary
 * for Horizen Verifiable-PnL onboarding (Horizen Pilot Closure, part C,
 * 2026-08-09; contract corrected against a second live fetch same day).
 *
 * Verifies the one real blocker refuses honestly rather than fabricates: no
 * trading wallet distinct from the owner wallet exists in this codebase's
 * current topology, so `registerExistingAgent` refuses at
 * TRADING_WALLET_DECISION_REQUIRED (no caller-supplied address) or
 * TRADING_KEY_NOT_CONFIGURED (address supplied but no private-key resolver —
 * the wallet's own SIWE consent message must be signed by that wallet).
 * Also pins the exact SIWE message template (quoted from Horizen's
 * live-fetched runbook), the ownership pre-check's use of the genuinely
 * public, unauthenticated `GET /v1/erc8004/{tokenId}/owner` endpoint, and the
 * full existing-mode register body shape (agentCard/ownerWallet/tradingWallet
 * /tradingSiwe — no EIP-712 anywhere in this flow).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildPnlSiweMessage,
  checkExistingModeEligibility,
  registerExistingAgent,
} from '@/services/horizen/pnlOnboardingClient';

const OWNER_WALLET = '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9'; // Nakamoto's real wallet, per the codebase's own registration test fixtures
const TRADING_WALLET = '0x1111111111111111111111111111111111111a';

function fakeFetch(
  handlers: Record<string, (url: string, init?: any) => { status: number; body: unknown; headers?: Record<string, string> }>,
) {
  return vi.fn(async (url: string, init?: any) => {
    const key = Object.keys(handlers).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    const { status, body, headers } = handlers[key](url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      headers: { get: (name: string) => headers?.[name.toLowerCase()] ?? null },
    } as any;
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

describe('registerExistingAgent — refuses rather than fabricates a trading-wallet signature it cannot produce', () => {
  it('refuses TRADING_KEY_NOT_CONFIGURED when no resolveTradingWalletPrivateKey is supplied', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    const result = await registerExistingAgent(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET, network: 'base-sepolia', confirm: true },
      { fetchImpl, resolveOwnerWalletAddress: async () => OWNER_WALLET, resolveOwnerPrivateKey: async () => '0x' + '11'.repeat(32) },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TRADING_KEY_NOT_CONFIGURED' });
  });

  it('refuses TRADING_KEY_NOT_CONFIGURED when the resolver itself returns null (address supplied, no key)', async () => {
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
    });
    const result = await registerExistingAgent(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET, network: 'base-sepolia', confirm: true },
      {
        fetchImpl,
        resolveOwnerWalletAddress: async () => OWNER_WALLET,
        resolveOwnerPrivateKey: async () => '0x' + '11'.repeat(32),
        resolveTradingWalletPrivateKey: async () => null,
      },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'TRADING_KEY_NOT_CONFIGURED' });
  });

  it('completes the full existing-mode ceremony once both keys are genuinely resolvable — owner session, then tradingSiwe, then register', async () => {
    const OWNER_KEY = '0x' + '11'.repeat(32);
    const TRADING_KEY = '0x' + '22'.repeat(32);
    let capturedRegisterBody: any = null;
    let capturedRegisterHeaders: any = null;
    const fetchImpl = fakeFetch({
      '/owner': () => ({ status: 200, body: { tokenId: '8798', owner: OWNER_WALLET, verifiable: true } }),
      '/terms': () => ({ status: 200, body: { version: 'v3', contentHash: 'abc123', statement: 'I accept the Terms v3', content: '...' } }),
      '/siwe/nonce': () => ({ status: 200, body: { nonce: 'nonce-xyz', expectedDomain: 'agent-registry.horizenlabs.io', expectedUri: 'https://agent-registry.horizenlabs.io/verifiable-pnl' } }),
      '/auth/siwe': () => ({ status: 200, body: { ok: true }, headers: { 'set-cookie': 'horizen_session=abc; Path=/' } }),
      '/register': (_url: string, init: any) => {
        capturedRegisterBody = JSON.parse(init.body);
        capturedRegisterHeaders = init.headers;
        return { status: 200, body: { agentId: 'pnl-agent-123' } };
      },
    });
    const result = await registerExistingAgent(
      { agentSlug: 'nakamoto', tokenId: '8798', tradingWalletAddress: TRADING_WALLET, network: 'base-sepolia', confirm: true },
      {
        fetchImpl,
        resolveOwnerWalletAddress: async () => OWNER_WALLET,
        resolveOwnerPrivateKey: async () => OWNER_KEY,
        resolveTradingWalletPrivateKey: async () => TRADING_KEY,
      },
    );
    expect(result).toMatchObject({ ok: true, value: { agentId: 'pnl-agent-123' } });
    expect(capturedRegisterBody).toMatchObject({
      mode: 'existing',
      tokenId: '8798',
      agentCard: { name: 'Aigent Nakamoto' },
      ownerWallet: OWNER_WALLET,
      tradingWallet: TRADING_WALLET,
    });
    expect(capturedRegisterBody.tradingSiwe.message).toContain(TRADING_WALLET);
    expect(typeof capturedRegisterBody.tradingSiwe.signature).toBe('string');
    expect(capturedRegisterBody.ownerSiwe).toBeUndefined();
    expect(capturedRegisterHeaders.Cookie).toBe('horizen_session=abc; Path=/');
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
