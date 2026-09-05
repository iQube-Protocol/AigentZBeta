/**
 * Provider-wallet binding — behavioral tests (Factor + Aegis Bankr PRD,
 * Phase 3/8). Uses the same in-memory fakeSupabase fixture as the Factor/
 * Aegis suites — no live Supabase credentials are exercised.
 */
import { describe, it, expect, vi } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';
import {
  provisionProviderWalletBinding,
  getProviderWalletBinding,
  revokeProviderWalletBinding,
  ProviderWalletBindingError,
  type CanonicalWalletResolver,
} from '@/services/financialServices/providers/providerWalletBinding';

const FACTOR_OWNER_ADDRESS = '0xF67299Ad3CB85f3A788CE38012C99Df7213E2734';
const FACTOR_SETTLEMENT_ADDRESS = '0xE478E454b8c97682CACabe0345bb01AF30900ac1';

function resolverFor(owner: string | null, settlement: string | null): CanonicalWalletResolver {
  return {
    getOwnerWalletAddress: async () => owner,
    getSettlementWalletAddress: async () => settlement,
  };
}

describe('provisionProviderWalletBinding — never overwrites/invents Factor\'s canonical MetaMe addresses', () => {
  it('refuses outright when the agent has no canonical owner wallet yet', async () => {
    const admin = makeFakeAdmin();
    await expect(
      provisionProviderWalletBinding(
        admin,
        { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' },
        resolverFor(null, null),
      ),
    ).rejects.toBeInstanceOf(ProviderWalletBindingError);
  });

  it('binds using the REAL owner/settlement addresses read from the wallet resolver — never caller-supplied', async () => {
    const admin = makeFakeAdmin();
    const binding = await provisionProviderWalletBinding(
      admin,
      { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' },
      resolverFor(FACTOR_OWNER_ADDRESS, FACTOR_SETTLEMENT_ADDRESS),
    );
    expect(binding.metame_owner_wallet_address).toBe(FACTOR_OWNER_ADDRESS);
    expect(binding.metame_settlement_wallet_address).toBe(FACTOR_SETTLEMENT_ADDRESS);
    expect(binding.status).toBe('active');
  });

  it('a settlement wallet is optional — a binding can exist with only an owner wallet', async () => {
    const admin = makeFakeAdmin();
    const binding = await provisionProviderWalletBinding(
      admin,
      { tenantId: 'default', agentRuntimeId: 'aigent-aegis', provider: 'bankr' },
      resolverFor('0xdb7a9015da6ca60609BD3b064B1a1EA5C8FD69AF', null),
    );
    expect(binding.metame_settlement_wallet_address).toBeNull();
  });
});

describe('idempotent provisioning', () => {
  it('a second provisioning call for the same (tenant, agent, provider) returns the SAME row, never a duplicate', async () => {
    const admin = makeFakeAdmin();
    const resolver = resolverFor(FACTOR_OWNER_ADDRESS, FACTOR_SETTLEMENT_ADDRESS);
    const first = await provisionProviderWalletBinding(admin, { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolver);
    const second = await provisionProviderWalletBinding(admin, { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolver);
    expect(second.id).toBe(first.id);
    expect(admin.table('provider_wallet_bindings').length).toBe(1);
  });

  it('re-provisioning refreshes the canonical addresses to whatever the resolver NOW reports — never stale', async () => {
    const admin = makeFakeAdmin();
    await provisionProviderWalletBinding(
      admin,
      { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' },
      resolverFor(FACTOR_OWNER_ADDRESS, FACTOR_SETTLEMENT_ADDRESS),
    );
    const rotatedOwner = '0x0000000000000000000000000000000000dEaD';
    const rotated = await provisionProviderWalletBinding(
      admin,
      { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' },
      resolverFor(rotatedOwner, FACTOR_SETTLEMENT_ADDRESS),
    );
    expect(rotated.metame_owner_wallet_address).toBe(rotatedOwner);
  });

  it('re-provisioning preserves provider-side fields already set when the new call omits them', async () => {
    const admin = makeFakeAdmin();
    const resolver = resolverFor(FACTOR_OWNER_ADDRESS, FACTOR_SETTLEMENT_ADDRESS);
    await provisionProviderWalletBinding(admin, {
      tenantId: 'default',
      agentRuntimeId: 'aigent-factor',
      provider: 'bankr',
      providerOrgId: 'org-123',
      allowedCapabilities: ['token_launch_quote'],
    }, resolver);
    const second = await provisionProviderWalletBinding(admin, { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolver);
    expect(second.provider_org_id).toBe('org-123');
    expect(second.allowed_capabilities).toEqual(['token_launch_quote']);
  });
});

describe('tenant isolation', () => {
  it('the same agent/provider under two different tenants produces two DISTINCT bindings', async () => {
    const admin = makeFakeAdmin();
    const resolver = resolverFor(FACTOR_OWNER_ADDRESS, FACTOR_SETTLEMENT_ADDRESS);
    const tenantA = await provisionProviderWalletBinding(admin, { tenantId: 'tenant-a', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolver);
    const tenantB = await provisionProviderWalletBinding(admin, { tenantId: 'tenant-b', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolver);
    expect(tenantA.id).not.toBe(tenantB.id);
    expect(admin.table('provider_wallet_bindings').length).toBe(2);
  });

  it('getProviderWalletBinding is tenant-scoped — a lookup under the wrong tenant finds nothing', async () => {
    const admin = makeFakeAdmin();
    await provisionProviderWalletBinding(admin, { tenantId: 'tenant-a', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolverFor(FACTOR_OWNER_ADDRESS, null));
    const wrongTenant = await getProviderWalletBinding(admin, 'tenant-b', 'aigent-factor', 'bankr');
    expect(wrongTenant).toBeNull();
    const rightTenant = await getProviderWalletBinding(admin, 'tenant-a', 'aigent-factor', 'bankr');
    expect(rightTenant).not.toBeNull();
  });
});

describe('revocation', () => {
  it('flips status to revoked and stamps revoked_at — the row is never deleted', async () => {
    const admin = makeFakeAdmin();
    await provisionProviderWalletBinding(admin, { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' }, resolverFor(FACTOR_OWNER_ADDRESS, null));
    await revokeProviderWalletBinding(admin, 'default', 'aigent-factor', 'bankr');
    const binding = await getProviderWalletBinding(admin, 'default', 'aigent-factor', 'bankr');
    expect(binding?.status).toBe('revoked');
    expect(binding?.revoked_at).toBeTruthy();
    expect(admin.table('provider_wallet_bindings').length).toBe(1);
  });
});

describe('defaultCanonicalWalletResolver is used only when a caller supplies no resolver', () => {
  it('provisionProviderWalletBinding accepts an injected resolver, never requiring live Supabase/env for a unit test', async () => {
    const admin = makeFakeAdmin();
    const spy = vi.fn(async () => FACTOR_OWNER_ADDRESS);
    const binding = await provisionProviderWalletBinding(
      admin,
      { tenantId: 'default', agentRuntimeId: 'aigent-factor', provider: 'bankr' },
      { getOwnerWalletAddress: spy, getSettlementWalletAddress: async () => null },
    );
    expect(spy).toHaveBeenCalledWith('aigent-factor');
    expect(binding.metame_owner_wallet_address).toBe(FACTOR_OWNER_ADDRESS);
  });
});
