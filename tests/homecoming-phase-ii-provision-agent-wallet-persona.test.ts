/**
 * provisionAgentWalletPersona / provisionAigentMePersona — P1 Item 4
 * (operator brief 2026-08-16, "bring the Wallet onto the constitutional
 * projection").
 *
 * provisionAigentMePersona() must remain a thin wrapper over the generic,
 * role-parameterized provisionAgentWalletPersona() — never re-fork its own
 * insert logic — and the generic function must tag app_origin/type
 * correctly PER ROLE so a non-aigentMe delegate is never mistakenly
 * projected as app_origin='aigent-me'.
 *
 * Also guards the exact regression this work produced mid-implementation:
 * services/agents/provisionAgentPersona.ts is a DIFFERENT, pre-existing
 * function (the agent_persona DID-schema genesis core) that an earlier
 * draft of this change accidentally overwrote by choosing the same file
 * name. That file must still export its own, unrelated contract.
 */

import { describe, it, expect, vi } from 'vitest';
import { readSource } from './_lib/sourceAuthority';

function fakeAdmin(rows: Record<string, unknown>[]) {
  const inserted: Record<string, unknown>[] = [];
  const chain = {
    eq: () => chain,
    maybeSingle: async () => ({ data: rows[0] ?? null }),
  };
  return {
    _inserted: inserted,
    from: () => ({
      select: () => chain,
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: 'new-persona-id', display_name: row.display_name }, error: null }),
          }),
        };
      },
    }),
  };
}

const { provisionAgentWalletPersona } = await import('@/services/agents/provisionAgentWalletPersona');
const { provisionAigentMePersona } = await import('@/services/agents/provisionAigentMePersona');

const AGENT_ROOT = { did_uri: 'did:agent:root:test-agent', display_name: 'Test Agent', agent_card_slug: 'test-agent' };

describe('provisionAgentWalletPersona — role-tagged, generic wallet-persona provisioning', () => {
  it('tags a delegate persona with app_origin=aigent-delegate, never aigent-me', async () => {
    const admin = fakeAdmin([]);
    const result = await provisionAgentWalletPersona({
      admin: admin as any,
      callerAuthProfileId: 'auth-1',
      agentRoot: AGENT_ROOT,
      role: 'delegate',
    });
    expect(result).not.toBeNull();
    expect(admin._inserted[0].app_origin).toBe('aigent-delegate');
    expect(admin._inserted[0].app_origin).not.toBe('aigent-me');
    expect(admin._inserted[0].type).toBe('AgentDelegate');
  });

  it('provisionAigentMePersona is a thin wrapper — tags app_origin=aigent-me, matching its documented contract', async () => {
    const admin = fakeAdmin([]);
    const result = await provisionAigentMePersona({
      admin: admin as any,
      callerAuthProfileId: 'auth-1',
      agentRoot: AGENT_ROOT,
    });
    expect(result).not.toBeNull();
    expect(admin._inserted[0].app_origin).toBe('aigent-me');
    expect(admin._inserted[0].type).toBe('AigentMe');
  });
});

describe('services/agents/provisionAgentPersona.ts remains the distinct, pre-existing genesis core', () => {
  it('exports its own unrelated contract (ProvisionAgentPersonaInput / agent_persona), not the wallet-persona shape', () => {
    const code = readSource('services/agents/provisionAgentPersona.ts');
    expect(code).toContain('ProvisionAgentPersonaInput');
    expect(code).toContain("from('agent_persona')");
    // This file must NOT have been overwritten with the wallet-persona logic.
    expect(code).not.toContain('provisionAgentWalletPersona');
    expect(code).not.toContain("app_origin: 'aigent-me'");
  });
});
