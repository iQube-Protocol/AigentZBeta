-- KNYTS Bridge campaign tagging
--
-- The KNYTS Bridge campaign (WELCOME -> VIEW -> ORIENT -> PASSPORT -> REMIX ->
-- STAND -> BUY) needs to filter Pulse content down to "Crossing Story" posts
-- and attribute social-share tracking to its own reward thresholds, without
-- disturbing the existing Qriptopian share flow or the cartridge/origin
-- classification community_generated_content already carries.
--
-- Two additive, nullable columns:
--   1. community_generated_content.campaign_tag — freeform campaign
--      discriminator (e.g. 'knyts-bridge-crossing'). NULL for all existing
--      rows and every future post not created through a campaign surface.
--   2. social_share_analytics.campaign_id — mirrors the campaignId a share
--      was tracked under, defaulting to NULL (interpreted as the existing
--      'qriptopian-share' behavior by the tracking route) so existing rows
--      and callers are unaffected.

ALTER TABLE community_generated_content
  ADD COLUMN IF NOT EXISTS campaign_tag TEXT;

CREATE INDEX IF NOT EXISTS idx_cgc_campaign_tag
  ON community_generated_content(campaign_tag)
  WHERE campaign_tag IS NOT NULL;

ALTER TABLE social_share_analytics
  ADD COLUMN IF NOT EXISTS campaign_id TEXT;

CREATE INDEX IF NOT EXISTS idx_social_share_analytics_campaign_id
  ON social_share_analytics(campaign_id)
  WHERE campaign_id IS NOT NULL;
