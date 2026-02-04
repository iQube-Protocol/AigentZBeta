/**
 * Nakamoto Core Client
 * 
 * Handles communication with QubeBase Core Hub for Nakamoto franchise.
 * Supports tenant scoping, knowledge base management, and prompt augmentation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, DocumentScope, NakamotoDocument, NakamotoPrompt, TenantInfo } from '@/app/types/nakamoto';

// Core Hub configuration (Nakamoto-specific Core Hub)
const CORE_HUB_URL = 'https://bsjhfvctmduxhohtllly.supabase.co';
const CORE_HUB_ANON_KEY = process.env.NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const CORE_HUB_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_CORE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type { TenantId, DocumentScope, NakamotoDocument, NakamotoPrompt, TenantInfo };

export class NakamotoCoreClient {
  private client: SupabaseClient;
  private currentTenant: TenantId = 'nakamoto';

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const anonKey = CORE_HUB_ANON_KEY;
    const serviceKey = CORE_HUB_SERVICE_ROLE_KEY;
    const keyToUse = anonKey || (!isProd ? serviceKey : '');

    if (!keyToUse) {
      console.warn('[NakamotoCoreClient] Missing Supabase key. Set NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }

    if (!anonKey && !isProd && serviceKey) {
      console.warn('[NakamotoCoreClient] Using service role key in client (dev only). Set NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY to avoid this.');
    }

    this.client = createClient(CORE_HUB_URL, keyToUse, {
      auth: {
        persistSession: false,
      },
    });
  }

  /**
   * Set the current tenant context
   */
  setTenant(tenantId: TenantId) {
    this.currentTenant = tenantId;
  }

  /**
   * Get current tenant context
   */
  getCurrentTenant(): TenantId {
    return this.currentTenant;
  }

  /**
   * Check Core Hub connectivity
   */
  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!CORE_HUB_ANON_KEY && (process.env.NODE_ENV === 'production' || !CORE_HUB_SERVICE_ROLE_KEY)) {
        return { success: false, error: 'Missing Supabase key (NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)' };
      }
      const { data, error } = await this.client
        .from('tenants')
        .select('tenant_id, display_name')
        .limit(1);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get tenant information
   */
  async getTenantInfo(tenantId: TenantId): Promise<TenantInfo | null> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Get all available tenants
   */
  async getTenants(): Promise<TenantInfo[]> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('status', 'active')
      .order('display_name');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get knowledge base documents for current tenant
   * Includes inherited root documents + tenant-specific documents
   */
  async getDocuments(options: {
    limit?: number;
    offset?: number;
    tags?: string[];
    search?: string;
  } = {}): Promise<NakamotoDocument[]> {
    let query = this.client
      .from('docs')
      .select('*')
      .or(`scope.eq.root,AND(scope.eq.tenant,tenant_id.eq.${this.currentTenant})`)
      .order('created_at', { ascending: false });

    if (options.tags && options.tags.length > 0) {
      query = query.contains('tags', options.tags);
    }

    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,content_text.ilike.%${options.search}%`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(id: string): Promise<NakamotoDocument | null> {
    const { data, error } = await this.client
      .from('docs')
      .select('*')
      .eq('id', id)
      .or(`scope.eq.root,AND(scope.eq.tenant,tenant_id.eq.${this.currentTenant})`)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Create or update a tenant-specific document
   */
  async upsertTenantDocument(doc: Omit<NakamotoDocument, 'id' | 'created_at' | 'updated_at'>): Promise<NakamotoDocument> {
    const document = {
      ...doc,
      scope: 'tenant' as DocumentScope,
      tenant_id: this.currentTenant,
    };

    const { data, error } = await this.client
      .from('docs')
      .upsert(document)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get system prompts for current tenant
   * Includes inherited root prompts + tenant-specific augmentations
   */
  async getPrompts(): Promise<NakamotoPrompt[]> {
    const { data, error } = await this.client
      .from('prompts')
      .select('*')
      .or(`scope.eq.root,AND(scope.eq.tenant,tenant_id.eq.${this.currentTenant})`)
      .eq('is_active', true)
      .order('version', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create or update a tenant-specific prompt augmentation
   */
  async upsertTenantPrompt(prompt: Omit<NakamotoPrompt, 'id' | 'created_at' | 'updated_at'>): Promise<NakamotoPrompt> {
    const promptData = {
      ...prompt,
      scope: 'tenant' as DocumentScope,
      tenant_id: this.currentTenant,
    };

    const { data, error } = await this.client
      .from('prompts')
      .upsert(promptData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get effective system prompt (root + tenant augmentations)
   */
  async getEffectiveSystemPrompt(): Promise<string> {
    const prompts = await this.getPrompts();
    
    // Separate root and tenant prompts
    const rootPrompt = prompts.find(p => p.scope === 'root' && p.name === 'system');
    const tenantPrompts = prompts.filter(p => p.scope === 'tenant' && p.tenant_id === this.currentTenant);
    
    // Combine root prompt with tenant augmentations
    let effectivePrompt = rootPrompt?.content || '';
    
    if (tenantPrompts.length > 0) {
      effectivePrompt += '\n\n=== TENANT-SPECIFIC AUGMENTATIONS ===\n';
      tenantPrompts.forEach(prompt => {
        effectivePrompt += `\n${prompt.name}:\n${prompt.content}\n`;
      });
    }
    
    return effectivePrompt;
  }

  /**
   * Search documents by content
   */
  async searchDocuments(query: string, options: {
    limit?: number;
    tags?: string[];
  } = {}): Promise<NakamotoDocument[]> {
    return this.getDocuments({
      search: query,
      limit: options.limit,
      tags: options.tags,
    });
  }

  /**
   * Get documents by tags
   */
  async getDocumentsByTags(tags: string[], limit?: number): Promise<NakamotoDocument[]> {
    return this.getDocuments({
      tags,
      limit,
    });
  }

  /**
   * Register a new tenant (for admin operations)
   */
  async registerTenant(tenantInfo: Omit<TenantInfo, 'id' | 'created_at' | 'updated_at'>): Promise<TenantInfo> {
    const { data, error } = await this.client
      .from('tenants')
      .upsert(tenantInfo)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Singleton instance
let clientInstance: NakamotoCoreClient | null = null;

export function getNakamotoCoreClient(): NakamotoCoreClient {
  if (!clientInstance) {
    clientInstance = new NakamotoCoreClient();
  }
  return clientInstance;
}
