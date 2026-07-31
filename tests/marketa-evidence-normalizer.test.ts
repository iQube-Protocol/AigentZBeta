/**
 * services/marketa/externalAgentAdmissionEvidence.ts — GJR-MKT-001 Phase 3.
 * A read-only evidence assembler: every field traces to a real (mocked)
 * source or is left honestly absent — this normalizer never decides
 * eligibility, only gathers and cross-checks (that is Phase 4's job).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let registryAssetsRow: { metadata: any } | null = null;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table !== 'registry_assets') throw new Error(`unexpected table: ${table}`);
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: registryAssetsRow, error: null }) }) }) };
    },
  }),
}));

const mockListReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: (...args: any[]) => mockListReceipts(...args),
}));

import { assembleExternalAgentAdmissionEvidence, validateAgentCardSchema } from '@/services/marketa/externalAgentAdmissionEvidence';

const VALID_CARD_URL = 'https://dev-beta.aigentz.me/api/agents/moneypenny/agent-card.json';
const VALID_CARD_TEXT = JSON.stringify({ name: 'Aigent MoneyPenny', url: VALID_CARD_URL, metadata: { runtime_agent_id: 'aigent-moneypenny' } });

const FIXED_NOW = () => new Date('2026-07-31T12:00:00.000Z');

function fetchAgentCardOk(text = VALID_CARD_TEXT) {
  return vi.fn(async () => ({ ok: true, text: async () => text }));
}

const BOUND_ROW = {
  metadata: {
    external_registry_bindings: [
      {
        protocol: 'erc-8004',
        registry: 'horizen',
        network: 'base-sepolia',
        identity_registry_contract: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
        token_id: '1234',
        registry_alias: '0x4d2',
        status: 'registered',
        transparency: { pulse_enabled: true, pulse_authorization_ref: 'auth-1', pnl_disclosure_authorized: true, pnl_proof_refs: [] },
      },
    ],
  },
};

beforeEach(() => {
  registryAssetsRow = null;
  mockListReceipts.mockReset();
  mockListReceipts.mockResolvedValue([]);
});

describe('validateAgentCardSchema', () => {
  it('accepts a minimally well-shaped card', () => {
    expect(validateAgentCardSchema({ name: 'X', url: 'https://x/card.json', metadata: {} })).toBe(true);
  });
  it('rejects a card missing required fields', () => {
    expect(validateAgentCardSchema({ name: 'X' })).toBe(false);
    expect(validateAgentCardSchema(null)).toBe(false);
    expect(validateAgentCardSchema({ name: 'X', url: 'not-a-url', metadata: {} })).toBe(false);
  });
});

describe('assembleExternalAgentAdmissionEvidence', () => {
  it('refuses AIGENTQUBE_NOT_FOUND when no registry_assets row exists', async () => {
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: fetchAgentCardOk(), now: FIXED_NOW },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND' });
  });

  it('assembles full positive evidence when every source resolves cleanly', async () => {
    registryAssetsRow = BOUND_ROW;
    mockListReceipts.mockResolvedValue([
      { id: 'receipt-control-1', actionType: 'agent_control_proven', createdAt: '2026-07-31T11:00:00.000Z', actionInput: { aigentQubeId: 'aigentqube-moneypenny', signerWallet: '0xOwner' } },
    ]);
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      {
        fetchAgentCard: fetchAgentCardOk(),
        fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { owner: '0xOwner' } }),
        now: FIXED_NOW,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.aigentQube.exists).toBe(true);
    expect(result.evidence.agentCard).toMatchObject({ resolves: true, schemaValid: true, provenanceValid: true });
    expect(result.evidence.externalRegistry).toMatchObject({ resolves: true, tokenId: '1234', ownerWallet: '0xOwner' });
    expect(result.evidence.control).toMatchObject({ proven: true, fresh: true, signerWallet: '0xOwner' });
    expect(result.evidence.transparency).toMatchObject({ pulseSupported: true, pulseEnabled: true, pnlDisclosureAuthorized: true });
    expect(result.evidence.authorityFitness).toEqual({
      sponsorEligible: null,
      delegationBoundable: true,
      delegationRevocable: true,
      onwardDelegationProhibited: true,
      expirySupported: true,
    });
    expect(result.evidence.risk).toEqual({ contradictions: [], unresolvedClaims: [], quarantineSignals: [] });
    expect(result.evidenceSnapshotHash).toHaveLength(64);
  });

  it('never asserts sponsorEligible — always null regardless of how clean the evidence is', async () => {
    registryAssetsRow = BOUND_ROW;
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: fetchAgentCardOk(), now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.evidence.authorityFitness.sponsorEligible).toBeNull();
  });

  it('records unresolvedClaims rather than fabricating success when the Agent Card is unreachable', async () => {
    registryAssetsRow = BOUND_ROW;
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: async () => ({ ok: false, text: async () => '' }), now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.agentCard.resolves).toBe(false);
    expect(result.evidence.risk.unresolvedClaims).toContain('agent-card-unreachable');
  });

  it('flags a contradiction when the fetched card\'s own url does not match the fetch url', async () => {
    registryAssetsRow = BOUND_ROW;
    const mismatchedCard = JSON.stringify({ name: 'X', url: 'https://someone-else/card.json', metadata: {} });
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: fetchAgentCardOk(mismatchedCard), now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.agentCard.provenanceValid).toBe(false);
    expect(result.evidence.risk.contradictions).toContain('agent-card-url-self-mismatch');
  });

  it('reports no control proof recorded honestly, never as proven', async () => {
    registryAssetsRow = BOUND_ROW;
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: fetchAgentCardOk(), now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.control).toMatchObject({ proven: false, fresh: false });
    expect(result.evidence.risk.unresolvedClaims).toContain('no-control-proof-recorded');
  });

  it('marks a control proof older than the freshness window as proven-but-not-fresh', async () => {
    registryAssetsRow = BOUND_ROW;
    mockListReceipts.mockResolvedValue([
      { id: 'receipt-control-old', actionType: 'agent_control_proven', createdAt: '2026-07-28T12:00:00.000Z', actionInput: { aigentQubeId: 'aigentqube-moneypenny', signerWallet: '0xOwner' } },
    ]);
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: fetchAgentCardOk(), now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.control).toMatchObject({ proven: true, fresh: false });
    expect(result.evidence.risk.unresolvedClaims).toContain('control-proof-stale');
  });

  it('raises a quarantine signal when the control-proof signer does not match the registry-read owner', async () => {
    registryAssetsRow = BOUND_ROW;
    mockListReceipts.mockResolvedValue([
      { id: 'receipt-control-1', actionType: 'agent_control_proven', createdAt: '2026-07-31T11:00:00.000Z', actionInput: { aigentQubeId: 'aigentqube-moneypenny', signerWallet: '0xSignerWallet' } },
    ]);
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      {
        fetchAgentCard: fetchAgentCardOk(),
        fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { owner: '0xDifferentOwner' } }),
        now: FIXED_NOW,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.risk.quarantineSignals).toContain('control-proof-signer-does-not-match-registry-owner');
  });

  it('marks the external registry unresolved when no tokenId exists yet (Register incomplete)', async () => {
    registryAssetsRow = { metadata: { external_registry_bindings: [{ token_id: null, network: 'base-sepolia' }] } };
    const result = await assembleExternalAgentAdmissionEvidence(
      { aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL },
      { fetchAgentCard: fetchAgentCardOk(), now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.externalRegistry.resolves).toBe(false);
    expect(result.evidence.transparency).toMatchObject({ pulseSupported: false, pulseEnabled: false });
    expect(result.evidence.risk.unresolvedClaims).toContain('external-registry-not-resolved');
  });

  it('produces a deterministic evidenceSnapshotHash for identical evidence', async () => {
    registryAssetsRow = BOUND_ROW;
    const deps = { fetchAgentCard: fetchAgentCardOk(), now: FIXED_NOW };
    const r1 = await assembleExternalAgentAdmissionEvidence({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL }, deps);
    const r2 = await assembleExternalAgentAdmissionEvidence({ aigentQubeId: 'aigentqube-moneypenny', actorPersonaId: 'persona-1', agentCardUrl: VALID_CARD_URL }, deps);
    expect(r1.ok && r2.ok && r1.evidenceSnapshotHash === r2.evidenceSnapshotHash).toBe(true);
  });
});
