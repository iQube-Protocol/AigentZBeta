/**
 * Agent purpose-bound wallet bindings (operator directive, 2026-08-09 —
 * Horizen Pilot Closure part 2: "Authorize a dedicated Nakamoto trading
 * wallet").
 *
 * Two guarantees pinned here, both checkable without a real database:
 *
 *   1. `deriveWalletCustodyRef` is namespaced so it can never collide with a
 *      real `agent_keys.agent_id` (every real one in this codebase is a bare
 *      runtimeAgentId with no `::` in it).
 *   2. Provisioning refuses the 'owner' role outright, before any network
 *      call — the owner/control wallet stays solely in `agent_keys`,
 *      addressed directly by runtimeAgentId; provisioning it through this
 *      table would recreate the second, parallel owner-wallet path the
 *      operator explicitly ruled out.
 */

import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  // Fake, non-network-reaching credentials — just enough for
  // `initAgentiqClient`'s createClient() call to succeed at construction
  // time. The 'owner' refusal below returns before any Supabase call.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
});

describe('deriveWalletCustodyRef — namespaced, never collides with a real runtimeAgentId', () => {
  it('produces "<runtimeAgentId>::wallet::<role>"', async () => {
    const { deriveWalletCustodyRef } = await import('@/services/wallet/agentPurposeWalletService');
    expect(deriveWalletCustodyRef('aigent-nakamoto', 'trading')).toBe('aigent-nakamoto::wallet::trading');
  });

  it('is distinct across roles for the same agent', async () => {
    const { deriveWalletCustodyRef } = await import('@/services/wallet/agentPurposeWalletService');
    const trading = deriveWalletCustodyRef('aigent-nakamoto', 'trading');
    const settlement = deriveWalletCustodyRef('aigent-nakamoto', 'settlement');
    expect(trading).not.toBe(settlement);
  });
});

describe('AgentPurposeWalletService.provisionPurposeWallet — refuses "owner" before any network call', () => {
  it('returns ROLE_NOT_PROVISIONABLE for owner, never touching Supabase or AgentKeyService', async () => {
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const result = await service.provisionPurposeWallet({
      agentRuntimeId: 'aigent-nakamoto',
      walletRole: 'owner',
      network: 'base-mainnet',
      chainId: 8453,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusalCode).toBe('ROLE_NOT_PROVISIONABLE');
      expect(result.detail.toLowerCase()).toContain('agent_keys');
    }
  });
});
