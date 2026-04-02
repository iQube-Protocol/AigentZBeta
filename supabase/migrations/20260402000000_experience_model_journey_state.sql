-- ============================================================================
-- Experience Model + Journey State Tables
-- Epic 2 (EXP-201) + Epic 1 (AGT-103/106)
-- Canonical schema: docs/agent-harness/journey-state-schema.md
--
-- NOTE: This migration drops and recreates all tables with the correct column
-- names matching the API query layer. Run the full block in Supabase SQL Editor.
-- ============================================================================

-- Drop existing wrong-schema tables (cascade removes policies/indexes)
DROP TABLE IF EXISTS public.analysis_cards         CASCADE;
DROP TABLE IF EXISTS public.nbe_plans              CASCADE;
DROP TABLE IF EXISTS public.journey_states         CASCADE;
DROP TABLE IF EXISTS public.experience_matrices    CASCADE;
DROP TABLE IF EXISTS public.experience_models      CASCADE;
DROP TABLE IF EXISTS public.experience_strategies  CASCADE;
DROP TABLE IF EXISTS public.experience_goals       CASCADE;
DROP TABLE IF EXISTS public.orchestration_events   CASCADE;
DROP TABLE IF EXISTS public.studio_artifacts       CASCADE;

-- ============================================================================
-- experience_strategies
-- ============================================================================
CREATE TABLE public.experience_strategies (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text NOT NULL,
  description      text,
  target_segments  text[] DEFAULT '{}',
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.experience_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_strategies_read_all"      ON public.experience_strategies FOR SELECT USING (true);
CREATE POLICY "experience_strategies_write_service" ON public.experience_strategies FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- experience_models
-- ============================================================================
CREATE TABLE public.experience_models (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_id  uuid REFERENCES public.experience_strategies(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  stages       text[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.experience_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_models_read_all"      ON public.experience_models FOR SELECT USING (true);
CREATE POLICY "experience_models_write_service" ON public.experience_models FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- experience_matrices  (one row per stage; depth_ladder is ordered array)
-- ============================================================================
CREATE TABLE public.experience_matrices (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id     uuid REFERENCES public.experience_models(id) ON DELETE CASCADE,
  stage        text NOT NULL,
  depth_ladder text[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_experience_matrices_model  ON public.experience_matrices(model_id);
CREATE INDEX idx_experience_matrices_stage  ON public.experience_matrices(stage);

ALTER TABLE public.experience_matrices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_matrices_read_all"      ON public.experience_matrices FOR SELECT USING (true);
CREATE POLICY "experience_matrices_write_service" ON public.experience_matrices FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- journey_states
-- ============================================================================
CREATE TABLE public.journey_states (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id               text NOT NULL,
  stage                    text NOT NULL DEFAULT 'prospect',
  depth                    text NOT NULL DEFAULT 'pill',
  current_experience_id    text,
  completed_experience_ids text[] DEFAULT '{}',
  active_at                timestamptz DEFAULT now(),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX idx_journey_states_persona   ON public.journey_states(persona_id);
CREATE INDEX idx_journey_states_stage     ON public.journey_states(stage);
CREATE INDEX idx_journey_states_active_at ON public.journey_states(active_at DESC);

ALTER TABLE public.journey_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey_states_read_service"  ON public.journey_states FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "journey_states_write_service" ON public.journey_states FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- nbe_plans
-- ============================================================================
CREATE TABLE public.nbe_plans (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id            text NOT NULL,
  experience_id         text,
  disposition           text NOT NULL DEFAULT 'ask'
    CHECK (disposition IN ('ask','act','wait','escalate','deny')),
  next_experience_depth text,
  rationale             text,
  expires_at            timestamptz,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_nbe_plans_persona     ON public.nbe_plans(persona_id);
CREATE INDEX idx_nbe_plans_experience  ON public.nbe_plans(experience_id);
CREATE INDEX idx_nbe_plans_created     ON public.nbe_plans(created_at DESC);

ALTER TABLE public.nbe_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nbe_plans_read_service"  ON public.nbe_plans FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "nbe_plans_write_service" ON public.nbe_plans FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- analysis_cards
-- ============================================================================
CREATE TABLE public.analysis_cards (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id    text NOT NULL,
  experience_id text,
  card_type     text NOT NULL,
  content       text,
  score         integer CHECK (score >= 0 AND score <= 100),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_analysis_cards_persona     ON public.analysis_cards(persona_id);
CREATE INDEX idx_analysis_cards_experience  ON public.analysis_cards(experience_id);
CREATE INDEX idx_analysis_cards_created     ON public.analysis_cards(created_at DESC);

ALTER TABLE public.analysis_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysis_cards_read_service"  ON public.analysis_cards FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "analysis_cards_write_service" ON public.analysis_cards FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- experience_goals
-- ============================================================================
CREATE TABLE public.experience_goals (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id     text,
  strategy_id    uuid REFERENCES public.experience_strategies(id) ON DELETE SET NULL,
  goal_type      text NOT NULL DEFAULT 'engage'
    CHECK (goal_type IN ('invest','collect','create','contribute','engage','custom')),
  title          text NOT NULL,
  success_status text NOT NULL DEFAULT 'not_started'
    CHECK (success_status IN ('not_started','in_progress','achieved','abandoned')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_experience_goals_persona ON public.experience_goals(persona_id);

ALTER TABLE public.experience_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_goals_read_service"  ON public.experience_goals FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "experience_goals_write_service" ON public.experience_goals FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- orchestration_events
-- ============================================================================
CREATE TABLE public.orchestration_events (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         text UNIQUE NOT NULL,
  event_type       text NOT NULL,
  from_role        text NOT NULL,
  to_role          text NOT NULL,
  reason           text,
  journey_stage    text,
  active_cartridge text,
  receipt_eligible boolean DEFAULT false,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_orchestration_events_type    ON public.orchestration_events(event_type);
CREATE INDEX idx_orchestration_events_stage   ON public.orchestration_events(journey_stage);
CREATE INDEX idx_orchestration_events_created ON public.orchestration_events(created_at DESC);

ALTER TABLE public.orchestration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orchestration_events_read_service"  ON public.orchestration_events FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "orchestration_events_write_service" ON public.orchestration_events FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- studio_artifacts
-- ============================================================================
CREATE TABLE public.studio_artifacts (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                    text UNIQUE NOT NULL,
  source_surface            text NOT NULL,
  created_by                text NOT NULL,
  status                    text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','ingested','failed','rolled_back')),
  target_surfaces           text[] DEFAULT '{}',
  journey_segments_affected text[] DEFAULT '{}',
  ui_surfaces_affected      text[] DEFAULT '{}',
  package_dependencies      text[] DEFAULT '{}',
  validation_status         text DEFAULT 'pending'
    CHECK (validation_status IN ('pending','passed','failed','skipped')),
  validation_errors         text[] DEFAULT '{}',
  rollback_available        boolean DEFAULT false,
  rollback_artifact_id      uuid REFERENCES public.studio_artifacts(id) ON DELETE SET NULL,
  parent_artifact_id        uuid REFERENCES public.studio_artifacts(id) ON DELETE SET NULL,
  codex_entry_ids           text[] DEFAULT '{}',
  dvn_receipt_ids           text[] DEFAULT '{}',
  applied_at                timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE INDEX idx_studio_artifacts_status  ON public.studio_artifacts(status);
CREATE INDEX idx_studio_artifacts_created ON public.studio_artifacts(created_at DESC);

ALTER TABLE public.studio_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "studio_artifacts_read_service"  ON public.studio_artifacts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "studio_artifacts_write_service" ON public.studio_artifacts FOR ALL    USING (auth.role() = 'service_role');

-- ============================================================================
-- SEED: KNYT Ladder (cartridge default)
-- prospect → acolyte → keta → keji → first → zero
-- ============================================================================
DO $$
DECLARE
  v_strategy_id uuid;
  v_model_id    uuid;
BEGIN
  INSERT INTO public.experience_strategies (name, description, target_segments, active)
  VALUES (
    'KNYT Ladder Strategy',
    'Default cartridge-bound journey progression from prospect to zero stage',
    ARRAY['all'],
    true
  )
  RETURNING id INTO v_strategy_id;

  INSERT INTO public.experience_models (strategy_id, name, description, stages)
  VALUES (
    v_strategy_id,
    'KNYT Journey Model',
    'Six-stage KNYT progression model with depth ladder per stage',
    ARRAY['prospect','acolyte','keta','keji','first','zero']
  )
  RETURNING id INTO v_model_id;

  -- Matrix: each stage progressively unlocks deeper experience depths
  INSERT INTO public.experience_matrices (model_id, stage, depth_ladder) VALUES
    (v_model_id, 'prospect', ARRAY['pill']),
    (v_model_id, 'acolyte',  ARRAY['pill','capsule']),
    (v_model_id, 'keta',     ARRAY['pill','capsule','mini_runtime']),
    (v_model_id, 'keji',     ARRAY['pill','capsule','mini_runtime']),
    (v_model_id, 'first',    ARRAY['pill','capsule','mini_runtime','codex']),
    (v_model_id, 'zero',     ARRAY['pill','capsule','mini_runtime','codex']);
END;
$$;

-- ============================================================================
-- SEED: Add Experience Dashboard tab to KNYT Codex
-- Idempotent — safe to re-run. Skips insert if knyt-codex doesn't exist yet.
-- ============================================================================
INSERT INTO public.codex_tabs (id, codex_id, label, slug, enabled, "order", type, config)
SELECT
  'knyt-experience-dashboard',
  'knyt-codex',
  'Experience',
  'experience-dashboard',
  true,
  COALESCE((SELECT MAX("order") FROM public.codex_tabs WHERE codex_id = 'knyt-codex'), 0) + 10,
  'static',
  '{"component": "ExperienceDashboardTab"}'::jsonb
WHERE EXISTS (SELECT 1 FROM public.codex_configs WHERE id = 'knyt-codex')
ON CONFLICT (codex_id, slug) DO UPDATE SET
  label   = EXCLUDED.label,
  type    = EXCLUDED.type,
  config  = EXCLUDED.config,
  enabled = EXCLUDED.enabled;
