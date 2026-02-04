import { NextRequest, NextResponse } from 'next/server';
import { creditWalletAsset, debitWalletAsset } from '@/services/wallet/qctLedgerService';

export const runtime = 'nodejs';

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { personaId, usdcAmount } = body || {};

    if (!personaId || typeof personaId !== 'string') {
      return NextResponse.json({ ok: false, error: 'personaId required' }, { status: 400 });
    }

    const usdc = Number(usdcAmount);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      return NextResponse.json({ ok: false, error: 'usdcAmount must be a positive number' }, { status: 400 });
    }

    const rate = 100; // 1 USDC = 100 Q¢
    const feePercent = 0.01;

    const qctGross = usdc * rate;
    const feeQct = qctGross * feePercent;
    const qctNet = qctGross - feeQct;

    const conversionId = `usdc_to_qct_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const metadata = {
      conversionId,
      rate,
      feePercent,
      usdcAmount: round8(usdc),
      qctGross: round8(qctGross),
      feeQct: round8(feeQct),
      qctNet: round8(qctNet),
    };

    // Debit USDC first
    const debit = await debitWalletAsset(personaId, 'USDC', usdc, 'usdc_to_qct_conversion', metadata);
    if (!debit.success) {
      return NextResponse.json({ ok: false, error: debit.error }, { status: 400 });
    }

    // Credit QCT (Q¢)
    const credit = await creditWalletAsset(personaId, 'QCT', qctNet, 'usdc_to_qct_conversion', metadata);
    if (!credit.success) {
      // Attempt rollback
      await creditWalletAsset(personaId, 'USDC', usdc, 'usdc_to_qct_refund', {
        ...metadata,
        rollbackReason: credit.error || 'credit_failed',
      });

      return NextResponse.json({ ok: false, error: credit.error || 'Failed to credit QCT' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      conversionId,
      debited: {
        asset: 'USDC',
        amount: round8(usdc),
        txId: debit.txId,
        newBalance: debit.newBalance,
      },
      credited: {
        asset: 'QCT',
        amount: round8(qctNet),
        txId: credit.txId,
        newBalance: credit.newBalance,
      },
      quote: {
        rate,
        feePercent,
        qctGross: round8(qctGross),
        feeQct: round8(feeQct),
        qctNet: round8(qctNet),
      },
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[USDC→QCT] conversion error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
