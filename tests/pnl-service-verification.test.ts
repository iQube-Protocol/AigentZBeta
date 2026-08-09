/**
 * services/horizen/pnlServiceVerification.ts — independent, read-only
 * discovery and receipting of a genuine Verifiable-PnL correlation
 * (operator directive, 2026-08-08).
 *
 * Fixtures follow this repo's existing convention for Horizen reads
 * (tests/horizen-integration.test.ts's `fakeFetch(routes)`) — an injected
 * `HorizenFetch`, never a live network call. The receipt writer/reader are
 * mocked with a simple in-memory Map, mirroring
 * tests/horizen-authorization-client.test.ts's own receipt-store fake.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HorizenFetch } from '@/services/horizen/client';

const receiptStore = new Map<string, any>();
let receiptCounter = 0;
const createActivityReceipt = vi.fn(async (input: any) => {
  receiptCounter += 1;
  const record = { id: `receipt-${receiptCounter}`, ...input };
  receiptStore.set(record.id, record);
  return record;
});
const getActivityReceiptActionInput = vi.fn(async (id: string) => receiptStore.get(id)?.actionInput ?? null);
const findAgentReceiptRefs = vi.fn(async (runtimeAgentId: string, actionTypes: string[]) => {
  const out: { id: string; actionType: string }[] = [];
  for (const [id, r] of receiptStore.entries()) {
    if (actionTypes.includes(r.actionType) && (r.agentsInvoked ?? []).includes(runtimeAgentId)) {
      out.push({ id, actionType: r.actionType });
    }
  }
  return out;
});
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
  getActivityReceiptActionInput: (...args: any[]) => getActivityReceiptActionInput(...args),
  findAgentReceiptRefs: (...args: any[]) => findAgentReceiptRefs(...args),
}));

import { discoverAndReceiptPnlServiceEvidence } from '@/services/horizen/pnlServiceVerification';

beforeEach(() => {
  receiptStore.clear();
  receiptCounter = 0;
  createActivityReceipt.mockClear();
  findAgentReceiptRefs.mockClear();
  getActivityReceiptActionInput.mockClear();
});

/** Nakamoto, token 8798 (decimal) / 0x225e (hex), base-sepolia. */
function fakeFetch(routes: Record<string, { status?: number; body?: unknown }>): HorizenFetch {
  return async (url: string) => {
    const hit = Object.entries(routes).find(([fragment]) => url.includes(fragment));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    const { status = 200, body = {} } = hit[1];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

const REGISTRY_0X225E_ON_CHAIN = {
  agent: { agentId: '0x225e', name: 'Aigent Nakamoto', owner: '0xNakamotoOwner', active: true, source: 'on-chain' },
  ready: true,
};

const baseArgs = {
  aigentQubeId: 'aigentqube-nakamoto',
  subjectRegistryAlias: '8798',
  network: 'base-sepolia' as const,
  actorPersonaId: 'persona-operator-1',
  runtimeAgentId: 'aigent-nakamoto',
};

describe('discoverAndReceiptPnlServiceEvidence (operator directive, 2026-08-08)', () => {
  it('a genuine PnL correlation (present, on-chain identity, agreeing chain) mints pnl_service_verified', async () => {
    const routes = {
      '/api/agents/0x225e?': { body: REGISTRY_0X225E_ON_CHAIN },
      '/api/agents/0x225e/pulse-status': { body: { enrolled: false } },
      '/v1/erc8004/8798': { body: { agentId: 'pnl-uuid-nakamoto-8798', erc8004Chain: 'base-sepolia', status: 'active' } },
    };

    const result = await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: fakeFetch(routes) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verified).toBe(true);
    if (!result.verified) return;
    expect(result.alreadyVerified).toBe(false);
    expect(result.receiptRef).toBeTruthy();
    expect(result.evidence).toMatchObject({
      aigentQubeId: 'aigentqube-nakamoto',
      tokenId: '8798',
      pnlUuid: 'pnl-uuid-nakamoto-8798',
      pnlStatus: 'active',
      erc8004Chain: 'base-sepolia',
      identityClass: 'on-chain',
    });
    expect(createActivityReceipt).toHaveBeenCalledTimes(1);
    expect(createActivityReceipt.mock.calls[0][0].actionType).toBe('pnl_service_verified');
    expect(createActivityReceipt.mock.calls[0][0].agentsInvoked).toEqual(['aigent-nakamoto']);
    // The receipt body carries no raw persona/root identifiers — commitments only.
    expect(JSON.stringify(createActivityReceipt.mock.calls[0][0].actionInput)).not.toContain('persona-operator-1');
  });

  it('already verified: a prior receipt short-circuits with no live call', async () => {
    receiptStore.set('receipt-prior', {
      id: 'receipt-prior',
      actionType: 'pnl_service_verified',
      agentsInvoked: ['aigent-nakamoto'],
      actionInput: { aigentQubeId: 'aigentqube-nakamoto', evidence: { pnlUuid: 'pnl-uuid-nakamoto-8798', tokenId: '8798' } },
    });
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const result = await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: fetchSpy as any });

    expect(result).toMatchObject({ ok: true, verified: true, alreadyVerified: true, receiptRef: 'receipt-prior' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('not found: a 404 PnL correlation returns evidencePending, mints nothing', async () => {
    const routes = {
      '/api/agents/0x225e?': { body: REGISTRY_0X225E_ON_CHAIN },
      '/api/agents/0x225e/pulse-status': { body: { enrolled: false } },
      '/v1/erc8004/8798': { status: 404, body: {} },
    };

    const result = await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: fakeFetch(routes) });

    expect(result).toMatchObject({ ok: true, verified: false, evidencePending: true, reason: 'NOT_FOUND' });
    if (result.ok && !result.verified) {
      expect(result.openContractQuestion).toContain('enable_pulse_monitoring');
    }
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('read failed: a registry transport failure returns evidencePending READ_FAILED, mints nothing', async () => {
    const failingFetch: HorizenFetch = async () => {
      throw new Error('ECONNRESET');
    };

    const result = await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: failingFetch });

    expect(result).toMatchObject({ ok: true, verified: false, evidencePending: true, reason: 'READ_FAILED' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('identity unconfirmed: a non-on-chain identity class refuses to attribute the correlation, mints nothing', async () => {
    const routes = {
      '/api/agents/0x225e?': {
        body: { agent: { agentId: '0x225e', name: 'Aigent Nakamoto', owner: '0xNakamotoOwner', active: true, source: 'catalogue' }, ready: true },
      },
      '/api/agents/0x225e/pulse-status': { body: { enrolled: false } },
      '/v1/erc8004/8798': { body: { agentId: 'pnl-uuid-nakamoto-8798', status: 'active' } },
    };

    const result = await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: fakeFetch(routes) });

    expect(result).toMatchObject({ ok: true, verified: false, evidencePending: true, reason: 'IDENTITY_UNCONFIRMED' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('chain mismatch: a PnL correlation reporting a different erc8004Chain refuses to attribute, mints nothing', async () => {
    const routes = {
      '/api/agents/0x225e?': { body: REGISTRY_0X225E_ON_CHAIN },
      '/api/agents/0x225e/pulse-status': { body: { enrolled: false } },
      '/v1/erc8004/8798': { body: { agentId: 'pnl-uuid-nakamoto-8798', erc8004Chain: 'base-mainnet', status: 'active' } },
    };

    const result = await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: fakeFetch(routes) });

    expect(result).toMatchObject({ ok: true, verified: false, evidencePending: true, reason: 'CHAIN_MISMATCH' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('never calls anything that mutates Horizen state — only GET-shaped reads through fetchImpl', async () => {
    const seenMethods: (string | undefined)[] = [];
    const spy: HorizenFetch = async (url, init) => {
      seenMethods.push((init as RequestInit | undefined)?.method);
      if (url.includes('/api/agents/0x225e?')) return { ok: true, status: 200, json: async () => REGISTRY_0X225E_ON_CHAIN };
      if (url.includes('pulse-status')) return { ok: true, status: 200, json: async () => ({ enrolled: false }) };
      if (url.includes('/v1/erc8004/8798')) {
        return { ok: true, status: 200, json: async () => ({ agentId: 'pnl-uuid-nakamoto-8798', erc8004Chain: 'base-sepolia' }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    await discoverAndReceiptPnlServiceEvidence(baseArgs, { fetchImpl: spy });

    // readJson never sets a method — every call is an implicit GET.
    expect(seenMethods.every((m) => m === undefined)).toBe(true);
  });
});
