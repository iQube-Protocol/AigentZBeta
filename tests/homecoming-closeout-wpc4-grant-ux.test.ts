/**
 * WP-C4 — grant creation/refresh/revoke UX + Founder Command Center preset
 * (Homecoming Closeout, operator brief 2026-08-17).
 *
 * Audit finding: revoke-then-reissue already works at the API layer —
 * persistDelegationGrant() unconditionally supersedes any prior active
 * grant for the persona before inserting the new one, so a fresh POST alone
 * (no DELETE first) instantly retires the old grant. This test proves that
 * behavior directly against the store, and proves the UI preset applies the
 * WP-C1 canonical action set without drifting from the server's copy.
 */

import { describe, it, expect, vi } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('persistDelegationGrant — revoke-then-reissue is immediate, no waiting for expiry', () => {
  it('a second grant for the same persona supersedes the first BEFORE inserting, in one call', async () => {
    const calls: Array<{ op: 'update-supersede' | 'insert'; payload: unknown }> = [];
    const fakeAdmin = {
      from: (table: string) => {
        expect(table).toBe('delegation_grants');
        return {
          update: (payload: Record<string, unknown>) => {
            calls.push({ op: 'update-supersede', payload });
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
          insert: async (payload: Record<string, unknown>) => {
            calls.push({ op: 'insert', payload });
            return { error: null };
          },
        };
      },
    };
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fakeAdmin }));
    vi.resetModules();
    const { persistDelegationGrant } = await import('@/services/delegation/delegationGrantStore');

    await persistDelegationGrant({
      grantId: 'grant-new',
      personaId: 'persona-1',
      agentRootDid: 'did:polity:agent-x',
      tenantId: 'default',
      trustBand: 'L1_EXPERIMENTAL',
      allowedActions: ['draft_email'],
      allowedSurfaces: ['metame'],
      forbiddenActions: [],
      disclosureClass: 'tenant',
      maxActions: 20,
      handoff: {} as any,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });

    // Supersede happens BEFORE insert, in the same call — no DELETE required.
    expect(calls[0].op).toBe('update-supersede');
    expect((calls[0].payload as Record<string, unknown>).status).toBe('revoked');
    expect(calls[1].op).toBe('insert');
    expect((calls[1].payload as Record<string, unknown>).status).toBe('active');
    vi.doUnmock('@/app/api/_lib/supabaseServer');
  });
});

describe('Founder Command Center preset — single source of truth with the server', () => {
  it('BoundedDelegationTab.tsx imports the SAME shared vocabulary the server route uses, never a duplicate', () => {
    const code = stripComments(readSource('app/triad/components/codex/tabs/BoundedDelegationTab.tsx'));
    expect(code).toMatch(/FOUNDER_COMMAND_CENTER_ACTIONS.*from ["']@\/services\/delegation\/delegatedActionVocabulary["']/);
    expect(code).toContain('FOUNDER_COMMAND_CENTER_PRESET');
  });

  it('the server grant-issuance route also imports the shared vocabulary', () => {
    const code = stripComments(readSource('app/api/codex/chat/agentiq-os/delegation/route.ts'));
    expect(code).toMatch(/FOUNDER_COMMAND_CENTER_ACTIONS.*from ["']@\/services\/delegation\/delegatedActionVocabulary["']/);
  });

  it('the preset retains the 8-hour maximum and a conservative (L1) trust band', () => {
    const code = stripComments(readSource('app/triad/components/codex/tabs/BoundedDelegationTab.tsx'));
    const idx = code.indexOf('FOUNDER_COMMAND_CENTER_PRESET = {');
    const block = code.slice(idx, idx + 400);
    expect(block).toContain('ttlHours: 8');
    expect(block).toContain('trustBand: "L1_EXPERIMENTAL"');
  });
});
