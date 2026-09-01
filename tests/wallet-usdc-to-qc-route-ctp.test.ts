/**
 * POST /api/wallet/qct/convert/usdc-to-qc — CTP Slice C (2026-09-01). The
 * route is now a thin web-channel adapter: it resolves the caller, then
 * dispatches through the REAL constitutionalRuntime.execute (not mocked —
 * exercised for real against a fake Supabase, mirroring tests/ocsga-
 * exchange-actions-route.test.ts's own convention) with `convertWalletAsset`/
 * `getWalletAssetBalance` mocked at the qctLedgerService boundary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { createFakeSupabase } from './_lib/fakeSupabase';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetWalletAssetBalance = vi.fn();
const mockConvertWalletAsset = vi.fn();
vi.mock('@/services/wallet/qctLedgerService', () => ({
  getWalletAssetBalance: (...args: unknown[]) => mockGetWalletAssetBalance(...args),
  convertWalletAsset: (...args: unknown[]) => mockConvertWalletAsset(...args),
}));

let fakeAdmin: unknown;
let fakeTables: Record<string, Array<Record<string, unknown>>>;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdmin,
}));

import '@/services/ctp/primitives/walletAssetConvert';
import { __resetRegistryForTests, registerPrimitive } from '@/services/ctp/registry';
import { walletAssetConvertPrimitive } from '@/services/ctp/primitives/walletAssetConvert';
import { POST } from '@/app/api/wallet/qct/convert/usdc-to-qc/route';

function requestWithBody(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function sufficientBalances() {
  mockGetWalletAssetBalance.mockImplementation(async (personaId: string, asset: string) => ({
    success: true,
    balance: { personaId, assetCode: asset, balance: asset === 'USDC' ? 1000 : 0, updatedAt: '2026-09-01T00:00:00Z' },
  }));
}

describe('POST /api/wallet/qct/convert/usdc-to-qc — CTP-mediated route', () => {
  beforeEach(() => {
    mockGetActivePersona.mockReset();
    mockGetWalletAssetBalance.mockReset();
    mockConvertWalletAsset.mockReset();
    const fake = createFakeSupabase();
    fakeAdmin = fake.admin;
    fakeTables = fake.tables as unknown as Record<string, Array<Record<string, unknown>>>;
    __resetRegistryForTests();
    registerPrimitive(walletAssetConvertPrimitive);
  });

  it('unauthenticated/cross-persona: no active persona resolved -> 401, the runtime is never invoked (no wallet mutation possible)', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(requestWithBody({ usdcAmount: 10 }));
    expect(res.status).toBe(401);
    expect(mockConvertWalletAsset).not.toHaveBeenCalled();
  });

  it('BCENT destination is refused before the runtime is invoked — Slice C scope is BASE_QC only', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', authProfileId: 'auth-1' });
    const res = await POST(requestWithBody({ usdcAmount: 10, destination: 'BCENT' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(mockConvertWalletAsset).not.toHaveBeenCalled();
  });

  it('unauthorized (insufficient funds, projected): refuses WITHOUT any wallet mutation, and the refusal carries a reasonCode', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', authProfileId: 'auth-1' });
    mockGetWalletAssetBalance.mockImplementation(async (personaId: string, asset: string) => ({
      success: true,
      balance: { personaId, assetCode: asset, balance: 1, updatedAt: '2026-09-01T00:00:00Z' },
    }));
    const res = await POST(requestWithBody({ usdcAmount: 10 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.refusalCode).toBe('INSUFFICIENT_FUNDS_PROJECTED');
    expect(mockConvertWalletAsset).not.toHaveBeenCalled();
  });

  it("a body-supplied personaId (e.g. someone else's) is never read — the wallet mutated is always the server-resolved caller's own", async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-caller-real-owner', authProfileId: 'auth-1' });
    sufficientBalances();
    mockConvertWalletAsset.mockResolvedValue({
      success: true,
      debitTxId: 'tx-debit-1',
      creditTxId: 'tx-credit-1',
      priorSourceBalance: 1000,
      resultingSourceBalance: 990,
      priorDestinationBalance: 0,
      resultingDestinationBalance: 990,
    });

    const res = await POST(requestWithBody({ personaId: 'persona-someone-elses-wallet', usdcAmount: 10 }));
    expect(res.status).toBe(200);
    expect(mockConvertWalletAsset).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: 'persona-caller-real-owner' }),
    );
    expect(mockGetWalletAssetBalance).toHaveBeenCalledWith('persona-caller-real-owner', expect.any(String));
    for (const call of mockGetWalletAssetBalance.mock.calls) {
      expect(call[0]).not.toBe('persona-someone-elses-wallet');
    }
  });

  it('success: reaches the canonical mutation ONLY through the runtime, returns committed balances, and writes ONE CTP SUCCESS receipt referencing the conversion/transaction ids', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', authProfileId: 'auth-1' });
    sufficientBalances();
    mockConvertWalletAsset.mockResolvedValue({
      success: true,
      debitTxId: 'tx-debit-1',
      creditTxId: 'tx-credit-1',
      priorSourceBalance: 1000,
      resultingSourceBalance: 990,
      priorDestinationBalance: 0,
      resultingDestinationBalance: 990,
    });

    const res = await POST(requestWithBody({ usdcAmount: 10 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.debited).toEqual({ asset: 'USDC', amount: 10, txId: 'tx-debit-1', newBalance: 990 });
    expect(json.credited).toEqual({ asset: 'BASE_QC', amount: 990, txId: 'tx-credit-1', newBalance: 990 });
    expect(json.conversionId).toMatch(/^usdc_to_qct_/);

    expect(mockConvertWalletAsset).toHaveBeenCalledTimes(1);

    // ONE CTP SUCCESS receipt was written, referencing the conversion/tx ids.
    const evidenceRows = fakeTables.ctp_transition_evidence;
    expect(evidenceRows.length).toBe(1);
    expect(evidenceRows[0].outcome).toBe('SUCCESS');
    const realized = evidenceRows[0].realized_consequence as Record<string, unknown> | null;
    expect(realized?.conversionId).toBe(json.conversionId);
    expect(realized?.debitTxId).toBe('tx-debit-1');
    expect(realized?.creditTxId).toBe('tx-credit-1');
  });

  it('a canonical implementation refusal (e.g. race-safe insufficient-funds under lock) produces CTP refusal evidence and touches NO wallet state', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', authProfileId: 'auth-1' });
    sufficientBalances();
    mockConvertWalletAsset.mockResolvedValue({ success: false, error: 'INSUFFICIENT_FUNDS: need 10 have 5 of USDC', insufficientFunds: true });

    const res = await POST(requestWithBody({ usdcAmount: 10 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.refusalCode).toBe('IMPLEMENTATION_REFUSED');

    const evidenceRows = fakeTables.ctp_transition_evidence;
    expect(evidenceRows.length).toBe(1);
    expect(evidenceRows[0].outcome).toBe('REFUSED');
  });
});
