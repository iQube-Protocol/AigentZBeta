import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivePersonaContext } from '@/types/access';

const mocks = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
  resolveExperimentReviewGrant: vi.fn(),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: mocks.getSupabaseServer }));
vi.mock('@/services/passport/participationAccess', () => ({
  resolveExperimentReviewGrant: mocks.resolveExperimentReviewGrant,
}));

import { canReadExperimentIQube } from '@/services/research/experimentIQubeAccess';

function persona(isAdmin: boolean): ActivePersonaContext {
  return {
    personaId: isAdmin ? 'arkagent-test-persona' : 'aigentz-test-persona',
    authProfileId: 'test-profile',
    identifiability: 'semi_anonymous',
    cartridgeFlags: { isAdmin, isPartner: false, adminCartridges: [] },
    cohortMemberships: [],
    source: 'api-key',
  };
}

describe('experiment iQube canonical access delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseServer.mockReturnValue({});
  });

  it('allows the ArkAgent-style platform-admin path without manufacturing a grant', async () => {
    expect(await canReadExperimentIQube(persona(true), 'EXP-P1')).toBe(true);
    expect(mocks.resolveExperimentReviewGrant).not.toHaveBeenCalled();
  });

  it('allows the AigentZ-style delegated path only when the canonical scoped grant resolver does', async () => {
    mocks.resolveExperimentReviewGrant.mockResolvedValueOnce({ role: 'reviewer', allowedExperiments: ['EXP-P2'] });
    expect(await canReadExperimentIQube(persona(false), 'EXP-P2')).toBe(true);
    expect(mocks.resolveExperimentReviewGrant).toHaveBeenCalledWith({}, 'aigentz-test-persona', 'EXP-P2');
  });

  it('fails closed for a different experiment or unavailable access store', async () => {
    mocks.resolveExperimentReviewGrant.mockResolvedValueOnce(null);
    expect(await canReadExperimentIQube(persona(false), 'EXP-P1')).toBe(false);
    mocks.getSupabaseServer.mockReturnValueOnce(null);
    expect(await canReadExperimentIQube(persona(false), 'EXP-P2')).toBe(false);
  });
});

