/**
 * Corpus Scout — `discoveryOrchestrator.ts` seed-priority canaries (operator
 * ruling 2026-07-28): curated acquisition seeds (`acquisitionSeedsFor`) MUST
 * be retrieved and submitted BEFORE homepage navigation (`runInstitutionDiscovery`)
 * runs — never bypassed by it. Previously `runDiscoveryForInstitution` went
 * straight to homepage navigation and never consulted the curated,
 * pillar-specific document plan at all.
 *
 * Every collaborator is mocked so the ORDER of acquisition (the property
 * under test) is observable independent of network access or the real
 * curated seed list's current contents.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/services/corpusScout/domainConstitution', () => ({
  getDomainConstitution: vi.fn(),
  ensureInstitutionSeedUrl: vi.fn(),
}));
vi.mock('@/services/corpusScout/institutionNavigator', () => ({
  runInstitutionDiscovery: vi.fn(),
}));
vi.mock('@/services/corpusScout/provenance', () => ({
  createCandidateSource: vi.fn(),
}));
vi.mock('@/services/corpusScout/registryVerification', () => ({
  canRunInstitutionDiscovery: vi.fn(),
}));
vi.mock('@/services/corpusScout/institutionalRegistry', () => ({
  acquisitionSeedsFor: vi.fn(),
}));

import { getDomainConstitution, ensureInstitutionSeedUrl } from '@/services/corpusScout/domainConstitution';
import { runInstitutionDiscovery } from '@/services/corpusScout/institutionNavigator';
import { createCandidateSource } from '@/services/corpusScout/provenance';
import { canRunInstitutionDiscovery } from '@/services/corpusScout/registryVerification';
import { acquisitionSeedsFor } from '@/services/corpusScout/institutionalRegistry';
import { runDiscoveryForInstitution } from '@/services/corpusScout/discoveryOrchestrator';

const mGetDomainConstitution = vi.mocked(getDomainConstitution);
const mEnsureSeedUrl = vi.mocked(ensureInstitutionSeedUrl);
const mRunInstitutionDiscovery = vi.mocked(runInstitutionDiscovery);
const mCreateCandidateSource = vi.mocked(createCandidateSource);
const mCanRun = vi.mocked(canRunInstitutionDiscovery);
const mAcquisitionSeedsFor = vi.mocked(acquisitionSeedsFor);

const INSTITUTION = {
  id: 'row-1', domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER',
  status: 'ratified' as const, ratifiedBy: 'steward', ratifiedAt: '2026-07-27T00:00:00Z',
  createdAt: '', updatedAt: '', seedUrl: 'https://www.nber.org', sourceTier: 'institutional-authority' as const,
  verificationStatus: 'verified' as const, verifiedAt: '2026-07-27T00:00:00Z', verificationCheckedAt: '2026-07-27T00:00:00Z',
  resolvedUrl: 'https://www.nber.org', verificationDetail: null,
};

function mockAdmin(): SupabaseClient {
  return {} as unknown as SupabaseClient;
}

beforeEach(() => {
  mGetDomainConstitution.mockReset();
  mEnsureSeedUrl.mockReset();
  mRunInstitutionDiscovery.mockReset();
  mCreateCandidateSource.mockReset();
  mCanRun.mockReset();
  mAcquisitionSeedsFor.mockReset();

  mGetDomainConstitution.mockResolvedValue({
    domain: 'commercialisation', definition: null, pillars: [], dependencies: [],
    institutions: [INSTITUTION], diversity: [], acquisitionSeeds: [],
  });
  mCanRun.mockReturnValue({ allowed: true });
  mEnsureSeedUrl.mockResolvedValue({ ok: true, seedUrl: 'https://www.nber.org' });
  mRunInstitutionDiscovery.mockResolvedValue({
    ok: true, pagesFetched: 1,
    candidates: [{ documentUrl: 'https://www.nber.org/papers/w99999', title: 'Navigation-found paper', discoveryUrl: 'https://www.nber.org', foundOnUrl: 'https://www.nber.org' }],
  });
  mCreateCandidateSource.mockResolvedValue({ ok: true, sourceId: 'SRC-x' });
});

describe('runDiscoveryForInstitution — curated seeds are retrieved BEFORE homepage navigation', () => {
  it('THE CANARY: when a curated seed exists, it is submitted FIRST, before any navigation-discovered candidate', async () => {
    mAcquisitionSeedsFor.mockReturnValue([
      { domain: 'commercialisation', pillarKey: 'partnerships', institution: 'NBER', url: 'https://www.nber.org/papers/w17181', claim: 'Business Partners paper' },
    ]);

    const result = await runDiscoveryForInstitution(mockAdmin(), { domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER' });

    expect(result.ok).toBe(true);
    expect(mCreateCandidateSource).toHaveBeenCalledTimes(2);
    const firstCall = mCreateCandidateSource.mock.calls[0][1];
    const secondCall = mCreateCandidateSource.mock.calls[1][1];
    expect(firstCall.url, 'the curated seed URL must be submitted FIRST').toBe('https://www.nber.org/papers/w17181');
    expect(firstCall.acquisitionMethod).toBe('operator-curated-seed');
    expect(secondCall.url, 'the navigation-discovered candidate must be submitted SECOND').toBe('https://www.nber.org/papers/w99999');
    expect(secondCall.acquisitionMethod).toBe('institutional-registry');
  });

  it('provenance is recorded per document: operator-curated-seed vs institutional-registry (institution-navigation)', async () => {
    mAcquisitionSeedsFor.mockReturnValue([
      { domain: 'commercialisation', pillarKey: 'partnerships', institution: 'NBER', url: 'https://www.nber.org/papers/w17181', claim: 'Business Partners paper' },
    ]);
    await runDiscoveryForInstitution(mockAdmin(), { domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER' });
    const methods = mCreateCandidateSource.mock.calls.map((c) => c[1].acquisitionMethod);
    expect(new Set(methods)).toEqual(new Set(['operator-curated-seed', 'institutional-registry']));
  });

  it('the result breaks down curatedSeedsSubmitted vs navigationSubmitted separately', async () => {
    mAcquisitionSeedsFor.mockReturnValue([
      { domain: 'commercialisation', pillarKey: 'partnerships', institution: 'NBER', url: 'https://www.nber.org/papers/w17181', claim: 'Business Partners paper' },
    ]);
    const result = await runDiscoveryForInstitution(mockAdmin(), { domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER' });
    expect(result.curatedSeedsSubmitted).toBe(1);
    expect(result.navigationSubmitted).toBe(1);
    expect(result.submitted).toBe(2);
    expect(result.found).toBe(2);
  });

  it('curated seeds are still attempted even when navigation itself fails (never gated on navigation succeeding)', async () => {
    mAcquisitionSeedsFor.mockReturnValue([
      { domain: 'commercialisation', pillarKey: 'partnerships', institution: 'NBER', url: 'https://www.nber.org/papers/w17181', claim: 'Business Partners paper' },
    ]);
    mRunInstitutionDiscovery.mockResolvedValue({ ok: false, error: 'navigation failed', failureClass: 'timeout', pagesFetched: 0, candidates: [] });

    const result = await runDiscoveryForInstitution(mockAdmin(), { domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER' });

    expect(mCreateCandidateSource).toHaveBeenCalledTimes(1);
    expect(mCreateCandidateSource.mock.calls[0][1].acquisitionMethod).toBe('operator-curated-seed');
    expect(result.curatedSeedsSubmitted).toBe(1);
    expect(result.ok, 'a curated-only result is still a real, successful result').toBe(true);
  });

  it('with NO curated seed for this (domain, pillar, institution), behaviour is unchanged: navigation runs alone', async () => {
    mAcquisitionSeedsFor.mockReturnValue([]);

    const result = await runDiscoveryForInstitution(mockAdmin(), { domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER' });

    expect(mCreateCandidateSource).toHaveBeenCalledTimes(1);
    expect(mCreateCandidateSource.mock.calls[0][1].acquisitionMethod).toBe('institutional-registry');
    expect(result.curatedSeedsSubmitted).toBe(0);
    expect(result.navigationSubmitted).toBe(1);
  });

  it('the refusal gate applies uniformly — an unratified/unverified institution acquires NEITHER curated seeds NOR navigation', async () => {
    mCanRun.mockReturnValue({ allowed: false, reason: 'institution must be VERIFIED before discovery can run' });
    mAcquisitionSeedsFor.mockReturnValue([
      { domain: 'commercialisation', pillarKey: 'partnerships', institution: 'NBER', url: 'https://www.nber.org/papers/w17181', claim: 'Business Partners paper' },
    ]);

    const result = await runDiscoveryForInstitution(mockAdmin(), { domain: 'commercialisation', pillarKey: 'partnerships', institutionName: 'NBER' });

    expect(result.ok).toBe(false);
    expect(mCreateCandidateSource).not.toHaveBeenCalled();
    expect(mAcquisitionSeedsFor).not.toHaveBeenCalled();
  });
});
