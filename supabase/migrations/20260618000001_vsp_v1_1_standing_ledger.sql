-- VSP Standing Cartridge v1.1 — Personal Capability & Standing Ledger
-- Expands evidence domains, adds classification framework, Standing Asset Graph,
-- and secure vault storage fields.

-- ─── Expand domain CHECK on vsp_facts ────────────────────────────────────────
-- Add publications, media, speaking domains
ALTER TABLE vsp_facts
  DROP CONSTRAINT IF EXISTS vsp_facts_domain_check;

ALTER TABLE vsp_facts
  ADD CONSTRAINT vsp_facts_domain_check CHECK (domain IN (
    'identity','education','professional','founder',
    'recognition','publications','media','speaking',
    'validation','extraordinary_ability'
  ));

-- ─── Expand source_type CHECK on vsp_evidence ────────────────────────────────
ALTER TABLE vsp_evidence
  DROP CONSTRAINT IF EXISTS vsp_evidence_source_type_check;

ALTER TABLE vsp_evidence
  ADD CONSTRAINT vsp_evidence_source_type_check CHECK (source_type IN (
    -- Identity
    'passport','national_id','birth_certificate','citizenship_record','visa_record','residency_record',
    -- Education
    'academic_transcript','degree_certificate','professional_qualification','professional_license','training_record',
    -- Professional
    'cv','linkedin','employment_record','executive_appointment','board_membership',
    -- Founder
    'company_record','patent','startup_record','fundraising_record',
    -- Publications
    'published_article','book','white_paper','research_paper','technical_publication',
    -- Media
    'media_interview','press_coverage','podcast_appearance','television_appearance','documentary','publication_feature',
    -- Speaking
    'conference_presentation','keynote','panel_appearance','guest_lecture','roundtable',
    -- Recognition / Validation
    'reference_letter','award_record','industry_distinction',
    -- Immigration
    'o1_petition','eb1_petition','global_talent_application',
    -- Other
    'other'
  ));

-- ─── Add classification to vsp_evidence ──────────────────────────────────────
-- WHITE = publicly available, GREY = limited distribution,
-- BLACK = sensitive, BLAKQUBE = highly sensitive
ALTER TABLE vsp_evidence
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'GREY'
    CHECK (classification IN ('WHITE','GREY','BLACK','BLAKQUBE'));

-- Secure vault storage fields
ALTER TABLE vsp_evidence
  ADD COLUMN IF NOT EXISTS storage_backend text
    CHECK (storage_backend IN ('sui_locker','autonomys','supabase','none'));

ALTER TABLE vsp_evidence
  ADD COLUMN IF NOT EXISTS storage_ref text;  -- Walrus blob ID, Autonomys CID, or Sui object ID

-- Disclosure / retention policy metadata
ALTER TABLE vsp_evidence
  ADD COLUMN IF NOT EXISTS disclosure_policy text NOT NULL DEFAULT 'principal_only'
    CHECK (disclosure_policy IN ('public','principal_only','service_only','restricted'));

ALTER TABLE vsp_evidence
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','self_attested','document_verified','institutionally_verified'));

ALTER TABLE vsp_evidence
  ADD COLUMN IF NOT EXISTS source_provenance text;  -- URL, institution name, or issuer

-- ─── Standing Asset Graph on vsp_profiles ────────────────────────────────────
-- Stores edges: { nodes: [...], edges: [{from: evidenceId, to: capabilityClaim, weight: 1-5}] }
ALTER TABLE vsp_profiles
  ADD COLUMN IF NOT EXISTS standing_graph jsonb;

-- ─── profile_type relaxed to 'general' only (type is determined by evidence domains) ─
-- The profile_type CHECK is kept for backward compat but 'general' becomes the primary type
-- No schema change needed; existing CHECK already includes 'general'

-- ─── Root DID / Polity Passport anchoring ────────────────────────────────────
-- When a VSP is compiled, the persona's kybe_did_public_ref is recorded here.
-- This makes the VSP a root DID asset — it travels across the persona estate
-- and is anchored to the Polity Passport credential.
ALTER TABLE vsp_profiles
  ADD COLUMN IF NOT EXISTS kybe_did_public_ref text;  -- T2-safe commitment ref from persona_qube_mints

-- Persona public ref (T2 commitment, not raw personaId) — for cross-persona VSP portability
ALTER TABLE vsp_profiles
  ADD COLUMN IF NOT EXISTS persona_public_ref text;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vsp_evidence_classification ON vsp_evidence(classification);
CREATE INDEX IF NOT EXISTS idx_vsp_evidence_storage_backend ON vsp_evidence(storage_backend) WHERE storage_backend IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vsp_profiles_kybe_did ON vsp_profiles(kybe_did_public_ref) WHERE kybe_did_public_ref IS NOT NULL;
