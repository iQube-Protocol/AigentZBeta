-- Task-Based Contribution Engine
-- Phase 1: Task Templates, Reputation Events, Persona Reputation Vectors
-- 
-- Architecture: Tasks → Rewards AND Reputation (tasks drive both systems)
-- Both systems can function independently, but tasks orchestrate them together.
--
-- Key Principle: Tasks are the atomic unit of contribution that emit:
--   1. Reward events (tokens: QCT, QOYN, KNYT)
--   2. Reputation events (multi-dimensional attestations)

-- ============================================================================
-- 1. TASK TEMPLATES (TaskQubes)
-- Defines what work is worth in terms of rewards and reputation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  
  -- Task identity
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Category (drives default weights)
  category TEXT NOT NULL CHECK (category IN (
    'technical', 'creative', 'entrepreneurial', 
    'data', 'iqube_design', 'community'
  )),
  
  -- Pillar flags (for analytics and routing)
  is_knowledge_pillar BOOLEAN DEFAULT TRUE,
  is_compute_pillar BOOLEAN DEFAULT FALSE,
  
  -- Difficulty and impact (1-5 scale)
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5) DEFAULT 3,
  expected_impact_level INTEGER CHECK (expected_impact_level BETWEEN 1 AND 5) DEFAULT 3,
  
  -- Verification mode
  verification_mode TEXT NOT NULL DEFAULT 'manual' CHECK (verification_mode IN (
    'auto_tests', 'code_review', 'editor_review', 
    'peer_review', 'usage_based', 'manual'
  )),
  verification_config JSONB,  -- Mode-specific config (test harness, reviewers, etc.)
  
  -- Reward configuration (base amounts for 100% score)
  reward_qct NUMERIC(36,12) DEFAULT 0,
  reward_qoyn NUMERIC(36,12) DEFAULT 0,
  reward_knyt NUMERIC(36,12) DEFAULT 0,
  
  -- Reputation weights (how much each dimension is affected)
  -- These don't need to sum to 1; they're normalized at calculation time
  rep_weight_technical NUMERIC(6,3) DEFAULT 0,
  rep_weight_creative NUMERIC(6,3) DEFAULT 0,
  rep_weight_entrepreneurial NUMERIC(6,3) DEFAULT 0,
  rep_weight_data_arch NUMERIC(6,3) DEFAULT 0,
  rep_weight_community NUMERIC(6,3) DEFAULT 0,
  
  -- Enduring utility config (for usage-based ongoing rewards)
  impact_enabled BOOLEAN DEFAULT FALSE,
  impact_multiplier_max NUMERIC(6,3) DEFAULT 3.0,
  impact_lookback_days INTEGER DEFAULT 365,
  
  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  max_claims INTEGER,  -- NULL = unlimited
  current_claims INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  
  -- Audit
  created_by_persona_id UUID REFERENCES public.crm_personas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique slug per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_templates_slug 
  ON public.crm_task_templates (tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_task_templates_tenant 
  ON public.crm_task_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_category 
  ON public.crm_task_templates (category);
CREATE INDEX IF NOT EXISTS idx_task_templates_active 
  ON public.crm_task_templates (tenant_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. EXTEND CONTRIBUTIONS WITH TASK REFERENCE
-- Links contributions to task templates and adds scoring fields
-- ============================================================================

-- Add task-related columns to existing contributions table
ALTER TABLE public.crm_contributions 
  ADD COLUMN IF NOT EXISTS task_template_id UUID REFERENCES public.crm_task_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted' CHECK (status IN (
    'claimed', 'submitted', 'under_review', 'accepted', 'rejected', 'cancelled'
  )),
  ADD COLUMN IF NOT EXISTS final_score NUMERIC(5,2),  -- 0-100 combined score
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2),  -- 0-100 quality assessment
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5,2),  -- 0-100 trust/authenticity
  ADD COLUMN IF NOT EXISTS scoring_breakdown JSONB,  -- Detailed scoring data
  ADD COLUMN IF NOT EXISTS reviewed_by_persona_id UUID REFERENCES public.crm_personas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS artifact_url TEXT,  -- Link to produced artifact
  ADD COLUMN IF NOT EXISTS artifact_metadata JSONB;  -- Artifact details

