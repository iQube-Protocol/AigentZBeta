/**
 * Referral Service - Phase 1 Bring a Knight
 * 
 * Handles referral tracking via FIO-style handles (e.g., dave@knyt).
 * 
 * Flow:
 * 1. User signs up with ?ref=dave@knyt or enters referrer handle
 * 2. Backend looks up referrer persona by fio_handle
 * 3. Sets referrer_persona_id on new persona
 * 4. On first paid purchase, both get KNYT rewards
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/** Process referral request */
export interface ProcessReferralRequest {
  newPersonaId: string;
  referrerHandle?: string; // FIO handle like "dave@knyt"
  referrerPersonaId?: string; // Direct persona ID (alternative)
  campaignId?: string;
}

/** Process referral result */
export interface ProcessReferralResult {
  success: boolean;
  referrerFound: boolean;
  referrerPersonaId?: string;
  referrerHandle?: string;
  error?: string;
}

/** Referral stats */
export interface ReferralStats {
  personaId: string;
  fioHandle: string | null;
  totalReferrals: number;
  qualifiedReferrals: number; // Made first purchase
  pendingReferrals: number;
  totalKnytEarned: number;
}

// =============================================================================
// REFERRAL SERVICE CLASS
// =============================================================================

export class ReferralService {
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
   * Process a referral at signup
   */
  async processReferral(req: ProcessReferralRequest): Promise<ProcessReferralResult> {
    const { newPersonaId, referrerHandle, referrerPersonaId, campaignId } = req;
    
    try {
      let foundReferrerId: string | undefined;
      let foundHandle: string | undefined;
      
      // Try to find referrer by handle first
      if (referrerHandle) {
        const handle = referrerHandle.trim().toLowerCase();
        const { data: referrer } = await this.supabase
          .from('personas')
          .select('id, fio_handle')
          .eq('fio_handle', handle)
          .single();
        
        if (referrer) {
          foundReferrerId = referrer.id;
          foundHandle = referrer.fio_handle;
        }
      }
      
      // Fall back to direct persona ID
      if (!foundReferrerId && referrerPersonaId) {
        const { data: referrer } = await this.supabase
          .from('personas')
          .select('id, fio_handle')
          .eq('id', referrerPersonaId)
          .single();
        
        if (referrer) {
          foundReferrerId = referrer.id;
          foundHandle = referrer.fio_handle;
        }
      }
      
      if (!foundReferrerId) {
        return { 
          success: true, 
          referrerFound: false,
          error: referrerHandle ? `Referrer not found: ${referrerHandle}` : undefined,
        };
      }
      
      // Don't allow self-referral
      if (foundReferrerId === newPersonaId) {
        return { success: false, referrerFound: false, error: 'Cannot refer yourself' };
      }
      
      // Update new persona with referrer info
      const { error: updateError } = await this.supabase
        .from('personas')
        .update({
          referrer_persona_id: foundReferrerId,
          ref_campaign_id: campaignId || 'bring-a-knight-v1',
        })
        .eq('id', newPersonaId);
      
      if (updateError) {
        console.error('[ReferralService] Failed to update persona:', updateError);
        return { success: false, referrerFound: true, error: 'Failed to link referrer' };
      }
      
      return {
        success: true,
        referrerFound: true,
        referrerPersonaId: foundReferrerId,
        referrerHandle: foundHandle,
      };
    } catch (err) {
      console.error('[ReferralService] Error processing referral:', err);
      return { success: false, referrerFound: false, error: (err as Error).message };
    }
  }
  
  /**
   * Find persona by FIO handle
   */
  async findByFioHandle(handle: string): Promise<{ id: string; fioHandle: string } | null> {
    const normalizedHandle = handle.trim().toLowerCase();
    
    const { data, error } = await this.supabase
      .from('personas')
      .select('id, fio_handle')
      .eq('fio_handle', normalizedHandle)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return { id: data.id, fioHandle: data.fio_handle };
  }
  
  /**
   * Set FIO handle for a persona
   */
  async setFioHandle(personaId: string, handle: string): Promise<{ success: boolean; error?: string }> {
    const normalizedHandle = handle.trim().toLowerCase();
    
    // Validate handle format (basic: alphanumeric + @ + domain)
    if (!/^[a-z0-9_-]+@[a-z0-9_-]+$/i.test(normalizedHandle)) {
      return { success: false, error: 'Invalid handle format. Use format: name@domain' };
    }
    
    // Check if handle is already taken
    const { data: existing } = await this.supabase
      .from('personas')
      .select('id')
      .eq('fio_handle', normalizedHandle)
      .neq('id', personaId)
      .single();
    
    if (existing) {
      return { success: false, error: 'Handle already taken' };
    }
    
    // Update handle
    const { error } = await this.supabase
      .from('personas')
      .update({ fio_handle: normalizedHandle })
      .eq('id', personaId);
    
    if (error) {
      console.error('[ReferralService] Failed to set handle:', error);
      return { success: false, error: 'Failed to set handle' };
    }
    
    return { success: true };
  }
  
  /**
   * Get referral stats for a persona
   */
  async getReferralStats(personaId: string): Promise<ReferralStats> {
    // Get persona's FIO handle
    const { data: persona } = await this.supabase
      .from('personas')
      .select('fio_handle')
      .eq('id', personaId)
      .single();
    
    // Count total referrals
    const { count: totalReferrals } = await this.supabase
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_persona_id', personaId);
    
    // Count qualified referrals (made first purchase)
    const { count: qualifiedReferrals } = await this.supabase
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_persona_id', personaId)
      .not('first_paid_purchase_at', 'is', null);
    
    // Get total KNYT earned from referrals
    const { data: rewards } = await this.supabase
      .from('reward_grants')
      .select('amount_knyt')
      .eq('persona_id', personaId)
      .eq('task_type', 'BringAKnightQualifiedReferral');
    
    const totalKnytEarned = (rewards || []).reduce((sum, r) => sum + (r.amount_knyt || 0), 0);
    
    return {
      personaId,
      fioHandle: persona?.fio_handle || null,
      totalReferrals: totalReferrals || 0,
      qualifiedReferrals: qualifiedReferrals || 0,
      pendingReferrals: (totalReferrals || 0) - (qualifiedReferrals || 0),
      totalKnytEarned,
    };
  }
  
  /**
   * Get referrals made by a persona
   */
  async getReferrals(personaId: string): Promise<Array<{
    id: string;
    fioHandle: string | null;
    qualified: boolean;
    createdAt: string;
  }>> {
    const { data, error } = await this.supabase
      .from('personas')
      .select('id, fio_handle, first_paid_purchase_at, created_at')
      .eq('referrer_persona_id', personaId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[ReferralService] Error fetching referrals:', error);
      return [];
    }
    
    return (data || []).map(p => ({
      id: p.id,
      fioHandle: p.fio_handle,
      qualified: !!p.first_paid_purchase_at,
      createdAt: p.created_at,
    }));
  }
  
  /**
   * Generate a referral link for a persona
   */
  generateReferralLink(fioHandle: string, baseUrl: string = 'https://theqriptopian.com'): string {
    const encodedHandle = encodeURIComponent(fioHandle);
    return `${baseUrl}?ref=${encodedHandle}`;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let referralServiceInstance: ReferralService | null = null;

export function getReferralService(): ReferralService {
  if (!referralServiceInstance) {
    referralServiceInstance = new ReferralService();
  }
  return referralServiceInstance;
}

export default ReferralService;
