/**
 * KNYT Stub Buy API
 * POST /api/wallet/knyt/buy-stub
 *
 * Handles the non-PayPal rails of the wallet's "Buy KNYT" flow:
 *   - rail: 'qc'   → Base Q¢ (no fee, stubbed — no Q¢ debit yet)
 *   - rail: 'usdc' → USDC (1% fee, stubbed — no on-chain debit yet)
 *
 * Both rails currently credit the persona's DVN KNYT balance immediately
 * with the package's flat knytAmount. The fee is recorded in transaction
 * metadata so when the real debit paths are wired (Q¢ ledger / USDC EVM
 * sweep), the rail-fee math doesn't have to change.
 *
 * The PayPal rail uses /api/wallet/knyt/paypal/{create-order,capture}
 * which already runs end-to-end live — keep that flow untouched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';
import {
  getKnytPackages,
  priceForRail,
  KNYT_BUY_RAIL_FEE_PERCENT,
  KnytBuyRail,
} from '@/services/wallet/knyt/knytPricingService';
import { getKnytBalance } from '@/services/wallet/knyt/knytLedgerService';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null);
}

export async function POST(request: NextRequest) {
  try {
    const { personaId, packageId, rail } = await request.json() as {
      personaId?: string;
      packageId?: string;
      rail?: KnytBuyRail;
    };

    if (!personaId || !packageId || !rail) {
      return NextResponse.json(
        { error: 'personaId, packageId and rail required' },
        { status: 400 }
      );
    }
    if (rail !== 'qc' && rail !== 'usdc') {
      return NextResponse.json(
        { error: `Unsupported rail "${rail}" — use the PayPal endpoint for PayPal purchases.` },
        { status: 400 }
      );
    }

    const pkg = getKnytPackages().find((p) => p.packageId === packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid packageId' }, { status: 400 });
    }

    const finalUsd = priceForRail(pkg.usdPrice, rail);
    const feePct = KNYT_BUY_RAIL_FEE_PERCENT[rail];
    const source = rail === 'qc' ? 'qc_purchase' : 'usdc_purchase';

    const credit = await creditKnyt(personaId, pkg.knytAmount, source, {
      packageId,
      rail,
      basePriceUsd: pkg.usdPrice,
      finalPriceUsd: finalUsd,
      feePct,
      stub: true,
    });

    if (!credit.success) {
      return NextResponse.json({ error: credit.error || 'Credit failed' }, { status: 500 });
    }

    const balance = await getKnytBalance(personaId);

    return NextResponse.json({
      success: true,
      knytAmount: pkg.knytAmount,
      newBalance: balance.balance?.dvnKnyt ?? credit.newBalance,
      transactionId: credit.transaction?.id,
      rail,
      finalPriceUsd: finalUsd,
      feePct,
      stub: true,
    });
  } catch (error) {
    console.error('[KNYT buy-stub] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
