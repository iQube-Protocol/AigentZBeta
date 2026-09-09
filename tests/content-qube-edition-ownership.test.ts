import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getPersonaEntitlements: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/services/rewards/entitlementService', () => ({
  getEntitlementService: () => ({ getPersonaEntitlements: mocks.getPersonaEntitlements }),
}));

function query(result: unknown) {
  const chain: Record<string, any> = {};
  for (const method of ['select', 'eq', 'is', 'limit', 'in']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => ({ data: result, error: null }));
  return chain;
}

describe('ContentQube edition ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getPersonaEntitlements.mockResolvedValue([]);
  });

  it('recognizes an active persona edition before legacy entitlement expansion', async () => {
    const editionQuery = query({ id: 'edition-1' });
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe('content_qube_editions');
        return editionQuery;
      }),
    });
    const { userOwnsAsset } = await import('@/services/rewards/assetOwnership');
    const result = await userOwnsAsset(
      'persona-a',
      '00000000-0000-4000-8000-000000ac1005',
    );
    expect(result).toEqual({ owned: true, via: 'edition' });
    expect(mocks.getPersonaEntitlements).not.toHaveBeenCalled();
  });

  it('does not treat another persona\'s edition as owned', async () => {
    const editionQuery = query(null);
    const noRows = query(null);
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === 'content_qube_editions' ? editionQuery : noRows,
      ),
    });
    const { userOwnsAsset } = await import('@/services/rewards/assetOwnership');
    const result = await userOwnsAsset(
      'persona-b',
      '00000000-0000-4000-8000-000000ac1005',
    );
    expect(result.owned).toBe(false);
  });
});
