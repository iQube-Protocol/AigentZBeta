/**
 * Smart Content Service
 * 
 * Core service for managing SmartContentQubes, including:
 * - CRUD operations for smart content
 * - Relationship management
 * - Library operations
 * - Entitlement checking
 * - Pricing snapshot generation
 * 
 * Uses QubeBase (Supabase) for persistence.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  SmartContentQube,
  SmartContentApp,
  ContentModalities,
  PricingModel,
  LayoutHints,
  MenuIntegration,
  LibraryMetadata,
  IdentityRequirements,
  ReputationRequirements,
  RewardOutcomes,
  AccessPolicy,
  ContentStructure,
  createSmartContentQube,
} from '@/types/smartContent';
import type {
  RelationshipQube,
  RelationshipQuery,
  RelationshipGraph,
} from '@/types/relationship';
import type {
  PricingSnapshot,
  ContentEntitlement,
} from '@/types/smartWallet';

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

export interface SmartContentServiceConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
}

// =============================================================================
// SMART CONTENT SERVICE
// =============================================================================

export class SmartContentService {
  private supabase: SupabaseClient;
  
  constructor(config?: SmartContentServiceConfig) {
    const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required for SmartContentService');
    }
    
    this.supabase = createClient(url, key);
  }
  
  // ===========================================================================
  // SMART CONTENT CRUD
  // ===========================================================================
  
  /**
   * Create a new SmartContentQube
   */
  async create(input: {
    app: SmartContentApp;
    title: string;
    slug: string;
    creatorRootDid: string;
    tenantId: string;
    description?: string;
    coverImageUri?: string;
    modalities?: Partial<ContentModalities>;
    structure?: ContentStructure;
    pricingModel?: Partial<PricingModel>;
    layoutHints?: Partial<LayoutHints>;
    menuIntegration?: Partial<MenuIntegration>;
    libraryMetadata?: Partial<LibraryMetadata>;
    identityRequirements?: Partial<IdentityRequirements>;
    reputationRequirements?: Partial<ReputationRequirements>;
    rewardOutcomes?: Partial<RewardOutcomes>;
    accessPolicy?: Partial<AccessPolicy>;
  }): Promise<SmartContentQube> {
    const { data, error } = await this.supabase
      .from('smart_content_qubes')
      .insert({
        app: input.app,
        title: input.title,
        slug: input.slug,
        creator_root_did: input.creatorRootDid,
        tenant_id: input.tenantId,
        description: input.description || '',
        cover_image_uri: input.coverImageUri || '',
        modalities: input.modalities || {},
        structure_kind: input.structure?.kind,
        structure_data: input.structure,
        pricing_model: input.pricingModel || {},
        layout_hints: input.layoutHints || {},
        menu_integration: input.menuIntegration || {},
        library_metadata: input.libraryMetadata || {},
        identity_requirements: input.identityRequirements || {},
        reputation_requirements: input.reputationRequirements || {},
        reward_outcomes: input.rewardOutcomes || {},
        access_policy: input.accessPolicy || {},
        status: 'draft',
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create SmartContentQube: ${error.message}`);
    }
    
    return this.mapDbToSmartContent(data);
  }
  
  /**
   * Get a SmartContentQube by ID
   */
  async getById(id: string): Promise<SmartContentQube | null> {
    const { data, error } = await this.supabase
      .from('smart_content_qubes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get SmartContentQube: ${error.message}`);
    }
    
    return this.mapDbToSmartContent(data);
  }
  
  /**
   * Get a SmartContentQube by slug
   */
  async getBySlug(app: SmartContentApp, slug: string): Promise<SmartContentQube | null> {
    const { data, error } = await this.supabase
      .from('smart_content_qubes')
      .select('*')
      .eq('app', app)
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get SmartContentQube by slug: ${error.message}`);
    }
    
    return this.mapDbToSmartContent(data);
  }
  
  /**
   * Update a SmartContentQube
   */
  async update(id: string, updates: Partial<SmartContentQube>): Promise<SmartContentQube> {
    const dbUpdates: Record<string, any> = {};
    
    // Map TypeScript fields to database columns
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.coverImageUri !== undefined) dbUpdates.cover_image_uri = updates.coverImageUri;
    if (updates.modalities !== undefined) dbUpdates.modalities = updates.modalities;
    if (updates.structure !== undefined) {
      dbUpdates.structure_kind = updates.structure.kind;
      dbUpdates.structure_data = updates.structure;
    }
    if (updates.pricingModel !== undefined) dbUpdates.pricing_model = updates.pricingModel;
    if (updates.layoutHints !== undefined) dbUpdates.layout_hints = updates.layoutHints;
    if (updates.menuIntegration !== undefined) dbUpdates.menu_integration = updates.menuIntegration;
    if (updates.libraryMetadata !== undefined) dbUpdates.library_metadata = updates.libraryMetadata;
    if (updates.identityRequirements !== undefined) dbUpdates.identity_requirements = updates.identityRequirements;
    if (updates.reputationRequirements !== undefined) dbUpdates.reputation_requirements = updates.reputationRequirements;
    if (updates.rewardOutcomes !== undefined) dbUpdates.reward_outcomes = updates.rewardOutcomes;
    if (updates.accessPolicy !== undefined) dbUpdates.access_policy = updates.accessPolicy;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    
    const { data, error } = await this.supabase
      .from('smart_content_qubes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update SmartContentQube: ${error.message}`);
    }
    
    return this.mapDbToSmartContent(data);
  }
  
  /**
   * Publish a SmartContentQube
   */
  async publish(id: string): Promise<SmartContentQube> {
    return this.update(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    } as any);
  }
  
  /**
   * Archive a SmartContentQube
   */
  async archive(id: string): Promise<SmartContentQube> {
    return this.update(id, { status: 'archived' });
  }
  
  /**
   * Soft delete a SmartContentQube
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('smart_content_qubes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    return !error;
  }
  
  /**
   * List SmartContentQubes with filters
   */
  async list(options: {
    app?: SmartContentApp;
    tenantId?: string;
    creatorRootDid?: string;
    status?: SmartContentQube['status'];
    category?: string;
    featured?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: SmartContentQube[]; total: number }> {
    let query = this.supabase
      .from('smart_content_qubes')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);
    
    if (options.app) query = query.eq('app', options.app);
    if (options.tenantId) query = query.eq('tenant_id', options.tenantId);
    if (options.creatorRootDid) query = query.eq('creator_root_did', options.creatorRootDid);
    if (options.status) query = query.eq('status', options.status);
    if (options.category) query = query.eq('library_metadata->>category', options.category);
    if (options.featured !== undefined) query = query.eq('library_metadata->>featured', options.featured);
    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }
    
    query = query
      .order('created_at', { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to list SmartContentQubes: ${error.message}`);
    }
    
    return {
      data: (data || []).map(this.mapDbToSmartContent),
      total: count || 0,
    };
  }
  
  // ===========================================================================
  // RELATIONSHIPS
  // ===========================================================================
  
  /**
   * Get relationships for a content item
   */
  async getRelationships(contentId: string, query?: RelationshipQuery): Promise<RelationshipQube[]> {
    let dbQuery = this.supabase
      .from('relationship_qubes')
      .select('*')
      .eq('status', 'active')
      .is('deleted_at', null);
    
    // Filter by source or target
    if (query?.includeBidirectional) {
      dbQuery = dbQuery.or(`source_id.eq.${contentId},target_id.eq.${contentId}`);
    } else {
      dbQuery = dbQuery.eq('source_id', contentId);
    }
    
    if (query?.relationshipType) {
      dbQuery = dbQuery.eq('relationship_type', query.relationshipType);
    }
    
    if (query?.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }
    
    const { data, error } = await dbQuery;
    
    if (error) {
      throw new Error(`Failed to get relationships: ${error.message}`);
    }
    
    return (data || []).map(this.mapDbToRelationship);
  }
  
  /**
   * Create a relationship between content items
   */
  async createRelationship(relationship: Partial<RelationshipQube> & {
    sourceId: string;
    sourceType: string;
    targetId: string;
    targetType: string;
    relationshipType: string;
    tenantId: string;
    createdBy: string;
  }): Promise<RelationshipQube> {
    const { data, error } = await this.supabase
      .from('relationship_qubes')
      .insert({
        source_id: relationship.sourceId,
        source_type: relationship.sourceType,
        target_id: relationship.targetId,
        target_type: relationship.targetType,
        relationship_type: relationship.relationshipType,
        direction: relationship.direction || 'unidirectional',
        relationship_data: relationship.data || {},
        metadata: relationship.metadata || { sortOrder: 0, featured: false },
        tenant_id: relationship.tenantId,
        created_by: relationship.createdBy,
        status: 'active',
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create relationship: ${error.message}`);
    }
    
    return this.mapDbToRelationship(data);
  }
  
  /**
   * Get series content in order
   */
  async getSeriesContent(seriesId: string): Promise<SmartContentQube[]> {
    const relationships = await this.getRelationships(seriesId, {
      relationshipType: 'series',
    });
    
    // Sort by position in series
    const sorted = relationships.sort((a, b) => {
      const posA = (a.data as any)?.positionInSeries || 0;
      const posB = (b.data as any)?.positionInSeries || 0;
      return posA - posB;
    });
    
    // Fetch content for each relationship
    const contentIds = sorted.map(r => r.sourceId);
    const { data, error } = await this.supabase
      .from('smart_content_qubes')
      .select('*')
      .in('id', contentIds)
      .is('deleted_at', null);
    
    if (error) {
      throw new Error(`Failed to get series content: ${error.message}`);
    }
    
    // Maintain order
    const contentMap = new Map((data || []).map(c => [c.id, c]));
    return contentIds
      .map(id => contentMap.get(id))
      .filter(Boolean)
      .map(this.mapDbToSmartContent);
  }
  
  // ===========================================================================
  // ENTITLEMENTS & PRICING
  // ===========================================================================
  
  /**
   * Check if a persona has access to content
   */
  async checkEntitlement(
    contentId: string,
    personaId: string
  ): Promise<ContentEntitlement | null> {
    const { data, error } = await this.supabase
      .from('content_entitlements')
      .select('*')
      .eq('content_id', contentId)
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to check entitlement: ${error.message}`);
    }
    
    return this.mapDbToEntitlement(data);
  }
  
  /**
   * Get all entitlements for a persona
   */
  async getEntitlementsByPersona(personaId: string): Promise<ContentEntitlement[]> {
    const { data, error } = await this.supabase
      .from('content_entitlements')
      .select('*')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get entitlements: ${error.message}`);
    }
    
    return (data || []).map(this.mapDbToEntitlement);
  }
  
  /**
   * Generate pricing snapshot for content
   */
  async getPricingSnapshot(
    contentId: string,
    personaId?: string
  ): Promise<PricingSnapshot> {
    const content = await this.getById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }
    
    // Check entitlement if persona provided
    let entitlement: ContentEntitlement | null = null;
    if (personaId) {
      entitlement = await this.checkEntitlement(contentId, personaId);
    }
    
    const owned = entitlement !== null && entitlement.scope === 'full';
    
    // Build pricing offers from content's pricing model
    const allOffers = content.pricingModel.tiers.map(tier => ({
      kind: tier.kind,
      amount: tier.amount,
      currency: tier.currency,
      label: this.getPricingLabel(tier.kind, tier.amount, tier.currency),
      covers: tier.covers,
    }));
    
    // Find best offer (lowest price for full access)
    const fullAccessOffers = allOffers.filter(o => 
      o.kind === 'payPerEpisode' || 
      o.kind === 'payPerArticle' || 
      o.kind === 'bundle'
    );
    const bestOffer = fullAccessOffers.length > 0
      ? fullAccessOffers.reduce((best, curr) => curr.amount < best.amount ? curr : best)
      : allOffers[0] || null;
    
    return {
      owned,
      entitlement: entitlement || undefined,
      bestOffer: bestOffer || undefined,
      allOffers,
      freePreviewAvailable: Object.keys(content.pricingModel.freePreview).length > 0,
      freePreview: content.pricingModel.freePreview,
      x402TemplateId: content.pricingModel.x402TemplateId,
    };
  }
  
  /**
   * Grant entitlement to content
   */
  async grantEntitlement(input: {
    contentId: string;
    personaId: string;
    rootDid?: string;
    scope: 'full' | 'preview' | 'rental' | 'subscription';
    acquiredVia: 'purchase' | 'subscription' | 'rental' | 'gift' | 'reward' | 'free';
    txHash?: string;
    chainId?: number;
    expiresAt?: string;
    maxUsage?: number;
  }): Promise<ContentEntitlement> {
    const { data, error } = await this.supabase
      .from('content_entitlements')
      .insert({
        content_id: input.contentId,
        persona_id: input.personaId,
        root_did: input.rootDid,
        scope: input.scope,
        acquired_via: input.acquiredVia,
        tx_hash: input.txHash,
        chain_id: input.chainId,
        expires_at: input.expiresAt,
        max_usage: input.maxUsage,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to grant entitlement: ${error.message}`);
    }
    
    return this.mapDbToEntitlement(data);
  }
  
  // ===========================================================================
  // LIBRARY OPERATIONS
  // ===========================================================================
  
  /**
   * Add content to user's library
   */
  async addToLibrary(input: {
    personaId: string;
    contentId: string;
    shelfName?: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('content_library')
      .upsert({
        persona_id: input.personaId,
        content_id: input.contentId,
        shelf_name: input.shelfName || 'Library',
      }, {
        onConflict: 'persona_id,content_id',
      });
    
    if (error) {
      throw new Error(`Failed to add to library: ${error.message}`);
    }
  }
  
  /**
   * Get user's library
   */
  async getLibrary(personaId: string, options?: {
    shelfName?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ content: SmartContentQube; libraryItem: any }[]> {
    let query = this.supabase
      .from('content_library')
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .eq('persona_id', personaId);
    
    if (options?.shelfName) {
      query = query.eq('shelf_name', options.shelfName);
    }
    
    query = query
      .order('added_at', { ascending: false })
      .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1);
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get library: ${error.message}`);
    }
    
    return (data || []).map(item => ({
      content: this.mapDbToSmartContent(item.content),
      libraryItem: {
        shelfName: item.shelf_name,
        position: item.position,
        userRating: item.user_rating,
        isFavorite: item.is_favorite,
        progressPercentage: item.progress_percentage,
        completed: item.completed,
        addedAt: item.added_at,
        lastAccessedAt: item.last_accessed_at,
      },
    }));
  }
  
  /**
   * Update library item progress
   */
  async updateProgress(input: {
    personaId: string;
    contentId: string;
    progressPercentage: number;
    timeSpentSeconds?: number;
  }): Promise<void> {
    const updates: Record<string, any> = {
      progress_percentage: input.progressPercentage,
      last_accessed_at: new Date().toISOString(),
    };
    
    if (input.timeSpentSeconds !== undefined) {
      // Increment time spent
      const { data: current } = await this.supabase
        .from('content_library')
        .select('time_spent_seconds')
        .eq('persona_id', input.personaId)
        .eq('content_id', input.contentId)
        .single();
      
      updates.time_spent_seconds = (current?.time_spent_seconds || 0) + input.timeSpentSeconds;
    }
    
    if (input.progressPercentage >= 100) {
      updates.completed = true;
      updates.completed_at = new Date().toISOString();
    }
    
    const { error } = await this.supabase
      .from('content_library')
      .update(updates)
      .eq('persona_id', input.personaId)
      .eq('content_id', input.contentId);
    
    if (error) {
      throw new Error(`Failed to update progress: ${error.message}`);
    }
  }
  
  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================
  
  private mapDbToSmartContent(row: any): SmartContentQube {
    return {
      id: row.id,
      type: 'SmartContentQube',
      app: row.app,
      title: row.title,
      slug: row.slug,
      version: row.version,
      description: row.description || '',
      coverImageUri: row.cover_image_uri || '',
      creatorRootDid: row.creator_root_did,
      tenantId: row.tenant_id,
      identityRequirements: row.identity_requirements || {},
      reputationRequirements: row.reputation_requirements || {},
      rewardOutcomes: row.reward_outcomes || {},
      modalities: row.modalities || {},
      structure: row.structure_data,
      pricingModel: row.pricing_model || {},
      accessPolicy: row.access_policy || {},
      layoutHints: row.layout_hints || {},
      menuIntegration: row.menu_integration || {},
      libraryMetadata: row.library_metadata || {},
      contentQubeId: row.content_qube_id,
      metaQubeCid: row.meta_qube_cid,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      status: row.status,
    };
  }
  
  private mapDbToRelationship(row: any): RelationshipQube {
    return {
      id: row.id,
      qubeType: 'RelationshipQube',
      sourceId: row.source_id,
      sourceType: row.source_type,
      targetId: row.target_id,
      targetType: row.target_type,
      relationshipType: row.relationship_type,
      direction: row.direction,
      data: row.relationship_data,
      metadata: row.metadata,
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
    };
  }
  
  private mapDbToEntitlement(row: any): ContentEntitlement {
    return {
      id: row.id,
      contentId: row.content_id,
      contentTitle: '', // Would need to join
      scope: row.scope,
      acquiredVia: row.acquired_via,
      txHash: row.tx_hash,
      expiresAt: row.expires_at,
      usageCount: row.usage_count,
      maxUsage: row.max_usage,
      acquiredAt: row.acquired_at,
    };
  }
  
  private getPricingLabel(kind: string, amount: number, currency: string): string {
    const formattedAmount = amount.toLocaleString();
    switch (kind) {
      case 'payPerPanel': return `${formattedAmount} ${currency} per panel`;
      case 'payPerEpisode': return `${formattedAmount} ${currency} for episode`;
      case 'payPerStream': return `${formattedAmount} ${currency} to stream`;
      case 'payPerArticle': return `${formattedAmount} ${currency} for article`;
      case 'payPerIssue': return `${formattedAmount} ${currency} for issue`;
      case 'payPerSeries': return `${formattedAmount} ${currency} for series`;
      case 'subscription': return `${formattedAmount} ${currency}/month`;
      case 'bundle': return `${formattedAmount} ${currency} bundle`;
      case 'free': return 'Free';
      default: return `${formattedAmount} ${currency}`;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let serviceInstance: SmartContentService | null = null;

export function getSmartContentService(config?: SmartContentServiceConfig): SmartContentService {
  if (!serviceInstance) {
    serviceInstance = new SmartContentService(config);
  }
  return serviceInstance;
}
