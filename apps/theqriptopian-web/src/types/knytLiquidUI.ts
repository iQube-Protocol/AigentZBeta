/**
 * KNYT Liquid UI Types
 * 
 * Type definitions for the KNYT Codex Liquid UI template system.
 * Supports fixed-viewport layouts with no page scrolling,
 * copilot drawer integration, and Smart Wallet surfaces.
 */

// ============================================================================
// Core Template Types
// ============================================================================

export type KnytTemplateId = 
  | 'knyt:drawer_grid_v1'
  | 'knyt:dual_poster_stage_v1'
  | 'knyt:motion_stage_v1'
  | 'knyt:quest_hud_hub_v1'
  | 'knyt:realm_bridge_map_v1';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type DrawerMode = 'narrow' | 'wide' | 'none';

export type CopilotOverlayMode = 'overlay' | 'docked' | 'collapsed';

export type ZLayer = 'content' | 'chrome' | 'modal';

// ============================================================================
// Content Types (metaKnyts-specific)
// ============================================================================

export type KnytContentType = 
  | 'comic_page_portrait'
  | 'comic_cover_portrait'
  | 'character_portrait'
  | 'motion_comic_landscape'
  | 'lore_snippet'
  | 'terra_update';

export type KnytContentAspect = 'portrait' | 'landscape' | 'mixed';

// ============================================================================
// User Intent & Context
// ============================================================================

export type UserIntent = 
  // Browsing intents
  | 'browse'
  | 'discover'
  | 'quick_switch'
  | 'library'
  // Deep dive intents
  | 'character_deep_dive'
  | 'cover_art'
  | 'page_review'
  | 'collectible_display'
  // Watch intents
  | 'watch'
  | 'immersive_review'
  | 'motion_comics'
  | 'trailers'
  | 'scene_review'
  // Quest/reward intents
  | 'questing'
  | 'ascension'
  | 'earn_rewards'
  | 'member_get_member'
  | 'sales_partnerships'
  | 'guided_paths'
  // Realm navigation
  | 'bridge_real_to_lore'
  | 'realm_navigation'
  // Wallet intents (drawer mode selection)
  | 'claim'
  | 'check_balance'
  | 'quick_status'
  | 'confirm'
  | 'unlock'
  | 'purchase'
  | 'send'
  | 'request'
  | 'invite'
  | 'referral_manage'
  | 'permissions';

export type ContentMix = 
  | 'mixed'
  | 'mostly_portrait'
  | 'portrait_focus'
  | 'motion_focus'
  | 'landscape_focus';

export type TaskState = 'active' | 'needs_guidance' | 'idle' | 'completed';

export type Realm = 'digiterra' | 'terra' | 'metaterra_or';

export type BusinessGoal = 
  | 'engagement'
  | 'conversion'
  | 'retention'
  | 'referral'
  | 'ascension';

// ============================================================================
// Template Selection Context
// ============================================================================

export interface TemplateSelectionContext {
  userIntent: UserIntent;
  device: DeviceType;
  contentMix: ContentMix;
  realm?: Realm;
  attentionBudget?: 'low' | 'medium' | 'high';
  ownershipState?: 'none' | 'partial' | 'full';
  businessGoal?: BusinessGoal;
  taskState?: TaskState;
  isFirstVisit?: boolean;
  personaId?: string;
}

export interface TemplateSelectionResult {
  templateId: KnytTemplateId;
  drawerMode: DrawerMode;
  walletUI: WalletUIComponent[];
  copilotMode: CopilotOverlayMode;
  reason: string;
}

// ============================================================================
// Region & Geometry Types
// ============================================================================

export interface RegionGeometry {
  anchor: 'safe_viewport';
  x: number;  // 0-1 normalized
  y: number;  // 0-1 normalized
  w: number;  // 0-1 normalized width
  h: number;  // 0-1 normalized height
  z: number;  // z-index
  layer: ZLayer;
  entry?: 'slide_from_bottom' | 'dock_right' | 'float';
  dismiss?: 'swipe_down_or_close' | 'click_outside_or_close' | 'close';
}

export interface GeometryVariant {
  name: string;
  when: {
    device: DeviceType[];
  };
  layout: Record<string, RegionGeometry>;
}

export interface TemplateRegion {
  region_id: string;
  role: string;
  cards?: string[];
  modals?: string[];
  components?: string[];
  modes?: CopilotOverlayMode[];
  default?: CopilotOverlayMode | string;
  interaction?: string;
  notes?: string;
  mode?: DrawerMode;
  viewer?: string;
}

// ============================================================================
// Template Definition
// ============================================================================

export interface KnytTemplate {
  template_id: KnytTemplateId;
  name: string;
  origin: string;
  best_for: string[];
  fixed_viewport: boolean;
  regions: TemplateRegion[];
  geometry_variants: GeometryVariant[];
  viewer_bindings?: Record<string, string>;
}

// ============================================================================
// Modal/Card Catalog
// ============================================================================

export interface ModalCatalogItem {
  id: string;
  label: string;
  best_for: string[];
  vh?: number;
  rows?: number;
}

export interface FullScreenDrawer {
  id: string;
  label: string;
  best_for: string[];
}

export interface ModalCatalog {
  cards_and_blocks: ModalCatalogItem[];
  full_screen_drawers: FullScreenDrawer[];
}

// ============================================================================
// Wallet Surface Types
// ============================================================================

