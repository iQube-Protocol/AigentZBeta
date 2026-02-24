-- ============================================================================
-- Smart Triad System Migration
-- Date: 2025-12-04
-- 
-- Creates tables for the Smart Triad:
-- - SmartWalletQube (wallet particle)
-- - SmartDrawerSet (arrangement layer)
-- - SmartCardVariant (modal registry)
-- - AigentQube (agent registry)
-- - DrawerSession (dynamic session persistence)
-- ============================================================================

-- ============================================================================
-- SMART WALLET QUBES
-- The wallet particle in the iQube architecture
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_wallet_qubes (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  did TEXT NOT NULL,
  kybe_did TEXT,
  identity_state TEXT NOT NULL DEFAULT 'anon' CHECK (identity_state IN ('anon', 'pseudo', 'semi', 'full')),
  balances JSONB NOT NULL DEFAULT '[]',
  entitlements JSONB NOT NULL DEFAULT '[]',
  rewards JSONB NOT NULL DEFAULT '[]',
  tasks JSONB NOT NULL DEFAULT '[]',
  quests JSONB NOT NULL DEFAULT '[]',
  payment_capabilities JSONB NOT NULL DEFAULT '{}',
  layout_hints JSONB DEFAULT '{}',
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, tenant_id, persona_id)
);

-- Indexes for wallet lookups
CREATE INDEX IF NOT EXISTS idx_wallet_qubes_app_tenant ON smart_wallet_qubes(app_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_qubes_persona ON smart_wallet_qubes(persona_id);
CREATE INDEX IF NOT EXISTS idx_wallet_qubes_did ON smart_wallet_qubes(did);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_wallet_qube_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_qube_updated_at ON smart_wallet_qubes;
CREATE TRIGGER wallet_qube_updated_at
  BEFORE UPDATE ON smart_wallet_qubes
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_qube_updated_at();

-- ============================================================================
-- SMART DRAWER SETS
-- The arrangement layer for content + agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_drawer_sets (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  dynamic_mode TEXT NOT NULL DEFAULT 'static-only' CHECK (dynamic_mode IN ('static-only', 'allow-dynamic', 'dynamic-by-default')),
  drawers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, tenant_id, persona_id)
);

