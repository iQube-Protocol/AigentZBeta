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

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createFakeSupabase } from './_lib/fakeSupabase';

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

// ─────────────────────────────────────────────────────────────────────────
// provisionOwnerWallet — Factor/Aegis wallet provisioning (2026-09-05
// operator directive). Backed by tests/_lib/fakeSupabase.ts's in-memory
// `agent_keys` table via a mocked initAgentiqClient, so these exercise the
// REAL check-then-create logic and the REAL AES-256-CBC encrypt/decrypt
// round trip in AgentKeyService — only the network boundary is faked.
// ─────────────────────────────────────────────────────────────────────────

let fakeAdmin: ReturnType<typeof createFakeSupabase>['admin'];
vi.mock('@/services/core/agentiqClient', () => ({
  initAgentiqClient: () => ({ supabase: fakeAdmin, ensureIamUser: async () => ({ ok: true }) }),
}));

describe('AgentPurposeWalletService.provisionOwnerWallet', () => {
  const REAL_SECRET = 'a-real-test-only-encryption-secret-32b';

  beforeEach(() => {
    fakeAdmin = createFakeSupabase().admin;
    vi.resetModules();
  });

  it('fails closed when AGENT_KEY_ENCRYPTION_SECRET is missing — never falls back to AgentKeyService\'s insecure default', async () => {
    delete process.env.AGENT_KEY_ENCRYPTION_SECRET;
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const result = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('AGENT_KEY_ENCRYPTION_SECRET_MISSING');
  });

  it('fails closed when AGENT_KEY_ENCRYPTION_SECRET equals the known insecure default', async () => {
    process.env.AGENT_KEY_ENCRYPTION_SECRET = 'default-insecure-key-change-in-production-32bytes';
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const result = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusalCode).toBe('AGENT_KEY_ENCRYPTION_SECRET_INSECURE_DEFAULT');
  });

  it('creates a real wallet on first call, and never returns a private key', async () => {
    process.env.AGENT_KEY_ENCRYPTION_SECRET = REAL_SECRET;
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const result = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor', fioHandle: 'factor@aigent' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(JSON.stringify(result)).not.toMatch(/private/i);
    }
    const address = await service.getOwnerWalletAddress('aigent-factor');
    expect(address).toBe((result as { ok: true; address: string }).address);
  });

  it('never rotates on rerun — a second call returns the SAME address, created: false', async () => {
    process.env.AGENT_KEY_ENCRYPTION_SECRET = REAL_SECRET;
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const first = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' });
    const second = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.created).toBe(false);
      expect(second.address).toBe(first.address);
    }
  });

  it('two different agents get two different addresses', async () => {
    process.env.AGENT_KEY_ENCRYPTION_SECRET = REAL_SECRET;
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const factor = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' });
    const aegis = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-aegis', agentName: 'Aegis' });
    expect(factor.ok && aegis.ok).toBe(true);
    if (factor.ok && aegis.ok) expect(factor.address).not.toBe(aegis.address);
  });

  it('the owner wallet and a settlement purpose wallet for the SAME agent get DIFFERENT addresses', async () => {
    process.env.AGENT_KEY_ENCRYPTION_SECRET = REAL_SECRET;
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    const owner = await service.provisionOwnerWallet({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' });
    const settlement = await service.provisionPurposeWallet({ agentRuntimeId: 'aigent-factor', walletRole: 'settlement', network: 'base-mainnet', chainId: 8453 });
    expect(owner.ok && settlement.ok).toBe(true);
    if (owner.ok && settlement.ok) expect(owner.address).not.toBe(settlement.binding.address);
  });

  it('getOwnerWalletAddress returns null for an agent with no provisioned wallet — never fabricates one', async () => {
    process.env.AGENT_KEY_ENCRYPTION_SECRET = REAL_SECRET;
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const service = new AgentPurposeWalletService();
    expect(await service.getOwnerWalletAddress('aigent-nobody')).toBeNull();
  });
});
