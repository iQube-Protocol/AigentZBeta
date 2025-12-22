/**
 * LiquidUIService - Reads content from Liquid UI Issue Package v1.4 JSON
 * 
 * This service provides content from the archived Issue Package without
 * touching the existing Codex or SmartWallet systems.
 * 
 * SAFE: This is an ADDITIVE service - no existing code is modified.
 */

import issuePackage from '@/data/templates/qriptopian_episode1_issue_package_v1.4.json';

// Types for the Issue Package structure
export interface LiquidUIContentItem {
  content_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: string;
  content_type: string;
  tags: string[];
  taxonomy: {
    codex: string;
    realm: string;
    series: string;
    dimension: string | null;
    granularity: {
      unit: string;
      equivalents: Record<string, string>;
    };
  };
  modalities: {
    read?: {
      available: boolean;
      duration?: string;
      word_count_approx?: number;
      content_preview?: string;
      content_ref?: {
        type: string;
        ref_id: string;
      };
    };
    watch?: {
      available: boolean;
      type?: string;
      url?: string;
      duration?: string;
    };
    listen?: {
      available: boolean;
      audio_url?: string;
      duration?: string;
    };
    link?: {
      available: boolean;
      url?: string;
      allow_embed?: boolean;
    };
  };
  content_blocks?: Array<{
    type: string;
    level?: number;
    text: string;
  }>;
  thumbnail_asset_id: string;
  render: {
    payloads: {
      thumbnail: Array<{ url: string; w: number; h: number; type: string }>;
      video: Array<{ url: string; type: string }>;
      audio: Array<{ url: string }>;
    };
    text_reader?: {
      enabled: boolean;
      default_mode: string;
      typography_preset: string;
    } | null;
  };
  source: {
    system: string;
    raw_section_refs: string[];
  };
}

export interface LiquidUIPlacement {
  placement_id: string;
  issue_id: string;
  section_id: string;
  tab_id: string | null;
  position: number;
  content_id: string;
}

export interface LiquidUIAsset {
  asset_id: string;
  kind: string;
  url: string;
  provider: string;
  meta: {
    w: number;
    h: number;
    type: string;
    position?: string;
    scale?: number;
    x?: number;
    y?: number;
  };
}

export type ContentSection = 
  | 'home-hero'
  | 'latest-news'
  | 'second-hero'
  | 'pennydrops'
  | 'scrolls'
  | '21knowdz';

export type ContentTab = 
  | 'metaknyts'
  | 'synthsims'
  | 'executive'
  | 'developer'
  | 'creative'
  | null;

// Normalized content item for component consumption
export interface NormalizedContentItem {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  imageScale: number;
  imageX: number;
  imageY: number;
  badge: string;
  position: number;
  modalities: {
    read?: {
      text: string;
      duration: string;
    };
    watch?: {
      video_url: string;
      duration: string;
      type: string;
    };
    listen?: {
      audio_url: string;
      duration: string;
    };
    link?: {
      url: string;
      allow_embed: boolean;
    };
  };
  contentBlocks: Array<{
    type: string;
    level?: number;
    text: string;
  }>;
}

class LiquidUIService {
  private contentItems: LiquidUIContentItem[];
  private placements: LiquidUIPlacement[];
  private assets: LiquidUIAsset[];
  private contentById: Map<string, LiquidUIContentItem>;
  private assetById: Map<string, LiquidUIAsset>;

  constructor() {
    const pkg = issuePackage as any;
    this.contentItems = pkg.collections?.content_items || [];
    this.placements = pkg.collections?.placements || [];
    this.assets = pkg.collections?.assets || [];
    
    // Build lookup maps
    this.contentById = new Map();
    this.contentItems.forEach(item => {
      this.contentById.set(item.content_id, item);
    });
    
    this.assetById = new Map();
    this.assets.forEach(asset => {
      this.assetById.set(asset.asset_id, asset);
    });
  }

  /**
   * Get content items for a specific section and optional tab
   */
  getContentBySection(section: ContentSection, tab?: ContentTab): NormalizedContentItem[] {
    // Find placements for this section/tab
    const relevantPlacements = this.placements.filter(p => {
      if (p.section_id !== section) return false;
      if (tab && p.tab_id !== tab) return false;
      if (!tab && p.tab_id) return false; // If no tab specified, only get items without tabs
      return true;
    });

    // Sort by position
    relevantPlacements.sort((a, b) => a.position - b.position);

    // Map to normalized content items
    return relevantPlacements
      .map(placement => {
        const content = this.contentById.get(placement.content_id);
        if (!content) return null;
        return this.normalizeContentItem(content, placement);
      })
      .filter((item): item is NormalizedContentItem => item !== null);
  }

  /**
   * Get content for sections that have tabs (scrolls, 21knowdz)
   */
  getContentBySectionWithTabs(section: ContentSection, tab: ContentTab): NormalizedContentItem[] {
    const relevantPlacements = this.placements.filter(p => {
      if (p.section_id !== section) return false;
      if (p.tab_id !== tab) return false;
      return true;
    });

    relevantPlacements.sort((a, b) => a.position - b.position);

    return relevantPlacements
      .map(placement => {
        const content = this.contentById.get(placement.content_id);
        if (!content) return null;
        return this.normalizeContentItem(content, placement);
      })
      .filter((item): item is NormalizedContentItem => item !== null);
  }

