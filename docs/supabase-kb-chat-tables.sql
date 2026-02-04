-- Knowledge Base and Chat History Tables
-- Run this in Supabase SQL Editor before importing Nakamoto data

-- ============================================================================
-- ENSURE persona TABLE HAS franchise_id AND tenant_id
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
-- KNOWLEDGE BASE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid REFERENCES public.franchises(id),
  tenant_id uuid REFERENCES public.tenants(id),
  doc_type text NOT NULL CHECK (doc_type IN ('COYN', 'KNYT', 'iQube', 'general')),
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  -- embedding vector(1536),  -- Uncomment if pgvector extension is enabled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "KB viewable by franchise" ON public.knowledge_base;
CREATE POLICY "KB viewable by franchise" ON public.knowledge_base 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "KB managed by service" ON public.knowledge_base;
CREATE POLICY "KB managed by service" ON public.knowledge_base 
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_franchise ON public.knowledge_base(franchise_id);
CREATE INDEX IF NOT EXISTS idx_kb_doc_type ON public.knowledge_base(doc_type);
CREATE INDEX IF NOT EXISTS idx_kb_title ON public.knowledge_base(title);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_kb_content_fts ON public.knowledge_base 
  USING gin(to_tsvector('english', content));

-- ============================================================================
-- CHAT HISTORY TABLE
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

-- Enable RLS
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Chat viewable by owner" ON public.chat_history;
CREATE POLICY "Chat viewable by owner" ON public.chat_history 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Chat managed by service" ON public.chat_history;
CREATE POLICY "Chat managed by service" ON public.chat_history 
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_franchise ON public.chat_history(franchise_id);
CREATE INDEX IF NOT EXISTS idx_chat_persona ON public.chat_history(persona_id);
CREATE INDEX IF NOT EXISTS idx_chat_session ON public.chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_agent ON public.chat_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON public.chat_history(created_at DESC);

-- ============================================================================
-- FRANCHISE CONFIG TABLE (for system prompts, etc.)
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

-- Enable RLS
ALTER TABLE public.franchise_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Config viewable by franchise" ON public.franchise_config;
CREATE POLICY "Config viewable by franchise" ON public.franchise_config 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Config managed by service" ON public.franchise_config;
CREATE POLICY "Config managed by service" ON public.franchise_config 
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTION: Search Knowledge Base
-- Run this AFTER the tables are created successfully
-- ============================================================================
-- CREATE OR REPLACE FUNCTION search_knowledge_base(
--   search_query text,
--   franchise_filter uuid DEFAULT NULL,
--   doc_type_filter text DEFAULT NULL,
--   result_limit int DEFAULT 10
-- )
-- RETURNS TABLE (
--   id uuid,
--   franchise_id uuid,
--   doc_type text,
--   title text,
--   content text,
--   metadata jsonb,
--   rank real
-- ) AS $$
-- BEGIN
--   RETURN QUERY
--   SELECT 
--     kb.id,
--     kb.franchise_id,
--     kb.doc_type,
--     kb.title,
--     kb.content,
--     kb.metadata,
--     ts_rank(to_tsvector('english', kb.content), plainto_tsquery('english', search_query)) as rank
--   FROM public.knowledge_base kb
--   WHERE 
--     to_tsvector('english', kb.content) @@ plainto_tsquery('english', search_query)
--     AND (franchise_filter IS NULL OR kb.franchise_id = franchise_filter)
--     AND (doc_type_filter IS NULL OR kb.doc_type = doc_type_filter)
--   ORDER BY rank DESC
--   LIMIT result_limit;
-- END;
-- $$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM public.knowledge_base LIMIT 5;
-- SELECT * FROM public.chat_history LIMIT 5;
-- SELECT * FROM public.franchise_config;
-- SELECT * FROM search_knowledge_base('bitcoin', NULL, NULL, 5);
