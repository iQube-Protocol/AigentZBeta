-- didqube core schema
CREATE SCHEMA IF NOT EXISTS didqube;

-- Root person (root identity)
CREATE TABLE IF NOT EXISTS didqube.person (
  person_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_root_did TEXT,
  kybe_id TEXT,
  kybe_hash TEXT,
  kyc_status TEXT CHECK (kyc_status IN ('unverified','kycd','revoked')) DEFAULT 'unverified',
  status TEXT CHECK (status IN ('active','suspended','blocked')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Root DID bindings
CREATE TABLE IF NOT EXISTS didqube.root_did_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES didqube.person(person_id) ON DELETE CASCADE,
  did_uri TEXT UNIQUE NOT NULL,
  method TEXT NOT NULL,
  status TEXT CHECK (status IN ('active','rotated','revoked')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

-- Persona (FIO handle)
CREATE TABLE IF NOT EXISTS didqube.persona (
  persona_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES didqube.person(person_id) ON DELETE CASCADE,
  fio_handle TEXT UNIQUE,
  default_identity_state TEXT CHECK (default_identity_state IN ('anonymous','semi_anonymous','semi_identifiable','identifiable')),
  app_origin TEXT,
  world_id_status TEXT CHECK (world_id_status IN ('unverified','verified_human','agent_declared')) DEFAULT 'unverified',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Persona DID bindings
CREATE TABLE IF NOT EXISTS didqube.persona_did_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES didqube.persona(persona_id) ON DELETE CASCADE,
  did_uri TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT CHECK (status IN ('active','rotated','revoked')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  UNIQUE (persona_id, did_uri)
);

-- Anonymous escrow aliases (no identity linkage)
CREATE TABLE IF NOT EXISTS didqube.anon_aliases (
  alias_commitment TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  mailbox_id TEXT,
  identity_state TEXT GENERATED ALWAYS AS ('anonymous') STORED,
  personhood_status TEXT CHECK (personhood_status IN ('unverified','verified_human')) DEFAULT 'unverified',
  expires_at TIMESTAMPTZ NOT NULL
);

-- Remote custody sessions (DB model; app may still use in-memory for dev)
CREATE TABLE IF NOT EXISTS didqube.sessions_remote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  require_level TEXT CHECK (require_level IN ('anonymous','persona','root','kybe')) NOT NULL DEFAULT 'persona',
  person_id UUID REFERENCES didqube.person(person_id),
  persona_id UUID REFERENCES didqube.persona(persona_id),
  alias_commitment TEXT REFERENCES didqube.anon_aliases(alias_commitment),
  status TEXT CHECK (status IN ('active','expired','revoked','completed')) DEFAULT 'active',
  caps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Helper domain whitelist for FIO handles (optional reference table)
CREATE TABLE IF NOT EXISTS didqube.fio_domains (
  domain TEXT PRIMARY KEY
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_root_did_bindings_person ON didqube.root_did_bindings(person_id);
CREATE INDEX IF NOT EXISTS idx_persona_person ON didqube.persona(person_id);
CREATE INDEX IF NOT EXISTS idx_persona_did_persona ON didqube.persona_did_bindings(persona_id);
CREATE INDEX IF NOT EXISTS idx_sessions_remote_person ON didqube.sessions_remote(person_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_remote_expires ON didqube.sessions_remote(expires_at);

-- RLS enablement (Postgres 15+; assumes pgcrypto/uuid-ossp or pgcrypto gen_random_uuid installed)
ALTER TABLE didqube.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE didqube.root_did_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE didqube.persona ENABLE ROW LEVEL SECURITY;
ALTER TABLE didqube.persona_did_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE didqube.sessions_remote ENABLE ROW LEVEL SECURITY;
-- anon_aliases intentionally WITHOUT owner RLS (no identity). Limit via service role only if desired.

-- Basic policies (placeholder): allow service role full access; owner by person_id read/select
-- Replace 'service_role' with the actual Supabase role identifier for the service key if needed.
DO $$ BEGIN
  -- Person: service role full
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='didqube' AND tablename='person' AND policyname='service_full_person'
  ) THEN
    CREATE POLICY service_full_person ON didqube.person FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  -- Persona: service role full
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='didqube' AND tablename='persona' AND policyname='service_full_persona'
  ) THEN
    CREATE POLICY service_full_persona ON didqube.persona FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  -- Persona DID bindings: service role full
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='didqube' AND tablename='persona_did_bindings' AND policyname='service_full_persona_did'
  ) THEN
    CREATE POLICY service_full_persona_did ON didqube.persona_did_bindings FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  -- Root DID bindings: service role full
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='didqube' AND tablename='root_did_bindings' AND policyname='service_full_root_did'
  ) THEN
    CREATE POLICY service_full_root_did ON didqube.root_did_bindings FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  -- Sessions: service role full
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='didqube' AND tablename='sessions_remote' AND policyname='service_full_sessions'
  ) THEN
    CREATE POLICY service_full_sessions ON didqube.sessions_remote FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- NOTE: Replace the permissive policies with real RLS owner-based policies once JWT contains person_id/tenant.
