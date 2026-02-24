-- Phase 1: KNYT Codex / KNYTMall - Rewards, Entitlements, and Reputation
-- Tier 0 Remote Custody Implementation

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Entitlement tier (T0 = remote custody, T1/T2 = future canonical)
CREATE TYPE entitlement_tier AS ENUM ('T0', 'T1', 'T2');

-- Entitlement type
CREATE TYPE entitlement_type AS ENUM ('perpetual', 'term', 'subscription');

-- Order tier (investor cohorts)
CREATE TYPE order_tier AS ENUM ('NONE', 'KETA', 'KEJI', 'FIRST', 'ZERO', 'SAT');

-- Reputation tier (derived from order tier)
CREATE TYPE reputation_tier AS ENUM ('R-', 'R0_KETA', 'R1_KEJI', 'R2_FIRST', 'R3_ZERO', 'R4_SAT');

-- Reward task types
CREATE TYPE reward_task_type AS ENUM (
  -- Referrals
  'BringAKnightQualifiedReferral',
  -- Engagement (Knight of Attention)
  'KnightOfAttentionEpisodeComplete',
  'KnightOfAttentionWeeklyStreak',
  'KnightOfAttentionStreakBonus',
  -- Social (Herald of the Order)
  'HeraldCuriosityClicks',
  'HeraldAudienceSignups',
  'HeraldConversionPayingUser',
  -- Special
  'FoundingOrderAirdrop'
);

-- =============================================================================
-- USER ENTITLEMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,                          -- episodeId, motionEpisodeId, cardId, bundleId
  tier entitlement_tier NOT NULL DEFAULT 'T0',
  entitlement_type entitlement_type NOT NULL DEFAULT 'perpetual',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                          -- NULL = no planned expiry (perpetual)
  source_purchase_id UUID,                         -- Reference to purchase that granted this
  metadata JSONB DEFAULT '{}',
  canonical_bundle_id TEXT,                        -- For Phase 2.3 canonical minting
  onchain_token_ref TEXT,                          -- For Phase 2.3 NFT reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for user_entitlements
CREATE INDEX idx_user_entitlements_persona ON user_entitlements(persona_id);
CREATE INDEX idx_user_entitlements_asset ON user_entitlements(asset_id);
CREATE INDEX idx_user_entitlements_persona_asset ON user_entitlements(persona_id, asset_id);
CREATE INDEX idx_user_entitlements_tier ON user_entitlements(tier);

-- Unique constraint: one entitlement per persona per asset per tier
CREATE UNIQUE INDEX idx_user_entitlements_unique ON user_entitlements(persona_id, asset_id, tier);

-- =============================================================================
-- REWARD GRANTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  task_type reward_task_type NOT NULL,
  amount_knyt DECIMAL(18, 4) NOT NULL,             -- Final amount (post-multiplier)
  base_amount_knyt DECIMAL(18, 4) NOT NULL,        -- Base amount (pre-multiplier)
  rep_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  source_event_id TEXT,                            -- purchaseId, episodeId, shareId, etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for reward_grants
CREATE INDEX idx_reward_grants_persona ON reward_grants(persona_id);
CREATE INDEX idx_reward_grants_task_type ON reward_grants(task_type);
CREATE INDEX idx_reward_grants_created ON reward_grants(created_at);
CREATE INDEX idx_reward_grants_persona_task ON reward_grants(persona_id, task_type);

-- =============================================================================
-- REPUTATION EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                        -- e.g., 'reward_earned', 'purchase_made', 'streak_achieved'
  event_source TEXT,                               -- e.g., 'reward_service', 'purchase_handler'
  points_delta INTEGER DEFAULT 0,                  -- Reputation points change
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for reputation_events
CREATE INDEX idx_reputation_events_persona ON reputation_events(persona_id);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);
CREATE INDEX idx_reputation_events_created ON reputation_events(created_at);

-- =============================================================================
-- EPISODE ENGAGEMENT EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS episode_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL,
  event_type TEXT NOT NULL,                        -- 'started', 'progress', 'completed'
  progress_percent INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for episode_engagement_events
CREATE INDEX idx_episode_engagement_persona ON episode_engagement_events(persona_id);
CREATE INDEX idx_episode_engagement_episode ON episode_engagement_events(episode_id);
CREATE INDEX idx_episode_engagement_type ON episode_engagement_events(event_type);

-- =============================================================================
-- WEEKLY ENGAGEMENT STREAKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS weekly_engagement_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,                        -- Monday of the week
  episodes_completed INTEGER DEFAULT 0,
  streak_qualified BOOLEAN DEFAULT FALSE,          -- Met threshold for week
  reward_granted BOOLEAN DEFAULT FALSE,            -- Reward already given
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for weekly_engagement_streaks
CREATE INDEX idx_weekly_streaks_persona ON weekly_engagement_streaks(persona_id);
CREATE INDEX idx_weekly_streaks_week ON weekly_engagement_streaks(week_start);
CREATE UNIQUE INDEX idx_weekly_streaks_unique ON weekly_engagement_streaks(persona_id, week_start);

-- =============================================================================
-- SHARE LINKS TABLE (for Herald of the Order)
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  share_id TEXT NOT NULL UNIQUE,                   -- Short unique ID for URL
  target_url TEXT NOT NULL,                        -- Where the link points
  campaign TEXT DEFAULT 'herald-of-the-order',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for share_links
CREATE INDEX idx_share_links_persona ON share_links(persona_id);
CREATE INDEX idx_share_links_share_id ON share_links(share_id);

