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

const PERSONA_TABLES = ['persona', 'personas'] as const;
const REFERRER_COLUMNS = ['referred_by_persona_id', 'referrer_persona_id'] as const;

const isMissingColumn = (error?: { message?: string }) =>
  !!error?.message && error.message.includes('column') && error.message.includes('does not exist');

const isMissingTable = (error?: { message?: string }) =>
  !!error?.message && error.message.includes('relation') && error.message.includes('does not exist');

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
        const referrer = await this.findPersonaByHandle(referrerHandle);
        if (referrer) {
          foundReferrerId = referrer.id;
          foundHandle = referrer.fioHandle;
        }
      }
      
      // Fall back to direct persona ID
      if (!foundReferrerId && referrerPersonaId) {
        const referrer = await this.findPersonaById(referrerPersonaId);
        if (referrer) {
          foundReferrerId = referrer.id;
          foundHandle = referrer.fioHandle;
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
      const targetTable = await this.findPersonaTableById(newPersonaId);
      if (!targetTable) {
        return { success: false, referrerFound: true, error: 'New persona not found' };
      }

      const referrerUpdated = await this.updateReferrerForPersona(
        targetTable,
        newPersonaId,
        foundReferrerId
      );

      if (!referrerUpdated) {
        return { success: false, referrerFound: true, error: 'Failed to link referrer' };
      }

      if (campaignId) {
        await this.updateCampaignId(targetTable, newPersonaId, campaignId);
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
    return this.findPersonaByHandle(handle);
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
    const table = await this.findPersonaTableById(personaId);
    const personaRow = table
      ? await this.supabase
          .from(table)
          .select('fio_handle')
          .eq('id', personaId)
          .maybeSingle()
      : { data: null };

    const column = await this.findExistingReferrerColumn(table);

    const { count: totalReferrals } = table && column
      ? await this.supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(column, personaId)
      : { count: 0 };

    const { count: qualifiedReferrals } = table && column
      ? await this.supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(column, personaId)
          .not('first_paid_purchase_at', 'is', null)
      : { count: 0 };
    
    // Get total KNYT earned from referrals
    const { data: rewards } = await this.supabase
      .from('reward_grants')
      .select('amount_knyt')
      .eq('persona_id', personaId)
      .eq('task_type', 'BringAKnightQualifiedReferral');
    
    const totalKnytEarned = (rewards || []).reduce((sum, r) => sum + (r.amount_knyt || 0), 0);
    
    return {
      personaId,
      fioHandle: (personaRow as any)?.data?.fio_handle || null,
      totalReferrals: totalReferrals || 0,
      qualifiedReferrals: qualifiedReferrals || 0,
      pendingReferrals: (totalReferrals || 0) - (qualifiedReferrals || 0),
      totalKnytEarned,
    };
  }

  private async findPersonaByHandle(handle: string): Promise<{ id: string; fioHandle: string } | null> {
    const normalizedHandle = handle.trim().toLowerCase();

    for (const table of PERSONA_TABLES) {
      const { data, error } = await this.supabase
        .from(table)
        .select('id, fio_handle')
        .eq('fio_handle', normalizedHandle)
        .maybeSingle();

      if (data?.id) {
        return { id: data.id, fioHandle: data.fio_handle };
      }

      if (error && !isMissingTable(error)) {
        console.warn('[ReferralService] handle lookup error:', error.message);
      }
    }

    return null;
  }

  private async findPersonaById(personaId: string): Promise<{ id: string; fioHandle: string | null } | null> {
    for (const table of PERSONA_TABLES) {
      const { data, error } = await this.supabase
        .from(table)
        .select('id, fio_handle')
        .eq('id', personaId)
        .maybeSingle();

      if (data?.id) {
        return { id: data.id, fioHandle: data.fio_handle || null };
      }

      if (error && !isMissingTable(error)) {
        console.warn('[ReferralService] id lookup error:', error.message);
      }
    }

    return null;
  }

  private async findPersonaTableById(personaId: string): Promise<(typeof PERSONA_TABLES)[number] | null> {
    for (const table of PERSONA_TABLES) {
      const { data, error } = await this.supabase
        .from(table)
        .select('id')
        .eq('id', personaId)
        .maybeSingle();

      if (data?.id) {
        return table;
      }

      if (error && !isMissingTable(error)) {
        console.warn('[ReferralService] persona table lookup error:', error.message);
      }
    }

    return null;
  }

  private async updateReferrerForPersona(table: string, personaId: string, referrerId: string): Promise<boolean> {
    for (const column of REFERRER_COLUMNS) {
      const { error } = await this.supabase
        .from(table)
        .update({ [column]: referrerId })
        .eq('id', personaId);

      if (!error) {
        return true;
      }

      if (!isMissingColumn(error)) {
        console.warn('[ReferralService] referrer update error:', error.message);
      }
    }

    return false;
  }

  private async updateCampaignId(table: string, personaId: string, campaignId: string): Promise<void> {
    const { error } = await this.supabase
      .from(table)
      .update({ ref_campaign_id: campaignId })
      .eq('id', personaId);

    if (error && !isMissingColumn(error)) {
      console.warn('[ReferralService] campaign update error:', error.message);
    }
  }

  private async findExistingReferrerColumn(table?: string | null): Promise<(typeof REFERRER_COLUMNS)[number] | null> {
    if (!table) return null;

    for (const column of REFERRER_COLUMNS) {
      const { error } = await this.supabase
        .from(table)
        .select(column)
        .limit(1);

      if (!error) {
        return column;
      }

      if (!isMissingColumn(error) && !isMissingTable(error)) {
        return column;
      }
    }

    return null;
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
