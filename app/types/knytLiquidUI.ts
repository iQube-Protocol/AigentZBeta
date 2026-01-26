/**
 * KNYT Liquid UI Types
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Defines types for Liquid UI templates and content rendering.
 */

export type KnytTemplateId = 
  | 'knyt:drawer_grid_v1'
  | 'knyt:character_detail_v1'
  | 'knyt:episode_reader_v1'
  | 'knyt:lore_browser_v1'
  | 'knyt:realm_portal_v1';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type GeometryVariant = 'fixed' | 'responsive' | 'adaptive';

export type DrawerMode = 'none' | 'narrow' | 'wide' | 'full';

export type WalletUIComponent = 
  | 'wallet_card.balance'
  | 'wallet_card.reward_claim'
  | 'wallet_card.quick_actions'
  | 'wallet_card.send_receive'
  | 'wallet_card.transaction_history';

export type CopilotOverlayMode = 'overlay' | 'sidebar' | 'minimal' | 'hidden';

export type Realm = 'digiterra' | 'terra' | 'metaterra_or';

export type UserIntent = 
  | 'browse'
  | 'watch'
  | 'read'
  | 'character_deep_dive'
  | 'page_review'
  | 'collectible_display'
  | 'motion_comics'
  | 'immersive_review'
  | 'trailers'
  | 'scene_review'
  | 'cover_art'
  | 'realm_navigation';

export type DrawerGridLayoutVariant = 
  | 'auto'
  | '1A' | '1B' | '1C'
  | '2A' | '2B' | '2C'
  | '3A' | '3B';

export interface KnytContentItem {
  id: string;
  type: KnytContentType;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  media: {
    image_cid?: string;
    pdf_cid?: string;
    pdf_lite_url?: string;
    video_cid?: string;
    text?: string;
  };
  metadata: {
    episodeNumber?: number;
    characterName?: string;
    rarity?: string;
    owned?: boolean;
    price?: number;
    realm?: Realm;
    featured?: boolean;
    drawerGridLayout?: 'featured_left' | 'featured_right';
    modalities?: any;
  };
  modalities: {
    read?: { available: boolean; cid?: string; duration?: string };
    watch?: { available: boolean; cid?: string; duration?: string };
  };
}

export type KnytContentType = 
  | 'comic_page_portrait'
  | 'motion_comic_landscape'
  | 'character_portrait'
  | 'lore_snippet'
  | 'terra_update'
  | 'comic_cover_portrait';

export interface TemplateSelectionContext {
  userIntent: UserIntent;
  device: DeviceType;
  contentMix: ContentMix;
  realm: Realm;
  taskState: 'idle' | 'active';
  isFirstVisit: boolean;
  personaId?: string;
}

export interface TemplateSelectionResult {
  templateId: KnytTemplateId;
  drawerMode: DrawerMode;
  walletUI: WalletUIComponent[];
  copilotMode: CopilotOverlayMode;
}

export interface ContentMix {
  hasEpisodes: boolean;
  hasCharacters: boolean;
  hasLore: boolean;
  hasMetaKnyts: boolean;
  totalItems: number;
  ownedCount: number;
}

export interface KnytTemplate {
  id: KnytTemplateId;
  name: string;
  description: string;
  geometry: GeometryVariant;
  supportedDevices: DeviceType[];
  triggers: UserIntent[];
  regions: TemplateRegion[];
  meta?: {
    drawerGridLayoutVariant?: DrawerGridLayoutVariant;
  };
}

export interface TemplateRegion {
  id: string;
  type: 'drawer_grid' | 'hero_featured' | 'rail_quests' | 'rail_realms' | 'content_detail';
  items: KnytContentItem[];
  layout?: {
    gridCols?: number;
    aspectRatio?: string;
  };
}

export interface TemplateComposition {
  templateId: KnytTemplateId;
  context: TemplateSelectionContext;
  regions: Record<string, TemplateRegion>;
  meta?: {
    drawerGridLayoutVariant?: DrawerGridLayoutVariant;
  };
}
