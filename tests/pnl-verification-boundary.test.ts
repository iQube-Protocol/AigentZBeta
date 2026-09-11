/**
 * services/horizen/pnlVerificationBoundary.ts — the production wiring for
 * discoverAndReceiptPnlServiceEvidence (Horizen Pilot Closure item 4,
 * 2026-08-09). Every real dependency mocked; exercises
 * attemptPnlServiceVerificationIfEligible() directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDiscover = vi.fn();
vi.mock('@/services/horizen/pnlServiceVerification', () => ({
  discoverAndReceiptPnlServiceEvidence: (...args: any[]) => mockDiscover(...args),
}));

import { attemptPnlServiceVerificationIfEligible } from '@/services/horizen/pnlVerificationBoundary';

const NAKAMOTO = {
  slug: 'nakamoto',
  displayName: 'Aigent Nakamoto',
  runtimeAgentId: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  agentCardPath: '/api/agents/nakamoto/agent-card.json',
  fioHandle: 'nakamoto@aigent',
  runtimeHealthPath: '/api/agents/nakamoto/health',
};

const MONEYPENNY = {
  ...NAKAMOTO,
  slug: 'moneypenny',
  displayName: 'Aigent MoneyPenny',
  runtimeAgentId: 'aigent-moneypenny',
  aigentQubeId: 'aigentqube-moneypenny',
};

beforeEach(() => {
  mockDiscover.mockReset();
});

describe('attemptPnlServiceVerificationIfEligible', () => {
  it('returns null and never calls the correlator when registration is not confirmed', async () => {
    const result = await attemptPnlServiceVerificationIfEligible(NAKAMOTO, { registered: false, tokenId: null, registryAgentId: null, network: null }, 'persona-1');
    expect(result).toBeNull();
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it('returns null when registration is confirmed but no token/alias is known', async () => {
    const result = await attemptPnlServiceVerificationIfEligible(NAKAMOTO, { registered: true, tokenId: null, registryAgentId: null, network: 'base-sepolia' }, 'persona-1');
    expect(result).toBeNull();
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it('returns null (audit gap) when no persona can be attributed, even if eligible', async () => {
    const result = await attemptPnlServiceVerificationIfEligible(NAKAMOTO, { registered: true, tokenId: '8798', registryAgentId: null, network: 'base-sepolia' }, null);
    expect(result).toBeNull();
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it('calls discoverAndReceiptPnlServiceEvidence with the agent\'s own subject/network, agent-generically', async () => {
    mockDiscover.mockResolvedValue({ ok: true, verified: true, alreadyVerified: false, receiptRef: 'receipt-pnl-1', evidence: {} });
    const result = await attemptPnlServiceVerificationIfEligible(
      NAKAMOTO,
      { registered: true, tokenId: '8798', registryAgentId: '0x225e', network: 'base-sepolia' },
      'persona-1',
    );
    expect(mockDiscover).toHaveBeenCalledWith({
      aigentQubeId: 'aigentqube-nakamoto',
      subjectRegistryAlias: '0x225e', // prefers registryAgentId over tokenId
      network: 'base-sepolia',
      actorPersonaId: 'persona-1',
      runtimeAgentId: 'aigent-nakamoto',
    });
    expect(result?.ok).toBe(true);
  });

  it('falls back to tokenId when registryAgentId is absent', async () => {
    mockDiscover.mockResolvedValue({ ok: true, verified: false, evidencePending: true, reason: 'NOT_FOUND', detail: 'no correlation', openContractQuestion: 'q' });
    await attemptPnlServiceVerificationIfEligible(
      MONEYPENNY,
      { registered: true, tokenId: '42', registryAgentId: null, network: 'base-sepolia' },
      'persona-2',
    );
    expect(mockDiscover).toHaveBeenCalledWith(expect.objectContaining({ subjectRegistryAlias: '42', aigentQubeId: 'aigentqube-moneypenny', runtimeAgentId: 'aigent-moneypenny' }));
  });

  it('defaults network to base-sepolia when the registration state carries none', async () => {
    mockDiscover.mockResolvedValue({ ok: true, verified: false, evidencePending: true, reason: 'NOT_FOUND', detail: 'x', openContractQuestion: 'q' });
    await attemptPnlServiceVerificationIfEligible(NAKAMOTO, { registered: true, tokenId: '8798', registryAgentId: null, network: null }, 'persona-1');
    expect(mockDiscover).toHaveBeenCalledWith(expect.objectContaining({ network: 'base-sepolia' }));
  });
});
