/**
 * resolveAgentStandingPersonaId — 2026-08-23 repair canaries.
 *
 * Proves the corrected chain (agent_root_identity.did_uri -> personas.root_did
 * -> personas.id -> crm_personas.identity_persona_id -> crm_personas.id) is
 * used end to end, that the canonical agent persona is idempotently
 * provisioned when absent, and that the function NEVER queries
 * crm_personas.identity_persona_id with a raw runtimeAgentId/agentRootDid
 * string directly (the exact live defect this repair fixes — a text value
 * against a UUID column).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAgentStandingPersonaId, CANONICAL_AGENT_STANDING_APP_ORIGIN } from '@/services/standing/agentStandingPersona';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

// Keeps this an offline unit test (2026-09-05, real-address resolution fix)
// — without this mock, resolveCanonicalAgentPersonaId's dynamic
// `getAgentAddresses` call would hit the REAL Supabase project over the
// network via the anon key already present in this environment's
// .env.local (the get_agent_addresses RPC is granted to `anon`).
const mockGetAgentAddresses = vi.fn().mockResolvedValue(null);
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: vi.fn().mockImplementation(() => ({
    getAgentAddresses: (...args: unknown[]) => mockGetAgentAddresses(...args),
  })),
}));

const NAKAMOTO_AGENT: RegistrableAgentConfig = {
  slug: 'nakamoto',
  displayName: 'Aigent Nakamoto',
  runtimeAgentId: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  agentCardPath: '/api/agents/nakamoto/agent-card.json',
  fioHandle: 'nakamoto@aigent',
  runtimeHealthPath: '/api/agents/nakamoto/health',
};

const AGENT_ROOT_DID = 'did:agent:root:aigent-nakamoto';

/** Records every query so assertions can inspect exactly what was filtered on. */
class FakeTable {
  rows: Array<Record<string, unknown>>;
  calls: Array<{ op: string; filters: Record<string, unknown> }> = [];
  failNextInsert: string | null = null;

  constructor(rows: Array<Record<string, unknown>> = []) {
    this.rows = rows;
  }

  select(_cols: string) {
    const filters: Record<string, unknown> = {};
    const self = this;
    const builder = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return builder;
      },
      is(col: string, val: unknown) {
        filters[col] = val;
        return builder;
      },
      async maybeSingle() {
        self.calls.push({ op: 'select', filters });
        const match = self.rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        return { data: match ?? null, error: null };
      },
    };
    return builder;
  }

  insert(values: Record<string, unknown>) {
    this.calls.push({ op: 'insert', filters: values });
    const self = this;
    return {
      select(_cols: string) {
        return {
          async single() {
            if (self.failNextInsert) {
              const msg = self.failNextInsert;
              self.failNextInsert = null;
              return { data: null, error: { message: msg } };
            }
            const row = { id: `generated-${self.rows.length + 1}`, ...values };
            self.rows.push(row);
            return { data: row, error: null };
          },
        };
      },
    };
  }
}

function makeFakeAdmin(personas: FakeTable, crmPersonas: FakeTable) {
  return {
    from(table: string) {
      if (table === 'personas') return personas;
      if (table === 'crm_personas') return crmPersonas;
      throw new Error(`unexpected table: ${table}`);
    },
  } as any;
}

describe('resolveAgentStandingPersonaId — three-valued propagation', () => {
  it('returns undefined without any DB call when agentRootDid is undefined (caller admission read failed)', async () => {
    const personas = new FakeTable();
    const crm = new FakeTable();
    const admin = makeFakeAdmin(personas, crm);
    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, undefined);
    expect(result).toBeUndefined();
    expect(personas.calls).toHaveLength(0);
    expect(crm.calls).toHaveLength(0);
  });

  it('returns null without any DB call when agentRootDid is null (genuinely no root identity yet)', async () => {
    const personas = new FakeTable();
    const crm = new FakeTable();
    const admin = makeFakeAdmin(personas, crm);
    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, null);
    expect(result).toBeNull();
    expect(personas.calls).toHaveLength(0);
    expect(crm.calls).toHaveLength(0);
  });
});