-- =============================================================================
-- SHARE CLICKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  visitor_fingerprint TEXT,                        -- Anonymous fingerprint for dedup
  ip_hash TEXT,                                    -- Hashed IP for dedup
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for share_clicks
CREATE INDEX idx_share_clicks_link ON share_clicks(share_link_id);
CREATE INDEX idx_share_clicks_created ON share_clicks(created_at);

-- =============================================================================
-- SHARE SIGNUPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  new_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  converted_to_paying BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for share_signups
CREATE INDEX idx_share_signups_link ON share_signups(share_link_id);
CREATE INDEX idx_share_signups_persona ON share_signups(new_persona_id);

-- =============================================================================
-- ADD COLUMNS TO PERSONAS TABLE
-- =============================================================================

-- Add order_tier and reputation_tier columns
ALTER TABLE personas 
ADD COLUMN IF NOT EXISTS order_tier order_tier DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS reputation_tier reputation_tier DEFAULT 'R-',
ADD COLUMN IF NOT EXISTS referrer_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ref_campaign_id TEXT,
ADD COLUMN IF NOT EXISTS first_paid_purchase_at TIMESTAMPTZ;

-- Index for referrer lookups
CREATE INDEX IF NOT EXISTS idx_personas_referrer ON personas(referrer_persona_id);
CREATE INDEX IF NOT EXISTS idx_personas_order_tier ON personas(order_tier);

-- =============================================================================
-- PRODUCTS TABLE (for catalog with entitlement policies)
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL UNIQUE,               -- e.g., 'knyt_scroll_still', 'knyt_season_codex_motion'
  name TEXT NOT NULL,
  description TEXT,
  base_knyt_price DECIMAL(18, 4) NOT NULL,
  entitlement_type entitlement_type NOT NULL DEFAULT 'perpetual',
  entitlement_tier entitlement_tier NOT NULL DEFAULT 'T0',
  duration_days INTEGER,                           -- NULL for perpetual
  asset_ids TEXT[],                                -- Array of asset IDs this product grants access to
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for products
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_active ON products(is_active);

-- =============================================================================
-- PURCHASES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL,
  payment_rail TEXT NOT NULL,                      -- 'qc', 'knyt', 'usdc', 'paypal'
  amount DECIMAL(18, 4) NOT NULL,
  currency TEXT NOT NULL,                          -- 'QC', 'KNYT', 'USDC', 'USD'
  status TEXT NOT NULL DEFAULT 'pending',          -- 'pending', 'completed', 'failed', 'refunded'
  payment_reference TEXT,                          -- External payment ID (PayPal, etc.)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for purchases
CREATE INDEX idx_purchases_persona ON purchases(persona_id);
CREATE INDEX idx_purchases_product ON purchases(product_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_created ON purchases(created_at);

-- =============================================================================
-- SEED INITIAL PRODUCTS
-- =============================================================================

INSERT INTO products (product_type, name, description, base_knyt_price, entitlement_type, entitlement_tier, asset_ids) VALUES
  -- Singles
  ('knyt_scroll_still', 'KNYT Scroll (Still)', 'Single episode in PDF/stills format', 3, 'perpetual', 'T0', ARRAY[]::TEXT[]),
  ('knyt_scroll_motion', 'KNYT Scroll (Motion)', 'Full motion comic episode', 10, 'perpetual', 'T0', ARRAY[]::TEXT[]),
  ('knyt_character_card_still', 'KNYT Character Card', 'Single character/poster card', 1, 'perpetual', 'T0', ARRAY[]::TEXT[]),
  -- Bundles - Still
  ('knyt_scroll_bundle_still_3', 'KNYT Scroll Bundle (3 Stills)', '3 still scrolls bundle', 5, 'perpetual', 'T0', ARRAY[]::TEXT[]),
  ('knyt_scroll_bundle_still_5', 'KNYT Scroll Bundle (5 Stills)', '5 still scrolls bundle', 8, 'perpetual', 'T0', ARRAY[]::TEXT[]),
  ('knyt_season_codex_stills', 'KNYT Season Codex (Stills)', 'Full season - 13 still scrolls', 25, 'perpetual', 'T0', ARRAY[]::TEXT[]),
  -- Bundles - Motion
  ('knyt_season_codex_motion', 'KNYT Season Codex (Motion)', 'Full season - 13 motion scrolls', 40, 'perpetual', 'T0', ARRAY[]::TEXT[])
ON CONFLICT (product_type) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_entitlements IS 'Tier 0 remote custody entitlements for KNYT Codex / KNYTMall content';
COMMENT ON TABLE reward_grants IS 'KNYT reward grants from tasks (Bring a Knight, Knight of Attention, Herald of the Order)';
COMMENT ON TABLE reputation_events IS 'Events that affect persona reputation for ReputationHub';
COMMENT ON TABLE episode_engagement_events IS 'Episode viewing/reading engagement events for streak tracking';
COMMENT ON TABLE weekly_engagement_streaks IS 'Weekly engagement streak tracking for Knight of Attention rewards';
COMMENT ON TABLE share_links IS 'Share links for Herald of the Order social sharing rewards';
COMMENT ON TABLE share_clicks IS 'Click tracking for share links';
COMMENT ON TABLE share_signups IS 'Signup tracking for share links (conversion attribution)';
COMMENT ON TABLE products IS 'Product catalog with entitlement policies';
COMMENT ON TABLE purchases IS 'Purchase records for all payment rails';
