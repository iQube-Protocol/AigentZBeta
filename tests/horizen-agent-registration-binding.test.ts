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
 * on a missing row or binding array). Nakamoto's registration proved these
 * are not atomic: the receipt existed, the projection did not, and every
 * surface reading the projection alone reported her unregistered while the
 * master Journey stepper (receipt-driven) had already advanced. This reads
 * the projection first and falls back to the receipt's structured
 * `actionInput.registration` block only when the projection has no tokenId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const registryAssetsTable = new Map<string, { metadata: any }>();
const personasTable = new Map<string, { id: string }>();

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
        return {
          select: () => ({
            ilike: (_col: string, value: string) => ({
              maybeSingle: async () => ({ data: personasTable.get(value) ?? null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as any;
}

const mockListReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: (...args: any[]) => mockListReceipts(...args),
}));

import { resolveHorizenRegistrationBinding } from '@/services/horizen/agentRegistrationBinding';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

const nakamoto = resolveRegistrableAgent('nakamoto')!;

beforeEach(() => {
  registryAssetsTable.clear();
  personasTable.clear();
  mockListReceipts.mockReset();
});

describe('resolveHorizenRegistrationBinding — the registry_assets projection wins when it has a tokenId', () => {
  it('returns the stored binding without ever consulting receipts', async () => {
    registryAssetsTable.set('aigentqube-nakamoto', {
      metadata: { external_registry_bindings: [{ protocol: 'erc-8004', registry: 'horizen', token_id: '8798', registry_alias: '0x2256', status: 'registered' }] },
    });
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto);
    expect(result.fromReceiptFallback).toBe(false);
    expect(result.binding?.token_id).toBe('8798');
    expect(mockListReceipts).not.toHaveBeenCalled();
  });
});

describe('resolveHorizenRegistrationBinding — the receipt fallback (the actual fix)', () => {
  it('falls back to a confirmed receipt when the projection has no tokenId', async () => {
    registryAssetsTable.set('aigentqube-nakamoto', {
      metadata: { external_registry_bindings: [{ protocol: 'erc-8004', registry: 'horizen', token_id: null, registry_alias: null, status: 'pending-registration' }] },
    });
    personasTable.set('nakamoto@aigent', { id: 'persona-nakamoto-journey' });
    mockListReceipts.mockResolvedValue([
      {
        actionType: 'horizen_agent_registered',
        agentsInvoked: ['aigent-nakamoto'],
        actionInput: {
          registration: {
            protocol: 'erc-8004',
            network: 'base-sepolia',
            txHash: '0xedda5f7388434fd979311b4573d1058ad33219058290ef8ea10b429b64b5dde6',
            tokenId: '8798',
            registryAddress: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
            ownerAddress: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9',
          },
        },
      },
    ]);

    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto);
    expect(result.fromReceiptFallback).toBe(true);
    expect(result.binding?.token_id).toBe('8798');
    expect(result.binding?.identity_registry_contract).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    expect(result.binding?.status).toBe('registered');
    // The persona lookup used the agent's OWN fio handle — never a hardcoded
    // MoneyPenny value, and never a raw personaId anywhere in the result.
    expect(mockListReceipts).toHaveBeenCalledWith('persona-nakamoto-journey', { actionTypes: ['horizen_agent_registered'], limit: 20 });
  });

  it('ignores a receipt invoking a DIFFERENT agent — never cross-attributes a registration', async () => {
    registryAssetsTable.set('aigentqube-nakamoto', {
      metadata: { external_registry_bindings: [{ protocol: 'erc-8004', registry: 'horizen', token_id: null, registry_alias: null, status: 'pending-registration' }] },
    });
    personasTable.set('nakamoto@aigent', { id: 'persona-nakamoto-journey' });
    mockListReceipts.mockResolvedValue([
      {
        actionType: 'horizen_agent_registered',
        agentsInvoked: ['aigent-moneypenny'],
        actionInput: { registration: { tokenId: '1234' } },
      },
    ]);
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto);
    expect(result.fromReceiptFallback).toBe(false);
    expect(result.binding?.token_id).toBeNull();
  });

  it('ignores a receipt with no structured registration block — never guesses from the summary', async () => {
    registryAssetsTable.set('aigentqube-nakamoto', {
      metadata: { external_registry_bindings: [{ protocol: 'erc-8004', registry: 'horizen', token_id: null, registry_alias: null, status: 'pending-registration' }] },
    });
    personasTable.set('nakamoto@aigent', { id: 'persona-nakamoto-journey' });
    mockListReceipts.mockResolvedValue([
      {
        actionType: 'horizen_agent_registered',
        agentsInvoked: ['aigent-nakamoto'],
        // The pre-enrichment receipt shape — txHash/network/aigentQubeId only.
        actionInput: { aigentQubeId: 'aigentqube-nakamoto', network: 'base-sepolia', txHash: '0xabc' },
      },
    ]);
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto);
    expect(result.fromReceiptFallback).toBe(false);
    expect(result.binding?.token_id).toBeNull();
  });

  it('returns the (empty) stored binding, never throws, when no journey persona is resolvable', async () => {
    registryAssetsTable.set('aigentqube-nakamoto', {
      metadata: { external_registry_bindings: [{ protocol: 'erc-8004', registry: 'horizen', token_id: null, registry_alias: null, status: 'pending-registration' }] },
    });
    // No persona row seeded.
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto);
    expect(result.fromReceiptFallback).toBe(false);
    expect(result.binding?.token_id).toBeNull();
    expect(mockListReceipts).not.toHaveBeenCalled();
  });

  it('returns null (not a thrown error) when there is no registry_assets row at all', async () => {
    const result = await resolveHorizenRegistrationBinding(makeAdmin(), nakamoto);
    expect(result).toEqual({ binding: null, fromReceiptFallback: false });
  });
});
