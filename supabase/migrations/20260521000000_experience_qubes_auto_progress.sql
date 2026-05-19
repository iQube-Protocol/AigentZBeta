-- ============================================================================
-- experience_qubes — add auto_progress opt-in.
--
-- Phase: Aigent Me Phase 3.b — stage progression.
--
-- When auto_progress = true, the server may advance the persona's
-- currentStage without a manual click as soon as every transition criterion
-- is met. The advance still emits an `experience_model_updated` receipt so
-- the operator has an audit trail.
-- ============================================================================

ALTER TABLE public.experience_qubes
  ADD COLUMN IF NOT EXISTS auto_progress boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.experience_qubes.auto_progress IS
  'When true, the server auto-advances current_stage once all per-transition criteria are met. Default false — manual confirm.';
