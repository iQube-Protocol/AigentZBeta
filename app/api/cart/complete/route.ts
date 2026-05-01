/**
 * POST /api/cart/complete
 *
 * Multi-line cart settlement. Loops processPurchase() per line for the
 * selected payment rail and returns per-line results. Each successful line
 * gets its own purchase record and entitlement; per-line failures don't
 * block subsequent lines.
 *
 * Phase 2b scope: KNYT / Q¢ / USDC rails. PayPal deferred to Phase 2c
 * (needs a single bundled order via /cart/paypal/{create-order,capture}
 * so the user only authorises once).
 *
 * Body:
 *   {
 *     personaId: string,                     // required (signed-in only)
 *     paymentRail: 'knyt' | 'qcents' | 'usdc',
 *     lines: [{
 *       id: string,                          // contentId / assetId for entitlement
 *       contentType: CartContentType,        // required — maps to productType
 *       priceUsd: number,                    // base USD per unit
 *       qty?: number,                        // default 1
 *       label?: string,                      // for metadata + audit
 *       thumbUrl?: string,                   // for metadata
 *     }, ...],
 *     paymentReference?: string,             // optional (e.g. tx hash for USDC)
 *     metadata?: Record<string, unknown>,
 *   }
 *
 * Returns:
 *   {
 *     ok: boolean,
 *     cartPurchaseId: string,                // shared across all line purchases
 *     totalLines: number,
 *     totalSettled: number,
 *     totalFailed: number,
 *     results: [{ lineIndex, id, success, purchaseId?, error? }, ...],
 *   }
 *
 * Atomicity note: this is loop-per-line, not a single DB transaction.
 * Phase 2.5 can wrap in a Supabase transaction with rollback. For v1, on
 * partial failure the user sees "X of N items purchased" and unsettled
 * lines remain in cart for retry.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PurchaseHandler } from '@/services/rewards/purchaseHandler';
import { cartContentTypeToProductType, type CartItem } from '@/types/knyt-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface CompleteLineInput {
  id: string;
  contentType?: NonNullable<CartItem['contentType']>;
  priceUsd: number;
  qty?: number;
  label?: string;
  thumbUrl?: string;
}

interface CompleteRequest {
  personaId: string;
  paymentRail: 'knyt' | 'knyt_evm' | 'qcents' | 'usdc';
  lines: CompleteLineInput[];
  paymentReference?: string;
  metadata?: Record<string, unknown>;
}

interface LineResult {
  lineIndex: number;
  id: string;
  success: boolean;
  purchaseId?: string;
  error?: string;
}

function clampQty(qty: number | undefined): number {
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 1) return 1;
  return Math.floor(qty);
}

export async function POST(req: NextRequest) {
  let body: CompleteRequest;
  try {
    body = (await req.json()) as CompleteRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.personaId) {
    return NextResponse.json({ ok: false, error: 'personaId required' }, { status: 400 });
  }
  if (!body.paymentRail || !['knyt', 'knyt_evm', 'qcents', 'usdc'].includes(body.paymentRail)) {
    return NextResponse.json(
      { ok: false, error: 'paymentRail must be knyt, knyt_evm, qcents, or usdc (paypal is handled by /api/cart/paypal/*)' },
      { status: 400 },
    );
  }
  if (body.paymentRail === 'knyt_evm' && (!body.paymentReference || !/^0x[0-9a-fA-F]{64}$/.test(body.paymentReference))) {
    return NextResponse.json({ ok: false, error: 'knyt_evm rail requires a valid EVM transaction hash as paymentReference' }, { status: 400 });
  }
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: 'lines array required and non-empty' }, { status: 400 });
  }

  // Map cart's rail names to processPurchase's rail names. processPurchase
  // uses 'qc' where the cart UI uses 'qcents'.
  const railMap: Record<CompleteRequest['paymentRail'], 'knyt' | 'knyt_evm' | 'qc' | 'usdc'> = {
    knyt:     'knyt',
    knyt_evm: 'knyt_evm',
    qcents:   'qc',
    usdc:     'usdc',
  };
  const rail = railMap[body.paymentRail];

  // Stable cart-purchase id — stamped on every per-line purchase row's
  // metadata so the history view can group lines back together.
  const cartPurchaseId = (globalThis.crypto?.randomUUID?.() ??
    `cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

  let handler: InstanceType<typeof PurchaseHandler>;
  try {
    handler = new PurchaseHandler();
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : 'Service initialization failed';
    console.error('[cart/complete] PurchaseHandler init failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  const results: LineResult[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const qty = clampQty(line.qty);

    if (!line.contentType) {
      results.push({ lineIndex: i, id: line.id, success: false, error: 'line missing contentType' });
      continue;
    }
    const productType = cartContentTypeToProductType(line.contentType);
    if (!productType) {
      results.push({ lineIndex: i, id: line.id, success: false, error: `unknown contentType: ${line.contentType}` });
      continue;
    }

    // Settle each unit of qty individually — keeps the entitlement model
    // simple (one purchase row per unit) and matches the existing
    // single-item flow's semantics.
    for (let q = 0; q < qty; q += 1) {
      try {
        const result = await handler.processPurchase({
          personaId: body.personaId,
          productType,
          paymentRail: rail,
          assetIds: line.id ? [line.id] : [],
          paymentReference: body.paymentReference,
          metadata: {
            ...(body.metadata ?? {}),
            cartPurchaseId,
            cartLineIndex: i,
            cartLineQtyIndex: q,
            cartLineQty: qty,
            label: line.label,
            thumbUrl: line.thumbUrl,
            unitPriceUsd: line.priceUsd,
          },
        });

        if (result.success) {
          results.push({
            lineIndex: i,
            id: line.id,
            success: true,
            purchaseId: result.purchaseId,
          });
        } else {
          results.push({
            lineIndex: i,
            id: line.id,
            success: false,
            error: result.error ?? 'processPurchase failed',
          });
          // If KNYT/Q¢ insufficient on first failure, abort — subsequent
          // calls would just rack up the same error.
          if (result.error && /insufficient/i.test(result.error)) {
            // Add stub failures for remaining unprocessed line-units to keep
            // results array aligned with input qty intent.
            for (let qRest = q + 1; qRest < qty; qRest += 1) {
              results.push({
                lineIndex: i,
                id: line.id,
                success: false,
                error: 'aborted — insufficient balance from earlier line',
              });
            }
            // Also short-circuit remaining lines for the same reason.
            for (let iRest = i + 1; iRest < lines.length; iRest += 1) {
              const restQty = clampQty(lines[iRest].qty);
              for (let qrr = 0; qrr < restQty; qrr += 1) {
                results.push({
                  lineIndex: iRest,
                  id: lines[iRest].id,
                  success: false,
                  error: 'aborted — insufficient balance from earlier line',
                });
              }
            }
            const totalSettled = results.filter((r) => r.success).length;
            const totalFailed = results.length - totalSettled;
            return NextResponse.json({
              ok: false,
              cartPurchaseId,
              totalLines: lines.length,
              totalSettled,
              totalFailed,
              results,
            });
          }
        }
      } catch (err) {
        results.push({
          lineIndex: i,
          id: line.id,
          success: false,
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }
  }

  const totalSettled = results.filter((r) => r.success).length;
  const totalFailed = results.length - totalSettled;

  return NextResponse.json({
    ok: totalFailed === 0,
    cartPurchaseId,
    totalLines: lines.length,
    totalSettled,
    totalFailed,
    results,
  });
}
