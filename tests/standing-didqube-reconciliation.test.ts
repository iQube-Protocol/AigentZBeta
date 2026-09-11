/**
 * DiDQube Phase 4 item 5 (2026-09-07, execution plan) — Standing/reputation's
 * REQUIRED dry-run reconciliation. This is the highest-care item in Phase 4:
 * "must preserve existing attribution exactly... Build and run a dry-run
 * reconciliation report before writing anything." These tests prove the
 * report is genuinely read-only and classifies every discrepancy shape
 * honestly — never guessing, never silently upgrading an unresolved/
 * conflicted anchor into a resolved one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './_lib/fakeSupabase';

const mockResolveDiDQube = vi.fn();
vi.mock('@/services/identity/didQubeResolver', () => ({
  resolveDiDQube: (...args: unknown[]) => mockResolveDiDQube(...args),
}));

import { reconcileStandingDiDQubeResolution } from '@/services/standing/didQubeReconciliation';

beforeEach(() => {
  mockResolveDiDQube.mockReset();
});

describe('reconcileStandingDiDQubeResolution — dry-run only, never writes', () => {
  it('an empty canonical-standing roster reports zero rows, zero discrepancies', async () => {
    const { admin } = createFakeSupabase();
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.totalCanonicalStandingPersonas).toBe(0);
    expect(report.discrepancyCount).toBe(0);
    expect(mockResolveDiDQube).not.toHaveBeenCalled();
  });

  it('a persona whose anchor resolves cleanly is reported resolved with its didqubeId', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-1', display_name: 'Aigent Test', root_did: 'did:agent:root:aigent-test', app_origin: 'aigent-canonical-standing', auth_profile_id: null },
    ];
    tables.agent_root_identity = [{ id: 'root-1', did_uri: 'did:agent:root:aigent-test' }];
    mockResolveDiDQube.mockResolvedValue({ state: 'resolved', primitive: { didqubeId: 'didqube-1' } });
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.totalCanonicalStandingPersonas).toBe(1);
    expect(report.resolvedCount).toBe(1);
    expect(report.discrepancyCount).toBe(0);
    expect(report.rows[0]).toMatchObject({ personaId: 'persona-1', resolved: true, didqubeId: 'didqube-1', discrepancyReason: null });
    expect(mockResolveDiDQube).toHaveBeenCalledWith({ kind: 'agent_root_identity_id', agentRootIdentityId: 'root-1' });
  });

  it('a persona with no root_did at all is a discrepancy — never guessed at', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-2', display_name: 'No RootDID', root_did: null, app_origin: 'aigent-canonical-standing', auth_profile_id: null },
    ];
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.discrepancyCount).toBe(1);
    expect(report.rows[0].discrepancyReason).toBe('no_root_did');
    expect(mockResolveDiDQube).not.toHaveBeenCalled();
  });

  it('a root_did with no matching agent_root_identity row is a discrepancy, not a silent skip', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-3', display_name: 'Orphaned', root_did: 'did:agent:root:ghost', app_origin: 'aigent-canonical-standing', auth_profile_id: null },
    ];
    tables.agent_root_identity = [];
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.discrepancyCount).toBe(1);
    expect(report.rows[0].discrepancyReason).toBe('agent_root_identity_not_found');
  });

  it('an unresolved DiDQube state (no container bound yet) is reported honestly, never upgraded to resolved', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-4', display_name: 'Unbound', root_did: 'did:agent:root:unbound', app_origin: 'aigent-canonical-standing', auth_profile_id: null },
    ];
    tables.agent_root_identity = [{ id: 'root-4', did_uri: 'did:agent:root:unbound' }];
    mockResolveDiDQube.mockResolvedValue({ state: 'unresolved', reason: 'anchor_absent' });
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.discrepancyCount).toBe(1);
    expect(report.rows[0]).toMatchObject({ resolved: false, didqubeId: null, discrepancyReason: 'didqube_unresolved' });
  });

  it('a conflicted DiDQube resolution is reported as its own distinct discrepancy reason', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-5', display_name: 'Conflicted', root_did: 'did:agent:root:conflicted', app_origin: 'aigent-canonical-standing', auth_profile_id: null },
    ];
    tables.agent_root_identity = [{ id: 'root-5', did_uri: 'did:agent:root:conflicted' }];
    mockResolveDiDQube.mockResolvedValue({ state: 'conflicted', detail: 'subject_class mismatch' });
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.rows[0].discrepancyReason).toBe('didqube_conflicted');
    expect(report.rows[0].detail).toBe('subject_class mismatch');
  });

  it('scoped to app_origin=aigent-canonical-standing AND auth_profile_id IS NULL — never a per-sponsor wallet persona sharing the same root_did', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-canonical', display_name: 'Canonical', root_did: 'did:agent:root:shared', app_origin: 'aigent-canonical-standing', auth_profile_id: null },
      { id: 'persona-wallet', display_name: 'Per-sponsor wallet', root_did: 'did:agent:root:shared', app_origin: 'aigent-delegate', auth_profile_id: 'auth-1' },
    ];
    tables.agent_root_identity = [{ id: 'root-shared', did_uri: 'did:agent:root:shared' }];
    mockResolveDiDQube.mockResolvedValue({ state: 'resolved', primitive: { didqubeId: 'didqube-shared' } });
    const report = await reconcileStandingDiDQubeResolution(admin);
    expect(report.totalCanonicalStandingPersonas).toBe(1);
    expect(report.rows[0].personaId).toBe('persona-canonical');
  });

  it('never writes to any table — the fake store is unchanged after a full report run', async () => {
    const { admin, tables } = createFakeSupabase();
    tables.personas = [
      { id: 'persona-6', display_name: 'Read Only', root_did: 'did:agent:root:readonly', app_origin: 'aigent-canonical-standing', auth_profile_id: null },
    ];
    tables.agent_root_identity = [{ id: 'root-6', did_uri: 'did:agent:root:readonly' }];
    mockResolveDiDQube.mockResolvedValue({ state: 'resolved', primitive: { didqubeId: 'didqube-6' } });
    const before = JSON.stringify(tables);
    await reconcileStandingDiDQubeResolution(admin);
    expect(JSON.stringify(tables)).toBe(before);
  });
});
