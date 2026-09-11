/**
 * `ctp.wallet.asset.convert` — CTP Slice C (2026-09-01, delivery amendment
 * §3.3). Pins that this primitive REUSES the canonical
 * `convertWalletAsset`/`getWalletAssetBalance` (services/wallet/
 * qctLedgerService.ts) rather than mutating wallet state itself, is
 * principal-only (delegability: false — the durable delegation grant model
 * cannot yet express amount/asset-scoped conversion authority), and that
 * projection/authorization/execution map faithfully onto what the atomic
 * `convert_wallet_asset` Postgres function itself enforces.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetWalletAssetBalance = vi.fn();
const mockConvertWalletAsset = vi.fn();

vi.mock('@/services/wallet/qctLedgerService', () => ({
  getWalletAssetBalance: (...args: unknown[]) => mockGetWalletAssetBalance(...args),
  convertWalletAsset: (...args: unknown[]) => mockConvertWalletAsset(...args),
}));

import { walletAssetConvertPrimitive as primitive } from '@/services/ctp/primitives/walletAssetConvert';

const admin = {} as never;
const ctx = { channel: 'web' as const, channelSessionRef: null, callerPersonaId: 'persona-1', callerAuthProfileId: 'auth-1' };

beforeEach(() => {
  mockGetWalletAssetBalance.mockReset();
  mockConvertWalletAsset.mockReset();
});

describe('walletAssetConvertPrimitive — the registered contract', () => {
  it('is NOT delegable (Slice C scope: the delegation grant model cannot yet express amount/asset-scoped conversion authority)', () => {
    expect(primitive.delegability).toBe(false);
    expect(primitive.actorRequirement).toEqual(['AUTHORIZED_PRINCIPAL_IDENTITY']);
    expect(primitive.actorRequirement).not.toContain('AUTHORIZED_DELEGATE');
  });

  it('permits only web for this slice', () => {
    expect(primitive.permittedChannels).toEqual(['web']);
  });

  it('binds services/wallet/qctLedgerService.ts#convertWalletAsset — never a reimplementation', () => {
    expect(primitive.implementationRef).toBe('services/wallet/qctLedgerService.ts#convertWalletAsset');
  });
});

describe('resolveParticipants — always the authenticated caller\'s own wallet, never a body-supplied identity', () => {
  it('resolves subject/principal/actor as the SAME server-resolved caller persona, actorKind principal', async () => {
    const result = await primitive.resolveParticipants(admin, ctx, { usdcAmount: 10 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.participants).toEqual({
      subjectPersonaId: 'persona-1',
      principalPersonaId: 'persona-1',
      actorPersonaId: 'persona-1',
      actorKind: 'principal',
      delegateGrantRef: null,
    });
  });

  it('refuses when no caller persona is present', async () => {
    const anonCtx = { ...ctx, callerPersonaId: '' };
    const result = await primitive.resolveParticipants(admin, anonCtx, { usdcAmount: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reasonCode).toBe('NO_AUTHENTICATED_PERSONA');
  });
});

describe('readPriorState — reads BOTH balances via the existing getWalletAssetBalance, no direct DB access', () => {
  it('reads USDC and QCT balances for the resolved subject', async () => {
    mockGetWalletAssetBalance.mockImplementation(async (personaId: string, asset: string) => ({
      success: true,
      balance: { personaId, assetCode: asset, balance: asset === 'USDC' ? 100 : 5, updatedAt: '2026-09-01T00:00:00Z' },
    }));
    const participants = { subjectPersonaId: 'persona-1', principalPersonaId: 'persona-1', actorPersonaId: 'persona-1', actorKind: 'principal' as const, delegateGrantRef: null };
    const state = (await primitive.readPriorState(admin, participants, { usdcAmount: 10 })) as { usdcBalance: number; baseQcBalance: number };
    expect(state.usdcBalance).toBe(100);
    expect(state.baseQcBalance).toBe(5);
    expect(mockGetWalletAssetBalance).toHaveBeenCalledWith('persona-1', 'USDC');
    expect(mockGetWalletAssetBalance).toHaveBeenCalledWith('persona-1', 'QCT');
  });
});

describe('projectConsequence — pure, no mutation, uses the canonical quote formula', () => {
  it('projects the resulting USDC/BASE_QC balances from prior state + input, never calling any mutation function', () => {
    const projection = primitive.projectConsequence({ usdcBalance: 100, baseQcBalance: 0 }, { usdcAmount: 10 });
    expect(projection.effects.join(' ')).toContain('USDC prior 100 -> 90');
    expect(projection.effects.join(' ')).toContain('BASE_QC prior 0 -> 990'); // 10 * 100 * 0.99
    expect(mockConvertWalletAsset).not.toHaveBeenCalled();
  });
});

describe('authorize — refuses on projected insufficiency, retains the atomic function as final enforcement', () => {
  const participants = { subjectPersonaId: 'persona-1', principalPersonaId: 'persona-1', actorPersonaId: 'persona-1', actorKind: 'principal' as const, delegateGrantRef: null };

  it('refuses INSUFFICIENT_FUNDS_PROJECTED when priorState.usdcBalance < input.usdcAmount', () => {
    const result = primitive.authorize(participants, { result: 'VALID', basis: [] }, { usdcBalance: 5, baseQcBalance: 0 }, { effects: [] }, { usdcAmount: 10 });
    expect(result).toEqual({
      result: 'REFUSED',
      reasonCode: 'INSUFFICIENT_FUNDS_PROJECTED',
      reason: 'Projected USDC balance (5) is less than the requested conversion amount (10).',
    });
  });

  it('authorizes when projected balance is sufficient', () => {
    const result = primitive.authorize(participants, { result: 'VALID', basis: [] }, { usdcBalance: 100, baseQcBalance: 0 }, { effects: [] }, { usdcAmount: 10 });
    expect(result).toEqual({ result: 'AUTHORIZED' });
  });
});

describe('execute — binds ONLY convertWalletAsset, never a parallel mutation path', () => {
  const participants = { subjectPersonaId: 'persona-1', principalPersonaId: 'persona-1', actorPersonaId: 'persona-1', actorKind: 'principal' as const, delegateGrantRef: null };

  it('calls convertWalletAsset with USDC->QCT, the correct amounts, and threads through the committed result', async () => {
    mockConvertWalletAsset.mockResolvedValue({
      success: true,
      debitTxId: 'tx-debit-1',
      creditTxId: 'tx-credit-1',
      priorSourceBalance: 100,
      resultingSourceBalance: 90,
      priorDestinationBalance: 0,
      resultingDestinationBalance: 990,
    });

    const outcome = await primitive.execute(admin, participants, { usdcAmount: 10 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.result.conversionId).toMatch(/^usdc_to_qct_/);
    expect(outcome.result.debitTxId).toBe('tx-debit-1');
    expect(outcome.result.creditTxId).toBe('tx-credit-1');
    expect(outcome.result.resultingUsdcBalance).toBe(90);
    expect(outcome.result.resultingBaseQcBalance).toBe(990);

    expect(mockConvertWalletAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 'persona-1',
        sourceAsset: 'USDC',
        destinationAsset: 'QCT',
        sourceAmount: 10,
        destinationAmount: 990,
        source: 'usdc_to_qct_conversion',
      }),
    );
  });

  it("surfaces convertWalletAsset's own refusal (e.g. race-safe insufficient funds under lock) as ok:false, never throwing", async () => {
    mockConvertWalletAsset.mockResolvedValue({ success: false, error: 'INSUFFICIENT_FUNDS: need 10 have 5 of USDC', insufficientFunds: true });
    const outcome = await primitive.execute(admin, participants, { usdcAmount: 10 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.error).toContain('INSUFFICIENT_FUNDS');
  });

  it('resultingStateFrom and realizeConsequence derive from the COMMITTED result, never re-computed from arithmetic alone', () => {
    const result = {
      conversionId: 'usdc_to_qct_123_abc',
      debitTxId: 'tx-d',
      creditTxId: 'tx-c',
      priorUsdcBalance: 100,
      resultingUsdcBalance: 90,
      priorBaseQcBalance: 0,
      resultingBaseQcBalance: 990,
      debitedUsdc: 10,
      creditedBaseQc: 990,
      rate: 100,
      feePercent: 0.01,
      feeQct: 10,
    };
    expect(primitive.resultingStateFrom(result)).toEqual({ usdcBalance: 90, baseQcBalance: 990 });
    expect(primitive.realizeConsequence!(result)).toEqual({
      conversionId: 'usdc_to_qct_123_abc',
      debitTxId: 'tx-d',
      creditTxId: 'tx-c',
      debitedUsdc: 10,
      creditedBaseQc: 990,
      rate: 100,
      feePercent: 0.01,
      feeQct: 10,
    });
  });
});
