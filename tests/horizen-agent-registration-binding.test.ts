/**
 * services/horizen/agentRegistrationBinding.ts — the ONE resilient reader of
 * an agent's Horizen registration binding, shared by both served Agent Card
 * routes and Claim's own gate.
 *
 * ── The defect this closes (Aigent Nakamoto's live registration, 2026-08-03) ─
 *
 * A confirmed registration makes two independent Supabase writes — the
 * `horizen_agent_registered` receipt (always attempted) and the
 * registry_assets.metadata projection (a separate write, silently no-op-able
 * on a missing row or binding array). Nakamoto's registration proved these are
 * not atomic: the receipt existed, the projection did not, and every surface
 * reading the projection alone reported her unregistered.
 *
 * ── Why the FIRST version of the fallback never fired, and what these tests
 *    now assert instead ─────────────────────────────────────────────────────
 *
 * The original canaries passed while the code was broken, because they
 * encoded the code's own two wrong assumptions instead of the real data:
 *
 *   1. They asserted the fallback looks up the AGENT's persona
 *      (`fio_handle = nakamoto@aigent`). Receipts are written against the
 *      OPERATOR's persona (`actorPersonaId`, e.g. ArkAgent) — so the real
 *      lookup searched a persona that structurally never holds the receipt.
 *      Now: the lookup is keyed on `agents_invoked`, and a test asserts no
 *      persona lookup happens at all.
 *
 *   2. One test literally asserted that a pre-enrichment receipt
 *      (`{txHash, network, aigentQubeId}` — EXACTLY the shape Nakamoto's real
 *      receipt has) must be IGNORED. That is the bug written down as a
 *      requirement. Now: that same shape must RESOLVE, by decoding the named
 *      transaction on-chain.
 *
 * The rule these replace it with: a canary must be written against evidence
 * that actually exists, not against the shape the new code happens to emit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Nakamoto's REAL registration facts (operator screenshots + receipt, 2026-08-03). */
const REAL_TX = '0xedda5f7388434fd979311b4573d1058ad33219058290ef8ea10b429b64b5dde6';
const REAL_TOKEN_ID = '8798';
const REAL_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const NAKAMOTO_WALLET = '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9';

const registryAssetsTable = new Map<string, { metadata: any }>();
let personaLookups = 0;

function makeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'registry_assets') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: async () => ({ data: registryAssetsTable.get(value) ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'personas') {
        personaLookups += 1;
        return {
          select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as any;
}

const mockFindReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findAgentRegistrationReceipts: (...args: any[]) => mockFindReceipts(...args),
}));

const mockDecode = vi.fn();
vi.mock('@/services/horizen/agentIdRecovery', () => ({
  decodeAgentIdFromReceipt: (...args: any[]) => mockDecode(...args),
}));

import { resolveHorizenRegistrationBinding } from '@/services/horizen/agentRegistrationBinding';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

const nakamoto = resolveRegistrableAgent('nakamoto')!;

/** Deps that make the chain reachable in-test without any network call. */
const deps = {
  rpcProvider: () => ({}) as any,
  agentOwnerAddress: async () => NAKAMOTO_WALLET,
};

function seedUnwrittenProjection() {
  registryAssetsTable.set('aigentqube-nakamoto', {
    metadata: {
      external_registry_bindings: [
        { protocol: 'erc-8004', registry: 'horizen', token_id: null, registry_alias: null, status: 'pending-registration' },
      ],
    },
  });
}

/** The pre-enrichment receipt shape — EXACTLY what Nakamoto's real receipt carries. */
const LEGACY_RECEIPT = {
  receiptId: 'r-legacy',
  txHash: REAL_TX,
  network: 'base-sepolia',
  tokenId: null,
  registryAddress: null,
  ownerAddress: null,
  createdAt: '2026-08-02T21:09:59.000Z',
};

beforeEach(() => {
  registryAssetsTable.clear();
  personaLookups = 0;
  mockFindReceipts.mockReset();
  mockDecode.mockReset();
});

describe('the registry_assets projection wins when it has a tokenId', () => {
  it('returns the stored binding without ever consulting receipts', async () => {
    registryAssetsTable.set('aigentqube-nakamoto', {
      metadata: {
        external_registry_bindings: [
          { protocol: 'erc-8004', registry: 'horizen', token_id: REAL_TOKEN_ID, registry_alias: '0x2256', status: 'registered' },
        ],
      },
    });
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);
    expect(result.fromReceiptFallback).toBe(false);
    expect(result.fallbackSource).toBeNull();
    expect(result.binding?.token_id).toBe(REAL_TOKEN_ID);
    expect(mockFindReceipts).not.toHaveBeenCalled();
  });
});

describe('receipts are found by AGENT, never by the agent’s own persona (bug #1)', () => {
  it('queries on the runtime agent id and never looks up a persona row', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([]);

    await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);

    expect(mockFindReceipts).toHaveBeenCalledWith('aigent-nakamoto', { limit: 20 });
    // The old implementation resolved personas.fio_handle = 'nakamoto@aigent'
    // and listed THAT persona's receipts — a persona that never holds them,
    // because receipts are written against the acting OPERATOR's persona.
    expect(personaLookups, 'a persona lookup means the wrong-persona bug is back').toBe(0);
  });
});

