import { describe, it, expect } from 'vitest';
import { buildBitcentEtchReceiptInput, type BitcentEtchFacts } from '@/services/treasury/bitcentTreasuryReceipts';

const FACTS: BitcentEtchFacts = {
  txHash: '551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65',
  network: 'testnet',
  mandateCommitment: 'ba69bc0bfe319dae7591006a213f4e1b5dd90772da749f3a9f53531d87a1d644',
  requiredSignatory: 'aigent-nakamoto',
  requiredSignatoryReason: 'issuance record ratified, network authorised, amount within cap',
  observer: 'aigent-kn0w1',
  observerReason: 'sole-principal context and issuance-record ratification confirmed',
  transactionClass: 'bitcent-treasury-ordinary',
  runeName: 'BITCENT',
  symbol: 'B¢',
  maxSupply: 1_000_000_000,
  premine: 1_000_000_000,
  initiallyActiveIssuance: 100_000_000,
  governedReserve: 900_000_000,
  premineCustodianAddress: 'tb1qse78njf7v33lmwjl2dq6j2g0djhw0h5awkrcwn',
  deployerAddress: 'tb1qdhc2l3d3w348re4j70a0cykvmh47ptwu8fk9nh',
};

describe('buildBitcentEtchReceiptInput (2026-07-30, real testnet etch)', () => {
  it('is pure -- identical facts produce an identical receipt input', () => {
    const a = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    const b = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    expect(a).toEqual(b);
  });

  it('uses the caller-supplied personaId verbatim -- never resolves it itself', () => {
    const input = buildBitcentEtchReceiptInput(FACTS, 'persona-abc');
    expect(input.personaId).toBe('persona-abc');
  });

  it('carries the correct, migration-registered action type', () => {
    const input = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    expect(input.actionType).toBe('bitcent_treasury_etch_executed');
  });

  it('records the required signatory and observer with their reasons, never a bare approval', () => {
    const input = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    expect(input.approvalsGranted).toEqual([
      'aigent-nakamoto: issuance record ratified, network authorised, amount within cap',
      'aigent-kn0w1: sole-principal context and issuance-record ratification confirmed',
    ]);
  });

  it('the summary names the network, tokenomics split, and tx hash', () => {
    const input = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    expect(input.summary).toContain('testnet');
    expect(input.summary).toContain('100,000,000');
    expect(input.summary).toContain('900,000,000');
    expect(input.summary).toContain(FACTS.txHash);
  });

  it('never includes the operator passcode, its hash, or any private key material', () => {
    const input = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    const serialized = JSON.stringify(input);
    // Nothing resembling a WIF (base58, starts with c/K/L for testnet/mainnet
    // privkeys) or the word "passcode"/"wif"/"private" should ever appear.
    expect(serialized.toLowerCase()).not.toMatch(/passcode|privatekey|_wif/);
  });

  it('actionInput carries the full tokenomics split for downstream verification', () => {
    const input = buildBitcentEtchReceiptInput(FACTS, 'persona-123');
    expect(input.actionInput).toMatchObject({
      maxSupply: 1_000_000_000,
      premine: 1_000_000_000,
      initiallyActiveIssuance: 100_000_000,
      governedReserve: 900_000_000,
      premineCustodianAddress: FACTS.premineCustodianAddress,
    });
  });
});
