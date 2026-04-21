-- Per-item KNYT minting mode configuration
-- Allows admins to set immediate | deferred | canonical per SKU via the Store Admin panel.

CREATE TABLE IF NOT EXISTS knyt_sku_config (
  sku_id       TEXT PRIMARY KEY,
  minting_mode TEXT NOT NULL DEFAULT 'immediate'
               CHECK (minting_mode IN ('immediate', 'deferred', 'canonical')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT -- persona_id of the admin who last changed this
);

-- Only service role can read/write; no RLS needed for personas (admin-only data)
ALTER TABLE knyt_sku_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on knyt_sku_config"
  ON knyt_sku_config FOR ALL
  USING (auth.role() = 'service_role');