describe('the pre-enrichment receipt resolves via the chain (bug #2 — the live case)', () => {
  it("recovers Nakamoto's tokenId from the transaction her legacy receipt names", async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([LEGACY_RECEIPT]);
    mockDecode.mockResolvedValue({
      ok: true,
      agentId: REAL_TOKEN_ID,
      registry: REAL_REGISTRY,
      agentURI: null,
      source: 'Registered',
      blockNumber: 1,
      logIndex: 0,
    });

    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);

    expect(result.fromReceiptFallback).toBe(true);
    expect(result.fallbackSource).toBe('receipt-tx-chain-decode');
    expect(result.binding?.token_id).toBe(REAL_TOKEN_ID);
    expect(result.binding?.identity_registry_contract).toBe(REAL_REGISTRY);
    expect(result.binding?.status).toBe('registered');
    // The decode is bound to the agent's OWN wallet — that owner check is the
    // only thing making this proof about THIS agent.
    expect(mockDecode).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: REAL_TX, expectedOwner: NAKAMOTO_WALLET }),
    );
  });

  it('reports unregistered — never a guess — when the chain does not confirm the tx', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([LEGACY_RECEIPT]);
    mockDecode.mockResolvedValue({ ok: false, reason: 'no Registered or Transfer(mint) event found' });

    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);

    expect(result.fromReceiptFallback).toBe(false);
    expect(result.binding?.token_id).toBeNull();
  });

  it('never decodes when the agent’s own wallet address cannot be resolved', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([LEGACY_RECEIPT]);

    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, {
      ...deps,
      agentOwnerAddress: async () => null,
    });

    expect(result.binding?.token_id).toBeNull();
    expect(mockDecode, 'an unowned decode could attribute any mint in the tx').not.toHaveBeenCalled();
  });
});

describe('a structured receipt still short-circuits the chain call', () => {
  it('uses the receipt’s own tokenId without decoding', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([
      { ...LEGACY_RECEIPT, receiptId: 'r-new', tokenId: REAL_TOKEN_ID, registryAddress: REAL_REGISTRY },
    ]);

    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);

    expect(result.fallbackSource).toBe('receipt-structured');
    expect(result.binding?.token_id).toBe(REAL_TOKEN_ID);
    expect(mockDecode).not.toHaveBeenCalled();
  });
});

describe('the AigentQube seed migrations cannot un-register a registered agent', () => {
  /*
   * Nakamoto's registry_assets row was MISSING on dev entirely — that, not a
   * failed update, is why updateRegistryAssetBinding's silent `!row` branch
   * fired and why every projection reader said "not registered". Seeding the
   * row is the remedy; the hazard is the seed's own ON CONFLICT clause.
   *
   * `metadata = EXCLUDED.metadata` is a blind overwrite and EXCLUDED.metadata
   * carries `token_id: null`, so re-running either seed against a database
   * where the registration HAD landed would erase a real, confirmed,
   * on-chain ERC-8004 registration — silently, and with no error anywhere.
   */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const MIGRATIONS = [
    '20260930000400_aigentqube_moneypenny_registry_asset.sql',
    '20260930000700_aigentqube_nakamoto_registry_asset.sql',
  ];

  for (const file of MIGRATIONS) {
    it(`${file} preserves an existing bindings array that already carries a tokenId`, () => {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', file), 'utf8');
      expect(sql, 'a blind metadata overwrite would wipe a confirmed registration').not.toMatch(
        /metadata\s*=\s*EXCLUDED\.metadata\s*,/,
      );
      expect(sql).toContain("registry_assets.metadata #>> '{external_registry_bindings,0,token_id}' IS NOT NULL");
      expect(sql).toContain("registry_assets.metadata -> 'external_registry_bindings'");
    });
  }
});

describe('refusals that must survive both fixes', () => {
  it('resolves nothing when the agent has no registration receipt at all', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([]);
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);
    expect(result.binding?.token_id).toBeNull();
    expect(mockDecode).not.toHaveBeenCalled();
  });

  it('returns null (not a thrown error) when there is no registry_assets row at all', async () => {
    mockFindReceipts.mockResolvedValue([]);
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);
    expect(result).toEqual({ binding: null, fromReceiptFallback: false, fallbackSource: null });
  });

  it('never lets a receipt-lookup failure be reported as an answer', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockRejectedValue(new Error('activity_receipts unreachable'));
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, deps);
    expect(result.fromReceiptFallback).toBe(false);
    expect(result.binding?.token_id).toBeNull();
  });

  it('does not decode against a network this repo has no configured RPC for', async () => {
    seedUnwrittenProjection();
    mockFindReceipts.mockResolvedValue([{ ...LEGACY_RECEIPT, network: 'some-unconfigured-net' }]);

    // Real default provider resolution (no rpcProvider injected) — it must
    // yield no provider rather than guessing an endpoint.
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto, {
      agentOwnerAddress: async () => NAKAMOTO_WALLET,
    });

    expect(result.binding?.token_id).toBeNull();
    expect(mockDecode).not.toHaveBeenCalled();
  });
});
