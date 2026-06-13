-- 2026-06-13 — PersonaQube mints (Sui + Walrus)
--
-- Records the result of minting a persona to the Polity Passport rail
-- (Sui + Walrus). Distinct from iqube_mint_stubs (Qripto/KNYT, AutoDrive).
-- Routes: POST /api/iqube/persona/passport/mint
-- Service: services/persona/mintPersonaToSui.ts
--
-- T0 discipline: persona_id is a server-only owner key (RLS gates reads
-- to the owning persona). persona_public_ref is the T1-safe commitment
-- the public registry / Sui object surface.

CREATE TABLE IF NOT EXISTS persona_qube_mints (
  mint_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id           uuid NOT NULL,
  persona_public_ref   text NOT NULL,
  kybe_did_public_ref  text,
  sui_object_id        text NOT NULL,
  walrus_blob_id       text NOT NULL,
  receipt_id           text,
  mint_mode            text NOT NULL CHECK (mint_mode IN ('stub', 'sui-walrus')),
  on_chain             boolean NOT NULL DEFAULT false,
  display_label        text,
  minted_at            timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_qube_mints_persona
  ON persona_qube_mints(persona_id);

CREATE INDEX IF NOT EXISTS idx_persona_qube_mints_public_ref
  ON persona_qube_mints(persona_public_ref);

-- Only one active mint per persona — re-mints update in-place.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_persona_qube_mint_per_persona
  ON persona_qube_mints(persona_id);

ALTER TABLE persona_qube_mints ENABLE ROW LEVEL SECURITY;

-- Read: a persona can read its own mint row. Service role bypasses RLS.
CREATE POLICY persona_qube_mints_holder_read ON persona_qube_mints
  FOR SELECT USING (
    persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
  );

-- Write: service role only (the route writes via the admin client after
-- verifying the caller through the spine).
CREATE POLICY persona_qube_mints_service_write ON persona_qube_mints
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE persona_qube_mints IS
  'PersonaQube mints on Sui+Walrus rail (Polity Passport). Distinct from iqube_mint_stubs (AutoDrive rail).';
