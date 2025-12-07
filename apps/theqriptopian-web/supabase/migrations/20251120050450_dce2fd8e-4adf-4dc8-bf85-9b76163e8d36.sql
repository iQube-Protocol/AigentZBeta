-- Unified content table for domain-based content organization
CREATE TABLE IF NOT EXISTS public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Domain & Type
  domain TEXT NOT NULL CHECK (domain IN ('signals', 'mythos', 'logos', 'markets', 'builders', 'city', 'dispatches')),
  type TEXT NOT NULL, -- domain-specific type (e.g., 'chronicle', 'explainer', 'briefing')
  
  -- Format (how it's presented)
  format TEXT NOT NULL CHECK (format IN ('article', 'comic', 'video', 'audio', 'interactive', 'mixed')),
  
  -- Core Metadata
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  thumbnail TEXT,
  
  -- Flexible content storage
  content JSONB NOT NULL DEFAULT '{}',
  
  -- Author (human or agent)
  author_type TEXT CHECK (author_type IN ('human', 'agent')),
  author_id UUID,
  
  -- Domain-specific content
  logos_sidebar JSONB, -- only for mythos content: { title, protocol, explainer }
  market_data JSONB, -- only for markets content: { volume, spreads, liquidity, etc. }
  event_data JSONB, -- only for city content: { date, location, type, etc. }
  
  -- Tags & Relations
  tags TEXT[] DEFAULT '{}',
  related_content UUID[],
  
  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- Verification (DIDQube)
  verification_did TEXT,
  verification_proof JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_domain ON public.content(domain);
CREATE INDEX IF NOT EXISTS idx_content_type ON public.content(type);
CREATE INDEX IF NOT EXISTS idx_content_format ON public.content(format);
CREATE INDEX IF NOT EXISTS idx_content_status ON public.content(status);
CREATE INDEX IF NOT EXISTS idx_content_published ON public.content(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_content_tags ON public.content USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_content_author ON public.content(author_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_content_updated_at();

-- Enable RLS
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read published content
CREATE POLICY "Published content is viewable by everyone"
  ON public.content
  FOR SELECT
  USING (status = 'published');

-- Authenticated users can create drafts
CREATE POLICY "Authenticated users can create content"
  ON public.content
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id OR author_type = 'agent');

-- Users can update their own content
CREATE POLICY "Users can update their own content"
  ON public.content
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

-- Users can delete their own content
CREATE POLICY "Users can delete their own content"
  ON public.content
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Service role can manage all content
CREATE POLICY "Service role can manage all content"
  ON public.content
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);