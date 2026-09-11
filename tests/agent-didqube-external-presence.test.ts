/**
 * DiDQube Phase 4 item 7 (2026-09-07, execution plan) — Registry/Horizen
 * bindings as external-presence records inside the agent DiDQube, never an
 * alternate constitutional anchor. Proves the ordering: external presence
 * is only ever reported once the DiDQube itself resolves; an unresolved/
 * conflicted DiDQube short-circuits before either external read runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveDiDQube = vi.fn();
vi.mock('@/services/identity/didQubeResolver', () => ({
  resolveDiDQube: (...args: unknown[]) => mockResolveDiDQube(...args),
}));

const mockResolveAgentRegistrationState = vi.fn();
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({
  resolveAgentRegistrationState: (...args: unknown[]) => mockResolveAgentRegistrationState(...args),
}));

const mockGetAsset = vi.fn();
vi.mock('@/services/registry/persistence', () => ({
  getAsset: (...args: unknown[]) => mockGetAsset(...args),
}));

import { resolveAgentExternalPresence } from '@/services/horizen/agentDiDQubeExternalPresence';

const AGENT = { slug: 'test-agent', displayName: 'Test Agent', runtimeAgentId: 'aigent-test', aigentQubeId: 'aigentqube-test', agentCardPath: '/x', fioHandle: 'test@x', healthPath: '/h' } as never;

beforeEach(() => {
  mockResolveDiDQube.mockReset();
  mockResolveAgentRegistrationState.mockReset();
  mockGetAsset.mockReset();
});

describe('resolveAgentExternalPresence — external identifiers cannot redefine constitutional identity', () => {
  it('an unresolved DiDQube short-circuits — neither Horizen nor Registry is ever read', async () => {
    mockResolveDiDQube.mockResolvedValue({ state: 'unresolved', reason: 'anchor_absent' });
    const result = await resolveAgentExternalPresence({} as never, 'root-1', AGENT);
    expect(result.didqubeResolved).toBe(false);
    if (result.didqubeResolved) throw new Error('unreachable');
    expect(result.reason).toContain('anchor_absent');
    expect(mockResolveAgentRegistrationState).not.toHaveBeenCalled();
    expect(mockGetAsset).not.toHaveBeenCalled();
  });

  it('a conflicted DiDQube also short-circuits, naming the conflict', async () => {
    mockResolveDiDQube.mockResolvedValue({ state: 'conflicted', detail: 'subject_class mismatch' });
    const result = await resolveAgentExternalPresence({} as never, 'root-2', AGENT);
    expect(result.didqubeResolved).toBe(false);
    if (result.didqubeResolved) throw new Error('unreachable');
    expect(result.reason).toContain('subject_class mismatch');
    expect(mockResolveAgentRegistrationState).not.toHaveBeenCalled();
  });

  it('a resolved DiDQube WITH Horizen registration and a Registry asset reports both as external presence', async () => {
    mockResolveDiDQube.mockResolvedValue({
      state: 'resolved',
      primitive: { didqubeId: 'didqube-1', publicCommitment: { commitmentVersion: 'v1', value: 'commit-1' } },
    });
    mockResolveAgentRegistrationState.mockResolvedValue({
      registered: true, tokenId: 'token-1', registryAgentId: '0xabc', network: 'base-sepolia',
      evidenceRefs: ['token-1'], source: 'settled', settled: true, auditGaps: [],
    });
    mockGetAsset.mockResolvedValue({ id: 'aigentqube-test' });
    const result = await resolveAgentExternalPresence({} as never, 'root-1', AGENT);
    expect(result.didqubeResolved).toBe(true);
    if (!result.didqubeResolved) throw new Error('unreachable');
    expect(result.didqubeId).toBe('didqube-1');
    expect(result.horizenRegistration.registered).toBe(true);
    expect(result.registryAssetExists).toBe(true);
  });

  it('a resolved DiDQube with NO external presence yet reports both as absent, honestly — never fabricated', async () => {
    mockResolveDiDQube.mockResolvedValue({
      state: 'resolved',
      primitive: { didqubeId: 'didqube-2', publicCommitment: { commitmentVersion: 'v1', value: 'commit-2' } },
    });
    mockResolveAgentRegistrationState.mockResolvedValue({
      registered: false, tokenId: null, registryAgentId: null, network: null,
      evidenceRefs: [], source: 'unresolved', settled: false, auditGaps: [],
    });
    mockGetAsset.mockResolvedValue(null);
    const result = await resolveAgentExternalPresence({} as never, 'root-1', AGENT);
    expect(result.didqubeResolved).toBe(true);
    if (!result.didqubeResolved) throw new Error('unreachable');
    expect(result.horizenRegistration.registered).toBe(false);
    expect(result.registryAssetExists).toBe(false);
  });

  it('a thrown Horizen read never aborts the call — resolves to an honest unresolved registration state instead', async () => {
    mockResolveDiDQube.mockResolvedValue({
      state: 'resolved',
      primitive: { didqubeId: 'didqube-3', publicCommitment: { commitmentVersion: 'v1', value: 'commit-3' } },
    });
    mockResolveAgentRegistrationState.mockRejectedValue(new Error('network error'));
    mockGetAsset.mockResolvedValue(null);
    const result = await resolveAgentExternalPresence({} as never, 'root-1', AGENT);
    expect(result.didqubeResolved).toBe(true);
    if (!result.didqubeResolved) throw new Error('unreachable');
    expect(result.horizenRegistration.registered).toBe(false);
    expect(result.horizenRegistration.auditGaps[0]).toContain('network error');
  });
});
