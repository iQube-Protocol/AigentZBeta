/**
 * PayPal Capture Order API
 * POST /api/wallet/knyt/paypal/capture
 *
 * Idempotent. Multiple polls (BuyKnytModal, KnytCartCheckoutModal) call this
 * route concurrently while the user is still in the PayPal popup. The naive
 * version called /capture every time, which races: the first call captures
 * + credits, the second hits PayPal's ORDER_ALREADY_CAPTURED error and the
 * frontend never sees a success. Worst case: the first call's response is
 * lost (Lambda timeout, network blip), so PayPal charged the user but the
 * persona's DVN KNYT was never credited.
 *
 * Idempotency strategy:
 *   1. Look up wallet_transactions for an existing 'paypal_purchase' row
 *      where metadata.paypalOrderId === orderId. If found, the order has
 *      already been credited — return success with the existing tx info.
 *   2. Otherwise call PayPal /capture. On COMPLETED, credit + return.
 *   3. On any non-COMPLETED status (especially ORDER_ALREADY_CAPTURED from
 *      a racing poll), GET the order from PayPal. If it shows COMPLETED,
 *      derive the credit from the order's custom_id and credit anyway —
 *      this recovers from "captured at PayPal but never credited in DVN."
 *   4. Final fallback: return 400 with the original error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder, getPayPalOrder } from '@/services/wallet/knyt/paypalService';
import { creditKnyt, getKnytBalance } from '@/services/wallet/knyt/knytLedgerService';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null);
}

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Look up an existing paypal_purchase tx by orderId. Returns the tx + the
 * persona's current KNYT balance so we can short-circuit the whole flow.
 */
async function findExistingCredit(orderId: string) {
  const sb = supabaseSr();
  const { data } = await sb
    .from('wallet_transactions')
    .select('id, persona_id, amount, metadata, created_at')
    .eq('source', 'paypal_purchase')
    .filter('metadata->>paypalOrderId', 'eq', orderId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    // 1) Idempotency: did we already credit this orderId?
    const existing = await findExistingCredit(orderId);
    if (existing) {
      const balance = await getKnytBalance(existing.persona_id);
      return NextResponse.json({
        success: true,
        knytAmount: Number(existing.amount),
        newBalance: balance.balance?.dvnKnyt ?? Number(existing.amount),
        transactionId: existing.id,
        idempotent: true,
      });
    }

    // 2) Try to capture
    const capture = await capturePayPalOrder(orderId);

    let resolved: { personaId: string; knytAmount: number; usdAmount: number; packageId?: string };

    if (capture.success) {
      resolved = {
        personaId: (capture as any).personaId,
        knytAmount: Number((capture as any).knytAmount || 0),
        usdAmount: Number((capture as any).usdAmount || 0),
        packageId: (capture as any).packageId,
      };
    } else {
      // 3) Capture failed. If a concurrent poll won the race the order is
      //    ALREADY_CAPTURED at PayPal — read it back and credit anyway.
      const recovered = await getPayPalOrder(orderId);
      if (!recovered.success) {
        return NextResponse.json(
          { error: capture.error || 'capture failed', issue: (capture as any).issue ?? null },
          { status: 400 },
        );
      }
      // Re-check idempotency in case a parallel poll committed between
      // our first lookup and now.
      const existingAfterRace = await findExistingCredit(orderId);
      if (existingAfterRace) {
        const balance = await getKnytBalance(existingAfterRace.persona_id);
        return NextResponse.json({
          success: true,
          knytAmount: Number(existingAfterRace.amount),
          newBalance: balance.balance?.dvnKnyt ?? Number(existingAfterRace.amount),
          transactionId: existingAfterRace.id,
          idempotent: true,
          recovered: true,
        });
      }
      resolved = {
        personaId: (recovered as any).personaId,
        knytAmount: Number((recovered as any).knytAmount || 0),
        usdAmount: Number((recovered as any).usdAmount || 0),
        packageId: (recovered as any).packageId,
      };
    }

    if (!resolved.personaId || resolved.knytAmount <= 0) {
      return NextResponse.json(
        { error: 'PayPal order missing persona/amount metadata' },
        { status: 500 },
      );
    }

    const credit = await creditKnyt(resolved.personaId, resolved.knytAmount, 'paypal_purchase', {
      fiatAmount: resolved.usdAmount,
      fiatCurrency: 'USD',
      paypalOrderId: orderId,
      packageId: resolved.packageId,
    });

    return NextResponse.json({
      success: true,
      knytAmount: resolved.knytAmount,
      newBalance: credit.newBalance,
      transactionId: credit.transaction?.id,
    });
  } catch (error) {
    console.error('[PayPal Capture] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
