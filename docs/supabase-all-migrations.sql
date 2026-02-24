-- ============================================================================
-- COMPLETE AIGENTIQ SCHEMA MIGRATION
-- Run this single file to set up all required tables
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. DIDQUBE TABLES (Identity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kybe_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kybe_did text UNIQUE NOT NULL,
  encrypted_soul_key text,
  state text CHECK (state IN ('active','revoked','deceased')) DEFAULT 'active',
  issued_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.root_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kybe_id uuid REFERENCES public.kybe_identity(id) ON DELETE SET NULL,
  kybe_hash text,
  did_uri text UNIQUE NOT NULL,
  kyc_status text CHECK (kyc_status IN ('unverified','kycd','revoked')) DEFAULT 'unverified',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.persona (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_id uuid REFERENCES public.root_identity(id) ON DELETE SET NULL,
  fio_handle text,
  default_identity_state text CHECK (default_identity_state IN ('anonymous','semi_anonymous','semi_identifiable','identifiable')) NOT NULL DEFAULT 'semi_anonymous',
  app_origin text,
  world_id_status text CHECK (world_id_status IN ('unverified','verified_human','agent_declared')) DEFAULT 'unverified',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.persona_agent_binding (
  persona_id uuid REFERENCES public.persona(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (persona_id, agent_id)
);

CREATE TABLE IF NOT EXISTS public.hcp_profile (
  persona_id uuid PRIMARY KEY REFERENCES public.persona(id) ON DELETE CASCADE,
  preference_ptr text,
  scopes jsonb,
  revocation jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2. FRANCHISES TABLE (L1 Tenants)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.franchises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  kb_endpoint text,
  ui_url text,
  chains text[] DEFAULT ARRAY['polygon'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. TENANTS TABLE (L2 Tenants)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  franchise_id uuid REFERENCES public.franchises(id),
  kb_endpoint text,
  chains text[] DEFAULT ARRAY['polygon'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. ADD franchise_id AND tenant_id TO PERSONA
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persona' AND column_name = 'franchise_id') THEN
    ALTER TABLE public.persona ADD COLUMN franchise_id uuid REFERENCES public.franchises(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persona' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.persona ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
  END IF;
END $$;

-- ============================================================================
-- 5. EVENT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('action', 'workflow', 'error', 'security', 'payment', 'identity')),
  action text NOT NULL,
  persona_id text,
  details jsonb DEFAULT '{}',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. KNOWLEDGE BASE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid REFERENCES public.franchises(id),
  tenant_id uuid REFERENCES public.tenants(id),
  doc_type text NOT NULL CHECK (doc_type IN ('COYN', 'KNYT', 'iQube', 'general')),
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. CHAT HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid REFERENCES public.franchises(id),
  tenant_id uuid REFERENCES public.tenants(id),
  persona_id uuid REFERENCES public.persona(id),
  session_id text NOT NULL,
  agent_id text NOT NULL DEFAULT 'nakamoto',
  messages jsonb NOT NULL DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. FRANCHISE CONFIG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.franchise_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id),
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(franchise_id, key)
);

-- ============================================================================
-- 9. IQUBE SHARES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.iqube_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iqube_id uuid NOT NULL,
  owner_persona_id uuid REFERENCES public.persona(id),
  shared_with_tenant_id uuid REFERENCES public.tenants(id),
  shared_with_persona_id uuid REFERENCES public.persona(id),
  access_level text NOT NULL CHECK (access_level IN ('metaqube', 'blakqube_read', 'blakqube_write')),
  consent_given_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. ADMIN TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.franchise_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id),
  persona_id uuid NOT NULL REFERENCES public.persona(id),
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  persona_id uuid NOT NULL REFERENCES public.persona(id),
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'member')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.kybe_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.root_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_agent_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcp_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iqube_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. CREATE POLICIES (permissive for now)
-- ============================================================================

-- Persona policies
DROP POLICY IF EXISTS "persona_select" ON public.persona;
CREATE POLICY "persona_select" ON public.persona FOR SELECT USING (true);
DROP POLICY IF EXISTS "persona_insert" ON public.persona;
CREATE POLICY "persona_insert" ON public.persona FOR INSERT WITH CHECK (true);

-- Franchises policies
DROP POLICY IF EXISTS "franchises_select" ON public.franchises;
CREATE POLICY "franchises_select" ON public.franchises FOR SELECT USING (true);
DROP POLICY IF EXISTS "franchises_all" ON public.franchises;
CREATE POLICY "franchises_all" ON public.franchises FOR ALL USING (auth.role() = 'service_role');

-- Tenants policies
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT USING (true);
DROP POLICY IF EXISTS "tenants_all" ON public.tenants;
CREATE POLICY "tenants_all" ON public.tenants FOR ALL USING (auth.role() = 'service_role');

-- Event logs policies
DROP POLICY IF EXISTS "event_logs_select" ON public.event_logs;
CREATE POLICY "event_logs_select" ON public.event_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_logs_insert" ON public.event_logs;
CREATE POLICY "event_logs_insert" ON public.event_logs FOR INSERT WITH CHECK (true);

-- Knowledge base policies
DROP POLICY IF EXISTS "kb_select" ON public.knowledge_base;
CREATE POLICY "kb_select" ON public.knowledge_base FOR SELECT USING (true);
DROP POLICY IF EXISTS "kb_all" ON public.knowledge_base;
CREATE POLICY "kb_all" ON public.knowledge_base FOR ALL USING (auth.role() = 'service_role');

-- Chat history policies
DROP POLICY IF EXISTS "chat_select" ON public.chat_history;
CREATE POLICY "chat_select" ON public.chat_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "chat_all" ON public.chat_history;
CREATE POLICY "chat_all" ON public.chat_history FOR ALL USING (auth.role() = 'service_role');

-- Franchise config policies
DROP POLICY IF EXISTS "config_select" ON public.franchise_config;
CREATE POLICY "config_select" ON public.franchise_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "config_all" ON public.franchise_config;
CREATE POLICY "config_all" ON public.franchise_config FOR ALL USING (auth.role() = 'service_role');

-- iQube shares policies
DROP POLICY IF EXISTS "shares_select" ON public.iqube_shares;
CREATE POLICY "shares_select" ON public.iqube_shares FOR SELECT USING (true);
DROP POLICY IF EXISTS "shares_insert" ON public.iqube_shares;
CREATE POLICY "shares_insert" ON public.iqube_shares FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "shares_update" ON public.iqube_shares;
CREATE POLICY "shares_update" ON public.iqube_shares FOR UPDATE USING (true);

-- ============================================================================
-- 13. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_persona_franchise ON public.persona(franchise_id);
CREATE INDEX IF NOT EXISTS idx_persona_tenant ON public.persona(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_franchise ON public.tenants(franchise_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_tenant ON public.event_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON public.event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_kb_franchise ON public.knowledge_base(franchise_id);
CREATE INDEX IF NOT EXISTS idx_kb_doc_type ON public.knowledge_base(doc_type);
CREATE INDEX IF NOT EXISTS idx_chat_franchise ON public.chat_history(franchise_id);
CREATE INDEX IF NOT EXISTS idx_chat_persona ON public.chat_history(persona_id);
CREATE INDEX IF NOT EXISTS idx_chat_session ON public.chat_history(session_id);

-- ============================================================================
-- 14. SEED FRANCHISES
-- ============================================================================

INSERT INTO public.franchises (name, slug, description, chains, active) VALUES
  ('Kn0w1', 'kn0w1', 'Knowledge and AI orchestration franchise', ARRAY['bitcoin', 'polygon', 'base'], true),
  ('Nakamoto', 'nakamoto', 'Bitcoin-native AI agents and services', ARRAY['bitcoin', 'polygon'], true),
  ('Qriptopian', 'qriptopian', 'Crypto education and community platform', ARRAY['polygon', 'base'], true),
  ('Aigent Moneypenny', 'moneypenny', 'Financial AI assistant franchise', ARRAY['polygon'], false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these to verify:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT * FROM public.franchises;
-- SELECT * FROM public.persona LIMIT 5;
