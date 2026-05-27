-- ============================================================================
-- persona_uploads — per-persona document / multi-modal uploads consumed by
-- aigentMe + Studio skills as context / tool input.
--
-- Phase: 2026-05-27 — Upload-as-tool-input service.
--
-- Two-table layout:
--   persona_uploads        : metadata + storage pointer + lifecycle state
--   persona_upload_index   : parsed / indexed content (text, schema, summary)
--
-- The split lets metadata lookups stay cheap (list, attach-picker) while
-- the heavier parsed content lives in a separate table indexed by
-- upload_id. Both rows live as long as the upload is not archived.
--
-- Persona scoping: persona_id is T0 (server-internal). Storage path
-- includes the persona id so a misconfigured RLS still can't leak across
-- personas if the service-role key is held to the rules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      text NOT NULL,
  auth_profile_id uuid,
  -- Bucket-relative storage path. Service uses Supabase Storage bucket
  -- `persona-uploads`; path format `<persona_id>/<yyyy-mm>/<uuid>.<ext>`.
  storage_path    text NOT NULL,
  -- Original filename + mime type as uploaded.
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,
  -- Intent — how the operator plans to use this upload. Drives the
  -- parsing pass + which surfaces can reach the upload.
  --   'context'  — include in the next aigentMe prompt (text/markdown extract)
  --   'tool'     — schema-detected (JSON/CSV) — exposed to tools
  --   'workbench'— saved as a private draft in myWorkbench
  --   'general'  — no commitment yet; operator can re-route later
  use_kind        text NOT NULL DEFAULT 'general'
    CHECK (use_kind IN ('context','tool','workbench','general')),
  -- Lifecycle:
  --   parsing  — indexer running
  --   ready    — indexed and attachable
  --   archived — soft-deleted (Storage row still exists; visibility off)
  --   failed   — indexer threw (see persona_upload_index.error)
  status          text NOT NULL DEFAULT 'parsing'
    CHECK (status IN ('parsing','ready','archived','failed')),
  -- Operator-supplied label (defaults to filename minus ext).
  label           text,
  -- Free-form tags for filter / search.
  tags            text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_persona_uploads_persona
  ON public.persona_uploads(persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_persona_uploads_status
  ON public.persona_uploads(persona_id, status);
CREATE INDEX IF NOT EXISTS idx_persona_uploads_use_kind
  ON public.persona_uploads(persona_id, use_kind);

-- Parsed content lives in a sibling table to keep the metadata row light.
CREATE TABLE IF NOT EXISTS public.persona_upload_index (
  upload_id        uuid PRIMARY KEY REFERENCES public.persona_uploads(id) ON DELETE CASCADE,
  -- Extracted text/markdown for context use. Truncated at 256k chars
  -- (the service is responsible for chunking on inject).
  content_md       text,
  -- Detected JSON schema (object or null) — for `use_kind='tool'`.
  content_json     jsonb,
  -- Short LLM-generated summary the operator can preview before attach.
  summary          text,
  -- Rough token estimate so injection knows the budget.
  tokens_estimate  integer NOT NULL DEFAULT 0,
  -- Detected schema metadata for tool exposure (column names + types,
  -- row count, etc.). NULL when not a structured file.
  schema_meta      jsonb,
  -- Indexer error trace if status='failed'.
  error            text,
  indexed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_upload_index_tokens
  ON public.persona_upload_index(tokens_estimate);

-- RLS — service-role write only. All access goes through /api/uploads/*.
ALTER TABLE public.persona_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "persona_uploads_read_service"  ON public.persona_uploads;
DROP POLICY IF EXISTS "persona_uploads_write_service" ON public.persona_uploads;
CREATE POLICY "persona_uploads_read_service"  ON public.persona_uploads
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "persona_uploads_write_service" ON public.persona_uploads
  FOR ALL    USING (auth.role() = 'service_role');

ALTER TABLE public.persona_upload_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "persona_upload_index_read_service"  ON public.persona_upload_index;
DROP POLICY IF EXISTS "persona_upload_index_write_service" ON public.persona_upload_index;
CREATE POLICY "persona_upload_index_read_service"  ON public.persona_upload_index
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "persona_upload_index_write_service" ON public.persona_upload_index
  FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.persona_uploads IS
  'Per-persona document / multi-modal uploads for use by aigentMe + Studio skills. Service-role write only.';
COMMENT ON COLUMN public.persona_uploads.persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.persona_uploads.storage_path IS
  'Path inside Supabase Storage bucket `persona-uploads`. Format: <persona_id>/<yyyy-mm>/<uuid>.<ext>';
