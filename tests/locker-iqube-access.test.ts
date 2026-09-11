import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getPersonaEntitlements: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/services/rewards/entitlementService', () => ({
  getEntitlementService: () => ({ getPersonaEntitlements: mocks.getPersonaEntitlements }),
}));

function query(single: unknown = null, rows: unknown[] = []) {
  const chain: Record<string, any> = {};
  for (const method of ['select', 'eq', 'is', 'in', 'limit', 'order']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => ({ data: single, error: null }));
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return chain;
}

describe('Locker and RoomQube canonical access', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getPersonaEntitlements.mockResolvedValue([]);
  });

  it('recognizes direct Locker ownership before commercial entitlements', async () => {
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === 'asset_records'
          ? query({ owner_persona_id: 'persona-ark' })
          : query(null),
      ),
    });
    const { userOwnsAsset } = await import('@/services/rewards/assetOwnership');
    await expect(userOwnsAsset('persona-ark', 'asset-1')).resolves.toEqual({
      owned: true,
      via: 'locker',
    });
    expect(mocks.getPersonaEntitlements).not.toHaveBeenCalled();
  });

  it('treats private sharing as an ownership grant, not a payment gate', async () => {
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === 'asset_records'
          ? query({ owner_persona_id: 'persona-ark' })
          : query(null),
      ),
    });
    const { previewAccess } = await import('@/services/access/evaluateAccess');
    const decision = await previewAccess({
      personaId: 'persona-ark',
      authProfileId: 'person-1',
      identifiability: 'semi_anonymous',
      cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: [] },
      cohortMemberships: [],
      source: 'session-cookie',
    }, {
      assetId: 'asset-1',
      contentClass: 'other',
      state: 'D_gated_canonical_pool',
      gating: { kind: 'ownership' },
      receiptEligible: true,
    }, 'read');
    expect(decision).toMatchObject({ allow: true, reason: 'owned' });
    expect(mocks.getPersonaEntitlements).not.toHaveBeenCalled();
  });

  it('recognizes active RoomQube membership as an asset access grant', async () => {
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'asset_records') return query({ owner_persona_id: 'persona-owner' });
        if (table === 'roomqube_members') {
          return query(null, [{ roomqube_id: 'room-1', expires_at: null }]);
        }
        if (table === 'roomqube_placements') return query({ id: 'placement-1' });
        return query(null);
      }),
    });
    const { userOwnsAsset } = await import('@/services/rewards/assetOwnership');
    await expect(userOwnsAsset('persona-member', 'asset-1')).resolves.toEqual({
      owned: true,
      via: 'room',
    });
    expect(mocks.getPersonaEntitlements).not.toHaveBeenCalled();
  });

  it('does not honor expired RoomQube membership', async () => {
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'asset_records') return query({ owner_persona_id: 'persona-owner' });
        if (table === 'roomqube_members') {
          return query(null, [{ roomqube_id: 'room-1', expires_at: '2000-01-01T00:00:00Z' }]);
        }
        return query(null);
      }),
    });
    const { userOwnsAsset } = await import('@/services/rewards/assetOwnership');
    await expect(userOwnsAsset('persona-member', 'asset-1')).resolves.toEqual({
      owned: false,
      via: null,
    });
  });

  it('hydrates a private Locker asset as a persona-gated ContentQube', async () => {
    const row = {
      id: 'asset-1',
      title: 'MetaProof Investor Deck',
      description: 'Current investor presentation',
      asset_class: 'deck',
      native_system: 'locker',
      owner_persona_id: 'persona-ark',
      lifecycle_status: 'current',
      sharing_status: 'private',
      version_number: 3,
      tags: ['investor'],
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-09T00:00:00Z',
    };
    mocks.createClient.mockReturnValue({ from: vi.fn(() => query(row)) });
    const { lockerAssetAdapter } = await import('@/services/registry/adapters/lockerAssetAdapter');
    const hydrated = await lockerAssetAdapter.hydrate({
      iqube_id: '10000000-0000-4000-8000-000000000001',
      source: 'locker_asset',
      source_id: 'asset-1',
      primitive_type: 'ContentQube',
      synthetic: false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }, { allowPrivate: true });
    expect(hydrated).toMatchObject({
      display_name: 'MetaProof Investor Deck',
      source_resource_id: 'asset-1',
      source_system: 'locker_asset',
      visibility_state: 'private',
      gating: ['persona'],
      access_policy_id: 'persona-ownership-or-room-membership',
    });
    await expect(lockerAssetAdapter.hydrate({
      iqube_id: '10000000-0000-4000-8000-000000000001',
      source: 'locker_asset',
      source_id: 'asset-1',
      primitive_type: 'ContentQube',
      synthetic: false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }, { allowPrivate: false })).resolves.toBeNull();
  });
});
