-- Franchise and Multi-Tenant Architecture Schema
-- Run this in Supabase SQL Editor
-- Supports: L0 Platform -> L1 Franchise -> L2 Tenant hierarchy

-- ============================================================================
-- FRANCHISES TABLE (L1 - First-Class Tenants)
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

ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Franchises viewable by all" ON public.franchises;
CREATE POLICY "Franchises viewable by all" ON public.franchises FOR SELECT USING (true);

DROP POLICY IF EXISTS "Franchises managed by service" ON public.franchises;
CREATE POLICY "Franchises managed by service" ON public.franchises FOR ALL USING (auth.role() = 'service_role');

-- Trigger
DROP TRIGGER IF EXISTS handle_franchises_updated_at ON public.franchises;
CREATE TRIGGER handle_franchises_updated_at
  BEFORE UPDATE ON public.franchises
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ADD franchise_id TO TENANTS (L2 belongs to L1)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'franchise_id') THEN
    ALTER TABLE public.tenants ADD COLUMN franchise_id uuid REFERENCES public.franchises(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'kb_endpoint') THEN
    ALTER TABLE public.tenants ADD COLUMN kb_endpoint text;
  END IF;
END $$;

-- ============================================================================
-- ADD franchise_id and tenant_id TO PERSONA
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
-- IQUBE SHARES TABLE (Cross-tenant data sharing with consent)
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

ALTER TABLE public.iqube_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shares viewable by owner" ON public.iqube_shares;
CREATE POLICY "Shares viewable by owner" ON public.iqube_shares FOR SELECT USING (true);

DROP POLICY IF EXISTS "Shares created by authenticated" ON public.iqube_shares;
CREATE POLICY "Shares created by authenticated" ON public.iqube_shares FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Shares revocable by owner" ON public.iqube_shares;
CREATE POLICY "Shares revocable by owner" ON public.iqube_shares FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_iqube_shares_owner ON public.iqube_shares(owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_iqube_shares_tenant ON public.iqube_shares(shared_with_tenant_id);

-- ============================================================================
-- FRANCHISE ADMINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.franchise_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id),
  persona_id uuid NOT NULL REFERENCES public.persona(id),
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.franchise_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Franchise admins viewable" ON public.franchise_admins;
CREATE POLICY "Franchise admins viewable" ON public.franchise_admins FOR SELECT USING (true);

-- ============================================================================
-- TENANT ADMINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  persona_id uuid NOT NULL REFERENCES public.persona(id),
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'member')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins viewable" ON public.tenant_admins;
CREATE POLICY "Tenant admins viewable" ON public.tenant_admins FOR SELECT USING (true);

-- ============================================================================
-- SEED FRANCHISES
-- ============================================================================
INSERT INTO public.franchises (name, slug, description, ui_url, chains, active) VALUES
  ('Kn0w1', 'kn0w1', 'Knowledge and AI orchestration franchise', 'https://kn0w1.com', ARRAY['bitcoin', 'polygon', 'base'], true),
  ('Nakamoto', 'nakamoto', 'Bitcoin-native AI agents and services', 'https://nakamoto.aigent.me', ARRAY['bitcoin', 'polygon'], true),
  ('Qriptopian', 'qriptopian', 'Crypto education and community platform', 'https://qriptopian.com', ARRAY['polygon', 'base'], true),
  ('Aigent Moneypenny', 'moneypenny', 'Financial AI assistant franchise', NULL, ARRAY['polygon'], false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  ui_url = EXCLUDED.ui_url;

-- ============================================================================
-- LINK EXISTING TENANTS TO FRANCHISES
-- ============================================================================
UPDATE public.tenants 
SET franchise_id = (SELECT id FROM public.franchises WHERE slug = 'kn0w1')
WHERE slug = 'kn0w1' AND franchise_id IS NULL;

UPDATE public.tenants 
SET franchise_id = (SELECT id FROM public.franchises WHERE slug = 'nakamoto')
WHERE slug IN ('nakamoto', 'nakamoto2') AND franchise_id IS NULL;

-- Create Aigent JMO as tenant under Nakamoto
INSERT INTO public.tenants (name, slug, franchise_id, kb_endpoint, chains, active)
SELECT 
  'Aigent JMO', 
  'aigent-jmo', 
  (SELECT id FROM public.franchises WHERE slug = 'nakamoto'),
  NULL,
  ARRAY['polygon'],
  true
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'aigent-jmo');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT f.name as franchise, t.name as tenant, t.slug 
-- FROM public.franchises f 
-- LEFT JOIN public.tenants t ON t.franchise_id = f.id
-- ORDER BY f.name, t.name;
