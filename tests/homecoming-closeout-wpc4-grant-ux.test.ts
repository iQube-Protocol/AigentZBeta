/**
 * WP-C4 — grant creation/refresh/revoke UX + Founder Command Center preset
 * (Homecoming Closeout, operator brief 2026-08-17).
 *
 * Audit finding: revoke-then-reissue already works at the API layer —
 * persistDelegationGrant() supersedes any prior active grant for the SAME
 * (persona, agent) pair before inserting the new one, so a fresh POST alone
 * (no DELETE first) instantly retires that agent's old grant — never any
 * OTHER agent's independent grant under the same persona (CFS-024
 * multi-agent bounded delegation model, 2026-08-23 repair pass: a persona
 * may hold many simultaneously active grants, one per agent). This test
 * proves that scoping directly against the store, and proves the UI preset
 * applies the WP-C1 canonical action set without drifting from the server's
 * copy.
 */

import { describe, it, expect, vi } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('persistDelegationGrant — revoke-then-reissue is immediate, agent-scoped, no waiting for expiry', () => {
  it('a second grant for the same (persona, agent) supersedes only that agent\'s prior grant BEFORE inserting, in one call', async () => {
    const calls: Array<{ op: 'update-supersede' | 'insert'; payload: unknown; eqCalls: Array<[string, unknown]> }> = [];
    const fakeAdmin = {
      from: (table: string) => {
        expect(table).toBe('delegation_grants');
        return {
          update: (payload: Record<string, unknown>) => {
            const record: (typeof calls)[number] = { op: 'update-supersede', payload, eqCalls: [] };
            calls.push(record);
            const chain = {
              eq: (col: string, val: unknown) => {
                record.eqCalls.push([col, val]);
                return chain;
              },
              then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
            };
            return chain;
          },
          insert: async (payload: Record<string, unknown>) => {
            calls.push({ op: 'insert', payload, eqCalls: [] });
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
    // Scoped to THIS persona AND THIS agent — never persona-only (that is the
    // exact single-slot defect this model corrects: superseding EVERY agent's
    // grant under the persona merely because one of them got a new grant).
    expect(calls[0].eqCalls).toContainEqual(['persona_id', 'persona-1']);
    expect(calls[0].eqCalls).toContainEqual(['agent_root_did', 'did:polity:agent-x']);
    expect(calls[0].eqCalls).toContainEqual(['status', 'active']);
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
