-- =============================================================================
-- KNYT Treasury Namespaces
-- Codex-bound treasury ledger for Living Canon / 21 Sats.
--
-- Storage boundary:
--   Supabase = operational cache and query layer
--   Autodrive = canonical settlement records (CID written on each settled event)
--
-- Three treasury namespaces at launch:
--   21sats_community_world  — active community world treasury (reward pool for votes + contributions)
--   21sats_master           — 21 Sats programme master treasury
--   knyt_franchise          — broader KNYT franchise treasury
--
-- All reward settlement records from knyt_elections and contribution rewards
-- reference a treasury_namespace_id to show which pool funded them.
--
-- Relationship to wallet_balances / wallet_transactions:
--   wallet_* tables = individual persona ledgers (DVN/x402 mirror)
--   knyt_treasury_* tables = system-level pool accounting
-- =============================================================================

-- Treasury namespace registry
CREATE TABLE IF NOT EXISTS knyt_treasury_namespaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,  -- e.g. '21sats_community_world'
  name              TEXT NOT NULL,
  description       TEXT,
  world_id          TEXT,                  -- linked world (NULL = franchise-level)
  asset_code        TEXT NOT NULL DEFAULT 'KNYT',
  -- Current balance (updated on each ledger entry)
  balance           NUMERIC(20, 8) NOT NULL DEFAULT 0,
  -- On-chain authority
  autodrive_cid     TEXT,                  -- latest settled state CID
  -- Status
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Treasury ledger events
CREATE TABLE IF NOT EXISTS knyt_treasury_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id          UUID NOT NULL REFERENCES knyt_treasury_namespaces(id) ON DELETE RESTRICT,
  -- Event
  event_type            TEXT NOT NULL,
  -- credit | debit
  direction             TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_knyt           NUMERIC(20, 8) NOT NULL CHECK (amount_knyt > 0),
  balance_after         NUMERIC(20, 8) NOT NULL,
  -- Source reference
  source_type           TEXT,             -- 'election_settlement' | 'contribution_reward' | 'canon_elevation' | 'correspondent_reward' | 'manual'
  source_id             TEXT,             -- election_id, contribution_id, etc.
  -- Persona (if persona-directed disbursement)
  persona_id            UUID,
  -- Settlement
  settled               BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at            TIMESTAMPTZ,
  -- On-chain record (written for each settled event)
  autodrive_cid         TEXT,
  -- Metadata
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_knyt_treasury_namespace_slug   ON knyt_treasury_namespaces(slug);
CREATE INDEX idx_knyt_treasury_ledger_namespace ON knyt_treasury_ledger(namespace_id);
CREATE INDEX idx_knyt_treasury_ledger_source    ON knyt_treasury_ledger(source_type, source_id);
CREATE INDEX idx_knyt_treasury_ledger_persona   ON knyt_treasury_ledger(persona_id);
CREATE INDEX idx_knyt_treasury_ledger_settled   ON knyt_treasury_ledger(settled, settled_at);

-- Auto-update updated_at on namespaces
CREATE OR REPLACE FUNCTION knyt_treasury_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER knyt_treasury_namespaces_updated_at
  BEFORE UPDATE ON knyt_treasury_namespaces
  FOR EACH ROW EXECUTE FUNCTION knyt_treasury_set_updated_at();

-- Update namespace balance on each ledger entry
CREATE OR REPLACE FUNCTION knyt_treasury_update_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE knyt_treasury_namespaces
  SET balance = NEW.balance_after,
      updated_at = NOW()
  WHERE id = NEW.namespace_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER knyt_treasury_ledger_update_balance
  AFTER INSERT ON knyt_treasury_ledger
  FOR EACH ROW EXECUTE FUNCTION knyt_treasury_update_balance();

-- RLS
ALTER TABLE knyt_treasury_namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE knyt_treasury_ledger     ENABLE ROW LEVEL SECURITY;

-- Namespaces readable by all; mutations service-role only
CREATE POLICY "knyt_treasury_namespaces_read_all" ON knyt_treasury_namespaces
  FOR SELECT USING (true);

CREATE POLICY "knyt_treasury_namespaces_write_service" ON knyt_treasury_namespaces
  FOR ALL USING (auth.role() = 'service_role');

-- Ledger readable by all; mutations service-role only
CREATE POLICY "knyt_treasury_ledger_read_all" ON knyt_treasury_ledger
  FOR SELECT USING (true);

CREATE POLICY "knyt_treasury_ledger_write_service" ON knyt_treasury_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- Seed the three launch treasury namespaces
INSERT INTO knyt_treasury_namespaces (slug, name, description, world_id, asset_code)
VALUES
  (
    '21sats_community_world',
    '21 Sats Community World Treasury',
    'Reward pool for the active 21 Sats canonical community world. Funds vote participation rewards, contribution rewards, and correspondent rewards.',
    '21sats',
    'KNYT'
  ),
  (
    '21sats_master',
    '21 Sats Master Treasury',
    'Master treasury for the 21 Sats programme. Top-level accounting across the community world and any future 21 Sats activations.',
    '21sats',
    'KNYT'
  ),
  (
    'knyt_franchise',
    'KNYT Franchise Treasury',
    'Broader KNYT franchise treasury. Cross-world accounting, franchise-level rewards, and metaKnyts ↔ 21 Sats accounting relationship.',
    NULL,
    'KNYT'
  )
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- KNYT Reward Grants
-- =============================================================================

CREATE TABLE IF NOT EXISTS knyt_reward_grants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       UUID NOT NULL,
  task_type        TEXT NOT NULL,
  amount_knyt      NUMERIC(18,8) NOT NULL DEFAULT 0,
  base_amount_knyt NUMERIC(18,8) NOT NULL DEFAULT 0,
  rep_multiplier   NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  source_event_id  UUID,
  metadata         JSONB,
  settled          BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at       TIMESTAMPTZ,
  tx_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knyt_reward_grants_persona  ON knyt_reward_grants(persona_id);
CREATE INDEX idx_knyt_reward_grants_type     ON knyt_reward_grants(task_type);
CREATE INDEX idx_knyt_reward_grants_settled  ON knyt_reward_grants(settled, settled_at);
CREATE INDEX idx_knyt_reward_grants_source   ON knyt_reward_grants(source_event_id);

ALTER TABLE knyt_reward_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyt_reward_grants_read_all" ON knyt_reward_grants
  FOR SELECT USING (true);

CREATE POLICY "knyt_reward_grants_write_service" ON knyt_reward_grants
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- KNYT Persona Roles
-- Stores persona-level roles (correspondent, steward, etc.)
-- Separate from crm_entitlements which is content-access only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS knyt_persona_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id   UUID NOT NULL,
  role         TEXT NOT NULL,
  world_id     TEXT NOT NULL DEFAULT '21sats',
  granted_by   UUID,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  metadata     JSONB,
  UNIQUE(persona_id, role, world_id)
);

CREATE INDEX idx_knyt_persona_roles_persona ON knyt_persona_roles(persona_id);
CREATE INDEX idx_knyt_persona_roles_role    ON knyt_persona_roles(role, world_id);

ALTER TABLE knyt_persona_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyt_persona_roles_read_all" ON knyt_persona_roles
  FOR SELECT USING (true);

CREATE POLICY "knyt_persona_roles_write_service" ON knyt_persona_roles
  FOR ALL USING (auth.role() = 'service_role');
