-- ============================================================================
-- stage_transitions — append-only ledger of ExperienceStage advances.
--
-- One row per advance. Captures the from/to stages, the trigger (manual
-- click vs. auto-progress sweep vs. NBE), the criteria snapshot at the
-- time, and a free-form reason. Used by the Strategy tab to render a
-- progression timeline and by analytics to measure activation velocity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stage_transitions (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id               text NOT NULL,
  from_stage               text NOT NULL,
  to_stage                 text NOT NULL,
  trigger                  text NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('manual','auto','nbe','cron-sweep')),
  criteria_snapshot        jsonb,
  progress_snapshot        jsonb,
  reason                   text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_persona     ON public.stage_transitions(persona_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_created_at  ON public.stage_transitions(created_at DESC);

ALTER TABLE public.stage_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stage_transitions_read_service"  ON public.stage_transitions;
DROP POLICY IF EXISTS "stage_transitions_write_service" ON public.stage_transitions;
CREATE POLICY "stage_transitions_read_service"  ON public.stage_transitions FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "stage_transitions_write_service" ON public.stage_transitions FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.stage_transitions IS
  'Append-only ledger of ExperienceStage advances. PRD §11.b stage timeline.';
COMMENT ON COLUMN public.stage_transitions.trigger IS
  'manual = user clicked Advance · auto = auto_progress fired on eligibility · nbe = metame.advance-stage NBE acted · cron-sweep = daily server-side sweep.';