-- Indexes for drawer lookups
CREATE INDEX IF NOT EXISTS idx_drawer_sets_app_tenant ON smart_drawer_sets(app_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_drawer_sets_persona ON smart_drawer_sets(persona_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_drawer_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS drawer_set_updated_at ON smart_drawer_sets;
CREATE TRIGGER drawer_set_updated_at
  BEFORE UPDATE ON smart_drawer_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_drawer_set_updated_at();

-- ============================================================================
-- SMART DRAWER SESSIONS
-- Dynamic session overlays for Copilot training
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_drawer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_set_id TEXT NOT NULL REFERENCES smart_drawer_sets(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  prompt_context TEXT,
  overlay JSONB NOT NULL DEFAULT '{}',
  effectiveness_score FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_drawer_sessions_drawer_set ON smart_drawer_sessions(drawer_set_id);
CREATE INDEX IF NOT EXISTS idx_drawer_sessions_session ON smart_drawer_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_drawer_sessions_persona ON smart_drawer_sessions(persona_id);
CREATE INDEX IF NOT EXISTS idx_drawer_sessions_created ON smart_drawer_sessions(created_at DESC);

-- ============================================================================
-- SMART CARD VARIANTS
-- The modal vocabulary registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_card_variants (
  id TEXT PRIMARY KEY,
  app_id TEXT,
  definition JSONB NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  component_implemented BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for variant lookups
CREATE INDEX IF NOT EXISTS idx_card_variants_app ON smart_card_variants(app_id);
CREATE INDEX IF NOT EXISTS idx_card_variants_builtin ON smart_card_variants(is_builtin);

-- ============================================================================
-- AIGENT QUBES
-- Agent registry bound by iQube policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS aigent_qubes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('copilot', 'franchise', 'metavatar', 'specialist')),
  app_ids TEXT[] NOT NULL DEFAULT '{}',
  metavatar_ids TEXT[] NOT NULL DEFAULT '{}',
  capabilities JSONB NOT NULL DEFAULT '[]',
  policy_bindings JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  default_metavatar_id TEXT,
  system_prompt TEXT,
  model_preference TEXT,
  temperature FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for agent lookups
CREATE INDEX IF NOT EXISTS idx_aigent_qubes_type ON aigent_qubes(type);
CREATE INDEX IF NOT EXISTS idx_aigent_qubes_active ON aigent_qubes(is_active);
CREATE INDEX IF NOT EXISTS idx_aigent_qubes_app_ids ON aigent_qubes USING GIN(app_ids);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_aigent_qube_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aigent_qube_updated_at ON aigent_qubes;
CREATE TRIGGER aigent_qube_updated_at
  BEFORE UPDATE ON aigent_qubes
  FOR EACH ROW
  EXECUTE FUNCTION update_aigent_qube_updated_at();

-- ============================================================================
-- METAVATARS
-- Visual representations of agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS metavatars (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES aigent_qubes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  video_url TEXT,
  iframe_url TEXT,
  voice_id TEXT,
  style TEXT CHECK (style IN ('realistic', 'animated', 'stylized', 'minimal')),
  background_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for metavatar lookups
CREATE INDEX IF NOT EXISTS idx_metavatars_agent ON metavatars(agent_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE smart_wallet_qubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_drawer_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_drawer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_card_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigent_qubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE metavatars ENABLE ROW LEVEL SECURITY;

-- Wallet Qubes: Users can only see their own wallet data
CREATE POLICY wallet_qubes_select_own ON smart_wallet_qubes
  FOR SELECT USING (
    auth.uid()::text = persona_id 
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY wallet_qubes_insert_own ON smart_wallet_qubes
  FOR INSERT WITH CHECK (
    auth.uid()::text = persona_id 
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY wallet_qubes_update_own ON smart_wallet_qubes
  FOR UPDATE USING (
    auth.uid()::text = persona_id 
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Drawer Sets: Users can see their own + shared drawer sets
CREATE POLICY drawer_sets_select ON smart_drawer_sets
  FOR SELECT USING (
    persona_id = auth.uid()::text 
    OR persona_id = 'shared'
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY drawer_sets_insert ON smart_drawer_sets
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY drawer_sets_update ON smart_drawer_sets
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Drawer Sessions: Users can see their own sessions
CREATE POLICY drawer_sessions_select_own ON smart_drawer_sessions
  FOR SELECT USING (
    persona_id = auth.uid()::text 
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY drawer_sessions_insert ON smart_drawer_sessions
  FOR INSERT WITH CHECK (
    persona_id = auth.uid()::text 
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Card Variants: Everyone can read, only service role can write
CREATE POLICY card_variants_select_all ON smart_card_variants
  FOR SELECT USING (true);

CREATE POLICY card_variants_insert ON smart_card_variants
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Aigent Qubes: Everyone can read active agents
CREATE POLICY aigent_qubes_select_active ON aigent_qubes
  FOR SELECT USING (
    is_active = true 
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY aigent_qubes_insert ON aigent_qubes
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY aigent_qubes_update ON aigent_qubes
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Metavatars: Everyone can read
CREATE POLICY metavatars_select_all ON metavatars
  FOR SELECT USING (true);

CREATE POLICY metavatars_insert ON metavatars
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- SEED DATA: Core Agents
-- ============================================================================

INSERT INTO aigent_qubes (id, label, description, type, app_ids, metavatar_ids, capabilities, is_active)
VALUES 
  (
    'Copilot',
    'Aigent Z Copilot',
    'The main AI assistant for the AgentiQ platform. Helps with content discovery, wallet management, and drawer configuration.',
    'copilot',
    ARRAY['metaKnyts', 'Qriptopian', 'AgentiQ'],
    ARRAY['metaknyts:copilot', 'qriptopian:copilot'],
    '[{"id": "chat", "category": "chat", "label": "Conversational Chat", "enabled": true}, {"id": "content-discovery", "category": "content", "label": "Content Discovery", "enabled": true}, {"id": "wallet-help", "category": "wallet", "label": "Wallet Assistance", "enabled": true}, {"id": "drawer-config", "category": "creative", "label": "Drawer Configuration", "enabled": true}]'::jsonb,
    true
  ),
  (
    'Kn0w1',
    'Kn0w1',
    'The metaKnyts franchise agent. Expert in lore, story, and codex navigation.',
    'franchise',
    ARRAY['metaKnyts', 'Qriptopian'],
    ARRAY['metaknyts:kn0w1', 'qriptopian:kn0w1'],
    '[{"id": "chat", "category": "chat", "label": "Conversational Chat", "enabled": true}, {"id": "lore", "category": "codex", "label": "Lore Expert", "enabled": true}, {"id": "story-guide", "category": "content", "label": "Story Guide", "enabled": true}]'::jsonb,
    true
  ),
  (
    'MoneyPenny',
    'MoneyPenny',
    'Financial and wallet assistant. Expert in payments, rewards, and token economics.',
    'franchise',
    ARRAY['metaKnyts', 'Qriptopian'],
    ARRAY['metaknyts:moneypenny', 'qriptopian:moneypenny'],
    '[{"id": "chat", "category": "chat", "label": "Conversational Chat", "enabled": true}, {"id": "wallet-expert", "category": "wallet", "label": "Wallet Expert", "enabled": true}, {"id": "rewards", "category": "tasks", "label": "Rewards Guide", "enabled": true}, {"id": "commerce", "category": "commerce", "label": "Commerce Assistant", "enabled": true}]'::jsonb,
    true
  ),
  (
    'Nakamoto',
    'Nakamoto',
    'Crypto and blockchain specialist. Expert in x402, DVN, and multi-chain operations.',
    'specialist',
    ARRAY['metaKnyts', 'Qriptopian'],
    ARRAY['metaknyts:nakamoto', 'qriptopian:nakamoto'],
    '[{"id": "chat", "category": "chat", "label": "Conversational Chat", "enabled": true}, {"id": "crypto-expert", "category": "wallet", "label": "Crypto Expert", "enabled": true}, {"id": "x402", "category": "commerce", "label": "x402 Specialist", "enabled": true}]'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  app_ids = EXCLUDED.app_ids,
  metavatar_ids = EXCLUDED.metavatar_ids,
  capabilities = EXCLUDED.capabilities,
  updated_at = NOW();

-- ============================================================================
-- SEED DATA: Metavatars
-- ============================================================================

INSERT INTO metavatars (id, agent_id, name, style)
VALUES
  ('metaknyts:kn0w1', 'Kn0w1', 'Kn0w1 (metaKnyts)', 'stylized'),
  ('metaknyts:moneypenny', 'MoneyPenny', 'MoneyPenny (metaKnyts)', 'stylized'),
  ('metaknyts:codex-spirit', 'Copilot', 'Codex Spirit', 'animated'),
  ('metaknyts:copilot', 'Copilot', 'Copilot (metaKnyts)', 'minimal'),
  ('qriptopian:kn0w1', 'Kn0w1', 'Kn0w1 (Qriptopian)', 'realistic'),
  ('qriptopian:moneypenny', 'MoneyPenny', 'MoneyPenny (Qriptopian)', 'realistic'),
  ('qriptopian:copilot', 'Copilot', 'Copilot (Qriptopian)', 'minimal'),
  ('metaknyts:nakamoto', 'Nakamoto', 'Nakamoto (metaKnyts)', 'stylized'),
  ('qriptopian:nakamoto', 'Nakamoto', 'Nakamoto (Qriptopian)', 'realistic')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE smart_wallet_qubes IS 'SmartWalletQube - The wallet particle in the iQube architecture';
COMMENT ON TABLE smart_drawer_sets IS 'SmartDrawerSet - The arrangement layer for content + agents in the Smart Menu system';
COMMENT ON TABLE smart_drawer_sessions IS 'Dynamic session overlays for Copilot training and refinement';
COMMENT ON TABLE smart_card_variants IS 'Card variant registry - the modal vocabulary for Smart Drawers';
COMMENT ON TABLE aigent_qubes IS 'Agent registry - AI agents and metavatars bound by iQube policies';
COMMENT ON TABLE metavatars IS 'Visual representations of agents';
