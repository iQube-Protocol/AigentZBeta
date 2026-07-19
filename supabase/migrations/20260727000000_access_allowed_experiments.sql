-- 20260727000000_access_allowed_experiments.sql
--
-- Per-invitation experiment scoping (operator 2026-07-19). An invitation
-- (and the grant it produces) can restrict WHICH experiments the invitee may
-- run — so a reviewer is assigned a specific subset rather than the whole
-- series, and acceptance tests / reports / plates stay admin-only.
--
-- allowed_experiments: a text[] of experiment ids (e.g. {EXP-001,EXP-004}) or
-- free-text labels. NULL or empty = unrestricted (all runnable experiments) —
-- backward-compatible: existing grants keep full access.
--
-- Also: participant result publication state (private vs public-pending vs
-- published), mirroring the myCanvas approval pattern. A participant saves a
-- result private by default; requesting public publication flips it to
-- 'pending', and a steward approves it into the published canon.
--
-- Additive/idempotent.

ALTER TABLE public.access_invitations
  ADD COLUMN IF NOT EXISTS allowed_experiments text[];

ALTER TABLE public.access_grants
  ADD COLUMN IF NOT EXISTS allowed_experiments text[];

-- Publication state on experiment_results (participant publishing flow).
--   private   → saved to the participant only (default for grant-based submits)
--   pending   → participant requested public publication; awaiting steward approval
--   published → steward-approved; joins the published reports canon
ALTER TABLE public.experiment_results
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS submitted_by_persona_id uuid,
  ADD COLUMN IF NOT EXISTS approved_by_persona_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Idempotent CHECK for visibility.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'experiment_results_visibility_check'
  ) THEN
    ALTER TABLE public.experiment_results
      ADD CONSTRAINT experiment_results_visibility_check
      CHECK (visibility IN ('private', 'pending', 'published'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS experiment_results_visibility_idx
  ON public.experiment_results (visibility);
