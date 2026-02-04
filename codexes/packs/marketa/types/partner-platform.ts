/**
 * AgentiQ Marketa Platform Types
 * Comprehensive type definitions for the enhanced Marketa platform
 * Including partner platform, sequence campaigns, and custom campaigns
 */

// =============================================================================
// CORE CAMPAIGN TYPES
// =============================================================================

export type CampaignType = 'wpp' | 'custom' | 'sequence';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type HelixThread = 'mythos' | 'logos' | 'bridge' | 'overlap';

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  phase?: string;
  budget?: number;
  primary_cta?: string;
  secondary_cta?: string;
  helix_thread?: HelixThread;
  sequence_length?: number;
  sequence_config?: Record<string, any>;
  asset_refs?: string[];
  qrp_smart_action_refs?: string[];
  created_by_persona_id?: string;
  approved_by_persona_id?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// SEQUENCE CAMPAIGN TYPES
// =============================================================================

export interface SequenceItem {
  id: string;
  campaign_id: string;
  day_number: number;
  title: string;
  description?: string;
  asset_ref: string;
  copy_variants: Record<string, string>;
  cta_url?: string;
  explainer: boolean;
  thumbnail_url?: string;
  duration_seconds?: number;
  tags: string[];
  status: 'draft' | 'ready' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface SequenceConfig {
  theme: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_days: number;
  auto_advance: boolean;
  reminder_enabled: boolean;
  completion_reward?: RewardConfig;
}

// =============================================================================
// TENANT CONFIGURATION TYPES
// =============================================================================

export type PublishingMode = 'make' | 'manual' | 'community';
export type TenantConfigStatus = 'joined' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface TenantCampaignConfig {
  id: string;
  campaign_id: string;
  tenant_id: string;
  start_date: string;
  time_of_day: string;
  channels: string[];
  publishing_mode: PublishingMode;
  make_webhook_url?: string;
  make_webhook_secret?: string;
  brand_constraints?: Record<string, any>;
  status: TenantConfigStatus;
  current_day: number;
  last_dispatch_at?: string;
  next_dispatch_at?: string;
  joined_at: string;
  joined_by_persona_id?: string;
  paused_at?: string;
  paused_by_persona_id?: string;
  completed_at?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// PARTNER REWARDS TYPES
// =============================================================================

export type RewardType = 'coupon' | 'claim_link' | 'access' | 'discount';

export interface PartnerReward {
  id: string;
  campaign_id: string;
  tenant_id: string;
  reward_type: RewardType;
  reward_value: string;
  reward_terms?: string;
  reward_claim_url?: string;
  reward_code?: string;
  active: boolean;
  max_uses?: number;
  current_uses: number;
  expires_at?: string;
  created_by_persona_id?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface RewardConfig {
  type: RewardType;
  value: string;
  terms?: string;
  claim_url?: string;
  expires_at?: string;
}

// =============================================================================
// PACK WORKFLOW TYPES (WPP)
// =============================================================================

export type PackStatus = 'draft' | 'submitted' | 'review' | 'approved' | 'rejected' | 'published' | 'archived';
export type PackStage = 'creation' | 'review' | 'approval' | 'publishing' | 'live';

export interface PackWorkflow {
  id: string;
  pack_id: string;
  tenant_id: string;
  status: PackStatus;
  current_stage: PackStage;
  pack_content: Record<string, any>;
  review_feedback: ReviewFeedback[];
  edit_requests: EditRequest[];
  created_by_persona_id?: string;
  reviewed_by_persona_id?: string;
  approved_by_persona_id?: string;
  created_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  published_at?: string;
  metadata?: Record<string, any>;
}

export interface ReviewFeedback {
  section: string;
  feedback: string;
  severity: 'info' | 'warning' | 'error';
  created_at: string;
  created_by: string;
}

export interface EditRequest {
  section: string;
  current_content: string;
  requested_change: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

// =============================================================================
// DELIVERY LOG TYPES
// =============================================================================

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
export type WebhookStatus = 'pending' | 'success' | 'failed' | 'timeout' | 'retry';

export interface DeliveryLog {
  id: string;
  tenant_id: string;
  campaign_id: string;
  campaign_type?: CampaignType;
  sequence_day?: number;
  platform: string;
  status: DeliveryStatus;
  published_at?: string;
  publishing_mode?: PublishingMode;
  webhook_payload?: Record<string, any>;
  webhook_response?: Record<string, any>;
  webhook_status?: WebhookStatus;
  webhook_attempts: number;
  make_webhook_url?: string;
  correlation_id?: string;
  engagement_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// WEBHOOK TESTING TYPES
// =============================================================================

export type WebhookTestStatus = 'pending' | 'success' | 'failed' | 'timeout';

export interface WebhookTest {
  id: string;
  tenant_id: string;
  webhook_url: string;
  webhook_secret?: string;
  test_status: WebhookTestStatus;
  response_code?: number;
  response_body?: string;
  response_time_ms?: number;
  error_message?: string;
  test_payload: Record<string, any>;
  signature_header?: string;
  tested_by_persona_id?: string;
  tested_at: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// LVB BRIDGE API TYPES
// =============================================================================

export interface BridgeRequest {
  action: string;
  [key: string]: any;
}

export interface BridgeResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Configuration Actions
export interface ConfigResponse {
  tenant_id: string;
  persona_id: string;
  role: string;
  permissions: string[];
  tenant_name: string;
  tenant_type: string;
  feature_flags: {
    custom_campaigns: boolean;
    sequence_campaigns: boolean;
    partner_rewards: boolean;
    make_integration: boolean;
    pack_approval: boolean;
  };
  make_config: {
    enabled: boolean;
    webhook_configured: boolean;
  };
}

// Campaign Catalog Response
export interface CampaignCatalogResponse {
  success: boolean;
  available_campaigns: Campaign[];
  joined_campaigns: Array<TenantCampaignConfig & { marketa_campaigns: Campaign }>;
  total_available: number;
  total_joined: number;
}

// Campaign Join Request
export interface JoinCampaignRequest {
  campaignId: string;
  channels: string[];
  startDate: string;
  timeOfDay?: string;
  publishingMode?: PublishingMode;
  makeWebhookUrl?: string;
  makeWebhookSecret?: string;
}

// Webhook Test Request
export interface WebhookTestRequest {
  makeWebhookUrl: string;
  makeWebhookSecret?: string;
}

export interface WebhookTestResult {
  status: WebhookTestStatus;
  response_code?: number;
  response_time_ms?: number;
  error_message?: string;
}

// Make Setup Guide Response
export interface MakeSetupGuide {
  title: string;
  description: string;
  steps: Array<{
    step: number;
    title: string;
    description: string;
    details: string[];
  }>;
  webhook_payload_example: {
    campaign_id: string;
    sequence_item: Partial<SequenceItem>;
    tenant_config: {
      channels: string[];
      utm_parameters: Record<string, string>;
    };
  };
  troubleshooting: Array<{
    issue: string;
    solution: string;
  }>;
  support: {
    documentation: string;
    contact: string;
    community: string;
  };
}

// =============================================================================
// ADMIN API TYPES
// =============================================================================

export interface AdminCampaignRequest {
  name: string;
  description?: string;
  campaign_type: CampaignType;
  helix_thread?: HelixThread;
  primary_cta?: string;
  secondary_cta?: string;
  sequence_length?: number;
  participating_tenants?: string[];
  start_date?: string;
  metadata?: Record<string, any>;
}

export interface SequenceItemRequest {
  day_number: number;
  title: string;
  description?: string;
  asset_ref: string;
  copy_variants?: Record<string, string>;
  cta_url?: string;
  explainer?: boolean;
  thumbnail_url?: string;
  duration_seconds?: number;
  tags?: string[];
}

export interface MultiTenantDeploymentRequest {
  campaign_id: string;
  participating_tenants: string[];
  deployment_config?: {
    auto_join?: boolean;
    default_start_date?: string;
    default_channels?: string[];
    default_time_of_day?: string;
    default_publishing_mode?: PublishingMode;
  };
}

// =============================================================================
// SEQUENCE DISPATCH TYPES
// =============================================================================

export interface DispatchPayload {
  campaign_id: string;
  sequence_item: SequenceItem;
  tenant_config: TenantCampaignConfig;
  correlation_id: string;
  dispatch_timestamp: string;
}

export interface DispatchResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

// =============================================================================
// PERFORMANCE ANALYTICS TYPES
// =============================================================================

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  tenant_id: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
  revenue: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
  created_at: string;
  updated_at: string;
}

export interface TenantPerformanceAggregate {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_conversions: number;
  total_revenue: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export interface PerformanceInsights {
  performance_trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  next_action: string;
  optimization_suggestions: string[];
  top_performing_channels: string[];
  best_posting_times: string[];
}

// =============================================================================
// PERSONA AND AUTHENTICATION TYPES
// =============================================================================

export interface PersonaContext {
  personaId: string;
  tenantId: string;
  role: 'partnerAdmin' | 'agqAdmin' | 'analyst' | 'viewer';
  permissions: string[];
}

export interface Persona {
  id: string;
  tenant_id: string;
  display_name: string;
  email: string;
  external_user_id: string;
  persona_state: 'anonymous' | 'pseudonymous' | 'identifiable';
  identity_persona_id?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DateRange = {
  start: string;
  end: string;
};

export type PaginationParams = {
  limit?: number;
  offset?: number;
};

export type SortParams = {
  field: string;
  direction: 'asc' | 'desc';
};

export type FilterParams = {
  status?: string[];
  campaign_type?: CampaignType[];
  tenant_id?: string[];
  date_range?: DateRange;
};

// =============================================================================
// API RESPONSE WRAPPERS
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    has_more?: boolean;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  };
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type CampaignEventType = 
  | 'campaign_created'
  | 'campaign_approved'
  | 'campaign_activated'
  | 'campaign_paused'
  | 'campaign_completed'
  | 'tenant_joined'
  | 'tenant_left'
  | 'sequence_dispatched'
  | 'message_sent'
  | 'message_delivered'
  | 'reward_claimed';

export interface CampaignEvent {
  id: string;
  event_type: CampaignEventType;
  campaign_id?: string;
  tenant_id?: string;
  persona_id?: string;
  data: Record<string, any>;
  correlation_id?: string;
  created_at: string;
}

// =============================================================================
// INTEGRATION TYPES
// =============================================================================

export interface QubeBaseAsset {
  id: string;
  type: 'video' | 'image' | 'audio' | 'document';
  title: string;
  description?: string;
  url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface SmartActionConfig {
  id: string;
  name: string;
  type: 'share_to_earn' | 'claim_reward' | 'join_campaign';
  endpoint_url: string;
  reward_config?: RewardConfig;
  utm_parameters?: Record<string, string>;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// =============================================================================
// 21 AWAKENINGS SPECIFIC TYPES
// =============================================================================

export interface AwakeningsSequenceConfig {
  campaign_id: string;
  theme: 'consciousness' | 'transformation' | 'awakening';
  duration_days: 21;
  daily_structure: {
    morning_content: boolean;
    evening_reflection: boolean;
    community_share: boolean;
  };
  content_sources: {
    metaknyts_scrolls: boolean;
    video_meditations: boolean;
    written_reflections: boolean;
  };
  rewards: {
    completion_certificate: boolean;
    badge_system: boolean;
    community_recognition: boolean;
  };
}

export interface AwakeningsDayContent {
  day_number: number;
  theme: string;
  focus_area: string;
  content: {
    main_video: QubeBaseAsset;
    meditation_audio?: QubeBaseAsset;
    written_reflection?: string;
    journal_prompt?: string;
  };
  social_assets: {
    linkedin_copy: string;
    x_copy: string;
    instagram_image?: QubeBaseAsset;
    hashtags: string[];
  };
  cta_config: {
    primary_cta: string;
    secondary_cta?: string;
    share_message: string;
    reward_trigger?: string;
  };
}
