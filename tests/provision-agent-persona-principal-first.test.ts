/**
 * services/agents/provisionAgentPersona.ts — DiDQube Phase 2.5 behavioral
 * tests (2026-09-07). Proves the delegation anchor is resolved
 * principal-first from the sponsor's authenticated auth_user_id
 * (resolveRootPrincipalForAuthUser), NEVER from personas.root_did — the
 * defect Phase 0's inventory found had left 2 of 3 live agent_persona rows
 * unanchored.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveRootPrincipalForAuthUser = vi.fn();
vi.mock('@/services/identity/passportPrincipal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/identity/passportPrincipal')>();
  return {
    ...actual,
    resolveRootPrincipalForAuthUser: (...args: any[]) => mockResolveRootPrincipalForAuthUser(...args),
  };
});

beforeEach(() => {
  mockResolveRootPrincipalForAuthUser.mockReset();
});

import { provisionAgentPersona } from '@/services/agents/provisionAgentPersona';

const AGENT_ROOT_ID = 'agent-root-1111-1111-111111111111';
const SPONSOR_PERSONA_ID = 'sponsor-persona-2222-2222-222222222222';
const AGENT_ROW = {
  id: AGENT_ROOT_ID,
  agent_id: 'aigent-test',
  did_uri: 'did:agent:root:aigent-test',
  agent_class: 'polity_bound',
  agent_card_slug: 'aigent-test',
  sponsor_persona_id: SPONSOR_PERSONA_ID,
  sponsor_passport_id: 'ppp-fixture',
  display_name: 'Test Agent',
};

/**
 * Minimal chainable fake, keyed by table so each test can script per-table
 * responses. `personas` throws by construction — this module must NEVER
 * query it (that IS the fix; the OLD implementation read
 * personas.root_did directly).
 */
function fakeAdmin(responders: Record<string, (calls: { method: string; args: any[] }[]) => any>) {
  return {
    from: (table: string) => {
      if (table === 'personas') {
        throw new Error('provisionAgentPersona must never query personas — that is the defect this fix removes');
      }
      const calls: { method: string; args: any[] }[] = [];
      const builder: any = {
        select: (...args: any[]) => {
          calls.push({ method: 'select', args });
          return builder;
        },
        eq: (...args: any[]) => {
          calls.push({ method: 'eq', args });
          return builder;
        },
        limit: (...args: any[]) => {
          calls.push({ method: 'limit', args });
          return resolveResult();
        },
        maybeSingle: (...args: any[]) => {
          calls.push({ method: 'maybeSingle', args });
          return resolveResult();
        },
        insert: (payload: any) => {
          calls.push({ method: 'insert', args: [payload] });
          return builder;
        },
        select_after_insert: undefined,
      };
      // .insert(...).select(...).single() chain
      const originalSelect = builder.select;
      builder.select = (...args: any[]) => {
        calls.push({ method: 'select', args });
        return {
          ...builder,
          single: () => resolveResult(),
        };
      };
      function resolveResult() {
        const responder = responders[table];
        if (!responder) return { data: null, error: null };
        return responder(calls);
      }
      return builder;
    },
  };
}

