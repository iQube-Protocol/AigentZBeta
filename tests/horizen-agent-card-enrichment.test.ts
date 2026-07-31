/**
 * services/horizen/agentCardEnrichment.ts — GJR-VFY-001 Phase 2. Projects a
 * confirmed Horizen transparency authorization onto MoneyPenny's AigentQube
 * binding (never a parallel source of truth — the same
 * external_registry_bindings[0] the Agent Card route itself reads) and
 * writes the two remaining canonical receipt types.
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

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => makeAdmin(),
}));

const createActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

import { enrichAgentCardAfterHorizenAuthorization } from '@/services/horizen/agentCardEnrichment';

beforeEach(() => {
  registryAssetsTable.clear();
  createActivityReceipt.mockClear();
});

function seedAigentQube(bindings: any[], extraMetadata: Record<string, unknown> = {}) {
  registryAssetsTable.set('aigentqube-moneypenny', {
    metadata: { ...extraMetadata, external_registry_bindings: bindings },
  });
}

const BASE_BINDING = {
  protocol: 'erc-8004',
  registry: 'horizen',
  network: 'base-sepolia',
  identity_registry_contract: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  token_id: '1234',
  registry_alias: '0x4d2',
  status: 'registered',
};

describe('enrichAgentCardAfterHorizenAuthorization', () => {
  it('merges transparency into the matching binding, preserving other fields and metadata', async () => {
    seedAigentQube([BASE_BINDING], { badge: 'M', skillCount: 3 });

    const result = await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: 'persona-operator-1',
      aigentQubeId: 'aigentqube-moneypenny',
      runtimeAgentId: 'aigent-moneypenny',
      displayName: 'Aigent MoneyPenny',
      authorizationId: 'auth-1',
      controllerWallet: '0xController',
      tokenId: '1234',
      network: 'base-sepolia',
      signatureRef: 'sig-hash',
      submissionRef: 'sub-ref',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receiptRefs.pnlTransparencyEnabled).toBe('receipt-horizen_pnl_transparency_enabled');
    expect(result.receiptRefs.agentCardEnriched).toBe('receipt-agent_card_enriched');

    const stored = registryAssetsTable.get('aigentqube-moneypenny')!;
    expect(stored.metadata.badge).toBe('M'); // sibling metadata untouched
    const binding = stored.metadata.external_registry_bindings[0];
    expect(binding.token_id).toBe('1234'); // original binding fields preserved
    expect(binding.transparency).toEqual({
      pulse_enabled: true,
      pulse_authorization_ref: 'auth-1',
      pnl_disclosure_authorized: true,
      pnl_proof_refs: [],
    });
  });

  it('writes exactly the two canonical receipt types, never horizen_pulse_authorized (that is Phase 1\'s own receipt)', async () => {
    seedAigentQube([BASE_BINDING]);
    await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: 'persona-operator-1',
      aigentQubeId: 'aigentqube-moneypenny',
      runtimeAgentId: 'aigent-moneypenny',
      displayName: 'Aigent MoneyPenny',
      authorizationId: 'auth-1',
      controllerWallet: '0xController',
      tokenId: '1234',
      network: 'base-sepolia',
      signatureRef: null,
      submissionRef: null,
    });
    const actionTypes = createActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(actionTypes).toEqual(['horizen_pnl_transparency_enabled', 'agent_card_enriched']);
    expect(createActivityReceipt.mock.calls.every((c) => c[0].personaId === 'persona-operator-1')).toBe(true);
  });

  it('refuses AIGENTQUBE_NOT_FOUND when no registry_assets row exists', async () => {
    const result = await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: 'persona-operator-1',
      aigentQubeId: 'aigentqube-moneypenny',
      runtimeAgentId: 'aigent-moneypenny',
      displayName: 'Aigent MoneyPenny',
      authorizationId: 'auth-1',
      controllerWallet: '0xController',
      tokenId: '1234',
      network: 'base-sepolia',
      signatureRef: null,
      submissionRef: null,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses NO_MATCHING_BINDING rather than fabricating one when tokenId/network do not match any binding', async () => {
    seedAigentQube([BASE_BINDING]);
    const result = await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: 'persona-operator-1',
      aigentQubeId: 'aigentqube-moneypenny',
      runtimeAgentId: 'aigent-moneypenny',
      displayName: 'Aigent MoneyPenny',
      authorizationId: 'auth-1',
      controllerWallet: '0xController',
      tokenId: '9999',
      network: 'base-sepolia',
      signatureRef: null,
      submissionRef: null,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'NO_MATCHING_BINDING' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('preserves existing pnl_proof_refs on re-enrichment rather than discarding them', async () => {
    seedAigentQube([{ ...BASE_BINDING, transparency: { pulse_enabled: true, pulse_authorization_ref: 'old', pnl_disclosure_authorized: true, pnl_proof_refs: ['proof-1'] } }]);
    const result = await enrichAgentCardAfterHorizenAuthorization({
      actorPersonaId: 'persona-operator-1',
      aigentQubeId: 'aigentqube-moneypenny',
      runtimeAgentId: 'aigent-moneypenny',
      displayName: 'Aigent MoneyPenny',
      authorizationId: 'auth-2',
      controllerWallet: '0xController',
      tokenId: '1234',
      network: 'base-sepolia',
      signatureRef: null,
      submissionRef: null,
    });
    expect(result.ok).toBe(true);
    const stored = registryAssetsTable.get('aigentqube-moneypenny')!;
    expect(stored.metadata.external_registry_bindings[0].transparency.pnl_proof_refs).toEqual(['proof-1']);
    expect(stored.metadata.external_registry_bindings[0].transparency.pulse_authorization_ref).toBe('auth-2');
  });
});
