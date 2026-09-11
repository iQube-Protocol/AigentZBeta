/**
 * services/horizen/agentPreflight.ts — the read-only Agent-N preflight
 * (Horizen Pilot Closure item 7, 2026-08-09). Every real dependency mocked;
 * exercises runAgentPreflight() directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

const mockGetAssetRuntimeDescriptor = vi.fn();
vi.mock('@/services/registry/runtimeDescriptor', () => ({
  getAssetRuntimeDescriptor: (...args: any[]) => mockGetAssetRuntimeDescriptor(...args),
}));

const mockFindAgentReceiptRefs = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findAgentReceiptRefs: (...args: any[]) => mockFindAgentReceiptRefs(...args),
}));

const mockReadSettledFact = vi.fn();
vi.mock('@/services/journey/settledFacts', () => ({
  readSettledFact: (...args: any[]) => mockReadSettledFact(...args),
  isSettled: (fact: any) => fact?.status === 'settled',
}));

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: any[]) => mockGetActivePersona(...args),
}));

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockResolveAgentRegistrationState = vi.fn();
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({
  resolveAgentRegistrationState: (...args: any[]) => mockResolveAgentRegistrationState(...args),
}));

// Never let a real network call happen — every probe must fail closed to DEGRADED in tests.
const originalFetch = globalThis.fetch;
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in tests')));
  mockGetSupabaseServer.mockReset();
  mockGetAssetRuntimeDescriptor.mockReset();
  mockFindAgentReceiptRefs.mockReset().mockResolvedValue([]);
  mockReadSettledFact.mockReset().mockResolvedValue(null);
  mockGetActivePersona.mockReset().mockResolvedValue(null);
  mockResolveAgentAdmissionState.mockReset().mockResolvedValue(null);
  mockResolveAgentRegistrationState.mockReset().mockResolvedValue(null);
});

import { runAgentPreflight } from '@/services/horizen/agentPreflight';

function fakeSupabase(overrides: { registryAssetExists?: boolean } = {}) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === 'registry_assets') {
              return { data: overrides.registryAssetExists ? { asset_id: 'x' } : null, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
    }),
  };
}

describe('runAgentPreflight', () => {
  it('reports a single BLOCKED identity line and nothing else for an unknown agent slug', async () => {
    const report = await runAgentPreflight('not-a-real-agent', null, 'https://dev-beta.aigentz.me');
    expect(report.goNoGo).toBe('BLOCKED');
    expect(report.identity[0].outcome).toBe('BLOCKED');
    expect(report.authority).toEqual([]);
  });

  it('is agent-generic — works identically for nakamoto and moneypenny, naming the right agent throughout', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase({ registryAssetExists: true }));
    const nakamoto = await runAgentPreflight('nakamoto', null, 'https://dev-beta.aigentz.me');
    const moneypenny = await runAgentPreflight('moneypenny', null, 'https://dev-beta.aigentz.me');
    expect(nakamoto.agentDisplayName).toBe('Aigent Nakamoto');
    expect(moneypenny.agentDisplayName).toBe('Aigent MoneyPenny');
    expect(nakamoto.identity[0].reason).toContain('aigent-nakamoto');
    expect(moneypenny.identity[0].reason).toContain('aigent-moneypenny');
  });

  it('reports BLOCKED, not a thrown error, when no registry_assets row exists', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase({ registryAssetExists: false }));
    const report = await runAgentPreflight('nakamoto', null, 'https://dev-beta.aigentz.me');
    const registryLine = report.identity.find((l) => l.id === 'registry-configuration');
    expect(registryLine?.outcome).toBe('BLOCKED');
    expect(report.goNoGo).toBe('BLOCKED');
  });

  it('reports the operator-persona line BLOCKED when no request is supplied, never throwing', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase({ registryAssetExists: true }));
    const report = await runAgentPreflight('nakamoto', null, 'https://dev-beta.aigentz.me');
    const personaLine = report.authority.find((l) => l.id === 'operator-persona');
    expect(personaLine?.outcome).toBe('BLOCKED');
  });

  it('isolates a thrown dependency to DEGRADED on that one line — the rest of the report still completes', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase({ registryAssetExists: true }));
    mockGetAssetRuntimeDescriptor.mockRejectedValue(new Error('boom'));
    const report = await runAgentPreflight('nakamoto', null, 'https://dev-beta.aigentz.me');
    const runtimeLine = report.identity.find((l) => l.id === 'runtime-endpoint');
    expect(runtimeLine?.outcome).toBe('DEGRADED');
    expect(runtimeLine?.reason).toContain('boom');
    // Every other identity line still resolved — one exception did not abort the batch.
    expect(report.identity.filter((l) => l.id !== 'runtime-endpoint').every((l) => l.outcome !== undefined)).toBe(true);
    expect(report.identity).toHaveLength(4);
  });

  it('reports ALREADY_COMPLETE for the runtime endpoint once metadata.runtime.endpoint is seeded', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeSupabase({ registryAssetExists: true }));
    mockGetAssetRuntimeDescriptor.mockResolvedValue({ endpoint: 'https://dev-beta.aigentz.me/api/agents/nakamoto/invoke' });
    const report = await runAgentPreflight('nakamoto', null, 'https://dev-beta.aigentz.me');
    const runtimeLine = report.identity.find((l) => l.id === 'runtime-endpoint');
    expect(runtimeLine?.outcome).toBe('ALREADY_COMPLETE');
  });

  it('never sets goNoGo to BLOCKED from a DEGRADED or NOT_REQUIRED line alone', async () => {
    mockGetSupabaseServer.mockReturnValue(null); // forces several lines to DEGRADED, none to BLOCKED except receipt-persistence
    const report = await runAgentPreflight('nakamoto', null, 'https://dev-beta.aigentz.me');
    const infraLine = report.infrastructure.find((l) => l.id === 'receipt-persistence');
    expect(infraLine?.outcome).toBe('BLOCKED'); // this one IS a real block — no Supabase means no receipts
    expect(report.goNoGo).toBe('BLOCKED');
  });
});
