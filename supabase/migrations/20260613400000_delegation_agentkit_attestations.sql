-- 2026-06-13 — AgentKit attestation receipts on bounded-delegation grants.
--
-- Per the 2026-06-13 hackathon plan §Sprint 5. AgentKit operates WITHIN
-- the bounded-delegation framework — it does not replace it. When a
-- bounded delegation lands, optionally call /api/access/delegation/
-- agentkit-attest to issue an AgentKit policy attestation. The
-- attestation references the citizen's World ID nullifier when
-- available (verified human) or null (still valid grant, no AgentKit
-- badge).
--
-- We store the attestation receipts in their own table so the existing
-- delegation grant tables stay unchanged — AgentKit is additive.
--
-- T0 discipline:
--   - sponsor_persona_id is server-internal (RLS gates reads to owner).
--   - sponsor_passport_id (T1) and sponsor_world_id_nullifier (T1) are
--     safe to expose to verifiers.
--   - attestation_token is opaque; the verifier needs it to confirm,
--     not to read.

CREATE TABLE IF NOT EXISTS delegation_agentkit_attestations (
  attestation_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_grant_id       text NOT NULL,                -- our bounded-delegation grant id
  sponsor_persona_id        uuid NOT NULL,                -- T0
  sponsor_passport_id       text NOT NULL,                -- T1
  sponsor_world_id_nullifier text,                        -- T1: ZK-derived commitment when verified
  delegated_agent_root_id   uuid REFERENCES agent_root_identity(id) ON DELETE CASCADE,
  attestation_token         text NOT NULL,                -- opaque token consumers present to verifier
  attestation_ref           text NOT NULL,                -- T1 receipt reference
  mode                      text NOT NULL CHECK (mode IN ('stub','live')) DEFAULT 'stub',
  verified_human            boolean NOT NULL DEFAULT false,
  issued_at                 timestamptz NOT NULL DEFAULT now(),
  expires_at                timestamptz,
  revoked_at                timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agentkit_attest_grant
  ON delegation_agentkit_attestations(delegation_grant_id);

CREATE INDEX IF NOT EXISTS idx_agentkit_attest_sponsor
  ON delegation_agentkit_attestations(sponsor_persona_id);

CREATE INDEX IF NOT EXISTS idx_agentkit_attest_agent
  ON delegation_agentkit_attestations(delegated_agent_root_id)
  WHERE revoked_at IS NULL;

ALTER TABLE delegation_agentkit_attestations ENABLE ROW LEVEL SECURITY;

-- Sponsors read their own attestations; verifiers read via service role
-- (the verify endpoint validates the token cryptographically, not by
-- looking up the row).
CREATE POLICY agentkit_attest_sponsor_read ON delegation_agentkit_attestations
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR sponsor_persona_id IN (
      SELECT id FROM personas WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY agentkit_attest_service_write ON delegation_agentkit_attestations
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE delegation_agentkit_attestations IS
  'AgentKit policy attestations on bounded-delegation grants. Additive — does not replace the grant tables. Issued by /api/access/delegation/agentkit-attest.';
