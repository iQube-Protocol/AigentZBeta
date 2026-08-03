/**
 * services/registry/trustDimensions.ts — decomposes trust_composite into
 * declared dimensions (operator ruling, 2026-08-03): willingness to disclose
 * (transparency) must never be conflated with proven accuracy
 * (evidenceAccuracy/operationalReliability), and neither may silently
 * promote the formal capability score or trust_band.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const registryAssetsTable = new Map<string, { metadata: any }>();

function makeAdmin() {
  return {
    from: (table: string) => {
      if (table !== 'registry_assets') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, value: string) => ({
            maybeSingle: async () => ({ data: registryAssetsTable.get(value) ?? null, error: null }),
          }),
        }),
        update: (patch: { metadata: any }) => ({
          eq: (_col: string, value: string) => {
            const existing = registryAssetsTable.get(value);
            if (existing) registryAssetsTable.set(value, { ...existing, metadata: patch.metadata });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  };
}

const createActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

import {
  computeComposite,
  recordTrustDimensionIncrement,
  TRANSPARENCY_INCREMENT_PULSE_AUTHORIZED,
  TRANSPARENCY_INCREMENT_PNL_DISCLOSURE_AUTHORIZED,
} from '@/services/registry/trustDimensions';

beforeEach(() => {
  registryAssetsTable.clear();
  createActivityReceipt.mockClear();
});

function seed(assetId: string, metadata: Record<string, unknown>) {
  registryAssetsTable.set(assetId, { metadata });
}

describe('computeComposite', () => {
  it('sums all four dimensions', () => {
    expect(
      computeComposite({ capability: 82, transparency: 10, evidenceAccuracy: 5, operationalReliability: 3 }),
    ).toBe(100);
  });

  it('caps at 100 rather than overflowing', () => {
    expect(
      computeComposite({ capability: 90, transparency: 20, evidenceAccuracy: 10, operationalReliability: 10 }),
    ).toBe(100);
  });

  it('floors at 0', () => {
    expect(
      computeComposite({ capability: -50, transparency: 0, evidenceAccuracy: 0, operationalReliability: 0 }),
    ).toBe(0);
  });
});

describe('recordTrustDimensionIncrement', () => {
  it('initializes dimensions from the legacy trust_composite as capability, others zero', async () => {
    seed('aigentqube-nakamoto', { trust_composite: 82 });
    const result = await recordTrustDimensionIncrement({
      admin: makeAdmin() as any,
      assetId: 'aigentqube-nakamoto',
      dimension: 'transparency',
      delta: TRANSPARENCY_INCREMENT_PULSE_AUTHORIZED,
      signal: 'pulse_authorization_granted',
      evidenceRef: 'auth-1',
      rationale: 'test',
      actorPersonaId: 'persona-1',
      runtimeAgentId: 'aigent-nakamoto',
      displayName: 'Aigent Nakamoto',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toEqual({ capability: 82, transparency: 0, evidenceAccuracy: 0, operationalReliability: 0 });
    expect(result.next).toEqual({ capability: 82, transparency: 5, evidenceAccuracy: 0, operationalReliability: 0 });

    const stored = registryAssetsTable.get('aigentqube-nakamoto')!;
    expect(stored.metadata.trust_composite).toBe(87);
  });

  it('never touches trust_band, policy_class, wrapper_strategy, or capabilities', async () => {
    seed('aigentqube-nakamoto', {
      trust_composite: 82,
      trust_band: 'L4_PRODUCTION_APPROVED',
      policy_class: 'human_approval_required',
      wrapper_strategy: 'skill',
    });
    await recordTrustDimensionIncrement({
      admin: makeAdmin() as any,
      assetId: 'aigentqube-nakamoto',
      dimension: 'transparency',
      delta: TRANSPARENCY_INCREMENT_PNL_DISCLOSURE_AUTHORIZED,
      signal: 'pnl_disclosure_authorization_granted',
      evidenceRef: 'auth-2',
      rationale: 'test',
      actorPersonaId: 'persona-1',
      runtimeAgentId: 'aigent-nakamoto',
      displayName: 'Aigent Nakamoto',
    });
    const stored = registryAssetsTable.get('aigentqube-nakamoto')!;
    // THE ASSERTION THAT FAILS ON THE DEFECT: this module promoting the band
    // or policy fields would be exactly the "reward a promise as if it were
    // performance" mistake the operator ruled against.
    expect(stored.metadata.trust_band).toBe('L4_PRODUCTION_APPROVED');
    expect(stored.metadata.policy_class).toBe('human_approval_required');
    expect(stored.metadata.wrapper_strategy).toBe('skill');
  });

  it('clamps a dimension at 100 rather than letting composite exceed it via one dimension', async () => {
    seed('aigentqube-nakamoto', { trust_composite: 82, trust_dimensions: { capability: 82, transparency: 98, evidenceAccuracy: 0, operationalReliability: 0 } });
    const result = await recordTrustDimensionIncrement({
      admin: makeAdmin() as any,
      assetId: 'aigentqube-nakamoto',
      dimension: 'transparency',
      delta: 10,
      signal: 'pnl_disclosure_authorization_granted',
      evidenceRef: 'auth-3',
      rationale: 'test',
      actorPersonaId: 'persona-1',
      runtimeAgentId: 'aigent-nakamoto',
      displayName: 'Aigent Nakamoto',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.transparency).toBe(100);
  });

  it('records the full audit trail on the receipt: signal, evidenceRef, previous/new score, rationale', async () => {
    seed('aigentqube-nakamoto', { trust_composite: 82 });
    await recordTrustDimensionIncrement({
      admin: makeAdmin() as any,
      assetId: 'aigentqube-nakamoto',
      dimension: 'transparency',
      delta: 5,
      signal: 'pulse_authorization_granted',
      evidenceRef: 'auth-99',
      rationale: 'Pulse monitoring authorization confirmed by Horizen.',
      actorPersonaId: 'persona-1',
      runtimeAgentId: 'aigent-nakamoto',
      displayName: 'Aigent Nakamoto',
    });
    expect(createActivityReceipt).toHaveBeenCalledTimes(1);
    const call = createActivityReceipt.mock.calls[0][0];
    expect(call.actionType).toBe('trust_dimension_incremented');
    expect(call.agentsInvoked).toEqual(['aigent-nakamoto']);
    expect(call.actionInput).toMatchObject({
      signal: 'pulse_authorization_granted',
      dimension: 'transparency',
      evidenceRef: 'auth-99',
      rationale: 'Pulse monitoring authorization confirmed by Horizen.',
      previousScore: 0,
      newScore: 5,
      previousComposite: 82,
      newComposite: 87,
    });
  });

  it('is a real negative, not a gap, when the asset does not exist', async () => {
    const result = await recordTrustDimensionIncrement({
      admin: makeAdmin() as any,
      assetId: 'aigentqube-does-not-exist',
      dimension: 'transparency',
      delta: 5,
      signal: 'pulse_authorization_granted',
      evidenceRef: 'auth-1',
      rationale: 'test',
      actorPersonaId: 'persona-1',
      runtimeAgentId: 'aigent-nowhere',
      displayName: 'Nobody',
    });
    expect(result.ok).toBe(false);
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });
});
