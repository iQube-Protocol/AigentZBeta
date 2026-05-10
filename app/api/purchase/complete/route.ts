/**
 * API Route: Complete Purchase
 * POST /api/purchase/complete
 *
 * Spine-conformant. Per the KNYT rep/rewards/tasks decisions doc §1, the
 * persona is resolved server-side via `getActivePersona(request)` — the
 * route NEVER trusts a `personaId` field from the request body (that
 * was a T0 leak: any client could mint entitlements for any persona by
 * spoofing the field).
 *
 * After the existing purchaseHandler debits + grants the entitlement,
 * the route calls `evaluateAccess(persona, descriptor, 'payment-settle')`
 * for the freshly-granted asset. The spine returns `allow=true reason='owned'`
 * (post-grant the persona owns it) and emits a sync receipt anchoring the
 * post-purchase state via T2 alias commitment + cohort_id. The decision
 * itself is discarded — the user already has access; we want the spine's
 * receipt side-effect.
 *
 * Bundle purchases that grant multiple assets emit one receipt for the
 * primary asset (assetIds[0]). Future iteration could fan out per-asset
 * receipts; for v1 the bundle id is the canonical receipt anchor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseHandler } from '@/services/rewards/purchaseHandler';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getContentDescriptor } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';

export async function POST(request: NextRequest) {
  try {
    // 1. Spine-mediated identity. Replaces body.personaId.
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[Purchase API] Received body:', JSON.stringify(body, null, 2));

    const { productType, paymentRail, assetIds, paymentReference, metadata } = body;

    console.log('[Purchase API] Extracted params:', {
      personaId: persona.personaId,
      productType,
      paymentRail,
    });

    // TEST MODE: Allow purchases without payment verification in development
    const isTestMode = process.env.NODE_ENV === 'development' || process.env.ENABLE_TEST_PURCHASES === 'true';
    if (isTestMode) {
      console.log('[Purchase API] TEST MODE: Bypassing payment verification');
    }

    if (!productType || !paymentRail) {
      console.log('[Purchase API] Missing required params:', {
        hasProductType: !!productType,
        hasPaymentRail: !!paymentRail,
      });
      return NextResponse.json({
        error: 'productType and paymentRail are required',
      }, { status: 400 });
    }

    if (!['qc', 'knyt', 'knyt_evm', 'usdc', 'paypal'].includes(paymentRail)) {
      return NextResponse.json({
        error: 'paymentRail must be qc, knyt, knyt_evm, usdc, or paypal',
      }, { status: 400 });
    }

    const purchaseHandler = getPurchaseHandler();
    console.log('[Purchase API] Calling processPurchase with:', {
      personaId: persona.personaId,
      productType,
      paymentRail,
      assetIds,
    });

    const result = await purchaseHandler.processPurchase({
      personaId: persona.personaId,
      productType,
      paymentRail,
      assetIds,
      paymentReference,
      metadata,
    });

    console.log('[Purchase API] Purchase result:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('[Purchase API] Purchase failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 2. Spine receipt. Anchor the post-purchase state via T2 alias
    //    commitment. Best-effort — failure here doesn't undo the
    //    successful purchase; we log and move on.
    try {
      const primaryAssetId = (assetIds && assetIds[0]) || null;
      if (primaryAssetId) {
        const descriptor = await getContentDescriptor(primaryAssetId);
        if (descriptor) {
          // 'payment-settle' is in TX_CLASS_ACTIONS; spine emits a sync
          // receipt with T2 attribution. Decision is discarded — the
          // entitlement already exists, so the spine returns
          // allow=true reason='owned'.
          await evaluateAccess(persona, descriptor, 'payment-settle');
        } else {
          console.warn('[Purchase API] No descriptor for asset; skipping spine receipt:', primaryAssetId);
        }
      }
    } catch (receiptErr) {
      // Receipt emission failure is non-fatal. The purchase is committed
      // and the buyer has access. The receipt anchoring can be replayed
      // later if needed (decisions doc §10 smoke-test gate covers the
      // verify path).
      console.error('[Purchase API] Spine receipt emission failed (non-fatal):', receiptErr);
    }

    return NextResponse.json({
      success: true,
      purchaseId: result.purchaseId,
      entitlementsGranted: result.entitlementsGranted,
      rewardsTriggered: result.rewardsTriggered,
    });
  } catch (error) {
    console.error('[API] Error processing purchase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
