export type CampaignType = "wpp" | "custom" | "sequence";
export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type CampaignItemStatus = "pending" | "sent" | "viewed" | "clicked" | "locked" | "available" | "completed";

export interface MarketaCampaign {
  id: string;
  name: string;
  description: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  duration_days?: number;
  channels: string[];
  created_at: string;
  // future: studio_bundle_id?: string;
}

export interface MarketaSequenceItem {
  id: string;
  campaign_id: string;
  day_number: number;
  title: string;
  description: string;
  explainer: boolean;
  thumbnail_url?: string | null;
  cta_url?: string | null;
  asset_ref?: string | null;
  status: CampaignItemStatus;
  // Extended fields (added via ALTER TABLE)
  channels?: string[];
  publish_day?: number;
  reward_knyt?: number;
  reward_trigger?: string;
  nbe_disposition?: string;
  experience_goal_id?: string | null;
  studio_artifact_id?: string | null;
  metaproof_milestone?: string;
}

export interface MarketaPartnerReward {
  id: string;
  campaign_id: string;
  reward_type: "knyt" | "qcent" | "points";
  amount: number;
  trigger: "per_day" | "per_share" | "on_completion";
}

export interface CampaignCatalogItem {
  id: string;
  name: string;
  description: string;
  campaign_type: CampaignType;
  duration_days?: number;
  channels: string[];
  is_joined: boolean;
}

export interface CampaignDetail extends MarketaCampaign {
  marketa_sequence_items: MarketaSequenceItem[];
  marketa_partner_rewards: MarketaPartnerReward[];
  join_status?: { joined_at: string; progress_day: number };
}

export interface CampaignStatusResult {
  is_joined: boolean;
  current_day: number | null;
  total_days: number;
  joined_at: string | null;
  status: string;
  delivery_receipts: Array<{ day: number; delivered_at: string; status: string }>;
}

export interface DeliveryReceipt {
  day: number;
  delivered_at: string;
  status: string;
}

export interface EngagementEvent {
  eventType: "marketa_partner_event";
  tenant_id: string;
  persona_id: string;
  campaign_id: string;
  event_type: "sequence_view" | "asset_click" | "cta_click" | "share_completed";
  sequence_day: number;
  asset_ref?: string;
}

export const CAMPAIGN_21_AWAKENINGS_ID = "campaign_1768709183190_qq6f0x0sj";
export const DEFAULT_TENANT = "metaproof";
export const DEFAULT_PERSONA = "qriptiq@knyt";