describe('resolveAgentStandingPersonaId — the corrected chain', () => {
  it('never queries crm_personas.identity_persona_id with the raw agentRootDid/runtimeAgentId string — only with a resolved personas.id', async () => {
    const personas = new FakeTable([
      { id: 'canonical-persona-1', root_did: AGENT_ROOT_DID, app_origin: CANONICAL_AGENT_STANDING_APP_ORIGIN, auth_profile_id: null },
    ]);
    const crm = new FakeTable([{ id: 'crm-nakamoto-1', identity_persona_id: 'canonical-persona-1' }]);
    const admin = makeFakeAdmin(personas, crm);

    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);

    expect(result).toBe('crm-nakamoto-1');
    const crmSelect = crm.calls.find((c) => c.op === 'select');
    expect(crmSelect?.filters.identity_persona_id).toBe('canonical-persona-1');
    // The exact live defect this repair fixes: never the raw text runtime/DID value.
    expect(crmSelect?.filters.identity_persona_id).not.toBe(AGENT_ROOT_DID);
    expect(crmSelect?.filters.identity_persona_id).not.toBe(NAKAMOTO_AGENT.runtimeAgentId);
  });

  it('resolves the EXISTING canonical persona (root_did + app_origin + auth_profile_id IS NULL) without ever inserting a new one', async () => {
    const personas = new FakeTable([
      { id: 'canonical-persona-1', root_did: AGENT_ROOT_DID, app_origin: CANONICAL_AGENT_STANDING_APP_ORIGIN, auth_profile_id: null },
      // A DIFFERENT, per-sponsor wallet persona sharing the same root_did — must never be adopted.
      { id: 'sponsor-wallet-persona-9', root_did: AGENT_ROOT_DID, app_origin: 'aigent-delegate', auth_profile_id: 'some-auth-profile' },
    ]);
    const crm = new FakeTable([{ id: 'crm-nakamoto-1', identity_persona_id: 'canonical-persona-1' }]);
    const admin = makeFakeAdmin(personas, crm);

    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);

    expect(result).toBe('crm-nakamoto-1');
    expect(personas.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('idempotently PROVISIONS the canonical persona when absent, then resolves its auto-mirrored crm_personas row', async () => {
    const personas = new FakeTable([]);
    // The crm_personas auto-mirror trigger creates this row the instant the
    // personas INSERT completes — simulated by pre-seeding it keyed to the
    // id the FakeTable's insert() will generate.
    const crm = new FakeTable([{ id: 'crm-nakamoto-new', identity_persona_id: 'generated-1' }]);
    const admin = makeFakeAdmin(personas, crm);

    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);

    expect(result).toBe('crm-nakamoto-new');
    const insertCall = personas.calls.find((c) => c.op === 'insert');
    expect(insertCall).toBeTruthy();
    expect(insertCall?.filters.root_did).toBe(AGENT_ROOT_DID);
    expect(insertCall?.filters.app_origin).toBe(CANONICAL_AGENT_STANDING_APP_ORIGIN);
    expect(insertCall?.filters.auth_profile_id).toBeNull();
  });

  it('projects the REAL custodied agent_keys address into the new canonical persona (2026-09-05 fix — never a fabricated one when a real wallet exists)', async () => {
    mockGetAgentAddresses.mockResolvedValueOnce({ agentId: 'aigent-nakamoto', evmAddress: '0xREALCUSTODIEDADDRESS0000000000000000002' });
    const personas = new FakeTable([]);
    const crm = new FakeTable([{ id: 'crm-nakamoto-new', identity_persona_id: 'generated-1' }]);
    const admin = makeFakeAdmin(personas, crm);

    await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);

    expect(mockGetAgentAddresses).toHaveBeenCalledWith('aigent-nakamoto');
    const insertCall = personas.calls.find((c) => c.op === 'insert');
    expect((insertCall?.filters.evm_key as { address: string }).address).toBe('0xREALCUSTODIEDADDRESS0000000000000000002');
  });

  it('falls back to a placeholder ONLY when no agent_keys row exists — logged, never silent', async () => {
    mockGetAgentAddresses.mockResolvedValueOnce(null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const personas = new FakeTable([]);
    const crm = new FakeTable([{ id: 'crm-nakamoto-new', identity_persona_id: 'generated-1' }]);
    const admin = makeFakeAdmin(personas, crm);

    await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);

    const insertCall = personas.calls.find((c) => c.op === 'insert');
    const address = (insertCall?.filters.evm_key as { address: string }).address;
    expect(address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(address).not.toBe('0xREALCUSTODIEDADDRESS0000000000000000002');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to a placeholder address'));
    warnSpy.mockRestore();
  });

  it('a concurrent-provision race (insert fails) re-reads rather than fails the resolution', async () => {
    const personas = new FakeTable([]);
    personas.failNextInsert = 'duplicate key value violates unique constraint';
    // Simulate the concurrent winner's row already present by the time we re-read.
    const originalMaybeSingle = personas.select.bind(personas);
    let insertAttempted = false;
    const realInsert = personas.insert.bind(personas);
    personas.insert = ((values: Record<string, unknown>) => {
      insertAttempted = true;
      return realInsert(values);
    }) as typeof personas.insert;

    // After the failed insert, seed the row a "concurrent winner" would have created.
    const crm = new FakeTable([{ id: 'crm-nakamoto-concurrent', identity_persona_id: 'concurrent-winner-1' }]);
    const admin = {
      from(table: string) {
        if (table === 'crm_personas') return crm;
        if (table === 'personas') {
          return {
            select: (cols: string) => {
              const builder = originalMaybeSingle(cols);
              const originalMaybeSingleFn = builder.maybeSingle.bind(builder);
              builder.maybeSingle = async () => {
                if (insertAttempted) {
                  return { data: { id: 'concurrent-winner-1' }, error: null };
                }
                return originalMaybeSingleFn();
              };
              return builder;
            },
            insert: personas.insert.bind(personas),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as any;

    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);
    expect(result).toBe('crm-nakamoto-concurrent');
  });

  it('returns null (not undefined) when the canonical persona resolves but has no crm_personas mirror yet — a genuine, disclosed gap', async () => {
    const personas = new FakeTable([
      { id: 'canonical-persona-1', root_did: AGENT_ROOT_DID, app_origin: CANONICAL_AGENT_STANDING_APP_ORIGIN, auth_profile_id: null },
    ]);
    const crm = new FakeTable([]); // no mirror row
    const admin = makeFakeAdmin(personas, crm);

    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);
    expect(result).toBeNull();
  });

  it('returns undefined (audit gap) when a DB read genuinely errors', async () => {
    const personas = {
      from: () => {
        throw new Error('should not be called directly');
      },
    };
    const admin = {
      from(table: string) {
        if (table === 'personas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({ data: null, error: { message: 'connection reset' } }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as any;
    const result = await resolveAgentStandingPersonaId(admin, NAKAMOTO_AGENT, AGENT_ROOT_DID);
    expect(result).toBeUndefined();
  });
});