export type WalletCardType = 
  | 'wallet_card.balance'
  | 'wallet_card.reward_claim'
  | 'wallet_card.unlock_offer'
  | 'wallet_card.referral_invite'
  | 'wallet_card.task_step';

export type WalletModalType = 
  | 'wallet_modal.checkout'
  | 'wallet_modal.send_request'
  | 'wallet_modal.receipt'
  | 'wallet_modal.permissions';

export type WalletUIComponent = WalletCardType | WalletModalType;

export interface WalletUIItem {
  id: WalletUIComponent;
  best_for: string[];
  prefers_drawer?: DrawerMode;
}

export interface WalletSurface {
  surfaces: {
    copilot_drawer_narrow: {
      description: string;
      default_anchor: string;
      default_entry: string;
      preferred_on: DeviceType[];
    };
    copilot_drawer_wide: {
      description: string;
      default_anchor: string;
      default_entry: string;
      preferred_on: DeviceType[];
    };
  };
  drawer_modes: {
    narrow: {
      mobile_height_norm: number;
      desktop_width_norm: number;
      z: number;
      layer: ZLayer;
    };
    wide: {
      mobile_height_norm: number;
      desktop_width_norm: number;
      z: number;
      layer: ZLayer;
    };
  };
  wallet_ui_catalog: {
    cards: WalletUIItem[];
    modals: WalletUIItem[];
  };
  capability_gates: {
    view_content: { requires_user_confirm: boolean };
    propose_wallet_action: { requires_user_confirm: boolean };
    execute_wallet_action: { 
      requires_user_confirm: boolean;
      default_modal: WalletModalType;
    };
  };
}

// ============================================================================
// Copilot Action Hooks
// ============================================================================

export interface ActionFramework {
  components: string[];
  events: string[];
}

export interface CopilotActionHooks {
  task_framework: ActionFramework;
  rewards_framework: ActionFramework;
  ascension_framework: ActionFramework;
  growth_framework: ActionFramework;
  commerce_framework: ActionFramework;
  wallet_in_codex: {
    surfaces: string[];
    events: string[];
  };
}

// ============================================================================
// Full Template Pack
// ============================================================================

export interface KnytLiquidUITemplatePack {
  schema_version: string;
  generated_at: string;
  domain: string;
  purpose: string;
  sources: {
    content_modal_reference: string;
    notes: string[];
  };
  design_constraints: {
    avoid_page_scroll: boolean;
    allow_scroll_in_modals: boolean;
    copilot_overlay_policy: {
      modes: CopilotOverlayMode[];
      default: CopilotOverlayMode;
      z_layer: ZLayer;
      can_hide_for_immersion: boolean;
    };
    realm_model: {
      codex: string;
      dimensions: Record<string, string>;
    };
  };
  modal_catalog: ModalCatalog;
  content_type_to_modal_defaults: Record<string, {
    primary_viewer?: string;
    primary_cards?: string[];
    fallback_cards?: string[];
    viewer?: string;
    aspect: KnytContentAspect;
  }>;
  template_selection_policy: {
    inputs: string[];
    priority_order: string[];
    rules: Array<{
      when: Record<string, string[]>;
      choose_template: KnytTemplateId;
      why: string;
    }>;
    outputs: string[];
    drawer_rules: Array<{
      when: Record<string, string[]>;
      choose_drawer_mode: DrawerMode;
      mount_wallet_ui: WalletUIComponent[];
      why: string;
    }>;
  };
  templates: KnytTemplate[];
  copilot_action_hooks: CopilotActionHooks;
  wallet_surface: WalletSurface;
}

// ============================================================================
// Content Item Types (for rendering)
// ============================================================================

export interface KnytContentItem {
  id: string;
  type: KnytContentType;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  group?: {
    groupId: string;
    label?: string;
    variantIds?: string[];
  };
  media?: {
    pdf_cid?: string;
    pdf_lite_url?: string;
    video_cid?: string;
    image_cid?: string;
    text?: string;
  };
  metadata?: {
    episodeNumber?: number;
    characterName?: string;
    rarity?: string;
    owned?: boolean;
    price?: number;
    realm?: Realm;
    featured?: boolean;
    drawerGridLayout?: 'featured_left' | 'featured_right';
  };
  modalities?: {
    read?: { available: boolean; cid?: string };
    watch?: { available: boolean; cid?: string; duration?: string };
    listen?: { available: boolean; cid?: string };
  };
}

// ============================================================================
// Rendered Template State
// ============================================================================

export interface RenderedTemplateState {
  templateId: KnytTemplateId;
  activeGeometry: GeometryVariant;
  copilotMode: CopilotOverlayMode;
  drawerMode: DrawerMode;
  drawerOpen: boolean;
  walletUI: WalletUIComponent[];
  contentItems: KnytContentItem[];
  selectedItemId?: string;
  viewerOpen?: {
    type: 'pdf' | 'video' | 'poster' | 'text';
    itemId: string;
  };
}

export interface KnytComposedRegion {
  regionId: string;
  card?: string;
  items: KnytContentItem[];
}

export type DrawerGridLayoutVariant = 'auto' | '1A' | '1B' | '1C' | '2A' | '2B' | '2C' | '3A' | '3B';

export interface KnytComposedScreen {
  templateId: KnytTemplateId;
  device: DeviceType;
  geometry: GeometryVariant;
  regions: Record<string, KnytComposedRegion>;
  meta?: {
    maxVisibleItems?: number;
    motionCap?: number;
    strategy?: string;
    drawerGridLayoutVariant?: DrawerGridLayoutVariant;
  };
}