describe('provisionAgentPersona — principal-first delegation anchoring (DiDQube Phase 2.5)', () => {
  it('never queries personas — a conflicting/misleading personas.root_did cannot override resolution', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: true, rootIdentityId: 'root-real-1', kybeId: 'kybe-1' });
    const admin = fakeAdmin({
      agent_root_identity: () => ({ data: AGENT_ROW, error: null }),
      agent_persona: (calls) => {
        if (calls.some((c) => c.method === 'insert')) {
          return {
            data: {
              id: 'agent-persona-1',
              did_uri: 'did:agent:persona:aigent-test:production',
              agent_root_id: AGENT_ROOT_ID,
              persona_role: 'polity_bound_delegate',
              max_identifiability: 'anonymous',
              created_at: '2026-09-07T00:00:00Z',
            },
            error: null,
          };
        }
        return { data: [], error: null }; // idempotency check: none exists yet
      },
      did_persona: () => ({ data: [], error: null }),
    }) as any;

    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorAuthUserId: 'auth-user-real-1',
      agentRootId: AGENT_ROOT_ID,
    });

    // The fake would have thrown if `.from('personas')` were ever called —
    // reaching here at all proves it wasn't. Assert the real outcome too.
    expect(result.ok).toBe(true);
    expect(result.delegationAnchored?.sponsorRootResolved).toBe(true);
    expect(mockResolveRootPrincipalForAuthUser).toHaveBeenCalledWith('auth-user-real-1');
  });

  it('a populated legacy root_did cannot rescue a missing canonical lineage — fails closed (409), never silently unanchored', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: false, reason: 'lineage_incomplete' });
    const admin = fakeAdmin({
      agent_root_identity: () => ({ data: AGENT_ROW, error: null }),
      agent_persona: () => ({ data: [], error: null }),
    }) as any;

    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorAuthUserId: 'auth-user-unresolvable',
      agentRootId: AGENT_ROOT_ID,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/lineage_incomplete/);
  });

  it('valid human sponsor path resolves and anchors delegation_user_root_id to the resolved root', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: true, rootIdentityId: 'root-anchor-9', kybeId: 'kybe-9' });
    let insertedPayload: any = null;
    const admin = fakeAdmin({
      agent_root_identity: () => ({ data: AGENT_ROW, error: null }),
      agent_persona: (calls) => {
        const insertCall = calls.find((c) => c.method === 'insert');
        if (insertCall) {
          insertedPayload = insertCall.args[0];
          return {
            data: { id: 'ap-1', did_uri: 'did:x', agent_root_id: AGENT_ROOT_ID, persona_role: 'polity_bound_delegate', max_identifiability: 'anonymous', created_at: 'now' },
            error: null,
          };
        }
        return { data: [], error: null };
      },
      did_persona: () => ({ data: [{ id: 'bureau-persona-1' }], error: null }),
    }) as any;

    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorAuthUserId: 'auth-user-9',
      agentRootId: AGENT_ROOT_ID,
    });

    expect(result.ok).toBe(true);
    expect(insertedPayload.delegation_user_root_id).toBe('root-anchor-9');
    expect(insertedPayload.delegation_persona_id).toBe('bureau-persona-1');
    expect(result.delegationAnchored).toEqual({ sponsorRootResolved: true, sponsorDidPersonaResolved: true });
  });

  it('platform-authority path never resolves a human principal — anchor is honestly NULL, not guessed', async () => {
    const admin = fakeAdmin({
      agent_root_identity: () => ({ data: AGENT_ROW, error: null }),
      agent_persona: (calls) => {
        if (calls.some((c) => c.method === 'insert')) {
          return {
            data: { id: 'ap-2', did_uri: 'did:x', agent_root_id: AGENT_ROOT_ID, persona_role: 'polity_bound_delegate', max_identifiability: 'anonymous', created_at: 'now' },
            error: null,
          };
        }
        return { data: [], error: null };
      },
    }) as any;

    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      agentRootId: AGENT_ROOT_ID,
      isPlatformAuthority: true,
    });

    expect(result.ok).toBe(true);
    expect(result.delegationAnchored).toEqual({ sponsorRootResolved: false, sponsorDidPersonaResolved: false });
    expect(mockResolveRootPrincipalForAuthUser).not.toHaveBeenCalled();
  });

  it('rejects a human-sponsored call with no sponsorAuthUserId — 400, before any DB read', async () => {
    const admin = fakeAdmin({}) as any;
    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      agentRootId: AGENT_ROOT_ID,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(mockResolveRootPrincipalForAuthUser).not.toHaveBeenCalled();
  });

  it('an unresolved caller (auth_user_id maps to no root) never falls back to unanchored provisioning', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: false, reason: 'unavailable' });
    const admin = fakeAdmin({
      agent_root_identity: () => ({ data: AGENT_ROW, error: null }),
      agent_persona: () => ({ data: [], error: null }),
    }) as any;

    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorAuthUserId: 'auth-user-unavailable',
      agentRootId: AGENT_ROOT_ID,
    });

    // The OLD behavior (allowUnanchored) is gone — this must fail, not
    // silently provision with delegation_user_root_id: null.
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });

  it('idempotency: an already-provisioned persona short-circuits before any principal resolution', async () => {
    const admin = fakeAdmin({
      agent_root_identity: () => ({ data: AGENT_ROW, error: null }),
      agent_persona: () => ({
        data: [
          {
            id: 'existing-ap',
            did_uri: 'did:existing',
            agent_root_id: AGENT_ROOT_ID,
            persona_role: 'polity_bound_delegate',
            max_identifiability: 'anonymous',
            created_at: 'earlier',
          },
        ],
        error: null,
      }),
    }) as any;

    const result = await provisionAgentPersona({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorAuthUserId: 'auth-user-irrelevant',
      agentRootId: AGENT_ROOT_ID,
    });

    expect(result.ok).toBe(true);
    expect(result.alreadyExists).toBe(true);
    expect(mockResolveRootPrincipalForAuthUser).not.toHaveBeenCalled();
  });
});
