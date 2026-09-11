-- 2026-06-13 — ENS subname assignments for personas + lockers.
--
-- Per the 2026-06-13 hackathon plan §Sprint 7. Optional ENS naming
-- via Namestone (gasless L2 subnames). Anonymity remains default —
-- ENS is an explicit opt-in. The relationship between ENS name and
-- persona is still obfuscated via DVN T0->T2 tiers + ProveKit.
--
-- Two tables:
--   persona_ens_names — opt-in ENS name on a citizen or agent persona
--   locker_ens_names  — opt-in ENS name on a locker holder bundle
--
-- T0 discipline: persona_id is server-internal. ens_name + parent are
-- public (the whole point). The mapping persona_id -> ens_name is
-- gated by spine ownership; the reverse lookup ens_name -> public_ref
-- is public but the public_ref is a commitment hash, never the T0 id.

CREATE TABLE IF NOT EXISTS persona_ens_names (
  ens_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          uuid NOT NULL,
  persona_public_ref  text NOT NULL,            -- T1-safe commitment hash (what the reverse lookup returns)
  ens_label           text NOT NULL,            -- e.g. 'first-citizen'
  ens_parent          text NOT NULL DEFAULT 'polity.eth',
  ens_full            text NOT NULL,            -- 'first-citizen.polity.eth'
  namestone_response  jsonb,                    -- raw Namestone response (debug; T1-safe)
  status              text NOT NULL CHECK (status IN ('pending','live','released')) DEFAULT 'pending',
  minted_at           timestamptz NOT NULL DEFAULT now(),
  released_at         timestamptz,
  UNIQUE (ens_full)
);

CREATE INDEX IF NOT EXISTS idx_persona_ens_persona
  ON persona_ens_names(persona_id);

CREATE INDEX IF NOT EXISTS idx_persona_ens_public_ref
  ON persona_ens_names(persona_public_ref);

ALTER TABLE persona_ens_names ENABLE ROW LEVEL SECURITY;

-- Holder reads their own assignment; reverse lookup goes via the
-- service-role resolver endpoint (RLS-bypassed).
CREATE POLICY persona_ens_holder_read ON persona_ens_names
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM personas WHERE auth_profile_id = auth.uid())
  );

CREATE POLICY persona_ens_service_write ON persona_ens_names
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE persona_ens_names IS
  'Opt-in ENS subname assignments on personas via Namestone. ens_full uniqueness enforced. Status released means the name was returned to the pool.';

-- ─── Locker ENS subnames ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locker_ens_names (
  ens_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_persona_id uuid NOT NULL,
  ens_label         text NOT NULL,                  -- 'first-citizen.locker'
  ens_parent        text NOT NULL DEFAULT 'polity.eth',
  ens_full          text NOT NULL,                  -- 'first-citizen.locker.polity.eth'
  status            text NOT NULL CHECK (status IN ('pending','live','released')) DEFAULT 'pending',
  minted_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ens_full),
  UNIQUE (holder_persona_id, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_locker_ens_holder
  ON locker_ens_names(holder_persona_id);

ALTER TABLE locker_ens_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY locker_ens_holder_read ON locker_ens_names
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR holder_persona_id IN (SELECT id FROM personas WHERE auth_profile_id = auth.uid())
  );

CREATE POLICY locker_ens_service_write ON locker_ens_names
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
