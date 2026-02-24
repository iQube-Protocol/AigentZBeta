-- Multi-Codex Registry Schema
-- Creates tables for storing dynamic codex configurations

-- Codex Configurations Table
CREATE TABLE IF NOT EXISTS codex_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  version TEXT NOT NULL DEFAULT '1.0.0',
  owner TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  permissions JSONB NOT NULL DEFAULT '{"view": ["*"], "edit": [], "admin": []}',
  liquid_ui JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Codex Tabs Table
CREATE TABLE IF NOT EXISTS codex_tabs (
  id TEXT PRIMARY KEY,
  codex_id TEXT NOT NULL REFERENCES codex_configs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  slug TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  "order" INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('static', 'dynamic', 'liquid-ui')),
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(codex_id, slug)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_codex_configs_slug ON codex_configs(slug);
CREATE INDEX IF NOT EXISTS idx_codex_configs_enabled ON codex_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_codex_configs_owner ON codex_configs(owner);
CREATE INDEX IF NOT EXISTS idx_codex_tabs_codex_id ON codex_tabs(codex_id);
CREATE INDEX IF NOT EXISTS idx_codex_tabs_order ON codex_tabs(codex_id, "order");
CREATE INDEX IF NOT EXISTS idx_codex_tabs_enabled ON codex_tabs(enabled);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_codex_configs_updated_at ON codex_configs;
CREATE TRIGGER update_codex_configs_updated_at
  BEFORE UPDATE ON codex_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_codex_tabs_updated_at ON codex_tabs;
CREATE TRIGGER update_codex_tabs_updated_at
  BEFORE UPDATE ON codex_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE codex_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE codex_tabs ENABLE ROW LEVEL SECURITY;

-- Policies for codex_configs
-- Allow public read access to enabled codexes
CREATE POLICY "Public can view enabled codexes"
  ON codex_configs FOR SELECT
  USING (enabled = true);

-- Allow authenticated users to view all codexes
CREATE POLICY "Authenticated users can view all codexes"
  ON codex_configs FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access
CREATE POLICY "Service role has full access to codexes"
  ON codex_configs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for codex_tabs
-- Allow public read access to tabs of enabled codexes
CREATE POLICY "Public can view tabs of enabled codexes"
  ON codex_tabs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM codex_configs
      WHERE codex_configs.id = codex_tabs.codex_id
      AND codex_configs.enabled = true
    )
  );

-- Allow authenticated users to view all tabs
CREATE POLICY "Authenticated users can view all tabs"
  ON codex_tabs FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access
CREATE POLICY "Service role has full access to tabs"
  ON codex_tabs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial codex configurations
-- Note: This will be populated via API on first deployment