  /**
   * Get all content for a section regardless of tab
   */
  getAllContentForSection(section: ContentSection): NormalizedContentItem[] {
    const relevantPlacements = this.placements.filter(p => p.section_id === section);
    relevantPlacements.sort((a, b) => a.position - b.position);

    return relevantPlacements
      .map(placement => {
        const content = this.contentById.get(placement.content_id);
        if (!content) return null;
        return this.normalizeContentItem(content, placement);
      })
      .filter((item): item is NormalizedContentItem => item !== null);
  }

  /**
   * Normalize a content item for component consumption
   */
  private normalizeContentItem(content: LiquidUIContentItem, placement: LiquidUIPlacement): NormalizedContentItem {
    // Get thumbnail from asset or payloads
    const asset = this.assetById.get(content.thumbnail_asset_id);
    const thumbnailUrl = asset?.url || content.render?.payloads?.thumbnail?.[0]?.url || '';
    
    // Get image positioning from asset meta
    const imageScale = asset?.meta?.scale || 100;
    const imageX = asset?.meta?.x || 50;
    const imageY = asset?.meta?.y || 50;

    // Build modalities object
    const modalities: NormalizedContentItem['modalities'] = {};
    
    if (content.modalities?.read?.available) {
      // Build full text from content blocks
      const fullText = content.content_blocks
        ?.filter(block => block.text) // Filter out blocks without text
        .map(block => {
          if (block.type === 'heading') return `${'#'.repeat(block.level || 1)} ${block.text}`;
          if (block.type === 'list_item') return `- ${block.text}`;
          return block.text;
        })
        .join('\n\n') || content.modalities.read.content_preview || '';
      
      modalities.read = {
        text: fullText,
        duration: content.modalities.read.duration || '5 min read',
      };
    }
    
    if (content.modalities?.watch?.available && content.modalities.watch.url) {
      modalities.watch = {
        video_url: content.modalities.watch.url,
        duration: content.modalities.watch.duration || '0:00',
        type: content.modalities.watch.type || 'hosted',
      };
    }
    
    if (content.modalities?.listen?.available && content.modalities.listen.audio_url) {
      modalities.listen = {
        audio_url: content.modalities.listen.audio_url,
        duration: content.modalities.listen.duration || '',
      };
    }
    
    if (content.modalities?.link?.available && content.modalities.link.url) {
      modalities.link = {
        url: content.modalities.link.url,
        allow_embed: content.modalities.link.allow_embed || false,
      };
    }

    // Determine badge based on section/tab
    let badge = 'ARTICLE';
    if (placement.section_id === 'pennydrops') badge = 'Q¢';
    else if (placement.tab_id === 'metaknyts') badge = 'METAKNYTS';
    else if (placement.tab_id === 'synthsims') badge = 'SYNTHSIMS';
    else if (placement.tab_id === 'developer') badge = 'DEV';
    else if (placement.tab_id === 'creative') badge = 'CREATIVE';
    else if (placement.tab_id === 'executive') badge = 'EXEC';
    else if (placement.section_id === 'latest-news') badge = 'NEWS';
    else if (placement.section_id === 'home-hero') badge = 'HERO';

    return {
      id: content.content_id.replace('content:', ''),
      title: content.title,
      excerpt: content.excerpt || '',
      image: thumbnailUrl,
      imageScale,
      imageX,
      imageY,
      badge,
      position: placement.position,
      modalities,
      contentBlocks: content.content_blocks || [],
    };
  }

  /**
   * Get a single content item by ID
   */
  getContentById(contentId: string): NormalizedContentItem | null {
    const fullId = contentId.startsWith('content:') ? contentId : `content:${contentId}`;
    const content = this.contentById.get(fullId);
    if (!content) return null;
    
    // Find placement for this content
    const placement = this.placements.find(p => p.content_id === fullId);
    if (!placement) return null;
    
    return this.normalizeContentItem(content, placement);
  }

  /**
   * Get issue metadata
   */
  getIssueMetadata() {
    const pkg = issuePackage as any;
    return {
      issueId: pkg.issue?.issue_id || 'UNKNOWN',
      episode: pkg.issue?.episode || 'Unknown Episode',
      title: pkg.issue?.title || 'Unknown Title',
      theme: pkg.issue?.theme || '',
      status: pkg.issue?.status || 'draft',
      generatedAt: pkg.issue?.generated_at || '',
    };
  }

  /**
   * Get stats about the issue
   */
  getStats() {
    const pkg = issuePackage as any;
    return pkg.collections?.stats || {
      total_content_items: this.contentItems.length,
      by_section: {},
      by_modality: { read: 0, watch: 0, listen: 0, link: 0 },
    };
  }
}

// Export singleton instance
export const liquidUIService = new LiquidUIService();
