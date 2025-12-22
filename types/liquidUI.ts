/**
 * Liquid UI Type Definitions v1.4
 * 
 * Dynamic, contextual UI framework for SmartTriad system.
 * Enables Copilot to compose and render content objects based on:
 * - Spatial coordinates and layout contracts
 * - Device/context-aware geometry variants
 * - Composition rules for dynamic screen assembly
 * - Text reader modal contracts
 * 
 * Integrates with SmartContent, SmartWallet, and SmartMenu.
 */

// =============================================================================
// CORE ENUMS & TYPES
// =============================================================================

/** Codex types */
export type CodexType = 'qriptopian' | 'knyt';

/** Realm types for KNYT Codex */
export type RealmType = 'terra' | 'metaterra_or' | 'digiterra' | 'macro' | 'realworld';

/** Granularity units for content objects */
export type GranularityUnit = 
  | 'issue' 
  | 'episode' 
  | 'page' 
  | 'panel' 
  | 'clip' 
  | 'shot' 
  | 'scene' 
  | 'level' 
  | 'highlight' 
  | 'audio_segment'
  | 'article'
  | 'update'
  | 'story'
  | 'doc';

/** Content types */
export type ContentType = 
  | 'long_form_article'
  | 'news_card'
  | 'scroll_item'
  | 'short_fiction'
  | 'reference_doc'
  | 'video_clip'
  | 'audio_clip'
  | 'interactive';

/** Slot types for rendering */
export type SlotType = 
  | 'hero'
  | 'news_carousel_card'
  | 'grid_card'
  | 'drawer_item'
  | 'wide_row'
  | 'stack_card'
  | 'full_bleed_media'
  | 'sheet';

/** Modal types */
export type ModalType = 'sheet' | 'modal' | 'fullscreen' | 'drawer';

/** Modal sizes */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/** Open/close behaviors */
export type OpenBehavior = 'inline_to_modal' | 'drawer_to_modal' | 'direct';
export type CloseBehavior = 'swipe_or_click' | 'click_only' | 'swipe_only';

/** Device breakpoints */
export type DeviceBreakpoint = 'mobile' | 'tablet' | 'desktop';

/** Context modes */
export type ContextMode = 'browse' | 'read' | 'watch' | 'play' | 'work' | 'lean_back' | 'social';

/** Anchor types for spatial positioning */
export type AnchorType = 
  | 'viewport'
  | 'safe_viewport'
  | 'header'
  | 'smart_menu'
  | 'section_container'
  | 'drawer_container'
  | 'modal_container';

/** Z-layer types */
export type ZLayer = 'background' | 'media' | 'content' | 'chrome' | 'modal' | 'system';

/** Intensity levels */
export type IntensityLevel = 'low' | 'medium' | 'high';

/** Motion bias */
export type MotionBias = 'low' | 'medium' | 'high';

/** Text density */
export type TextDensity = 'low' | 'medium' | 'high';

/** Typography presets */
export type TypographyPreset = 'serif' | 'sans';

/** Scroll behavior */
export type ScrollBehavior = 'continuous' | 'paginated' | 'snap';

/** Business goals */
export type BusinessGoal = 'awareness' | 'retention' | 'conversion' | 'education' | 'activation';

// =============================================================================
// SPATIAL & GEOMETRY
// =============================================================================

/** Alignment configuration */
export interface Alignment {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'center' | 'bottom';
}

/** Spatial coordinates (normalized 0-1) */
export interface SpatialCoordinates {
  /** Coordinate space type */
  coordinate_space: 'normalized';
  /** Anchor reference for positioning */
  anchor: AnchorType;
  /** X position (0-1 normalized) */
  x: number;
  /** Y position (0-1 normalized, can be >1 for scrollable or negative for above anchor) */
  y: number;
  /** Width (0-1 normalized) */
  w: number;
  /** Height (0-1 normalized, can be >1 for scrollable regions) */
  h: number;
  /** Z-index for stacking */
  z: number;
  /** Layer for separation */
  layer: ZLayer;
  /** Alignment within the space */
  alignment: Alignment;
}

/** Condition for when a geometry variant applies */
export interface GeometryCondition {
  /** Device breakpoints this applies to */
  device: DeviceBreakpoint[];
  /** Context modes this applies to */
  context: ContextMode[];
}

