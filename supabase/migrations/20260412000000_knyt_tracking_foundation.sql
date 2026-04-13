-- ─────────────────────────────────────────────────────────────────────────────
-- KNYT Wheel Campaign — Tracking Foundation
-- Migration: 20260412000000_knyt_tracking_foundation.sql
--
-- Creates the three core tables that power the KNYT Wheel tracking agent:
--   1. knyt_tracking_link_registry  — canonical source of truth for every
--                                     outbound campaign link
--   2. knyt_tracking_click_events   — append-only telemetry log (every KS click)
--   3. knyt_followup_queue          — computed follow-up priority for investors
--                                     and partners
--
-- Seeded with the full initial link set:
--   • 4 investor cohort email links
--   • 19 partner links (in first-contact order)
--   • 5 surface links (social, runtime, codex, direct, tasks/rewards)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Link registry ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knyt_tracking_link_registry (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug   TEXT        NOT NULL DEFAULT 'metaknyt-kickstarter-2026',

  -- Human-readable unique identifier used as the utm_content / lookup key
  tag_name        TEXT        NOT NULL UNIQUE,

  -- Channel this link is distributed through
  channel         TEXT        NOT NULL,
  -- owner classification: 'cohort' | 'partner' | 'initiative' | 'system'
  owner_type      TEXT        NOT NULL,
  -- slug of the cohort or partner this link belongs to
  owner_key       TEXT,
  owner_name      TEXT,

  -- UTM parameters forwarded to Kickstarter
  utm_source      TEXT        NOT NULL DEFAULT 'knyt_wheel',
  utm_medium      TEXT        NOT NULL DEFAULT 'email',
  utm_campaign    TEXT        NOT NULL DEFAULT 'knyt_wheel_launch',
  utm_content     TEXT,
  utm_term        TEXT,

  -- Kickstarter attribution
  kickstarter_ref_tag TEXT    NOT NULL DEFAULT '9pbmus',

  -- Runtime link: /api/crm/track/ks?tag=<tag_name> (no uid — used in assets)
  --   Personalized link adds &uid=<nakamoto_id> at dispatch time
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  notes           TEXT,

  -- Denormalized counter — incremented by the click handler for fast reads
  click_count     INTEGER     NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knyt_link_registry_channel   ON knyt_tracking_link_registry(channel);
CREATE INDEX IF NOT EXISTS idx_knyt_link_registry_owner     ON knyt_tracking_link_registry(owner_type, owner_key);
CREATE INDEX IF NOT EXISTS idx_knyt_link_registry_campaign  ON knyt_tracking_link_registry(campaign_slug);


-- ── 2. Click events (append-only telemetry) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS knyt_tracking_click_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Registry reference (nullable — anonymous clicks have no tag)
  link_tag            TEXT        REFERENCES knyt_tracking_link_registry(tag_name) ON DELETE SET NULL,

  -- CRM identity reference (nullable — pre-signup investors have no persona)
  investor_id         UUID        REFERENCES nakamoto_knyt_personas(id) ON DELETE SET NULL,
  partner_slug        TEXT,

  -- UTM params as recorded at click time
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  utm_content         TEXT,
  utm_term            TEXT,

  -- Request metadata
  ip_address          TEXT,
  user_agent          TEXT,
  resolved_ks_url     TEXT,

  clicked_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knyt_click_events_link       ON knyt_tracking_click_events(link_tag, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_knyt_click_events_investor   ON knyt_tracking_click_events(investor_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_knyt_click_events_day        ON knyt_tracking_click_events(clicked_at DESC);


-- ── 3. Follow-up priority queue ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knyt_followup_queue (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'investor' | 'partner'
  entity_type                 TEXT        NOT NULL,

  -- Exactly one of these is set
  investor_id                 UUID        REFERENCES nakamoto_knyt_personas(id) ON DELETE CASCADE,
  partner_id                  UUID        REFERENCES partner_outreach(id) ON DELETE CASCADE,

  display_name                TEXT,
  email                       TEXT,
  current_state               TEXT,

  -- Computed priority (higher = follow up sooner)
  priority_score              NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Recommendations from last compute run
  recommended_channel         TEXT,
  recommended_message_angle   TEXT,
  recommended_next_action     TEXT,
  queue_reason                TEXT,

  last_computed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One queue entry per entity
  UNIQUE (entity_type, investor_id),
  UNIQUE (entity_type, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_knyt_followup_queue_score ON knyt_followup_queue(entity_type, priority_score DESC);


-- ── 4. Helper function: increment click counter ──────────────────────────────

CREATE OR REPLACE FUNCTION increment_knyt_link_click_count(p_tag_name TEXT)
RETURNS void LANGUAGE sql AS $$
  UPDATE knyt_tracking_link_registry
  SET click_count = click_count + 1, updated_at = now()
  WHERE tag_name = p_tag_name;
$$;


-- ── 5. Seed: initial link registry ───────────────────────────────────────────

INSERT INTO knyt_tracking_link_registry
  (tag_name, channel, owner_type, owner_key, owner_name, utm_medium, utm_content)
VALUES
  -- ── Investor cohort links (email) ─────────────────────────────────────────
  ('email_top_shelf',    'email',         'cohort', 'top_shelf',    'Top Shelf Investors',   'email',        'top_shelf'),
  ('email_zero_knyt',    'email',         'cohort', 'zero_knyt',    'Zero KNYT Investors',   'email',        'zero_knyt'),
  ('email_reactivation', 'email',         'cohort', 'reactivation', 'Reactivation Cohort',   'email',        'reactivation'),
  ('email_general',      'email',         'cohort', 'cold',         'General List',          'email',        'general'),

  -- ── Partner links (first-contact order) ──────────────────────────────────
  ('partner_autonomys',            'partner_email', 'partner', 'autonomys',            'Autonomys',                'partner_email', 'partner_autonomys'),
  ('partner_fio_protocol',         'partner_email', 'partner', 'fio_protocol',         'Fio Protocol',             'partner_email', 'partner_fio_protocol'),
  ('partner_chaingpt',             'partner_email', 'partner', 'chaingpt',             'ChainGPT',                 'partner_email', 'partner_chaingpt'),
  ('partner_lamina1',              'partner_email', 'partner', 'lamina1',              'Lamina1',                  'partner_email', 'partner_lamina1'),
  ('partner_layerzero',            'partner_email', 'partner', 'layerzero',            'LayerZero',                'partner_email', 'partner_layerzero'),
  ('partner_project_liberty',      'partner_email', 'partner', 'project_liberty',      'Project Liberty',          'partner_email', 'partner_project_liberty'),
  ('partner_cryptomondays',        'partner_email', 'partner', 'cryptomondays',        'CryptoMondays / DAIA',     'partner_email', 'partner_cryptomondays'),
  ('partner_pal_capital',          'partner_email', 'partner', 'pal_capital',          'PAL Capital',              'partner_email', 'partner_pal_capital'),
  ('partner_distro',               'partner_email', 'partner', 'distro',               'Distro',                   'partner_email', 'partner_distro'),
  ('partner_near',                 'partner_email', 'partner', 'near',                 'NEAR',                     'partner_email', 'partner_near'),
  ('partner_polygon',              'partner_email', 'partner', 'polygon',              'Polygon',                  'partner_email', 'partner_polygon'),
  ('partner_secret_network',       'partner_email', 'partner', 'secret_network',       'Secret Network',           'partner_email', 'partner_secret_network'),
  ('partner_decentralized_media',  'partner_email', 'partner', 'decentralized_media',  'Decentralized Media',      'partner_email', 'partner_decentralized_media'),
  ('partner_horizen',              'partner_email', 'partner', 'horizen',              'Horizen',                  'partner_email', 'partner_horizen'),
  ('partner_bitcoin_harlem',       'partner_email', 'partner', 'bitcoin_harlem',       'Bitcoin Harlem',           'partner_email', 'partner_bitcoin_harlem'),
  ('partner_pubkey',               'partner_email', 'partner', 'pubkey',               'PubKey',                   'partner_email', 'partner_pubkey'),
  ('partner_qbit',                 'partner_email', 'partner', 'qbit',                 'Qbit',                     'partner_email', 'partner_qbit'),
  ('partner_ethereum_foundation',  'partner_email', 'partner', 'ethereum_foundation',  'Ethereum Foundation',      'partner_email', 'partner_ethereum_foundation'),

  -- ── Surface / initiative links ────────────────────────────────────────────
  ('social_x',           'social_x',      'initiative', 'social',   'X / Twitter Post',  'social',   'social_x'),
  ('social_linkedin',    'social',        'initiative', 'social',   'LinkedIn Post',     'social',   'social_linkedin'),
  ('runtime_cta',        'runtime',       'initiative', 'runtime',  'Runtime CTA',       'runtime',  'runtime'),
  ('codex_cta',          'knyt_cartridge','initiative', 'codex',    'Codex CTA',         'codex',    'codex'),
  ('direct_outreach',    'direct',        'initiative', 'direct',   'Direct Outreach',   'direct',   'direct')

ON CONFLICT (tag_name) DO NOTHING;
