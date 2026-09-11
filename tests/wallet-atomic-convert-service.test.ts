/**
 * convertWalletAsset (services/wallet/qctLedgerService.ts) — CTP Slice C
 * Part B: proves the service layer calls the ONE atomic Postgres function
 * (`convert_wallet_asset`) exactly once per conversion, never a separate
 * debit+credit composition, and maps the function's own SQLSTATE/message
 * discriminator (INSUFFICIENT_FUNDS) to a distinguishable refusal.
 *
 * TRUE concurrency (two competing conversions racing the same source
 * balance) requires a live Postgres instance to actually exercise the
 * `SELECT ... FOR UPDATE` row lock in
 * supabase/migrations/20260930150000_wallet_atomic_convert.sql — that lock
 * is what the atomicity guarantee actually rests on, and no amount of
 * mocking here can substitute for exercising it for real. This file proves
 * the JS layer's contract (single RPC call, correct params, correct error
 * mapping); the migration's own header documents the locking design, and a
 * live-DB concurrency run is a separate, operator-executed verification
 * step (see the session's final report for the exact script).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: (...args: unknown[]) => mockRpc(...args), from: (...args: unknown[]) => mockFrom(...args) }),
}));

import { convertWalletAsset } from '@/services/wallet/qctLedgerService';

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('convertWalletAsset — calls the atomic RPC exactly once, never a separate debit/credit', () => {
  it('calls supabase.rpc("convert_wallet_asset", ...) exactly once with the exact params, never .from("wallet_balances")/.from("wallet_transactions") directly', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        debit_tx_id: 'tx-d',
        credit_tx_id: 'tx-c',
        prior_source_balance: '100',
        resulting_source_balance: '90',
        prior_destination_balance: '0',
        resulting_destination_balance: '990',
      }],
      error: null,
    });

    const result = await convertWalletAsset({
      personaId: 'persona-1',
      sourceAsset: 'USDC',
      destinationAsset: 'QCT',
      sourceAmount: 10,
      destinationAmount: 990,
      source: 'usdc_to_qct_conversion',
      metadata: { conversionId: 'usdc_to_qct_1' },
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('convert_wallet_asset', expect.objectContaining({
      p_persona_id: 'persona-1',
      p_source_asset: 'USDC',
      p_destination_asset: 'QCT',
      p_source_amount: 10,
      p_destination_amount: 990,
      p_source: 'usdc_to_qct_conversion',
    }));
    expect(mockFrom).not.toHaveBeenCalled();

    expect(result).toEqual({
      success: true,
      debitTxId: 'tx-d',
      creditTxId: 'tx-c',
      priorSourceBalance: 100,
      resultingSourceBalance: 90,
      priorDestinationBalance: 0,
      resultingDestinationBalance: 990,
    });
  });

  it('translates an INSUFFICIENT_FUNDS RPC error into a distinguishable refusal, never a generic 500-shaped failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_FUNDS: need 10 have 5 of USDC' } });
    const result = await convertWalletAsset({
      personaId: 'persona-1',
      sourceAsset: 'USDC',
      destinationAsset: 'QCT',
      sourceAmount: 10,
      destinationAmount: 990,
      source: 'usdc_to_qct_conversion',
    });
    expect(result.success).toBe(false);
    expect(result.insufficientFunds).toBe(true);
    expect(result.error).toContain('INSUFFICIENT_FUNDS');
  });

  it('surfaces any other RPC error honestly, without insufficientFunds set', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    const result = await convertWalletAsset({
      personaId: 'persona-1',
      sourceAsset: 'USDC',
      destinationAsset: 'QCT',
      sourceAmount: 10,
      destinationAmount: 990,
      source: 'usdc_to_qct_conversion',
    });
    expect(result.success).toBe(false);
    expect(result.insufficientFunds).toBeUndefined();
    expect(result.error).toBe('connection reset');
  });

  it('refuses non-positive amounts before ever calling the RPC', async () => {
    const result = await convertWalletAsset({
      personaId: 'persona-1',
      sourceAsset: 'USDC',
      destinationAsset: 'QCT',
      sourceAmount: 0,
      destinationAmount: 990,
      source: 'usdc_to_qct_conversion',
    });
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
