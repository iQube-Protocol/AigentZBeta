-- ============================================================================
-- Codex Knowledge Base Tables
-- ============================================================================
-- This migration creates tables for storing extracted content from PDFs and
-- other documents to power the Codex Copilot's knowledge base.
--
-- Supports both metaKnyts (KNYT Codex) and Qriptopian domains.
-- ============================================================================

-- ============================================================================
-- 1. Knowledge Base Documents
-- ============================================================================
-- Tracks source documents that have been processed for the knowledge base

CREATE TABLE IF NOT EXISTS codex_kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_type VARCHAR(50) NOT NULL, -- 'pdf', 'episode', 'character', 'lore', 'article'
  source_id TEXT, -- Reference to source (e.g., master_content_qubes.id, codex_media_assets.id)
  source_cid TEXT, -- Autonomys/IPFS CID if applicable
  
  -- Document metadata
  title VARCHAR(500) NOT NULL,
  domain VARCHAR(50) NOT NULL DEFAULT 'metaKnyts', -- 'metaKnyts', 'qriptopian'
  series VARCHAR(100), -- e.g., 'metaKnyts', '21Sats'
  episode_number INTEGER, -- If tied to specific episode
  
  -- Content categorization
  content_category VARCHAR(100), -- 'episode_content', 'character_lore', 'world_building', 'technical', 'news'
  tags TEXT[] DEFAULT '{}',
  
  -- Processing status
  extraction_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  
  -- Statistics
  page_count INTEGER,
  word_count INTEGER,
  chunk_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_kb_documents_domain ON codex_kb_documents(domain);
CREATE INDEX IF NOT EXISTS idx_kb_documents_source ON codex_kb_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON codex_kb_documents(extraction_status);
CREATE INDEX IF NOT EXISTS idx_kb_documents_series ON codex_kb_documents(series);

-- ============================================================================
-- 2. Knowledge Base Chunks
-- ============================================================================
-- Stores extracted text chunks for semantic search and RAG

CREATE TABLE IF NOT EXISTS codex_kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES codex_kb_documents(id) ON DELETE CASCADE,
  
  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order within document
  
  -- Source location
  page_number INTEGER, -- For PDFs
  section_title VARCHAR(500), -- If extractable
  
  -- Chunk metadata
  chunk_type VARCHAR(50) DEFAULT 'text', -- 'text', 'heading', 'quote', 'dialogue', 'caption'
  character_refs TEXT[] DEFAULT '{}', -- Character names mentioned
  location_refs TEXT[] DEFAULT '{}', -- Locations mentioned
  
  -- Vector embedding (for semantic search)
  embedding vector(1536), -- OpenAI ada-002 dimension
  
  -- Statistics
  word_count INTEGER,
  token_count INTEGER, -- For LLM context management
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document ON codex_kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_order ON codex_kb_chunks(document_id, chunk_index);

-- Vector similarity search index (requires pgvector extension)
-- CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON codex_kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 3. Knowledge Base Entities
-- ============================================================================
-- Extracted named entities (characters, locations, concepts) for cross-referencing

CREATE TABLE IF NOT EXISTS codex_kb_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity identification
  name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'character', 'location', 'organization', 'concept', 'item'
  domain VARCHAR(50) NOT NULL DEFAULT 'metaKnyts',
  
  -- Canonical reference
  canonical_id TEXT, -- Reference to codex_characters.id or similar
  aliases TEXT[] DEFAULT '{}', -- Alternative names/spellings
  
  -- Entity description (aggregated from chunks)
  description TEXT,
  
  -- Statistics
  mention_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(name, entity_type, domain)
);

CREATE INDEX IF NOT EXISTS idx_kb_entities_domain ON codex_kb_entities(domain);
CREATE INDEX IF NOT EXISTS idx_kb_entities_type ON codex_kb_entities(entity_type);

-- ============================================================================
-- 4. Entity Mentions (Links chunks to entities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS codex_kb_entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES codex_kb_chunks(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES codex_kb_entities(id) ON DELETE CASCADE,
  
  -- Mention context
  mention_text VARCHAR(500), -- The actual text that matched
  context_snippet TEXT, -- Surrounding text for context
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(chunk_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_mentions_chunk ON codex_kb_entity_mentions(chunk_id);
CREATE INDEX IF NOT EXISTS idx_kb_mentions_entity ON codex_kb_entity_mentions(entity_id);

-- ============================================================================
-- 5. Knowledge Base Queries (For analytics and caching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS codex_kb_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Query details
  query_text TEXT NOT NULL,
  domain VARCHAR(50) NOT NULL DEFAULT 'metaKnyts',
  user_role VARCHAR(50), -- 'investor', 'creative', 'developer', 'entrepreneur', 'fan'
  
  -- Results
  result_chunk_ids UUID[] DEFAULT '{}',
  result_count INTEGER DEFAULT 0,
  
  -- Performance
  search_duration_ms INTEGER,
  
  -- Session context
  session_id VARCHAR(100),
  persona_id VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_queries_domain ON codex_kb_queries(domain);
CREATE INDEX IF NOT EXISTS idx_kb_queries_created ON codex_kb_queries(created_at);

-- ============================================================================
-- 6. Update Triggers
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_kb_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to documents table
DROP TRIGGER IF EXISTS trigger_kb_documents_updated ON codex_kb_documents;
CREATE TRIGGER trigger_kb_documents_updated
  BEFORE UPDATE ON codex_kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_updated_at();

-- Apply to entities table
DROP TRIGGER IF EXISTS trigger_kb_entities_updated ON codex_kb_entities;
CREATE TRIGGER trigger_kb_entities_updated
  BEFORE UPDATE ON codex_kb_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_updated_at();

-- ============================================================================
-- 7. Helper Views
-- ============================================================================

-- View for document statistics
CREATE OR REPLACE VIEW codex_kb_document_stats AS
SELECT 
  domain,
  series,
  content_category,
  extraction_status,
  COUNT(*) as document_count,
  SUM(page_count) as total_pages,
  SUM(word_count) as total_words,
  SUM(chunk_count) as total_chunks
FROM codex_kb_documents
GROUP BY domain, series, content_category, extraction_status;

-- View for entity statistics
CREATE OR REPLACE VIEW codex_kb_entity_stats AS
SELECT 
  domain,
  entity_type,
  COUNT(*) as entity_count,
  SUM(mention_count) as total_mentions,
  SUM(document_count) as total_documents
FROM codex_kb_entities
GROUP BY domain, entity_type;
