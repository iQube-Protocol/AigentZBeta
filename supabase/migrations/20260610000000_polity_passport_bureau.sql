-- Polity Passport Bureau — Stage 1 data layer
--
-- PRD: codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-prd-v1.md
-- Implementation plan: codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-implementation-plan.md
-- Schema bundle: polity-passport-bureau/schemas/ (v0.1, 11 schemas)
--
-- Operator decisions applied:
--   1. No new IQubeType — passport records use registry_record_type = 'polity_passport'
--      as metadata on existing registry_assets rows (DataQube for applications,
--      AigentQube for agents).
--   2. Bureau auth via synthetic-email Supabase user (<username>@passport.metame.internal)
--      flowing through existing getActivePersona — no parallel auth gate.
--   3. Steward role via admin-cartridge:polity-passport-bureau credential class.
--
-- Self-custody vault enforcement (PRD Addendum A / CLAUDE.md §2):
--   These tables carry ONLY content_id, content_hash, flags, and refs.
--   NO PII columns (name, email, address, etc.) — private data lives in the
--   client-side-encrypted blakQube vault on AutoDrive. The canary test
--   (tests/passport-bureau.test.ts) asserts this invariant.
--
-- T0 identifier note (CLAUDE.md PARAMOUNT):
--   persona_id, kybe_identity_id, root_identity_id are T0 server-internal FKs.
--   They MUST NOT appear in browser-bound JSON, public registry projections,
--   or chain-bound receipts. Public surfaces use commitment-hash derivatives
--   (the hashPersonaRef pattern).
--
-- Additive migration. All tables are new. Non-breaking.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. polity_passport_applications
-- ═══════════════════════════════════════════════════════════════════════════════
-- Tracks application submissions for both citizen and participant classes.
-- Mirrors the registry intake pattern: application → pending review → decision.

CREATE TABLE IF NOT EXISTS polity_passport_applications (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Class discriminator: drives which status machine applies
  passport_class         text NOT NULL
    CHECK (passport_class IN ('citizen', 'agent_participant', 'robot_participant', 'organization_participant')),

  -- Application-phase status (distinct from passport-phase status on records)
  application_status     text NOT NULL DEFAULT 'draft'
    CHECK (application_status IN ('draft', 'submitted', 'pending_approval', 'approved', 'denied', 'withdrawn', 'needs_more_information')),

  -- Identity refs — T0 server-internal, never in browser JSON
  persona_id             text,
  did_persona_id         uuid REFERENCES did_persona(id) ON DELETE SET NULL,
  kybe_identity_id       uuid REFERENCES kybe_identity(id) ON DELETE SET NULL,
  root_identity_id       uuid REFERENCES root_identity(id) ON DELETE SET NULL,

  -- Public commitment refs (T1/T2-safe, for registry projection)
  persona_public_ref     text,
  kybe_did_public_ref    text,
  root_did_public_ref    text,

  -- Self-custody vault ref — encrypted private data on AutoDrive
  vault_content_id       text,
  vault_content_hash     text,
  vault_storage_provider text DEFAULT 'auto_drive',

  -- Personhood proof (CAPTCHA weak-proof for MVP; World ID stub for V1)
  personhood_proof_type  text
    CHECK (personhood_proof_type IS NULL OR personhood_proof_type IN ('captcha', 'world_id', 'agent_declaration', 'operator_attestation')),
  personhood_proof_ref   text,
  personhood_proof_at    timestamptz,

  -- Agent-specific fields (participant class only)
  agent_card_url         text,
  agent_iqube_ref        text,
  agent_protocol         text,

  -- Registry integration
  registry_intake_id     text REFERENCES registry_intakes(intake_id) ON DELETE SET NULL,
  registry_asset_id      text,

  -- Review tracking
  assigned_steward_id    text,
  review_priority        text DEFAULT 'normal'
    CHECK (review_priority IN ('low', 'normal', 'high', 'expedited')),

  -- Application metadata (non-PII)
  passport_grade         text,
  requested_domains      jsonb NOT NULL DEFAULT '[]',
  consents               jsonb NOT NULL DEFAULT '{}',
  being_declarations     jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  submitted_at           timestamptz,
  decided_at             timestamptz
);

