/**
 * Smart Content Library Service
 * 
 * Manages user's content library including:
 * - Personal shelves and collections
 * - Reading/viewing progress
 * - Favorites and ratings
 * - Discovery and recommendations
 * - Series/collection tracking
 * 
 * Integrates with SmartContentService for content operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  SmartContentQube,
  SmartContentApp,
  LibraryMetadata,
  ExpiryModel,
} from '@/types/smartContent';
import type { ContentEntitlement } from '@/types/smartWallet';

// =============================================================================
// LIBRARY TYPES
// =============================================================================

export interface LibraryItem {
  /** Library item ID */
  id: string;
  
  /** Content reference */
  content: SmartContentQube;
  
  /** Shelf name */
  shelfName: string;
  
  /** Custom shelf ID (if user-created) */
  customShelfId?: string;
  
  /** Position in shelf */
  position: number;
  
  /** User rating (1-5) */
  userRating?: number;
  
  /** User notes */
  userNotes?: string;
  
  /** Is favorite */
  isFavorite: boolean;
  
  /** Progress percentage (0-100) */
  progressPercentage: number;
  
  /** Time spent in seconds */
  timeSpentSeconds: number;
  
  /** Is completed */
  completed: boolean;
  
  /** Completed date */
  completedAt?: string;
  
  /** Added date */
  addedAt: string;
  
  /** Last accessed date */
  lastAccessedAt?: string;
  
  /** Entitlement (if any) */
  entitlement?: ContentEntitlement;
}

export interface UserShelf {
  /** Shelf ID */
  id: string;
  
  /** Shelf name */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Cover image URI */
  coverImageUri?: string;
  
  /** Is public */
  isPublic: boolean;
  
  /** Position in shelf list */
  position: number;
  
  /** Item count */
  itemCount: number;
  
  /** Created date */
  createdAt: string;
  
  /** Updated date */
  updatedAt: string;
}

export interface LibraryStats {
  /** Total items in library */
  totalItems: number;
  
  /** Completed items */
  completedItems: number;
  
  /** In progress items */
  inProgressItems: number;
  
  /** Total time spent (seconds) */
  totalTimeSpent: number;
  
  /** Favorite count */
  favoriteCount: number;
  
  /** Items by category */
  byCategory: Record<string, number>;
  
  /** Items by app */
  byApp: Record<SmartContentApp, number>;
  
  /** Recent activity (last 30 days) */
  recentActivity: {
    itemsAdded: number;
    itemsCompleted: number;
    timeSpent: number;
  };
}

export interface DiscoveryResult {
  /** Content item */
  content: SmartContentQube;
  
  /** Relevance score (0-100) */
  relevanceScore: number;
  
  /** Recommendation reason */
  reason: string;
  
  /** Source of recommendation */
  source: 'similar' | 'trending' | 'new' | 'series' | 'curator' | 'personalized';
}

// =============================================================================
// DEFAULT SHELVES
// =============================================================================

export const DEFAULT_SHELVES = [
  { name: 'Library', description: 'All your content', isSystem: true },
  { name: 'Reading', description: 'Currently reading', isSystem: true },
  { name: 'Watching', description: 'Currently watching', isSystem: true },
  { name: 'Listening', description: 'Currently listening', isSystem: true },
  { name: 'Completed', description: 'Finished content', isSystem: true },
  { name: 'Favorites', description: 'Your favorites', isSystem: true },
  { name: 'Wishlist', description: 'Want to read/watch', isSystem: true },
];

// =============================================================================
// LIBRARY SERVICE
// =============================================================================

export class LibraryService {
  private supabase: SupabaseClient;
  
  constructor(config?: { supabaseUrl?: string; supabaseKey?: string }) {
    const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required for LibraryService');
    }
    