/** Geometry variant for responsive layouts */
export interface GeometryVariant {
  /** Variant name */
  name: string;
  /** Conditions when this variant applies */
  when: GeometryCondition;
  /** Spatial coordinates for this variant */
  spatial: SpatialCoordinates;
  /** Aspect ratio (e.g., "21:9", "4:5") */
  aspect_ratio?: string;
  /** Implementation notes */
  notes?: string;
}

/** Safe area percentages */
export interface SafeAreaPct {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Preferred slot configuration */
export interface PreferredSlot {
  /** Slot type */
  slot_type: SlotType;
  /** Priority (1 = highest) */
  priority: number;
  /** Minimum width in pixels */
  min_width_px: number;
  /** Minimum height in pixels */
  min_height_px: number;
  /** Aspect ratio */
  aspect_ratio: string;
  /** Whether overlay text is supported */
  supports_overlay_text: boolean;
  /** Safe area percentages */
  safe_area_pct?: SafeAreaPct;
}

// =============================================================================
// MODAL & BREAKPOINT CONFIGURATION
// =============================================================================

/** Modal preferences */
export interface ModalPreferences {
  /** Default modal type */
  default_modal: ModalType;
  /** Available modal sizes */
  modal_sizes: ModalSize[];
  /** Open behavior */
  open_behavior: OpenBehavior;
  /** Close behavior */
  close_behavior: CloseBehavior;
}

/** Breakpoint configuration */
export interface BreakpointConfig {
  /** Preferred slot types for this breakpoint */
  preferred_slot_types: SlotType[];
  /** Maximum columns */
  max_columns: number;
}

/** Breakpoints configuration */
export interface Breakpoints {
  mobile: BreakpointConfig;
  tablet: BreakpointConfig;
  desktop: BreakpointConfig;
}

// =============================================================================
// PAYLOADS & ASSETS
// =============================================================================

/** Media payload (thumbnail, video, audio) */
export interface MediaPayload {
  /** URL to the asset */
  url: string;
  /** Width in pixels */
  w: number;
  /** Height in pixels */
  h: number;
  /** MIME type */
  type: string;
  /** Duration for video/audio */
  duration?: string;
}

/** Payloads configuration */
export interface Payloads {
  thumbnail: MediaPayload[];
  video: MediaPayload[];
  audio: MediaPayload[];
}

/** Realm style hint */
export interface RealmStyleHint {
  /** Realm this applies to */
  realm: RealmType | 'macro';
  /** Motion bias preference */
  motion_bias: MotionBias;
  /** Text density preference */
  text_density: TextDensity;
  /** Preferred aspect ratios */
  preferred_aspect_ratios: string[];
}

// =============================================================================
// TEXT READER
// =============================================================================

/** Text reader controls */
export interface TextReaderControls {
  show_progress: boolean;
  show_font_controls: boolean;
  show_share: boolean;
}

/** Text reader content display overrides */
export interface TextReaderDisplayOverrides {
  show_title: boolean;
  show_cover_image: boolean;
  show_toc: boolean;
}

/** Text reader configuration */
export interface TextReader {
  /** Whether text reader is enabled */
  enabled: boolean;
  /** Default reader mode */
  default_mode: 'sheet_reader' | 'fullscreen_reader';
  /** Typography preset */
  typography_preset: TypographyPreset;
  /** Scroll behavior */
  scroll_behavior: ScrollBehavior;
  /** Controls configuration */
  controls: TextReaderControls;
  /** Content display overrides */
  content_display_overrides: TextReaderDisplayOverrides;
  /** Geometry variants for the reader */
  geometry_variants: GeometryVariant[];
}

// =============================================================================
// RENDER CONTRACT
// =============================================================================

/** Complete render contract for a content object */
export interface RenderContract {
  /** Preferred slots for rendering */
  preferred_slots: PreferredSlot[];
  /** Modal preferences */
  modal_preferences: ModalPreferences;
  /** Breakpoint configurations */
  breakpoints: Breakpoints;
  /** Geometry variants for different contexts */
  geometry_variants: GeometryVariant[];
  /** Media payloads */
  payloads: Payloads;
  /** Realm style hint */
  realm_style_hint: RealmStyleHint;
  /** Default spatial coordinates */
  spatial: SpatialCoordinates;
  /** Text reader configuration (for read modality) */
  text_reader?: TextReader;
}

// =============================================================================
// COMPOSITION RULES
// =============================================================================

/** Pairing rules for composition */
export interface PairingRules {
  /** Content types/taxonomies this pairs well with */
  prefers_with: string[];
  /** Content types/taxonomies to avoid pairing with */
  avoids_with: string[];
  /** Maximum neighbors in a layout */
  max_neighbors: number;
}

/** Sequence rules for composition */
export interface SequenceRules {
  /** Good as intro/opening content */
  good_as_intro: boolean;
  /** Good as interstitial content */
  good_as_interstitial: boolean;
  /** Good as closing content */
  good_as_closer: boolean;
}

/** Attention budget */
export interface AttentionBudget {
  /** Estimated consumption time in seconds */
  estimated_seconds: number;
  /** Intensity level */
  intensity: IntensityLevel;
}

/** Composition rules for dynamic screen assembly */
export interface CompositionRules {
  /** Pairing rules */
  pairing_rules: PairingRules;
  /** Sequence rules */
  sequence_rules: SequenceRules;
  /** Attention budget */
  attention_budget: AttentionBudget;
}

// =============================================================================
// TAXONOMY & GRANULARITY
// =============================================================================

/** Granularity configuration */
export interface Granularity {
  /** Primary unit type */
  unit: GranularityUnit;
  /** Equivalent units (e.g., page ⇄ clip for motion comics) */
  equivalents: Record<string, string>;
}

/** Taxonomy configuration */
export interface Taxonomy {
  /** Codex type */
  codex: CodexType;
  /** Realm */
  realm: RealmType | 'macro';
  /** Series name */
  series: string | null;
  /** Dimension (for Kn0wdZ: executive, marketing, developer, operator, creative) */
  dimension: string | null;
  /** Granularity */
  granularity: Granularity;
}

// =============================================================================
// MODALITIES
// =============================================================================

/** Content reference */
export interface ContentRef {
  type: 'inline_blocks' | 'external' | 'asset';
  ref_id: string;
}

/** Read modality */
export interface ReadModality {
  available: boolean;
  duration?: string | null;
  word_count_approx?: number | null;
  content_preview?: string | null;
  content_ref?: ContentRef;
}

/** Watch modality */
export interface WatchModality {
  available: boolean;
  type?: 'hosted' | 'embed' | 'external' | null;
  url?: string | null;
  duration?: string | null;
}

/** Listen modality */
export interface ListenModality {
  available: boolean;
  audio_url?: string | null;
  duration?: string | null;
}

/** Link modality */
export interface LinkModality {
  available: boolean;
  url?: string | null;
  allow_embed?: boolean;
}

/** All modalities */
export interface Modalities {
  read: ReadModality;
  watch: WatchModality;
  listen: ListenModality;
  link: LinkModality;
}

// =============================================================================
// RELATIONSHIPS
// =============================================================================

/** Content relationships */
export interface Relationships {
  prequels: string[];
  sequels: string[];
  bridges_to: string[];
  references: string[];
  contains: string[];
  contained_by: string[];
}

// =============================================================================
// SMARTMEDIA DIRECTIVES
// =============================================================================

/** Best context configuration */
export interface BestContext {
  device: DeviceBreakpoint[];
  mode: ContextMode[];
  time_of_day: string[];
}

/** SmartMedia directives */
export interface SmartMediaDirectives {
  /** Best modalities to consume this content */
  best_consumed_as: ('read' | 'watch' | 'listen' | 'link' | 'interactive')[];
  /** Best context for consumption */
  best_context: BestContext;
  /** Target audience segments */
  audience_targets: string[];
  /** Business goal */
  business_goal: BusinessGoal;
}

/** SmartMedia configuration */
export interface SmartMedia {
  directives: SmartMediaDirectives;
}

// =============================================================================
// INTELLIGENCE
// =============================================================================

/** Intelligence configuration */
export interface Intelligence {
  /** Clustered Aigent ID for this content */
  clustered_aigent_id: string | null;
  /** Capabilities available */
  capabilities: string[];
}

// =============================================================================
// MONETIZATION
// =============================================================================

/** Q¢ pricing model */
export interface QCentPricing {
  model: 'free' | 'free_preview_then_unlock' | 'pay_per_view' | 'subscription';
  preview_seconds?: number;
  unlock_price_qcent?: number;
}

/** Revenue split */
export interface RevSplit {
  party: string;
  pct: number;
}

/** Reward hook */
export interface RewardHook {
  type: 'read_complete' | 'watch_complete' | 'share' | 'referral';
  reward: string;
  note?: string;
}

/** Monetization configuration */
export interface Monetization {
  qcent_pricing: QCentPricing | null;
  rev_split: RevSplit[];
  reward_hooks: RewardHook[];
}

// =============================================================================
// CONTENT BLOCKS
// =============================================================================

/** Content block types */
export type ContentBlockType = 'heading' | 'paragraph' | 'image' | 'quote' | 'code' | 'list';

/** Content block */
export interface ContentBlock {
  type: ContentBlockType;
  level?: number; // For headings
  text?: string;
  src?: string; // For images
  alt?: string; // For images
  items?: string[]; // For lists
  language?: string; // For code
}

// =============================================================================
// LIQUID UI CONTENT OBJECT
// =============================================================================

/** Complete Liquid UI Content Object */
export interface LiquidUIContentObject {
  /** Content ID */
  content_id: string;
  /** URL-friendly slug */
  slug: string;
  /** Title */
  title: string;
  /** Excerpt/summary */
  excerpt: string;
  /** Status */
  status: 'draft' | 'published' | 'archived';
  /** Content type */
  content_type: ContentType;
  /** Tags */
  tags: string[];
  /** Taxonomy */
  taxonomy: Taxonomy;
  /** Modalities */
  modalities: Modalities;
  /** Thumbnail asset ID */
  thumbnail_asset_id: string | null;
  /** Relationships */
  relationships: Relationships;
  /** SmartMedia configuration */
  smartmedia: SmartMedia;
  /** Render contract */
  render: RenderContract;
  /** Composition rules */
  composition: CompositionRules;
  /** Intelligence configuration */
  intelligence: Intelligence;
  /** Monetization */
  monetization: Monetization;
  /** Source information */
  source: {
    system: string;
    raw_section_refs: string[];
  };
  /** Content blocks (for inline content) */
  content_blocks?: ContentBlock[];
}

// =============================================================================
// ISSUE PACKAGE
// =============================================================================

/** Section configuration */
export interface Section {
  section_id: string;
  description: string;
  display: string;
  type: 'carousel' | 'drawer' | 'drawer_tabs' | 'grid';
  tabs: Array<{
    tab_id: string;
    description: string;
    display: string;
  }>;
}

/** Placement configuration */
export interface Placement {
  placement_id: string;
  issue_id: string;
  section_id: string;
  tab_id: string | null;
  position: number;
  content_id: string;
}

/** Asset configuration */
export interface Asset {
  asset_id: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
  provider: string;
  meta: {
    w: number;
    h: number;
    type: string;
    duration?: string;
  };
}

/** Layout tokens */
export interface LayoutTokens {
  gutter_px: Record<DeviceBreakpoint, number>;
  radius_px: Record<'mobile' | 'desktop', number>;
  max_columns: Record<DeviceBreakpoint, number>;
}

/** Liquid UI profile for issue-level configuration */
export interface LiquidUIProfile {
  /** Default layout mode */
  default_layout_mode: 'contextual_grid' | 'fixed' | 'adaptive';
  /** Priority order for layout decisions */
  priority_order: string[];
  /** Safe area policy */
  safe_area_policy: 'strict' | 'relaxed';
  /** Maximum concurrent modals */
  max_concurrent_modals: number;
  /** Z-layer order */
  z_layers: ZLayer[];
  /** Layout tokens */
  layout_tokens: LayoutTokens;
}

/** Collections within an issue */
export interface Collections {
  sections: Section[];
  content_items: LiquidUIContentObject[];
  placements: Placement[];
  assets: Asset[];
  indexes: {
    by_section_tab: Record<string, string[]>;
    by_taxonomy: Record<string, any>;
    by_slug: Record<string, string>;
    by_content_id: Record<string, any>;
  };
  stats: any | null;
  editorial_notes: Record<string, string>;
}

/** Issue metadata */
export interface IssueMeta {
  issue_id: string;
  episode: string;
  title: string;
  generated_at: string;
  status: 'draft' | 'published' | 'archived';
  theme: string;
  notes?: string;
}

/** Publication metadata */
export interface PublicationMeta {
  name: string;
  domain: string;
}

/** World model for realms */
export interface WorldModel {
  knyt_codex_realms: Record<string, {
    alias: string;
    tone: string;
    purpose: string;
    primary_surface: string;
  }>;
}

/** Text reader profile */
export interface TextReaderProfile {
  default_reader: string;
  reader_modes: string[];
  typography_presets: Record<TypographyPreset, {
    base_font: string;
    base_px: Record<'mobile' | 'desktop', number>;
    line_height: number;
    max_width_px: number;
  }>;
  content_display_defaults: {
    show_title: boolean;
    show_subtitle: boolean;
    show_byline: boolean;
    show_cover_image: boolean;
    show_toc: boolean;
    paragraph_spacing: string;
    link_style: string;
    quote_style: string;
    code_style: string;
  };
}

/** Complete Issue Package */
export interface IssuePackage {
  /** Schema version */
  schema_version: string;
  /** Publication metadata */
  publication: PublicationMeta;
  /** Issue metadata */
  issue: IssueMeta;
  /** Codex import context */
  codex_import_context?: {
    upsert_keys: Record<string, string[]>;
    routing_rules?: Record<string, any>;
    note?: string;
  };
  /** Liquid UI profile */
  liquid_ui_profile: LiquidUIProfile;
  /** Templates (for template packages) */
  templates?: Record<string, any>;
  /** Collections */
  collections: Collections;
  /** Compatibility info */
  compatibility: {
    supported_versions: string[];
    supersedes: string;
    notes: string[];
  };
  /** World model */
  world_model?: WorldModel;
  /** Text reader profile */
  text_reader_profile?: TextReaderProfile;
}

// =============================================================================
// COPILOT LAYOUT ENGINE TYPES
// =============================================================================

/** Layout decision context */
export interface LayoutContext {
  /** Current device */
  device: DeviceBreakpoint;
  /** Current context mode */
  mode: ContextMode;
  /** User intent (from prompt or action) */
  user_intent?: string;
  /** Current realm */
  realm?: RealmType;
  /** Available viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };
}

/** Layout decision result */
export interface LayoutDecision {
  /** Selected geometry variant */
  variant: GeometryVariant;
  /** Computed CSS styles */
  styles: {
    position: string;
    top: string;
    left: string;
    width: string;
    height: string;
    zIndex: number;
  };
  /** Selected slot type */
  slotType: SlotType;
  /** Whether to show in modal */
  useModal: boolean;
  /** Modal configuration if applicable */
  modalConfig?: ModalPreferences;
}

/** Composition decision for multiple objects */
export interface CompositionDecision {
  /** Ordered content objects */
  objects: LiquidUIContentObject[];
  /** Layout for each object */
  layouts: LayoutDecision[];
  /** Total attention budget */
  totalAttentionSeconds: number;
  /** Composition notes */
  notes: string[];
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/** Create default spatial coordinates */
export function createDefaultSpatial(): SpatialCoordinates {
  return {
    coordinate_space: 'normalized',
    anchor: 'safe_viewport',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    z: 1,
    layer: 'content',
    alignment: { horizontal: 'center', vertical: 'top' },
  };
}

/** Create default render contract */
export function createDefaultRenderContract(): RenderContract {
  return {
    preferred_slots: [],
    modal_preferences: {
      default_modal: 'sheet',
      modal_sizes: ['md', 'lg'],
      open_behavior: 'inline_to_modal',
      close_behavior: 'swipe_or_click',
    },
    breakpoints: {
      mobile: { preferred_slot_types: ['stack_card'], max_columns: 1 },
      tablet: { preferred_slot_types: ['grid_card'], max_columns: 2 },
      desktop: { preferred_slot_types: ['grid_card'], max_columns: 4 },
    },
    geometry_variants: [],
    payloads: { thumbnail: [], video: [], audio: [] },
    realm_style_hint: {
      realm: 'terra',
      motion_bias: 'medium',
      text_density: 'medium',
      preferred_aspect_ratios: ['16:9', '4:5'],
    },
    spatial: createDefaultSpatial(),
  };
}

/** Create default composition rules */
export function createDefaultCompositionRules(): CompositionRules {
  return {
    pairing_rules: {
      prefers_with: [],
      avoids_with: [],
      max_neighbors: 2,
    },
    sequence_rules: {
      good_as_intro: false,
      good_as_interstitial: true,
      good_as_closer: false,
    },
    attention_budget: {
      estimated_seconds: 60,
      intensity: 'medium',
    },
  };
}
