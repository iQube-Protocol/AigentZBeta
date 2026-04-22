-- Memory iQube — chat history + conversation summaries
-- Spec: aigent-nakamoto chat history & persona-scoped memory specification v1.0.0
-- Tables use canonical naming (no nakamoto_ prefix) — platform-owned tables.

-- ─── user_interactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_interactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  query            text NOT NULL,
  response         text NOT NULL,
  interaction_type text NOT NULL,   -- 'aigent' | 'earn' | 'learn' | 'connect'
  metadata         jsonb,           -- see metadata_envelope spec
  summarized       boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_interactions_select" ON public.user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_interactions_insert" ON public.user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_interactions_update" ON public.user_interactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_interactions_delete" ON public.user_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Composite index for paginated history queries
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_type_created
  ON public.user_interactions (user_id, interaction_type, created_at DESC);

-- Partial index for summarization worker (counts unsummarized rows)
CREATE INDEX IF NOT EXISTS idx_user_interactions_unsummarized
  ON public.user_interactions (user_id, interaction_type)
  WHERE summarized = false;

-- GIN index for JSONB metadata containment queries (persona, conversationId)
CREATE INDEX IF NOT EXISTS idx_user_interactions_metadata_gin
  ON public.user_interactions USING GIN (metadata);

-- ─── conversation_summaries ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  conversation_type        text NOT NULL,   -- mirrors interaction_type
  summary_text             text NOT NULL,   -- ≤250-word LLM rollup
  included_interaction_ids text[] NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_summaries_select" ON public.conversation_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "conversation_summaries_insert" ON public.conversation_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversation_summaries_update" ON public.conversation_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "conversation_summaries_delete" ON public.conversation_summaries
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_type
  ON public.conversation_summaries (user_id, conversation_type, created_at DESC);
