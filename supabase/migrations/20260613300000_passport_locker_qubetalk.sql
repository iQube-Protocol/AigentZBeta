-- 2026-06-13 — Passport Locker (Sprint 4).
--
-- Per the 2026-06-13 hackathon plan §Sprint 4. The locker is a
-- holder-owned encrypted vault for passport-related data (documents,
-- declarations, evidence). Each item is encrypted client-side and stored
-- as a Walrus blob, with a Sui object representing the access policy.
--
-- Two tables:
--   passport_locker_items   — one row per encrypted asset
--   passport_locker_grants  — per-item access grants to delegated agents
--
-- Storage rail: Sui + Walrus (Polity Passport rail per Decision A).
-- AutoDrive content is OUT OF SCOPE here — kept distinct.
--
-- T0 discipline:
--   holder_persona_id is server-internal (RLS gates reads to owner).
--   The walrus_blob_id and sui_object_id are public-network commitments
--   (T2-safe). encrypted_metadata is opaque ciphertext.
--   downloadable=false marks "view-in-app only" items — the bound agent
--   can read them through the QubeTalk bridge but cannot export bytes.

CREATE TABLE IF NOT EXISTS passport_locker_items (
  item_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_persona_id    uuid NOT NULL,
  holder_passport_id   text,                          -- citizen passport that owns the locker (nullable: pre-issuance items)
  display_name         text NOT NULL,                 -- human label (e.g. 'Birth certificate', 'Visa application')
  content_type         text NOT NULL,                 -- MIME type
  size_bytes           bigint,
  walrus_blob_id       text NOT NULL,                 -- Walrus content id (encrypted payload)
  sui_object_id        text,                          -- Sui object representing access policy (NULL until real-mode publish)
  encrypted_metadata   text,                          -- opaque ciphertext (filename hint, source, etc.)
  encryption_iv        text,                          -- AES-GCM IV (base64)
  encryption_auth_tag  text,                          -- AES-GCM auth tag (base64)
  downloadable         boolean NOT NULL DEFAULT true, -- false = view-in-app only (no byte export)
  storage_mode         text NOT NULL CHECK (storage_mode IN ('stub', 'sui-walrus')) DEFAULT 'stub',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locker_items_holder
  ON passport_locker_items(holder_persona_id);

CREATE INDEX IF NOT EXISTS idx_locker_items_passport
  ON passport_locker_items(holder_passport_id)
  WHERE holder_passport_id IS NOT NULL;

ALTER TABLE passport_locker_items ENABLE ROW LEVEL SECURITY;

-- Holders read their own items; service role bypasses.
CREATE POLICY locker_items_holder_read ON passport_locker_items
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR holder_persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
  );

-- Writes only through the service-role endpoints (after spine auth).
CREATE POLICY locker_items_service_write ON passport_locker_items
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE passport_locker_items IS
  'Polity Passport Locker — holder-owned encrypted asset vault (Sui+Walrus rail).';
COMMENT ON COLUMN passport_locker_items.downloadable IS
  'When false, bound agents can read in-app via QubeTalk but cannot export bytes.';

-- ─────────────────────────────────────────────────────────────────────
-- Locker access grants — per-item delegations to bound agents.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS passport_locker_grants (
  grant_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id               uuid NOT NULL REFERENCES passport_locker_items(item_id) ON DELETE CASCADE,
  delegated_persona_id  uuid NOT NULL,
  delegated_agent_root_id uuid REFERENCES agent_root_identity(id) ON DELETE CASCADE,
  scope                 text NOT NULL CHECK (scope IN ('read', 'read_download')) DEFAULT 'read',
  granted_by_persona_id uuid NOT NULL,
  granted_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz,
  revoked_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_locker_grants_item
  ON passport_locker_grants(item_id);

CREATE INDEX IF NOT EXISTS idx_locker_grants_delegate
  ON passport_locker_grants(delegated_persona_id)
  WHERE revoked_at IS NULL;

ALTER TABLE passport_locker_grants ENABLE ROW LEVEL SECURITY;

-- Grants are visible to the granting holder OR the delegated persona.
CREATE POLICY locker_grants_principal_read ON passport_locker_grants
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR granted_by_persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
    OR delegated_persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY locker_grants_service_write ON passport_locker_grants
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE passport_locker_grants IS
  'Per-item access grants to bound delegated agents. scope=read_download honors item.downloadable=true; scope=read is view-only.';

-- ─────────────────────────────────────────────────────────────────────
-- QubeTalk channels — citizen ↔ delegated agent.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS passport_qubetalk_channels (
  channel_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_persona_id     uuid NOT NULL,
  delegated_persona_id  uuid NOT NULL,
  delegated_agent_root_id uuid REFERENCES agent_root_identity(id) ON DELETE CASCADE,
  delegation_grant_id   text,                         -- reference to a bounded-delegation grant
  channel_status        text NOT NULL CHECK (channel_status IN ('active','closed')) DEFAULT 'active',
  created_at            timestamptz NOT NULL DEFAULT now(),
  closed_at             timestamptz,
  UNIQUE (holder_persona_id, delegated_persona_id, channel_status)
);

CREATE INDEX IF NOT EXISTS idx_qubetalk_channels_holder
  ON passport_qubetalk_channels(holder_persona_id);

CREATE INDEX IF NOT EXISTS idx_qubetalk_channels_delegate
  ON passport_qubetalk_channels(delegated_persona_id);

ALTER TABLE passport_qubetalk_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY qubetalk_channels_principal_read ON passport_qubetalk_channels
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR holder_persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
    OR delegated_persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY qubetalk_channels_service_write ON passport_qubetalk_channels
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE passport_qubetalk_channels IS
  'QubeTalk channel pair between a citizen and a delegated agent — created when a bounded delegation is granted. Locker items are exchanged through this channel.';
