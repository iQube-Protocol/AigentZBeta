/**
 * services/corpusScout/domainConstitution.ts::summarizeAcquisitionSourceUniverse
 * (2026-08-31, "targeted-acquisition domain/source-universe handoff" repair).
 *
 * Read-only, minimal (ONE query, no seed_url backfill write), and reuses
 * canRunInstitutionDiscovery verbatim — never a second, independently-
 * derived eligibility rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeAcquisitionSourceUniverse } from '@/services/corpusScout/domainConstitution';

function createMockAdmin(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => { calls.push({ method: 'select', args }); return builder; },
    eq: (...args: unknown[]) => { calls.push({ method: 'eq', args }); return builder; },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  const admin = {
    from: (table: string) => { calls.push({ method: 'from', args: [table] }); return builder; },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

describe('summarizeAcquisitionSourceUniverse', () => {
  it('fails closed to null on a query error — an unreadable registry must never read as "zero institutions ratified"', async () => {
    const { admin } = createMockAdmin({ data: null, error: { message: 'boom' } });
    const result = await summarizeAcquisitionSourceUniverse(admin, 'financial-services');
    expect(result).toBeNull();
  });

  it('counts zero ratified institutions honestly (a genuinely unratified domain)', async () => {
    const { admin } = createMockAdmin({ data: [], error: null });
    const result = await summarizeAcquisitionSourceUniverse(admin, 'never-ratified-domain');
    expect(result).toEqual({ ratifiedInstitutionCount: 0, eligibleInstitutionCount: 0 });
  });

  it('THE LIVE SHAPE — ratified institutions exist but none are verified (financial-services, per the 2026-08-28 migration\'s own documented starting state)', async () => {
    const { admin } = createMockAdmin({
      data: [
        { status: 'ratified', verification_status: 'proposed' },
        { status: 'ratified', verification_status: 'proposed' },
        { status: 'ratified', verification_status: null },
      ],
      error: null,
    });
    const result = await summarizeAcquisitionSourceUniverse(admin, 'financial-services');
    expect(result).toEqual({ ratifiedInstitutionCount: 3, eligibleInstitutionCount: 0 });
  });

  it('counts only ratified+verified rows as eligible — a verified-but-unratified row does not count, a ratified-but-unverified row does not count', async () => {
    const { admin } = createMockAdmin({
      data: [
        { status: 'ratified', verification_status: 'verified' }, // eligible
        { status: 'proposed', verification_status: 'verified' }, // not ratified — excluded from BOTH counts
        { status: 'ratified', verification_status: 'insufficient_corpus' }, // ratified, not eligible
      ],
      error: null,
    });
    const result = await summarizeAcquisitionSourceUniverse(admin, 'financial-services');
    expect(result).toEqual({ ratifiedInstitutionCount: 2, eligibleInstitutionCount: 1 });
  });

  it('never performs a seed_url backfill write — a single read-only select, unlike getDomainConstitution', async () => {
    const { admin, calls } = createMockAdmin({ data: [], error: null });
    await summarizeAcquisitionSourceUniverse(admin, 'financial-services');
    expect(calls.filter((c) => c.method === 'from')).toHaveLength(1);
    expect(calls.some((c) => c.method === 'select' || c.method === 'eq' || c.method === 'from')).toBe(true);
    // No .update()/.upsert() call of any kind.
    expect(calls.some((c) => c.method === 'update' || c.method === 'upsert')).toBe(false);
  });

  it('scopes strictly to the requested domain — never reads across domains', async () => {
    const { admin, calls } = createMockAdmin({ data: [], error: null });
    await summarizeAcquisitionSourceUniverse(admin, 'financial-services');
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['domain', 'financial-services']);
  });
});
