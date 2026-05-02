-- =============================================================================
-- store_skus — operator-editable catalog of sellable SKUs and the asset
-- categories they grant access to.
--
-- Model: each SKU sets BOOLEAN grant flags by category. The server resolver
-- (services/rewards/entitlementService.userOwnsAsset) checks the requested
-- asset's category against the persona's owned SKUs' flags. This avoids
-- precomputing exhaustive asset lists and keeps the model resilient when new
-- masters / characters are uploaded later (a future episode is automatically
-- covered by an SKU that has grants_episodes_still=true).
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS store_skus (
  sku_id          TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  -- Coarse-grained category grants
  grants_episodes_still   BOOLEAN DEFAULT false,
  grants_episodes_motion  BOOLEAN DEFAULT false,
  grants_episodes_print   BOOLEAN DEFAULT false,
  grants_character_cards  BOOLEAN DEFAULT false,
  grants_gn               BOOLEAN DEFAULT false,
  grants_lore             BOOLEAN DEFAULT false,
  -- Series scope ('metaKnyts' for now; allows multi-series future)
  series                  TEXT DEFAULT 'metaKnyts',
  -- One-off explicit asset_ids granted (escape hatch for non-categorised items)
  extra_asset_ids         TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_skus_active ON store_skus(is_active) WHERE is_active = true;

-- =============================================================================
-- Seed: every investor bundle that includes "all 13 episodes + GN + characters"
-- grants the digital category flags. Physical-only add-ons (paperback, signed
-- hardcover, collector cards) don't appear here — they're fulfilment items, not
-- digital access rights.
-- =============================================================================

INSERT INTO store_skus (sku_id, name, description,
  grants_episodes_still, grants_episodes_motion, grants_episodes_print,
  grants_character_cards, grants_gn) VALUES
  -- Qripto (high-fidelity, includes both still + motion)
  ('knyt-codex-investor',   'Qripto KNYT Codex',     'GN + 13 Qripto Editions + 13 Characters',  true, true, false, true, true),
  ('top-knyt-investor',     'Top KNYT Shelf',        'Qripto Codex + paperback AGN',             true, true, false, true, true),
  ('first-knyt-investor',   'First KNYT',            'Top + collector card + hardcover + prints', true, true, true,  true, true),
  ('zero-knyt-investor',    'Zero KNYT',             'First + Order of Metaiye access',          true, true, true,  true, true),
  ('satoshi-knyt-investor', 'Satoshi KNYT Collection','Flagship: leather-bound + 2x everything',  true, true, true,  true, true),
  -- Digital-only bundles (still editions, no motion comic)
  ('digital-knyt-cartridge','KNYT Cartridge',        'Digital AGN + 13 Digital Editions + Cards', true, false, false, true, true),
  ('digital-knyt-shelf',    'Digital KNYT Shelf',    'Cartridge + paperback AGN',                 true, false, false, true, true),
  ('digital-first-knyt',    'Digital First KNYT',    'Shelf + collector + hardcover + prints',    true, false, true,  true, true),
  -- GN-only bundles
  ('gn-investor-qripto',     'Agentic Graphic Novel Qripto',     'QAGN only',                    false, false, false, false, true),
  ('gn-investor-digital',    'Agentic Graphic Novel Digital',    'Digital AGN only',             false, false, false, false, true),
  ('gn-investor-paperback',  'Agentic Graphic Novel Paperback',  'Paperback only (no digital)',  false, false, false, false, false),
  ('gn-investor-hardcover',  'Agentic Graphic Novel Hardcover',  'Hardcover only (no digital)',  false, false, false, false, false)
ON CONFLICT (sku_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  grants_episodes_still   = EXCLUDED.grants_episodes_still,
  grants_episodes_motion  = EXCLUDED.grants_episodes_motion,
  grants_episodes_print   = EXCLUDED.grants_episodes_print,
  grants_character_cards  = EXCLUDED.grants_character_cards,
  grants_gn               = EXCLUDED.grants_gn,
  updated_at = NOW();
