/**
 * Purchase Handler - Phase 1 KNYT Codex / KNYTMall
 * 
 * Handles purchase completion across all payment rails (Q¢, KNYT, USDC, PayPal).
 * On successful purchase:
 * 1. Creates purchase record
 * 2. Grants entitlements based on product
 * 3. Triggers Bring-a-Knight rewards for referrals
 * 4. Updates wallet transactions
 */

import { createClient } from '@supabase/supabase-js';
import { getRewardService, RewardTaskType } from './rewardService';
import { emitCampaignEvent } from '@/services/campaign/campaignService';
import { getEntitlementService } from './entitlementService';
import { getMultiRailPricing, PaymentRail, ContentType } from '../wallet/knyt/knytPricingService';

// =============================================================================
// TYPES
// =============================================================================

/** Purchase request */
export interface PurchaseRequest {
  personaId: string;
  productType: string;
  paymentRail: PaymentRail;
  /** Asset IDs to grant (for singles) or will be looked up from product */
  assetIds?: string[];
  /** Payment reference (PayPal order ID, etc.) */
  paymentReference?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/** Purchase result */
export interface PurchaseResult {
  success: boolean;
  purchaseId?: string;
  entitlementsGranted?: number;
  rewardsTriggered?: string[];
  error?: string;
}

/** Purchase record */
export interface Purchase {
  id: string;
  personaId: string;
  productId: string | null;
  productType: string;
  paymentRail: PaymentRail;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentReference: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  completedAt: string | null;
}

// =============================================================================
// PURCHASE HANDLER CLASS
// =============================================================================

export class PurchaseHandler {
  private supabase;
  
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * Process a completed purchase
   */
  async processPurchase(req: PurchaseRequest): Promise<PurchaseResult> {
    const { personaId, productType, paymentRail, assetIds, paymentReference, metadata } = req;
    const rewardsTriggered: string[] = [];
    
    try {
      // 1. Get product and pricing
      const entitlementService = getEntitlementService();
      const product = await entitlementService.getProduct(productType);
      
      if (!product) {
        return { success: false, error: `Product not found: ${productType}` };
      }
      
      // Get pricing for the payment rail
      const pricing = getMultiRailPricing('purchase', productType as ContentType);
      const railPricing = pricing.rails[paymentRail];
      
      // 2. Guard: require sufficient KNYT balance for KNYT rail
      if (paymentRail === 'knyt') {
        const { data: balanceRow, error: balanceError } = await this.supabase
          .from('wallet_balances')
          .select('balance')
          .eq('persona_id', personaId)
          .eq('asset_code', 'KNYT')
          .maybeSingle();

        if (balanceError) {
          console.error('[PurchaseHandler] Failed to fetch KNYT balance:', balanceError);
          return { success: false, error: 'Unable to verify KNYT balance' };
        }

        const currentBalance = balanceRow?.balance ? parseFloat(balanceRow.balance) : 0;
        if (currentBalance < railPricing.price) {
          return { success: false, error: 'Insufficient KNYT balance' };
        }
      }

      // 3. Create purchase record
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .insert({
          persona_id: personaId,
          product_id: product.id,
          product_type: productType,
          payment_rail: paymentRail,
          amount: railPricing.price,
          currency: railPricing.currency,
          status: 'completed',
          payment_reference: paymentReference,
          metadata: metadata || {},
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (purchaseError) {
        console.error('[PurchaseHandler] Failed to create purchase:', purchaseError);
        return { success: false, error: 'Failed to create purchase record' };
      }
      
      // 3. Record wallet transaction (for KNYT/Q¢ payments)
      if (paymentRail === 'knyt' || paymentRail === 'qc') {
        await this.recordWalletTransaction(personaId, purchase.id, railPricing.price, railPricing.currency, productType);
      }
      
      // 4. Grant entitlements
      // For Motion purchases, grant the motion master asset (no clip expansion - clips are part of the master)
      let assetsToGrant = assetIds && assetIds.length > 0 ? assetIds : product.assetIds;
      
      // Motion purchases grant access to the motion master which includes all clips
      // No need to expand - the motion master asset contains all clips
      if (metadata?.includesAllClips) {
        console.log('[PurchaseHandler] Motion purchase - granting motion master with all clips access');
      }
      
      let entitlementsGranted = 0;
      
      if (assetsToGrant.length > 0) {
        const result = await entitlementService.grantBundleEntitlements(
          personaId,
          assetsToGrant,
          purchase.id,
          { productType, paymentRail }
        );
        entitlementsGranted = result.granted;
      } else {
        // For singles without predefined asset IDs, grant based on product type
        const result = await entitlementService.grantEntitlement({
          personaId,
          assetId: `${productType}:${purchase.id}`, // Generate asset ID from purchase
          sourcePurchaseId: purchase.id,
          metadata: { productType, paymentRail },
        });
        if (result.success) entitlementsGranted = 1;
      }
      
      // 5. Check for first paid purchase (Bring a Knight)
      const isFirstPurchase = await this.checkFirstPaidPurchase(personaId, purchase.id);
      
      if (isFirstPurchase) {
        // Mark first purchase
        const firstPurchaseAt = new Date().toISOString();
        await this.supabase
          .from('personas')
          .update({ first_paid_purchase_at: firstPurchaseAt })
          .eq('id', personaId);
        await this.supabase
          .from('persona')
          .update({ first_paid_purchase_at: firstPurchaseAt })
          .eq('id', personaId);
        
        // Trigger Bring a Knight rewards
        const referralRewards = await this.triggerBringAKnightRewards(personaId, purchase.id);
        rewardsTriggered.push(...referralRewards);
      }
      
      // 6. Emit reputation event
      await this.emitReputationEvent(personaId, 'purchase_completed', {
        purchaseId: purchase.id,
        productType,
        paymentRail,
        amount: railPricing.price,
        currency: railPricing.currency,
        isFirstPurchase,
      });
      
      return {
        success: true,
        purchaseId: purchase.id,
        entitlementsGranted,
        rewardsTriggered,
      };
    } catch (err) {
      console.error('[PurchaseHandler] Error processing purchase:', err);
      return { success: false, error: (err as Error).message };
    }
  }
  
  /**
   * Check if this is the persona's first paid purchase
   */
  private async checkFirstPaidPurchase(personaId: string, currentPurchaseId: string): Promise<boolean> {
    const firstPaidAt = await this.getFirstPaidPurchaseAt(personaId);
    if (firstPaidAt) {
      return false;
    }
    
    // Check if there are any other completed purchases
    const { count } = await this.supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .eq('status', 'completed')
      .neq('id', currentPurchaseId);
    
    return (count || 0) === 0;
  }

  private async getFirstPaidPurchaseAt(personaId: string): Promise<string | null> {
    const tables = ['persona', 'personas'] as const;
    const isMissingColumn = (error?: { message?: string }) =>
      !!error?.message && error.message.includes('column') && error.message.includes('does not exist');
    const isMissingTable = (error?: { message?: string }) =>
      !!error?.message && error.message.includes('relation') && error.message.includes('does not exist');

    for (const table of tables) {
      const { data, error } = await this.supabase
        .from(table)
        .select('first_paid_purchase_at')
        .eq('id', personaId)
        .maybeSingle();

      if (data?.first_paid_purchase_at) {
        return data.first_paid_purchase_at as string;
      }

      if (error && !isMissingColumn(error) && !isMissingTable(error)) {
        console.warn('[PurchaseHandler] First purchase lookup error:', error.message);
        return null;
      }
    }

    return null;
  }
  
  /**
   * Trigger Bring a Knight rewards for referrer and new user
   */
  private async triggerBringAKnightRewards(personaId: string, purchaseId: string): Promise<string[]> {
    const rewardService = getRewardService();
    const triggered: string[] = [];
    
    const persona = await this.findPersonaWithReferrer(personaId);
    if (!persona) return triggered;

    const referrerId = persona.referred_by_persona_id || persona.referrer_persona_id;
    
    // Grant referrer reward if exists (2 KNYT base)
      if (referrerId) {
        // Create referral event for first purchase
        await this.supabase
          .from('referral_events')
          .insert({
            referrer_persona_id: referrerId,
          referee_persona_id: personaId,
          event_type: 'first_purchase',
          reward_amount: 2.0,
          metadata: { purchaseId }
        });

      await emitCampaignEvent({
        campaignId: 'bring-a-knight',
        eventType: 'referral_first_purchase',
        personaId: referrerId,
        referrerPersonaId: referrerId,
        source: 'purchase_handler',
        metadata: {
          refereePersonaId: personaId,
          purchaseId,
        },
      });

        const referrerResult = await rewardService.grantRewardForTask({
          personaId: referrerId,
          taskType: RewardTaskType.BringAKnightQualifiedReferral,
          sourceEventId: purchaseId,
          customBaseAmount: 2.0, // Referrer gets 2 KNYT
          metadata: { 
            isReferrerReward: true, 
            referredPersonaId: personaId,
            purchaseId
          },
        });
      
        if (referrerResult.success) {
          triggered.push(`referrer:${referrerResult.rewardGrantId}`);
        } else {
          console.warn('[PurchaseHandler] Referrer reward failed:', referrerResult.error);
        }

        await emitCampaignEvent({
          campaignId: 'qriptopian-share',
          eventType: 'content_share_conversion',
          personaId: referrerId,
          source: 'purchase_handler',
          metadata: {
            refereePersonaId: personaId,
            purchaseId,
          },
        });
      }
    
    // Grant welcome reward to new user (1 KNYT as discount on this purchase)
    const welcomeResult = await rewardService.grantRewardForTask({
      personaId,
      taskType: RewardTaskType.BringAKnightQualifiedReferral,
      sourceEventId: purchaseId,
      customBaseAmount: 1.0, // New user gets 1 KNYT discount
      metadata: { isWelcomeDiscount: true, purchaseId },
    });
    
    if (welcomeResult.success) {
      triggered.push(`welcome:${welcomeResult.rewardGrantId}`);
    }
    
    return triggered;
  }
  
  /**
   * Record wallet transaction for KNYT/Q¢ payments
   * 
   * Note: For Tier 0, this deducts from DVN ledger balance (wallet_balances table).
   * On-chain EVM KNYT balance is separate and requires bridging (Phase 2).
   */
  private async recordWalletTransaction(
    personaId: string,
    purchaseId: string,
    amount: number,
    currency: string,
    productType: string
  ): Promise<void> {
    console.log('[PurchaseHandler] Recording wallet transaction:', {
      personaId,
      purchaseId,
      amount,
      currency,
      productType,
    });

    // Record transaction in wallet_transactions table
    const { error: txError } = await this.supabase
      .from('wallet_transactions')
      .insert({
        persona_id: personaId,
        asset: currency,
        amount: -amount, // Negative for debit
        direction: 'debit',
        source: 'purchase',
        reference_type: 'purchase',
        reference_id: purchaseId,
        metadata: { productType },
      });
    
    if (txError) {
      console.log('[PurchaseHandler] wallet_transactions insert error (table may not exist):', txError.message);
    }
    
    // Update DVN ledger balance (debit for purchase)
    // Uses correct schema: balance column with asset_code='KNYT'
    if (currency === 'KNYT') {
      const { data: existing, error: fetchError } = await this.supabase
        .from('wallet_balances')
        .select('id, balance')
        .eq('persona_id', personaId)
        .eq('asset_code', 'KNYT')
        .single();
      
      console.log('[PurchaseHandler] DVN balance lookup:', {
        found: !!existing,
        currentBalance: existing?.balance,
        error: fetchError?.message,
      });
      
      if (existing) {
        const currentBalance = parseFloat(existing.balance) || 0;
        const newBalance = currentBalance - amount;
        
        console.log('[PurchaseHandler] Deducting from DVN balance:', {
          currentBalance,
          deductAmount: amount,
          newBalance,
        });
        
        await this.supabase
          .from('wallet_balances')
          .update({ 
            balance: newBalance.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // No DVN balance record exists - create one with negative balance
        // This indicates the persona owes KNYT (credit purchase against future earnings/deposits)
        console.log('[PurchaseHandler] No DVN balance found, creating record with negative balance');
        
        await this.supabase
          .from('wallet_balances')
          .insert({
            persona_id: personaId,
            asset_code: 'KNYT',
            balance: (-amount).toString(),
          });
      }
    }
  }
  
  /**
   * Emit reputation event
   */
  private async emitReputationEvent(
    personaId: string,
    eventType: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.supabase
      .from('reputation_events')
      .insert({
        persona_id: personaId,
        event_type: eventType,
        event_source: 'purchase_handler',
        points_delta: 10, // Purchases earn reputation points
        metadata,
      });
  }

  private async findPersonaWithReferrer(
    personaId: string
  ): Promise<{ referred_by_persona_id?: string | null; referrer_persona_id?: string | null } | null> {
    const tables = ['persona', 'personas'] as const;
    const columns = ['referred_by_persona_id', 'referrer_persona_id'] as const;

    const isMissingColumn = (error?: { message?: string }) =>
      !!error?.message && error.message.includes('column') && error.message.includes('does not exist');
    const isMissingTable = (error?: { message?: string }) =>
      !!error?.message && error.message.includes('relation') && error.message.includes('does not exist');

    for (const table of tables) {
      for (const column of columns) {
        const { data, error } = await this.supabase
          .from(table)
          .select(`${column}`)
          .eq('id', personaId)
          .maybeSingle();

        if (data && (data as any)[column] !== undefined) {
          return { [column]: (data as any)[column] } as any;
        }

        if (error && !isMissingColumn(error) && !isMissingTable(error)) {
          console.warn('[PurchaseHandler] Referrer lookup error:', error.message);
          return null;
        }
      }
    }

    return null;
  }
  
  /**
   * Get purchase history for a persona
   */
  async getPurchaseHistory(personaId: string, limit = 20): Promise<Purchase[]> {
    const { data, error } = await this.supabase
      .from('purchases')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[PurchaseHandler] Error fetching purchases:', error);
      return [];
    }
    
    return (data || []).map(row => ({
      id: row.id,
      personaId: row.persona_id,
      productId: row.product_id,
      productType: row.product_type,
      paymentRail: row.payment_rail,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      paymentReference: row.payment_reference,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  }
  
  /**
   * Check if persona has purchased a product
   */
  async hasPersonaPurchased(personaId: string, productType: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .eq('product_type', productType)
      .eq('status', 'completed');
    
    return (count || 0) > 0;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let purchaseHandlerInstance: PurchaseHandler | null = null;

export function getPurchaseHandler(): PurchaseHandler {
  if (!purchaseHandlerInstance) {
    purchaseHandlerInstance = new PurchaseHandler();
  }
  return purchaseHandlerInstance;
}

export default PurchaseHandler;
