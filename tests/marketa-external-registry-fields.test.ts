/**
 * External-registry fields on CandidateAgent (2026-08-05 canonical Agent
 * Bench plan, Phase A) — extends the existing candidate model rather than a
 * parallel ExternalAgentProspect type. Pins: nullable throughout (never
 * defaulted to a false-implying value), round-trips DB <-> type cleanly,
 * and non-registry candidates are completely unaffected.
 */
import { describe, expect, it } from 'vitest';
import { candidateInputToDb, dbToCandidate, normalizeCandidateInput } from '@/services/marketa/activation/normalizers';

describe('external-registry fields — normalizeCandidateInput', () => {
  it('picks up registry fields when present, camelCase or snake_case', () => {
    const input = normalizeCandidateInput({
      name: 'Aigent Nakamoto',
      registryProvider: 'horizen',
      registry_network: 'base-sepolia',
      onChainAgentId: '8798',
      ownerWallet: '0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9',
      pulseState: 'available',
      pnl_state: 'unknown',
    });
    expect(input.registryProvider).toBe('horizen');
    expect(input.registryNetwork).toBe('base-sepolia');
    expect(input.onChainAgentId).toBe('8798');
    expect(input.ownerWallet).toBe('0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9');
    expect(input.pulseState).toBe('available');
    expect(input.pnlState).toBe('unknown');
  });

  it('never invents a registry provider for a non-registry candidate', () => {
    const input = normalizeCandidateInput({ name: 'Plain MCP Candidate' });
    expect(input.registryProvider).toBeUndefined();
    expect(input.pulseState).toBeUndefined();
  });

  it('drops an unrecognised registry provider or transparency state rather than guessing', () => {
    const input = normalizeCandidateInput({
      name: 'Suspicious Candidate',
      registryProvider: 'not-a-real-registry',
      pulseState: 'definitely-verified',
    });
    expect(input.registryProvider).toBeUndefined();
    expect(input.pulseState).toBeUndefined();
  });
});

describe('external-registry fields — DB round-trip', () => {
  it('candidateInputToDb -> dbToCandidate preserves every registry field', () => {
    const input = normalizeCandidateInput({
      name: 'Aigent Nakamoto',
      registryProvider: 'horizen',
      registryNetwork: 'base-sepolia',
      onChainAgentId: '8798',
      registryContract: '0x8004a818bfb912233c491871b3d84c89a494bd9e',
      ownerWallet: '0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9',
      pulseState: 'available',
      pnlState: 'unknown',
    });
    const dbRow = candidateInputToDb(input);
    expect(dbRow.registry_provider).toBe('horizen');
    expect(dbRow.registry_network).toBe('base-sepolia');
    expect(dbRow.on_chain_agent_id).toBe('8798');
    expect(dbRow.owner_wallet).toBe('0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9');

    const roundTripped = dbToCandidate({ id: 'c1', name: 'Aigent Nakamoto', ...dbRow });
    expect(roundTripped.registryProvider).toBe('horizen');
    expect(roundTripped.registryNetwork).toBe('base-sepolia');
    expect(roundTripped.onChainAgentId).toBe('8798');
    expect(roundTripped.registryContract).toBe('0x8004a818bfb912233c491871b3d84c89a494bd9e');
    expect(roundTripped.ownerWallet).toBe('0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9');
    expect(roundTripped.pulseState).toBe('available');
    expect(roundTripped.pnlState).toBe('unknown');
  });

  it('a non-registry candidate round-trips with every registry field null, never a false-implying default', () => {
    const input = normalizeCandidateInput({ name: 'Plain A2A Candidate' });
    const dbRow = candidateInputToDb(input);
    expect(dbRow.registry_provider).toBeNull();
    expect(dbRow.pulse_state).toBeNull();

    const roundTripped = dbToCandidate({ id: 'c2', name: 'Plain A2A Candidate', ...dbRow });
    expect(roundTripped.registryProvider).toBeNull();
    expect(roundTripped.registryNetwork).toBeNull();
    expect(roundTripped.ownerWallet).toBeNull();
    expect(roundTripped.pulseState).toBeNull();
    expect(roundTripped.pnlState).toBeNull();
  });

  it('dbToCandidate never fabricates a registry provider from a garbage DB value', () => {
    const roundTripped = dbToCandidate({ id: 'c3', name: 'x', registry_provider: 'some-other-registry' });
    expect(roundTripped.registryProvider).toBeNull();
  });
});
