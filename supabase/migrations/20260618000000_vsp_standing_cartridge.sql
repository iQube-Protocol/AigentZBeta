-- VSP Standing Cartridge migration
-- Creates vsp_profiles, vsp_evidence, vsp_facts tables
-- and links mobility_cases to vsp_profiles

-- ─── vsp_profiles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vsp_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_persona_id uuid        NOT NULL,
  label            text        NOT NULL DEFAULT 'Standing Profile',
  profile_type     text        NOT NULL DEFAULT 'general'
                               CHECK (profile_type IN ('general','o1','eb1','global_talent','founder','executive','academic')),
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','archived')),
  vsp_content      jsonb,
  compiled_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── vsp_evidence ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vsp_evidence (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid        NOT NULL REFERENCES vsp_profiles(id) ON DELETE CASCADE,
  source_type         text        NOT NULL
                                  CHECK (source_type IN (
                                    'passport','birth_certificate','cv','linkedin',
                                    'academic_transcript','degree_certificate','professional_license',
                                    'published_article','book','patent','company_record',
                                    'reference_letter','o1_petition','eb1_petition',
                                    'global_talent_application','executive_background','other'
                                  )),
  label               text        NOT NULL,
  content_text        text        NOT NULL DEFAULT '',
  extraction_status   text        NOT NULL DEFAULT 'pending'
                                  CHECK (extraction_status IN ('pending','extracting','extracted','failed')),
  extracted_fact_count integer    NOT NULL DEFAULT 0,
  extracted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── vsp_facts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vsp_facts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid        NOT NULL REFERENCES vsp_profiles(id) ON DELETE CASCADE,
  evidence_id     uuid        REFERENCES vsp_evidence(id) ON DELETE SET NULL,
  domain          text        NOT NULL
                              CHECK (domain IN (
                                'identity','education','professional','founder',
                                'recognition','validation','extraordinary_ability'
                              )),
  field           text        NOT NULL,
  label           text        NOT NULL,
  extracted_value text        NOT NULL,
  confidence      text        NOT NULL DEFAULT 'DOCUMENT_VERIFIED'
                              CHECK (confidence IN (
                                'DOCUMENT_VERIFIED','PRINCIPAL_VERIFIED','AGENT_VERIFIED','UNKNOWN'
                              )),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','corrected')),
  principal_value text,
  approved_at     timestamptz,
  locked_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Link mobility_cases to vsp_profiles ─────────────────────────────────────
ALTER TABLE mobility_cases
  ADD COLUMN IF NOT EXISTS vsp_profile_id uuid REFERENCES vsp_profiles(id) ON DELETE SET NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vsp_profiles_owner      ON vsp_profiles(owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_vsp_evidence_profile    ON vsp_evidence(profile_id);
CREATE INDEX IF NOT EXISTS idx_vsp_facts_profile       ON vsp_facts(profile_id);
CREATE INDEX IF NOT EXISTS idx_vsp_facts_evidence      ON vsp_facts(evidence_id);
CREATE INDEX IF NOT EXISTS idx_mobility_cases_vsp      ON mobility_cases(vsp_profile_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vsp_profiles_updated_at ON vsp_profiles;
CREATE TRIGGER vsp_profiles_updated_at
  BEFORE UPDATE ON vsp_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE vsp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vsp_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE vsp_facts    ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_vsp_profiles" ON vsp_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_vsp_evidence" ON vsp_evidence
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_vsp_facts" ON vsp_facts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
