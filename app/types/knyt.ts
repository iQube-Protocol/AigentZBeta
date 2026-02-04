/**
 * KNYT Types
 * 
 * Type definitions for KNYT cards, purchases, and Liquid UI
 */

export interface KnytCardAsset {
  id: string;
  title: string;
  episodeNumber: number | null;
  assetKind: 'character_poster' | 'powers_sheet';
  autoDriveCid: string;
  mimeType: string;
  characterId?: string;
  characterName?: string;
  digiterraName?: string;
  affiliation?: string;
  powers?: string;
  primaryWeapon?: string;
}

export interface EpisodeGroup {
  episodeNumber: number;
  displayNumber: string;
  posters: KnytCardAsset[];
  sheets: KnytCardAsset[];
}

export interface KnytPurchase {
  id: string;
  personaId: string;
  assetId: string;
  assetType: 'character_poster' | 'powers_sheet';
  price: number;
  currency: 'knyt' | 'paypal';
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface KnytBalance {
  dvnKnyt: number;
  pendingKnyt: number;
  totalKnyt: number;
  lastUpdated: string;
}

export interface KnytPricing {
  knytUsdRate: number;
  cardPriceStill: number;
  cardPriceMotion: number;
  fiatFeePercent: number;
  fiatPremiumPercent: number;
  knytDiscountPercent: number;
}

// Liquid UI Types for Lovable Integration
export interface KnytLiquidUITemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  geometry: 'drawer' | 'modal' | 'fullscreen';
  device_support: string[];
  intent_triggers: string[];
  ui_components: KnytUIComponent[];
  liquid_template: string;
  fallback_react?: string;
}

export interface KnytUIComponent {
  component_id: string;
  type: string;
  props: Record<string, any>;
  children?: KnytUIComponent[];
}

export interface KnytTemplateSelectionContext {
  user_intent: string;
  device_type: string;
  persona_context?: any;
  session_state?: any;
}

export interface KnytTemplateSelectionResult {
  selected_template: KnytLiquidUITemplate;
  drawer_mode: 'drawer' | 'modal' | 'fullscreen';
  wallet_ui_component?: any;
  copilot_overlay_mode?: 'minimal' | 'full' | 'hidden';
}

export interface KnytLiquidUITemplatePack {
  pack_id: string;
  name: string;
  version: string;
  description: string;
  templates: KnytLiquidUITemplate[];
  last_updated: string;
}
