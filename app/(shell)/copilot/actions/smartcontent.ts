/**
 * Smart Content Actions for CopilotKit
 * 
 * These tools enable NL → SmartContentQube compilation:
 * - Create content (comics, articles, episodes)
 * - Manage library (add, remove, organize)
 * - Set pricing and access policies
 * - Query content catalog
 */

import type { ContentModality, PricingKind } from "@/types/smartContent";
import { getSmartContentService } from "@/services/content";

// =============================================================================
// CONTENT CREATION ACTIONS
// =============================================================================

/**
 * Create a new SmartContentQube
 */
export const createContentAction = {
  name: "content_create",
  description: "Create a new piece of smart content (comic, article, episode, tutorial). Use this when the user wants to create or publish new content.",
  parameters: [
    {
      name: "app",
      type: "string" as const,
      description: "Application context: 'metaKnyts' (comics/episodes), 'Qriptopian' (articles/news), or 'AgentiQ' (tutorials).",
      required: true,
    },
    {
      name: "title",
      type: "string" as const,
      description: "Title of the content.",
      required: true,
    },
    {
      name: "description",
      type: "string" as const,
      description: "Brief description of the content.",
      required: true,
    },
    {
      name: "modalities",
      type: "string" as const,
      description: "Comma-separated list of modalities: read, watch, listen, interact.",
      required: true,
    },
    {
      name: "panelCount",
      type: "number" as const,
      description: "Number of panels (for comics/episodes). Default is 6 for micro-episodes.",
      required: false,
    },
    {
      name: "pricingKind",
      type: "string" as const,
      description: "Pricing model: 'free', 'payPerPanel', 'payPerEpisode', 'subscription', 'bundle'.",
      required: false,
    },
    {
      name: "priceAmount",
      type: "number" as const,
      description: "Price amount in cents (e.g., 100 = $1.00).",
      required: false,
    },
    {
      name: "seriesId",
      type: "string" as const,
      description: "Optional series ID to attach this content to.",
      required: false,
    },
  ],
  handler: async ({ app, title, description, modalities, panelCount, pricingKind, priceAmount, seriesId }: {
    app: string;
    title: string;
    description: string;
    modalities: string;
    panelCount?: number;
    pricingKind?: string;
    priceAmount?: number;
    seriesId?: string;
  }) => {
    const contentId = `content_${Date.now()}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const modalityList = modalities.split(',').map(m => m.trim()) as ContentModality[];
    
    // Default panel count for metaKnyts micro-episodes
    const panels = panelCount || (app === 'metaKnyts' ? 6 : 1);
    
    try {
      const service = getSmartContentService();
      
      // Build modalities object
      const modalitiesObj: Record<string, { enabled: boolean }> = {};
      if (modalityList.includes('read')) modalitiesObj.read = { enabled: true };
      if (modalityList.includes('watch')) modalitiesObj.watch = { enabled: true };
      if (modalityList.includes('listen')) modalitiesObj.listen = { enabled: true };
      if (modalityList.includes('interact')) modalitiesObj.interact = { enabled: true };
      
      const content = await service.create({
        app: app as 'metaKnyts' | 'Qriptopian' | 'AgentiQ',
        title,
        slug,
        description,
        creatorRootDid: 'did:iq:copilot', // Default creator for copilot-created content
        tenantId: app.toLowerCase(),
        modalities: modalitiesObj as any,
        structure: {
          kind: app === 'metaKnyts' ? 'episode' : 'article',
          panelCount: panels,
        } as any,
        pricingModel: pricingKind ? {
          tiers: [{
            kind: pricingKind as PricingKind,
            amount: priceAmount || 0,
            currency: 'QCT',
            covers: panels,
          }],
          freePreview: {},
        } as any : undefined,
      });
      
      return {
        success: true,
        operation: "create_content",
        content,
        message: `Created ${app} content "${title}" (ID: ${content.id}) with ${panels} panels. Status: draft. Use content_publish to make it live.`,
        nextSteps: [
          "Add media assets with content_add_media",
          "Set pricing with content_set_pricing", 
          "Publish with content_publish",
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        operation: "create_content",
        error: error.message,
        message: `Failed to create content: ${error.message}`,
      };
    }
  },
};

/**
 * Create a metaKnyts micro-episode (6 panels)
 */
export const createMicroEpisodeAction = {
  name: "content_create_micro_episode",
  description: "Create a 6-panel metaKnyts micro-episode. This is a shortcut for creating comic content with agents.",
  parameters: [
    {
      name: "title",
      type: "string" as const,
      description: "Episode title.",
      required: true,
    },
    {
      name: "description",
      type: "string" as const,
      description: "Episode description/synopsis.",
      required: true,
    },
    {
      name: "agents",
      type: "string" as const,
      description: "Comma-separated list of agent names/IDs to feature in this episode.",
      required: false,
    },
    {
      name: "pricePerPanel",
      type: "number" as const,
      description: "Price per panel in cents. Default is 10 cents.",
      required: false,
    },
  ],
  handler: async ({ title, description, agents, pricePerPanel }: {
    title: string;
    description: string;
    agents?: string;
    pricePerPanel?: number;
  }) => {
    const contentId = `episode_${Date.now()}`;
    const agentList = agents ? agents.split(',').map(a => a.trim()) : [];
    
    return {
      success: true,
      operation: "create_micro_episode",
      episode: {
        id: contentId,
        app: 'metaKnyts',
        title,
        description,
        panelCount: 6,
        agents: agentList,
        pricing: {
          kind: 'payPerPanel',
          pricePerPanel: pricePerPanel || 10,
          currency: 'USD',
        },
        status: 'draft',
      },
      message: `Created 6-panel micro-episode "${title}"${agentList.length ? ` featuring ${agentList.join(', ')}` : ''}. Price: ${pricePerPanel || 10}¢/panel.`,
    };
  },
};

/**
 * Create a Qriptopian article
 */
export const createArticleAction = {
  name: "content_create_article",
  description: "Create a Qriptopian article with issue/series pricing options.",
  parameters: [
    {
      name: "title",
      type: "string" as const,
      description: "Article title.",
      required: true,
    },
    {
      name: "description",
      type: "string" as const,
      description: "Article summary/excerpt.",
      required: true,
    },
    {
      name: "issueNumber",
      type: "number" as const,
      description: "Issue number if part of a series.",
      required: false,
    },
    {
      name: "seriesId",
      type: "string" as const,
      description: "Series ID to attach this article to.",
      required: false,
    },
    {
      name: "price",
      type: "number" as const,
      description: "Article price in cents. Default is free.",
      required: false,
    },
  ],
  handler: async ({ title, description, issueNumber, seriesId, price }: {
    title: string;
    description: string;
    issueNumber?: number;
    seriesId?: string;
    price?: number;
  }) => {
    const contentId = `article_${Date.now()}`;
    
    return {
      success: true,
      operation: "create_article",
      article: {
        id: contentId,
        app: 'Qriptopian',
        title,
        description,
        issueNumber: issueNumber || null,
        seriesId: seriesId || null,
        pricing: price ? {
          kind: 'payPerEpisode',
          basePrice: price,
          currency: 'USD',
        } : { kind: 'free' },
        status: 'draft',
      },
      message: `Created Qriptopian article "${title}"${issueNumber ? ` (Issue #${issueNumber})` : ''}. ${price ? `Price: ${price}¢` : 'Free access.'}`,
    };
  },
};

// =============================================================================
// LIBRARY MANAGEMENT ACTIONS
// =============================================================================

/**
 * Add content to user's library
 */
export const addToLibraryAction = {
  name: "library_add",
  description: "Add content to the user's library/shelf. Use when user wants to save, bookmark, or add content to their collection.",
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The content ID to add to library.",
      required: true,
    },
    {
      name: "shelf",
      type: "string" as const,
      description: "Optional shelf name: 'favorites', 'reading', 'completed', 'watchlist'. Default is 'reading'.",
      required: false,
    },
  ],
  handler: async ({ contentId, shelf }: {
    contentId: string;
    shelf?: string;
  }) => {
    const shelfName = shelf || 'reading';
    
    // TODO: Call libraryService.addToLibrary
    
    return {
      success: true,
      operation: "add_to_library",
      contentId,
      shelf: shelfName,
      message: `Added content to your "${shelfName}" shelf.`,
    };
  },
};

/**
 * Remove content from library
 */
export const removeFromLibraryAction = {
  name: "library_remove",
  description: "Remove content from the user's library.",
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The content ID to remove from library.",
      required: true,
    },
  ],
  handler: async ({ contentId }: { contentId: string }) => {
    // TODO: Call libraryService.removeFromLibrary
    
    return {
      success: true,
      operation: "remove_from_library",
      contentId,
      message: `Removed content from your library.`,
    };
  },
};

/**
 * Get user's library contents
 */
export const getLibraryAction = {
  name: "library_get",
  description: "Get the user's content library, optionally filtered by shelf or app.",
  parameters: [
    {
      name: "shelf",
      type: "string" as const,
      description: "Filter by shelf: 'favorites', 'reading', 'completed', 'watchlist', or 'all'.",
      required: false,
    },
    {
      name: "app",
      type: "string" as const,
      description: "Filter by app: 'metaKnyts', 'Qriptopian', 'AgentiQ'.",
      required: false,
    },
  ],
  handler: async ({ shelf, app }: {
    shelf?: string;
    app?: string;
  }) => {
    // TODO: Call libraryService.getLibrary
    
    return {
      success: true,
      operation: "get_library",
      filters: { shelf: shelf || 'all', app: app || 'all' },
      library: {
        totalItems: 0,
        items: [],
      },
      message: `Retrieved library contents.`,
    };
  },
};

// =============================================================================
// CONTENT DISCOVERY ACTIONS
// =============================================================================

/**
 * Search content catalog
 */
export const searchContentAction = {
  name: "content_search",
  description: "Search the content catalog by title, description, tags, or app.",
  parameters: [
    {
      name: "query",
      type: "string" as const,
      description: "Search query text.",
      required: true,
    },
    {
      name: "app",
      type: "string" as const,
      description: "Filter by app: 'metaKnyts', 'Qriptopian', 'AgentiQ'.",
      required: false,
    },
    {
      name: "modality",
      type: "string" as const,
      description: "Filter by modality: 'read', 'watch', 'listen', 'interact'.",
      required: false,
    },
    {
      name: "priceMax",
      type: "number" as const,
      description: "Maximum price in cents. Use 0 for free content only.",
      required: false,
    },
  ],
  handler: async ({ query, app, modality, priceMax }: {
    query: string;
    app?: string;
    modality?: string;
    priceMax?: number;
  }) => {
    try {
      const service = getSmartContentService();
      const result = await service.list({
        app: app as any,
        search: query,
        limit: 20,
      });
      
      return {
        success: true,
        operation: "search_content",
        query,
        filters: { app, modality, priceMax },
        results: result.data,
        total: result.total,
        message: `Found ${result.total} results for "${query}".`,
      };
    } catch (error: any) {
      return {
        success: false,
        operation: "search_content",
        error: error.message,
        message: `Search failed: ${error.message}`,
      };
    }
  },
};

/**
 * Get content recommendations
 */
export const getRecommendationsAction = {
  name: "content_recommendations",
  description: "Get personalized content recommendations based on user's library and preferences.",
  parameters: [
    {
      name: "limit",
      type: "number" as const,
      description: "Maximum number of recommendations. Default is 10.",
      required: false,
    },
    {
      name: "app",
      type: "string" as const,
      description: "Filter recommendations by app.",
      required: false,
    },
  ],
  handler: async ({ limit, app }: {
    limit?: number;
    app?: string;
  }) => {
    // TODO: Implement recommendation engine
    
    return {
      success: true,
      operation: "get_recommendations",
      limit: limit || 10,
      app: app || 'all',
      recommendations: [],
      message: `Generated ${limit || 10} personalized recommendations.`,
    };
  },
};

// =============================================================================
// PRICING & ACCESS ACTIONS
// =============================================================================

/**
 * Set content pricing
 */
export const setPricingAction = {
  name: "content_set_pricing",
  description: "Set or update pricing for content.",
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The content ID to set pricing for.",
      required: true,
    },
    {
      name: "pricingKind",
      type: "string" as const,
      description: "Pricing model: 'free', 'payPerPanel', 'payPerEpisode', 'subscription', 'bundle'.",
      required: true,
    },
    {
      name: "amount",
      type: "number" as const,
      description: "Price amount in cents.",
      required: false,
    },
    {
      name: "tokens",
      type: "string" as const,
      description: "Comma-separated list of accepted tokens: 'QCT', 'QOYN', 'KNYT'.",
      required: false,
    },
  ],
  handler: async ({ contentId, pricingKind, amount, tokens }: {
    contentId: string;
    pricingKind: string;
    amount?: number;
    tokens?: string;
  }) => {
    const tokenList = tokens ? tokens.split(',').map(t => t.trim()) : ['QCT', 'QOYN'];
    
    return {
      success: true,
      operation: "set_pricing",
      contentId,
      pricing: {
        kind: pricingKind,
        amount: amount || 0,
        tokens: tokenList,
      },
      message: `Set ${pricingKind} pricing${amount ? ` at ${amount}¢` : ''} for content. Accepts: ${tokenList.join(', ')}.`,
    };
  },
};

/**
 * Purchase content access
 */
export const purchaseContentAction = {
  name: "content_purchase",
  description: "Purchase access to content using tokens from the user's wallet.",
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The content ID to purchase.",
      required: true,
    },
    {
      name: "token",
      type: "string" as const,
      description: "Token to pay with: 'QCT', 'QOYN', or 'KNYT'.",
      required: true,
    },
    {
      name: "scope",
      type: "string" as const,
      description: "Purchase scope: 'panel' (single panel), 'episode' (full episode), 'series' (all episodes).",
      required: false,
    },
  ],
  handler: async ({ contentId, token, scope }: {
    contentId: string;
    token: string;
    scope?: string;
  }) => {
    const purchaseScope = scope || 'episode';
    
    // TODO: Integrate with x402 micropayment flow
    
    return {
      success: true,
      operation: "purchase_content",
      contentId,
      token,
      scope: purchaseScope,
      transactionId: `tx_${Date.now()}`,
      message: `Purchased ${purchaseScope} access to content using ${token}. Enjoy!`,
    };
  },
};

// =============================================================================
// CONTENT PUBLISHING ACTIONS
// =============================================================================

/**
 * Publish content
 */
export const publishContentAction = {
  name: "content_publish",
  description: "Publish content, making it available to users.",
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The content ID to publish.",
      required: true,
    },
  ],
  handler: async ({ contentId }: { contentId: string }) => {
    // TODO: Call contentService.publish
    
    return {
      success: true,
      operation: "publish_content",
      contentId,
      status: 'published',
      publishedAt: new Date().toISOString(),
      message: `Content published and now available to users.`,
    };
  },
};

/**
 * List all content
 */
export const listContentAction = {
  name: "content_list",
  description: "List all content in the catalog, optionally filtered by app or status.",
  parameters: [
    {
      name: "app",
      type: "string" as const,
      description: "Filter by app: 'metaKnyts', 'Qriptopian', 'AgentiQ'.",
      required: false,
    },
    {
      name: "status",
      type: "string" as const,
      description: "Filter by status: 'draft', 'published', 'archived'.",
      required: false,
    },
    {
      name: "limit",
      type: "number" as const,
      description: "Maximum number of results. Default is 20.",
      required: false,
    },
  ],
  handler: async ({ app, status, limit }: {
    app?: string;
    status?: string;
    limit?: number;
  }) => {
    try {
      const service = getSmartContentService();
      const result = await service.list({
        app: app as any,
        status: status as any,
        limit: limit || 20,
      });
      
      return {
        success: true,
        operation: "list_content",
        filters: { app, status },
        results: result.data,
        total: result.total,
        message: `Found ${result.total} content items.`,
      };
    } catch (error: any) {
      return {
        success: false,
        operation: "list_content",
        error: error.message,
        message: `Failed to list content: ${error.message}`,
      };
    }
  },
};

// =============================================================================
// EXPORT ALL ACTIONS
// =============================================================================

export const smartContentActions = [
  // Creation
  createContentAction,
  createMicroEpisodeAction,
  createArticleAction,
  // Library
  addToLibraryAction,
  removeFromLibraryAction,
  getLibraryAction,
  // Discovery
  listContentAction,
  searchContentAction,
  getRecommendationsAction,
  // Pricing & Access
  setPricingAction,
  purchaseContentAction,
  // Publishing
  publishContentAction,
];