COMMENT ON TABLE polity_passport_applications IS
  'Passport application submissions (citizen + participant). Private data in blakQube vault only — this table carries refs, hashes, and flags. T0 identity columns are server-internal.';

CREATE INDEX IF NOT EXISTS idx_pp_applications_class    ON polity_passport_applications(passport_class);
CREATE INDEX IF NOT EXISTS idx_pp_applications_status   ON polity_passport_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_pp_applications_persona  ON polity_passport_applications(persona_id);
CREATE INDEX IF NOT EXISTS idx_pp_applications_kybe     ON polity_passport_applications(kybe_identity_id);
CREATE INDEX IF NOT EXISTS idx_pp_applications_intake   ON polity_passport_applications(registry_intake_id);
CREATE INDEX IF NOT EXISTS idx_pp_applications_steward  ON polity_passport_applications(assigned_steward_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. polity_passport_records
-- ═══════════════════════════════════════════════════════════════════════════════
-- Issued passport credentials. Per-class status columns with CHECK constraints
-- matching the status machine enums (services/passport/passportStatusMachine.ts).
-- Linked to registry_assets via registry_record_id (registry_record_type = 'polity_passport').

CREATE TABLE IF NOT EXISTS polity_passport_records (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id            text UNIQUE NOT NULL,

  passport_class         text NOT NULL
    CHECK (passport_class IN ('citizen', 'agent_participant', 'robot_participant', 'organization_participant')),

  -- Per-class status (Addendum D: citizen has no revoked; participant has revoked + delisted)
  citizen_status         text
    CHECK (citizen_status IS NULL OR citizen_status IN (
      'draft', 'submitted', 'pending_approval', 'active', 'renewal_due',
      'expired_non_renewal', 'dormant', 'inactive_presumed',
      'ceased_death_confirmed', 'superseded_by_reissue'
    )),
  participant_status     text
    CHECK (participant_status IS NULL OR participant_status IN (
      'draft', 'submitted', 'pending_approval', 'provisionally_issued',
      'approved', 'restricted', 'needs_more_information', 'suspended',
      'revoked', 'expired', 'renewed', 'delisted'
    )),

  passport_grade         text,

  -- Identity refs — T0 server-internal
  persona_id             text,
  did_persona_id         uuid REFERENCES did_persona(id) ON DELETE SET NULL,
  kybe_identity_id       uuid REFERENCES kybe_identity(id) ON DELETE SET NULL,
  root_identity_id       uuid REFERENCES root_identity(id) ON DELETE SET NULL,

  -- Public commitment refs (T1/T2-safe)
  persona_public_ref     text,
  kybe_did_public_ref    text,
  root_did_public_ref    text,

  -- Self-custody vault ref
  vault_content_id       text,
  vault_content_hash     text,

  -- Source application
  application_id         uuid REFERENCES polity_passport_applications(id) ON DELETE SET NULL,

  -- Registry integration (registry_record_type = 'polity_passport' on the asset)
  registry_record_id     text,

  -- Issuer
  issuer_id              text NOT NULL DEFAULT 'polity-passport-bureau',
  issuer_signature       text,

  -- Lifecycle
  issued_at              timestamptz,
  expires_at             timestamptz,
  renewed_at             timestamptz,
  renewal_of_passport_id text,

  -- Revocation (participant class only — citizen passports are irrevocable)
  revoked                boolean NOT NULL DEFAULT false,
  revoked_at             timestamptz,
  revocation_reason      text,
  revocation_receipt_ref text,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  -- Citizen passports: revoked must always be false
  CONSTRAINT citizen_irrevocable CHECK (
    passport_class != 'citizen' OR revoked = false
  ),
  -- Only one status column populated per class
  CONSTRAINT status_class_match CHECK (
    (passport_class = 'citizen' AND citizen_status IS NOT NULL AND participant_status IS NULL)
    OR (passport_class != 'citizen' AND participant_status IS NOT NULL AND citizen_status IS NULL)
  )
);

COMMENT ON TABLE polity_passport_records IS
  'Issued passport credentials. Citizen passports are irrevocable (Addendum D) — the citizen_irrevocable CHECK constraint enforces this at the DB level. Per-class status columns match the status machine enums.';

CREATE INDEX IF NOT EXISTS idx_pp_records_class         ON polity_passport_records(passport_class);
CREATE INDEX IF NOT EXISTS idx_pp_records_citizen_st    ON polity_passport_records(citizen_status) WHERE citizen_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_records_participant_st ON polity_passport_records(participant_status) WHERE participant_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_records_persona       ON polity_passport_records(persona_id);
CREATE INDEX IF NOT EXISTS idx_pp_records_kybe          ON polity_passport_records(kybe_identity_id);
CREATE INDEX IF NOT EXISTS idx_pp_records_passport_id   ON polity_passport_records(passport_id);
CREATE INDEX IF NOT EXISTS idx_pp_records_application   ON polity_passport_records(application_id);
CREATE INDEX IF NOT EXISTS idx_pp_records_registry      ON polity_passport_records(registry_record_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. passport_citizen_privileges
-- ═══════════════════════════════════════════════════════════════════════════════
-- Per PRD Addendum D: privilege-standing object. Citizen passport remains valid
-- even when all privileges are restricted. Reputation consequences for citizens
-- act exclusively here, never on passport existence.

CREATE TABLE IF NOT EXISTS passport_citizen_privileges (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_record_id     uuid NOT NULL REFERENCES polity_passport_records(id) ON DELETE CASCADE,

  -- passport_remains_valid is always true — citizen passports are irrevocable
  passport_remains_valid boolean NOT NULL DEFAULT true
    CHECK (passport_remains_valid = true),

  privilege_status       text NOT NULL DEFAULT 'full_privileges'
    CHECK (privilege_status IN (
      'full_privileges', 'restricted', 'suspended', 'under_review',
      'probationary', 'minimal_privileges'
    )),

  -- Active restrictions (JSONB array matching the schema)
  active_restrictions    jsonb NOT NULL DEFAULT '[]',
  restriction_count      integer NOT NULL DEFAULT 0,

  -- Standing from reputation system (read via RootDID → ReputationQube path)
  reputation_standing    text DEFAULT 'good_standing'
    CHECK (reputation_standing IS NULL OR reputation_standing IN (
      'good_standing', 'watchlist', 'limited_standing', 'restricted_standing',
      'under_review', 'suspended_standing', 'revoked_standing', 'inactive'
    )),

  -- Constitutional invariants (always true for citizens)
  personhood_not_revoked                boolean NOT NULL DEFAULT true CHECK (personhood_not_revoked = true),
  passport_not_revoked_for_reputation   boolean NOT NULL DEFAULT true CHECK (passport_not_revoked_for_reputation = true),
  restrictions_apply_only_to_privileges boolean NOT NULL DEFAULT true CHECK (restrictions_apply_only_to_privileges = true),

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE passport_citizen_privileges IS
  'Citizen privilege-standing (Addendum D). passport_remains_valid is CHECK-enforced true — citizen passports are irrevocable personhood recognition. Reputation consequences act only on privileges, never on passport existence.';

CREATE INDEX IF NOT EXISTS idx_pp_citizen_priv_record  ON passport_citizen_privileges(passport_record_id);
CREATE INDEX IF NOT EXISTS idx_pp_citizen_priv_status  ON passport_citizen_privileges(privilege_status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. passport_reputation_bindings
-- ═══════════════════════════════════════════════════════════════════════════════
-- Reputation binding records. For citizen holders, the binding attaches through
-- the RootDID-layer identity (persona → RootDID → ReputationQube) and feeds the
-- citizen privilege-standing object ONLY — never the passport credential.
-- For participant holders, the binding attaches directly to the passport.

CREATE TABLE IF NOT EXISTS passport_reputation_bindings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reputation_binding_id  text UNIQUE NOT NULL,

  -- For participants: direct passport reference
  -- For citizens: passport_record_id is optional; privilege_standing_id is the anchor
  passport_record_id     uuid REFERENCES polity_passport_records(id) ON DELETE SET NULL,
  privilege_standing_id  uuid REFERENCES passport_citizen_privileges(id) ON DELETE SET NULL,

  holder_type            text NOT NULL
    CHECK (holder_type IN ('citizen', 'agent_participant', 'robot_participant', 'organization_participant')),

  -- Identity refs — T0 server-internal
  persona_id             text,
  root_identity_id       uuid REFERENCES root_identity(id) ON DELETE SET NULL,

  -- Reputation system reference
  reputation_system_ref  text NOT NULL,
  standing_status        text NOT NULL DEFAULT 'good_standing'
    CHECK (standing_status IN (
      'good_standing', 'watchlist', 'limited_standing', 'restricted_standing',
      'under_review', 'suspended_standing', 'revoked_standing', 'inactive'
    )),

  -- Citizen passport irrevocability flag (always true for citizen holders)
  citizen_passport_irrevocable boolean NOT NULL DEFAULT true,

  -- Reputation summary (non-PII aggregate)
  public_score           numeric,
  private_score_ref      text,
  infraction_count       integer NOT NULL DEFAULT 0,
  active_restriction_count integer NOT NULL DEFAULT 0,
  last_reputation_check_at timestamptz,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT citizen_binding_irrevocable CHECK (
    holder_type != 'citizen' OR citizen_passport_irrevocable = true
  )
);

COMMENT ON TABLE passport_reputation_bindings IS
  'Reputation bindings (Addendum E). Citizen bindings anchor via RootDID → privilege-standing, never to the passport credential. Participant bindings anchor directly to the passport record.';

CREATE INDEX IF NOT EXISTS idx_pp_rep_binding_passport   ON passport_reputation_bindings(passport_record_id);
CREATE INDEX IF NOT EXISTS idx_pp_rep_binding_privilege   ON passport_reputation_bindings(privilege_standing_id);
CREATE INDEX IF NOT EXISTS idx_pp_rep_binding_holder     ON passport_reputation_bindings(holder_type);
CREATE INDEX IF NOT EXISTS idx_pp_rep_binding_standing   ON passport_reputation_bindings(standing_status);
CREATE INDEX IF NOT EXISTS idx_pp_rep_binding_persona    ON passport_reputation_bindings(persona_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. passport_infractions
-- ═══════════════════════════════════════════════════════════════════════════════
-- Infraction event records. Schema only for MVP — the infraction recording
-- pipeline is a deferred feature. Writes flow through the DVN receipt pipeline
-- (passport_infraction_recorded anchorable action type).

CREATE TABLE IF NOT EXISTS passport_infractions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infraction_id          text UNIQUE NOT NULL,

  reputation_binding_id  uuid REFERENCES passport_reputation_bindings(id) ON DELETE SET NULL,
  passport_record_id     uuid REFERENCES polity_passport_records(id) ON DELETE SET NULL,

  holder_type            text NOT NULL
    CHECK (holder_type IN ('citizen', 'agent_participant', 'robot_participant', 'organization_participant')),

  infraction_type        text NOT NULL
    CHECK (infraction_type IN (
      'policy_violation', 'trust_breach', 'abuse_of_access', 'data_misuse',
      'unauthorized_action', 'compliance_failure', 'community_violation', 'other'
    )),

  severity               text NOT NULL DEFAULT 'minor'
    CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),

  description            text,
  evidence_refs          jsonb NOT NULL DEFAULT '[]',

  -- Consequences applied
  consequences_applied   jsonb NOT NULL DEFAULT '[]',

  -- Citizen passport revocation is never a consequence
  citizen_passport_revocation_allowed boolean NOT NULL DEFAULT false
    CHECK (citizen_passport_revocation_allowed = false),

  -- Standing change
  standing_before        text,
  standing_after         text,

  -- Audit trail
  reported_by            text,
  reviewed_by            text,
  receipt_ref            text,

  reported_at            timestamptz NOT NULL DEFAULT now(),
  resolved_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE passport_infractions IS
  'Infraction event records (schema only for MVP). citizen_passport_revocation_allowed is CHECK-enforced false — citizen passports are never revoked as a consequence of infractions (Addendum D).';

CREATE INDEX IF NOT EXISTS idx_pp_infractions_binding    ON passport_infractions(reputation_binding_id);
CREATE INDEX IF NOT EXISTS idx_pp_infractions_passport   ON passport_infractions(passport_record_id);
CREATE INDEX IF NOT EXISTS idx_pp_infractions_holder     ON passport_infractions(holder_type);
CREATE INDEX IF NOT EXISTS idx_pp_infractions_severity   ON passport_infractions(severity);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. passport_status_transitions (audit log)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Every status transition is recorded with actor, evidence, and receipt ref.
-- Mirrors the status-transition schema.

CREATE TABLE IF NOT EXISTS passport_status_transitions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_record_id     uuid NOT NULL REFERENCES polity_passport_records(id) ON DELETE CASCADE,

  from_status            text NOT NULL,
  to_status              text NOT NULL,
  passport_class         text NOT NULL
    CHECK (passport_class IN ('citizen', 'agent_participant', 'robot_participant', 'organization_participant')),

  actor_type             text NOT NULL
    CHECK (actor_type IN ('applicant', 'agent', 'system', 'steward', 'committee', 'admin')),
  actor_id               text,

  reason                 text,
  evidence_type          text,
  evidence_refs          jsonb NOT NULL DEFAULT '[]',

  receipt_ref            text,
  receipt_action         text,

  transitioned_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE passport_status_transitions IS
  'Audit log of every passport status transition. Pairs with DVN receipts for chain-of-provenance.';

CREATE INDEX IF NOT EXISTS idx_pp_transitions_record    ON passport_status_transitions(passport_record_id);
CREATE INDEX IF NOT EXISTS idx_pp_transitions_class     ON passport_status_transitions(passport_class);
CREATE INDEX IF NOT EXISTS idx_pp_transitions_at        ON passport_status_transitions(transitioned_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE polity_passport_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE polity_passport_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_citizen_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_reputation_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_status_transitions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes run as service_role)
CREATE POLICY "pp_applications_service" ON polity_passport_applications
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pp_records_service" ON polity_passport_records
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pp_citizen_priv_service" ON passport_citizen_privileges
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pp_rep_binding_service" ON passport_reputation_bindings
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pp_infractions_service" ON passport_infractions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pp_transitions_service" ON passport_status_transitions
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read their own applications and records
CREATE POLICY "pp_applications_own_select" ON polity_passport_applications
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND persona_id IS NOT NULL
  );
CREATE POLICY "pp_records_own_select" ON polity_passport_records
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND persona_id IS NOT NULL
  );
CREATE POLICY "pp_citizen_priv_own_select" ON passport_citizen_privileges
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM polity_passport_records r
      WHERE r.id = passport_citizen_privileges.passport_record_id
        AND r.persona_id IS NOT NULL
    )
  );

-- Transitions are read-only for authenticated users (audit trail)
CREATE POLICY "pp_transitions_select" ON passport_status_transitions
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
