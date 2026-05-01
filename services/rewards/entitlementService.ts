/**
 * Entitlement Service - Phase 1 Tier 0 Remote Custody
 * 
 * Manages user entitlements for KNYT Codex / KNYTMall content.
 * Tier 0 = remote custody / streaming access (no download, no NFT export).
 * 
 * All Phase 1 entitlements are:
 * - tier: T0
 * - entitlement_type: perpetual
 * - expires_at: null (no planned expiry)
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/** Entitlement tier */
export type EntitlementTier = 'T0' | 'T1' | 'T2';

/** Entitlement type */
export type EntitlementType = 'perpetual' | 'term' | 'subscription';

/** User entitlement record */
export interface UserEntitlement {
  id: string;
  personaId: string;
  assetId: string;
  tier: EntitlementTier;
  entitlementType: EntitlementType;
  startsAt: string;
  expiresAt: string | null;
  sourcePurchaseId: string | null;
  metadata: Record<string, any>;
  canonicalBundleId: string | null;
  onchainTokenRef: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Product with entitlement policy */
export interface Product {
  id: string;
  productType: string;
  name: string;
  description: string | null;
  baseKnytPrice: number;
  entitlementType: EntitlementType;
  entitlementTier: EntitlementTier;
  durationDays: number | null;
  assetIds: string[];
  isActive: boolean;
  metadata: Record<string, any>;
}

/** Grant entitlement request */
export interface GrantEntitlementRequest {
  personaId: string;
  assetId: string;
  tier?: EntitlementTier;
  entitlementType?: EntitlementType;
  durationDays?: number | null;
  sourcePurchaseId?: string | null;
  metadata?: Record<string, any>;
}

/** Grant entitlement result */
export interface GrantEntitlementResult {
  success: boolean;
  entitlementId?: string;
  alreadyExists?: boolean;
  error?: string;
}

/** Check access result */
export interface CheckAccessResult {
  hasAccess: boolean;
  entitlement?: UserEntitlement;
  reason?: string;
}

// =============================================================================
// ENTITLEMENT SERVICE CLASS
// =============================================================================

export class EntitlementService {
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
   * Grant an entitlement to a persona
   */
  async grantEntitlement(req: GrantEntitlementRequest): Promise<GrantEntitlementResult> {
    const {
      personaId,
      assetId,
      tier = 'T0',
      entitlementType = 'perpetual',
      durationDays = null,
      sourcePurchaseId = null,
      metadata = {},
    } = req;
    
    try {
      // Check if entitlement already exists
      const { data: existing } = await this.supabase
        .from('user_entitlements')
        .select('id')
        .eq('persona_id', personaId)
        .eq('asset_id', assetId)
        .eq('tier', tier)
        .single();
      
      if (existing) {
        return { success: true, entitlementId: existing.id, alreadyExists: true };
      }
      
      // Calculate expiry
      let expiresAt: string | null = null;
      if (durationDays && entitlementType !== 'perpetual') {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + durationDays);
        expiresAt = expiry.toISOString();
      }
      
      // Insert entitlement
      const { data: entitlement, error } = await this.supabase
        .from('user_entitlements')
        .insert({
          persona_id: personaId,
          asset_id: assetId,
          tier,
          entitlement_type: entitlementType,
          starts_at: new Date().toISOString(),
          expires_at: expiresAt,
          source_purchase_id: sourcePurchaseId,
          metadata,
        })
        .select()
        .single();
      
      if (error) {
        console.error('[EntitlementService] Failed to grant entitlement:', error);
        return { success: false, error: 'Failed to grant entitlement' };
      }
      
      return { success: true, entitlementId: entitlement.id };
    } catch (err) {
      console.error('[EntitlementService] Error granting entitlement:', err);
      return { success: false, error: (err as Error).message };
    }
  }
  
  /**
   * Grant multiple entitlements (e.g., for bundles)
   */
  async grantBundleEntitlements(
    personaId: string,
    assetIds: string[],
    sourcePurchaseId?: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; granted: number; errors: string[] }> {
    const errors: string[] = [];
    let granted = 0;
    
    for (const assetId of assetIds) {
      const result = await this.grantEntitlement({
        personaId,
        assetId,
        sourcePurchaseId,
        metadata,
      });
      
      if (result.success) {
        granted++;
      } else {
        errors.push(`${assetId}: ${result.error}`);
      }
    }
    
    return { success: errors.length === 0, granted, errors };
  }
  
