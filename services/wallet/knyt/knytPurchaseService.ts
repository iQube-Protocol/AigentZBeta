/**
 * KNYT Purchase Service - Content purchases with KNYT or PayPal
 */

import { creditKnyt, debitKnyt, getKnytBalance } from './knytLedgerService';
import { getContentPricing, calculateKnytForUsd, ContentType } from './knytPricingService';
import { quoteSkuOffers } from './knytSkuQuoteService';
import { getSmartContentService } from '@/services/content';
import type { PricingKind } from '@/types/smartContent';

export interface PurchaseResult {
  success: boolean;
  entitlementId?: string;
  transactionId?: string;
  newKnytBalance?: number;
  error?: string;
}

export async function purchaseWithKnytSku(
  personaId: string,
  sku: string,
  tierKind: PricingKind
): Promise<PurchaseResult> {
  const quote = await quoteSkuOffers({ sku, personaId, tierKind });
  const selected = quote.selectedOffer;

  if (!selected) {
    return { success: false, error: `No offer found for tierKind: ${tierKind}` };
  }

  if (selected.quoteError) {
    return { success: false, error: selected.quoteError };
  }

  if (selected.knytTokens === undefined) {
    return { success: false, error: 'KNYT quote unavailable for selected offer' };
  }

  const balanceResult = await getKnytBalance(personaId);
  if ((balanceResult.balance?.dvnKnyt || 0) < selected.knytTokens) {
    return { success: false, error: `Insufficient KNYT. Need ${selected.knytTokens}` };
  }

  const debitResult = await debitKnyt(personaId, selected.knytTokens, 'content_purchase', {
    assetId: sku,
    tierKind,
    quote,
  });

  if (!debitResult.success) return { success: false, error: debitResult.error };

  const service = getSmartContentService();
  const entitlement = await service.grantEntitlement({
    contentId: sku,
    personaId,
    scope: 'full',
    acquiredVia: 'purchase',
  });

  return {
    success: true,
    entitlementId: entitlement.id,
    transactionId: debitResult.transaction?.id,
    newKnytBalance: debitResult.newBalance,
  };
}

/** Purchase content with KNYT */
export async function purchaseWithKnyt(
  personaId: string, contentId: string, contentType: ContentType, customPrice?: number
): Promise<PurchaseResult> {
  const pricing = getContentPricing(contentId, contentType, customPrice);
  const balanceResult = await getKnytBalance(personaId);
  
  if ((balanceResult.balance?.dvnKnyt || 0) < pricing.knytPrice) {
    return { success: false, error: `Insufficient KNYT. Need ${pricing.knytPrice}` };
  }
  
  const debitResult = await debitKnyt(personaId, pricing.knytPrice, 'content_purchase', {
    assetId: contentId, contentType, pricing,
  });
  
  if (!debitResult.success) return { success: false, error: debitResult.error };
  
  const entitlementId = `ent_${contentId}_${Date.now()}`;
  // TODO: Insert entitlement into Supabase
  
  return { success: true, entitlementId, transactionId: debitResult.transaction?.id, newKnytBalance: debitResult.newBalance };
}

/** Purchase content directly with PayPal (no KNYT) */
export async function purchaseWithPaypal(
  personaId: string, contentId: string, contentType: ContentType,
  paypalOrderId: string, paypalPayerId: string
): Promise<PurchaseResult> {
  const pricing = getContentPricing(contentId, contentType);
  // TODO: Verify PayPal payment via API
  const entitlementId = `ent_${contentId}_${Date.now()}`;
  return { success: true, entitlementId, transactionId: paypalOrderId };
}

/** Buy KNYT tokens with PayPal */
export async function purchaseKnytWithPaypal(
  personaId: string, usdAmount: number, paypalOrderId: string, bonusKnyt: number = 0
): Promise<PurchaseResult> {
  const { knytAmount } = calculateKnytForUsd(usdAmount);
  const totalKnyt = knytAmount + bonusKnyt;
  
  const creditResult = await creditKnyt(personaId, totalKnyt, 'paypal_purchase', {
    fiatAmount: usdAmount, fiatCurrency: 'USD', paypalTxId: paypalOrderId,
  });
  
  if (!creditResult.success) return { success: false, error: creditResult.error };
  return { success: true, transactionId: creditResult.transaction?.id, newKnytBalance: creditResult.newBalance };
}
