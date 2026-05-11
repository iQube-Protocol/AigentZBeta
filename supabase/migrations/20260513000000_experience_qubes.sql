-- ============================================================================
-- experience_qubes — per-persona ExperienceQube container.
--
-- Aigent Me Phase 2 (metaMe Personal Assistant Alpha).
-- Per PRD v0.2 §7.2 — ExperienceQube is the user's governed container for
-- their ExperienceModel, ExperienceGoals, ExperienceMap, ExperienceGuide
-- settings, plus confidential strategy / IP / partner data (BlakQube).
--
-- Design:
--   - One row per persona (UNIQUE on persona_id).
--   - meta_qube slice = public-safe columns (experience_name, type,
--     primary_goal, current_stage, progress_model, active_cartridges,
--     confidentiality_default).
--   - blak_qube slice = jsonb. Held as plain jsonb in alpha; encryption
--     wires in via services/content/encryption.ts in Phase 2.5 (no schema
--     change required at that point — encryption wraps the blob in place).
--   - Optional FK to experience_models for users who follow a catalogued
--     model from the global `experience_models` table.
--
-- Privacy contract (CLAUDE.md identity-spine rules):
--   - persona_id is T0 — server-internal only. Never serialised to JSON.
--   - meta_qube columns are T1-safe and may surface to the browser.
--   - blak_qube payload is T0 + held under user-controlled disclosure.
--     Only services/iqube/experienceQube.ts may read blak_qube; routes
--     emit a redacted summary only (per evaluateAccess decisions).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experience_qubes (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id               text NOT NULL UNIQUE,

  -- Optional link into the global model catalogue (when the user follows
  -- a curated experience_models row rather than authoring their own).
  experience_model_id      uuid REFERENCES public.experience_models(id) ON DELETE SET NULL,

  -- ── metaQube slice — public-safe ─────────────────────────────────────
  experience_name          text,
  experience_type          text NOT NULL DEFAULT 'venture_building'
    CHECK (experience_type IN (
      'personal','creative','venture','client','portfolio','venture_building'
    )),
  primary_goal             text,
  current_stage            text NOT NULL DEFAULT 'setup'
    CHECK (current_stage IN ('setup','alpha_activation','launch','growth','scale')),
  progress_model           text NOT NULL DEFAULT 'brief_decide_create_coordinate_record',
  active_cartridges        text[] NOT NULL DEFAULT ARRAY['metame']::text[],
  confidentiality_default  text NOT NULL DEFAULT 'private_by_default'
    CHECK (confidentiality_default IN ('private_by_default','selective_share','open')),

  -- ── blakQube slice — private payload (jsonb in alpha; encrypted later)
  -- Schema:
  --   {
  --     experience_goals?: string[],
  --     experience_map?: object,
  --     experience_guide_settings?: object,
  --     strategic_goals?: string[],
  --     franchise_proposition?: object,
  --     active_kpis?: object,
  --     commercial_goals?: object,
  --     operational_goals?: object,
  --     confidential_strategy_notes?: string,
  --     unreleased_ip?: object,
  --     priority_partners?: string[],
  --     active_campaigns?: string[]
  --   }
  blak_qube                jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experience_qubes_persona ON public.experience_qubes(persona_id);
CREATE INDEX IF NOT EXISTS idx_experience_qubes_model   ON public.experience_qubes(experience_model_id);
CREATE INDEX IF NOT EXISTS idx_experience_qubes_stage   ON public.experience_qubes(current_stage);

ALTER TABLE public.experience_qubes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experience_qubes_read_service"  ON public.experience_qubes FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "experience_qubes_write_service" ON public.experience_qubes FOR ALL    USING (auth.role() = 'service_role');

-- updated_at auto-touch
CREATE OR REPLACE FUNCTION public.touch_experience_qubes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_experience_qubes_touch ON public.experience_qubes;
CREATE TRIGGER trg_experience_qubes_touch
  BEFORE UPDATE ON public.experience_qubes
  FOR EACH ROW EXECUTE FUNCTION public.touch_experience_qubes_updated_at();

COMMENT ON TABLE  public.experience_qubes IS 'Aigent Me — per-persona ExperienceQube container. PRD §7.2.';
COMMENT ON COLUMN public.experience_qubes.persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.experience_qubes.blak_qube  IS 'BlakQube payload. Plain jsonb in alpha; encrypted via services/content/encryption.ts in Phase 2.5.';