  /**
   * Check if persona has access to an asset
   */
  async checkAccess(personaId: string, assetId: string): Promise<CheckAccessResult> {
    try {
      const { data: entitlement, error } = await this.supabase
        .from('user_entitlements')
        .select('*')
        .eq('persona_id', personaId)
        .eq('asset_id', assetId)
        .single();
      
      if (error || !entitlement) {
        return { hasAccess: false, reason: 'No entitlement found' };
      }
      
      // Check expiry
      if (entitlement.expires_at) {
        const expiresAt = new Date(entitlement.expires_at);
        if (expiresAt < new Date()) {
          return { hasAccess: false, reason: 'Entitlement expired' };
        }
      }
      
      return {
        hasAccess: true,
        entitlement: this.mapEntitlement(entitlement),
      };
    } catch (err) {
      console.error('[EntitlementService] Error checking access:', err);
      return { hasAccess: false, reason: 'Error checking access' };
    }
  }
  
  /**
   * Get all entitlements for a persona
   */
  async getPersonaEntitlements(personaId: string): Promise<UserEntitlement[]> {
    const { data, error } = await this.supabase
      .from('user_entitlements')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[EntitlementService] Error fetching entitlements:', error);
      return [];
    }
    
    return (data || []).map(this.mapEntitlement);
  }
  
  /**
   * Get entitlements for specific assets
   */
  async getEntitlementsForAssets(personaId: string, assetIds: string[]): Promise<Map<string, UserEntitlement>> {
    const { data, error } = await this.supabase
      .from('user_entitlements')
      .select('*')
      .eq('persona_id', personaId)
      .in('asset_id', assetIds);
    
    if (error) {
      console.error('[EntitlementService] Error fetching entitlements:', error);
      return new Map();
    }
    
    const map = new Map<string, UserEntitlement>();
    for (const row of data || []) {
      map.set(row.asset_id, this.mapEntitlement(row));
    }
    return map;
  }
  
  /**
   * Get product by type
   */
  async getProduct(productType: string): Promise<Product | null> {
    let data: Record<string, unknown> | null = null;
    try {
      const result = await this.supabase
        .from('products')
        .select('*')
        .eq('product_type', productType)
        .eq('is_active', true)
        .single();
      if (result.error || !result.data) return null;
      data = result.data as Record<string, unknown>;
    } catch {
      // Supabase can throw SyntaxError if PostgREST returns non-JSON (HTML error page)
      return null;
    }
    if (!data) {
      return null;
    }
    
    return {
      id: data.id,
      productType: data.product_type,
      name: data.name,
      description: data.description,
      baseKnytPrice: data.base_knyt_price,
      entitlementType: data.entitlement_type,
      entitlementTier: data.entitlement_tier,
      durationDays: data.duration_days,
      assetIds: data.asset_ids || [],
      isActive: data.is_active,
      metadata: data.metadata || {},
    };
  }
  
  /**
   * Get all active products
   */
  async getActiveProducts(): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('base_knyt_price', { ascending: true });
    
    if (error) {
      console.error('[EntitlementService] Error fetching products:', error);
      return [];
    }
    
    return (data || []).map(row => ({
      id: row.id,
      productType: row.product_type,
      name: row.name,
      description: row.description,
      baseKnytPrice: row.base_knyt_price,
      entitlementType: row.entitlement_type,
      entitlementTier: row.entitlement_tier,
      durationDays: row.duration_days,
      assetIds: row.asset_ids || [],
      isActive: row.is_active,
      metadata: row.metadata || {},
    }));
  }
  
  /**
   * Map database row to UserEntitlement
   */
  private mapEntitlement(row: any): UserEntitlement {
    return {
      id: row.id,
      personaId: row.persona_id,
      assetId: row.asset_id,
      tier: row.tier,
      entitlementType: row.entitlement_type,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      sourcePurchaseId: row.source_purchase_id,
      metadata: row.metadata || {},
      canonicalBundleId: row.canonical_bundle_id,
      onchainTokenRef: row.onchain_token_ref,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let entitlementServiceInstance: EntitlementService | null = null;

export function getEntitlementService(): EntitlementService {
  if (!entitlementServiceInstance) {
    entitlementServiceInstance = new EntitlementService();
  }
  return entitlementServiceInstance;
}

export default EntitlementService;
