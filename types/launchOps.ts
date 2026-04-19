// Launch Ops types — matches supabase/migrations/20260419000001_launch_ops_schema.sql

export type LoProgramStatus = 'draft' | 'active' | 'paused' | 'done' | 'archived';
export type LoStatusColor = 'gray' | 'blue' | 'yellow' | 'green' | 'red';
export type LoPriority = 'low' | 'medium' | 'high' | 'critical';
export type LoOwnerRole = 'Marketa' | 'Founder' | 'Ops' | 'Design' | 'Dev' | 'Community';
export type LoObjectiveType = 'direct_sales' | 'message_fit' | 'proof_build' | 'halo_growth' | 'launch_readiness';
export type LoMetricType = 'orders' | 'revenue' | 'aov' | 'conversion_rate' | 'proof_assets' | 'engaged_followers' | 'kickstarter_follows' | 'readiness_score';
export type LoTargetType = 'increase' | 'optimize' | 'stabilize' | 'reach_threshold';
export type LoAudienceType = 'investor_top' | 'investor_warm' | 'investor_dormant' | 'community_warm' | 'public_cold';
export type LoOfferType = 'digital' | 'bundle' | 'exclusive';
export type LoOfferTier = 'entry' | 'premium' | 'founding';
export type LoOfferGoal = 'fast_conversion' | 'high_value_conversion' | 'investor_activation';
export type LoChannelName = 'email' | 'sms' | 'x' | 'instagram' | 'linkedin' | 'kickstarter_prelaunch';
export type LoChannelRole = 'convert' | 'nudge' | 'signal' | 'visual_halo' | 'legitimacy' | 'follow_capture';
export type LoTaskType =
  | 'strategy' | 'copy' | 'offer_design' | 'ops_copy' | 'crm' | 'analytics' | 'content_ops'
  | 'faq' | 'creative' | 'email' | 'direct_outreach' | 'sms' | 'research' | 'community'
  | 'social' | 'product' | 'growth' | 'decision' | 'memo' | 'proof_build';
export type LoTaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'canceled';
export type LoProofAssetType = 'testimonial' | 'quote' | 'screenshot' | 'comment' | 'buyer_reaction' | 'supporter_post' | 'referral_event';
export type LoReadinessBucket = 'offer' | 'audience' | 'proof' | 'ops' | 'story';
export type LoReadinessScore = 'red' | 'yellow' | 'green';
export type LoRecommendation = 'continue_validation' | 'move_to_prelaunch_concentration' | 'prepare_relaunch';
export type LoDecisionRule = 'relaunch_on_evidence' | 'mostly_green_rule';

// ── Table row types ────────────────────────────────────────────────────────────

export interface LaunchProgram {
  id: string;
  slug: string;
  name: string;
  status: LoProgramStatus;
  status_color: LoStatusColor;
  priority: LoPriority;
  owner: LoOwnerRole;
  decision_rule: LoDecisionRule;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchObjective {
  id: string;
  program_id: string;
  code: string;
  objective_type: LoObjectiveType;
  metric_type: LoMetricType;
  target_type: LoTargetType;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchAudienceSegment {
  id: string;
  program_id: string;
  code: string;
  audience_type: LoAudienceType;
  name: string;
  size_estimate: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchOffer {
  id: string;
  program_id: string;
  code: string;
  name: string;
  offer_type: LoOfferType;
  tier: LoOfferTier;
  goal: LoOfferGoal;
  price_cents: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchChannel {
  id: string;
  program_id: string;
  channel_name: LoChannelName;
  channel_role: LoChannelRole;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchSprintWeek {
  id: string;
  program_id: string;
  week_number: number;
  label: string;
  status: LoTaskStatus;
  status_color: LoStatusColor;
  goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchSprintTask {
  id: string;
  program_id: string;
  week_id: string | null;
  code: string;
  title: string;
  task_type: LoTaskType;
  owner: LoOwnerRole;
  priority: LoPriority;
  status: LoTaskStatus;
  status_color: LoStatusColor;
  due_date: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchProofAsset {
  id: string;
  program_id: string;
  asset_type: LoProofAssetType;
  source_channel: LoChannelName | null;
  source_segment_id: string | null;
  source_offer_id: string | null;
  title: string | null;
  body: string | null;
  asset_url: string | null;
  is_approved: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LaunchWeeklyReport {
  id: string;
  program_id: string;
  week_number: number;
  status: LoTaskStatus;
  status_color: LoStatusColor;
  summary: string | null;
  top_wins: string[];
  top_losses: string[];
  best_messages: string[];
  top_objections: string[];
  next_week_priorities: string[];
  recommendation: LoRecommendation;
  recommendation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchReadinessScore {
  id: string;
  program_id: string;
  report_id: string | null;
  bucket: LoReadinessBucket;
  score: LoReadinessScore;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchChannelMetrics {
  id: string;
  program_id: string;
  report_id: string | null;
  channel_name: LoChannelName;
  sent_count: number;
  open_rate: number | null;
  click_rate: number | null;
  reply_rate: number | null;
  post_count: number;
  share_count: number;
  save_count: number;
  engaged_comment_count: number;
  follow_count: number;
  growth_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchCommercialMetrics {
  id: string;
  program_id: string;
  report_id: string | null;
  offer_id: string | null;
  segment_id: string | null;
  orders: number;
  revenue_cents: number;
  aov_cents: number | null;
  conversion_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchProgramMember {
  id: string;
  program_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  can_write: boolean;
  created_at: string;
  updated_at: string;
}

// ── View row types ─────────────────────────────────────────────────────────────

export interface VProgramHealth {
  program_id: string;
  slug: string;
  name: string;
  status: LoProgramStatus;
  status_color: LoStatusColor;
  priority: LoPriority;
  owner: LoOwnerRole;
  total_tasks: number;
  done_tasks: number;
  doing_tasks: number;
  blocked_tasks: number;
  todo_tasks: number;
  completion_pct: number | null;
  total_proof_assets: number;
  approved_proof_assets: number;
  created_at: string;
  updated_at: string;
}

export interface VWeekProgressSummary {
  week_id: string;
  program_id: string;
  week_number: number;
  label: string;
  status: LoTaskStatus;
  status_color: LoStatusColor;
  goal: string | null;
  total_tasks: number;
  done_tasks: number;
  doing_tasks: number;
  blocked_tasks: number;
  todo_tasks: number;
  critical_tasks: number;
  completion_pct: number | null;
}

export interface VReadinessDashboard {
  program_id: string;
  report_id: string | null;
  week_number: number | null;
  offer_score: LoReadinessScore | null;
  audience_score: LoReadinessScore | null;
  proof_score: LoReadinessScore | null;
  ops_score: LoReadinessScore | null;
  story_score: LoReadinessScore | null;
  green_count: number;
  yellow_count: number;
  red_count: number;
}

export interface VMarketaToday {
  program_id: string;
  slug: string;
  name: string;
  status: LoProgramStatus;
  status_color: LoStatusColor;
  current_week_number: number;
  current_week_label: string;
  current_week_goal: string | null;
  week_status: LoTaskStatus;
  todays_open_tasks: number;
  blocked_tasks: number;
  critical_open_tasks: number;
  done_tasks_total: number;
  all_tasks_total: number;
}

// ── API shape for the LaunchOps tab ───────────────────────────────────────────

export interface LaunchOpsProgramData {
  program: LaunchProgram;
  health: VProgramHealth;
  weeks: (LaunchSprintWeek & { tasks: LaunchSprintTask[]; completion_pct: number | null })[];
  readiness: VReadinessDashboard | null;
  proofCount: number;
  approvedProofCount: number;
}
