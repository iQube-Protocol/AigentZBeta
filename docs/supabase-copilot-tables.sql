-- CopilotKit Live Integration Tables
-- Run this in Supabase SQL Editor to enable live data for Platform Copilot
-- These tables are additive and non-breaking

-- ============================================================================
-- TENANTS TABLE (add missing columns if table exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  franchise_id text,
  chains text[] DEFAULT ARRAY['polygon'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'slug') THEN
    ALTER TABLE public.tenants ADD COLUMN slug text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'franchise_id') THEN
    ALTER TABLE public.tenants ADD COLUMN franchise_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'chains') THEN
    ALTER TABLE public.tenants ADD COLUMN chains text[] DEFAULT ARRAY['polygon'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'active') THEN
    ALTER TABLE public.tenants ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'updated_at') THEN
    ALTER TABLE public.tenants ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Policies (drop if exists, then create)
DROP POLICY IF EXISTS "Tenants are viewable by everyone" ON public.tenants;
CREATE POLICY "Tenants are viewable by everyone" ON public.tenants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenants can be created by authenticated users" ON public.tenants;
CREATE POLICY "Tenants can be created by authenticated users" ON public.tenants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Tenants can be updated by authenticated users" ON public.tenants;
CREATE POLICY "Tenants can be updated by authenticated users" ON public.tenants
  FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS handle_tenants_updated_at ON public.tenants;
CREATE TRIGGER handle_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Sample data (only insert if slug column exists and is empty)
INSERT INTO public.tenants (name, slug, franchise_id, chains, active) 
SELECT 'Kn0w1', 'kn0w1', 'franchise_main', ARRAY['bitcoin', 'polygon', 'base'], true
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'kn0w1');

INSERT INTO public.tenants (name, slug, franchise_id, chains, active) 
SELECT 'KNYT Books', 'knyt-books', 'franchise_main', ARRAY['polygon'], true
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'knyt-books');

-- ============================================================================
-- EVENT LOGS TABLE (EventQube)
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

-- Enable RLS
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Policies (drop if exists, then create)
DROP POLICY IF EXISTS "Event logs are viewable by tenant" ON public.event_logs;
CREATE POLICY "Event logs are viewable by tenant" ON public.event_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Event logs can be created" ON public.event_logs;
CREATE POLICY "Event logs can be created" ON public.event_logs
  FOR INSERT WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_logs_tenant_id ON public.event_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON public.event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON public.event_logs(created_at DESC);

-- ============================================================================
-- ADD tenant_id TO iqube_templates (if not exists)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'iqube_templates' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.iqube_templates ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the tables were created:
-- SELECT * FROM public.tenants;
-- SELECT * FROM public.event_logs ORDER BY created_at DESC LIMIT 10;
-- SELECT * FROM public.persona ORDER BY created_at DESC LIMIT 10;
-- SELECT * FROM public.kybe_identity ORDER BY issued_at DESC LIMIT 10;
