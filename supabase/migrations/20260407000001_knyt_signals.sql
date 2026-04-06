-- ============================================================================
-- Phase D — KNYT Signals Table
-- WS6 / Gate 6
--
-- Lightweight signal table for like, spark, and curate interactions on
-- KNYT Living Canon publications. One row per (persona, content, signal_type)
-- — unique constraint prevents double-liking.
--
-- like   — positive engagement signal; small micro-reward
-- spark  — stronger endorsement / highlight; larger micro-reward
-- curate — editorial selection; no direct reward (different loop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.knyt_signals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id      text NOT NULL,
  content_id      text NOT NULL,
  signal_type     text NOT NULL CHECK (signal_type IN ('like', 'spark', 'curate')),
  note            text,                        -- optional curation note
  wallet_task_id  text,                        -- optional — SmartWallet task reference
  created_at      timestamptz DEFAULT now(),

  UNIQUE (persona_id, content_id, signal_type) -- one signal per persona per content per type
);

CREATE INDEX IF NOT EXISTS idx_knyt_signals_persona     ON public.knyt_signals(persona_id);
CREATE INDEX IF NOT EXISTS idx_knyt_signals_content     ON public.knyt_signals(content_id);
CREATE INDEX IF NOT EXISTS idx_knyt_signals_type        ON public.knyt_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_knyt_signals_created     ON public.knyt_signals(created_at DESC);

ALTER TABLE public.knyt_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyt_signals_read_all"
  ON public.knyt_signals FOR SELECT USING (true);

CREATE POLICY "knyt_signals_write_service"
  ON public.knyt_signals FOR ALL USING (auth.role() = 'service_role');
