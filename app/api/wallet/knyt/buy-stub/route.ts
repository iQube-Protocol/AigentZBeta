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
  getKnytUsdPrice,
  priceForRail,
  KNYT_BUY_RAIL_FEE_PERCENT,
  KnytBuyRail,
} from '@/services/wallet/knyt/knytPricingService';
import { getKnytBalance } from '@/services/wallet/knyt/knytLedgerService';

export const runtime = 'nodejs';

const MIN_CUSTOM_KNYT = 10;

export async function OPTIONS() {
  return new NextResponse(null);
}

export async function POST(request: NextRequest) {
  try {
    const { personaId, packageId, rail, customKnytAmount } = await request.json() as {
      personaId?: string;
      packageId?: string;
      rail?: KnytBuyRail;
      customKnytAmount?: number;
    };

    if (!personaId || !rail) {
      return NextResponse.json(
        { error: 'personaId and rail required' },
        { status: 400 }
      );
    }
    if (rail !== 'qc' && rail !== 'usdc') {
      return NextResponse.json(
        { error: `Unsupported rail "${rail}" — use the PayPal endpoint for PayPal purchases.` },
        { status: 400 }
      );
    }

    // Resolve the purchase: either a preset package or a custom amount.
    // Custom amount uses the live USD-per-KNYT rate so price parity holds
    // with the GET /purchase response the modal already consumed.
    let knytAmount: number;
    let basePriceUsd: number;
    let resolvedPackageId: string;

    if (typeof customKnytAmount === 'number' && customKnytAmount > 0) {
      if (customKnytAmount < MIN_CUSTOM_KNYT) {
        return NextResponse.json(
          { error: `Minimum custom amount is ${MIN_CUSTOM_KNYT} KNYT` },
          { status: 400 }
        );
      }
      knytAmount = Math.floor(customKnytAmount);
      const usdPerKnyt = await getKnytUsdPrice();
      basePriceUsd = Math.round(knytAmount * usdPerKnyt * 100) / 100;
      resolvedPackageId = `knyt_custom_${knytAmount}`;
    } else if (packageId) {
      const pkg = getKnytPackages().find((p) => p.packageId === packageId);
      if (!pkg) {
        return NextResponse.json({ error: 'Invalid packageId' }, { status: 400 });
      }
      knytAmount = pkg.knytAmount;
      basePriceUsd = pkg.usdPrice;
      resolvedPackageId = pkg.packageId;
    } else {
      return NextResponse.json(
        { error: 'Either packageId or customKnytAmount required' },
        { status: 400 }
      );
    }

    const finalUsd = priceForRail(basePriceUsd, rail);
    const feePct = KNYT_BUY_RAIL_FEE_PERCENT[rail];
    const source = rail === 'qc' ? 'qc_purchase' : 'usdc_purchase';

    const credit = await creditKnyt(personaId, knytAmount, source, {
      packageId: resolvedPackageId,
      rail,
      basePriceUsd,
      finalPriceUsd: finalUsd,
      feePct,
      stub: true,
      custom: resolvedPackageId.startsWith('knyt_custom_'),
    });

    if (!credit.success) {
      return NextResponse.json({ error: credit.error || 'Credit failed' }, { status: 500 });
    }

    const balance = await getKnytBalance(personaId);

    return NextResponse.json({
      success: true,
      knytAmount,
      newBalance: balance.balance?.dvnKnyt ?? credit.newBalance,
      transactionId: credit.transaction?.id,
      rail,
      basePriceUsd,
      finalPriceUsd: finalUsd,
      feePct,
      stub: true,
      packageId: resolvedPackageId,
    });
  } catch (error) {
    console.error('[KNYT buy-stub] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
