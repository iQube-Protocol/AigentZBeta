/**
 * Marketa Experience Cartridge Types
 * 
 * TypeScript definitions for the Marketa marketing orchestrator
 * experience cartridge that can be deployed via Codex.
 */

// =============================================================================
// CORE ENTITIES
// =============================================================================

export interface Partner {
  id: string;
  code: string;
  name: string;
  role_type: string;
  channels: ChannelType[];
  make_webhook_url?: string;
  brand_constraints: Record<string, any>;
  approval_contacts: ContactInfo[];
  created_at: string;
  updated_at: string;
}

export interface ChannelAccount {
  id: string;
  platform: ChannelType;
  credentials: Record<string, any>;
  webhook_urls: string[];
  list_ids: string[];
  is_active: boolean;
  created_at: string;
}

export interface AudienceProfile {
  id: string;
  email?: string;
  phone?: string;
  wallet_address?: string;
  persona_id?: string;
  discord_id?: string;
  telegram_id?: string;
  whatsapp_id?: string;
  investment_tier: number; // 0..4
  engagement_tier: EngagementTier;
  flags: ProfileFlags;
  consent: ConsentSettings;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  phase: CampaignPhase;
  themes: string[];
  start_date?: string;
  end_date?: string;
  primary_cta: string;
  proof_points: string[];
  status: CampaignStatus;
  created_at: string;
}

export interface Pack {
  id: string;
  type: PackType;
  partner_id?: string;
  week_of: string;
  phase: CampaignPhase;
  status: PackStatus;
  version: number;
  created_at: string;
  updated_at: string;
  items?: PackItem[];
  partner?: Partner;
}

export interface PackItem {
  id: string;
  pack_id: string;
  item_type: ItemType;
  thread: ThreadType;
  mode: ModeType;
  content: Record<string, any>;
  platform_variants: Record<PlatformType, ContentVariant>;
  utm_links: UTMLink[];
  assets: CreativeAsset[];
  cta: string;
  created_at: string;
}

export interface DeliveryLog {
  id: string;
  payload_id: string;
  item_id: string;
  platform: PlatformType;
  status: DeliveryStatus;
  post_url?: string;
  error?: string;
  metadata: Record<string, any>;
  created_at: string;
  delivered_at?: string;
}

export interface RewardAction {
  id: string;
  type: RewardType;
  profile_id: string;
  recipient_data: Record<string, any>;
  amount: string;
  network: string;
  reason: string;
  campaign_id?: string;
  status: RewardStatus;
  transaction_hash?: string;
  created_at: string;
}

export interface CRMEvent {
  id: string;
  profile_id: string;
  event_type: CRMEventType;
  campaign_id?: string;
  channel: PlatformType;
  metadata: Record<string, any>;
  created_at: string;
}

// =============================================================================
// ENUMS & TYPES
// =============================================================================

export type ChannelType = 
  | 'buffer' 
  | 'mailjet' 
  | 'discord' 
  | 'telegram' 
  | 'whatsapp' 
  | 'sms';

export type EngagementTier = 'cold' | 'warm' | 'active' | 'advocate';

export interface ProfileFlags {
  mythos_bias: boolean;
  logos_bias: boolean;
  builder_flag: boolean;
  partner_affinity?: string;
}

export interface ConsentSettings {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
}

export type CampaignPhase = 'codex1' | 'regcf' | 'pre_fairlaunch' | 'fairlaunch';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export type PackType = 'owned_wpp' | 'partner_wpp';

export type PackStatus = 'draft' | 'approved' | 'sent' | 'failed';

export type ItemType = 
  | 'hero' 
  | 'short1' 
  | 'short2' 
  | 'short3' 
  | 'newsletter' 
  | 'community' 
  | 'ama_kit';

export type ThreadType = 'mythos' | 'logos' | 'bridge' | 'overlap';

export type ModeType = 'separate' | 'bridge' | 'overlap';

export type PlatformType = 
  | 'linkedin' 
  | 'x' 
  | 'instagram' 
  | 'tiktok' 
  | 'newsletter' 
  | 'discord' 
  | 'telegram' 
  | 'whatsapp' 
  | 'sms';

export interface ContentVariant {
  title?: string;
  body: string;
  hashtags?: string[];
  images?: string[];
  cta?: string;
  character_limit?: number;
}

