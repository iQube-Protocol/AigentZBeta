-- ============================================================================
-- Experience Model + Journey State Tables
-- Epic 2 (EXP-201) + Epic 1 (AGT-103/106)
-- Canonical schema: docs/agent-harness/journey-state-schema.md
-- ============================================================================

-- experience_strategies
CREATE TABLE IF NOT EXISTS public.experience_strategies (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text NOT NULL,
  objective     text,
  target_personas  text[] DEFAULT '{}',
  target_cohorts   text[] DEFAULT '{}',
  desired_outcomes text[] DEFAULT '{}',
  kpis          text[] DEFAULT '{}',
  constraints   text[] DEFAULT '{}',
  owning_franchise text,
  owning_cartridge text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.experience_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_strategies_read_all" ON public.experience_strategies
  FOR SELECT USING (true);
CREATE POLICY "experience_strategies_write_service" ON public.experience_strategies
  FOR ALL USING (auth.role() = 'service_role');

-- experience_models
CREATE TABLE IF NOT EXISTS public.experience_models (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_id  uuid REFERENCES public.experience_strategies(id) ON DELETE SET NULL,
  stages       jsonb NOT NULL DEFAULT '[]',
  transitions  jsonb NOT NULL DEFAULT '[]',
  triggers     jsonb NOT NULL DEFAULT '[]',
  blockers     jsonb NOT NULL DEFAULT '[]',
  handoffs     jsonb NOT NULL DEFAULT '[]',
  roles        jsonb NOT NULL DEFAULT '[]',
  surface_mappings jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.experience_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_models_read_all" ON public.experience_models
  FOR SELECT USING (true);
CREATE POLICY "experience_models_write_service" ON public.experience_models
  FOR ALL USING (auth.role() = 'service_role');

-- experience_matrices
CREATE TABLE IF NOT EXISTS public.experience_matrices (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id    uuid REFERENCES public.experience_models(id) ON DELETE CASCADE,
  cells       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.experience_matrices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_matrices_read_all" ON public.experience_matrices
  FOR SELECT USING (true);
CREATE POLICY "experience_matrices_write_service" ON public.experience_matrices
  FOR ALL USING (auth.role() = 'service_role');

-- experience_goals
CREATE TABLE IF NOT EXISTS public.experience_goals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id      uuid,
  cohort_id       text,
  franchise_id    text,
  goal_type       text NOT NULL DEFAULT 'engage'
    CHECK (goal_type IN ('invest','collect','create','contribute','engage','custom')),
  priority        text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low')),
  title           text NOT NULL,
  success_criteria text,
  success_status  text NOT NULL DEFAULT 'not_started'
    CHECK (success_status IN ('not_started','in_progress','achieved','abandoned')),
  linked_stages   text[] DEFAULT '{}',
  linked_matrix_cells text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_experience_goals_persona ON public.experience_goals(persona_id);
CREATE INDEX idx_experience_goals_cohort  ON public.experience_goals(cohort_id);

ALTER TABLE public.experience_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_goals_read_service" ON public.experience_goals
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "experience_goals_write_service" ON public.experience_goals
  FOR ALL USING (auth.role() = 'service_role');

-- journey_states
CREATE TABLE IF NOT EXISTS public.journey_states (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id       uuid NOT NULL,
  tenant_id        text NOT NULL,
  journey_stage    text NOT NULL DEFAULT 'prospect',
  persona_state    jsonb DEFAULT '{}',
  trust_posture    jsonb DEFAULT '{}',
  cartridge_context jsonb,
  codex_context    jsonb,
  investor_status  jsonb DEFAULT '{}',
  collector_status jsonb DEFAULT '{}',
  creator_status   jsonb DEFAULT '{}',
  next_likely_step text,
  blocked_reasons  text[] DEFAULT '{}',
  session_id       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (persona_id, tenant_id)
);

CREATE INDEX idx_journey_states_persona ON public.journey_states(persona_id);
CREATE INDEX idx_journey_states_stage   ON public.journey_states(journey_stage);

ALTER TABLE public.journey_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey_states_read_service" ON public.journey_states
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "journey_states_write_service" ON public.journey_states
  FOR ALL USING (auth.role() = 'service_role');

-- nbe_plans
CREATE TABLE IF NOT EXISTS public.nbe_plans (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope                text NOT NULL CHECK (scope IN ('individual','cohort','franchise')),
  scope_id             text NOT NULL,
  trigger_type         text NOT NULL,
  trigger_data         jsonb DEFAULT '{}',
  recommended_action   text NOT NULL,
  recommended_agent    text NOT NULL,
  recommended_surface  text NOT NULL,
  rationale            text,
  disposition          text NOT NULL DEFAULT 'ask'
    CHECK (disposition IN ('ask','act','wait','escalate','deny')),
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','presented','accepted','declined','expired')),
  created_at           timestamptz DEFAULT now(),
  expires_at           timestamptz
);

CREATE INDEX idx_nbe_plans_scope ON public.nbe_plans(scope, scope_id);
CREATE INDEX idx_nbe_plans_status ON public.nbe_plans(status);

ALTER TABLE public.nbe_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nbe_plans_read_service" ON public.nbe_plans
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "nbe_plans_write_service" ON public.nbe_plans
  FOR ALL USING (auth.role() = 'service_role');

-- analysis_cards
CREATE TABLE IF NOT EXISTS public.analysis_cards (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope                 text NOT NULL CHECK (scope IN ('individual','cohort','franchise')),
  scope_id              text NOT NULL,
  linked_goals          text[] DEFAULT '{}',
  linked_matrix_status  text,
  linked_nbe_id         uuid REFERENCES public.nbe_plans(id) ON DELETE SET NULL,
  blockers              text[] DEFAULT '{}',
  recommendations       text[] DEFAULT '{}',
  health_state          text NOT NULL DEFAULT 'healthy'
    CHECK (health_state IN ('healthy','at_risk','stalled','critical')),
  operator_action       text,
  generated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_analysis_cards_scope ON public.analysis_cards(scope, scope_id);

ALTER TABLE public.analysis_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysis_cards_read_service" ON public.analysis_cards
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "analysis_cards_write_service" ON public.analysis_cards
  FOR ALL USING (auth.role() = 'service_role');

-- orchestration_events (AGT-103/106)
CREATE TABLE IF NOT EXISTS public.orchestration_events (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         text UNIQUE NOT NULL,
  event_type       text NOT NULL,
  from_role        text NOT NULL,
  to_role          text NOT NULL,
  reason           text,
  journey_stage    text,
  active_cartridge text,
  active_codex     text,
  receipt_eligible boolean DEFAULT false,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_orchestration_events_type    ON public.orchestration_events(event_type);
CREATE INDEX idx_orchestration_events_stage   ON public.orchestration_events(journey_stage);
CREATE INDEX idx_orchestration_events_created ON public.orchestration_events(created_at DESC);

ALTER TABLE public.orchestration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orchestration_events_read_service" ON public.orchestration_events
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "orchestration_events_write_service" ON public.orchestration_events
  FOR ALL USING (auth.role() = 'service_role');

-- studio_artifacts (CSR-601)
CREATE TABLE IF NOT EXISTS public.studio_artifacts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                text UNIQUE NOT NULL,
  source_surface        text NOT NULL,
  created_by            text NOT NULL,
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','ingested','failed','rolled_back')),
  target_surfaces       text[] DEFAULT '{}',
  journey_segments_affected text[] DEFAULT '{}',
  ui_surfaces_affected  text[] DEFAULT '{}',
  package_dependencies  text[] DEFAULT '{}',
  state_changes         jsonb DEFAULT '[]',
  proof_requirements    text[] DEFAULT '{}',
  acceptance_checks     jsonb DEFAULT '[]',
  follow_up_tasks       jsonb DEFAULT '[]',
  validation_status     text DEFAULT 'pending'
    CHECK (validation_status IN ('pending','passed','failed','skipped')),
  validation_errors     text[] DEFAULT '{}',
  rollback_available    boolean DEFAULT false,
  rollback_artifact_id  uuid REFERENCES public.studio_artifacts(id) ON DELETE SET NULL,
  parent_artifact_id    uuid REFERENCES public.studio_artifacts(id) ON DELETE SET NULL,
  codex_entry_ids       text[] DEFAULT '{}',
  dvn_receipt_ids       text[] DEFAULT '{}',
  initializer           jsonb,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_studio_artifacts_status   ON public.studio_artifacts(status);
CREATE INDEX idx_studio_artifacts_created  ON public.studio_artifacts(created_at DESC);

ALTER TABLE public.studio_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "studio_artifacts_read_service" ON public.studio_artifacts
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "studio_artifacts_write_service" ON public.studio_artifacts
  FOR ALL USING (auth.role() = 'service_role');