CREATE INDEX IF NOT EXISTS idx_contributions_task 
  ON public.crm_contributions (task_template_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status 
  ON public.crm_contributions (status);

-- ============================================================================
-- 3. PERSONA REPUTATION VECTOR
-- Multi-dimensional reputation per persona (syncs with RQH canister)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_persona_reputation (
  persona_id UUID PRIMARY KEY REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Multi-dimensional reputation scores
  rep_technical NUMERIC(12,4) DEFAULT 0,
  rep_creative NUMERIC(12,4) DEFAULT 0,
  rep_entrepreneurial NUMERIC(12,4) DEFAULT 0,
  rep_data_arch NUMERIC(12,4) DEFAULT 0,
  rep_community NUMERIC(12,4) DEFAULT 0,
  rep_overall NUMERIC(12,4) DEFAULT 0,
  
  -- Lifetime statistics
  lifetime_cvs NUMERIC(12,4) DEFAULT 0,  -- Cumulative Contribution Value Score
  total_tasks_completed INTEGER DEFAULT 0,
  total_tasks_claimed INTEGER DEFAULT 0,
  
  -- RQH canister sync
  rqh_bucket_id TEXT,  -- ID in RQH canister
  rqh_partition_id TEXT,  -- Partition ID for RQH lookup
  rqh_synced_at TIMESTAMPTZ,
  
  -- Rolling reputation (time-decayed, optional)
  rep_rolling_12m NUMERIC(12,4) DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. REPUTATION EVENTS
-- Audit log of all reputation changes (task-based and independent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Source of reputation change
  source_type TEXT NOT NULL CHECK (source_type IN (
    'task_completion',      -- From completing a task
    'usage_reward',         -- From asset being used
    'manual_attestation',   -- Admin/peer attestation
    'external_verification', -- KYC, credential, etc.
    'dispute_resolution',   -- Dispute outcome
    'decay',                -- Time-based decay
    'correction'            -- Manual correction
  )),
  source_id UUID,  -- Reference to contribution_id, reward_id, etc.
  
  -- Dimension deltas (can be positive or negative)
  delta_technical NUMERIC(12,4) DEFAULT 0,
  delta_creative NUMERIC(12,4) DEFAULT 0,
  delta_entrepreneurial NUMERIC(12,4) DEFAULT 0,
  delta_data_arch NUMERIC(12,4) DEFAULT 0,
  delta_community NUMERIC(12,4) DEFAULT 0,
  delta_overall NUMERIC(12,4) DEFAULT 0,
  
  -- Contribution Value Score (for task-based events)
  cvs NUMERIC(12,4),
  
  -- Task reference (if task-based)
  task_template_id UUID REFERENCES public.crm_task_templates(id) ON DELETE SET NULL,
  final_score_snapshot NUMERIC(5,2),  -- Score at time of event
  
  -- Audit
  reason TEXT,
  metadata JSONB,
  created_by_persona_id UUID REFERENCES public.crm_personas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_tenant 
  ON public.crm_reputation_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_persona 
  ON public.crm_reputation_events (persona_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_source 
  ON public.crm_reputation_events (source_type);
CREATE INDEX IF NOT EXISTS idx_reputation_events_created 
  ON public.crm_reputation_events (created_at);

-- ============================================================================
-- 5. EXTEND REWARDS WITH TASK AND REPUTATION DATA
-- Links rewards to tasks and captures reputation state at reward time
-- ============================================================================

ALTER TABLE public.crm_rewards
  ADD COLUMN IF NOT EXISTS task_template_id UUID REFERENCES public.crm_task_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contribution_id UUID REFERENCES public.crm_contributions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reputation_bucket INTEGER,  -- 0-4 bucket at time of reward
  ADD COLUMN IF NOT EXISTS reputation_multiplier NUMERIC(6,3) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS pillar TEXT DEFAULT 'knowledge' CHECK (pillar IN ('knowledge', 'compute', 'capital'));

CREATE INDEX IF NOT EXISTS idx_rewards_task 
  ON public.crm_rewards (task_template_id);
CREATE INDEX IF NOT EXISTS idx_rewards_contribution 
  ON public.crm_rewards (contribution_id);

-- ============================================================================
-- 6. DEFAULT CATEGORY WEIGHTS
-- Lookup table for default reputation weights by category
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_category_defaults (
  category TEXT PRIMARY KEY CHECK (category IN (
    'technical', 'creative', 'entrepreneurial', 
    'data', 'iqube_design', 'community'
  )),
  
  -- Default reputation weights
  default_rep_technical NUMERIC(6,3) DEFAULT 0,
  default_rep_creative NUMERIC(6,3) DEFAULT 0,
  default_rep_entrepreneurial NUMERIC(6,3) DEFAULT 0,
  default_rep_data_arch NUMERIC(6,3) DEFAULT 0,
  default_rep_community NUMERIC(6,3) DEFAULT 0,
  
  -- Default reward ratios (relative, not absolute)
  default_reward_ratio_qct NUMERIC(6,3) DEFAULT 1.0,
  default_reward_ratio_qoyn NUMERIC(6,3) DEFAULT 0.0,
  default_reward_ratio_knyt NUMERIC(6,3) DEFAULT 0.0,
  
  description TEXT
);

-- Insert default weights
INSERT INTO public.crm_category_defaults (
  category, 
  default_rep_technical, default_rep_creative, default_rep_entrepreneurial, 
  default_rep_data_arch, default_rep_community,
  default_reward_ratio_qct, default_reward_ratio_qoyn, default_reward_ratio_knyt,
  description
) VALUES 
  ('technical', 0.7, 0.1, 0.0, 0.2, 0.0, 1.0, 0.1, 0.0, 'Code, infrastructure, tools, integrations'),
  ('creative', 0.1, 0.7, 0.0, 0.0, 0.2, 0.8, 0.0, 0.2, 'Content, design, narrative, media'),
  ('entrepreneurial', 0.0, 0.1, 0.7, 0.0, 0.2, 0.5, 0.5, 0.0, 'BD, partnerships, deals, pilots'),
  ('data', 0.3, 0.0, 0.0, 0.6, 0.1, 1.0, 0.0, 0.0, 'Datasets, pipelines, data architecture'),
  ('iqube_design', 0.3, 0.3, 0.0, 0.3, 0.1, 0.7, 0.2, 0.1, 'iQube and ClusterQube design'),
  ('community', 0.0, 0.2, 0.1, 0.0, 0.7, 0.6, 0.0, 0.4, 'Moderation, events, education, support')
ON CONFLICT (category) DO UPDATE SET
  default_rep_technical = EXCLUDED.default_rep_technical,
  default_rep_creative = EXCLUDED.default_rep_creative,
  default_rep_entrepreneurial = EXCLUDED.default_rep_entrepreneurial,
  default_rep_data_arch = EXCLUDED.default_rep_data_arch,
  default_rep_community = EXCLUDED.default_rep_community,
  default_reward_ratio_qct = EXCLUDED.default_reward_ratio_qct,
  default_reward_ratio_qoyn = EXCLUDED.default_reward_ratio_qoyn,
  default_reward_ratio_knyt = EXCLUDED.default_reward_ratio_knyt,
  description = EXCLUDED.description;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.crm_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_persona_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reputation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_category_defaults ENABLE ROW LEVEL SECURITY;

-- Service role bypass
DROP POLICY IF EXISTS "task_templates_service_role" ON public.crm_task_templates;
CREATE POLICY "task_templates_service_role" ON public.crm_task_templates
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "task_templates_read" ON public.crm_task_templates;
CREATE POLICY "task_templates_read" ON public.crm_task_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_reputation_service_role" ON public.crm_persona_reputation;
CREATE POLICY "persona_reputation_service_role" ON public.crm_persona_reputation
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "persona_reputation_read" ON public.crm_persona_reputation;
CREATE POLICY "persona_reputation_read" ON public.crm_persona_reputation
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reputation_events_service_role" ON public.crm_reputation_events;
CREATE POLICY "reputation_events_service_role" ON public.crm_reputation_events
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "reputation_events_read" ON public.crm_reputation_events;
CREATE POLICY "reputation_events_read" ON public.crm_reputation_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "category_defaults_read" ON public.crm_category_defaults;
CREATE POLICY "category_defaults_read" ON public.crm_category_defaults
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "category_defaults_service_role" ON public.crm_category_defaults;
CREATE POLICY "category_defaults_service_role" ON public.crm_category_defaults
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

-- Update timestamp trigger for task_templates
DROP TRIGGER IF EXISTS task_templates_updated_at ON public.crm_task_templates;
CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON public.crm_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

-- Update timestamp trigger for persona_reputation
DROP TRIGGER IF EXISTS persona_reputation_updated_at ON public.crm_persona_reputation;
CREATE TRIGGER persona_reputation_updated_at
  BEFORE UPDATE ON public.crm_persona_reputation
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate CVS (Contribution Value Score)
CREATE OR REPLACE FUNCTION public.calculate_cvs(
  p_final_score NUMERIC,
  p_impact_level INTEGER,
  p_impact_multiplier NUMERIC DEFAULT 1.0
) RETURNS NUMERIC AS $$
BEGIN
  -- CVS = (score/100) * impact_level * impact_multiplier
  RETURN (p_final_score / 100.0) * p_impact_level * p_impact_multiplier;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update persona reputation from deltas
CREATE OR REPLACE FUNCTION public.update_persona_reputation(
  p_persona_id UUID,
  p_delta_technical NUMERIC DEFAULT 0,
  p_delta_creative NUMERIC DEFAULT 0,
  p_delta_entrepreneurial NUMERIC DEFAULT 0,
  p_delta_data_arch NUMERIC DEFAULT 0,
  p_delta_community NUMERIC DEFAULT 0,
  p_cvs NUMERIC DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO public.crm_persona_reputation (
    persona_id,
    rep_technical, rep_creative, rep_entrepreneurial, rep_data_arch, rep_community, rep_overall,
    lifetime_cvs, total_tasks_completed
  ) VALUES (
    p_persona_id,
    p_delta_technical, p_delta_creative, p_delta_entrepreneurial, p_delta_data_arch, p_delta_community,
    p_delta_technical + p_delta_creative + p_delta_entrepreneurial + p_delta_data_arch + p_delta_community,
    p_cvs, 1
  )
  ON CONFLICT (persona_id) DO UPDATE SET
    rep_technical = crm_persona_reputation.rep_technical + p_delta_technical,
    rep_creative = crm_persona_reputation.rep_creative + p_delta_creative,
    rep_entrepreneurial = crm_persona_reputation.rep_entrepreneurial + p_delta_entrepreneurial,
    rep_data_arch = crm_persona_reputation.rep_data_arch + p_delta_data_arch,
    rep_community = crm_persona_reputation.rep_community + p_delta_community,
    rep_overall = crm_persona_reputation.rep_overall + p_delta_technical + p_delta_creative + 
                  p_delta_entrepreneurial + p_delta_data_arch + p_delta_community,
    lifetime_cvs = crm_persona_reputation.lifetime_cvs + p_cvs,
    total_tasks_completed = crm_persona_reputation.total_tasks_completed + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to get normalized reputation weights for a task
CREATE OR REPLACE FUNCTION public.get_normalized_rep_weights(
  p_task_template_id UUID
) RETURNS TABLE (
  weight_technical NUMERIC,
  weight_creative NUMERIC,
  weight_entrepreneurial NUMERIC,
  weight_data_arch NUMERIC,
  weight_community NUMERIC
) AS $$
DECLARE
  v_total NUMERIC;
  v_task RECORD;
BEGIN
  SELECT * INTO v_task FROM public.crm_task_templates WHERE id = p_task_template_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0.2::NUMERIC, 0.2::NUMERIC, 0.2::NUMERIC, 0.2::NUMERIC, 0.2::NUMERIC;
    RETURN;
  END IF;
  
  v_total := COALESCE(v_task.rep_weight_technical, 0) + 
             COALESCE(v_task.rep_weight_creative, 0) + 
             COALESCE(v_task.rep_weight_entrepreneurial, 0) + 
             COALESCE(v_task.rep_weight_data_arch, 0) + 
             COALESCE(v_task.rep_weight_community, 0);
  
  IF v_total = 0 THEN
    -- Fall back to category defaults
    SELECT 
      default_rep_technical, default_rep_creative, default_rep_entrepreneurial,
      default_rep_data_arch, default_rep_community
    INTO v_task.rep_weight_technical, v_task.rep_weight_creative, 
         v_task.rep_weight_entrepreneurial, v_task.rep_weight_data_arch, v_task.rep_weight_community
    FROM public.crm_category_defaults
    WHERE category = v_task.category;
    
    v_total := COALESCE(v_task.rep_weight_technical, 0) + 
               COALESCE(v_task.rep_weight_creative, 0) + 
               COALESCE(v_task.rep_weight_entrepreneurial, 0) + 
               COALESCE(v_task.rep_weight_data_arch, 0) + 
               COALESCE(v_task.rep_weight_community, 0);
  END IF;
  
  IF v_total = 0 THEN
    v_total := 1;  -- Prevent division by zero
  END IF;
  
  RETURN QUERY SELECT 
    COALESCE(v_task.rep_weight_technical, 0) / v_total,
    COALESCE(v_task.rep_weight_creative, 0) / v_total,
    COALESCE(v_task.rep_weight_entrepreneurial, 0) / v_total,
    COALESCE(v_task.rep_weight_data_arch, 0) / v_total,
    COALESCE(v_task.rep_weight_community, 0) / v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.crm_task_templates IS 'Task templates (TaskQubes) defining what work is worth in rewards and reputation. Tasks are the bridge between the reward and reputation systems.';
COMMENT ON TABLE public.crm_persona_reputation IS 'Multi-dimensional reputation vector per persona. Syncs with RQH canister for on-chain attestation.';
COMMENT ON TABLE public.crm_reputation_events IS 'Audit log of all reputation changes from tasks, attestations, disputes, and other sources.';
COMMENT ON TABLE public.crm_category_defaults IS 'Default reputation and reward weights by contribution category. Used when task templates do not specify custom weights.';

COMMENT ON COLUMN public.crm_task_templates.category IS 'Category determines default reputation weights: technical, creative, entrepreneurial, data, iqube_design, community';
COMMENT ON COLUMN public.crm_task_templates.verification_mode IS 'How task completion is verified: auto_tests, code_review, editor_review, peer_review, usage_based, manual';
COMMENT ON COLUMN public.crm_task_templates.impact_enabled IS 'If true, ongoing usage of produced artifacts generates additional rewards and reputation';

COMMENT ON COLUMN public.crm_contributions.task_template_id IS 'Reference to task template if this contribution is task-based';
COMMENT ON COLUMN public.crm_contributions.final_score IS 'Combined score (0-100) from PoKW, quality, and trust assessments';
COMMENT ON COLUMN public.crm_contributions.status IS 'Contribution lifecycle: claimed, submitted, under_review, accepted, rejected, cancelled';

COMMENT ON COLUMN public.crm_rewards.task_template_id IS 'Reference to task template if this reward is task-based';
COMMENT ON COLUMN public.crm_rewards.reputation_multiplier IS 'Reputation-based multiplier applied to base reward (future use)';
COMMENT ON COLUMN public.crm_rewards.pillar IS 'Which pillar this reward belongs to: knowledge, compute, or capital';

COMMENT ON COLUMN public.crm_persona_reputation.lifetime_cvs IS 'Cumulative Contribution Value Score across all completed tasks';
COMMENT ON COLUMN public.crm_persona_reputation.rqh_bucket_id IS 'ID of reputation bucket in RQH canister for on-chain sync';

COMMENT ON COLUMN public.crm_reputation_events.cvs IS 'Contribution Value Score: (final_score/100) * impact_level * impact_multiplier';
COMMENT ON COLUMN public.crm_reputation_events.source_type IS 'What triggered this reputation change: task_completion, usage_reward, manual_attestation, external_verification, dispute_resolution, decay, correction';

COMMENT ON FUNCTION public.calculate_cvs IS 'Calculate Contribution Value Score from final score, impact level, and optional multiplier';
COMMENT ON FUNCTION public.update_persona_reputation IS 'Atomically update persona reputation vector with deltas from a completed task';
COMMENT ON FUNCTION public.get_normalized_rep_weights IS 'Get normalized reputation weights for a task, falling back to category defaults if not specified';