export interface UTMLink {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export interface CreativeAsset {
  id: string;
  type: 'image' | 'video' | 'document';
  url: string;
  alt?: string;
  aspect_ratio?: string;
  usage_rules?: string[];
  last_used_at?: string;
}

export type DeliveryStatus = 
  | 'pending' 
  | 'queued' 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'bounced' 
  | 'opened' 
  | 'clicked';

export type RewardType = 
  | 'grant_knyt_deferred_mint' 
  | 'grant_qc_credit' 
  | 'grant_badge' 
  | 'grant_perk';

export type RewardStatus = 'pending' | 'issued' | 'failed' | 'expired';

export type CRMEventType = 
  | 'sent' 
  | 'delivered' 
  | 'opened' 
  | 'clicked' 
  | 'purchased' 
  | 'activated' 
  | 'reward_issued' 
  | 'segment_updated';

export interface ContactInfo {
  name: string;
  email: string;
  role?: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// Pack Generation
export interface GeneratePackRequest {
  type: PackType;
  partner_id?: string;
  phase: CampaignPhase;
  channels: PlatformType[];
  week_of: string;
  tone?: string;
  ctas?: string[];
}

export interface GeneratePackResponse {
  pack_id: string;
  preview: PackItem[];
  status: string;
}

// Pack Management
export interface ApprovePackRequest {
  approved_by: string;
  notes?: string;
}

export interface RequestEditsRequest {
  requested_by: string;
  edit_notes: string;
  priority: 'low' | 'medium' | 'high';
}

// Publishing
export interface PublishRequest {
  pack_id: string;
  targets: PublishTarget[];
  dry_run: boolean;
  schedule_at?: string;
}

export interface PublishTarget {
  type: 'owned' | 'partner';
  adapter: PublishingAdapter;
  segment_id?: string;
  channel_id?: string;
  partner_id?: string;
}

export type PublishingAdapter = 
  | 'make_webhook' 
  | 'mailjet' 
  | 'discord_webhook' 
  | 'partner_make' 
  | 'sms' 
  | 'whatsapp' 
  | 'telegram';

export interface PublishResponse {
  publish_id: string;
  results: PublishResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface PublishResult {
  target: PublishTarget;
  status: DeliveryStatus;
  payload_id?: string;
  post_url?: string;
  error?: string;
  published_at?: string;
}

// Segments
export interface SegmentPreviewRequest {
  filters: SegmentFilters;
}

export interface SegmentFilters {
  value_tier?: number[];
  engagement_tier?: EngagementTier[];
  mythos_bias?: boolean;
  logos_bias?: boolean;
  builder_flag?: boolean;
  partner_affinity?: string;
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  whatsapp_opt_in?: boolean;
}

export interface SegmentPreviewResponse {
  count: number;
  sample_profile_ids: string[];
  filters_applied: SegmentFilters;
}

// Rewards
export interface IssueRewardsRequest {
  actions: RewardActionRequest[];
}

export interface RewardActionRequest {
  type: RewardType;
  recipient: {
    wallet?: string;
    persona_id?: string;
    email?: string;
    phone?: string;
  };
  amount: string;
  network?: string;
  reason: string;
  campaign_id?: string;
  vesting_conditions?: Record<string, any>;
}

export interface IssueRewardsResponse {
  reward_ids: string[];
  summary: {
    total_amount: string;
    total_recipients: number;
    by_type: Record<RewardType, number>;
  };
}

// CRM Events
export interface CRMEventRequest {
  profile_id: string;
  event_type: CRMEventType;
  campaign_id?: string;
  channel: PlatformType;
  metadata: Record<string, any>;
}

// Analytics
export interface AnalyticsSummary {
  period: {
    start: string;
    end: string;
  };
  campaigns: {
    total: number;
    active: number;
    completed: number;
  };
  packs: {
    generated: number;
    approved: number;
    sent: number;
  };
  delivery: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  rewards: {
    issued: number;
    total_value: string;
    by_type: Record<RewardType, number>;
  };
}

export interface CampaignMetrics {
  campaign_id: string;
  campaign: Campaign;
  performance: {
    sends: number;
    deliveries: number;
    opens: number;
    clicks: number;
    conversions: number;
    revenue?: string;
  };
  by_channel: Record<PlatformType, Partial<CampaignMetrics['performance']>>;
  by_segment: Record<string, Partial<CampaignMetrics['performance']>>;
}

export interface ChannelPerformance {
  platform: PlatformType;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    sends: number;
    deliveries: number;
    delivery_rate: number;
    opens: number;
    open_rate: number;
    clicks: number;
    click_rate: number;
    cost?: string;
    roi?: number;
  };
  trend: Array<{
    date: string;
    sends: number;
    deliveries: number;
    opens: number;
    clicks: number;
  }>;
}

// =============================================================================
// HELIX GOVERNANCE TYPES
// =============================================================================

export interface HelixConstraints {
  mythos_anchors: string[];
  logos_anchors: string[];
  weekly_ratio: Record<CampaignPhase, {
    mythos: number;
    logos: number;
  }>;
  max_cta_per_item: number;
  required_elements: {
    primary_cta: boolean;
    utm_tracking: boolean;
    brand_compliance: boolean;
  };
}

export interface ContentValidation {
  is_valid: boolean;
  violations: ContentViolation[];
  suggestions: string[];
  score: number; // 0-100
}

export interface ContentViolation {
  type: 'anchor_word' | 'cta_missing' | 'utm_missing' | 'brand_compliance' | 'length_exceeded';
  severity: 'error' | 'warning' | 'info';
  message: string;
  position?: {
    line: number;
    column: number;
  };
}

// =============================================================================
// PERSONALIZATION TYPES
// =============================================================================

export interface PersonalizationRules {
  value_tier: number;
  engagement_tier: EngagementTier;
  flags: ProfileFlags;
  last_activity?: string;
  preferred_channels: PlatformType[];
  frequency_caps: Record<PlatformType, {
    max_per_day: number;
    max_per_week: number;
    last_sent?: string;
  }>;
}

export interface MessageStrategy {
  thread: ThreadType;
  offer: string;
  channel: PlatformType;
  priority: number;
  schedule_at?: string;
  content_template: string;
  personalization_tokens: Record<string, string>;
}

export interface ContentVariant {
  segment_id: string;
  segment_name: string;
  content: {
    subject?: string;
    body: string;
    cta: string;
    images?: string[];
  };
  personalization_applied: string[];
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface DashboardState {
  current_phase: CampaignPhase;
  kpi_data: {
    packs_pending: number;
    packs_approved: number;
    packs_sent: number;
    rewards_issued: number;
  };
  recent_activity: (DeliveryLog | CRMEvent)[];
  loading: boolean;
  error?: string;
}

export interface PartnerFormState {
  partner?: Partner;
  is_editing: boolean;
  is_saving: boolean;
  validation_errors: Record<string, string>;
}

export interface PackWizardState {
  current_step: number;
  pack_data: Partial<GeneratePackRequest>;
  generated_pack?: Pack;
  is_generating: boolean;
  validation_errors: Record<string, string>;
}

export interface PublishState {
  selected_pack?: Pack;
  targets: PublishTarget[];
  is_publishing: boolean;
  publish_results?: PublishResponse;
  dry_run: boolean;
}

export interface SegmentBuilderState {
  filters: SegmentFilters;
  preview?: SegmentPreviewResponse;
  saved_segments: SavedSegment[];
  is_previewing: boolean;
}

export interface SavedSegment {
  id: string;
  name: string;
  description: string;
  filters: SegmentFilters;
  created_at: string;
  usage_count: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type DateRange = {
  start: string;
  end: string;
};

export type SortOption = {
  field: string;
  direction: 'asc' | 'desc';
};

export type FilterOption = {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
};

// =============================================================================
// CONSTANTS
// =============================================================================

export const MARKETA_CONSTANTS = {
  PACK_TYPES: {
    OWNED_WPP: 'owned_wpp',
    PARTNER_WPP: 'partner_wpp'
  },
  CAMPAIGN_PHASES: {
    CODEX1: 'codex1',
    REGCF: 'regcf',
    PRE_FAIRLAUNCH: 'pre_fairlaunch',
    FAIRLAUNCH: 'fairlaunch'
  },
  THREAD_TYPES: {
    MYTHOS: 'mythos',
    LOGOS: 'logos',
    BRIDGE: 'bridge',
    OVERLAP: 'overlap'
  },
  MODE_TYPES: {
    SEPARATE: 'separate',
    BRIDGE: 'bridge',
    OVERLAP: 'overlap'
  },
  PLATFORM_TYPES: {
    LINKEDIN: 'linkedin',
    X: 'x',
    INSTAGRAM: 'instagram',
    TIKTOK: 'tiktok',
    NEWSLETTER: 'newsletter',
    DISCORD: 'discord',
    TELEGRAM: 'telegram',
    WHATSAPP: 'whatsapp',
    SMS: 'sms'
  },
  REWARD_TYPES: {
    KNYT_DEFERRED_MINT: 'grant_knyt_deferred_mint',
    QC_CREDIT: 'grant_qc_credit',
    BADGE: 'grant_badge',
    PERK: 'grant_perk'
  }
} as const;