    this.supabase = createClient(url, key);
  }
  
  // ===========================================================================
  // LIBRARY OPERATIONS
  // ===========================================================================
  
  /**
   * Get user's library with optional filters
   */
  async getLibrary(personaId: string, options?: {
    shelfName?: string;
    app?: SmartContentApp;
    category?: string;
    completed?: boolean;
    favorite?: boolean;
    search?: string;
    sortBy?: 'addedAt' | 'lastAccessedAt' | 'title' | 'progress' | 'rating';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{ items: LibraryItem[]; total: number }> {
    // Fetch library items with content (no entitlement join - separate tables)
    let query = this.supabase
      .from('content_library')
      .select(`
        *,
        content:smart_content_qubes(*)
      `, { count: 'exact' })
      .eq('persona_id', personaId);
    
    // Apply filters
    if (options?.shelfName) {
      query = query.eq('shelf_name', options.shelfName);
    }
    if (options?.completed !== undefined) {
      query = query.eq('completed', options.completed);
    }
    if (options?.favorite) {
      query = query.eq('is_favorite', true);
    }
    if (options?.search) {
      // Search in content title/description via join
      query = query.or(`content.title.ilike.%${options.search}%,content.description.ilike.%${options.search}%`);
    }
    
    // Apply sorting
    const sortColumn = {
      addedAt: 'added_at',
      lastAccessedAt: 'last_accessed_at',
      title: 'content.title',
      progress: 'progress_percentage',
      rating: 'user_rating',
    }[options?.sortBy || 'addedAt'] || 'added_at';
    
    query = query.order(sortColumn, { ascending: options?.sortOrder === 'asc' });
    
    // Apply pagination
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to get library: ${error.message}`);
    }
    
    // Fetch entitlements separately for this persona
    const contentIds = (data || []).map((d: any) => d.content_id).filter(Boolean);
    let entitlementsMap: Record<string, any> = {};
    
    if (contentIds.length > 0) {
      const { data: entitlements } = await this.supabase
        .from('content_entitlements')
        .select('*')
        .eq('persona_id', personaId)
        .in('content_id', contentIds);
      
      if (entitlements) {
        entitlementsMap = entitlements.reduce((acc: Record<string, any>, ent: any) => {
          acc[ent.content_id] = ent;
          return acc;
        }, {});
      }
    }
    
    // Filter by app/category after fetch (JSONB filtering)
    let items = (data || []).map((row: any) => 
      this.mapDbToLibraryItem({ ...row, entitlement: entitlementsMap[row.content_id] })
    );
    
    if (options?.app) {
      items = items.filter(item => item.content.app === options.app);
    }
    if (options?.category) {
      items = items.filter(item => item.content.libraryMetadata.category === options.category);
    }
    
    return {
      items,
      total: count || 0,
    };
  }
  
  /**
   * Add content to library
   */
  async addToLibrary(input: {
    personaId: string;
    contentId: string;
    shelfName?: string;
    customShelfId?: string;
  }): Promise<LibraryItem> {
    const { data, error } = await this.supabase
      .from('content_library')
      .upsert({
        persona_id: input.personaId,
        content_id: input.contentId,
        shelf_name: input.shelfName || 'Library',
        custom_shelf_id: input.customShelfId,
        position: 0,
        progress_percentage: 0,
        time_spent_seconds: 0,
        completed: false,
        is_favorite: false,
      }, {
        onConflict: 'persona_id,content_id',
      })
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .single();
    
    if (error) {
      throw new Error(`Failed to add to library: ${error.message}`);
    }
    
    return this.mapDbToLibraryItem(data);
  }
  
  /**
   * Remove content from library
   */
  async removeFromLibrary(personaId: string, contentId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('content_library')
      .delete()
      .eq('persona_id', personaId)
      .eq('content_id', contentId);
    
    return !error;
  }
  
  /**
   * Move content to different shelf
   */
  async moveToShelf(
    personaId: string,
    contentId: string,
    shelfName: string,
    customShelfId?: string
  ): Promise<LibraryItem> {
    const { data, error } = await this.supabase
      .from('content_library')
      .update({
        shelf_name: shelfName,
        custom_shelf_id: customShelfId,
      })
      .eq('persona_id', personaId)
      .eq('content_id', contentId)
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .single();
    
    if (error) {
      throw new Error(`Failed to move to shelf: ${error.message}`);
    }
    
    return this.mapDbToLibraryItem(data);
  }
  
  /**
   * Update progress
   */
  async updateProgress(input: {
    personaId: string;
    contentId: string;
    progressPercentage: number;
    timeSpentSeconds?: number;
  }): Promise<LibraryItem> {
    const updates: Record<string, any> = {
      progress_percentage: Math.min(100, Math.max(0, input.progressPercentage)),
      last_accessed_at: new Date().toISOString(),
    };
    
    // Handle time spent increment
    if (input.timeSpentSeconds) {
      const { data: current } = await this.supabase
        .from('content_library')
        .select('time_spent_seconds')
        .eq('persona_id', input.personaId)
        .eq('content_id', input.contentId)
        .single();
      
      updates.time_spent_seconds = (current?.time_spent_seconds || 0) + input.timeSpentSeconds;
    }
    
    // Mark as completed if 100%
    if (input.progressPercentage >= 100) {
      updates.completed = true;
      updates.completed_at = new Date().toISOString();
      
      // Auto-move to Completed shelf
      updates.shelf_name = 'Completed';
    }
    
    const { data, error } = await this.supabase
      .from('content_library')
      .update(updates)
      .eq('persona_id', input.personaId)
      .eq('content_id', input.contentId)
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .single();
    
    if (error) {
      throw new Error(`Failed to update progress: ${error.message}`);
    }
    
    return this.mapDbToLibraryItem(data);
  }
  
  /**
   * Toggle favorite
   */
  async toggleFavorite(personaId: string, contentId: string): Promise<LibraryItem> {
    // Get current state
    const { data: current } = await this.supabase
      .from('content_library')
      .select('is_favorite')
      .eq('persona_id', personaId)
      .eq('content_id', contentId)
      .single();
    
    const newState = !(current?.is_favorite || false);
    
    const { data, error } = await this.supabase
      .from('content_library')
      .update({ is_favorite: newState })
      .eq('persona_id', personaId)
      .eq('content_id', contentId)
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .single();
    
    if (error) {
      throw new Error(`Failed to toggle favorite: ${error.message}`);
    }
    
    return this.mapDbToLibraryItem(data);
  }
  
  /**
   * Set rating
   */
  async setRating(personaId: string, contentId: string, rating: number): Promise<LibraryItem> {
    const { data, error } = await this.supabase
      .from('content_library')
      .update({ user_rating: Math.min(5, Math.max(1, rating)) })
      .eq('persona_id', personaId)
      .eq('content_id', contentId)
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .single();
    
    if (error) {
      throw new Error(`Failed to set rating: ${error.message}`);
    }
    
    return this.mapDbToLibraryItem(data);
  }
  
  /**
   * Add notes
   */
  async setNotes(personaId: string, contentId: string, notes: string): Promise<LibraryItem> {
    const { data, error } = await this.supabase
      .from('content_library')
      .update({ user_notes: notes })
      .eq('persona_id', personaId)
      .eq('content_id', contentId)
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .single();
    
    if (error) {
      throw new Error(`Failed to set notes: ${error.message}`);
    }
    
    return this.mapDbToLibraryItem(data);
  }
  
  // ===========================================================================
  // SHELF OPERATIONS
  // ===========================================================================
  
  /**
   * Get user's shelves
   */
  async getShelves(personaId: string): Promise<UserShelf[]> {
    const { data, error } = await this.supabase
      .from('user_shelves')
      .select('*')
      .eq('persona_id', personaId)
      .order('position', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get shelves: ${error.message}`);
    }
    
    // Get item counts for each shelf
    const shelves = (data || []).map(this.mapDbToShelf);
    
    // Add default shelves if not present
    const existingNames = new Set(shelves.map(s => s.name));
    for (const defaultShelf of DEFAULT_SHELVES) {
      if (!existingNames.has(defaultShelf.name)) {
        shelves.push({
          id: `system_${defaultShelf.name.toLowerCase()}`,
          name: defaultShelf.name,
          description: defaultShelf.description,
          isPublic: false,
          position: shelves.length,
          itemCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    
    return shelves;
  }
  
  /**
   * Create custom shelf
   */
  async createShelf(input: {
    personaId: string;
    name: string;
    description?: string;
    coverImageUri?: string;
    isPublic?: boolean;
  }): Promise<UserShelf> {
    // Get max position
    const { data: existing } = await this.supabase
      .from('user_shelves')
      .select('position')
      .eq('persona_id', input.personaId)
      .order('position', { ascending: false })
      .limit(1);
    
    const maxPosition = existing?.[0]?.position || 0;
    
    const { data, error } = await this.supabase
      .from('user_shelves')
      .insert({
        persona_id: input.personaId,
        name: input.name,
        description: input.description,
        cover_image_uri: input.coverImageUri,
        is_public: input.isPublic || false,
        position: maxPosition + 1,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create shelf: ${error.message}`);
    }
    
    return this.mapDbToShelf(data);
  }
  
  /**
   * Update shelf
   */
  async updateShelf(shelfId: string, updates: Partial<UserShelf>): Promise<UserShelf> {
    const dbUpdates: Record<string, any> = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.coverImageUri !== undefined) dbUpdates.cover_image_uri = updates.coverImageUri;
    if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
    if (updates.position !== undefined) dbUpdates.position = updates.position;
    
    const { data, error } = await this.supabase
      .from('user_shelves')
      .update(dbUpdates)
      .eq('id', shelfId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update shelf: ${error.message}`);
    }
    
    return this.mapDbToShelf(data);
  }
  
  /**
   * Delete shelf
   */
  async deleteShelf(shelfId: string): Promise<boolean> {
    // Move items to default Library shelf first
    await this.supabase
      .from('content_library')
      .update({ shelf_name: 'Library', custom_shelf_id: null })
      .eq('custom_shelf_id', shelfId);
    
    const { error } = await this.supabase
      .from('user_shelves')
      .delete()
      .eq('id', shelfId);
    
    return !error;
  }
  
  // ===========================================================================
  // STATISTICS
  // ===========================================================================
  
  /**
   * Get library statistics
   */
  async getStats(personaId: string): Promise<LibraryStats> {
    const { data, error } = await this.supabase
      .from('content_library')
      .select(`
        *,
        content:smart_content_qubes(app, library_metadata)
      `)
      .eq('persona_id', personaId);
    
    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
    
    const items = data || [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats: LibraryStats = {
      totalItems: items.length,
      completedItems: items.filter(i => i.completed).length,
      inProgressItems: items.filter(i => !i.completed && i.progress_percentage > 0).length,
      totalTimeSpent: items.reduce((sum, i) => sum + (i.time_spent_seconds || 0), 0),
      favoriteCount: items.filter(i => i.is_favorite).length,
      byCategory: {},
      byApp: {} as Record<SmartContentApp, number>,
      recentActivity: {
        itemsAdded: 0,
        itemsCompleted: 0,
        timeSpent: 0,
      },
    };
    
    // Aggregate by category and app
    for (const item of items) {
      const category = item.content?.library_metadata?.category || 'Uncategorized';
      const app = item.content?.app || 'AgentiQ';
      
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      stats.byApp[app as SmartContentApp] = (stats.byApp[app as SmartContentApp] || 0) + 1;
      
      // Recent activity
      const addedAt = new Date(item.added_at);
      if (addedAt >= thirtyDaysAgo) {
        stats.recentActivity.itemsAdded++;
      }
      
      if (item.completed && item.completed_at) {
        const completedAt = new Date(item.completed_at);
        if (completedAt >= thirtyDaysAgo) {
          stats.recentActivity.itemsCompleted++;
        }
      }
    }
    
    return stats;
  }
  
  // ===========================================================================
  // DISCOVERY
  // ===========================================================================
  
  /**
   * Get content recommendations
   */
  async getRecommendations(personaId: string, options?: {
    limit?: number;
    source?: DiscoveryResult['source'];
  }): Promise<DiscoveryResult[]> {
    const limit = options?.limit || 10;
    const results: DiscoveryResult[] = [];
    
    // Get user's library for context
    const { items: libraryItems } = await this.getLibrary(personaId, { limit: 100 });
    const libraryContentIds = new Set(libraryItems.map(i => i.content.id));
    
    // Get categories user has engaged with
    const userCategories = new Set(libraryItems.map(i => i.content.libraryMetadata.category));
    const userApps = new Set(libraryItems.map(i => i.content.app));
    
    // Fetch similar content (same categories, not in library)
    if (!options?.source || options.source === 'similar') {
      const { data: similar } = await this.supabase
        .from('smart_content_qubes')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .limit(limit);
      
      for (const content of similar || []) {
        if (!libraryContentIds.has(content.id)) {
          const categoryMatch = userCategories.has(content.library_metadata?.category);
          const appMatch = userApps.has(content.app);
          
          if (categoryMatch || appMatch) {
            results.push({
              content: this.mapDbToSmartContent(content),
              relevanceScore: categoryMatch && appMatch ? 90 : categoryMatch ? 70 : 50,
              reason: categoryMatch ? `Similar to content you enjoy` : `From ${content.app}`,
              source: 'similar',
            });
          }
        }
      }
    }
    
    // Fetch trending content
    if (!options?.source || options.source === 'trending') {
      const { data: trending } = await this.supabase
        .from('smart_content_qubes')
        .select('*')
        .eq('status', 'published')
        .eq('library_metadata->>featured', 'true')
        .is('deleted_at', null)
        .limit(limit);
      
      for (const content of trending || []) {
        if (!libraryContentIds.has(content.id) && !results.find(r => r.content.id === content.id)) {
          results.push({
            content: this.mapDbToSmartContent(content),
            relevanceScore: 60,
            reason: 'Trending now',
            source: 'trending',
          });
        }
      }
    }
    
    // Fetch new releases
    if (!options?.source || options.source === 'new') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: newReleases } = await this.supabase
        .from('smart_content_qubes')
        .select('*')
        .eq('status', 'published')
        .gte('published_at', oneWeekAgo.toISOString())
        .is('deleted_at', null)
        .order('published_at', { ascending: false })
        .limit(limit);
      
      for (const content of newReleases || []) {
        if (!libraryContentIds.has(content.id) && !results.find(r => r.content.id === content.id)) {
          results.push({
            content: this.mapDbToSmartContent(content),
            relevanceScore: 55,
            reason: 'New release',
            source: 'new',
          });
        }
      }
    }
    
    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
  
  /**
   * Get series progress
   */
  async getSeriesProgress(personaId: string, seriesId: string): Promise<{
    seriesId: string;
    totalItems: number;
    completedItems: number;
    inProgressItems: number;
    nextItem?: SmartContentQube;
    progressPercentage: number;
  }> {
    // Get all content in series
    const { data: relationships } = await this.supabase
      .from('relationship_qubes')
      .select('source_id, relationship_data')
      .eq('target_id', seriesId)
      .eq('relationship_type', 'series')
      .eq('status', 'active');
    
    const contentIds = (relationships || []).map(r => r.source_id);
    
    if (contentIds.length === 0) {
      return {
        seriesId,
        totalItems: 0,
        completedItems: 0,
        inProgressItems: 0,
        progressPercentage: 0,
      };
    }
    
    // Get library items for these content IDs
    const { data: libraryItems } = await this.supabase
      .from('content_library')
      .select(`
        *,
        content:smart_content_qubes(*)
      `)
      .eq('persona_id', personaId)
      .in('content_id', contentIds);
    
    const items = libraryItems || [];
    const completedItems = items.filter(i => i.completed).length;
    const inProgressItems = items.filter(i => !i.completed && i.progress_percentage > 0).length;
    
    // Find next item (first incomplete in series order)
    const sortedRelationships = (relationships || []).sort((a, b) => {
      const posA = a.relationship_data?.positionInSeries || 0;
      const posB = b.relationship_data?.positionInSeries || 0;
      return posA - posB;
    });
    
    let nextItem: SmartContentQube | undefined;
    for (const rel of sortedRelationships) {
      const libraryItem = items.find(i => i.content_id === rel.source_id);
      if (!libraryItem || !libraryItem.completed) {
        // Fetch the content
        const { data: content } = await this.supabase
          .from('smart_content_qubes')
          .select('*')
          .eq('id', rel.source_id)
          .single();
        
        if (content) {
          nextItem = this.mapDbToSmartContent(content);
          break;
        }
      }
    }
    
    return {
      seriesId,
      totalItems: contentIds.length,
      completedItems,
      inProgressItems,
      nextItem,
      progressPercentage: contentIds.length > 0 
        ? Math.round((completedItems / contentIds.length) * 100) 
        : 0,
    };
  }
  
  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================
  
  private mapDbToLibraryItem(row: any): LibraryItem {
    return {
      id: row.id,
      content: this.mapDbToSmartContent(row.content),
      shelfName: row.shelf_name,
      customShelfId: row.custom_shelf_id,
      position: row.position,
      userRating: row.user_rating,
      userNotes: row.user_notes,
      isFavorite: row.is_favorite,
      progressPercentage: row.progress_percentage,
      timeSpentSeconds: row.time_spent_seconds,
      completed: row.completed,
      completedAt: row.completed_at,
      addedAt: row.added_at,
      lastAccessedAt: row.last_accessed_at,
      entitlement: row.entitlement ? this.mapDbToEntitlement(row.entitlement) : undefined,
    };
  }
  
  private mapDbToShelf(row: any): UserShelf {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageUri: row.cover_image_uri,
      isPublic: row.is_public,
      position: row.position,
      itemCount: 0, // Would need separate count query
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  
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
  
  private mapDbToEntitlement(row: any): ContentEntitlement {
    return {
      id: row.id,
      contentId: row.content_id,
      contentTitle: '',
      scope: row.scope,
      acquiredVia: row.acquired_via,
      txHash: row.tx_hash,
      expiresAt: row.expires_at,
      usageCount: row.usage_count,
      maxUsage: row.max_usage,
      acquiredAt: row.acquired_at,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let serviceInstance: LibraryService | null = null;

export function getLibraryService(): LibraryService {
  if (!serviceInstance) {
    serviceInstance = new LibraryService();
  }
  return serviceInstance;
}
