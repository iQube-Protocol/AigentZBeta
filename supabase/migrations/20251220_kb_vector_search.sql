-- ============================================================================
-- Knowledge Base Vector Search Function
-- ============================================================================
-- Requires pgvector extension to be enabled
-- Run: CREATE EXTENSION IF NOT EXISTS vector;
-- ============================================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for vector similarity search (if not exists)
-- Using ivfflat for faster approximate nearest neighbor search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kb_chunks_embedding'
  ) THEN
    CREATE INDEX idx_kb_chunks_embedding ON codex_kb_chunks 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Vector type not available, skip index creation
    RAISE NOTICE 'Vector extension not available, skipping embedding index';
END $$;

-- ============================================================================
-- Semantic Search Function
-- ============================================================================
-- Searches for similar chunks using cosine similarity

CREATE OR REPLACE FUNCTION search_kb_chunks(
  query_embedding vector(1536),
  match_domain text DEFAULT 'metaKnyts',
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  title text,
  domain text,
  content_category text,
  chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as chunk_id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title,
    d.domain,
    d.content_category,
    c.chunk_index
  FROM codex_kb_chunks c
  JOIN codex_kb_documents d ON c.document_id = d.id
  WHERE 
    c.embedding IS NOT NULL
    AND d.domain = match_domain
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Hybrid Search Function (Semantic + Keyword)
-- ============================================================================

CREATE OR REPLACE FUNCTION hybrid_search_kb_chunks(
  query_text text,
  query_embedding vector(1536) DEFAULT NULL,
  match_domain text DEFAULT 'metaKnyts',
  match_count int DEFAULT 10
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  title text,
  domain text,
  content_category text,
  chunk_index int,
  search_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- If embedding provided, do hybrid search
  IF query_embedding IS NOT NULL THEN
    RETURN QUERY
    WITH semantic_results AS (
      SELECT
        c.id as chunk_id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) as similarity,
        d.title,
        d.domain,
        d.content_category,
        c.chunk_index,
        'semantic'::text as search_type
      FROM codex_kb_chunks c
      JOIN codex_kb_documents d ON c.document_id = d.id
      WHERE 
        c.embedding IS NOT NULL
        AND d.domain = match_domain
      ORDER BY c.embedding <=> query_embedding
      LIMIT match_count
    ),
    keyword_results AS (
      SELECT
        c.id as chunk_id,
        c.document_id,
        c.content,
        0.5::float as similarity,
        d.title,
        d.domain,
        d.content_category,
        c.chunk_index,
        'keyword'::text as search_type
      FROM codex_kb_chunks c
      JOIN codex_kb_documents d ON c.document_id = d.id
      WHERE 
        d.domain = match_domain
        AND c.content ILIKE '%' || query_text || '%'
      LIMIT match_count
    )
    SELECT DISTINCT ON (combined.chunk_id) *
    FROM (
      SELECT * FROM semantic_results
      UNION ALL
      SELECT * FROM keyword_results
    ) combined
    ORDER BY combined.chunk_id, combined.similarity DESC
    LIMIT match_count;
  ELSE
    -- Keyword only search
    RETURN QUERY
    SELECT
      c.id as chunk_id,
      c.document_id,
      c.content,
      0.5::float as similarity,
      d.title,
      d.domain,
      d.content_category,
      c.chunk_index,
      'keyword'::text as search_type
    FROM codex_kb_chunks c
    JOIN codex_kb_documents d ON c.document_id = d.id
    WHERE 
      d.domain = match_domain
      AND c.content ILIKE '%' || query_text || '%'
    LIMIT match_count;
  END IF;
END;
$$;

-- ============================================================================
-- Get Related Chunks Function
-- ============================================================================
-- Find chunks similar to a given chunk (for "related content" features)

CREATE OR REPLACE FUNCTION get_related_chunks(
  source_chunk_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  title text
)
LANGUAGE plpgsql
AS $$
DECLARE
  source_embedding vector(1536);
  source_domain text;
BEGIN
  -- Get the source chunk's embedding and domain
  SELECT c.embedding, d.domain 
  INTO source_embedding, source_domain
  FROM codex_kb_chunks c
  JOIN codex_kb_documents d ON c.document_id = d.id
  WHERE c.id = source_chunk_id;

  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id as chunk_id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> source_embedding) as similarity,
    d.title
  FROM codex_kb_chunks c
  JOIN codex_kb_documents d ON c.document_id = d.id
  WHERE 
    c.id != source_chunk_id
    AND c.embedding IS NOT NULL
    AND d.domain = source_domain
  ORDER BY c.embedding <=> source_embedding
  LIMIT match_count;
END;
$$;
